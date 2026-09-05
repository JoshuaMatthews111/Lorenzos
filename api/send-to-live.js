// Send to live — the ONE practice-copy action that writes to a live table.
//
// The office builds a trainer page or a Page Studio ad page on the practice
// copy. Everything there lives in the `practice` schema and the practice-*
// buckets (lib/sandbox.js): the live tables never change. When they like what
// they see, this endpoint copies the page's current practice row into the LIVE
// table (`public`) as a DRAFT so it can be published from the live portal.
// Joshua's rule: "after someone does it in the sandbox it stays in the
// sandbox, and if they like what they see it can be pushed live."
//
// Hard limits (DO-NOT-BREAK #18):
//   - runs only when LDTT_SANDBOX=1; on the live deployment it answers 404
//   - reads from `practice` (Accept-Profile: practice) and writes to `public`
//     (Content-Profile: public) explicitly — never through the schema switch
//   - writes draft_content only; published_content, published_revision,
//     published_at, page_status/status = published and locked are NEVER written
//   - never creates auth users, never sends email or SMS
//   - photos uploaded on the practice copy are COPIED (never moved) from the
//     practice-* bucket to the live bucket and the URLs re-pointed, so the live
//     draft does not depend on a practice file
//   - idempotent: a second send updates the same live draft (matched by id,
//     then slug); it does not make a second row
//   - every send is logged to practice.send_to_live_log so the practice copy
//     shows "Sent to live ✓" on that item
//
// Publishing stays on live only.

const { isSandbox } = require("../lib/sandbox");
const template = require("../lib/ad-page-template.js");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://ptnzaeprvkgjgtupmcty.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";

// Swappable for tests and the local proof server. Production never touches it.
const deps = {
  fetch: (...args) => fetch(...args),
  now: () => new Date()
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const clean = (value, max = 200) => String(value ?? "").trim().slice(0, max);
const fail = (status, message) => Object.assign(new Error(message), { status });

// Columns a send may set. Anything to do with "published" is deliberately absent.
const TRAINER_PAGE_DRAFT_FIELDS = [
  "slug", "template_key", "headline", "subheadline", "approved_bio", "approved_photo_urls",
  "approved_review_ids", "social_facebook", "social_instagram", "social_tiktok", "logo_url",
  "hero_image_url", "draft_content", "style_settings", "section_order"
]; // public_url is left out on purpose: on the practice copy it points at the practice deployment.
const TRAINER_FIELDS = [
  "slug", "full_name", "email", "phone", "market", "service_area", "state", "bio",
  "headshot_url", "credentials", "specialties", "social_links"
];
const FORBIDDEN_KEYS = new Set(["published_content", "published_revision", "published_at", "auth_user_id"]);

// Belt and braces: every body that goes to a live table passes through here first.
function assertDraftOnly(body) {
  const rows = Array.isArray(body) ? body : [body];
  rows.forEach(row => {
    Object.keys(row || {}).forEach(key => {
      if (FORBIDDEN_KEYS.has(key)) throw fail(500, `Send to live refused to write ${key}.`);
    });
    if (row?.page_status === "published" || row?.status === "published" || row?.locked === true) {
      throw fail(500, "Send to live refused to publish.");
    }
  });
  return body;
}

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  return res;
}

// Both sides name their schema explicitly. The schema switch in lib/sandbox.js
// is NOT used here on purpose: this is the one place that must talk to both.
async function schemaFetch(schema, path, options = {}) {
  if (schema === "public" && options.body && path.startsWith("/rest/v1/")) assertDraftOnly(JSON.parse(options.body));
  const response = await deps.fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      ...(path.startsWith("/rest/v1/") ? { "Accept-Profile": schema, "Content-Profile": schema } : {}),
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { message: text.slice(0, 200) }; }
  if (!response.ok) {
    const message = /relation "public\.ad_pages" does not exist|Could not find the table 'public\.ad_pages'/i.test(text)
      ? "The ad_pages table is not in the live database yet. Apply supabase/migrations/20260905120000_ad_pages.sql, then try again."
      : data?.message || `Supabase ${response.status}`;
    throw Object.assign(new Error(message), { status: response.status === 404 ? 503 : response.status, detail: data });
  }
  return data;
}
const practiceFetch = (path, options) => schemaFetch("practice", path, options);
const liveFetch = (path, options) => schemaFetch("public", path, options);

// Same rule as api/ad-pages.js and api/operational-mutation.js: an active admin
// portal user whose permission is super_admin or office_admin. A trainer login
// is refused. Checked against the practice copy of portal_users, which is what
// the person is signed in to.
async function verifyOfficeUser(token) {
  if (!token) return null;
  const r = await deps.fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${token}` } });
  if (!r.ok) return null;
  const user = await r.json();
  if (!user?.id) return null;
  const rows = await practiceFetch(`/rest/v1/portal_users?select=user_id,role,permission_level,active,access_status,email,display_name,first_name,last_name&user_id=eq.${encodeURIComponent(user.id)}&active=eq.true&limit=1`);
  const pu = rows?.[0];
  if (!pu || ["disabled", "revoked"].includes(String(pu.access_status || "active"))) return null;
  const isAdmin = pu.role === "admin" && ["super_admin", "office_admin"].includes(String(pu.permission_level || "super_admin"));
  if (!isAdmin) return null;
  const email = clean(pu.email || user.email, 254).toLowerCase();
  const name = [pu.first_name, pu.last_name].filter(Boolean).join(" ") || pu.display_name || email || "office";
  return { user, portalUser: pu, email, name };
}

const pick = (source, keys) => Object.fromEntries(keys.filter(key => source[key] !== undefined).map(key => [key, source[key]]));
const stampNote = (auth, at) => `Sent from practice copy by ${auth.email} at ${at}`;

async function rows(schema, table, filters) {
  const query = filters.map(([column, value]) => `${encodeURIComponent(column)}=eq.${encodeURIComponent(value)}`).join("&");
  return schemaFetch(schema, `/rest/v1/${table}?select=*&${query}&limit=1`);
}
const practiceRow = async (table, filters) => (await rows("practice", table, filters))?.[0] || null;
const liveRow = async (table, filters) => (await rows("public", table, filters))?.[0] || null;

// ---------------------------------------------------------------------------
// Practice uploads → live bucket. A URL like
//   <SUPABASE_URL>/storage/v1/object/public/practice-trainer-page-assets/<key>
// anywhere in the row (top-level columns, arrays, draft_content) is copied to
// the live bucket with the same key and rewritten. Copy, never move: the
// practice page keeps working. Already-copied objects are left alone.
// ---------------------------------------------------------------------------
const PRACTICE_OBJECT_URL = /\/storage\/v1\/object\/(public|sign|authenticated)\/practice-([a-z0-9-]+)\/([^\s"'?)]+)/g;

async function copyObject(bucket, key) {
  const response = await deps.fetch(`${SUPABASE_URL}/storage/v1/object/copy`, {
    method: "POST",
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ bucketId: `practice-${bucket}`, sourceKey: key, destinationBucket: bucket, destinationKey: key })
  });
  if (response.ok) return "copied";
  const text = await response.text().catch(() => "");
  if (response.status === 409 || /already exists|Duplicate/i.test(text)) return "exists";
  throw fail(502, `A practice upload could not be copied to the live bucket (${response.status}): ${text.slice(0, 160)}`);
}

async function repointPracticeUploads(value, copied) {
  if (typeof value === "string") {
    const matches = [...value.matchAll(PRACTICE_OBJECT_URL)];
    if (!matches.length) return value;
    for (const match of matches) {
      const bucket = match[2];
      const key = decodeURIComponent(match[3]);
      const seen = `${bucket}/${key}`;
      if (!copied.has(seen)) copied.set(seen, await copyObject(bucket, key));
    }
    return value.replace(PRACTICE_OBJECT_URL, (whole, kind, bucket, key) => `/storage/v1/object/${kind}/${bucket}/${key}`);
  }
  if (Array.isArray(value)) {
    const out = [];
    for (const item of value) out.push(await repointPracticeUploads(item, copied));
    return out;
  }
  if (value && typeof value === "object") {
    const out = {};
    for (const [key, item] of Object.entries(value)) out[key] = await repointPracticeUploads(item, copied);
    return out;
  }
  return value;
}

// ---------------------------------------------------------------------------
// Trainer page → live trainer_pages draft
// ---------------------------------------------------------------------------
async function sendTrainerPage(auth, id, slugHint, copied) {
  const at = deps.now().toISOString();
  let page = UUID.test(id) ? await practiceRow("trainer_pages", [["id", id]]) : null;
  if (!page && slugHint) page = await practiceRow("trainer_pages", [["slug", slugHint]]);
  if (!page) throw fail(404, "That trainer page could not be found on the practice copy.");
  const slug = clean(page.slug || slugHint, 120);
  if (!slug) throw fail(400, "The trainer page needs a web address (slug) before it can be sent.");

  // The live target: the live row with this id, else this slug, else the live
  // page of the trainer this page belongs to.
  let target = await liveRow("trainer_pages", [["id", page.id]]);
  if (!target) target = await liveRow("trainer_pages", [["slug", slug]]);

  // The trainer record. If it only exists on the practice copy, create it on
  // live as a plain enrolled trainer: no login, no email sent, nothing public.
  let liveTrainerId = target?.trainer_id || null;
  let trainerOutcome = "existing";
  if (!liveTrainerId) {
    const liveTrainer = UUID.test(String(page.trainer_id || "")) ? await liveRow("trainers", [["id", page.trainer_id]]) : null;
    if (liveTrainer) liveTrainerId = liveTrainer.id;
    else {
      const practiceTrainer = UUID.test(String(page.trainer_id || "")) ? await practiceRow("trainers", [["id", page.trainer_id]]) : null;
      const trainerSlug = clean(practiceTrainer?.slug || slug, 120);
      const bySlug = await liveRow("trainers", [["slug", trainerSlug]]);
      if (bySlug) liveTrainerId = bySlug.id;
      else {
        if (!practiceTrainer) throw fail(404, "The trainer for this page could not be found on the practice copy.");
        const trainerBody = await repointPracticeUploads({ ...pick(practiceTrainer, TRAINER_FIELDS), slug: trainerSlug, full_name: practiceTrainer.full_name || slug, status: "enrolled", access_status: "active" }, copied);
        const [created] = await liveFetch("/rest/v1/trainers", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(trainerBody) });
        if (!created?.id) throw fail(500, "The live trainer record could not be created.");
        liveTrainerId = created.id;
        trainerOutcome = "created";
      }
    }
    if (!target) target = await liveRow("trainer_pages", [["trainer_id", liveTrainerId]]);
  }

  const draftContent = { ...(page.draft_content && typeof page.draft_content === "object" ? page.draft_content : {}), _sent_from_practice: { by: auth.email, name: auth.name, at } };
  const liveRevision = Number(target?.revision || 0);
  const versionRevision = liveRevision + 1;
  const body = await repointPracticeUploads({
    ...pick(page, TRAINER_PAGE_DRAFT_FIELDS),
    slug,
    trainer_id: liveTrainerId,
    draft_content: draftContent,
    revision: liveRevision + 2
  }, copied);
  if (!target) { body.page_status = "draft"; body.locked = false; }

  let row;
  if (target) {
    [row] = await liveFetch(`/rest/v1/trainer_pages?id=eq.${encodeURIComponent(target.id)}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(body) });
  } else {
    [row] = await liveFetch("/rest/v1/trainer_pages", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(body) });
  }
  if (!row?.id) throw fail(500, "The live trainer page draft could not be saved.");

  // trainer_page_versions has no note column, so the note rides inside content.
  await liveFetch("/rest/v1/trainer_page_versions?on_conflict=trainer_page_id,revision", {
    method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ trainer_page_id: row.id, revision: versionRevision, content: { ...body.draft_content, _note: stampNote(auth, at) }, style_settings: row.style_settings || {}, section_order: row.section_order || [] })
  });

  return { live_id: row.id, practice_id: page.id, slug, trainer: trainerOutcome, trainer_id: liveTrainerId, created: !target, at };
}

// ---------------------------------------------------------------------------
// Ad page → live ad_pages draft
// ---------------------------------------------------------------------------
async function sendAdPage(auth, id, slugHint, copied) {
  const at = deps.now().toISOString();
  let page = UUID.test(id) ? await practiceRow("ad_pages", [["id", id]]) : null;
  if (!page && slugHint) page = await practiceRow("ad_pages", [["slug", slugHint]]);
  if (!page) throw fail(404, "That ad page could not be found on the practice copy.");
  const content = await repointPracticeUploads(template.normalizeContent(page.draft_content || {}), copied);
  if (!content.slug) throw fail(400, "The ad page needs a web address before it can be sent.");
  if (template.markets.some(market => market.slug === content.slug)) throw fail(409, `/${content.slug} is a page built into the site. Give the ad page another address first.`);

  let target = await liveRow("ad_pages", [["id", page.id]]);
  if (!target) target = await liveRow("ad_pages", [["slug", content.slug]]);

  const updatedBy = `${auth.email} (from practice copy)`;
  const draftRevision = Number(target?.draft_revision || 0) + 1;
  let row;
  if (target) {
    [row] = await liveFetch(`/rest/v1/ad_pages?id=eq.${encodeURIComponent(target.id)}`, {
      method: "PATCH", headers: { Prefer: "return=representation" },
      body: JSON.stringify({ slug: content.slug, market: content.market, city: content.city, state: content.state, draft_content: content, draft_revision: draftRevision, updated_by: updatedBy })
    });
  } else {
    [row] = await liveFetch("/rest/v1/ad_pages", {
      method: "POST", headers: { Prefer: "return=representation" },
      body: JSON.stringify({ slug: content.slug, market: content.market, city: content.city, state: content.state, status: "draft", draft_content: content, draft_revision: draftRevision, created_by: updatedBy, updated_by: updatedBy })
    });
  }
  if (!row?.id) throw fail(500, "The live ad page draft could not be saved.");
  await liveFetch("/rest/v1/ad_page_revisions", {
    method: "POST", headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ page_id: row.id, revision: draftRevision, kind: "draft", content, created_by: stampNote(auth, at) })
  });
  return { live_id: row.id, practice_id: page.id, slug: content.slug, created: !target, at };
}

// ---------------------------------------------------------------------------
module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  // Outside the practice copy this endpoint does not exist. Checked before auth
  // so a live deployment gives away nothing.
  if (!isSandbox()) return res.status(404).json({ ok: false, message: "Not found." });
  if (req.method !== "POST") return res.status(405).json({ ok: false, message: "Method not allowed" });
  if (!SERVICE_ROLE_KEY) return res.status(500).json({ ok: false, message: "Supabase service role key is not configured." });

  try {
    const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    const auth = await verifyOfficeUser(token);
    if (!auth) return res.status(403).json({ ok: false, message: "Send to live is for office staff (Super Admin or Office Admin). Sign in with an office account." });

    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const kind = clean(body.kind, 40);
    const id = clean(body.id, 120);
    const slugHint = clean(body.slug, 120);
    if (!["trainer_page", "ad_page"].includes(kind)) throw fail(400, 'kind must be "trainer_page" or "ad_page".');
    if (!id && !slugHint) throw fail(400, "Which page?");

    const copied = new Map(); // "bucket/key" → copied | exists
    const result = kind === "trainer_page" ? await sendTrainerPage(auth, id, slugHint, copied) : await sendAdPage(auth, id, slugHint, copied);

    // The practice copy shows "Sent to live ✓ at <time>" from this log.
    await practiceFetch("/rest/v1/send_to_live_log", {
      method: "POST", headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ entity_type: kind, entity_id: result.practice_id || id || result.live_id, slug: result.slug, live_id: result.live_id, sent_by: auth.email, sent_at: result.at })
    });

    const where = kind === "trainer_page" ? "Trainer Network" : "Page Studio";
    const files = [...copied.values()].filter(v => v === "copied").length;
    return res.status(200).json({
      ok: true, sandbox: true, kind, ...result, sent_at: result.at, files_copied: files,
      message: `Sent to live as a draft${files ? ` with ${files} photo${files === 1 ? "" : "s"}` : ""}. Open the live portal → ${where} to publish it.`
    });
  } catch (error) {
    const status = error.status && error.status >= 400 && error.status < 600 ? error.status : 500;
    return res.status(status).json({ ok: false, message: error.message || "Send to live could not complete.", detail: error.detail || null });
  }
};
module.exports.deps = deps;
module.exports.assertDraftOnly = assertDraftOnly;
