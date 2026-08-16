const { beginWebhook, clean, json, setWebhookOutcome, supabaseFetch, svixSignatureMatches } = require("../../lib/communications-webhooks");

function recipientEmails(data) {
  const values = data.to || data.email || data.data?.to || data.data?.email || [];
  return (Array.isArray(values) ? values : [values])
    .map(value => clean(typeof value === "object" ? value.email : value, 254).toLowerCase())
    .filter(value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { ok: false, message: "POST required." });
  try {
    const webhook = await beginWebhook(req, "resend", "resend_signing_secret", svixSignatureMatches);
    if (webhook.error) return json(res, webhook.status, { ok: false, message: webhook.error });
    if (webhook.duplicate) return json(res, 200, { ok: true, duplicate: true });
    const type = clean(webhook.data.type || webhook.data.event_type || "received", 160).toLowerCase();
    if (type === "email.bounced" || type === "email.complained") {
      const emails = recipientEmails(webhook.data);
      await Promise.all(emails.map(email => supabaseFetch(`/rest/v1/clients?email=eq.${encodeURIComponent(email)}`, {
        method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ email_consent: false })
      })));
    }
    await setWebhookOutcome("resend", webhook.eventId, type);
    return json(res, 200, { ok: true });
  } catch (error) {
    console.error("Email webhook error", error);
    return json(res, 500, { ok: false, message: "Webhook processing failed." });
  }
};
