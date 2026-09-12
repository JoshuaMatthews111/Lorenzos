// One pipeline, one door (portal chain step 2, Joshua 2026-09-12, DO-NOT-BREAK rule 71).
// PRACTICE COPY ONLY this round: answers 404 on live, before anything else.
//
// POST JSON {first_name,last_name,phone,email,zip,problem,dog_name,sms_consent,source_page}
//   -> {ok:true, lead_id, trainer_slug, trainer_name, book_url, message}
// trainer_slug null = no trainer serves that ZIP yet: the office follows up, no booking link.
// On the practice copy the lead lands in practice.leads (rule 20: never a real lead).
// CORS: the 2.0 ad pages (https://ldtt-ads-v2-sandbox.vercel.app) call it cross-origin.
const { isSandbox } = require("../lib/sandbox");
const B = require("../lib/booking");
const P = require("../lib/pipeline");

module.exports = async function handler(req, res) {
  if (!isSandbox()) return res.status(404).json({ ok: false, message: "Not found." });
  B.applyCors(req, res, "POST, OPTIONS");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, message: "Use POST." });

  let body;
  try { body = B.readBody(req); } catch { return res.status(400).json({ ok: false, message: "The form could not be read. Please try again." }); }
  const intake = B.cleanLeadIntake(body);
  if (intake.errors.length) return res.status(400).json({ ok: false, message: intake.errors.join(" "), errors: intake.errors });

  try {
    const settings = await B.loadSettings();
    // Step 3c (rule 74): the 50-mile radius from each trainer's Base ZIP. The nearest trainer WITH a calendar
    // is assigned; if only trainers without a calendar are near, the link still works (the client picks a
    // trainer on the page). Nobody within 50 miles = trainer_slug null, no link, office follow-up.
    const route = await B.routeZip(intake.value.zip, settings);
    const setting = route.calendar;
    const trainer = setting ? await B.trainerRow(setting.slug) : null;
    const routed = setting && trainer ? setting : null;
    const { lead, reused } = await B.createLead({ intake: intake.value, setting: routed, trainer, via: "booking-lead" });
    const slug = routed ? routed.slug : (route.nearest?.slug || null);
    // Step 3 (rule 72): the same pipeline every source enters. SMS consent + a trainer for the ZIP ->
    // Make pathway 1 (booking-link text, tester phones only). A double submit never texts twice (reused,
    // and enterPipeline claims before it sends). Never fails the request: the lead is already saved.
    if (!reused) {
      await P.enterPipeline(lead.id, { via: "booking-lead" })
        .catch(error => console.error("pipeline_enter_failed", String(error?.message || error)));
    }
    return res.status(200).json({
      ok: true,
      lead_id: lead.id,
      trainer_slug: slug,
      trainer_name: trainer?.full_name || null,
      book_url: slug ? B.bookUrl(slug, lead.id) : null,
      duplicate: reused || undefined,
      message: routed
        ? `Thanks, ${intake.value.first_name}! Pick a time for your free evaluation with ${trainer.full_name}.`
        : slug
          ? `Thanks, ${intake.value.first_name}! Pick your trainer for your free evaluation.`
          : `Thanks, ${intake.value.first_name}! Our office will call you to set up your free evaluation.`
    });
  } catch (error) {
    console.error("booking_lead_failed", String(error?.message || error));
    return res.status(500).json({ ok: false, message: "We could not save your request. Please call us at (866) 436-4959." });
  }
};
