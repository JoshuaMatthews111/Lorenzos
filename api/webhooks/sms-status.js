const { beginWebhook, clean, json, setWebhookOutcome } = require("../../lib/communications-webhooks");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { ok: false, message: "POST required." });
  try {
    const webhook = await beginWebhook(req, "simpletexting", "simpletexting_signing_secret");
    if (webhook.error) return json(res, webhook.status, { ok: false, message: webhook.error });
    if (webhook.duplicate) return json(res, 200, { ok: true, duplicate: true });
    const outcome = clean(webhook.data.status || webhook.data.deliveryStatus || webhook.data.data?.status || "received", 160).toLowerCase();
    await setWebhookOutcome("simpletexting", webhook.eventId, outcome);
    return json(res, 200, { ok: true });
  } catch (error) {
    console.error("SMS status webhook error", error);
    return json(res, 500, { ok: false, message: "Webhook processing failed." });
  }
};
