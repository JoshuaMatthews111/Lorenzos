// Page Studio — staff API for ad landing pages (list, get, create, save draft,
// publish, restore, unpublish, archive, preview).
//
// Office only. Every write goes through normalizeContent() from the shared
// template, so only the fields the page renders are ever stored, and publish
// re-runs the same checklist the browser showed, so nothing incomplete can go
// live. Every publish writes an ad_page_revisions row.
//
// Sandbox (DO-NOT-BREAK #5): publish is blocked with 423. Drafts, new pages,
// restores and archives go into the shared practice layer instead of the
// table, so the office can try Page Studio on the sandbox and every tester
// sees the same practice pages.

const crypto = require("crypto");
const { isSandbox, blockedInSandbox } = require("../lib/sandbox");
const sandboxStore = require("../lib/sandbox-store");
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
  const response = await deps.fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, "Content-Type": "application/json", ...(options.headers || {}) }
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { message: text.slice(0, 200) }; }
  if (!response.ok) {
    const message = /relation "public\.ad_pages" does not exist|Could not find the table 'public\.ad_pages'/i.test(text)
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
// Storage: live table, or the practice layer on the sandbox.
// ---------------------------------------------------------------------------
async function practiceOps() {
  return (await sandboxStore.readOps()).filter(op => op.entity_type === "ad_page");
}
function overlay(rows, ops) {
  const list = rows.map(row => ({ ...row }));
  ops.forEach(op => {
    if (op.operation === "create" && op.record) list.unshift({ ...op.record });
    if (op.operation === "update") {
      const row = list.find(item => String(item.id) === String(op.id));
      if (row) Object.assign(row, op.changes || {});
    }
    if (op.operation === "send_to_live") {
      // send-to-live: the card and the editor show when this page last went to live.
      const row = list.find(item => String(item.id) === String(op.id) || (op.slug && item.slug === op.slug));
      if (row) { row.sent_to_live_at = op.at; row.sent_to_live_by = op.actor || null; }
    }
  });
  return list;
}

async function listPages() {
  const rows = await supabaseFetch(`/rest/v1/ad_pages?select=${PAGE_COLUMNS}&status=neq.archived&order=updated_at.desc`).catch(error => {
    if (isSandbox() && error.status === 503) return [];
    throw error;
  });
  const pages = isSandbox() ? overlay(rows, await practiceOps()) : rows;
  return pages.filter(row => row.status !== "archived").map(row => {
    const { draft_content, published_content, _revisions, ...summary } = row;
    return summary;
  });
}

async function loadPage(id) {
  if (isSandbox()) {
    const ops = await practiceOps();
    const live = /^sbx-/.test(id) ? [] : await supabaseFetch(`/rest/v1/ad_pages?select=*&id=eq.${encodeURIComponent(id)}&limit=1`).catch(() => []);
    const row = overlay(live, ops).find(item => String(item.id) === String(id));
    if (!row) throw fail(404, "That page no longer exists.");
    const revisions = Array.isArray(row._revisions) ? row._revisions : (/^sbx-/.test(id) ? [] : await loadRevisions(id));
    return { page: row, revisions };
  }
  const rows = await supabaseFetch(`/rest/v1/ad_pages?select=*&id=eq.${encodeURIComponent(id)}&limit=1`);
  if (!rows?.[0]) throw fail(404, "That page no longer exists.");
  return { page: rows[0], revisions: await loadRevisions(id) };
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
  const now = stamp();
  if (isSandbox()) {
    const record = { id: `sbx-${crypto.randomUUID()}`, slug: clone.slug, market: clone.market, city: clone.city, state: clone.state, status: "draft", draft_content: clone, published_content: null, draft_revision: 1, published_revision: 0, published_at: null, created_by: auth.actor, updated_by: auth.actor, created_at: now, updated_at: now, _revisions: [] };
    await sandboxStore.appendOp({ operation: "create", entity_type: "ad_page", record, actor: auth.actor });
    return record;
  }
  const [row] = await supabaseFetch("/rest/v1/ad_pages", {
    method: "POST", headers: { Prefer: "return=representation" },
    body: JSON.stringify({ slug: clone.slug, market: clone.market, city: clone.city, state: clone.state, status: "draft", draft_content: clone, created_by: auth.actor, updated_by: auth.actor })
  });
  return row;
}

async function updatePage(id, changes, auth, revision) {
  const now = stamp();
  if (isSandbox()) {
    const { page } = await loadPage(id);
    const next = { ...changes, updated_by: auth.actor, updated_at: now };
    if (revision) next._revisions = [{ id: `sbx-${crypto.randomUUID()}`, created_at: now, created_by: auth.actor, ...revision }, ...(page._revisions || [])].slice(0, 60);
    await sandboxStore.appendOp({ operation: "update", entity_type: "ad_page", id, changes: next, actor: auth.actor });
    return { ...page, ...next };
  }
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
  if (isSandbox()) {
    const { page } = await loadPage(pageId);
    const hit = (page._revisions || []).find(item => String(item.id) === String(revisionId));
    if (!hit) throw fail(404, "That version could not be found.");
    return hit.content;
  }
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
        return res.status(200).json({ ok: true, sandbox: isSandbox(), page: row, message: isSandbox() ? "Practice page created on the sandbox." : "Page created." });
      }
      case "save_draft": {
        if (!id) throw fail(400, "Which page?");
        const content = template.normalizeContent(body.content);
        const { page } = await loadPage(id);
        if (content.slug !== page.slug && await slugTaken(content.slug, id)) throw fail(409, `The address /${content.slug} is already used. Pick another.`);
        const row = await updatePage(id, { slug: content.slug, market: content.market, city: content.city, state: content.state, draft_content: content, draft_revision: Number(page.draft_revision || 0) + 1 }, auth,
          body.snapshot === true ? { revision: Number(page.draft_revision || 0) + 1, kind: "draft", content } : null);
        return res.status(200).json({ ok: true, sandbox: isSandbox(), page: { ...row, draft_content: undefined, published_content: undefined, _revisions: undefined }, saved_at: row.updated_at, draft_revision: row.draft_revision });
      }
      case "publish": {
        if (blockedInSandbox(res, "Publishing an ad page")) return;
        if (!id) throw fail(400, "Which page?");
        const { page } = await loadPage(id);
        const content = template.normalizeContent(body.content || page.draft_content);
        const checklist = template.publishChecklist(content, renderOptions(content.slug));
        if (!checklist.ok) return res.status(400).json({ ok: false, checklist, message: `Not published. ${checklist.failures.length} thing${checklist.failures.length === 1 ? "" : "s"} to fix first: ${checklist.failures.map(f => f.fix).join(" ")}` });
        if (content.slug !== page.slug && await slugTaken(content.slug, id)) throw fail(409, `The address /${content.slug} is already used. Pick another.`);
        const revision = Number(page.published_revision || 0) + 1;
        const row = await updatePage(id, { slug: content.slug, market: content.market, city: content.city, state: content.state, draft_content: content, draft_revision: Number(page.draft_revision || 0) + 1, published_content: content, published_revision: revision, status: "published", published_at: stamp() }, auth,
          { revision, kind: "published", content });
        return res.status(200).json({ ok: true, page: { ...row, draft_content: undefined, published_content: undefined }, url: `/ads/${content.slug}`, revision, checklist, message: `Published. Live at /ads/${content.slug}.` });
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
        if (blockedInSandbox(res, "Taking an ad page offline")) return;
        if (!id) throw fail(400, "Which page?");
        await updatePage(id, { status: "draft", published_content: null }, auth, null);
        return res.status(200).json({ ok: true, message: "The page is offline. The draft is kept." });
      }
      case "archive": {
        if (!id) throw fail(400, "Which page?");
        if (!isSandbox() && !auth.isSuperAdmin) throw fail(403, "Only a Super Admin can remove a page.");
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
