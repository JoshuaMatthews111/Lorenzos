// /book and /book/<trainer_slug>?lead=<id>&zip=<zip> (vercel.json rewrites). PRACTICE COPY ONLY this round:
// answers 404 on live. The page itself is lib/booking-page.js; its data comes from /api/booking.
// Rule 74: every entry lands on step 1 ("Enter your ZIP code"), ZIP pre-filled from the lead or ?zip=.
const { isSandbox } = require("../lib/sandbox");
const { renderBookingPage } = require("../lib/booking-page");

module.exports = function handler(req, res) {
  if (!isSandbox()) return res.status(404).send("Not found");
  const slug = String(req.query?.slug || "").trim().toLowerCase();
  if (slug && !/^[a-z0-9-]{2,80}$/.test(slug)) return res.status(404).send("Not found");
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  return res.status(200).send(renderBookingPage(slug, { practice: true }));
};
