// The list of PUBLISHED Site Builder pages that own a clean path (/about,
// /services …). middleware.js fetches this (edge-cached for 60 s) and only
// rewrites a request to the page route when its path is in the list, so:
//   - a static file (about.html) keeps serving until its Site Builder twin is
//     published, and serves again the moment it is unpublished;
//   - trainer pages and every other /<slug> are untouched;
//   - if this endpoint is slow or down, middleware lets the request through
//     unchanged (fail open to the static site).
// Ad pages are not listed: they live at /ads/<slug> through a plain rewrite.
// Read-only. On the practice copy it lists the practice schema.

const { supabaseRequest } = require("../lib/sandbox");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://ptnzaeprvkgjgtupmcty.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";
const deps = { fetch: (...args) => fetch(...args) };

async function publishedPaths() {
  const target = supabaseRequest("/rest/v1/ad_pages?select=slug,page_type,published_at&status=eq.published&page_type=in.(site,landing)&limit=500");
  const response = await deps.fetch(`${SUPABASE_URL}${target.path}`, { headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, ...target.headers } });
  if (!response.ok) return [];
  const rows = await response.json().catch(() => []);
  return (Array.isArray(rows) ? rows : []).filter(r => /^[a-z0-9-]{2,80}$/.test(String(r.slug || ""))).map(r => ({ slug: r.slug, page_type: r.page_type, published_at: r.published_at }));
}

module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  if (!SERVICE_ROLE_KEY) { res.setHeader("Cache-Control", "no-store"); return res.status(200).json({ ok: false, paths: [] }); }
  try {
    const pages = await publishedPaths();
    res.setHeader("Cache-Control", "public, max-age=30, s-maxage=60, stale-while-revalidate=300");
    return res.status(200).json({ ok: true, paths: pages.map(p => p.slug), pages });
  } catch (error) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ ok: false, paths: [] });
  }
};
module.exports.deps = deps;
module.exports.publishedPaths = publishedPaths;
