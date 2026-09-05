// Durability tests: a publish only counts when it really landed; photos end up
// in the deployment's own bucket; the exported copy is the served copy; the
// route and the middleware fall back to it; the nightly health check tells a
// broken page from a stale export. Run: node --test tests/   NOT deployed.
// Nothing here talks to the real project — every fetch is a fake in memory.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { mkdtempSync, writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";

const require = createRequire(import.meta.url);
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
process.env.SUPABASE_URL = "https://supabase.test";
process.env.LDTT_SANDBOX = "";
const site = require("../lib/site-page-template.js");
const durability = require("../lib/page-durability.js");
const pagesApi = require("../api/pages.js");
const pageRoute = require("../api/ad-page.js");
const manifestApi = require("../api/pages-manifest.js");
const sitemapApi = require("../api/sitemap.js");
const healthCron = require("../api/cron/site-health.js");

const OWN = "https://supabase.test/storage/v1/object/public/trainer-page-assets";
const PRACTICE = "https://supabase.test/storage/v1/object/public/practice-trainer-page-assets";
const office = { user_id: "u1", role: "admin", permission_level: "super_admin", active: true, access_status: "active", email: "office@test", first_name: "Office", last_name: "Person" };

function res() { const r = { statusCode: 200, headers: {}, body: null }; r.setHeader = (k, v) => { r.headers[k.toLowerCase()] = v; }; r.status = c => { r.statusCode = c; return r; }; r.send = b => { r.body = b; return r; }; r.json = b => { r.body = JSON.stringify(b); return r; }; r.end = () => r; return r; }
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

// An in-memory Supabase + Storage + the wider web, with knobs to break things.
function world({ rows = [], settings = [], objects = {}, web = {} } = {}) {
  const db = { ad_pages: rows, ad_page_revisions: [], site_settings: settings, portal_users: [office], audit_events: [] };
  const w = { db, objects, uploads: [], calls: [], knobs: { readbackFails: false, routeFails: false, manifestFails: false } };
  const filter = (list, params) => {
    let out = list;
    for (const [key, raw] of params) {
      if (["select", "order", "limit", "on_conflict"].includes(key)) continue;
      const [op, ...rest] = raw.split("."); const value = rest.join(".");
      if (op === "eq") out = out.filter(r => String(r[key]) === value);
      if (op === "neq") out = out.filter(r => String(r[key]) !== value);
      if (op === "in") { const set = value.replace(/^\(|\)$/g, "").split(",").map(v => v.replace(/^"|"$/g, "")); out = out.filter(r => set.includes(String(r[key]))); }
    }
    const limit = Number(params.get("limit") || 0);
    return limit ? out.slice(0, limit) : out;
  };
  w.fetch = async (url, options = {}) => {
    const u = new URL(url); const method = (options.method || "GET").toUpperCase();
    w.calls.push(`${method} ${u.pathname}${u.search}`);
    if (u.origin !== "https://supabase.test") {
      const hit = web[url] ?? web[`${u.origin}${u.pathname}`];
      if (hit === undefined) return new Response("", { status: 404 });
      return new Response(typeof hit === "string" ? hit : "ok", { status: 200, headers: { "content-type": "image/png" } });
    }
    if (u.pathname === "/auth/v1/user") return json(options.headers?.Authorization === "Bearer staff" ? 200 : 401, { id: "u1", email: "office@test" });
    if (u.pathname.startsWith("/storage/v1/object/public/")) { const key = u.pathname.replace("/storage/v1/object/public/", ""); return objects[key] ? new Response(objects[key], { status: 200, headers: { "content-type": "image/png" } }) : new Response("", { status: 404 }); }
    if (u.pathname.startsWith("/storage/v1/object/") && method === "POST") { const key = u.pathname.replace("/storage/v1/object/", ""); objects[key] = Buffer.from(await new Response(options.body).arrayBuffer()); w.uploads.push(key); return json(200, { Key: key }); }
    const table = u.pathname.replace("/rest/v1/", "");
    if (!db[table]) return json(404, { message: `Could not find the table 'public.${table}'` });
    if (method === "GET") {
      if (table === "ad_pages" && w.knobs.readbackFails && u.searchParams.get("select")?.startsWith("slug,page_type,status,published_revision")) return json(200, []);
      if (table === "ad_pages" && w.knobs.routeFails && u.searchParams.get("select")?.startsWith("slug,page_type,status,published_content")) return json(500, { message: "boom" });
      if (table === "ad_pages" && w.knobs.manifestFails && u.searchParams.get("page_type") === "in.(site,landing)") return json(500, { message: "boom" });
      return json(200, filter(db[table], u.searchParams));
    }
    const body = options.body ? JSON.parse(options.body) : null;
    if (method === "POST") {
      if (table === "site_settings") { const hit = db.site_settings.find(r => r.key === body.key); if (hit) Object.assign(hit, body); else db.site_settings.push(body); return json(200, [body]); }
      const list = (Array.isArray(body) ? body : [body]).map(r => ({ id: randomUUID(), created_at: new Date().toISOString(), ...r }));
      db[table].push(...list); return json(201, list);
    }
    if (method === "PATCH") { const t = filter(db[table], u.searchParams); t.forEach(r => Object.assign(r, body, { updated_at: new Date().toISOString() })); return json(200, t); }
    if (method === "DELETE") { const t = filter(db[table], u.searchParams); db[table] = db[table].filter(r => !t.includes(r)); return json(200, t); }
    return json(405, {});
  };
  pagesApi.deps.fetch = w.fetch; manifestApi.deps.fetch = w.fetch; sitemapApi.deps.fetch = w.fetch; healthCron.deps.fetch = w.fetch;
  return w;
}
const publish = async (w, id, extra = {}) => { const r = res(); await pagesApi({ method: "POST", headers: { authorization: "Bearer staff" }, body: { operation: "publish", id, ...extra } }, r); return { status: r.statusCode, data: JSON.parse(r.body) }; };
const draftPage = (slug, image) => ({ id: randomUUID(), slug, page_type: "site", title: "Services", status: "draft", draft_revision: 3, published_revision: 0, published_content: null, published_at: null, draft_content: { ...site.starter("services"), slug, title: "Services", seo: { description: "Our services." }, blocks: site.starter("services").blocks.map((b, i) => (i === 0 ? { ...b, image } : b)) } });

test("collectMedia + classifyMedia: every URL-bearing field is found and named by bucket", () => {
  const content = { seo: { ogImage: `${OWN}/site/og.png` }, blocks: [
    { type: "hero", image: `${PRACTICE}/site/hero.jpg`, video: "", design: { bgImage: "assets/x.jpg" } },
    { type: "richtext", html: `<p>x</p><img src="data:image/png;base64,iVBORw0KGgo=" alt=""><img src="https://other.example/a.png">` },
    { type: "gallery", items: [{ image: "blob:https://portal/abc" }, { image: "https://supabase.test/storage/v1/object/sign/trainer-page-assets/site/s.png?token=abc" }] }
  ] };
  const media = durability.collectMedia(content);
  assert.deepEqual(media.map(m => durability.classifyMedia(m.url).kind), ["own-bucket", "other-bucket", "relative", "data", "external", "blob", "signed"]);
  assert.equal(durability.classifyMedia(`${PRACTICE}/x.jpg`).practice, true);
  assert.equal(durability.bucketLabel(`${PRACTICE}/x.jpg`), "practice-trainer-page-assets");
  assert.equal(durability.bucketLabel("assets/x.jpg"), "site file (repo)");
  media[3].set("https://ok/x.png");
  assert.ok(content.blocks[1].html.includes(`src="https://ok/x.png"`) && !content.blocks[1].html.includes("data:"));
});

test("prepareMedia: practice-bucket, signed and inline photos are copied into the live bucket under pages/<slug>/ and rewritten; a dead link or a blob: refuses in plain words", async () => {
  const w = world({ objects: { "practice-trainer-page-assets/site/hero.jpg": Buffer.from("HERO"), "trainer-page-assets/site/ok.png": Buffer.from("OK") } });
  const content = { blocks: [
    { type: "hero", image: `${PRACTICE}/site/hero.jpg`, design: { bgImage: `${OWN}/site/ok.png` } },
    { type: "richtext", html: `<img src="data:image/png;base64,${Buffer.from("PNG").toString("base64")}">` },
    { type: "gallery", items: [{ image: "assets/get-started-premium-hero.jpg" }] }
  ] };
  const r = await durability.prepareMedia(content, { slug: "services", fetchImpl: w.fetch, serviceKey: "k" });
  assert.equal(r.failure, null);
  assert.equal(r.copied, 2);
  assert.ok(content.blocks[0].image.startsWith(`${OWN}/pages/services/`) && content.blocks[0].image.endsWith("-hero.jpg"), content.blocks[0].image);
  assert.equal(w.objects[content.blocks[0].image.replace("https://supabase.test/storage/v1/object/public/", "")].toString(), "HERO", "the bytes were copied, not moved");
  assert.ok(w.objects["practice-trainer-page-assets/site/hero.jpg"], "the practice file is kept");
  assert.ok(/pages\/services\/[a-f0-9]{10}-file\.png/.test(content.blocks[1].html));
  assert.equal(content.blocks[0].design.bgImage, `${OWN}/site/ok.png`, "a photo already in the live bucket is left alone");
  assert.deepEqual(r.images.map(i => i.bucket), ["trainer-page-assets", "trainer-page-assets", "trainer-page-assets", "site file (repo)"]);

  const dead = await durability.prepareMedia({ blocks: [{ type: "hero", image: `${OWN}/site/missing.png` }] }, { slug: "s", fetchImpl: w.fetch, serviceKey: "k" });
  assert.equal(dead.failure.check, "images");
  assert.match(dead.failure.message, /does not load \(404\)/);
  const blob = await durability.prepareMedia({ blocks: [{ type: "hero", image: "blob:https://portal/x" }] }, { slug: "s", fetchImpl: w.fetch, serviceKey: "k" });
  assert.match(blob.failure.message, /never uploaded/);
  const gone = await durability.prepareMedia({ blocks: [{ type: "hero", image: "assets/not-a-real-file.jpg" }] }, { slug: "s", fetchImpl: w.fetch, serviceKey: "k" });
  assert.match(gone.failure.message, /cannot be found/);
});

test("publish (happy path): the row lands, the route serves it, the manifest and sitemap list it, the reply carries the verification", async () => {
  const page = draftPage("services", `${OWN}/site/hero.jpg`);
  const w = world({ rows: [page], objects: { "trainer-page-assets/site/hero.jpg": Buffer.from("x") } });
  const { status, data } = await publish(w, page.id);
  assert.equal(status, 200, data.message);
  assert.equal(data.verification.ok, true);
  assert.deepEqual(data.verification.checks.map(c => c.name), ["Saved in the database", "Page answers at /p/ and its clean path", "Listed for the clean path (manifest)", "In sitemap.xml"]);
  assert.equal(data.revision, 1);
  assert.equal(w.db.ad_pages[0].status, "published");
  assert.equal(w.db.ad_page_revisions.length, 1);
  const r = res(); await pageRoute({ query: { slug: "services", via: "site" }, headers: {} }, r);
  assert.equal(r.statusCode, 200);
});

test("publish with a practice-bucket photo on live: the photo is copied first and the stored page points at the live bucket", async () => {
  const page = draftPage("about-us", `${PRACTICE}/site/hero.jpg`);
  const w = world({ rows: [page], objects: { "practice-trainer-page-assets/site/hero.jpg": Buffer.from("x") } });
  const { status, data } = await publish(w, page.id);
  assert.equal(status, 200, data.message);
  assert.match(data.message, /1 photo copied/);
  assert.ok(w.db.ad_pages[0].published_content.blocks[0].image.startsWith(`${OWN}/pages/about-us/`));
  assert.ok(w.uploads.some(k => k.startsWith("trainer-page-assets/pages/about-us/")));
});

test("publish refused before any write when a photo is dead — nothing changes", async () => {
  const page = draftPage("services", `${OWN}/site/missing.jpg`);
  const w = world({ rows: [page] });
  const { status, data } = await publish(w, page.id);
  assert.equal(status, 400);
  assert.match(data.message, /^Not published — Photo 1 .* does not load \(404\)/);
  assert.equal(w.db.ad_pages[0].status, "draft");
  assert.equal(w.db.ad_page_revisions.length, 0);
  assert.ok(!w.calls.some(c => c.startsWith("PATCH /rest/v1/ad_pages")), "no write happened");
});

for (const [knob, checkName] of [["readbackFails", "Saved in the database"], ["routeFails", "Page answers at /p/ and its clean path"], ["manifestFails", "Listed for the clean path (manifest)"]]) {
  test(`publish rolled back when "${checkName}" fails: previous revision intact, attempt's revision row removed, plain message`, async () => {
    const page = { ...draftPage("services", `${OWN}/site/hero.jpg`), status: "published", published_revision: 4, published_at: "2026-09-01T00:00:00Z", published_content: { ...site.starter("services"), slug: "services", title: "OLD", seo: { description: "old" } } };
    const w = world({ rows: [page], objects: { "trainer-page-assets/site/hero.jpg": Buffer.from("x") } });
    w.db.ad_page_revisions.push({ id: randomUUID(), page_id: page.id, revision: 4, kind: "published", content: page.published_content, created_by: "Earlier Person" });
    w.knobs[knob] = true;
    const { status, data } = await publish(w, page.id);
    assert.equal(status, 400);
    assert.ok(data.message.startsWith(`Not published — the check "${checkName}" failed`), data.message);
    assert.match(data.message, /The previous version \(revision 4\) is still live/);
    assert.equal(data.verification.failed.name, checkName);
    const row = w.db.ad_pages[0];
    assert.equal(row.status, "published"); assert.equal(row.published_revision, 4); assert.equal(row.published_content.title, "OLD"); assert.equal(row.published_at, "2026-09-01T00:00:00Z");
    assert.deepEqual(w.db.ad_page_revisions.map(r => r.revision), [4], "the failed attempt left no revision row");
    assert.ok(w.calls.some(c => c.startsWith("DELETE /rest/v1/ad_page_revisions?page_id=")));
  });
}

test("publish rollback for a page that was never published leaves it a draft", async () => {
  const page = draftPage("services", `${OWN}/site/hero.jpg`);
  const w = world({ rows: [page], objects: { "trainer-page-assets/site/hero.jpg": Buffer.from("x") } });
  w.knobs.readbackFails = true;
  const { status, data } = await publish(w, page.id);
  assert.equal(status, 400);
  assert.match(data.message, /The page stays offline/);
  assert.equal(w.db.ad_pages[0].status, "draft"); assert.equal(w.db.ad_pages[0].published_content, null);
});

test("export: the .html is byte-for-byte what the route serves; .json carries content, theme, menus, who and when; INDEX.md lists it; --check sees drift", async () => {
  const page = { ...draftPage("services", `${OWN}/site/hero.jpg`), status: "published", published_revision: 2, published_at: "2026-09-05T01:02:03Z", published_content: { ...site.starter("services"), slug: "services", title: "Services", seo: { description: "d" } } };
  const settings = [{ key: "theme", value: { fontHead: "playfair" } }, { key: "navigation", value: {} }];
  const w = world({ rows: [page], settings });
  w.db.ad_page_revisions.push({ id: randomUUID(), page_id: page.id, revision: 2, kind: "published", created_by: "Rachel Office", created_at: "2026-09-05T01:02:03Z" });
  const r = res(); await pageRoute({ query: { slug: "services", via: "site" }, headers: {} }, r);
  const out = await durability.renderExport(page, { revisions: w.db.ad_page_revisions, theme: await pagesApi.siteTheme(), navigation: await pagesApi.siteNav(), schema: "public" });
  assert.equal(out.html, r.body, "exported bytes = served bytes");
  assert.equal(out.meta.published_by, "Rachel Office"); assert.equal(out.meta.revision, 2); assert.equal(out.meta.path, "/services"); assert.equal(out.meta.alt_path, "/p/services");
  assert.equal(out.json.theme.site.fontHead, "playfair"); assert.equal(out.json.content.title, "Services");
  assert.match(durability.indexMarkdown([out.meta], { schema: "public", exportedAt: "now" }), /\| services \| site \| \/services \| Rachel Office \| 2026-09-05T01:02:03Z \| 2 \|/);

  // The script itself, from a rows dump (no key), into a temp dir.
  const dir = mkdtempSync(resolve(tmpdir(), "ldtt-export-"));
  const dump = resolve(dir, "rows.json");
  writeFileSync(dump, JSON.stringify({ ad_pages: [page], ad_page_revisions: w.db.ad_page_revisions, site_settings: settings }));
  const env = { ...process.env, SUPABASE_SERVICE_ROLE_KEY: "", LDTT_SANDBOX: "" };
  const first = JSON.parse(execFileSync(process.execPath, ["scripts/export-pages.mjs", "--rows", dump, "--out", dir], { env, encoding: "utf8" }));
  assert.equal(first.published, 1);
  for (const f of ["pages/services.html", "pages/services.json", "pages/index.json", "pages/INDEX.md", "theme.json", "menus.json"]) assert.ok(existsSync(resolve(dir, f)), f);
  assert.equal(readFileSync(resolve(dir, "pages/services.html"), "utf8"), r.body);
  assert.equal(JSON.parse(readFileSync(resolve(dir, "pages/index.json"), "utf8")).pages[0].revision, 2);
  execFileSync(process.execPath, ["scripts/export-pages.mjs", "--rows", dump, "--out", dir, "--check"], { env, encoding: "utf8" });
  // drift: a newer revision in the database
  writeFileSync(dump, JSON.stringify({ ad_pages: [{ ...page, published_revision: 3 }], ad_page_revisions: [], site_settings: settings }));
  let drift = null;
  try { execFileSync(process.execPath, ["scripts/export-pages.mjs", "--rows", dump, "--out", dir, "--check"], { env, encoding: "utf8", stdio: "pipe" }); } catch (error) { drift = { status: error.status, out: JSON.parse(error.stdout) }; }
  assert.equal(drift?.status, 1, "--check exits 1 on drift");
  assert.deepEqual(drift.out.differences, ["site/pages/services.json", "site/pages/index.json", "site/pages/INDEX.md"], "the html is unchanged (same content), the revision metadata drifted");
});

test("route fallback: when the database errors, the exported copy is served with X-LDTT-Served-From; a plain 'not published' is still a 404", async () => {
  const dir = mkdtempSync(resolve(tmpdir(), "ldtt-export-"));
  const copy = pageRoute.exportedCopy("nope", "site");
  assert.equal(copy, null);
  // exportedCopy reads site/pages relative to the repo; prove it through a real file there.
  const pagesDir = resolve("site/pages");
  mkdirSync(pagesDir, { recursive: true });
  const slug = `zz-test-${Date.now().toString(36)}`;
  writeFileSync(resolve(pagesDir, `${slug}.html`), "<html>exported</html>");
  writeFileSync(resolve(pagesDir, `${slug}.json`), JSON.stringify({ page_type: "site", revision: 7, published_at: "x" }));
  try {
    const w = world({ rows: [] });
    w.knobs.routeFails = true;
    const r = res(); await pageRoute({ query: { slug, via: "site" }, headers: {} }, r);
    assert.equal(r.statusCode, 200); assert.equal(r.body, "<html>exported</html>"); assert.equal(r.headers["x-ldtt-served-from"], "export revision 7");
    const ads = res(); await pageRoute({ query: { slug }, headers: {} }, ads);
    assert.equal(ads.statusCode, 503, "the /ads entrance never serves a site page, even from the export");
    w.knobs.routeFails = false;
    const nf = res(); await pageRoute({ query: { slug: "nope", via: "site" }, headers: {} }, nf);
    assert.equal(nf.statusCode, 404);
  } finally {
    const { rmSync } = await import("node:fs");
    rmSync(resolve(pagesDir, `${slug}.html`)); rmSync(resolve(pagesDir, `${slug}.json`));
  }
  void dir;
});

test("middleware fallback order: manifest → exported index → static site", async () => {
  const mod = await import("../middleware.js");
  const calls = [];
  const run = async (answers, path = "/about") => {
    globalThis.fetch = async url => { const p = new URL(url).pathname; calls.push(p); const a = answers[p]; if (a === "throw") throw new Error("down"); return new Response(JSON.stringify(a.body), { status: a.status }); };
    const r = await mod.default({ url: `https://site.test${path}` });
    return r.headers.get("x-middleware-rewrite") || (r.headers.get("x-middleware-next") ? "next" : "?");
  };
  const realFetch = globalThis.fetch;
  try {
    assert.equal(await run({ "/api/pages-manifest": { status: 200, body: { ok: true, paths: ["about"] } } }), "https://site.test/api/ad-page?slug=about&via=site");
    assert.equal(await run({ "/api/pages-manifest": { status: 200, body: { ok: true, paths: [] } } }), "next", "not published → static file, no export lookup");
    assert.equal(await run({ "/api/pages-manifest": "throw", "/site/pages/index.json": { status: 200, body: { pages: [{ slug: "about", page_type: "site" }] } } }), "https://site.test/site/pages/about", "manifest down → exported copy");
    assert.equal(await run({ "/api/pages-manifest": { status: 200, body: { ok: false, paths: [] } }, "/site/pages/index.json": { status: 200, body: { pages: [{ slug: "about", page_type: "site" }] } } }), "https://site.test/site/pages/about", "manifest says ok:false (no key / DB error) → exported copy");
    assert.equal(await run({ "/api/pages-manifest": "throw", "/site/pages/index.json": { status: 200, body: { pages: [{ slug: "other", page_type: "site" }] } } }), "next", "manifest down and not exported → static file");
    assert.equal(await run({ "/api/pages-manifest": "throw", "/site/pages/index.json": "throw" }), "next", "everything down → static file (fail open)");
    assert.equal(await run({}, "/trainer-opportunity-cleveland-oh?x=1"), "next");
    assert.ok(mod.config.matcher[0].includes("site/"), "the export folder itself is never rewritten (no loop)");
  } finally { globalThis.fetch = realFetch; }
});

test("health check: clean run; a 404 page is broken (DSN payload titled exactly); a dead image is broken; a stale export is only a warning; dry-run posts nothing", async () => {
  const good = { slug: "services", page_type: "site", published_revision: 2, published_content: { blocks: [{ type: "hero", image: "https://web.test/hero.jpg" }] } };
  const gone = { slug: "gone", page_type: "landing", published_revision: 1, published_content: { blocks: [] } };
  const deadImage = { slug: "pics", page_type: "site", published_revision: 1, published_content: { blocks: [{ type: "gallery", items: [{ image: "https://web.test/missing.jpg" }] }] } };
  const ad = { slug: "dog-training-toledo-oh", page_type: "ad", published_revision: 1, published_content: {} };
  const answers = { "/services": 200, "/p/services": 200, "/p/pics": 200, "/pics": 200, "/ads/dog-training-toledo-oh": 200, "/hero.jpg": 200 };
  const fetchImpl = async (url, options = {}) => { const u = new URL(url); const s = answers[u.pathname] ?? 404; return new Response("<html>", { status: s, headers: s === 200 && !/\.jpg$/.test(u.pathname) ? { "x-ldtt-page-type": "site" } : {} }); };
  const exportIndex = { exported_at: "x", pages: [{ slug: "services", revision: 1, html_sha256: "a" }, { slug: "pics", revision: 1, html_sha256: "a" }, { slug: "dog-training-toledo-oh", revision: 1, html_sha256: "a" }] };
  const report = await durability.runSiteHealth({ pages: [good, gone, deadImage, ad], base: "https://web.test", fetchImpl, exportIndex, renderHash: async () => "a" });
  assert.equal(report.ok, false);
  assert.deepEqual(report.broken.map(b => b.slug), ["gone", "pics"]);
  assert.match(report.broken[0].problems.join(" "), /clean path \/gone: HTTP 404/);
  assert.match(report.broken[0].problems.join(" "), /\/p\/ path \/p\/gone: HTTP 404/);
  assert.match(report.broken[1].problems.join(" "), /image https:\/\/web.test\/missing.jpg: HTTP 404/);
  assert.deepEqual(report.stale.map(s => s.slug), ["services"]);
  assert.match(report.stale[0].warnings[0], /export file is revision 1, database is 2/);
  const payload = durability.dsnApprovalPayload(report.broken[0], { base: "https://web.test", ranAt: report.ran_at });
  assert.equal(payload.title, "LDTT: page gone is not serving"); assert.equal(payload.type, "other"); assert.equal(payload.product_id, "bb51502e-eb05-4919-82ce-ed5a39a8d609");
  assert.match(payload.body, /HTTP 404/);
  const clean = await durability.runSiteHealth({ pages: [good, ad], base: "https://web.test", fetchImpl, exportIndex: { pages: [{ slug: "services", revision: 2, html_sha256: "a" }, { slug: "dog-training-toledo-oh", revision: 1, html_sha256: "a" }] }, renderHash: async () => "a" });
  assert.equal(clean.ok, true); assert.equal(clean.stale.length, 0); assert.equal(clean.pages[0].export, "matches");

  // The cron: forbidden without the secret; dry-run returns payloads and writes nothing; a real run writes site_health + audit, and posts to DSN only when broken.
  process.env.CRON_SECRET = "s3";
  const rows = [{ id: randomUUID(), slug: "gone", page_type: "site", status: "published", published_revision: 1, published_content: { blocks: [] } }];
  const w = world({ rows });
  const dsn = [];
  const inner = w.fetch;
  w.fetch = async (url, options = {}) => { const u = new URL(url); if (u.hostname === "dsn-command.vercel.app") { dsn.push(JSON.parse(options.body)); return json(200, { ok: true }); } if (u.hostname === "site.test") return new Response("", { status: 404 }); return inner(url, options); };
  healthCron.deps.fetch = w.fetch;
  const forbidden = res(); await healthCron({ headers: {}, query: {} }, forbidden); assert.equal(forbidden.statusCode, 403);
  const dry = res(); await healthCron({ headers: { authorization: "Bearer s3" }, query: { dry: "1", base: "https://site.test" } }, dry);
  const d = JSON.parse(dry.body);
  assert.equal(d.ok, false); assert.equal(d.dryRun, true); assert.equal(d.dsn_payloads[0].title, "LDTT: page gone is not serving"); assert.equal(dsn.length, 0); assert.equal(w.db.site_settings.length, 0);
  process.env.DSN_AGENT_TOKEN = "t";
  const real = res(); await healthCron({ headers: { "x-vercel-cron": "1" }, query: { base: "https://site.test" } }, real);
  const rr = JSON.parse(real.body);
  assert.equal(rr.ok, false); assert.equal(dsn.length, 1); assert.equal(dsn[0].title, "LDTT: page gone is not serving");
  assert.equal(w.db.site_settings.find(s => s.key === "site_health").value.broken[0].slug, "gone");
  assert.equal(w.db.audit_events[0].action, "site_page_broken");
  delete process.env.DSN_AGENT_TOKEN;
});

test("the studio's 'Where this page lives' data: addresses, export file, who/when, images with buckets, last health run", async () => {
  const page = { ...draftPage("services", `${OWN}/site/hero.jpg`), status: "published", published_revision: 2, published_at: "2026-09-05T01:02:03Z", published_content: { ...site.starter("services"), slug: "services", blocks: [{ type: "hero", image: `${OWN}/site/hero.jpg`, design: { bgImage: "assets/x.jpg" } }] } };
  const w = world({ rows: [page], settings: [{ key: "site_health", value: { ran_at: "2026-09-05T08:30:00Z", pages: [{ slug: "services", ok: true, problems: [], warnings: ["x"] }] } }] });
  w.db.ad_page_revisions.push({ id: randomUUID(), page_id: page.id, revision: 2, kind: "published", created_by: "Rachel Office", created_at: "2026-09-05T01:02:03Z" });
  const r = res(); await pagesApi({ method: "POST", headers: { authorization: "Bearer staff" }, body: { operation: "durability", id: page.id } }, r);
  const d = JSON.parse(r.body);
  assert.equal(d.url, "/services"); assert.equal(d.alt_url, "/p/services"); assert.equal(d.export_html, "site/pages/services.html");
  assert.equal(d.published_by, "Rachel Office"); assert.equal(d.revision, 2); assert.equal(d.schema, "public"); assert.equal(d.bucket, "trainer-page-assets");
  assert.deepEqual(d.images.map(i => i.bucket), ["trainer-page-assets", "site file (repo)"]);
  assert.equal(d.health.ok, true); assert.equal(d.health.ran_at, "2026-09-05T08:30:00Z");
});
