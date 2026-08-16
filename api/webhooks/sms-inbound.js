const communications = require("../communications");
const { beginWebhook, clean, cleanPhone, json, setWebhookOutcome, supabaseFetch } = require("../../lib/communications-webhooks");

const { sendSms } = communications.internal;

function replyText(data) {
  return clean(data.text || data.message || data.body || data.data?.text || data.data?.body, 1000);
}

function replyPhone(data) {
  return cleanPhone(data.from || data.phone || data.contactPhone || data.sender?.phone || data.data?.from);
}

function leadCode(text) {
  return (String(text).match(/\b(\d{4})\b/) || [])[1] || "";
}

async function sms(phone, text) {
  try { await sendSms(phone, text); } catch { /* The provider result is recorded after configuration. */ }
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { ok: false, message: "POST required." });
  try {
    const webhook = await beginWebhook(req, "simpletexting", "simpletexting_signing_secret");
    if (webhook.error) return json(res, webhook.status, { ok: false, message: webhook.error });
    if (webhook.duplicate) return json(res, 200, { ok: true, duplicate: true });
    const phone = replyPhone(webhook.data);
    const text = replyText(webhook.data).toUpperCase();
    if (!phone || !text) {
      await setWebhookOutcome("simpletexting", webhook.eventId, "ignored_missing_sender_or_text");
      return json(res, 200, { ok: true });
    }
    const members = await supabaseFetch(`/rest/v1/communications_alert_members?select=*&phone=eq.${encodeURIComponent(phone)}&active=eq.true&stopped_at=is.null`);
    if (/\bSTOP\b/.test(text)) {
      await supabaseFetch(`/rest/v1/communications_alert_members?phone=eq.${encodeURIComponent(phone)}&stopped_at=is.null`, {
        method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ active: false, stopped_at: new Date().toISOString() })
      });
      await setWebhookOutcome("simpletexting", webhook.eventId, "staff_opted_out");
      await sms(phone, "Lorenzo's Dog Training Team alerts are stopped for this number. Reply HELP for office contact information.");
      return json(res, 200, { ok: true });
    }
    if (!members.length) {
      await setWebhookOutcome("simpletexting", webhook.eventId, "unknown_staff_number");
      return json(res, 200, { ok: true });
    }
    if (/\bHELP\b/.test(text)) {
      await sms(phone, "Commands: TAKE 1234, DONE 1234, PASS 1234, STATUS 1234, STOP.");
      await setWebhookOutcome("simpletexting", webhook.eventId, "help_sent");
      return json(res, 200, { ok: true });
    }
    const code = leadCode(text);
    if (!code) {
      await sms(phone, "Reply TAKE 1234, DONE 1234, PASS 1234, STATUS 1234, STOP, or HELP.");
      await setWebhookOutcome("simpletexting", webhook.eventId, "command_hint_sent");
      return json(res, 200, { ok: true });
    }
    const staff = members.find(member => member.portal_user_id);
    if (!staff) {
      await sms(phone, `Your number is not linked to a portal account, so #${code} cannot be claimed. Ask the office to link it.`);
      await setWebhookOutcome("simpletexting", webhook.eventId, "staff_account_not_linked");
      return json(res, 200, { ok: true });
    }
    const leads = await supabaseFetch(`/rest/v1/leads?select=id,communications_code,claim_status,claimed_by,communications_alert_list_id&communications_code=eq.${encodeURIComponent(code)}&order=created_at.desc&limit=1`);
    const lead = leads[0];
    if (!lead) {
      await sms(phone, `I could not find an open lead for #${code}. Reply HELP for commands.`);
      await setWebhookOutcome("simpletexting", webhook.eventId, "lead_not_found");
      return json(res, 200, { ok: true });
    }
    if (/\bSTATUS\b/.test(text)) {
      await sms(phone, `#${code} is ${lead.claim_status || "new"}${lead.claimed_by ? " and already has an owner." : "."}`);
      await setWebhookOutcome("simpletexting", webhook.eventId, "status_sent");
      return json(res, 200, { ok: true });
    }
    if (/\bPASS\b/.test(text)) {
      await supabaseFetch("/rest/v1/rpc/communications_release_lead", { method: "POST", body: JSON.stringify({ p_lead_id: lead.id, p_staff_id: staff.portal_user_id, p_reason: "passed by text" }) });
      await sms(phone, `#${code} is back with the team. Thank you.`);
      await setWebhookOutcome("simpletexting", webhook.eventId, "released");
      return json(res, 200, { ok: true });
    }
    if (/\b(DONE|REACHED|LEFTMSG|NOANSWER)\b/.test(text)) {
      await supabaseFetch("/rest/v1/rpc/communications_mark_contacted", { method: "POST", body: JSON.stringify({ p_lead_id: lead.id, p_staff_id: staff.portal_user_id, p_note: "Contact update by text" }) });
      await sms(phone, `#${code} contact update recorded.`);
      await setWebhookOutcome("simpletexting", webhook.eventId, "contacted");
      return json(res, 200, { ok: true });
    }
    const claim = await supabaseFetch("/rest/v1/rpc/communications_claim_lead", { method: "POST", body: JSON.stringify({ p_lead_id: lead.id, p_staff_id: staff.portal_user_id }) });
    const result = Array.isArray(claim) ? claim[0] : claim;
    await sms(phone, result?.claimed ? `You've got #${code}. Client details are in the staff portal. Please call within 15 minutes.` : `#${code} was already taken by ${result?.owner_name || "another team member"}.`);
    await setWebhookOutcome("simpletexting", webhook.eventId, result?.claimed ? "claimed" : "already_claimed");
    return json(res, 200, { ok: true });
  } catch (error) {
    console.error("Inbound SMS webhook error", error);
    return json(res, 500, { ok: false, message: "Webhook processing failed." });
  }
};
