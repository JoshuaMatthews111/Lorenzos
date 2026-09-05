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

// ---------------------------------------------------------------------------
// In-memory Supabase: just enough PostgREST for these two routes.
// ---------------------------------------------------------------------------
const db = { ad_pages: [], ad_page_revisions: [], portal_users: [
  { user_id: "local-office", role: "admin", permission_level: "super_admin", active: true, access_status: "active", email: "office@local.test", display_name: "Local Office", first_name: "Local", last_name: "Office" }
] };
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
  const table = u.pathname.replace("/rest/v1/", "");
  if (!db[table]) return json(404, { message: `Could not find the table 'public.${table}'` });
  const body = options.body ? JSON.parse(options.body) : null;
  if (method === "GET") return json(200, applyFilters(db[table], u.searchParams));
  if (method === "POST") {
    const rows = (Array.isArray(body) ? body : [body]).map(row => ({ id: randomUUID(), created_at: new Date().toISOString(), updated_at: new Date().toISOString(), draft_revision: 1, published_revision: 0, published_at: null, ...row }));
    if (table === "ad_pages" && rows.some(r => db.ad_pages.some(x => x.slug === r.slug))) return json(409, { message: "duplicate key value violates unique constraint" });
    db[table].push(...rows);
    return json(201, rows);
  }
  if (method === "PATCH") {
    const targets = applyFilters(db[table], u.searchParams);
    targets.forEach(row => Object.assign(row, body, { updated_at: new Date().toISOString() }));
    return json(200, targets);
  }
  return json(405, { message: "nope" });
}
adPages.deps.fetch = fakeSupabase;

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
