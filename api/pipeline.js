// One pipeline for every lead source (portal chain step 3, Joshua 2026-09-12, DO-NOT-BREAK rule 72).
// PRACTICE COPY ONLY this round: answers 404 on live, before anything else.
//
//   POST {op:"enter", lead_id, via}  public. A lead a website form just saved (submit-contact, practice
//                                    schema) enters the pipeline: ZIP routing, the Sales tab, and the
//                                    Make pathway 1 text when it has SMS consent (tester phones only).
//                                    Only for a lead made in the last 30 minutes; a second call sends nothing.
//   GET  ?op=settings                office login. Who gets the office booking email (step 3b sends it) +
//                                    the practice trainer-alert tester phone.
//   POST {op:"save_settings", recipients:[{label,email}], practice_trainer_phone, practice_email_to}   office login.
//   POST {op:"send_queued"}          office login. Sends every QUEUED office booking email through Resend
//                                    (rule 73); with no RESEND_API_KEY it sends nothing and says so.
// Nothing here calls FormSubmit or /api/form-delivery. The only email path is Resend (lib/office-email.js).
const { isSandbox } = require("../lib/sandbox");
const { authorizeRequest } = require("../lib/portal-auth");
const B = require("../lib/booking");
const P = require("../lib/pipeline");
const M = require("../lib/office-email");

function actorLabel(access) {
  const actor = access?.actor || {};
  const name = B.clean(actor.name || actor.display_name || "", 120);
  const email = B.clean(actor.email || access?.user?.email || "", 160);
  if (name && email && name.toLowerCase() !== email.toLowerCase()) return `${name} (${email})`;
  return name || email || "Office staff";
}

module.exports = async function handler(req, res) {
  if (!isSandbox()) return res.status(404).json({ ok: false, message: "Not found." });
  B.applyCors(req, res, "GET, POST, OPTIONS");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  if (req.method === "OPTIONS") return res.status(204).end();
  try {
    if (req.method === "GET") {
      const op = B.clean(req.query?.op, 40);
      const access = await authorizeRequest(req, res, { require: "admin", message: "Office access required." });
      if (!access) return;
      if (op === "settings") {
        const config = M.resendConfig();
        return res.status(200).json({
          ok: true, settings: await P.loadSettings(), defaults: P.defaultSettings(),
          email: { resend_ready: config.ready, from: config.from, queued: await P.queuedOfficeEmailCount() }
        });
      }
      return res.status(400).json({ ok: false, message: "Unknown request." });
    }
    if (req.method !== "POST") return res.status(405).json({ ok: false, message: "Use GET or POST." });
    let body;
    try { body = B.readBody(req); } catch { return res.status(400).json({ ok: false, message: "The request could not be read." }); }
    const op = B.clean(body.op, 40);
    if (op === "enter") {
      const leadId = B.clean(body.lead_id, 60);
      if (!B.UUID.test(leadId)) return res.status(400).json({ ok: false, message: "That request id is not complete." });
      const result = await P.enterPipeline(leadId, { via: B.clean(body.via, 60) || "website-form" });
      return res.status(result.status).json(result.body);
    }
    if (op === "save_settings") {
      const access = await authorizeRequest(req, res, { require: "admin", message: "Office access required." });
      if (!access) return;
      const result = await P.saveSettings(body, actorLabel(access));
      if (!result.ok) return res.status(400).json({ ok: false, message: result.errors.join(" "), errors: result.errors });
      return res.status(200).json(result);
    }
    if (op === "send_queued") {
      // Rule 73: "send queued" retry. Resend only; with no key it sends nothing and says so.
      const access = await authorizeRequest(req, res, { require: "admin", message: "Office access required." });
      if (!access) return;
      const result = await P.sendQueuedOfficeEmails();
      const message = !result.resend_ready
        ? `${P.WAITING_FOR_KEY}. ${result.waiting} email${result.waiting === 1 ? "" : "s"} saved and waiting.`
        : `Sent ${result.sent.length}. Failed ${result.failed.length}.${result.failed[0] ? ` ${result.failed[0].message}` : ""}`;
      return res.status(200).json({ ok: true, message, ...result });
    }
    return res.status(400).json({ ok: false, message: "Unknown request." });
  } catch (error) {
    console.error("pipeline_failed", String(error?.message || error));
    return res.status(500).json({ ok: false, message: "Something went wrong. Please try again." });
  }
};
