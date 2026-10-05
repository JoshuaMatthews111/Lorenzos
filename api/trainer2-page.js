// Trainer 2.0 landing page (paid add-on, 2026-10-05). DO-NOT-BREAK rule 169.
//
//   /trainer/<slug>  (vercel.json rewrite -> /api/trainer2-page?slug=<slug>)
//
// Draws a PUBLISHED entry of lib/trainer2-pages.js with lib/trainer2-page-template.js. Anything else answers 404.
// Reads nothing from the database and never writes. The practice copy draws the same page without the Meta pixel
// or Google tag (no test lead may reach the ad accounts) and with a PRACTICE COPY pill, never indexed.
const { isSandbox } = require("../lib/sandbox");
const PAGES = require("../lib/trainer2-pages");
const { renderTrainer2Page } = require("../lib/trainer2-page-template");
const { escapeHtml } = require("../lib/ad-page-template");

function notFound(res) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("X-Robots-Tag", "noindex");
  return res.status(404).send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Page not available | Lorenzo's Dog Training Team</title><style>body{font-family:Poppins,Arial,sans-serif;background:#011731;color:#fff;display:grid;place-items:center;min-height:100vh;margin:0;text-align:center;padding:24px}a{color:#ffd166}</style></head><body><div><h1>${escapeHtml("This page is not available.")}</h1><p><a href="/">Go to lorenzosdogtrainingteam.com</a> or call <a href="tel:+18664364959">(866) 436-4959</a>.</p></div></body></html>`);
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return res.status(405).send("Use GET.");
  }
  const page = PAGES.pageFor(req.query?.slug);
  if (!page) return notFound(res);
  const practice = isSandbox();
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  if (practice) {
    res.setHeader("Cache-Control", "no-store, max-age=0");
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
  } else {
    // The page is drawn from code only, so the edge can keep it; a deploy replaces it.
    res.setHeader("Cache-Control", "public, max-age=0, s-maxage=600, stale-while-revalidate=86400");
  }
  return res.status(200).send(renderTrainer2Page(page, { practice }));
};
