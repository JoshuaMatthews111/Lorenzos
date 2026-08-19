const crypto = require("node:crypto");
const communications = require("../api/communications");

const { clean, cleanPhone, getSetting, supabaseFetch } = communications.internal;

function rawBody(req) {
  if (Buffer.isBuffer(req.body)) return req.body.toString("utf8");
  if (typeof req.body === "string") return req.body;
  return JSON.stringify(req.body || {});
}

function signatureMatches(signature, secret, payload) {
  const supplied = String(signature || "").trim().replace(/^sha256=/i, "");
  if (!supplied || !secret) return false;
  const digestHex = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  const digestBase64 = crypto.createHmac("sha256", secret).update(payload).digest("base64");
  const candidates = [digestHex, digestBase64];
  return candidates.some(candidate => candidate.length === supplied.length && crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(supplied)));
}

function svixSignatureMatches(headers, secret, payload) {
  const id = clean(headers["svix-id"], 300);
  const timestamp = clean(headers["svix-timestamp"], 80);
  const header = clean(headers["svix-signature"], 2000);
  const key = clean(secret, 2000).replace(/^whsec_/, "");
  if (!id || !timestamp || !header || !key || !/^\d+$/.test(timestamp)) return false;
  const signingKey = Buffer.from(key, "base64");
  if (!signingKey.length) return false;
  const expected = crypto.createHmac("sha256", signingKey).update(`${id}.${timestamp}.${payload}`).digest("base64");
  return header.split(/\s+/).some(entry => {
    const supplied = entry.replace(/^v\d+,/i, "");
    return supplied.length === expected.length && crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
  });
}

function urlTokenMatches(req, secret) {
  // SimpleTexting does not sign its webhooks, so the shared secret can be carried in
  // the webhook address instead: .../api/webhooks/sms-status?token=THE_SECRET
  const supplied = clean(req.query?.token || req.query?.key, 4000);
  if (!supplied || !secret) return false;
  const expected = clean(secret, 4000);
  return supplied.length === expected.length && crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
}

async function beginWebhook(req, provider, settingKey, verifier = signatureMatches) {
  const payload = rawBody(req);
  const { secret } = await getSetting(settingKey, true);
  if (!secret) return { error: "Webhook signing secret is not configured.", status: 503 };
  const header = req.headers["x-signature"] || req.headers["x-simpletexting-signature"] || req.headers["x-webhook-signature"] || "";
  const signed = verifier === svixSignatureMatches
    ? verifier(req.headers, secret, payload)
    : verifier(header, secret, payload);
  const verified = signed || urlTokenMatches(req, secret);
  // A provider that cannot sign its webhooks must not be answered with an error:
  // repeated 4XX replies make the provider disable the webhook altogether. The event
  // is accepted and marked unverified, and each handler decides what it may act on.
  if (!verified && (header || verifier === svixSignatureMatches)) {
    return { error: "Webhook signature was rejected.", status: 401 };
  }
  let data = {};
  try { data = payload ? JSON.parse(payload) : {}; } catch { return { error: "Webhook payload must be JSON.", status: 400 }; }
  const eventId = clean(data.id || data.messageId || data.event_id || data.event?.id || req.headers["svix-id"], 500) || crypto.createHash("sha256").update(payload).digest("hex");
  const eventType = clean(data.type || data.event_type || data.event?.type || "received", 160);
  try {
    await supabaseFetch("/rest/v1/communications_webhook_events", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ provider, provider_event_id: eventId, event_type: eventType, raw_payload: data })
    });
  } catch (error) {
    if (error.status === 409) return { duplicate: true, data, eventId, eventType, verified };
    throw error;
  }
  return { data, eventId, eventType, verified };
}

async function setWebhookOutcome(provider, eventId, outcome) {
  await supabaseFetch(`/rest/v1/communications_webhook_events?provider=eq.${encodeURIComponent(provider)}&provider_event_id=eq.${encodeURIComponent(eventId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ outcome: clean(outcome, 240) || null })
  });
}

function json(res, status, value) {
  return res.status(status).json(value);
}

module.exports = { beginWebhook, clean, cleanPhone, json, setWebhookOutcome, svixSignatureMatches, supabaseFetch };
