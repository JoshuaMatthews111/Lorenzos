// Automatic follow-up texts (Joshua 2026-09-23).
//
// Runs every 15 minutes and asks lib/pipeline.js runAutoFollowUps to fire any
// follow-up text that has come due: Lorenzo's follow-up 15 minutes after a lead
// entered the pipeline, the booking link again at 30 minutes, and the
// "Office will call you" care text at 24 hours.
//
// Everything that decides WHO can receive a text lives in lib/pipeline.js
// sendFollowUpText and is unchanged: the practice copy texts only active tester
// phones, consent is rechecked, and the whole engine is behind the
// "Automatic follow-ups" switch in Sales pipeline Settings (default OFF).
// A step is claimed on the lead before it is sent (version-guarded), so a
// double cron run - or the cron racing an office button press - can never send
// the same text twice.

const P = require("../../lib/pipeline");

const CRON_SECRET = process.env.CRON_SECRET || "";

function authorized(req) {
  // Vercel stamps its own scheduled calls; a shared secret covers manual runs.
  // Same trust rule as api/cron/archive-leads.js: Vercel strips a spoofed
  // x-vercel-cron header from outside requests.
  if (req.headers["x-vercel-cron"]) return true;
  const bearer = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  return Boolean(CRON_SECRET) && bearer === CRON_SECRET;
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!authorized(req)) return res.status(403).json({ ok: false, message: "Forbidden." });
  try {
    const result = await P.runAutoFollowUps();
    console.log("auto_followups_run", JSON.stringify({ on: result.on, checked: result.checked, sent: result.sent?.length || 0, skipped: result.skipped?.length || 0 }));
    // Joshua 2026-09-23: the same cadence checks the one-shot re-engage batch (site_settings key
    // "reengage_batch"). Not armed (the normal state) = a one-line no-op. It disarms itself after a run.
    const reengage = await P.runReengageBatch()
      .catch(error => ({ armed: false, message: `re-engage check failed: ${String(error?.message || error)}` }));
    if (reengage.ran) console.log("reengage_batch_run", JSON.stringify({ column: reengage.column, walked: reengage.walked, sent: reengage.sent, texts: reengage.texts_sent, emails: reengage.emails_sent }));
    return res.status(200).json({ ok: true, ...result, reengage });
  } catch (error) {
    console.error("auto_followups_failed", String(error?.message || error));
    return res.status(500).json({ ok: false, message: "The automatic follow-up run failed." });
  }
};
