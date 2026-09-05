// Site Builder / Page Studio — staff API for EVERY page type.
//
//   ad       paid-ad landing pages (lib/ad-page-template.js) — the original Page Studio
//   site     company pages: About, Services, Contact, Facility, anything (blocks)
//   landing  block-built landing pages with a slim header (market, recruiting, offers)
//
// Operations (POST {operation}): list, get, preview, create, save_draft, publish,
// restore, unpublish, archive, theme_get, theme_save, nav_get, nav_save, data,
// upload, import_static, starters. GET ?operation=list works too.
//
// Office only. Every write goes through the template's normaliser (ad pages:
// normalizeContent, block pages: normalizeSitePage with the rich-text sanitiser),
// so only fields the page renders are stored; publish re-runs the same checklist
// the browser showed. Every publish writes an ad_page_revisions row.
//
// One table for every type: ad_pages + page_type (migration
// supabase/migrations/20260905230000_site_builder.sql). Site-wide settings
// (theme, navigation) live in site_settings (key → value jsonb).
//
// Practice copy (LDTT_SANDBOX=1): identical behaviour against the `practice`
// schema through lib/sandbox.js supabaseRequest(); uploads land in
// practice-trainer-page-assets. Send to live copies a page to live as a draft.
// api/ad-pages.js is an alias of this file so the old route keeps working.

const { isSandbox, supabaseRequest, bucketName } = require("../lib/sandbox");
const template = require("../lib/ad-page-template.js");
const site = require("../lib/site-page-template.js");
const importer = require("../lib/static-page-importer.js");
const siteData = require("../lib/site-data.js");
const imageAspects = require("../lib/ad-page-image-aspects.js");
const durability = require("../lib/page-durability.js"); // durability: publish verification + "where this page lives"

const SUPABASE_URL = process.env.SUPABASE_URL || "https://ptnzaeprvkgjgtupmcty.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";
const PAGE_COLUMNS = "id,slug,page_type,title,market,city,state,status,draft_revision,published_revision,published_at,created_by,updated_by,created_at,updated_at";
const PAGE_TYPES = new Set(["ad", "site", "landing"]);
const UPLOAD_TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/svg+xml": "svg", "image/x-icon": "ico", "video/mp4": "mp4" };
const UPLOAD_MAX = 4 * 1024 * 1024; // Vercel's request body limit is 4.5 MB

// Swappable for local proof runs (see scripts/page-studio-local.mjs); production
// never touches this.
const deps = { fetch: (...args) => fetch(...args) };
siteData.deps.fetch = (...args) => deps.fetch(...args);

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  return res;
}
const clean = (v, max = 200) => String(v ?? "").trim().slice(0, max);
const fail = (status, message) => Object.assign(new Error(message), { status });
const stamp = () => new Date().toISOString();

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
    const message = /relation "(public|practice)\.(ad_pages|site_settings)" does not exist|Could not find the table '(public|practice)\.(ad_pages|site_settings)'|column ad_pages\.page_type does not exist|Could not find the '?page_type'? column/i.test(text)
      ? "The Site Builder tables are not in the database yet. Apply supabase/migrations/20260905120000_ad_pages.sql and 20260905230000_site_builder.sql, then try again."
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
const adRenderOptions = slug => ({ base: "/", publicPath: `/ads/${slug}`, imageAspect });
const pageTypeOf = row => (PAGE_TYPES.has(row?.page_type) ? row.page_type : "ad");
const publicPathFor = (type, slug) => (type === "ad" ? `/ads/${slug}` : `/${slug}`);

// ---------------------------------------------------------------------------
// Site settings (theme + navigation)
// ---------------------------------------------------------------------------
async function getSetting(key) {
  const rows = await supabaseFetch(`/rest/v1/site_settings?select=key,value,updated_by,updated_at&key=eq.${encodeURIComponent(key)}&limit=1`);
  return rows?.[0] || null;
}
async function saveSetting(key, value, auth) {
  const [row] = await supabaseFetch("/rest/v1/site_settings?on_conflict=key", {
    method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({ key, value, updated_by: auth.actor, updated_at: stamp() })
  });
  return row;
}
async function siteTheme() { const row = await getSetting("theme").catch(() => null); return site.normalizeTheme(row?.value || {}); }
async function siteNav() { const row = await getSetting("navigation").catch(() => null); return site.normalizeNav(row?.value || {}); }

// Render any page type through its template. Site pages get the live theme,
// navigation and the data blocks pull in.
async function renderAny(type, content, slug, { editor = false, data = null } = {}) {
  if (type === "ad") return template.renderAdPage(content, { ...adRenderOptions(slug), editor });
  const [theme, nav] = await Promise.all([siteTheme(), siteNav()]);
  return site.renderSitePage(content, { base: "/", publicPath: `/${slug}`, editor, siteTheme: theme, navigation: nav, data: data || await loadData(content) });
}
async function loadData(content) {
  const wantReviews = (content.blocks || []).some(b => b.type === "testimonials" && b.source === "approved");
  const wantTrainers = (content.blocks || []).some(b => b.type === "trainers");
  const [reviews, trainers] = await Promise.all([wantReviews ? siteData.loadReviews() : [], wantTrainers ? siteData.loadTrainers() : []]);
  return { reviews, trainers };
}
function normalizeFor(type, content) { return type === "ad" ? template.normalizeContent(content) : site.normalizeSitePage({ ...(content || {}), pageType: type }); }
async function checklistFor(type, content, slug) {
  if (type === "ad") return template.publishChecklist(content, adRenderOptions(slug));
  const html = await renderAny(type, content, slug);
  return site.sitePublishChecklist(content, { html });
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------
// Practice copy: "Sent to live ✓ at <time>" comes from practice.send_to_live_log.
async function sentToLiveStamps() {
  if (!isSandbox()) return new Map();
  const rows = await supabaseFetch("/rest/v1/send_to_live_log?select=entity_id,slug,sent_at,sent_by,sent_by_name&entity_type=eq.ad_page&order=sent_at.desc&limit=500").catch(() => []);
  const stamps = new Map();
  (rows || []).forEach(row => { [row.entity_id, row.slug].filter(Boolean).forEach(key => { if (!stamps.has(key)) stamps.set(key, row); }); });
  return stamps;
}
function stampRow(row, stamps) {
  const hit = stamps.get(String(row.id)) || stamps.get(String(row.slug));
  return hit ? { ...row, sent_to_live_at: hit.sent_at, sent_to_live_by: hit.sent_by || null, sent_to_live_by_name: hit.sent_by_name || null } : row;
}

async function listPages() {
  const [rows, stamps] = await Promise.all([
    supabaseFetch(`/rest/v1/ad_pages?select=${PAGE_COLUMNS}&status=neq.archived&order=updated_at.desc`),
    sentToLiveStamps()
  ]);
  return rows.map(row => {
    const { draft_content, published_content, ...summary } = stampRow(row, stamps);
    return { ...summary, page_type: pageTypeOf(summary), public_path: publicPathFor(pageTypeOf(summary), summary.slug) };
  });
}

async function loadPage(id) {
  const rows = await supabaseFetch(`/rest/v1/ad_pages?select=*&id=eq.${encodeURIComponent(id)}&limit=1`);
  if (!rows?.[0]) throw fail(404, "That page no longer exists.");
  const [revisions, stamps] = await Promise.all([loadRevisions(id), sentToLiveStamps()]);
  const page = stampRow(rows[0], stamps);
  return { page: { ...page, page_type: pageTypeOf(page), public_path: publicPathFor(pageTypeOf(page), page.slug) }, revisions };
}

async function loadRevisions(pageId) {
  return supabaseFetch(`/rest/v1/ad_page_revisions?select=id,revision,kind,created_by,created_at&page_id=eq.${encodeURIComponent(pageId)}&order=created_at.desc&limit=60`);
}

async function slugTaken(slug, exceptId, type) {
  const pages = await listPages();
  if (pages.some(page => page.slug === slug && String(page.id) !== String(exceptId))) return true;
  // Static market pages own their /ads-style slugs; an ad page must not shadow one.
  if (type === "ad") return template.markets.some(market => market.slug === slug);
  // Site pages may take over a static page on purpose (about, contact …) but never a reserved path.
  return site.RESERVED_SLUGS.has(slug);
}

async function createPage(type, content, auth) {
  const clone = normalizeFor(type, content);
  if (!clone.slug) throw fail(400, type === "ad" ? "Give the page a web address, like dog-training-toledo-oh." : "Give the page a web address, like services.");
  if (await slugTaken(clone.slug, null, type)) throw fail(409, `The address /${clone.slug} is already used. Pick another.`);
  const [row] = await supabaseFetch("/rest/v1/ad_pages", {
    method: "POST", headers: { Prefer: "return=representation" },
    body: JSON.stringify({ slug: clone.slug, page_type: type, title: clone.title || "", market: clone.market || "", city: clone.city || "", state: clone.state || "", status: "draft", draft_content: clone, created_by: auth.actor, updated_by: auth.actor })
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

// durability (1): a publish that did not land is put back exactly as it was —
// the previous published copy, revision, time, status and address — and the
// revision row this attempt wrote is removed, so History shows only real versions.
async function rollbackPublish(id, previous, revision, auth) {
  try {
    await supabaseFetch(`/rest/v1/ad_pages?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ ...previous, updated_by: auth.actor }) });
  } catch (error) { console.error("publish rollback: page restore failed", error); }
  try {
    await supabaseFetch(`/rest/v1/ad_page_revisions?page_id=eq.${encodeURIComponent(id)}&revision=eq.${encodeURIComponent(revision)}&kind=eq.published`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
  } catch (error) { console.error("publish rollback: revision cleanup failed", error); }
}

async function loadRevisionContent(pageId, revisionId) {
  const rows = await supabaseFetch(`/rest/v1/ad_page_revisions?select=content&id=eq.${encodeURIComponent(revisionId)}&page_id=eq.${encodeURIComponent(pageId)}&limit=1`);
  if (!rows?.[0]) throw fail(404, "That version could not be found.");
  return rows[0].content;
}

// Logo / photo uploads: base64 body → the trainer-page-assets bucket under
// site/ (practice-trainer-page-assets on the practice copy, via bucketName()).
async function uploadAsset(body, auth) {
  const type = clean(body.type, 60);
  const ext = UPLOAD_TYPES[type];
  if (!ext) throw fail(400, "Upload a JPG, PNG, WEBP, GIF, SVG, ICO or MP4 file.");
  const bytes = Buffer.from(String(body.data || "").replace(/^data:[^;]+;base64,/, ""), "base64");
  if (!bytes.length) throw fail(400, "The file was empty.");
  if (bytes.length > UPLOAD_MAX) throw fail(413, "That file is bigger than 4 MB. Make it smaller and try again.");
  const name = clean(body.name, 80).toLowerCase().replace(/\.[a-z0-9]+$/, "").replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "file";
  const key = `site/${Date.now().toString(36)}-${name}.${ext}`;
  const target = supabaseRequest(`/storage/v1/object/trainer-page-assets/${key}`);
  const response = await deps.fetch(`${SUPABASE_URL}${target.path}`, { method: "POST", headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, "Content-Type": type, "x-upsert": "false", ...target.headers }, body: bytes });
  if (!response.ok) throw fail(502, `The upload failed (${response.status}). Try again.`);
  return { url: `${SUPABASE_URL}/storage/v1/object/public/${bucketName("trainer-page-assets")}/${key}`, key, by: auth.actor };
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
    const sandbox = isSandbox();

    switch (operation) {
      case "list": {
        const pages = await listPages();
        const taken = new Set(pages.map(p => p.slug));
        return res.status(200).json({ ok: true, sandbox, pages, markets: template.markets.map(m => ({ slug: m.slug, market: m.market, city: m.city, state: m.state, arch: m.arch })), starters: site.STARTERS, importable: importer.IMPORTABLE.map(p => ({ ...p, imported: taken.has(p.slug) })) });
      }
      case "get": {
        if (!id) throw fail(400, "Which page?");
        const { page, revisions } = await loadPage(id);
        return res.status(200).json({ ok: true, sandbox, page, revisions });
      }
      case "data": {
        // Live data for the canvas: approved reviews + published trainers.
        const [reviews, trainers, theme, nav] = await Promise.all([siteData.loadReviews(clean(body.destination_id, 120) || "lorenzos-team"), siteData.loadTrainers(), siteTheme(), siteNav()]);
        return res.status(200).json({ ok: true, reviews, trainers, theme, navigation: nav, effectiveNavigation: site.effectiveNav(nav) });
      }
      case "preview": {
        // Staff-only draft preview; nothing is stored.
        const type = PAGE_TYPES.has(body.page_type) ? body.page_type : "ad";
        const content = normalizeFor(type, body.content);
        const html = await renderAny(type, content, content.slug || "preview");
        const checklist = type === "ad" ? template.publishChecklist(content, { html }) : site.sitePublishChecklist(content, { html });
        return res.status(200).json({ ok: true, html, checklist });
      }
      case "starters":
        return res.status(200).json({ ok: true, starters: site.STARTERS, importable: importer.IMPORTABLE, blocks: site.BLOCK_TYPES });
      case "import_static": {
        // Converts a static site page into blocks and creates the draft (never touches the file).
        const slug = site.safeSlug(body.slug);
        const result = importer.importStaticPage(slug);
        const existing = (await listPages()).find(p => p.slug === slug);
        if (existing) throw fail(409, `/${slug} is already in the Site Builder. Open it from the Pages list, or remove it first.`);
        const row = await createPage(result.content.pageType, result.content, auth);
        return res.status(200).json({ ok: true, sandbox, page: row, words: result.words, imported_words: result.importedWords, message: `${slug}.html imported as a draft (${result.content.blocks.length} blocks). The static page stays live until you publish this one.` });
      }
      case "create": {
        // New pages from a starter, the ad generator or "duplicate" all arrive
        // here with a full content object; the server never trusts anything
        // but the fields the template knows.
        const type = PAGE_TYPES.has(body.page_type) ? body.page_type : (body.content?.blocks ? (body.content.pageType === "landing" ? "landing" : "site") : "ad");
        const row = await createPage(type, body.content, auth);
        return res.status(200).json({ ok: true, sandbox, page: { ...row, public_path: publicPathFor(type, row.slug) }, message: sandbox ? "Page created on the practice copy." : "Page created." });
      }
      case "save_draft": {
        if (!id) throw fail(400, "Which page?");
        const { page } = await loadPage(id);
        const type = page.page_type;
        const content = normalizeFor(type, body.content);
        if (content.slug !== page.slug && await slugTaken(content.slug, id, type)) throw fail(409, `The address /${content.slug} is already used. Pick another.`);
        const row = await updatePage(id, { slug: content.slug, title: content.title || "", market: content.market || "", city: content.city || "", state: content.state || "", draft_content: content, draft_revision: Number(page.draft_revision || 0) + 1 }, auth,
          body.snapshot === true ? { revision: Number(page.draft_revision || 0) + 1, kind: "draft", content } : null);
        return res.status(200).json({ ok: true, sandbox, page: { ...row, draft_content: undefined, published_content: undefined, page_type: type, public_path: publicPathFor(type, row.slug) }, saved_at: row.updated_at, draft_revision: row.draft_revision });
      }
      case "publish": {
        if (!id) throw fail(400, "Which page?");
        const { page } = await loadPage(id);
        const type = page.page_type;
        const content = normalizeFor(type, body.content || page.draft_content);
        const checklist = await checklistFor(type, content, content.slug);
        if (!checklist.ok) return res.status(400).json({ ok: false, checklist, message: `Not published. ${checklist.failures.length} thing${checklist.failures.length === 1 ? "" : "s"} to fix first: ${checklist.failures.map(f => f.fix).join(" ")}` });
        if (content.slug !== page.slug && await slugTaken(content.slug, id, type)) throw fail(409, `The address /${content.slug} is already used. Pick another.`);
        // durability (1): every photo must really be in THIS deployment's bucket
        // and answer 200 before anything is written. Practice-bucket, signed and
        // inline photos are copied to pages/<slug>/… and the URL rewritten.
        const media = await durability.prepareMedia(content, { slug: content.slug, fetchImpl: deps.fetch, serviceKey: SERVICE_ROLE_KEY });
        if (media.failure) return res.status(400).json({ ok: false, checklist, verification: { failed: media.failure }, message: `Not published — ${media.failure.message} Nothing changed on the site.` });
        const revision = Number(page.published_revision || 0) + 1;
        // What to put back if the publish does not land (durability (1) rollback).
        const previous = { slug: page.slug, title: page.title || "", status: page.status, published_content: page.published_content ?? null, published_revision: Number(page.published_revision || 0), published_at: page.published_at || null };
        const row = await updatePage(id, { slug: content.slug, title: content.title || "", market: content.market || "", city: content.city || "", state: content.state || "", draft_content: content, draft_revision: Number(page.draft_revision || 0) + 1, published_content: content, published_revision: revision, status: "published", published_at: stamp() }, auth,
          { revision, kind: "published", content });
        // durability (1): read back, serve through the real route, manifest, sitemap.
        const verification = await durability.verifyPublished({ slug: content.slug, type, revision, supabaseFetch });
        if (!verification.ok) {
          await rollbackPublish(id, previous, revision, auth);
          const failed = verification.failed || { name: "Verification", detail: "" };
          return res.status(400).json({ ok: false, checklist, verification, message: `Not published — the check "${failed.name}" failed (${failed.detail || "no detail"}). ${previous.status === "published" ? `The previous version (revision ${previous.published_revision}) is still live.` : "The page stays offline."} Try again in a minute; if it keeps failing, tell the developer which check failed.` });
        }
        const url = publicPathFor(type, content.slug);
        // Publishing can add the page to the header menu in one click (body.add_to_nav).
        let navMessage = "";
        if (body.add_to_nav === true && type !== "ad") {
          const current = await siteNav();
          const nav = current.header.links.length ? current : site.normalizeNav(site.STATIC_NAV);
          if (!nav.header.links.some(l => l.href === url)) { nav.header.links.push({ label: content.title || content.slug, href: url, children: [] }); await saveSetting("navigation", nav, auth); navMessage = " Added to the header menu."; }
        }
        return res.status(200).json({ ok: true, sandbox, page: { ...row, draft_content: undefined, published_content: undefined, page_type: type, public_path: url }, url, alt_url: type === "ad" ? null : `/p/${content.slug}`, revision, checklist, verification: { ok: true, checks: verification.checks, images: media.images, copied: media.copied }, message: (sandbox ? `Published on the practice copy. Open ${url} here to see it. Use Send to live when it is ready for the real site.` : `Published. Live at ${url} within about a minute.`) + (media.copied ? ` ${media.copied} photo${media.copied === 1 ? "" : "s"} copied into the site's own storage.` : "") + navMessage });
      }
      case "durability": {
        // "Where this page lives" (durability): addresses, export file, who
        // published, revision, every photo with its bucket, last health run.
        if (!id) throw fail(400, "Which page?");
        const { page, revisions } = await loadPage(id);
        const type = page.page_type;
        const published = revisions.find(r => r.kind === "published" && Number(r.revision) === Number(page.published_revision)) || revisions.find(r => r.kind === "published") || null;
        const images = durability.collectMedia(JSON.parse(JSON.stringify(page.published_content || page.draft_content || {}))).map(m => ({ url: m.url, bucket: durability.bucketLabel(m.url) }));
        const buckets = [...new Set(images.map(i => i.bucket))];
        const health = await getSetting("site_health").catch(() => null);
        const healthPage = (health?.value?.pages || []).find(p => p.slug === page.slug) || null;
        const exportIndex = durability.readExportIndex();
        const exportEntry = exportIndex?.pages?.find(p => p.slug === page.slug) || null;
        return res.status(200).json({ ok: true, sandbox, schema: isSandbox() ? "practice" : "public", bucket: bucketName("trainer-page-assets"), url: publicPathFor(type, page.slug), alt_url: type === "ad" ? null : `/p/${page.slug}`, export_html: `site/pages/${page.slug}.html`, export_json: `site/pages/${page.slug}.json`, export: exportEntry ? { revision: exportEntry.revision, exported_at: exportIndex.exported_at, matches: Number(exportEntry.revision) === Number(page.published_revision) } : null, status: page.status, revision: Number(page.published_revision || 0), published_at: page.published_at || null, published_by: published?.created_by || (page.status === "published" ? page.updated_by : null) || null, images, buckets, health: healthPage ? { ok: healthPage.ok, ran_at: health.value.ran_at, problems: healthPage.problems, warnings: healthPage.warnings } : (health?.value ? { ok: null, ran_at: health.value.ran_at, problems: [], warnings: ["not in the last health run (published since?)"] } : null) });
      }
      case "restore": {
        if (!id) throw fail(400, "Which page?");
        const revisionId = clean(body.revision_id, 80);
        if (!revisionId) throw fail(400, "Which version?");
        const { page } = await loadPage(id);
        const content = normalizeFor(page.page_type, await loadRevisionContent(id, revisionId));
        const row = await updatePage(id, { draft_content: content, draft_revision: Number(page.draft_revision || 0) + 1 }, auth, null);
        return res.status(200).json({ ok: true, sandbox, content, draft_revision: row.draft_revision, message: "That version is back in the draft. Publish when you are happy with it." });
      }
      case "unpublish": {
        if (!id) throw fail(400, "Which page?");
        const { page } = await loadPage(id);
        await updatePage(id, { status: "draft", published_content: null }, auth, null);
        return res.status(200).json({ ok: true, message: page.page_type === "ad" ? "The page is offline. The draft is kept." : `The page is offline. ${importer.IMPORTABLE.some(p => p.slug === page.slug) ? `Visitors see the original ${page.slug}.html again.` : "Visitors get a not-found page at that address."} The draft is kept.` });
      }
      case "archive": {
        if (!id) throw fail(400, "Which page?");
        if (!auth.isSuperAdmin) throw fail(403, "Only a Super Admin can remove a page.");
        await updatePage(id, { status: "archived", published_content: null }, auth, null);
        return res.status(200).json({ ok: true, sandbox, message: "Page removed. It is off the site and out of the list." });
      }
      case "theme_get": {
        const row = await getSetting("theme").catch(() => null);
        const theme = site.normalizeTheme(row?.value || {});
        return res.status(200).json({ ok: true, theme, warnings: site.themeWarnings(theme), updated_by: row?.updated_by || null, updated_at: row?.updated_at || null, fonts: site.SITE_FONTS, pairs: site.FONT_PAIRS });
      }
      case "theme_save": {
        const theme = site.normalizeTheme(body.theme);
        const row = await saveSetting("theme", theme, auth);
        return res.status(200).json({ ok: true, sandbox, theme, warnings: site.themeWarnings(theme), updated_at: row?.updated_at || stamp(), message: sandbox ? "Site theme saved on the practice copy. Every published page here uses it now." : "Site theme saved. Every published page uses it within about a minute." });
      }
      case "nav_get": {
        const row = await getSetting("navigation").catch(() => null);
        const nav = site.normalizeNav(row?.value || {});
        return res.status(200).json({ ok: true, navigation: nav, effective: site.effectiveNav(nav), static: site.normalizeNav(site.STATIC_NAV), updated_by: row?.updated_by || null, updated_at: row?.updated_at || null });
      }
      case "nav_save": {
        const nav = site.normalizeNav(body.navigation);
        const row = await saveSetting("navigation", nav, auth);
        return res.status(200).json({ ok: true, sandbox, navigation: nav, effective: site.effectiveNav(nav), updated_at: row?.updated_at || stamp(), message: nav.header.links.length ? "Menus saved. Every published Site Builder page shows them within about a minute." : "Menus cleared. Pages show the built-in site menus again." });
      }
      case "upload": {
        const result = await uploadAsset(body, auth);
        return res.status(200).json({ ok: true, sandbox, ...result, message: sandbox ? "Uploaded to the practice copy." : "Uploaded." });
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
module.exports.supabaseFetch = supabaseFetch;
module.exports.siteTheme = siteTheme;
module.exports.siteNav = siteNav;
module.exports.loadData = loadData;
module.exports.pageTypeOf = pageTypeOf;
