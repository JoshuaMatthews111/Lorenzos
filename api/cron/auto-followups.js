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
    // 2026-09-24: a run that stopped part-way (its time budget, or the function was killed) is carried on
    // by a later tick - see REENGAGE_BUDGET_MS in lib/pipeline.js; vercel.json gives this function 800 s.
    const reengage = await P.runReengageBatch()
      .catch(error => ({ armed: false, message: `re-engage check failed: ${String(error?.message || error)}` }));
    if (reengage.ran) console.log("reengage_batch_run", JSON.stringify({ column: reengage.column, walked: reengage.walked, sent: reengage.sent, texts: reengage.texts_sent, emails: reengage.emails_sent, emails_failed: reengage.emails_failed, already_done: reengage.already_done, resumed: reengage.resumed, stopped_early: reengage.stopped_early, remaining: reengage.remaining, interrupted: (reengage.interrupted || []).length }));
    // Zoom 2026-09-24 (built 2026-09-25): the trainer's "call your client" reminder, 30 minutes after a booking,
    // ONE text per lead, only while "I called the client" is not checked off. Behind its own switch
    // (trainer_call_reminders, default OFF): off = a one-line no-op. A failure here never stops the rest.
    const callReminders = await P.runTrainerCallReminders()
      .catch(error => ({ on: false, message: `call reminders failed: ${String(error?.message || error)}` }));
    if (callReminders.on) console.log("trainer_call_reminders_run", JSON.stringify({ checked: callReminders.checked, sent: callReminders.sent?.length || 0, skipped: callReminders.skipped?.length || 0 }));
    // Zoom 2026-09-24: ONE "Office's turn" email a day (switch office_turn_digest, default OFF; no per-lead email).
    const officeTurn = await P.runOfficeTurnDigest()
      .catch(error => ({ on: false, message: `office's-turn digest failed: ${String(error?.message || error)}` }));
    if (officeTurn.ran) console.log("office_turn_digest_run", JSON.stringify({ day: officeTurn.last_date, leads: officeTurn.leads, email: officeTurn.email?.status }));
    return res.status(200).json({ ok: true, ...result, reengage, call_reminders: callReminders, office_turn: officeTurn });
  } catch (error) {
    console.error("auto_followups_failed", String(error?.message || error));
    return res.status(500).json({ ok: false, message: "The automatic follow-up run failed." });
  }
};
