// Serves a published Page Studio / Site Builder page from the database.
//
//   /ads/<slug>            ad landing pages (vercel.json rewrite)
//   /p/<slug>              any page type (vercel.json rewrite)
//   /<slug>                site + landing pages at their clean path: middleware.js
//                          rewrites here ONLY when the slug is in the published
//                          manifest (api/pages-manifest.js), so a static file
//                          such as about.html keeps winning until the office
//                          publishes its Site Builder twin, and comes straight
//                          back after Unpublish.
//   ?preview=1 + staff bearer token   draft, never cached
//
// Renders published_content through the SAME template as the static pages
// (lib/ad-page-template.js for ads, lib/site-page-template.js for the rest),
// so the head, Google Ads tag, Meta pixel, lead form and footer are identical.
// Anything that is not published answers 404 with a plain page. Nothing here
// ever writes. On the practice copy it reads the practice schema.

const { supabaseRequest } = require("../lib/sandbox");
const template = require("../lib/ad-page-template.js");
const site = require("../lib/site-page-template.js");
const imageAspects = require("../lib/ad-page-image-aspects.js");
const pagesApi = require("./pages.js");
const { verifyOfficeUser, deps: staffDeps } = pagesApi;

const SUPABASE_URL = process.env.SUPABASE_URL || "https://ptnzaeprvkgjgtupmcty.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";
const deps = { fetch: (...args) => staffDeps.fetch(...args) };

function notFound(res, message, status = 404) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  return res.status(status).send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Page not available | Lorenzo's Dog Training Team</title><style>body{font-family:Inter,Arial,sans-serif;background:#0b1220;color:#fff;display:grid;place-items:center;min-height:100vh;margin:0;text-align:center;padding:24px}h1{font-size:1.6rem}a{color:#ffd166}</style></head><body><div><h1>${template.escapeHtml(message)}</h1><p><a href="/">Go to lorenzosdogtrainingteam.com</a> or call <a href="tel:+18664364959">(866) 436-4959</a>.</p></div></body></html>`);
}

async function fetchRow(slug, columns) {
  const target = supabaseRequest(`/rest/v1/ad_pages?select=${columns}&slug=eq.${encodeURIComponent(slug)}&limit=1`);
  const response = await deps.fetch(`${SUPABASE_URL}${target.path}`, {
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, ...target.headers }
  });
  if (!response.ok) return null;
  const rows = await response.json().catch(() => []);
  return rows?.[0] || null;
}

async function render(row, content, { editor = false } = {}) {
  const type = pagesApi.pageTypeOf(row);
  const imageAspect = path => imageAspects[path] || null;
  if (type === "ad") return template.renderAdPage(content, { base: "/", publicPath: `/ads/${row.slug}`, imageAspect, editor });
  const [theme, nav, data] = await Promise.all([pagesApi.siteTheme(), pagesApi.siteNav(), pagesApi.loadData(content)]);
  return site.renderSitePage(content, { base: "/", publicPath: `/${row.slug}`, siteTheme: theme, navigation: nav, data, editor });
}

module.exports = async function handler(req, res) {
  const slug = template.safeSlug(req.query?.slug || "");
  if (!slug) return notFound(res, "That page address is not valid.");
  if (!SERVICE_ROLE_KEY) return notFound(res, "This page is temporarily unavailable.", 503);
  // Which entrance: /ads/ only serves ad pages; /p/ and clean paths only serve site/landing pages.
  const entrance = String(req.query?.via || "ads") === "ads" ? "ads" : "site";

  try {
    if (String(req.query?.preview || "") === "1") {
      const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
      const auth = await verifyOfficeUser(token);
      if (!auth) return notFound(res, "Sign in to the staff portal to preview a draft.", 403);
      const row = await fetchRow(slug, "id,slug,page_type,status,draft_content");
      if (!row?.draft_content || row.status === "archived") return notFound(res, "There is no draft at that address.");
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "no-store, max-age=0");
      res.setHeader("X-Robots-Tag", "noindex");
      return res.status(200).send(await render(row, row.draft_content));
    }

    const row = await fetchRow(slug, "slug,page_type,status,published_content,published_at");
    if (!row || row.status !== "published" || !row.published_content) return notFound(res, "This page is not published.");
    const type = pagesApi.pageTypeOf(row);
    if ((entrance === "ads") !== (type === "ad")) return notFound(res, "This page is not published.");
    const html = await render(row, row.published_content);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    // Short public cache: a publish shows within a minute everywhere, and the
    // edge keeps serving the last good copy while it revalidates.
    res.setHeader("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=600");
    res.setHeader("X-LDTT-Ad-Page", `published ${row.published_at || ""}`.trim());
    res.setHeader("X-LDTT-Page-Type", type);
    return res.status(200).send(html);
  } catch (error) {
    console.error("page render failed", error);
    return notFound(res, "This page is temporarily unavailable.", 503);
  }
};
module.exports.deps = deps;
