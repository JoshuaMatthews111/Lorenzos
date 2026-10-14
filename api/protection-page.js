// /protection/<slug> — Protection Training landing pages (Joshua 2026-10-14). Six markets only
// (lib/protection-pages.js MARKETS); any other slug is a plain 404. Drawn from code, so the edge may cache.
const { isSandbox } = require("../lib/sandbox");
const P = require("../lib/protection-pages");

module.exports = async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return res.status(405).send("Use GET.");
  }
  const slug = String(req.query?.slug || "").toLowerCase();
  const practice = isSandbox();
  const page = P.renderProtectionPage(slug, { practice });
  if (!page) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(404).send('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Page not found</title></head><body style="font-family:Arial;padding:40px;text-align:center"><h1>Page not found</h1><p><a href="/">Lorenzo&#39;s Dog Training Team</a></p></body></html>');
  }
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  if (practice) {
    res.setHeader("Cache-Control", "no-store, max-age=0");
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
  } else {
    res.setHeader("Cache-Control", "public, max-age=0, s-maxage=600, stale-while-revalidate=86400");
  }
  return res.status(200).send(page);
};
