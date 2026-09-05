// Local proof server for Page Studio. NOT deployed (scripts/ is in .vercelignore).
//
//   node scripts/page-studio-local.mjs            → http://localhost:4173
//
// Serves the site + portal from this checkout and mounts the two Page Studio
// API routes against an IN-MEMORY stand-in for the Supabase tables, so the
// whole flow (new page → edit → publish → /ads/<slug>) can be exercised
// without a database, a login, or a deploy. It sets a local bearer token on
// API calls, which the in-memory auth answers as a Super Admin office user.
// Nothing here talks to the real Supabase project.
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { resolve, extname, join } from "node:path";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";

const require = createRequire(import.meta.url);
const root = resolve(import.meta.dirname, "..");
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "local-stand-in-key";
process.env.SUPABASE_URL = "http://supabase.local";
process.env.LDTT_SANDBOX = process.env.LDTT_SANDBOX || "";
const adPages = require("../api/ad-pages.js");
const adPage = require("../api/ad-page.js");
const environment = require("../api/environment.js");
// send-to-live: the practice → live draft copy, proven here against TWO
// in-memory schemas (public and practice) picked by the PostgREST profile
// headers exactly as the real project does. Start with LDTT_SANDBOX=1 to see
// the practice side; GET /__local/sandbox?on=0 flips the same process to
// "live" so the "From practice copy" tag can be seen on the rows that arrived.
const sendToLive = require("../api/send-to-live.js");
const practiceReset = require("../api/practice-reset.js");

// ---------------------------------------------------------------------------
// In-memory Supabase: just enough PostgREST for these two routes.
// ---------------------------------------------------------------------------
const officeUser = { user_id: "local-office", role: "admin", permission_level: "super_admin", active: true, access_status: "active", email: "office@local.test", display_name: "Local Office", first_name: "Local", last_name: "Office" };
const blank = () => ({ ad_pages: [], ad_page_revisions: [], trainers: [], trainer_pages: [], trainer_page_versions: [], portal_users: [{ ...officeUser }], send_to_live_log: [] });
const schemas = { public: blank(), practice: blank() };
// `db` is the live side; the practice side is a full copy of it (like practice.reset_from_live()).
const db = schemas.public;
const copied = [];
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function applyFilters(rows, params) {
  let out = rows;
  for (const [key, raw] of params) {
    if (["select", "order", "limit"].includes(key)) continue;
    const [op, ...rest] = raw.split("."); const value = rest.join(".");
    if (op === "eq") out = out.filter(r => String(r[key]) === value);
    if (op === "neq") out = out.filter(r => String(r[key]) !== value);
  }
  const order = params.get("order");
  if (order) { const [col, dir] = order.split("."); out = [...out].sort((a, b) => (a[col] > b[col] ? 1 : -1) * (dir === "desc" ? -1 : 1)); }
  const limit = Number(params.get("limit") || 0);
  return limit ? out.slice(0, limit) : out;
}

async function fakeSupabase(url, options = {}) {
  const u = new URL(url);
  const method = (options.method || "GET").toUpperCase();
  const auth = String(options.headers?.Authorization || options.headers?.authorization || "");
  if (u.pathname === "/auth/v1/user") {
    return auth === "Bearer local-demo" ? json(200, { id: "local-office", email: "office@local.test" }) : json(401, { message: "bad token" });
  }
  if (u.pathname === "/storage/v1/object/copy") { copied.push(JSON.parse(options.body)); return json(200, { Key: "ok" }); }
  if (u.pathname === "/storage/v1/bucket") return json(200, [{ id: "practice-trainer-page-assets" }, { id: "trainer-page-assets" }]);
  if (u.pathname.startsWith("/storage/v1/object/list/")) return json(200, []);
  // Which in-memory schema: the profile header, else the deployment's default.
  const profile = options.headers?.["Accept-Profile"] || options.headers?.["Content-Profile"] || (process.env.LDTT_SANDBOX === "1" ? "practice" : "public");
  const store = schemas[profile] || schemas.public;
  const table = u.pathname.replace("/rest/v1/", "");
  if (table === "rpc/reset_from_live") { Object.assign(schemas.practice, JSON.parse(JSON.stringify(schemas.public)), { send_to_live_log: [] }); return json(200, { reset_at: new Date().toISOString(), rows: {} }); }
  if (!store[table]) return json(404, { message: `Could not find the table '${profile}.${table}'` });
  const body = options.body ? JSON.parse(options.body) : null;
  if (method === "GET") return json(200, applyFilters(store[table], u.searchParams));
  if (method === "POST") {
    const rows = (Array.isArray(body) ? body : [body]).map(row => ({ id: randomUUID(), created_at: new Date().toISOString(), updated_at: new Date().toISOString(), draft_revision: 1, published_revision: 0, published_at: null, ...row }));
    if (table === "ad_pages" && rows.some(r => store.ad_pages.some(x => x.slug === r.slug))) return json(409, { message: "duplicate key value violates unique constraint" });
    store[table].push(...rows);
    return json(201, rows);
  }
  if (method === "PATCH") {
    const targets = applyFilters(store[table], u.searchParams);
    targets.forEach(row => Object.assign(row, body, { updated_at: new Date().toISOString() }));
    return json(200, targets);
  }
  return json(405, { message: "nope" });
}
adPages.deps.fetch = fakeSupabase;
sendToLive.deps.fetch = fakeSupabase;
practiceReset.deps.fetch = fakeSupabase;
// A live trainer + page so the demo trainer editor (offline roster data) has a
// live row to send to, matched by slug.
db.trainers.push({ id: randomUUID(), slug: "karemela-sefferin", full_name: "Karemela Sefferin", status: "active", access_status: "active", created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
db.trainer_pages.push({ id: randomUUID(), trainer_id: db.trainers[0].id, slug: "karemela-sefferin", page_status: "published", locked: true, revision: 2, published_revision: 2, headline: "Live headline", draft_content: { trainer_name: "Karemela Sefferin" }, published_content: { trainer_name: "Karemela Sefferin" }, style_settings: {}, section_order: ["hero"], created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
// The practice copy starts as a full copy of live.
Object.assign(schemas.practice, JSON.parse(JSON.stringify(schemas.public)), { send_to_live_log: [] });

// ---------------------------------------------------------------------------
// Tiny Vercel-style req/res shim + static files (cleanUrls) + the rewrite.
// ---------------------------------------------------------------------------
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml", ".mp4": "video/mp4", ".pdf": "application/pdf", ".ico": "image/x-icon", ".woff2": "font/woff2" };

function shimRes(res) {
  const out = { statusCode: 200, headers: {} };
  const api = {
    setHeader: (k, v) => { out.headers[k] = v; return api; },
    status: code => { out.statusCode = code; return api; },
    json: body => { out.headers["content-type"] = out.headers["content-type"] || "application/json"; res.writeHead(out.statusCode, out.headers); res.end(JSON.stringify(body)); return api; },
    send: body => { res.writeHead(out.statusCode, out.headers); res.end(body); return api; },
    end: body => { res.writeHead(out.statusCode, out.headers); res.end(body); return api; }
  };
  return api;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  let path = decodeURIComponent(url.pathname);
  const chunks = []; for await (const c of req) chunks.push(c);
  const rawBody = Buffer.concat(chunks).toString("utf8");
  const call = async (handler, query, { forceAuth = true } = {}) => {
    const request = { method: req.method, headers: { ...req.headers }, query: Object.fromEntries(query), body: rawBody ? JSON.parse(rawBody) : {} };
    if (forceAuth && !String(request.headers.authorization || "").replace(/^Bearer\s*/i, "").trim()) request.headers.authorization = "Bearer local-demo";
    return handler(request, shimRes(res));
  };
  if (path === "/api/ad-pages") return call(adPages, url.searchParams);
  if (path === "/api/send-to-live") return call(sendToLive, url.searchParams);
  if (path === "/api/practice-reset") return call(practiceReset, url.searchParams);
  if (path === "/__local/sandbox") { process.env.LDTT_SANDBOX = url.searchParams.get("on") === "1" ? "1" : ""; res.writeHead(200, { "content-type": "application/json" }); return res.end(JSON.stringify({ sandbox: process.env.LDTT_SANDBOX === "1" })); }
  if (path === "/__local/state") { res.writeHead(200, { "content-type": "application/json" }); return res.end(JSON.stringify({ sandbox: process.env.LDTT_SANDBOX === "1", copied, live: { ad_pages: schemas.public.ad_pages, trainer_pages: schemas.public.trainer_pages, trainers: schemas.public.trainers }, practice: { ad_pages: schemas.practice.ad_pages, trainer_pages: schemas.practice.trainer_pages, trainers: schemas.practice.trainers, send_to_live_log: schemas.practice.send_to_live_log } })); }
  if (path === "/api/ad-page") return call(adPage, url.searchParams, { forceAuth: url.searchParams.get("preview") === "1" });
  if (path === "/api/environment") return call(environment, url.searchParams, { forceAuth: false });
  const ads = path.match(/^\/ads\/([^/]+)$/);
  if (ads) return call(adPage, new URLSearchParams({ slug: ads[1] }), { forceAuth: false });
  if (path.startsWith("/api/")) { res.writeHead(404, { "content-type": "application/json" }); return res.end(JSON.stringify({ ok: false, message: "not mounted locally" })); }
  // static + cleanUrls
  if (path.endsWith("/")) path += "index.html";
  let file = join(root, path);
  if (!existsSync(file) && existsSync(`${file}.html`)) file = `${file}.html`;
  if (!existsSync(file) || statSync(file).isDirectory()) { res.writeHead(404); return res.end("not found"); }
  res.writeHead(200, { "content-type": MIME[extname(file)] || "application/octet-stream", "cache-control": "no-store" });
  res.end(readFileSync(file));
});

const port = Number(process.env.PORT || 4173);
server.listen(port, () => console.log(`Page Studio local proof server: http://localhost:${port}/trainer-backoffice/  (login admin / demo password)`));
