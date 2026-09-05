// Send to live — the ONE sandbox write that reaches a live table.
//
// The office builds a trainer page or a Page Studio ad page on the sandbox.
// Every edit there lands in the practice layer (DO-NOT-BREAK #5): the live
// tables never change. When they like what they see, this endpoint copies the
// page's current practice state into the LIVE table as a DRAFT so it can be
// published from the live portal. Joshua's rule: "after someone does it in
// the sandbox it stays in the sandbox, and if they like what they see it can
// be pushed live."
//
// Hard limits (DO-NOT-BREAK #18):
//   - runs only when LDTT_SANDBOX=1; on the live deployment it answers 404
//   - writes draft_content only; published_content, published_revision,
//     published_at, page_status/status = published and locked are NEVER written
//   - never creates auth users, never sends email or SMS
//   - idempotent: a second send updates the same live draft (matched by id,
//     then slug); it does not make a second row
//   - every send is logged to the practice ops log as {operation:"send_to_live"}
//     so the sandbox shows "Sent to live" on that item
//
// Publishing stays on live only.

const { isSandbox } = require("../lib/sandbox");
const sandboxStore = require("../lib/sandbox-store");
const template = require("../lib/ad-page-template.js");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://ptnzaeprvkgjgtupmcty.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";

// Swappable for tests and the local proof server. Production never touches it.
const deps = {
  fetch: (...args) => fetch(...args),
  store: sandboxStore,
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
]; // public_url is left out on purpose: on the sandbox it points at the practice deployment.
const TRAINER_FIELDS = [
  "slug", "full_name", "email", "phone", "market", "service_area", "state", "bio",
  "headshot_url", "credentials", "specialties", "social_links"
];
const FORBIDDEN_KEYS = new Set(["published_content", "published_revision", "published_at", "auth_user_id"]);

// Belt and braces: every body that goes to Supabase passes through here first.
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

async function supabaseFetch(path, options = {}) {
  if (options.body) assertDraftOnly(JSON.parse(options.body));
  const response = await deps.fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, "Content-Type": "application/json", ...(options.headers || {}) }
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

// Same rule as api/ad-pages.js and api/operational-mutation.js: an active admin
// portal user whose permission is super_admin or office_admin. A trainer login
// is refused.
async function verifyOfficeUser(token) {
  if (!token) return null;
  const r = await deps.fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${token}` } });
  if (!r.ok) return null;
  const user = await r.json();
  if (!user?.id) return null;
  const rows = await supabaseFetch(`/rest/v1/portal_users?select=user_id,role,permission_level,active,access_status,email,display_name,first_name,last_name&user_id=eq.${encodeURIComponent(user.id)}&active=eq.true&limit=1`);
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

// ---------------------------------------------------------------------------
// Practice state: the live row with every practice op laid over it, which is
// exactly what the office is looking at on the sandbox.
// ---------------------------------------------------------------------------
async function liveRows(table, filters) {
  const query = filters.map(([column, value]) => `${encodeURIComponent(column)}=eq.${encodeURIComponent(value)}`).join("&");
  return supabaseFetch(`/rest/v1/${table}?select=*&${query}&limit=1`);
}

function practiceView(ops, collectionKey, liveRow) {
  const payload = { [collectionKey]: liveRow ? [{ ...liveRow }] : [], officeNotes: [] };
  deps.store.applyOps(payload, ops);
  return payload[collectionKey];
}

async function practiceTrainerPage(ops, id, slug) {
  let live = null;
  if (UUID.test(id)) live = (await liveRows("trainer_pages", [["id", id]]))?.[0] || null;
  if (!live && slug) live = (await liveRows("trainer_pages", [["slug", slug]]))?.[0] || null;
  const view = practiceView(ops, "pages", live);
  const page = view.find(row => String(row.id) === String(id)) || (slug ? view.find(row => row.slug === slug) : null) || null;
  return { page, live };
}

async function practiceTrainer(ops, trainerId) {
  let live = null;
  if (UUID.test(String(trainerId || ""))) live = (await liveRows("trainers", [["id", trainerId]]))?.[0] || null;
  const view = practiceView(ops, "trainers", live);
  return { trainer: view.find(row => String(row.id) === String(trainerId)) || null, live };
}

async function practiceAdPage(ops, id, slug) {
  let live = null;
  if (UUID.test(id)) live = (await liveRows("ad_pages", [["id", id]]))?.[0] || null;
  if (!live && slug) live = (await liveRows("ad_pages", [["slug", slug]]))?.[0] || null;
  const view = practiceView(ops, "adPages", live);
  const page = view.find(row => String(row.id) === String(id)) || (slug ? view.find(row => row.slug === slug) : null) || null;
  return { page, live };
}

// ---------------------------------------------------------------------------
// Trainer page → live trainer_pages draft
// ---------------------------------------------------------------------------
async function sendTrainerPage(auth, ops, id, slugHint) {
  const at = deps.now().toISOString();
  const { page, live: livePage } = await practiceTrainerPage(ops, id, slugHint);
  if (!page) throw fail(404, "That trainer page could not be found on the practice copy.");
  const slug = clean(page.slug || slugHint, 120);
  if (!slug) throw fail(400, "The trainer page needs a web address (slug) before it can be sent.");

  // The live target: the row we loaded, else the live row with this slug, else
  // the live page of the trainer this page belongs to.
  let target = livePage;
  if (!target) target = (await liveRows("trainer_pages", [["slug", slug]]))?.[0] || null;

  // The trainer record. If it only exists in the practice layer, create it on
  // live as a plain enrolled trainer: no login, no email, nothing public.
  let liveTrainerId = target?.trainer_id || null;
  let trainerOutcome = "existing";
  if (!liveTrainerId) {
    const { trainer: practiceTrainerRow, live: liveTrainer } = await practiceTrainer(ops, page.trainer_id);
    if (liveTrainer) liveTrainerId = liveTrainer.id;
    else {
      const trainerSlug = clean(practiceTrainerRow?.slug || slug, 120);
      const bySlug = (await liveRows("trainers", [["slug", trainerSlug]]))?.[0] || null;
      if (bySlug) liveTrainerId = bySlug.id;
      else {
        if (!practiceTrainerRow) throw fail(404, "The trainer for this page could not be found on the practice copy.");
        const trainerBody = { ...pick(practiceTrainerRow, TRAINER_FIELDS), slug: trainerSlug, full_name: practiceTrainerRow.full_name || slug, status: "enrolled", access_status: "active" };
        const [created] = await supabaseFetch("/rest/v1/trainers", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(trainerBody) });
        if (!created?.id) throw fail(500, "The live trainer record could not be created.");
        liveTrainerId = created.id;
        trainerOutcome = "created";
      }
    }
    if (!target) target = (await liveRows("trainer_pages", [["trainer_id", liveTrainerId]]))?.[0] || null;
  }

  const draftContent = { ...(page.draft_content && typeof page.draft_content === "object" ? page.draft_content : {}), _sent_from_practice: { by: auth.email, name: auth.name, at } };
  const liveRevision = Number(target?.revision || 0);
  const versionRevision = liveRevision + 1;
  const body = {
    ...pick(page, TRAINER_PAGE_DRAFT_FIELDS),
    slug,
    trainer_id: liveTrainerId,
    draft_content: draftContent,
    revision: liveRevision + 2
  };
  if (!target) { body.page_status = "draft"; body.locked = false; }

  let row;
  if (target) {
    [row] = await supabaseFetch(`/rest/v1/trainer_pages?id=eq.${encodeURIComponent(target.id)}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(body) });
  } else {
    [row] = await supabaseFetch("/rest/v1/trainer_pages", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(body) });
  }
  if (!row?.id) throw fail(500, "The live trainer page draft could not be saved.");

  // trainer_page_versions has no note column, so the note rides inside content.
  await supabaseFetch("/rest/v1/trainer_page_versions?on_conflict=trainer_page_id,revision", {
    method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ trainer_page_id: row.id, revision: versionRevision, content: { ...draftContent, _note: stampNote(auth, at) }, style_settings: row.style_settings || {}, section_order: row.section_order || [] })
  });

  return { live_id: row.id, slug, trainer: trainerOutcome, trainer_id: liveTrainerId, created: !target, at };
}

// ---------------------------------------------------------------------------
// Ad page → live ad_pages draft
// ---------------------------------------------------------------------------
async function sendAdPage(auth, ops, id, slugHint) {
  const at = deps.now().toISOString();
  const { page, live: livePage } = await practiceAdPage(ops, id, slugHint);
  if (!page) throw fail(404, "That ad page could not be found on the practice copy.");
  const content = template.normalizeContent(page.draft_content || {});
  if (!content.slug) throw fail(400, "The ad page needs a web address before it can be sent.");
  if (template.markets.some(market => market.slug === content.slug)) throw fail(409, `/${content.slug} is a page built into the site. Give the ad page another address first.`);

  let target = livePage;
  if (!target) target = (await liveRows("ad_pages", [["slug", content.slug]]))?.[0] || null;

  const updatedBy = `${auth.email} (from practice copy)`;
  const draftRevision = Number(target?.draft_revision || 0) + 1;
  let row;
  if (target) {
    [row] = await supabaseFetch(`/rest/v1/ad_pages?id=eq.${encodeURIComponent(target.id)}`, {
      method: "PATCH", headers: { Prefer: "return=representation" },
      body: JSON.stringify({ slug: content.slug, market: content.market, city: content.city, state: content.state, draft_content: content, draft_revision: draftRevision, updated_by: updatedBy })
    });
  } else {
    [row] = await supabaseFetch("/rest/v1/ad_pages", {
      method: "POST", headers: { Prefer: "return=representation" },
      body: JSON.stringify({ slug: content.slug, market: content.market, city: content.city, state: content.state, status: "draft", draft_content: content, draft_revision: draftRevision, created_by: updatedBy, updated_by: updatedBy })
    });
  }
  if (!row?.id) throw fail(500, "The live ad page draft could not be saved.");
  await supabaseFetch("/rest/v1/ad_page_revisions", {
    method: "POST", headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ page_id: row.id, revision: draftRevision, kind: "draft", content, created_by: stampNote(auth, at) })
  });
  return { live_id: row.id, slug: content.slug, created: !target, at };
}

// ---------------------------------------------------------------------------
module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  // Outside the sandbox this endpoint does not exist. Checked before auth so a
  // live deployment gives away nothing.
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

    const ops = await deps.store.readOps();
    const result = kind === "trainer_page" ? await sendTrainerPage(auth, ops, id, slugHint) : await sendAdPage(auth, ops, id, slugHint);

    await deps.store.appendOp({ operation: "send_to_live", entity_type: kind, id: id || result.live_id, slug: result.slug, live_id: result.live_id, actor: auth.email });

    const where = kind === "trainer_page" ? "Trainer Network" : "Page Studio";
    return res.status(200).json({
      ok: true, sandbox: true, kind, ...result, sent_at: result.at,
      message: `Sent to live as a draft. Open the live portal → ${where} to publish it.`
    });
  } catch (error) {
    const status = error.status && error.status >= 400 && error.status < 600 ? error.status : 500;
    return res.status(status).json({ ok: false, message: error.message || "Send to live could not complete.", detail: error.detail || null });
  }
};
module.exports.deps = deps;
module.exports.assertDraftOnly = assertDraftOnly;
