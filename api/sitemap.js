// sitemap.xml = the static sitemap.xml + every published Site Builder page
// (site/landing at its clean path, ads at /ads/<slug>). middleware.js rewrites
// /sitemap.xml here; if this fails the static file is served instead.
const { readFileSync, existsSync } = require("node:fs");
const { resolve } = require("node:path");
const { supabaseRequest } = require("../lib/sandbox");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://ptnzaeprvkgjgtupmcty.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";
const ORIGIN = "https://www.lorenzosdogtrainingteam.com";
const deps = { fetch: (...args) => fetch(...args) };

function staticSitemap() {
  const file = resolve(__dirname, "..", "sitemap.xml");
  return existsSync(file) ? readFileSync(file, "utf8") : `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${ORIGIN}/</loc></url>\n</urlset>`;
}

async function publishedRows() {
  const target = supabaseRequest("/rest/v1/ad_pages?select=slug,page_type,published_at,published_content&status=eq.published&limit=500");
  const response = await deps.fetch(`${SUPABASE_URL}${target.path}`, { headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, ...target.headers } });
  if (!response.ok) return [];
  const rows = await response.json().catch(() => []);
  return (Array.isArray(rows) ? rows : []).filter(r => /^[a-z0-9-]{2,80}$/.test(String(r.slug || "")) && !(r.published_content?.seo?.noindex === true));
}

function merge(xml, rows) {
  const have = new Set([...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]));
  const extra = rows.map(r => `${ORIGIN}${r.page_type === "ad" || !r.page_type ? `/ads/${r.slug}` : `/${r.slug}`}`).filter(loc => { if (have.has(loc)) return false; have.add(loc); return true; })
    .map(loc => `  <url><loc>${loc}</loc></url>`);
  if (!extra.length) return xml;
  return xml.replace(/\s*<\/urlset>\s*$/, `\n${extra.join("\n")}\n</urlset>\n`);
}

module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  try {
    const rows = SERVICE_ROLE_KEY ? await publishedRows() : [];
    res.setHeader("Cache-Control", "public, max-age=300, s-maxage=600, stale-while-revalidate=3600");
    return res.status(200).send(merge(staticSitemap(), rows));
  } catch (error) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(staticSitemap());
  }
};
module.exports.deps = deps;
module.exports.merge = merge;
