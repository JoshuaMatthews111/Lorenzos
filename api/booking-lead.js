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
    const setting = B.trainerForZip(intake.value.zip, settings);
    const trainer = setting ? await B.trainerRow(setting.slug) : null;
    const routed = setting && trainer ? setting : null;
    const { lead, reused } = await B.createLead({ intake: intake.value, setting: routed, trainer, via: "booking-lead" });
    const slug = routed ? routed.slug : null;
    return res.status(200).json({
      ok: true,
      lead_id: lead.id,
      trainer_slug: slug,
      trainer_name: trainer?.full_name || null,
      book_url: slug ? B.bookUrl(slug, lead.id) : null,
      duplicate: reused || undefined,
      message: slug
        ? `Thanks, ${intake.value.first_name}! Pick a time for your free evaluation with ${trainer.full_name}.`
        : `Thanks, ${intake.value.first_name}! Our office will call you to set up your free evaluation.`
    });
  } catch (error) {
    console.error("booking_lead_failed", String(error?.message || error));
    return res.status(500).json({ ok: false, message: "We could not save your request. Please call us at (866) 436-4959." });
  }
};
