// /book and /book/<trainer_slug>?lead=<id>&zip=<zip> (vercel.json rewrites). Serves LIVE since the
// 2026-09-23 go-live; the PRACTICE COPY bar shows only on the practice copy (rule 96). The page itself is lib/booking-page.js; its data comes from /api/booking.
// Rule 74: every entry lands on step 1 ("Enter your ZIP code"), ZIP pre-filled from the lead or ?zip=.
// Rule 75: step 2's questions are the PUBLISHED "Booking page questions" from the form editor (the original
// 11 when nothing was changed, or when the settings row cannot be read).
const { isSandbox } = require("../lib/sandbox");
const { renderBookingPage } = require("../lib/booking-page");
const B = require("../lib/booking");
const LF = require("../lib/lead-forms");

module.exports = async function handler(req, res) {
  // GO-LIVE 2026-09-23 (Joshua): this route now serves LIVE too. Every table call still goes through the
  // schema switch (rule 5), so the practice copy keeps writing practice.* while live writes public.*.
  const slug = String(req.query?.slug || "").trim().toLowerCase();
  if (slug && !/^[a-z0-9-]{2,80}$/.test(slug)) return res.status(404).send("Not found");
  const form = await LF.loadPublishedFields(B.sbOrThrow, "booking_eval");
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  // Rule 96: the PRACTICE COPY bar is the website saying where you are — only the practice copy wears it.
  return res.status(200).send(renderBookingPage(slug, { practice: isSandbox(), form }));
};
