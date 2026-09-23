// One pipeline for every lead source (portal chain step 3, Joshua 2026-09-12, DO-NOT-BREAK rule 72).
// PRACTICE COPY ONLY this round: answers 404 on live, before anything else.
//
//   POST {op:"enter", lead_id, via}  public. A lead a website form just saved (submit-contact, practice
//                                    schema) enters the pipeline: ZIP routing, the Sales tab, and the
//                                    Make pathway 1 text when it has SMS consent (tester phones only).
//                                    Only for a lead made in the last 30 minutes; a second call sends nothing.
//   GET  ?op=settings                office login. Who gets the office booking email (step 3b sends it) +
//                                    the practice trainer-alert tester phone.
//   POST {op:"save_settings", recipients:[{label,email}], alpha_email, practice_trainer_phone, practice_email_to}   office login.
//   POST {op:"send_queued"}          office login. Sends every QUEUED office booking email through Resend
//                                    (rule 73); with no RESEND_API_KEY it sends nothing and says so.
// Nothing here calls FormSubmit or /api/form-delivery. The only email path is Resend (lib/office-email.js).
const { isSandbox } = require("../lib/sandbox");
const { authorizeRequest } = require("../lib/portal-auth");
const B = require("../lib/booking");
const P = require("../lib/pipeline");
const M = require("../lib/office-email");
const R = require("../lib/reengage");
const X = require("../lib/pipeline-texts"); // rule 84: the Text messages editor

function actorLabel(access) {
  const actor = access?.actor || {};
  const name = B.clean(actor.name || actor.display_name || "", 120);
  const email = B.clean(actor.email || access?.user?.email || "", 160);
  if (name && email && name.toLowerCase() !== email.toLowerCase()) return `${name} (${email})`;
  return name || email || "Office staff";
}

module.exports = async function handler(req, res) {
  // GO-LIVE 2026-09-23 (Joshua): this route now serves LIVE too. Every table call still goes through the
  // schema switch (rule 5), so the practice copy keeps writing practice.* while live writes public.*.
  B.applyCors(req, res, "GET, POST, OPTIONS");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  if (req.method === "OPTIONS") return res.status(204).end();
  try {
    if (req.method === "GET") {
      const op = B.clean(req.query?.op, 40);
      const access = await authorizeRequest(req, res, { require: "admin", message: "Office access required." });
      if (!access) return;
      if (op === "settings") {
        const config = await M.officeResendConfig();
        const settings = await P.loadSettings();
        return res.status(200).json({
          ok: true, settings, defaults: P.defaultSettings(),
          // Rule 95: the plain line the office reads under the "real trainer numbers" switch.
          recipient_summary: P.practiceRecipientSummary(settings),
          email: { resend_ready: config.ready, from: config.from, queued: await P.queuedOfficeEmailCount() }
        });
      }
      if (op === "texts") {
        // Rule 84: the Text messages editor is the SUPER ADMIN's (Joshua 2026-09-14). Office admins and trainers
        // are refused here, so they cannot even read the templates.
        if (!access.isSuperAdmin) return res.status(403).json({ ok: false, message: "Only the Super Admin can see and change the texts." });
        const { state } = await X.load(B.sbOrThrow);
        return res.status(200).json({ ok: true, ...X.view(state), make_uses_portal: process.env.LDTT_TEXTS_FROM_PORTAL === "1", test_phone_last4: "2915" });
      }
      if (op === "texts_in_use") {
        // Rule 87: the lead timeline shows every office user the words each text uses NOW. Read-only: no templates,
        // no drafts, no edits (those stay Super Admin only, rule 84).
        const { state } = await X.load(B.sbOrThrow);
        const texts = Object.fromEntries(X.view(state).texts.map(t => [t.key, { label: t.label, status: t.status, preview: t.preview, active_name: t.active_name }]));
        return res.status(200).json({ ok: true, texts, make_uses_portal: process.env.LDTT_TEXTS_FROM_PORTAL === "1" });
      }
      if (op === "followup") {
        // Rule 81: the saved follow-up texts. READ ONLY: it plans and previews, it never sends or writes.
        const rows = await B.sbOrThrow("/rest/v1/leads?select=id,created_at,first_name,last_name,phone,sms_consent,status,raw_payload&sms_consent=is.true&order=created_at.desc&limit=3000");
        return res.status(200).json({ ok: true, ...R.preview(Array.isArray(rows) ? rows : []) });
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
      // Rule 95: the saved answer carries the same plain line, so the box updates without a reload.
      return res.status(200).json({ ...result, recipient_summary: P.practiceRecipientSummary(result.settings) });
    }
    if (["text_template_save", "text_template_delete", "text_activate"].includes(op)) {
      // Rule 84: SUPER ADMIN only. Putting a template in use needs the person's full name (rule 19 pattern).
      const access = await authorizeRequest(req, res, { require: "super", message: "Only the Super Admin can change the texts." });
      if (!access) return;
      const result = await X.change(B.sbOrThrow, {
        op: op.slice(5), key: B.clean(body.key, 40), id: B.clean(body.id, 40) || undefined, name: typeof body.name === "string" ? body.name : "",
        words: typeof body.words === "string" ? body.words : undefined, fullName: B.clean(body.full_name, 120)
      }, actorLabel(access));
      return res.status(result.status).json(result.body);
    }
    if (op === "text_test") {
      // Rule 84: a test text goes ONLY to the locked phone (rule 82), and only once Make reads the portal's words.
      const access = await authorizeRequest(req, res, { require: "super", message: "Only the Super Admin can send a test text." });
      if (!access) return;
      if (process.env.LDTT_TEXTS_FROM_PORTAL !== "1") return res.status(409).json({ ok: false, message: "Send test turns on when the Make texts are switched to the portal. That switch is waiting for Joshua's OK." });
      const result = await P.sendTextTest(B.clean(body.key, 40), typeof body.words === "string" ? body.words : undefined);
      return res.status(result.ok ? 200 : 400).json(result);
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
    if (op === "followup_send") {
      // Joshua 2026-09-16: the "Has not booked yet" follow-up texts are an office button, not a timer.
      // Practice copy, active tester phones only (rules 72/73); lib/pipeline.js sendFollowUpText decides.
      const access = await authorizeRequest(req, res, { require: "admin", message: "Office access required." });
      if (!access) return;
      const leadId = B.clean(body.lead_id, 80);
      const stepRaw = B.clean(body.step, 10);
      const step = stepRaw === "link" ? "link" : stepRaw === "care" ? "care" : "tim";
      if (!/^[0-9a-f-]{36}$/i.test(leadId)) return res.status(400).json({ ok: false, message: "Which lead? The lead id is missing." });
      const lead = (await B.sbOrThrow(`/rest/v1/leads?id=eq.${encodeURIComponent(leadId)}&select=${P.LEAD_SELECT}&limit=1`))?.[0];
      if (!lead) return res.status(404).json({ ok: false, message: "That lead was not found." });
      const texts = await P.afterFollowUp({ lead, step, by: access.actor?.email });
      const message = texts.status === "sent" ? `Sent to the tester phone ending ${texts.to_last4}.` : `Not sent: ${texts.reason || texts.status}`;
      return res.status(200).json({ ok: true, message, texts });
    }
    return res.status(400).json({ ok: false, message: "Unknown request." });
  } catch (error) {
    console.error("pipeline_failed", String(error?.message || error));
    return res.status(500).json({ ok: false, message: "Something went wrong. Please try again." });
  }
};
