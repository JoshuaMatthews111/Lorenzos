// The lead form editor API (portal chain step 4, Joshua 2026-09-12, DO-NOT-BREAK rule 75).
//
// PRACTICE COPY this round: answers 404 on live, before anything else, unless LDTT_LEAD_FORMS_LIVE=1 is set
// on the live deployment (that is the live release's switch; until then live forms are byte-for-byte as before).
//
//   GET  ?op=public[&form=<id>]   public. The PUBLISHED forms (what the website pages draw). The 2.0 pages read
//                                 it cross-origin (CORS for https://ldtt-ads-v2-sandbox.vercel.app).
//   GET  ?op=editor               office login. Every form, its draft + published questions, what removing each
//                                 question does, and the change log.
//   POST {op:"save_draft", form, fields}                 office login, practice copy only.
//   POST {op:"remove_field", form, key, fields?, name}   office login, practice copy only. Full name required;
//                                                        logged (who, when, which form, which question) + audit row.
//   POST {op:"restore_field", form, key, log_id?, fields?, name?}   office login, practice copy only (undo).
//   POST {op:"reset_form", form, name}                   office login, practice copy only. Back to the original.
//   POST {op:"discard_draft", form}                      office login. Unpublished changes of one form thrown away.
//   POST {op:"publish", name}                            office login. Draft -> published (the pages use it).
// On live only public / editor / publish / discard_draft exist: forms are CHANGED on the practice copy and reach
// the live draft through Send to live (api/send-to-live.js kind "lead_forms"); publishing stays on the live portal.
const { isSandbox } = require("../lib/sandbox");
const { authorizeRequest } = require("../lib/portal-auth");
const B = require("../lib/booking");
const LF = require("../lib/lead-forms");

const liveSwitchedOn = () => process.env.LDTT_LEAD_FORMS_LIVE === "1";
const PRACTICE_ONLY_OPS = new Set(["save_draft", "remove_field", "restore_field", "reset_form"]);

async function audit(access, action, formId, summary, afterData) {
  try {
    await B.sbOrThrow("/rest/v1/audit_events", {
      method: "POST", prefer: "return=minimal",
      body: {
        actor_user_id: access?.actor?.id || null,
        actor_email: access?.actor?.email || null,
        actor_name: afterData?.by_name ? `${afterData.by_name} (login: ${access?.actor?.email || "unknown"})` : access?.actor?.name || null,
        action, entity_type: "lead_form", entity_id: formId || "all", summary: String(summary || "").slice(0, 500), after_data: afterData || null
      }
    });
  } catch (error) {
    console.error("lead_forms_audit_failed", String(error?.message || error));
  }
}

async function lastSentToLive() {
  if (!isSandbox()) return null;
  try {
    const rows = await B.sbOrThrow("/rest/v1/send_to_live_log?entity_type=eq.lead_forms&select=sent_at,sent_by,sent_by_name&order=sent_at.desc&limit=1");
    return rows?.[0] || null;
  } catch {
    return null;
  }
}

async function editorBody(loaded) {
  return LF.editorPayload(loaded.store, { practice: isSandbox(), can_edit: isSandbox(), last_sent: await lastSentToLive() });
}

module.exports = async function handler(req, res) {
  if (!isSandbox() && !liveSwitchedOn()) return res.status(404).json({ ok: false, message: "Not found." });
  B.applyCors(req, res, "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();
  try {
    if (req.method === "GET") {
      const op = B.clean(req.query?.op, 40) || "public";
      if (op === "public") {
        res.setHeader("Cache-Control", isSandbox() ? "no-store, max-age=0" : "public, max-age=0, s-maxage=30, stale-while-revalidate=60");
        let loaded;
        try { loaded = await LF.loadStore(B.sbOrThrow); } catch { loaded = { store: LF.blankStore() }; } // fail open: the original forms
        const all = LF.publicForms(loaded.store);
        const form = B.clean(req.query?.form, 40);
        if (form) {
          if (!all.forms[form]) return res.status(404).json({ ok: false, message: "That form does not exist." });
          return res.status(200).json({ ok: true, revision: all.revision, form: all.forms[form], fallbacks: all.fallbacks, extra_prefix: all.extra_prefix });
        }
        return res.status(200).json({ ok: true, ...all });
      }
      res.setHeader("Cache-Control", "no-store, max-age=0");
      if (op === "editor") {
        const access = await authorizeRequest(req, res, { require: "admin", message: "Office access required." });
        if (!access) return;
        return res.status(200).json(await editorBody(await LF.loadStore(B.sbOrThrow)));
      }
      return res.status(400).json({ ok: false, message: "Unknown request." });
    }
    res.setHeader("Cache-Control", "no-store, max-age=0");
    if (req.method !== "POST") return res.status(405).json({ ok: false, message: "Use GET or POST." });
    let body;
    try { body = B.readBody(req); } catch { return res.status(400).json({ ok: false, message: "The request could not be read." }); }
    const access = await authorizeRequest(req, res, { require: "admin", message: "Office access required." });
    if (!access) return;
    const op = B.clean(body.op, 40);
    if (PRACTICE_ONLY_OPS.has(op) && !isSandbox()) {
      return res.status(409).json({ ok: false, message: "Forms are changed on the practice copy. Make the change there, then Send to live; publish it here." });
    }
    const actor = access.actor || {};
    const form = B.clean(body.form, 40);
    const key = B.clean(body.key, 60);
    const fields = Array.isArray(body.fields) ? body.fields : null;
    const loaded = await LF.loadStore(B.sbOrThrow);
    let result;
    if (op === "save_draft") result = LF.saveDraft(loaded.store, form, fields || [], actor);
    else if (op === "remove_field") result = LF.removeField(loaded.store, form, key, { fields, actor, name: body.name });
    else if (op === "restore_field") result = LF.restoreField(loaded.store, form, key, { fields, actor, name: body.name, logEntryId: B.clean(body.log_id, 60) });
    else if (op === "reset_form") result = LF.resetForm(loaded.store, form, { actor, name: body.name });
    else if (op === "discard_draft") result = LF.discardDraft(loaded.store, form, { actor });
    else if (op === "publish") result = LF.publish(loaded.store, { actor, name: body.name });
    else return res.status(400).json({ ok: false, message: "Unknown request." });

    const saved = await LF.saveStore(B.sbOrThrow, loaded, result.store, LF.actorLabel(actor));
    const entry = result.log;
    if (entry) {
      const where = isSandbox() ? "practice copy" : "live website";
      const summaries = {
        removed: `${entry.by_name} removed "${entry.field_label}" from the ${entry.form_label} form (${where}). Effect: ${entry.effect}`,
        restored: `${entry.by_name} put "${entry.field_label}" back on the ${entry.form_label} form (${where}).`,
        reset: `${entry.by_name} reset the ${entry.form_label} form to the original questions (${where}).`,
        discarded: `${entry.by_name} threw away the unpublished changes of the ${entry.form_label} form (${where}).`,
        published: `${entry.by_name} published the lead forms on the ${where} (revision ${entry.revision}): ${(entry.form_labels || []).join(", ")}.`
      };
      await audit(access, `lead_form_${entry.action}`, entry.form || "all", summaries[entry.action] || entry.action, entry);
    }
    return res.status(200).json(await editorBody(saved));
  } catch (error) {
    const status = error.status && error.status >= 400 && error.status < 600 ? error.status : 500;
    if (status >= 500) console.error("lead_forms_failed", String(error?.message || error));
    return res.status(status).json({ ok: false, message: status >= 500 ? "Something went wrong. Please try again." : error.message, errors: error.errors || undefined });
  }
};
module.exports.liveSwitchedOn = liveSwitchedOn;
