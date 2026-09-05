// Page Studio — staff API for ad landing pages (list, get, create, save draft,
// publish, restore, unpublish, archive, preview).
//
// Office only. Every write goes through normalizeContent() from the shared
// template, so only the fields the page renders are ever stored, and publish
// re-runs the same checklist the browser showed, so nothing incomplete can go
// live. Every publish writes an ad_page_revisions row.
//
// Practice copy (LDTT_SANDBOX=1): identical behaviour against the `practice`
// schema (lib/sandbox.js supabaseRequest()), so the office can build, publish
// and open /ads/<slug> there without a single live row changing. Send to live
// (api/send-to-live.js) copies a practice page to live as a draft.

const { isSandbox, supabaseRequest } = require("../lib/sandbox");
const template = require("../lib/ad-page-template.js");
const imageAspects = require("../lib/ad-page-image-aspects.js");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://ptnzaeprvkgjgtupmcty.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";
const PAGE_COLUMNS = "id,slug,market,city,state,status,draft_revision,published_revision,published_at,created_by,updated_by,created_at,updated_at";

// Swappable for local proof runs (see scripts/page-studio-local.mjs); production
// never touches this.
const deps = { fetch: (...args) => fetch(...args) };

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  return res;
}
const clean = (v, max = 200) => String(v ?? "").trim().slice(0, max);
const fail = (status, message) => Object.assign(new Error(message), { status });

async function supabaseFetch(path, options = {}) {
  // Practice copy: schema profile headers / practice-* bucket (lib/sandbox.js).
  const target = supabaseRequest(path, options.headers || {});
  const response = await deps.fetch(`${SUPABASE_URL}${target.path}`, {
    ...options,
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, "Content-Type": "application/json", ...target.headers }
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { message: text.slice(0, 200) }; }
  if (!response.ok) {
    const message = /relation "(public|practice)\.ad_pages" does not exist|Could not find the table '(public|practice)\.ad_pages'/i.test(text)
      ? "The ad_pages table is not in the database yet. Apply supabase/migrations/20260905120000_ad_pages.sql, then try again."
      : data?.message || `Supabase ${response.status}`;
    throw Object.assign(new Error(message), { status: response.status === 404 ? 503 : response.status, detail: data });
  }
  return data;
}

// Office staff only: admin role with super_admin or office_admin permission.
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
  const actor = [pu.first_name, pu.last_name].filter(Boolean).join(" ") || pu.display_name || pu.email || user.email || "office";
  return { user, portalUser: pu, actor, isSuperAdmin: String(pu.permission_level || "super_admin") === "super_admin" };
}

const imageAspect = path => imageAspects[path] || null;
const renderOptions = slug => ({ base: "/", publicPath: `/ads/${slug}`, imageAspect });

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------
// Practice copy: "Sent to live ✓ at <time>" comes from practice.send_to_live_log.
async function sentToLiveStamps() {
  if (!isSandbox()) return new Map();
  const rows = await supabaseFetch("/rest/v1/send_to_live_log?select=entity_id,slug,sent_at,sent_by&entity_type=eq.ad_page&order=sent_at.desc&limit=500").catch(() => []);
  const stamps = new Map();
  (rows || []).forEach(row => {
    [row.entity_id, row.slug].filter(Boolean).forEach(key => { if (!stamps.has(key)) stamps.set(key, row); });
  });
  return stamps;
}
function stampRow(row, stamps) {
  const hit = stamps.get(String(row.id)) || stamps.get(String(row.slug));
  return hit ? { ...row, sent_to_live_at: hit.sent_at, sent_to_live_by: hit.sent_by || null } : row;
}

async function listPages() {
  const [rows, stamps] = await Promise.all([
    supabaseFetch(`/rest/v1/ad_pages?select=${PAGE_COLUMNS}&status=neq.archived&order=updated_at.desc`),
    sentToLiveStamps()
  ]);
  return rows.map(row => {
    const { draft_content, published_content, ...summary } = stampRow(row, stamps);
    return summary;
  });
}

async function loadPage(id) {
  const rows = await supabaseFetch(`/rest/v1/ad_pages?select=*&id=eq.${encodeURIComponent(id)}&limit=1`);
  if (!rows?.[0]) throw fail(404, "That page no longer exists.");
  const [revisions, stamps] = await Promise.all([loadRevisions(id), sentToLiveStamps()]);
  return { page: stampRow(rows[0], stamps), revisions };
}

async function loadRevisions(pageId) {
  return supabaseFetch(`/rest/v1/ad_page_revisions?select=id,revision,kind,created_by,created_at&page_id=eq.${encodeURIComponent(pageId)}&order=created_at.desc&limit=60`);
}

async function slugTaken(slug, exceptId) {
  const pages = await listPages();
  if (pages.some(page => page.slug === slug && String(page.id) !== String(exceptId))) return true;
  // Static market pages own their slugs; a database page must not shadow one
  // (the static file would win anyway, which would confuse everyone).
  return template.markets.some(market => market.slug === slug);
}

function stamp() { return new Date().toISOString(); }

async function createPage(content, auth) {
  const clone = template.normalizeContent(content);
  if (!clone.slug) throw fail(400, "Give the page a web address, like dog-training-toledo-oh.");
  if (await slugTaken(clone.slug)) throw fail(409, `The address /${clone.slug} is already used. Pick another.`);
  const [row] = await supabaseFetch("/rest/v1/ad_pages", {
    method: "POST", headers: { Prefer: "return=representation" },
    body: JSON.stringify({ slug: clone.slug, market: clone.market, city: clone.city, state: clone.state, status: "draft", draft_content: clone, created_by: auth.actor, updated_by: auth.actor })
  });
  return row;
}

async function updatePage(id, changes, auth, revision) {
  const [row] = await supabaseFetch(`/rest/v1/ad_pages?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH", headers: { Prefer: "return=representation" },
    body: JSON.stringify({ ...changes, updated_by: auth.actor })
  });
  if (!row) throw fail(404, "That page no longer exists.");
  if (revision) {
    await supabaseFetch("/rest/v1/ad_page_revisions", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ page_id: id, created_by: auth.actor, ...revision }) });
  }
  return row;
}

async function loadRevisionContent(pageId, revisionId) {
  const rows = await supabaseFetch(`/rest/v1/ad_page_revisions?select=content&id=eq.${encodeURIComponent(revisionId)}&page_id=eq.${encodeURIComponent(pageId)}&limit=1`);
  if (!rows?.[0]) throw fail(404, "That version could not be found.");
  return rows[0].content;
}

// ---------------------------------------------------------------------------
module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (!["GET", "POST"].includes(req.method)) return res.status(405).json({ ok: false, message: "Method not allowed" });
  if (!SERVICE_ROLE_KEY) return res.status(500).json({ ok: false, message: "Supabase service role key is not configured." });

  try {
    const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    const auth = await verifyOfficeUser(token);
    if (!auth) return res.status(403).json({ ok: false, message: "Page Studio is for office staff. Sign in with an office or admin account." });

    const body = req.method === "GET" ? { operation: clean(req.query?.operation || "list", 40) } : (typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {});
    const operation = clean(body.operation, 40) || "list";
    const id = clean(body.id, 80);

    switch (operation) {
      case "list": {
        const pages = await listPages();
        return res.status(200).json({ ok: true, sandbox: isSandbox(), pages, markets: template.markets.map(m => ({ slug: m.slug, market: m.market, city: m.city, state: m.state, arch: m.arch })) });
      }
      case "get": {
        if (!id) throw fail(400, "Which page?");
        const { page, revisions } = await loadPage(id);
        return res.status(200).json({ ok: true, sandbox: isSandbox(), page, revisions });
      }
      case "preview": {
        // Staff-only draft preview; nothing is stored.
        const content = template.normalizeContent(body.content);
        const html = template.renderAdPage(content, renderOptions(content.slug || "preview"));
        return res.status(200).json({ ok: true, html, checklist: template.publishChecklist(content, { html }) });
      }
      case "create": {
        // New pages from the generator or "duplicate" both arrive here with a
        // full content object; the server never trusts anything but the fields
        // the template knows.
        const row = await createPage(body.content, auth);
        return res.status(200).json({ ok: true, sandbox: isSandbox(), page: row, message: isSandbox() ? "Page created on the practice copy." : "Page created." });
      }
      case "save_draft": {
        if (!id) throw fail(400, "Which page?");
        const content = template.normalizeContent(body.content);
        const { page } = await loadPage(id);
        if (content.slug !== page.slug && await slugTaken(content.slug, id)) throw fail(409, `The address /${content.slug} is already used. Pick another.`);
        const row = await updatePage(id, { slug: content.slug, market: content.market, city: content.city, state: content.state, draft_content: content, draft_revision: Number(page.draft_revision || 0) + 1 }, auth,
          body.snapshot === true ? { revision: Number(page.draft_revision || 0) + 1, kind: "draft", content } : null);
        return res.status(200).json({ ok: true, sandbox: isSandbox(), page: { ...row, draft_content: undefined, published_content: undefined }, saved_at: row.updated_at, draft_revision: row.draft_revision });
      }
      case "publish": {
        if (!id) throw fail(400, "Which page?");
        const { page } = await loadPage(id);
        const content = template.normalizeContent(body.content || page.draft_content);
        const checklist = template.publishChecklist(content, renderOptions(content.slug));
        if (!checklist.ok) return res.status(400).json({ ok: false, checklist, message: `Not published. ${checklist.failures.length} thing${checklist.failures.length === 1 ? "" : "s"} to fix first: ${checklist.failures.map(f => f.fix).join(" ")}` });
        if (content.slug !== page.slug && await slugTaken(content.slug, id)) throw fail(409, `The address /${content.slug} is already used. Pick another.`);
        const revision = Number(page.published_revision || 0) + 1;
        const row = await updatePage(id, { slug: content.slug, market: content.market, city: content.city, state: content.state, draft_content: content, draft_revision: Number(page.draft_revision || 0) + 1, published_content: content, published_revision: revision, status: "published", published_at: stamp() }, auth,
          { revision, kind: "published", content });
        return res.status(200).json({ ok: true, sandbox: isSandbox(), page: { ...row, draft_content: undefined, published_content: undefined }, url: `/ads/${content.slug}`, revision, checklist, message: isSandbox() ? `Published on the practice copy. Open /ads/${content.slug} here to see it. Use Send to live when it is ready for the real site.` : `Published. Live at /ads/${content.slug}.` });
      }
      case "restore": {
        if (!id) throw fail(400, "Which page?");
        const revisionId = clean(body.revision_id, 80);
        if (!revisionId) throw fail(400, "Which version?");
        const { page } = await loadPage(id);
        const content = template.normalizeContent(await loadRevisionContent(id, revisionId));
        const row = await updatePage(id, { draft_content: content, draft_revision: Number(page.draft_revision || 0) + 1 }, auth, null);
        return res.status(200).json({ ok: true, sandbox: isSandbox(), content, draft_revision: row.draft_revision, message: "That version is back in the draft. Publish when you are happy with it." });
      }
      case "unpublish": {
        if (!id) throw fail(400, "Which page?");
        await updatePage(id, { status: "draft", published_content: null }, auth, null);
        return res.status(200).json({ ok: true, message: "The page is offline. The draft is kept." });
      }
      case "archive": {
        if (!id) throw fail(400, "Which page?");
        if (!auth.isSuperAdmin) throw fail(403, "Only a Super Admin can remove a page.");
        await updatePage(id, { status: "archived", published_content: null }, auth, null);
        return res.status(200).json({ ok: true, sandbox: isSandbox(), message: "Page removed. It is off the site and out of the list." });
      }
      default:
        throw fail(400, `Unknown operation "${operation}".`);
    }
  } catch (error) {
    const status = error.status && error.status >= 400 && error.status < 600 ? error.status : 500;
    return res.status(status).json({ ok: false, message: error.message || "Page Studio could not complete that.", detail: error.detail || null });
  }
};
module.exports.deps = deps;
module.exports.verifyOfficeUser = verifyOfficeUser;
