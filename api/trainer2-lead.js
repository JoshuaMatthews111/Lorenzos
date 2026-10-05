// Trainer 2.0 landing page lead door (paid add-on, 2026-10-05). DO-NOT-BREAK rule 169.
//
// POST /api/trainer2-lead?page=<slug>  JSON {first_name,last_name,phone,email,address,city,state,zip,problem,dog_name,sms_consent,utm_*}
//   -> {ok:true, lead_id, trainer_slug, trainer_name, book_url, message}
//
// The same door as /api/booking-lead (lib/booking.js cleanLeadIntake + createLead, then lib/pipeline.js enterPipeline),
// with ONE difference: the trainer is fixed by the page, on the server. Whatever the browser sends as trainer_slug,
// assigned_trainer or source_page is replaced, so a lead from /trainer/<slug> always belongs to that trainer:
//   - leads.trainer_slug = the page's trainer, so the pipeline's "a trainer-page lead stays with ITS trainer" rule
//     (rule 72) routes it there and never hands it to another trainer by ZIP;
//   - source_page = https://www.lorenzosdogtrainingteam.com/trainer/<slug>, so the office sees exactly which page.
// The client is sent to /book/<trainer>?lead=<id>&direct=1 only when that trainer has a live calendar AND the ZIP is
// in their range (the booking page would otherwise show other trainers' cards). Otherwise the office calls.
// /api/booking-lead and every other door are untouched.
const B = require("../lib/booking");
const P = require("../lib/pipeline");
const PAGES = require("../lib/trainer2-pages");

const VIA = "trainer2-page";

module.exports = async function handler(req, res) {
  B.applyCors(req, res, "POST, OPTIONS");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, message: "Use POST." });

  const page = PAGES.pageFor(req.query?.page);
  if (!page) return res.status(404).json({ ok: false, message: "This page is not taking requests." });

  let body;
  try { body = B.readBody(req); } catch { return res.status(400).json({ ok: false, message: "The form could not be read. Please try again." }); }
  const { lead_kind: _ignoredKind, ...fields } = body && typeof body === "object" ? body : {};
  const intake = B.cleanLeadIntake({
    ...fields,
    trainer_slug: page.slug,
    assigned_trainer: page.name,
    source_page: PAGES.sourcePage(page.slug)
  });
  if (intake.errors.length) return res.status(400).json({ ok: false, message: intake.errors.join(" "), errors: intake.errors });

  try {
    const settings = await B.loadSettings();
    const trainer = await B.trainerRow(page.slug);
    if (!trainer) throw new Error(`trainer ${page.slug} not found`);
    // The page's trainer, always. With a live calendar it is their booking setting; without one, the lead still
    // carries their slug (the pipeline then answers "office follow-up" and never re-routes it by ZIP).
    const setting = B.settingBySlug(settings, page.slug) || { slug: page.slug, trainer_id: trainer.id };
    const { lead, reused } = await B.createLead({ intake: intake.value, setting, trainer, via: VIA });
    let entered = null;
    if (!reused) {
      entered = await P.enterPipeline(lead.id, { via: VIA })
        .catch(error => { console.error("pipeline_enter_failed", String(error?.message || error)); return null; });
    }
    const route = await B.routeZip(intake.value.zip, settings).catch(() => ({ cards: [] }));
    const inRange = (route.cards || []).some(card => card.slug === page.slug);
    const calendar = Boolean(B.settingBySlug(settings, page.slug));
    const bookUrl = calendar && inRange ? (entered?.body?.book_url || B.bookUrl(page.slug, lead.id, { direct: true })) : null;
    return res.status(200).json({
      ok: true,
      lead_id: lead.id,
      trainer_slug: page.slug,
      trainer_name: trainer.full_name || page.name,
      book_url: bookUrl,
      duplicate: reused || undefined,
      message: bookUrl
        ? `Thanks, ${intake.value.first_name}! Pick a time for your free evaluation with ${trainer.full_name || page.name}.`
        : `Thanks, ${intake.value.first_name}! ${page.firstName}'s office will call you to set up your free evaluation.`
    });
  } catch (error) {
    console.error("trainer2_lead_failed", String(error?.message || error));
    return res.status(500).json({ ok: false, message: "We could not save your request. Please call us at (866) 436-4959." });
  }
};
