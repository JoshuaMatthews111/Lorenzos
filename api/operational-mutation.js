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
      "dog_name", "dog_breed", "service_interest", "lead_source", "referral_detail", "comments"
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
      "headshot_url", "status", "access_status", "credentials", "specialties", "social_links"
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
    fields: new Set(["trainer_id", "submission_type", "title", "file_url", "notes", "status", "office_notes"])
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
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
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

async function verifyAdmin(accessToken) {
  if (!accessToken) return null;
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${accessToken}` }
  });
  if (!response.ok) return null;
  const user = await response.json();
  if (!user?.id) return null;
  const rows = await supabaseFetch(
    `/rest/v1/portal_users?select=user_id,role,permission_level,active,access_status,email,display_name,first_name,last_name&user_id=eq.${encodeURIComponent(user.id)}&role=eq.admin&active=eq.true&limit=1`
  );
  const portalUser = rows?.[0];
  if (!portalUser || ["disabled", "revoked"].includes(String(portalUser.access_status || "active"))) return null;
  const permission = String(portalUser.permission_level || "super_admin");
  if (!["super_admin", "office_admin"].includes(permission)) return null;
  const actorName = clean(
    portalUser.display_name || [portalUser.first_name, portalUser.last_name].filter(Boolean).join(" "),
    180
  );
  return {
    user,
    portalUser,
    actor: {
      id: user.id,
      email: clean(portalUser.email || user.email, 254),
      name: actorName || clean(user.email, 180)
    }
  };
}

function filterChanges(config, changes) {
  return Object.fromEntries(
    Object.entries(changes || {}).filter(([key]) => config.fields.has(key))
  );
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
  const rows = await supabaseFetch(`/rest/v1/${config.table}?${encodeURIComponent(idColumn)}=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(changes)
  });
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
  return { status: 200, body: { ok: true, record, actor: admin.actor, updated_at: record.updated_at, version: record.version || null } };
}

async function createRecord(admin, body, requestId) {
  const entityType = clean(body.entity_type, 40);
  const config = ENTITY_CONFIG[entityType];
  if (!config) return { status: 400, body: { ok: false, message: "Unsupported operational record." } };
  const changes = filterChanges(config, body.changes);
  if (!Object.keys(changes).length) return { status: 400, body: { ok: false, message: "No valid fields were supplied." } };
  const rows = await supabaseFetch(`/rest/v1/${config.table}`, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(changes)
  });
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
  if (String(admin.portalUser.permission_level || "super_admin") !== "super_admin") {
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
    const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    const admin = await verifyAdmin(token);
    if (!admin) return res.status(403).json({ ok: false, message: "Active Admin or Office Admin access required." });
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const requestId = clean(body.request_id, 120) || crypto.randomUUID();
    let result;
    switch (clean(body.operation, 40)) {
      case "create": result = await createRecord(admin, body, requestId); break;
      case "update": result = await updateRecord(admin, body, requestId); break;
      case "save_note": result = await saveNote(admin, body, requestId); break;
      case "archive": result = await archiveRecord(admin, body, requestId); break;
      case "permanent_delete": result = await permanentlyDelete(admin, body, requestId); break;
      case "set_review_publications": result = await setReviewPublications(admin, body, requestId); break;
      default: result = { status: 400, body: { ok: false, message: "Unsupported operational mutation." } };
    }
    result.body.request_id = requestId;
    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error("Operational mutation API error", error);
    return res.status(error.status || 500).json({ ok: false, message: error.message || "The live record could not be saved." });
  }
};
