const { blockedInSandbox } = require("../lib/sandbox");
// Self-serve password reset for the staff portal.
//
// Why this does not use Supabase's own emailed recovery link: that route needs
// Supabase SMTP plus a redirect allow-list, neither of which is configured for
// this project. Email for this site already goes out through Resend using the
// key saved in Communications Settings, so the reset rides that instead.
//
// The link we email carries the Supabase one-time recovery code together with an
// HMAC signature of our own. The code on its own is only six digits, so without
// the signature it would be guessable; the "set" step refuses anything whose
// signature does not verify, which means only links this endpoint generated can
// be used at all.
const crypto = require("node:crypto");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://ptnzaeprvkgjgtupmcty.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";
const SIGNING_SECRET = process.env.PORTAL_RESET_SECRET || SERVICE_ROLE_KEY;
const SITE_ORIGIN = process.env.PORTAL_SITE_ORIGIN || "https://www.lorenzosdogtrainingteam.com";
const RESEND_BASE = "https://api.resend.com";
const LINK_TTL_MINUTES = 60;

function cors(response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  return response;
}

function clean(value, maxLength = 500) {
  return String(value || "").trim().slice(0, maxLength);
}

function b64url(value) {
  return Buffer.from(String(value), "utf8").toString("base64url");
}

function fromB64url(value) {
  return Buffer.from(String(value), "base64url").toString("utf8");
}

function sign(email, code, expiresAt) {
  return crypto.createHmac("sha256", SIGNING_SECRET)
    .update(`${email}.${code}.${expiresAt}`)
    .digest("base64url");
}

function signatureIsValid(email, code, expiresAt, signature) {
  const expected = sign(email, code, expiresAt);
  const a = Buffer.from(String(signature || ""), "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

async function supabaseFetch(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) {
    throw new Error(data?.msg || data?.message || data?.error_description || data?.error || text || `Supabase request failed (${response.status})`);
  }
  return data;
}

async function resendCredentials() {
  const rows = await supabaseFetch("/rest/v1/communications_settings?select=setting_key,secret_id,value&setting_key=in.(resend_api_key,resend_from_address)");
  const settings = new Map((rows || []).map(item => [item.setting_key, item]));
  const from = settings.get("resend_from_address")?.value?.value || "";
  if (!settings.get("resend_api_key")?.secret_id || !from) return null;
  const secret = await supabaseFetch("/rest/v1/rpc/communications_read_setting_secret", {
    method: "POST",
    body: JSON.stringify({ p_key: "resend_api_key" })
  });
  const apiKey = typeof secret === "string" ? secret : "";
  return apiKey ? { apiKey, from } : null;
}

async function sendResetEmail(email, name, link) {
  const credentials = await resendCredentials();
  if (!credentials) {
    throw Object.assign(
      new Error("Password reset email cannot be sent because Resend is not configured in Communications Settings."),
      { status: 412 }
    );
  }
  const greeting = name ? `Hi ${name},` : "Hi,";
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#071b45;line-height:1.55">
    <p>${greeting}</p>
    <p>Someone asked to reset the password for your Lorenzo's Dog Training Team staff portal account.</p>
    <p><a href="${link}" style="display:inline-block;background:#d20f32;color:#ffffff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:bold">Choose a new password</a></p>
    <p style="font-size:13px;color:#587098">This link works once and expires in ${LINK_TTL_MINUTES} minutes. If you did not ask for this, ignore this email — your current password still works.</p>
    <p style="font-size:13px;color:#587098">If the button does not work, paste this into your browser:<br>${link}</p>
  </div>`;
  const text = `${greeting}\n\nSomeone asked to reset the password for your Lorenzo's Dog Training Team staff portal account.\n\nChoose a new password:\n${link}\n\nThis link works once and expires in ${LINK_TTL_MINUTES} minutes. If you did not ask for this, ignore this email.`;
  const response = await fetch(`${RESEND_BASE}/emails`, {
    method: "POST",
    headers: { Authorization: `Bearer ${credentials.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: credentials.from,
      to: [email],
      subject: "Reset your Lorenzo's staff portal password",
      html,
      text
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.error) throw new Error(data?.message || data?.error?.message || "Resend refused this email.");
}

async function requestReset(body) {
  const email = clean(body.email, 254).toLowerCase();
  // Always answer the same way. Telling a stranger whether an address has an
  // account here is a free staff directory.
  const genericAnswer = {
    ok: true,
    message: "If that email has a portal account, a reset link is on its way. Check the inbox and the spam folder."
  };
  if (!email || !email.includes("@")) return { status: 200, body: genericAnswer };

  const rows = await supabaseFetch(
    `/rest/v1/portal_users?select=user_id,email,display_name,first_name,active&email=eq.${encodeURIComponent(email)}&limit=1`
  );
  const portalUser = rows?.[0];
  if (!portalUser || portalUser.active === false) return { status: 200, body: genericAnswer };

  const generated = await supabaseFetch("/auth/v1/admin/generate_link", {
    method: "POST",
    body: JSON.stringify({ type: "recovery", email })
  });
  const code = clean(generated?.properties?.email_otp || generated?.email_otp, 32);
  if (!code) throw new Error("Supabase did not return a recovery code.");

  const expiresAt = Date.now() + LINK_TTL_MINUTES * 60 * 1000;
  const link = `${SITE_ORIGIN}/trainer-backoffice/reset-password`
    + `?e=${encodeURIComponent(b64url(email))}`
    + `&c=${encodeURIComponent(code)}`
    + `&x=${expiresAt}`
    + `&s=${encodeURIComponent(sign(email, code, expiresAt))}`;

  await sendResetEmail(email, clean(portalUser.first_name || "", 60), link);
  return { status: 200, body: genericAnswer };
}

async function setPassword(body) {
  const email = clean(fromB64url(clean(body.e, 400)), 254).toLowerCase();
  const code = clean(body.c, 32);
  const expiresAt = Number(body.x || 0);
  const signature = clean(body.s, 200);
  const password = String(body.password || "");

  if (!email || !code || !expiresAt || !signature) {
    return { status: 400, body: { ok: false, message: "This reset link is incomplete. Ask for a new one." } };
  }
  if (!signatureIsValid(email, code, expiresAt, signature)) {
    return { status: 400, body: { ok: false, message: "This reset link is not valid. Ask for a new one." } };
  }
  if (Date.now() > expiresAt) {
    return { status: 400, body: { ok: false, message: "This reset link has expired. Ask for a new one." } };
  }
  if (password.length < 10) {
    return { status: 400, body: { ok: false, message: "Choose a password with at least 10 characters." } };
  }

  // Exchange the one-time recovery code for a real session, then change the
  // password as that user. Supabase invalidates the code once it is used.
  let verified;
  try {
    verified = await supabaseFetch("/auth/v1/verify", {
      method: "POST",
      body: JSON.stringify({ type: "recovery", email, token: code })
    });
  } catch {
    return { status: 400, body: { ok: false, message: "This reset link was already used or has expired. Ask for a new one." } };
  }
  const accessToken = verified?.access_token;
  if (!accessToken) {
    return { status: 400, body: { ok: false, message: "This reset link could not be confirmed. Ask for a new one." } };
  }

  const updateResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    method: "PUT",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ password })
  });
  if (!updateResponse.ok) {
    const detail = await updateResponse.text().catch(() => "");
    return { status: 400, body: { ok: false, message: detail || "The new password was refused." } };
  }
  const updated = await updateResponse.json().catch(() => ({}));

  if (updated?.id) {
    await supabaseFetch(`/rest/v1/portal_users?user_id=eq.${encodeURIComponent(updated.id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ must_change_password: false })
    }).catch(() => {});
    await supabaseFetch("/rest/v1/audit_events", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        actor_user_id: updated.id,
        actor_email: email,
        actor_name: email,
        action: "portal_password_self_reset",
        entity_type: "portal_user",
        entity_id: updated.id,
        summary: `${email} reset their own portal password from the login screen`
      })
    }).catch(() => {});
  }

  return { status: 200, body: { ok: true, message: "Your password is set. You can sign in now." } };
}

module.exports = async function handler(req, res) {
  // The sandbox reads live records but is never allowed to change them.
  if (blockedInSandbox(res, "Resetting this password")) return;
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, message: "Method not allowed" });
  if (!SERVICE_ROLE_KEY) return res.status(500).json({ ok: false, message: "Supabase service role key is not configured on Vercel." });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const action = clean(body.action, 20) || "request";
    const result = action === "set" ? await setPassword(body) : await requestReset(body);
    return res.status(result.status).json(result.body);
  } catch (error) {
    return res.status(error.status || 500).json({ ok: false, message: error.message || "The password reset could not be completed." });
  }
};
