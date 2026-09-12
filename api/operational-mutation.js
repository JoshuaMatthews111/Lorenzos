const { supabaseRequest } = require("../lib/sandbox");
const { authorizeRequest } = require("../lib/portal-auth");
const crypto = require("node:crypto");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://ptnzaeprvkgjgtupmcty.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";

const ENTITY_CONFIG = {
  lead: {
    table: "leads",
    fields: new Set([
      "assigned_user_id", "status", "lost_reason", "office_notes", "raw_payload",
      "trainer_id", "assigned_trainer_name", "trainer_market", "trainer_city", "trainer_state",
      "first_name", "last_name", "email", "phone", "city", "state", "zip",
      "dog_name", "dog_breed", "service_interest", "lead_source", "referral_detail", "comments",
      // lead cards (2026-09-12, rule 70): real columns on leads in both schemas.
      "eval_scheduled_at", "added_to_alpha"
    ])
  },
  application: {
    table: "trainer_applications",
    fields: new Set([
      "assigned_user_id", "status", "office_notes", "raw_payload", "inquiry_type",
      "source_form", "source_page", "market", "utm_source", "utm_medium", "utm_campaign",
      "utm_content", "utm_term", "linked_discovery_id", "first_name", "last_name",
      "email", "phone", "address_line_1", "address_line_2", "city", "state", "zip", "referral_source"
    ])
  },
  client: {
    table: "clients",
    fields: new Set([
      "trainer_id", "client_name", "phone", "email", "service_area", "zip", "lead_source",
      "status", "sms_consent", "email_consent", "date_started", "last_contacted", "notes", "raw_payload"
    ])
  },
  trainer: {
    table: "trainers",
    fields: new Set([
      "slug", "full_name", "email", "phone", "market", "service_area", "state", "bio",
      "headshot_url", "status", "access_status", "credentials", "specialties", "social_links",
      "base_zip" // rule 74: the booking page measures the 50-mile radius from this ZIP
    ])
  },
  trainer_page: {
    table: "trainer_pages",
    fields: new Set([
      "trainer_id", "slug", "template_key", "page_status", "locked", "headline", "subheadline", "approved_bio",
      "approved_photo_urls", "approved_review_ids", "social_facebook", "social_instagram", "social_tiktok",
      "logo_url", "hero_image_url", "draft_content", "published_content", "style_settings", "section_order",
      "revision", "published_revision", "published_at", "public_url"
    ])
  },
  submission: {
    table: "content_submissions",
    fields: new Set(["trainer_id", "submission_type", "title", "file_url", "notes", "status", "office_notes", "photo_position"])
  },
  portal_user: {
    table: "portal_users",
    idColumn: "user_id",
    fields: new Set(["first_name", "last_name", "display_name", "profile_photo_url"])
  }
};

const LIFECYCLE_STATUS_EVENTS = {
  evaluation_scheduled: "evaluation_scheduled",
  evaluation_complete: "evaluation_completed",
  became_client: "became_client",
  lost_no_response: "lost_no_response"
};

function cors(response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return response;
}

function clean(value, maxLength = 500) {
  return String(value || "").trim().slice(0, maxLength);
}

async function supabaseFetch(path, options = {}) {
  // Practice copy: schema profile headers / practice-* bucket (lib/sandbox.js).
  const target = supabaseRequest(path, options.headers || {});
  const response = await fetch(`${SUPABASE_URL}${target.path}`, {
    ...options,
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      ...target.headers
    }
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!response.ok) {
    const message = data?.msg || data?.message || data?.error_description || data?.error || text || `Supabase request failed (${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return data;
}

// onboarding: plain words for the two ways a trainer save collides with another
// trainer. Postgres answers "duplicate key value violates unique constraint
// \"trainers_slug_key\"" — the office cannot act on that.
const UNIQUE_MESSAGES = {
  trainers_slug_key: "Another trainer already uses that web address (slug). Change the trainer's name so the address is different, then save again.",
  trainer_pages_slug_key: "Another trainer's page already uses that web address (slug). Change the trainer's name so the address is different, then save again.",
  trainer_pages_trainer_id_key: "This trainer already has a landing page. Open the existing page instead of creating another.",
  trainers_auth_user_id_key: "That login is already linked to another trainer."
};
function plainUniqueError(error) {
  const text = String(error?.message || "");
  const key = Object.keys(UNIQUE_MESSAGES).find(name => text.includes(name));
  if (!key && !/duplicate key value/i.test(text)) return null;
  const friendly = new Error(key ? UNIQUE_MESSAGES[key] : "That value is already used by another record. Change it and save again.");
  friendly.status = 409;
  return friendly;
}
// A trainer's email is their portal login, so two trainers must never share one.
async function assertTrainerEmailFree(entityType, changes, id) {
  if (entityType !== "trainer") return;
  const email = String(changes.email || "").trim().toLowerCase();
  if (!email) return;
  const rows = await supabaseFetch(`/rest/v1/trainers?select=id,full_name&email=ilike.${encodeURIComponent(email)}&status=neq.archived${id ? `&id=neq.${encodeURIComponent(id)}` : ""}&limit=1`);
  if (rows?.[0]) {
    const error = new Error(`Another trainer (${rows[0].full_name || "unnamed"}) already uses ${email}. Each trainer needs their own email because it is their portal login.`);
    error.status = 409;
    throw error;
  }
}

function filterChanges(config, changes) {
  return Object.fromEntries(
    Object.entries(changes || {}).filter(([key]) => config.fields.has(key))
  );
}

// rule 74: Base ZIP = exactly 5 digits, or empty (stored as null = not listed on the booking page).
function cleanBaseZip(value) {
  const text = String(value ?? "").trim();
  if (!text) return { value: null };
  if (!/^\d{5}$/.test(text)) return { error: "Base ZIP must be 5 digits (for example 44128). Leave it empty to keep this trainer off the booking page." };
  return { value: text };
}

// publish-guard (2026-09-05, approval ef605d4f). A trainer page may only be
// marked "published" when a public page actually exists to serve: the row
// must already carry published_content and a published_revision of 1 or more.
// Both are set by the publish_trainer_page RPC, which is the one legitimate
// publisher. Without this, a plain create/update could flip page_status to
// published on an empty row and the trainer's URL fell through to the generic
// "Right Trainer, Right Results" page (Giovanni Gutierrez, Tabatha Shelley,
// Aug 19). Applies to every writer here, service-role included.
const PUBLISH_GUARD_MESSAGE = "This trainer has no published page yet. Publish the page from Trainer Network → Edit Page first.";

function hasPublishedPage(row) {
  if (!row) return false;
  const content = row.published_content;
  const hasContent = content !== null && content !== undefined && !(typeof content === "object" && !Object.keys(content).length);
  return hasContent && Number(row.published_revision || 0) >= 1;
}

// Returns a 400 result when `changes` would mark a trainer page published
// without a servable page, otherwise null. `before` is the current row (null on
// create); the check runs against the row as it would look after the write.
function publishGuardViolation(entityType, before, changes) {
  if (entityType !== "trainer_page") return null;
  if (String(changes?.page_status || "") !== "published") return null;
  if (hasPublishedPage({ ...(before || {}), ...(changes || {}) })) return null;
  return { status: 400, body: { ok: false, publishGuard: true, message: PUBLISH_GUARD_MESSAGE } };
}

// Draft feature (Joshua 2026-09-10, rule 56). A trainer page that is LIVE stays
// live on every save except a real Publish (action "trainer_page_published").
// A draft save used to write page_status "draft" + locked false, which took the
// public page offline (Karemela Sefferin, 2026-08-05 to 2026-09-10). Now the
// row keeps page_status "published" + locked, the settings the public page reads
// straight from the row are parked in draft_content._row until Publish, and the
// published copy is never touched. Enforced here so even an old open tab cannot
// take a page down. Taking a page down is delete_trainer_page (rule 59).
const TRAINER_PAGE_PUBLIC_ROW_FIELDS = [
  "slug", "template_key", "headline", "subheadline", "approved_bio", "approved_photo_urls",
  "approved_review_ids", "social_facebook", "social_instagram", "social_tiktok", "logo_url",
  "hero_image_url", "style_settings", "section_order", "public_url"
];

function isLiveTrainerPage(row) {
  return !!row && row.page_status === "published" && row.locked === true && hasPublishedPage(row);
}

function plainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

// Moves the row settings the public page reads into draft_content._row and drops
// published_* (only the publish RPC writes those).
function parkRowFields(before, changes) {
  const next = { ...changes };
  const parked = {};
  for (const key of TRAINER_PAGE_PUBLIC_ROW_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(next, key)) { parked[key] = next[key]; delete next[key]; }
  }
  delete next.published_content; delete next.published_revision; delete next.published_at;
  const priorRow = plainObject(plainObject(before.draft_content)?._row) || {};
  const baseDraft = plainObject(next.draft_content) || plainObject(before.draft_content) || {};
  if (Object.keys(parked).length || Object.keys(priorRow).length) {
    next.draft_content = { ...baseDraft, _row: { ...priorRow, ...parked } };
  } else if (next.draft_content !== undefined) {
    next.draft_content = baseDraft;
  }
  return next;
}

// Returns the changes to write. A live page stays live, a deleted page stays
// deleted, and on both the public row settings wait in draft_content._row;
// only a real Publish (action trainer_page_published) writes them to the row.
function keepLivePageLive(entityType, before, changes, action) {
  if (entityType !== "trainer_page") return { changes, draftOnly: false };
  // Deleted first, even for a "publish": only restore_trainer_page brings a deleted page back.
  if (before?.page_status === "archived") {
    return { changes: { ...parkRowFields(before, changes), page_status: "archived", locked: false }, draftOnly: true };
  }
  if (action === "trainer_page_published" || !isLiveTrainerPage(before)) return { changes, draftOnly: false };
  return { changes: { ...parkRowFields(before, changes), page_status: "published", locked: true }, draftOnly: true };
}

// Delete / restore a trainer page (Joshua 2026-09-10, rule 59). Delete needs the
// deleter's full name AND the password they sign in with; nothing is erased, the
// page goes to page_status "archived" and comes back with restore. The typed name,
// the login and the time go to audit_events. The password is checked against
// Supabase Auth and is never stored, logged or echoed.
function typedFullName(value) {
  const name = clean(value, 200).replace(/\s+/g, " ");
  return /^\S+(\s+\S+)+$/.test(name) ? name : "";
}

async function passwordMatches(email, password) {
  if (!email || !password) return false;
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: SERVICE_ROLE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  return response.ok;
}

function trainerNameForPage(row) {
  return clean(plainObject(row?.published_content)?.trainer_name || plainObject(row?.draft_content)?.trainer_name || row?.slug || "Trainer", 120);
}

function asTypedActor(admin, typedName) {
  return { ...admin, actor: { ...admin.actor, name: clean(`${typedName} (login: ${admin.actor.name || admin.actor.email})`, 180) } };
}

async function deleteTrainerPage(admin, body, requestId) {
  const id = clean(body.id, 120);
  const typedName = typedFullName(body.deleted_by_name);
  const password = typeof body.password === "string" ? body.password : "";
  if (!id) return { status: 400, body: { ok: false, message: "Choose the trainer page to delete." } };
  if (!typedName) return { status: 400, body: { ok: false, message: "Type your full name (first and last) to delete a trainer page." } };
  if (!password) return { status: 400, body: { ok: false, message: "Type the password you sign in with to delete a trainer page." } };
  const before = await getRecord("trainer_pages", id);
  if (!before) return { status: 404, body: { ok: false, message: "Trainer page not found." } };
  if (before.page_status === "archived") return { status: 409, body: { ok: false, message: "This page is already deleted. Use Restore this page to bring it back." } };
  const login = clean(admin.user?.email || admin.actor.email, 254);
  if (!(await passwordMatches(login, password))) {
    return { status: 422, body: { ok: false, wrongPassword: true, message: "That password is not right, so the page was not deleted." } }; // not 403: the portal treats 401/403 as an expired sign-in
  }
  const rows = await supabaseFetch(`/rest/v1/trainer_pages?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ page_status: "archived", locked: false, archived_at: new Date().toISOString(), archived_by: admin.actor.id })
  });
  const record = rows?.[0];
  if (!record) return { status: 409, body: { ok: false, conflict: true, message: "The page changed before it could be deleted. Try again." } };
  const trainerName = trainerNameForPage(before);
  await audit(asTypedActor(admin, typedName), "trainer_page_deleted", "trainer_page", id, before,
    { ...record, deleted_by_name: typedName, deleted_by_login: login },
    `${typedName} deleted the ${trainerName} trainer page (login ${login}). It is off the website. Restore it from the Page Editor.`, requestId);
  return { status: 200, body: { ok: true, deleted: true, record, actor: admin.actor, updated_at: record.updated_at } };
}

async function restoreTrainerPage(admin, body, requestId) {
  const id = clean(body.id, 120);
  const typedName = typedFullName(body.restored_by_name);
  if (!id) return { status: 400, body: { ok: false, message: "Choose the trainer page to restore." } };
  if (!typedName) return { status: 400, body: { ok: false, message: "Type your full name (first and last) to restore a trainer page." } };
  const before = await getRecord("trainer_pages", id);
  if (!before) return { status: 404, body: { ok: false, message: "Trainer page not found." } };
  if (before.page_status !== "archived") return { status: 409, body: { ok: false, message: "This page is not deleted." } };
  // Back to what it was before the delete (the delete's audit row keeps the old row).
  // A page that was offline when it was deleted comes back offline. No record: draft.
  const deletions = await supabaseFetch(`/rest/v1/audit_events?select=before_data&entity_type=eq.trainer_page&action=eq.trainer_page_deleted&entity_id=eq.${encodeURIComponent(id)}&order=created_at.desc&limit=1`);
  const wasLive = isLiveTrainerPage(plainObject(deletions?.[0]?.before_data));
  const live = wasLive && hasPublishedPage(before);
  const rows = await supabaseFetch(`/rest/v1/trainer_pages?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ page_status: live ? "published" : "draft", locked: live, archived_at: null, archived_by: null })
  });
  const record = rows?.[0];
  if (!record) return { status: 409, body: { ok: false, conflict: true, message: "The page changed before it could be restored. Try again." } };
  const trainerName = trainerNameForPage(before);
  await audit(asTypedActor(admin, typedName), "trainer_page_restored", "trainer_page", id, before,
    { ...record, restored_by_name: typedName },
    `${typedName} restored the ${trainerName} trainer page. ${live ? "It is back on the website with its last published version." : "It was not live when it was deleted, so it is back as a draft (not on the website)."}`, requestId);
  return { status: 200, body: { ok: true, restored: true, live, record, actor: admin.actor, updated_at: record.updated_at, message: live ? "Trainer page restored. It is back on the website." : "Trainer page restored as a draft. It was not live when it was deleted." } };
}

async function getRecord(table, id, idColumn = "id") {
  const rows = await supabaseFetch(`/rest/v1/${table}?select=*&${encodeURIComponent(idColumn)}=eq.${encodeURIComponent(id)}&limit=1`);
  return rows?.[0] || null;
}

function versionConflict(record, expectedVersion, expectedUpdatedAt) {
  if (expectedVersion !== undefined && Number(expectedVersion) !== Number(record.version || 1)) return true;
  if (expectedUpdatedAt && String(expectedUpdatedAt) !== String(record.updated_at || "")) return true;
  return false;
}

async function audit(admin, action, entityType, entityId, beforeData, afterData, summary, requestId) {
  await supabaseFetch("/rest/v1/audit_events", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      actor_user_id: admin.actor.id,
      actor_email: admin.actor.email,
      actor_name: admin.actor.name,
      action,
      entity_type: entityType,
      entity_id: String(entityId),
      summary: clean(summary, 1000) || null,
      before_data: beforeData || null,
      after_data: afterData || null,
      request_id: requestId || null
    })
  });
}

async function writeLifecycle(admin, entityType, record, previousStatus, requestId) {
  const eventType = LIFECYCLE_STATUS_EVENTS[record.status];
  if (!eventType || record.status === previousStatus) return;
  const eventKey = `${entityType}:${record.id}:${eventType}:${record.version || record.updated_at}`;
  await supabaseFetch("/rest/v1/lifecycle_events?on_conflict=event_key", {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
    body: JSON.stringify({
      event_key: eventKey,
      entity_type: entityType,
      entity_id: String(record.id),
      event_type: eventType,
      market: record.trainer_market || record.market || record.city || null,
      source_page: record.source_page || record.raw_payload?.source_page || null,
      actor_user_id: admin.actor.id,
      raw_payload: { previous_status: previousStatus, new_status: record.status, request_id: requestId }
    })
  });
}

async function updateRecord(admin, body, requestId) {
  const entityType = clean(body.entity_type, 40);
  const config = ENTITY_CONFIG[entityType];
  const id = clean(body.id, 120);
  if (!config || !id) return { status: 400, body: { ok: false, message: "A supported entity type and record ID are required." } };
  const idColumn = config.idColumn || "id";
  const before = await getRecord(config.table, id, idColumn);
  if (!before) return { status: 404, body: { ok: false, message: "Record not found." } };
  if (versionConflict(before, body.expected_version, body.expected_updated_at)) {
    return { status: 409, body: { ok: false, conflict: true, message: "This record was updated by another staff member.", record: before } };
  }
  const changes = filterChanges(config, body.changes);
  if (!Object.keys(changes).length) return { status: 400, body: { ok: false, message: "No supported changes were supplied." } };
  // lead cards (2026-09-12): a real yes/no and a real timestamp, or nothing is written.
  if (entityType === "lead") {
    if ("added_to_alpha" in changes) changes.added_to_alpha = changes.added_to_alpha === true;
    if ("eval_scheduled_at" in changes) {
      const when = changes.eval_scheduled_at ? new Date(changes.eval_scheduled_at) : null;
      if (when && Number.isNaN(when.getTime())) return { status: 400, body: { ok: false, message: "The eval date and time could not be read. Pick it again." } };
      changes.eval_scheduled_at = when ? when.toISOString() : null;
    }
  }
  // rule 74: a trainer's Base ZIP is 5 digits or empty (empty = not listed on the booking page).
  if (entityType === "trainer" && "base_zip" in changes) {
    const zipCheck = cleanBaseZip(changes.base_zip);
    if (zipCheck.error) return { status: 400, body: { ok: false, message: zipCheck.error } };
    changes.base_zip = zipCheck.value;
  }
  // rule 45: an application save sends only the keys it owns (the office stage
  // stamp). Merge them into the stored raw_payload so a stale browser can never
  // replace the applicant's answers or another staff member's stamp wholesale.
  if (entityType === "application" && changes.raw_payload && typeof changes.raw_payload === "object" && !Array.isArray(changes.raw_payload)) {
    changes.raw_payload = { ...(before.raw_payload || {}), ...changes.raw_payload };
  }
  const kept = keepLivePageLive(entityType, before, changes, clean(body.action, 80)); // rule 56
  if (kept.draftOnly) { for (const key of Object.keys(changes)) delete changes[key]; Object.assign(changes, kept.changes); }
  const guard = publishGuardViolation(entityType, before, changes); // publish-guard
  if (guard) return guard;
  await assertTrainerEmailFree(entityType, changes, id); // onboarding
  const rows = await supabaseFetch(`/rest/v1/${config.table}?${encodeURIComponent(idColumn)}=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(changes)
  }).catch(error => { throw plainUniqueError(error) || error; }); // onboarding
  const record = rows?.[0];
  if (!record) return { status: 409, body: { ok: false, conflict: true, message: "The record changed before this save completed." } };
  await audit(admin, clean(body.action, 80) || "updated", entityType, id, before, record, body.summary, requestId);
  await writeLifecycle(admin, entityType, record, before.status, requestId);
  if (entityType === "lead" && before.status !== record.status) {
    await supabaseFetch("/rest/v1/lead_events", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        lead_id: record.id,
        event_type: "status_changed",
        previous_status: before.status,
        new_status: record.status,
        actor_user_id: admin.actor.id,
        event_key: `lead:${record.id}:status:${record.version || record.updated_at}`,
        occurred_at: new Date().toISOString(),
        raw_payload: { request_id: requestId }
      })
    });
  }
  return { status: 200, body: { ok: true, record, actor: admin.actor, updated_at: record.updated_at, version: record.version || null, draft_only: kept.draftOnly } };
}

async function createRecord(admin, body, requestId) {
  const entityType = clean(body.entity_type, 40);
  const config = ENTITY_CONFIG[entityType];
  if (!config) return { status: 400, body: { ok: false, message: "Unsupported operational record." } };
  const changes = filterChanges(config, body.changes);
  if (!Object.keys(changes).length) return { status: 400, body: { ok: false, message: "No valid fields were supplied." } };
  if (entityType === "trainer" && "base_zip" in changes) { // rule 74
    const zipCheck = cleanBaseZip(changes.base_zip);
    if (zipCheck.error) return { status: 400, body: { ok: false, message: zipCheck.error } };
    changes.base_zip = zipCheck.value;
  }
  const guard = publishGuardViolation(entityType, null, changes); // publish-guard
  if (guard) return guard;
  await assertTrainerEmailFree(entityType, changes, ""); // onboarding
  const rows = await supabaseFetch(`/rest/v1/${config.table}`, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(changes)
  }).catch(error => { throw plainUniqueError(error) || error; }); // onboarding
  const record = rows?.[0];
  if (!record) return { status: 500, body: { ok: false, message: "The canonical record was not created." } };
  await audit(admin, clean(body.action, 80) || "created", entityType, record.id, null, record, body.summary || "Record created", requestId);
  return { status: 200, body: { ok: true, record, actor: admin.actor, updated_at: record.updated_at || record.created_at || null, version: record.version || null } };
}

async function saveNote(admin, body, requestId) {
  const entityType = clean(body.entity_type, 40);
  const entityId = clean(body.entity_id, 120);
  const noteText = clean(body.note, 20000);
  if (!ENTITY_CONFIG[entityType] || !entityId || !noteText) {
    return { status: 400, body: { ok: false, message: "A record and note text are required." } };
  }
  let before = null;
  let rows;
  if (body.note_id) {
    before = await getRecord("office_notes", clean(body.note_id, 120));
    if (!before) return { status: 404, body: { ok: false, message: "Note not found." } };
    if (String(before.created_by || "") !== String(admin.actor.id)) {
      return { status: 403, body: { ok: false, message: "You can only edit a note you typed yourself." } };
    }
    if (versionConflict(before, body.expected_version, body.expected_updated_at)) {
      return { status: 409, body: { ok: false, conflict: true, message: "This note was already edited by another staff member.", record: before } };
    }
    rows = await supabaseFetch(`/rest/v1/office_notes?id=eq.${encodeURIComponent(before.id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ note: noteText })
    });
  } else {
    rows = await supabaseFetch("/rest/v1/office_notes", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ entity_type: entityType, entity_id: entityId, note: noteText, created_by: admin.actor.id })
    });
  }
  const record = rows?.[0];
  if (record && entityType === "application") {
    const applicationNotes = await supabaseFetch(`/rest/v1/office_notes?select=note&entity_type=eq.application&entity_id=eq.${encodeURIComponent(entityId)}&order=created_at.asc`);
    const officeNotesSummary = (applicationNotes || []).map(item => clean(item.note, 20000)).filter(Boolean).join("\n\n");
    await supabaseFetch(`/rest/v1/${ENTITY_CONFIG.application.table}?id=eq.${encodeURIComponent(entityId)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ office_notes: officeNotesSummary || null })
    });
  }
  await audit(admin, before ? "note_edited" : "note_added", entityType, entityId, before, record, body.summary || noteText.slice(0, 240), requestId);
  return { status: 200, body: { ok: true, record, actor: admin.actor, updated_at: record.updated_at || record.created_at, version: record.version || 1 } };
}

// Deleting an office note is deliberately narrower than every other delete here:
// you may remove a note only if YOU wrote it. Permission level does not widen this,
// so a Super Admin cannot quietly erase someone else's record of a call.
async function deleteNote(admin, body, requestId) {
  const noteId = clean(body.note_id, 120);
  if (!noteId) return { status: 400, body: { ok: false, message: "A note is required." } };
  const before = await getRecord("office_notes", noteId);
  if (!before) return { status: 404, body: { ok: false, message: "Note not found." } };
  if (String(before.created_by || "") !== String(admin.actor.id)) {
    return { status: 403, body: { ok: false, message: "You can only delete a note you typed yourself." } };
  }
  await supabaseFetch(`/rest/v1/office_note_revisions?office_note_id=eq.${encodeURIComponent(noteId)}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" }
  });
  await supabaseFetch(`/rest/v1/office_notes?id=eq.${encodeURIComponent(noteId)}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" }
  });
  // The application table carries a flattened copy of its notes for the sheet export,
  // so rebuild it or the deleted note keeps showing up there.
  if (before.entity_type === "application" && before.entity_id) {
    const remaining = await supabaseFetch(`/rest/v1/office_notes?select=note&entity_type=eq.application&entity_id=eq.${encodeURIComponent(before.entity_id)}&order=created_at.asc`);
    const summary = (remaining || []).map(item => clean(item.note, 20000)).filter(Boolean).join("\n\n");
    await supabaseFetch(`/rest/v1/${ENTITY_CONFIG.application.table}?id=eq.${encodeURIComponent(before.entity_id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ office_notes: summary || null })
    });
  }
  await audit(admin, "note_deleted", before.entity_type || "office_note", before.entity_id || noteId, before, null, body.summary || "Author deleted their own note", requestId);
  return { status: 200, body: { ok: true, deleted: true, id: noteId, actor: admin.actor } };
}

async function archiveRecord(admin, body, requestId) {
  const entityType = clean(body.entity_type, 40);
  const config = ENTITY_CONFIG[entityType];
  const id = clean(body.id, 120);
  if (!config || !id || !["lead", "application", "client", "trainer", "submission"].includes(entityType)) {
    return { status: 400, body: { ok: false, message: "This record cannot be archived." } };
  }
  const before = await getRecord(config.table, id);
  if (!before) return { status: 404, body: { ok: false, message: "Record not found." } };
  if (versionConflict(before, body.expected_version, body.expected_updated_at)) {
    return { status: 409, body: { ok: false, conflict: true, message: "This record was updated by another staff member.", record: before } };
  }
  const changes = { archived_at: new Date().toISOString(), archived_by: admin.actor.id };
  if (config.fields.has("status") || ["lead", "application", "client", "trainer", "submission"].includes(entityType)) changes.status = "archived";
  const rows = await supabaseFetch(`/rest/v1/${config.table}?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(changes)
  });
  const record = rows?.[0];
  await audit(admin, "archived", entityType, id, before, record, body.summary || "Record archived", requestId);
  return { status: 200, body: { ok: true, record, actor: admin.actor, updated_at: record.updated_at, version: record.version || null } };
}

function mayPermanentlyDelete(record) {
  const text = JSON.stringify(record || {}).toLowerCase();
  return record?.archived_at && /\b(qa|test|duplicate|draft)\b/.test(text);
}

async function permanentlyDelete(admin, body, requestId) {
  if (!admin.isSuperAdmin) {
    return { status: 403, body: { ok: false, message: "Only a Super Admin can permanently delete a record." } };
  }
  const entityType = clean(body.entity_type, 40);
  const config = ENTITY_CONFIG[entityType];
  const id = clean(body.id, 120);
  if (!config || !id || clean(body.confirmation, 40) !== "PERMANENTLY DELETE") {
    return { status: 400, body: { ok: false, message: "Type PERMANENTLY DELETE to confirm." } };
  }
  const before = await getRecord(config.table, id);
  if (!before) return { status: 404, body: { ok: false, message: "Record not found." } };
  if (!mayPermanentlyDelete(before)) {
    return { status: 400, body: { ok: false, message: "Permanent deletion is limited to archived QA, duplicate, or draft records." } };
  }
  await audit(admin, "permanently_deleted", entityType, id, before, null, body.summary || "Confirmed permanent deletion", requestId);
  await supabaseFetch(`/rest/v1/${config.table}?id=eq.${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" }
  });
  return { status: 200, body: { ok: true, deleted: true, id, actor: admin.actor } };
}

async function setReviewPublications(admin, body, requestId) {
  const submissionId = clean(body.submission_id, 120);
  const destinations = Array.isArray(body.destinations) ? body.destinations.slice(0, 100) : [];
  const submission = await getRecord("content_submissions", submissionId);
  if (!submission) return { status: 404, body: { ok: false, message: "Review submission not found." } };
  const current = await supabaseFetch(`/rest/v1/review_publications?select=*&submission_id=eq.${encodeURIComponent(submissionId)}`);
  const desiredByKey = new Map();
  destinations.forEach(item => {
    const destinationType = ["homepage", "trainer_page", "city_page"].includes(clean(item.destination_type, 40)) ? clean(item.destination_type, 40) : "trainer_page";
    const destinationId = clean(item.destination_id, 180);
    if (!destinationId) return;
    desiredByKey.set(`${destinationType}:${destinationId}`, {
      destination_type: destinationType,
      destination_id: destinationId
    });
  });
  const desired = [...desiredByKey.values()];
  const desiredKeys = new Set(desired.map(item => `${item.destination_type}:${item.destination_id}`));
  for (const row of current || []) {
    if (desiredKeys.has(`${row.destination_type}:${row.destination_id}`)) continue;
    await supabaseFetch(`/rest/v1/review_publications?id=eq.${encodeURIComponent(row.id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ status: "unpublished" })
    });
  }
  if (desired.length) {
    await supabaseFetch("/rest/v1/review_publications?on_conflict=submission_id,destination_type,destination_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(desired.map(item => ({
        submission_id: submissionId,
        ...item,
        status: body.published === false ? "draft" : "published",
        published_by: admin.actor.id,
        published_at: body.published === false ? null : new Date().toISOString()
      })))
    });
  }
  const requestedWorkflow = clean(body.workflow_status, 40).toLowerCase();
  const status = body.published === false
    ? (["archived", "declined"].includes(requestedWorkflow) ? requestedWorkflow : "pending")
    : "approved";
  const updated = await supabaseFetch(`/rest/v1/content_submissions?id=eq.${encodeURIComponent(submissionId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ status, office_notes: clean(body.office_note, 10000) || submission.office_notes || null })
  });
  const publications = await supabaseFetch(`/rest/v1/review_publications?select=*&submission_id=eq.${encodeURIComponent(submissionId)}&order=updated_at.desc`);
  await audit(admin, body.published === false ? "review_unpublished" : "review_published", "submission", submissionId, current, publications, body.summary || "Review destinations saved", requestId);
  const record = updated?.[0] || submission;
  return {
    status: 200,
    body: {
      ok: true,
      record,
      publications,
      actor: admin.actor,
      updated_at: record.updated_at || null,
      version: record.version || null
    }
  };
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, message: "Method not allowed" });
  if (!SERVICE_ROLE_KEY) return res.status(500).json({ ok: false, message: "Supabase service role key is not configured on Vercel." });
  try {
    // Office staff only (lib/portal-auth.js): super_admin or office_admin. A
    // sandbox testing login is turned away on live inside authorizeRequest.
    const admin = await authorizeRequest(req, res, { require: "admin", message: "Active Admin or Office Admin access required." });
    if (!admin) return;
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const requestId = clean(body.request_id, 120) || crypto.randomUUID();
    let result;
    switch (clean(body.operation, 40)) {
      case "create": result = await createRecord(admin, body, requestId); break;
      case "update": result = await updateRecord(admin, body, requestId); break;
      case "save_note": result = await saveNote(admin, body, requestId); break;
      case "delete_note": result = await deleteNote(admin, body, requestId); break;
      case "archive": result = await archiveRecord(admin, body, requestId); break;
      case "permanent_delete": result = await permanentlyDelete(admin, body, requestId); break;
      case "set_review_publications": result = await setReviewPublications(admin, body, requestId); break;
      case "delete_trainer_page": result = await deleteTrainerPage(admin, body, requestId); break;
      case "restore_trainer_page": result = await restoreTrainerPage(admin, body, requestId); break;
      default: result = { status: 400, body: { ok: false, message: "Unsupported operational mutation." } };
    }
    result.body.request_id = requestId;
    return res.status(result.status).json(result.body);
  } catch (error) {
    if (!error.status || error.status >= 500) console.error("Operational mutation API error", error); // onboarding: a 409 is an answer, not a crash
    return res.status(error.status || 500).json({ ok: false, message: error.message || "The live record could not be saved." });
  }
};

// Exposed for scripts/test-publish-guard.mjs; the handler above is unchanged.
module.exports.PUBLISH_GUARD_MESSAGE = PUBLISH_GUARD_MESSAGE;
module.exports.publishGuardViolation = publishGuardViolation;
module.exports.hasPublishedPage = hasPublishedPage;
module.exports.keepLivePageLive = keepLivePageLive;
module.exports.TRAINER_PAGE_PUBLIC_ROW_FIELDS = TRAINER_PAGE_PUBLIC_ROW_FIELDS;
