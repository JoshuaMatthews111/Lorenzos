// Site Builder durability — the one place that answers "did this page really
// land, and can we always get it back?"
//
//   prepareMedia()     before a publish is written: every photo / video / logo
//                      URL in the page is checked. A URL that still points at a
//                      practice bucket, a signed (temporary) link or a data: blob
//                      is COPIED into the deployment's own bucket under
//                      pages/<slug>/… and the URL rewritten; a blob: URL (never
//                      uploaded) or a dead link fails the publish in plain words.
//   verifyPublished()  after the write: the row reads back with published
//                      content at the new revision, the page route answers 200
//                      for /p/<slug> (and so the clean path), the manifest lists
//                      it (middleware) and the sitemap carries it. api/pages.js
//                      rolls the publish back to the previous revision when any
//                      of these fails.
//   renderExport()     the exact bytes the route serves, for scripts/export-pages.mjs
//                      (site/pages/<slug>.html + .json, git always has a copy).
//   runSiteHealth()    the nightly check (api/cron/site-health.js and
//                      scripts/site-health.mjs): every published page answers
//                      200 at its clean path and /p/, every image answers 200,
//                      the export files match the database.
//   rowsFetch()        a fetch() that answers the three Site Builder tables from
//                      a JSON dump, so the export and the health check work from
//                      any machine without the service key (--rows file).
//
// Nothing here talks to the office. Everything here is read-only except the
// storage copies in prepareMedia() (new objects under pages/<slug>/, never a
// delete or a move) and the site_health row the cron writes.
"use strict";
const { createHash } = require("node:crypto");
const { existsSync, readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { supabaseRequest, bucketName, isSandbox } = require("./sandbox");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://ptnzaeprvkgjgtupmcty.supabase.co";
const SITE_ORIGIN = "https://www.lorenzosdogtrainingteam.com";
const ASSET_BUCKET = "trainer-page-assets";
const EXPORT_DIR = "site/pages";
const MEDIA_KEYS = new Set(["image", "bgImage", "ogImage", "video", "poster", "logo", "logoDark", "favicon", "src", "photo", "hero_image"]);
const EXT_BY_TYPE = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/svg+xml": "svg", "image/x-icon": "ico", "video/mp4": "mp4" };
const root = resolve(__dirname, "..");
const sha256 = value => createHash("sha256").update(value).digest("hex");
const publicPathFor = (type, slug) => (type === "ad" ? `/ads/${slug}` : `/${slug}`);
const altPathFor = (type, slug) => (type === "ad" ? null : `/p/${slug}`);

// ---------------------------------------------------------------------------
// Media URLs inside a page
// ---------------------------------------------------------------------------
// Walks the content and returns every media reference with a setter so it can
// be rewritten in place. Rich-text <img src> are covered too.
function collectMedia(content) {
  const found = [];
  const walk = (node, path) => {
    if (Array.isArray(node)) { node.forEach((item, i) => walk(item, [...path, i])); return; }
    if (!node || typeof node !== "object") return;
    for (const [key, value] of Object.entries(node)) {
      if (typeof value === "string") {
        if (MEDIA_KEYS.has(key) && value.trim()) found.push({ path: [...path, key], url: value.trim(), set: next => { node[key] = next; } });
        else if (key === "html" && /<img\s/i.test(value)) {
          for (const m of value.matchAll(/<img\s[^>]*src="([^"]+)"/gi)) {
            const url = m[1];
            found.push({ path: [...path, key, "img"], url, set: next => { node[key] = node[key].split(`src="${url}"`).join(`src="${next}"`); } });
          }
        }
      } else if (value && typeof value === "object") walk(value, [...path, key]);
    }
  };
  walk(content, []);
  return found;
}

// What kind of place a URL points at.
function classifyMedia(url, { supabaseUrl = SUPABASE_URL, currentBucket = bucketName(ASSET_BUCKET) } = {}) {
  const u = String(url || "").trim();
  if (!u) return { kind: "empty" };
  if (/^blob:/i.test(u)) return { kind: "blob" };
  if (/^data:/i.test(u)) return { kind: "data" };
  const storage = u.match(/^(https?:\/\/[^/]+)\/storage\/v1\/object\/(public|sign|authenticated)\/([^/?]+)\/([^?]+)(\?.*)?$/i);
  if (storage) {
    const [, origin, mode, bucket, key, query] = storage;
    const sameProject = origin.toLowerCase() === supabaseUrl.toLowerCase();
    if (mode === "sign" || /token=/.test(query || "")) return { kind: "signed", origin, bucket, key: decodeURIComponent(key), sameProject };
    if (sameProject && bucket === currentBucket) return { kind: "own-bucket", bucket, key: decodeURIComponent(key) };
    if (sameProject) return { kind: "other-bucket", bucket, key: decodeURIComponent(key), practice: bucket.startsWith("practice-") };
    return { kind: "external", origin };
  }
  if (/^https?:\/\//i.test(u)) return { kind: "external" };
  if (/^\/\//.test(u)) return { kind: "external" };
  return { kind: "relative", path: u.replace(/^\/+/, "") };
}

function bucketLabel(url) {
  const c = classifyMedia(url);
  if (c.bucket) return c.bucket;
  if (c.kind === "relative") return "site file (repo)";
  if (c.kind === "external") return "another website";
  return c.kind;
}

function fileNameFor(url, contentType) {
  const c = classifyMedia(url);
  const base = (c.key ? c.key.split("/").pop() : (c.kind === "data" ? "" : String(url).split("/").pop().split("?")[0])) || "";
  const clean = base.toLowerCase().replace(/[^a-z0-9.-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  if (clean && /\.[a-z0-9]{2,4}$/.test(clean)) return clean;
  const ext = EXT_BY_TYPE[String(contentType || "").split(";")[0].trim()] || "bin";
  return `${clean || "file"}.${ext}`;
}

async function probe(fetchImpl, url) {
  const attempt = async method => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const r = await fetchImpl(url, { method, redirect: "follow", signal: controller.signal });
      return r;
    } finally { clearTimeout(timer); }
  };
  try {
    let r = await attempt("HEAD");
    if (r.status === 405 || r.status === 403 || r.status === 400) r = await attempt("GET");
    return { ok: r.ok, status: r.status };
  } catch (error) {
    return { ok: false, status: 0, error: error.message };
  }
}

// Uploads bytes into the deployment's own asset bucket (practice-* on the
// practice copy through lib/sandbox.js). Never overwrites: the key carries a
// content hash, so the same photo lands once.
async function uploadToOwnBucket({ fetchImpl, serviceKey, slug, bytes, contentType, name }) {
  const key = `pages/${slug}/${sha256(bytes).slice(0, 10)}-${name}`;
  const target = supabaseRequest(`/storage/v1/object/${ASSET_BUCKET}/${key}`);
  const response = await fetchImpl(`${SUPABASE_URL}${target.path}`, {
    method: "POST",
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": contentType || "application/octet-stream", "x-upsert": "true", ...target.headers },
    body: bytes
  });
  if (!response.ok) throw new Error(`upload failed (${response.status})`);
  return `${SUPABASE_URL}/storage/v1/object/public/${bucketName(ASSET_BUCKET)}/${key}`;
}

// Before the publish is written: check every media URL and bring stragglers
// into the deployment's own bucket. Returns the (possibly rewritten) content,
// the list of images with their buckets, and `failure` when the office must fix
// something first.
async function prepareMedia(content, { slug, fetchImpl = fetch, serviceKey = "", assetExists = null, siteOrigin = SITE_ORIGIN } = {}) {
  const items = collectMedia(content);
  const images = [];
  let copied = 0;
  const failures = [];
  const where = item => `Photo ${images.length} (${item.path.filter(p => typeof p === "string" && p !== "img").join(" › ") || "page"})`;
  for (const item of items) {
    const c = classifyMedia(item.url);
    const record = { url: item.url, bucket: bucketLabel(item.url), kind: c.kind, ok: true };
    images.push(record);
    try {
      if (c.kind === "blob") {
        record.ok = false;
        failures.push(`${where(item)} was never uploaded (it is still a browser-only file). Open the block, pick the photo again with Upload, then publish.`);
        continue;
      }
      if (c.kind === "relative") {
        const onDisk = typeof assetExists === "function" ? assetExists(c.path) : existsSync(resolve(root, c.path));
        if (onDisk) continue;
        const r = await probe(fetchImpl, `${siteOrigin}/${c.path}`);
        if (!r.ok) { record.ok = false; failures.push(`${where(item)} cannot be found: "${item.url}" is not on the website. Pick another photo or upload it.`); }
        continue;
      }
      if (c.kind === "data") {
        const m = /^data:([^;,]+)?(;base64)?,(.*)$/is.exec(item.url);
        const bytes = m?.[2] ? Buffer.from(m[3], "base64") : Buffer.from(decodeURIComponent(m?.[3] || ""), "utf8");
        if (!bytes.length) { record.ok = false; failures.push(`${where(item)} is empty. Upload it again.`); continue; }
        const next = await uploadToOwnBucket({ fetchImpl, serviceKey, slug, bytes, contentType: m?.[1] || "application/octet-stream", name: fileNameFor(item.url, m?.[1]) });
        item.set(next); Object.assign(record, { url: next, bucket: bucketLabel(next), copied_from: "inline data", kind: "own-bucket" }); copied += 1;
        continue;
      }
      if (c.kind === "signed" || c.kind === "other-bucket") {
        // A practice-copy photo on live, a temporary signed link, or a photo in
        // some other bucket of this project: copy it in, then point at the copy.
        const r = await fetchImpl(item.url, { redirect: "follow" });
        if (!r.ok) { record.ok = false; failures.push(`${where(item)} cannot be fetched from ${c.bucket || "its bucket"} (${r.status}). Upload it again.`); continue; }
        const bytes = Buffer.from(await r.arrayBuffer());
        const contentType = r.headers.get("content-type") || "application/octet-stream";
        const next = await uploadToOwnBucket({ fetchImpl, serviceKey, slug, bytes, contentType, name: fileNameFor(item.url, contentType) });
        item.set(next); Object.assign(record, { url: next, bucket: bucketLabel(next), copied_from: c.bucket || "signed link", kind: "own-bucket" }); copied += 1;
        continue;
      }
      // own bucket or another website: it must answer 200 right now.
      const r = await probe(fetchImpl, item.url);
      if (!r.ok) { record.ok = false; failures.push(`${where(item)} does not load (${r.status || "no answer"}): ${item.url}. Upload it again or pick another photo.`); }
    } catch (error) {
      record.ok = false;
      failures.push(`${where(item)} could not be checked (${error.message}). Try again in a minute.`);
    }
  }
  return { content, images, copied, failure: failures.length ? { check: "images", message: failures.join(" ") } : null };
}

// ---------------------------------------------------------------------------
// After the write
// ---------------------------------------------------------------------------
function fakeRes() {
  const r = { statusCode: 200, headers: {}, body: null };
  r.setHeader = (k, v) => { r.headers[String(k).toLowerCase()] = v; };
  r.status = c => { r.statusCode = c; return r; };
  r.send = b => { r.body = b; return r; };
  r.json = b => { r.body = JSON.stringify(b); return r; };
  r.end = () => r;
  return r;
}

// Runs the real page route in-process for a slug (the same code /p/<slug>,
// /ads/<slug> and the clean path execute) and returns what it would answer.
async function renderThroughRoute(slug, type) {
  const route = require("../api/ad-page.js");
  const res = fakeRes();
  await route({ query: { slug, via: type === "ad" ? "ads" : "site" }, headers: {} }, res);
  return res;
}

async function verifyPublished({ slug, type, revision, supabaseFetch }) {
  const checks = [];
  const add = (name, ok, detail) => { checks.push({ name, ok: Boolean(ok), detail }); return Boolean(ok); };
  // (a) the row reads back with published content at the new revision
  let row = null;
  try {
    const rows = await supabaseFetch(`/rest/v1/ad_pages?select=slug,page_type,status,published_revision,published_content,published_at&slug=eq.${encodeURIComponent(slug)}&limit=1`);
    row = rows?.[0] || null;
  } catch (error) { row = null; }
  const hasContent = row?.published_content && typeof row.published_content === "object" && (Array.isArray(row.published_content.blocks) ? row.published_content.blocks.length > 0 : Object.keys(row.published_content).length > 0);
  if (!add("Saved in the database", row && row.status === "published" && Number(row.published_revision) === Number(revision) && hasContent, row ? `status ${row.status}, revision ${row.published_revision}` : "the page could not be read back")) {
    return { ok: false, checks, failed: checks[checks.length - 1] };
  }
  // (c) the page route answers 200 (this is what /p/<slug>, /ads/<slug> and the clean path run)
  let res;
  try { res = await renderThroughRoute(slug, type); } catch (error) { res = { statusCode: 0, body: error.message }; }
  if (!add(type === "ad" ? "Page answers at /ads/" : "Page answers at /p/ and its clean path", res.statusCode === 200 && /<html/i.test(String(res.body || "")), `HTTP ${res.statusCode}`)) {
    return { ok: false, checks, failed: checks[checks.length - 1] };
  }
  // (d) manifest (what middleware.js reads for the clean path) and sitemap
  if (type !== "ad") {
    let paths = [];
    try { paths = (await require("../api/pages-manifest.js").publishedPaths()).map(p => p.slug); } catch { paths = []; }
    if (!add("Listed for the clean path (manifest)", paths.includes(slug), paths.length ? `${paths.length} published page(s) listed` : "the manifest could not be read")) {
      return { ok: false, checks, failed: checks[checks.length - 1] };
    }
  }
  try {
    const sitemap = require("../api/sitemap.js");
    const xml = sitemap.merge(sitemap.staticSitemap(), await sitemap.publishedRows());
    const noindex = row.published_content?.seo?.noindex === true;
    if (!add("In sitemap.xml", noindex || xml.includes(`${SITE_ORIGIN}${publicPathFor(type, slug)}</loc>`), noindex ? "hidden from Google on purpose (noindex)" : "sitemap.xml carries the page")) {
      return { ok: false, checks, failed: checks[checks.length - 1] };
    }
  } catch (error) {
    add("In sitemap.xml", false, error.message);
    return { ok: false, checks, failed: checks[checks.length - 1] };
  }
  return { ok: true, checks, failed: null, html: res.body };
}

// ---------------------------------------------------------------------------
// Export (scripts/export-pages.mjs) — the same bytes the route serves.
// ---------------------------------------------------------------------------
async function renderExport(row, { revisions = [], theme = null, navigation = null, schema = "public" } = {}) {
  const type = ["site", "landing"].includes(row.page_type) ? row.page_type : "ad";
  const res = await renderThroughRoute(row.slug, type);
  if (res.statusCode !== 200) throw new Error(`route answered ${res.statusCode} for ${row.slug}`);
  const html = String(res.body);
  const published = revisions.filter(r => String(r.page_id) === String(row.id) && r.kind === "published" && Number(r.revision) === Number(row.published_revision))[0]
    || revisions.filter(r => String(r.page_id) === String(row.id) && r.kind === "published").sort((a, b) => Number(b.revision) - Number(a.revision))[0] || null;
  const media = collectMedia(JSON.parse(JSON.stringify(row.published_content || {}))).map(m => ({ url: m.url, bucket: bucketLabel(m.url) }));
  const meta = {
    slug: row.slug,
    title: row.title || row.published_content?.title || row.published_content?.headline || "",
    page_type: type,
    path: publicPathFor(type, row.slug),
    alt_path: altPathFor(type, row.slug),
    published_by: published?.created_by || row.updated_by || null,
    published_at: row.published_at || null,
    revision: Number(row.published_revision || 0),
    schema,
    html_sha256: sha256(html),
    html_file: `${EXPORT_DIR}/${row.slug}.html`,
    images: media,
    exported_at: new Date().toISOString()
  };
  const json = { ...meta, content: row.published_content, theme: { site: theme, page: row.published_content?.theme || null }, navigation };
  return { html, json, meta };
}

function indexMarkdown(entries, { schema, exportedAt }) {
  const rows = entries.map(e => `| ${e.slug} | ${e.page_type} | ${e.path} | ${e.published_by || "—"} | ${e.published_at || "—"} | ${e.revision} |`);
  return `# Published Site Builder pages (${schema})\n\nGenerated by \`node scripts/export-pages.mjs\` on ${exportedAt}. One row per published page; the\n\`.html\` beside it is the exact page the site serves and the \`.json\` is the editable content.\nSee \`docs/SITE-BUILDER.md\`. Do not edit these files by hand — re-run the export.\n\n| Slug | Type | Live path | Last editor | Last published | Revision |\n| --- | --- | --- | --- | --- | --- |\n${rows.join("\n") || "| (no published pages) | | | | | |"}\n`;
}

function readExportIndex(dir = resolve(root, EXPORT_DIR)) {
  const file = resolve(dir, "index.json");
  if (!existsSync(file)) return null;
  try { return JSON.parse(readFileSync(file, "utf8")); } catch { return null; }
}

// ---------------------------------------------------------------------------
// Nightly health
// ---------------------------------------------------------------------------
// `pages` = [{slug, page_type, published_revision, published_at, published_content}]
// `exportIndex` = site/pages/index.json (or null when not bundled)
// `renderHash(row)` = optional, returns the sha256 of a fresh in-process render
async function runSiteHealth({ pages, base, fetchImpl = fetch, exportIndex = null, renderHash = null, siteOrigin = SITE_ORIGIN }) {
  const origin = String(base || siteOrigin).replace(/\/$/, "");
  const results = [];
  for (const row of pages) {
    const type = ["site", "landing"].includes(row.page_type) ? row.page_type : "ad";
    const path = publicPathFor(type, row.slug);
    const problems = [];
    const warnings = [];
    const entrances = [[path, "clean path"], ...(type === "ad" ? [] : [[`/p/${row.slug}`, "/p/ path"]])];
    for (const [entrance, label] of entrances) {
      let r;
      try { r = await fetchImpl(`${origin}${entrance}?ldtt_health=${Date.now()}`, { redirect: "follow", headers: { "cache-control": "no-cache" } }); }
      catch (error) { problems.push(`${label} ${entrance}: no answer (${error.message})`); continue; }
      if (r.status !== 200) { problems.push(`${label} ${entrance}: HTTP ${r.status}`); continue; }
      const served = r.headers.get("x-ldtt-page-type") || (r.headers.get("x-ldtt-served-from") ? "export" : "");
      if (!served && label === "clean path" && type !== "ad") warnings.push(`${label} ${entrance}: answered 200 but not from the page route (a static or exported file is serving)`);
    }
    const media = collectMedia(JSON.parse(JSON.stringify(row.published_content || {})));
    const images = [];
    for (const m of media) {
      const c = classifyMedia(m.url);
      if (c.kind === "blob" || c.kind === "data") { problems.push(`image ${m.url.slice(0, 40)}…: never uploaded (${c.kind})`); continue; }
      const url = c.kind === "relative" ? `${origin}/${c.path}` : m.url;
      const p = await probe(fetchImpl, url);
      images.push({ url: m.url, bucket: bucketLabel(m.url), status: p.status });
      if (!p.ok) problems.push(`image ${m.url}: HTTP ${p.status || "no answer"}`);
    }
    let exportState = "not bundled";
    if (exportIndex && Array.isArray(exportIndex.pages)) {
      const entry = exportIndex.pages.find(e => e.slug === row.slug);
      if (!entry) { exportState = "missing"; warnings.push("no export file yet (site/pages/<slug>.html) — re-run scripts/export-pages.mjs and deploy"); }
      else if (Number(entry.revision) !== Number(row.published_revision)) { exportState = "stale"; warnings.push(`export file is revision ${entry.revision}, database is ${row.published_revision} — re-run the export`); }
      else if (typeof renderHash === "function") {
        try { const h = await renderHash(row); if (h && h !== entry.html_sha256) { exportState = "differs"; warnings.push("export file bytes differ from a fresh render (theme or menus changed since the export) — re-run the export"); } else exportState = "matches"; }
        catch (error) { exportState = "unknown"; warnings.push(`could not re-render for the export check (${error.message})`); }
      } else exportState = "revision matches";
    }
    results.push({ slug: row.slug, page_type: type, path, revision: Number(row.published_revision || 0), ok: problems.length === 0, problems, warnings, images, export: exportState });
  }
  const broken = results.filter(r => !r.ok);
  const stale = results.filter(r => r.ok && r.warnings.length);
  return {
    ok: broken.length === 0,
    ran_at: new Date().toISOString(),
    base: origin,
    checked: results.length,
    broken: broken.map(r => ({ slug: r.slug, path: r.path, problems: r.problems })),
    stale: stale.map(r => ({ slug: r.slug, path: r.path, warnings: r.warnings })),
    pages: results
  };
}

// The DSN Command approval payload for ONE broken page (never for stale
// exports, never for a clean run). product_id is LDTT in DSN Command.
const DSN_PRODUCT_ID = "bb51502e-eb05-4919-82ce-ed5a39a8d609";
function dsnApprovalPayload(page, { base, ranAt }) {
  return {
    product_id: DSN_PRODUCT_ID,
    type: "other",
    title: `LDTT: page ${page.slug} is not serving`,
    body: `The nightly site health check (${ranAt}) found the Site Builder page ${page.path} on ${base} is broken:\n- ${page.problems.join("\n- ")}\n\nWhat to do: open Page Studio → the page → the "Where this page lives" panel, fix the photo or re-publish. If the page route is down, the exported copy in site/pages/${page.slug}.html is the fallback (docs/SITE-BUILDER.md).`,
    risk: "medium",
    cost_cents: 0
  };
}

// ---------------------------------------------------------------------------
// A fetch() over a JSON dump of the three tables (for --rows on any machine).
// ---------------------------------------------------------------------------
function rowsFetch(rows) {
  const tables = { ad_pages: rows.ad_pages || [], ad_page_revisions: rows.ad_page_revisions || [], site_settings: rows.site_settings || [], portal_users: [] };
  const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  const filter = (list, params) => {
    let out = list;
    for (const [key, raw] of params) {
      if (["select", "order", "limit"].includes(key)) continue;
      const [op, ...rest] = raw.split("."); const value = rest.join(".");
      if (op === "eq") out = out.filter(r => String(r[key]) === value);
      if (op === "neq") out = out.filter(r => String(r[key]) !== value);
      if (op === "in") { const set = value.replace(/^\(|\)$/g, "").split(",").map(v => v.replace(/^"|"$/g, "")); out = out.filter(r => set.includes(String(r[key]))); }
    }
    const order = params.get("order");
    if (order) { const [col, dir] = order.split("."); out = [...out].sort((a, b) => (a[col] > b[col] ? 1 : -1) * (dir === "desc" ? -1 : 1)); }
    const limit = Number(params.get("limit") || 0);
    return limit ? out.slice(0, limit) : out;
  };
  return async (url, options = {}) => {
    const u = new URL(url);
    const method = (options.method || "GET").toUpperCase();
    if (u.pathname === "/auth/v1/user") return json(401, {});
    const table = u.pathname.replace("/rest/v1/", "");
    if (method !== "GET" || !tables[table]) return json(405, { message: "rows file is read-only" });
    return json(200, filter(tables[table], u.searchParams));
  };
}

module.exports = {
  SITE_ORIGIN, ASSET_BUCKET, EXPORT_DIR, DSN_PRODUCT_ID, MEDIA_KEYS,
  sha256, publicPathFor, altPathFor, collectMedia, classifyMedia, bucketLabel, fileNameFor,
  prepareMedia, verifyPublished, renderThroughRoute, renderExport, indexMarkdown, readExportIndex,
  runSiteHealth, dsnApprovalPayload, rowsFetch, fakeRes, isSandbox
};
