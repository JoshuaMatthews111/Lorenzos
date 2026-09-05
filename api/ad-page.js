// Serves a Page Studio ad landing page from the database: /ads/<slug>
// (vercel.json rewrites it here). Renders published_content through the SAME
// template as the static market pages, so the head, Google Ads tag, Meta
// pixel, lead form and footer are identical to the generated files.
//
//   GET /api/ad-page?slug=dog-training-toledo-oh            public, cached briefly
//   GET /api/ad-page?slug=...&preview=1  + staff bearer token  draft, never cached
//
// Anything that is not published answers 404 with a plain page. Nothing here
// ever writes, so the sandbox rule (DO-NOT-BREAK #5) does not apply; on the
// sandbox the preview also sees practice-layer drafts.

const { isSandbox } = require("../lib/sandbox");
const sandboxStore = require("../lib/sandbox-store");
const template = require("../lib/ad-page-template.js");
const imageAspects = require("../lib/ad-page-image-aspects.js");
const { verifyOfficeUser, deps: staffDeps } = require("./ad-pages.js");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://ptnzaeprvkgjgtupmcty.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";
const deps = { fetch: (...args) => staffDeps.fetch(...args) };

function notFound(res, message, status = 404) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  return res.status(status).send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Page not available | Lorenzo's Dog Training Team</title><style>body{font-family:Inter,Arial,sans-serif;background:#0b1220;color:#fff;display:grid;place-items:center;min-height:100vh;margin:0;text-align:center;padding:24px}h1{font-size:1.6rem}a{color:#ffd166}</style></head><body><div><h1>${template.escapeHtml(message)}</h1><p><a href="/">Go to lorenzosdogtrainingteam.com</a> or call <a href="tel:+18664364959">(866) 436-4959</a>.</p></div></body></html>`);
}

async function fetchRow(slug, columns) {
  const response = await deps.fetch(`${SUPABASE_URL}/rest/v1/ad_pages?select=${columns}&slug=eq.${encodeURIComponent(slug)}&limit=1`, {
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` }
  });
  if (!response.ok) return null;
  const rows = await response.json().catch(() => []);
  return rows?.[0] || null;
}

module.exports = async function handler(req, res) {
  const slug = template.safeSlug(req.query?.slug || "");
  if (!slug) return notFound(res, "That page address is not valid.");
  if (!SERVICE_ROLE_KEY) return notFound(res, "This page is temporarily unavailable.", 503);
  const imageAspect = path => imageAspects[path] || null;

  try {
    if (String(req.query?.preview || "") === "1") {
      const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
      const auth = await verifyOfficeUser(token);
      if (!auth) return notFound(res, "Sign in to the staff portal to preview a draft.", 403);
      let row = await fetchRow(slug, "id,slug,status,draft_content");
      if (isSandbox()) {
        const ops = (await sandboxStore.readOps()).filter(op => op.entity_type === "ad_page");
        const rows = row ? [{ ...row }] : [];
        ops.forEach(op => {
          if (op.operation === "create" && op.record) rows.unshift({ ...op.record });
          if (op.operation === "update") { const hit = rows.find(r => String(r.id) === String(op.id)); if (hit) Object.assign(hit, op.changes || {}); }
        });
        row = rows.find(r => r.slug === slug && r.status !== "archived") || null;
      }
      if (!row?.draft_content) return notFound(res, "There is no draft at that address.");
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "no-store, max-age=0");
      res.setHeader("X-Robots-Tag", "noindex");
      return res.status(200).send(template.renderAdPage(row.draft_content, { base: "/", publicPath: `/ads/${slug}`, imageAspect }));
    }

    const row = await fetchRow(slug, "slug,status,published_content,published_at");
    if (!row || row.status !== "published" || !row.published_content) return notFound(res, "This page is not published.");
    const html = template.renderAdPage(row.published_content, { base: "/", publicPath: `/ads/${slug}`, imageAspect });
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    // Short public cache: a publish shows within a minute everywhere, and the
    // edge keeps serving the last good copy while it revalidates.
    res.setHeader("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=600");
    res.setHeader("X-LDTT-Ad-Page", `published ${row.published_at || ""}`.trim());
    return res.status(200).send(html);
  } catch (error) {
    console.error("ad-page render failed", error);
    return notFound(res, "This page is temporarily unavailable.", 503);
  }
};
module.exports.deps = deps;
