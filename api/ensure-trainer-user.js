const { isSandbox, supabaseRequest } = require("../lib/sandbox");
const { authorizeRequest } = require("../lib/portal-auth");
const SUPABASE_URL = process.env.SUPABASE_URL || "https://ptnzaeprvkgjgtupmcty.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";
const crypto = require("crypto");

// 2026-09-18 (Rachel): Supabase Auth's leaked-password check refused the shared
// temporary password ("Password is known to be weak and easy to guess"), so
// Publish failed for every new trainer. The temporary password is now a strong
// random one per trainer (16 chars, letters + digits + symbols) that the office
// sees once in the publish result and the invite message. A configured
// LDTT_TRAINER_TEMP_PASSWORD is only honoured when it is strong enough itself.
function strongEnough(value) {
  const text = String(value || "");
  return text.length >= 12 && /[a-z]/.test(text) && /[A-Z]/.test(text) && /\d/.test(text) && /[^A-Za-z0-9]/.test(text);
}

function generateTemporaryPassword() {
  const sets = [
    "ABCDEFGHJKLMNPQRSTUVWXYZ",
    "abcdefghijkmnopqrstuvwxyz",
    "23456789",
    "!@#$%&*?"
  ];
  const all = sets.join("");
  const pick = pool => pool[crypto.randomInt(0, pool.length)];
  const chars = sets.map(pick);
  while (chars.length < 16) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(0, i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

function temporaryPassword() {
  const configured = process.env.LDTT_TRAINER_TEMP_PASSWORD || "";
  return strongEnough(configured) ? configured : generateTemporaryPassword();
}

// Joshua 2026-09-25: every NEW trainer login uses the office's ONE shared temporary password and the trainer is
// emailed the sign-in details as soon as the office finishes onboarding. The password lives only in the Vercel setting
// LDTT_TRAINER_SHARED_TEMP_PASSWORD (set by Joshua; never in code). Shape: capital first, "!" last, no spaces.
// Unset or the wrong shape = the old behaviour (a random password shown once to the office) and no email.
const TEMP_PASSWORD_SHAPE = /^[A-Z]\S{6,}!$/;
function sharedTemporaryPassword(env = process.env) {
  const value = String(env.LDTT_TRAINER_SHARED_TEMP_PASSWORD || "");
  return TEMP_PASSWORD_SHAPE.test(value) ? value : "";
}

// Joshua 2026-09-29: the office sets (and can change any time) the shared temporary password in Portal Access
// (Super Admin). It is kept encrypted in the Supabase vault (supabase/migrations/20260929120000_*.sql) and wins over
// the Vercel setting above, so what the office typed last is what new trainers get.
async function currentSharedTemporaryPassword() {
  const saved = await supabaseFetch("/rest/v1/rpc/ldtt_read_trainer_temp_password", { method: "POST", body: "{}" }).catch(() => null);
  if (typeof saved === "string" && TEMP_PASSWORD_SHAPE.test(saved)) return saved;
  return sharedTemporaryPassword();
}

async function tempPasswordStatus() {
  const status = await supabaseFetch("/rest/v1/rpc/ldtt_trainer_temp_password_status", { method: "POST", body: "{}" });
  const office = status && typeof status === "object" ? status : { is_set: false };
  return { ...office, is_set: Boolean(office.is_set), vercel_setting: Boolean(sharedTemporaryPassword()) };
}

// Office ops on the same endpoint (Super Admin only). The password is never sent back.
async function tempPasswordOp(req, res, payload) {
  const admin = await authorizeRequest(req, res, { require: "super", message: "Only a Super Admin can see or change the trainer temporary password." });
  if (!admin) return;
  if (isSandbox()) return res.status(200).json({ ok: true, sandbox: true, status: null, message: "Practice copy: the trainer temporary password is set on the live portal only. The practice copy never creates trainer logins." });
  if (payload.op === "temp_password_status") return res.status(200).json({ ok: true, status: await tempPasswordStatus() });
  const password = String(payload.password ?? "");
  if (!TEMP_PASSWORD_SHAPE.test(password)) {
    return res.status(400).json({ ok: false, message: "Not saved. The temporary password must start with a capital letter, end with !, have no spaces and be at least 8 characters." });
  }
  const actorName = String(admin.portalUser?.display_name || admin.user?.email || "Super Admin").slice(0, 120);
  await supabaseFetch("/rest/v1/rpc/ldtt_store_trainer_temp_password", {
    method: "POST",
    body: JSON.stringify({ p_password: password, p_actor: admin.user?.id || null, p_actor_name: actorName })
  });
  return res.status(200).json({ ok: true, status: await tempPasswordStatus() });
}

const TRAINER_PORTAL_URL = "https://www.lorenzosdogtrainingteam.com/trainer-backoffice/";
const LOGO_URL = "https://www.lorenzosdogtrainingteam.com/assets/lorenzo-logo-transparent.png";
const escHtml = value => String(value ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);

function trainerWelcomeEmail({ firstName, email }) {
  const name = String(firstName || "").trim().split(/\s+/)[0] || "there";
  const subject = "Your Lorenzo's Dog Training Team trainer portal login";
  const lines = [
    `Hi ${name},`,
    "",
    "Welcome to Lorenzo's Dog Training Team. Your trainer portal is ready.",
    "",
    `Sign in here: ${TRAINER_PORTAL_URL}`,
    `Username: ${email}`,
    "Password: sign in with the temporary password the office provided.",
    "",
    "The first time you sign in, the portal asks you to create your own password. After that, use your own.",
    "",
    "In the portal you see your leads, your booked evaluations and your team.",
    "",
    "Questions? Call the office at (866) 436-4959.",
    "",
    "Lorenzo's Dog Training Team",
    "Serious Training. Serious Results."
  ];
  const p = text => `<p style="margin:0 0 14px">${escHtml(text)}</p>`;
  const html = `<div style="font:16px/1.6 Arial,sans-serif;color:#111;max-width:600px">${p(`Hi ${name},`)}${p("Welcome to Lorenzo's Dog Training Team. Your trainer portal is ready.")}`
    + `<table style="border-collapse:collapse;margin:6px 0 18px;font-size:15px"><tr><td style="padding:6px 12px 6px 0;color:#555">Sign in here</td><td style="padding:6px 0"><a href="${TRAINER_PORTAL_URL}">${TRAINER_PORTAL_URL}</a></td></tr>`
    + `<tr><td style="padding:6px 12px 6px 0;color:#555">Username</td><td style="padding:6px 0"><b>${escHtml(email)}</b></td></tr>`
    + `<tr><td style="padding:6px 12px 6px 0;color:#555">Password</td><td style="padding:6px 0">Sign in with the <b>temporary password the office provided</b>.</td></tr></table>`
    + `<p style="margin:18px 0"><a href="${TRAINER_PORTAL_URL}" style="display:inline-block;background:#d80f35;color:#fff;padding:12px 22px;text-decoration:none;border-radius:6px;font-weight:bold">SIGN IN TO MY PORTAL</a></p>`
    + p("The first time you sign in, the portal asks you to create your own password. After that, use your own.")
    + p("In the portal you see your leads, your booked evaluations and your team.")
    + p("Questions? Call the office at (866) 436-4959.")
    + `<div style="margin-top:26px;padding-top:16px;border-top:1px solid #e3e3e8;text-align:center"><img src="${LOGO_URL}" alt="Lorenzo's Dog Training Team" width="170" style="width:170px;height:auto"><p style="margin:6px 0 0;font-size:12px;color:#777">Lorenzo's Dog Training Team · Serious Training. Serious Results.</p></div></div>`;
  return { subject, html, text: lines.join("\n") };
}

async function setSharedTemporaryPassword(userId, password) {
  const ok = await supabaseFetch("/rest/v1/rpc/ldtt_set_new_trainer_temp_password", {
    method: "POST",
    body: JSON.stringify({ p_user_id: userId, p_password: password })
  });
  return ok === true;
}

async function sendTrainerWelcome({ userId, email, displayName }) {
  try {
    const M = require("../lib/office-email");
    const mail = trainerWelcomeEmail({ firstName: displayName, email });
    const config = await M.officeResendConfig();
    const sent = await M.sendViaResend({ to: [email], subject: mail.subject, html: mail.html, text: mail.text, idempotencyKey: `trainer-welcome:${userId}` }, config);
    return sent.ok ? { status: "sent", to: email } : { status: "failed", to: email, reason: String(sent.message || "The email service did not accept it.").slice(0, 300) };
  } catch (error) {
    return { status: "failed", to: email, reason: String(error?.message || error).slice(0, 300) };
  }
}

function cors(response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return response;
}

function clean(value, maxLength = 500) {
  return String(value || "").trim().slice(0, maxLength);
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function supabaseFetch(path, options = {}) {
  // Practice copy: schema profile headers / practice-* bucket (lib/sandbox.js).
  const target = supabaseRequest(path, options.headers || {});
  const response = await fetch(`${SUPABASE_URL}${target.path}`, {
    ...options,
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      ...target.headers
    }
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!response.ok) {
    const message = data?.msg || data?.message || data?.error_description || data?.error || text || `Supabase request failed (${response.status})`;
    throw new Error(message);
  }
  return data;
}

async function findAuthUserByEmail(email) {
  const normalized = email.toLowerCase();
  let page = 1;
  while (page <= 20) {
    const data = await supabaseFetch(`/auth/v1/admin/users?page=${page}&per_page=100`);
    const users = data?.users || [];
    const match = users.find(user => String(user.email || "").toLowerCase() === normalized);
    if (match) return match;
    if (!users.length || users.length < 100) return null;
    page += 1;
  }
  return null;
}

async function createOrEnableAuthUser(email, displayName) {
  const existing = await findAuthUserByEmail(email);
  if (existing?.id) {
    if (!existing.email_confirmed_at) {
      await supabaseFetch(`/auth/v1/admin/users/${existing.id}`, {
        method: "PUT",
        body: JSON.stringify({
          email_confirm: true,
          user_metadata: { display_name: displayName, portal_role: "trainer" }
        })
      });
    }
    return { userId: existing.id, created: false };
  }
  const password = temporaryPassword();
  const created = await supabaseFetch("/auth/v1/admin/users", {
    method: "POST",
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: displayName, portal_role: "trainer" }
    })
  });
  return { userId: created?.id, created: true, password };
}

async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, message: "Method not allowed" });
  if (!SERVICE_ROLE_KEY) return res.status(500).json({ ok: false, message: "Supabase service role key is not configured on Vercel." });

  try {
    const payload = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    if (payload.op === "temp_password_status" || payload.op === "save_temp_password") return await tempPasswordOp(req, res, payload);

    // Office staff only (lib/portal-auth.js): super_admin or office_admin,
    // active, access_status not disabled/revoked. This endpoint used to accept
    // any role=admin row, whatever its permission_level or access_status.
    const admin = await authorizeRequest(req, res, { require: "admin", message: "Active admin access required." });
    if (!admin) return;

    const trainerId = clean(payload.trainer_id, 80);
    const email = clean(payload.email, 254).toLowerCase();
    const displayName = clean(payload.display_name, 180) || "Lorenzo Trainer";
    if (!trainerId) return res.status(400).json({ ok: false, message: "Trainer ID is required." });
    if (!validEmail(email)) return res.status(400).json({ ok: false, message: "A valid trainer email is required before portal access can be created." });

    const trainers = await supabaseFetch(`/rest/v1/trainers?select=id,auth_user_id&status=neq.deleted&id=eq.${encodeURIComponent(trainerId)}&limit=1`);
    if (!trainers?.[0]) return res.status(404).json({ ok: false, message: "Trainer record was not found." });

    // Practice copy: the trainer row and the practice portal_users row are
    // written like on live, but NO auth user is ever created or changed here —
    // logins are shared with live, so a practice trainer login would be a real
    // login. If this email already has a login (the office testing one, or a
    // real trainer's), the practice portal row points at it and they can sign
    // in to the practice copy with the password they already have. Otherwise
    // the trainer is enabled without a login and the office is told so.
    const authResult = trainers[0].auth_user_id
      ? { userId: trainers[0].auth_user_id, created: false }
      : isSandbox()
        ? await findAuthUserByEmail(email).then(user => ({ userId: user?.id || null, created: false, practiceNoLogin: !user?.id }))
        : await createOrEnableAuthUser(email, displayName);
    if (!authResult.userId && !isSandbox()) throw new Error("Trainer auth user could not be created.");

    // onboarding: if that email already signs in as STAFF, stop. The upsert below
    // would have turned the staff member's portal row into a trainer row (role,
    // trainer_id) and locked them out of the office portal — on live too.
    if (authResult.userId && !trainers[0].auth_user_id) {
      const existingRows = await supabaseFetch(`/rest/v1/portal_users?select=user_id,role,trainer_id,display_name&user_id=eq.${encodeURIComponent(authResult.userId)}&limit=1`);
      const existing = existingRows?.[0];
      if (existing && existing.role === "admin") {
        return res.status(409).json({ ok: false, staffLogin: true, message: `${email} is a staff login (${existing.display_name || "office"}), not a trainer. Give the trainer their own email, then publish again.` });
      }
      if (existing && existing.role === "trainer" && existing.trainer_id && String(existing.trainer_id) !== String(trainerId)) {
        return res.status(409).json({ ok: false, message: `${email} already belongs to another trainer's login. Each trainer needs their own email.` });
      }
    }

    // onboarding: hand back the row's new version/updated_at so the portal's next
    // save (the publish itself) does not trip its own "updated by another staff
    // member" check.
    const updatedTrainers = await supabaseFetch(`/rest/v1/trainers?id=eq.${encodeURIComponent(trainerId)}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        ...(authResult.userId ? { auth_user_id: authResult.userId } : {}),
        email,
        access_status: "active",
        status: "active"
      })
    });
    const updatedTrainer = updatedTrainers?.[0] || null;

    if (authResult.userId) await supabaseFetch("/rest/v1/portal_users?on_conflict=user_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({
        user_id: authResult.userId,
        role: "trainer",
        trainer_id: trainerId,
        display_name: displayName,
        active: true,
        must_change_password: authResult.created
      })
    });

    // A NEW live login (Joshua 2026-09-29): the email never carries the password - it says to sign in with the temporary
    // password the office provided. If the shared temporary password is set on the site it is put on the login first;
    // otherwise the office gives the trainer the one-time password shown on its screen.
    let loginEmail = null;
    let sharedUsed = false;
    if (authResult.created && authResult.userId && !isSandbox()) {
      const shared = await currentSharedTemporaryPassword();
      if (shared) sharedUsed = await setSharedTemporaryPassword(authResult.userId, shared).catch(() => false);
      loginEmail = await sendTrainerWelcome({ userId: authResult.userId, email, displayName });
    }

    return res.status(200).json({
      ok: true,
      sandbox: isSandbox(),
      trainer_id: trainerId,
      email,
      user_id: authResult.userId,
      created: authResult.created,
      trainer: updatedTrainer ? { version: updatedTrainer.version || null, updated_at: updatedTrainer.updated_at || null } : null,
      temporary_password: authResult.created && !sharedUsed ? authResult.password || "" : "",
      shared_temp_password: sharedUsed,
      login_email: loginEmail,
      ...(isSandbox() ? { message: authResult.practiceNoLogin
        ? "Practice copy: the trainer is enabled and their page can be published here, but no login was created — logins are real and shared with live. Create the login on the live portal when the trainer is real."
        : "Practice copy: the trainer is enabled here and can sign in to the practice copy with the password that email already has. No login was created or changed." } : {})
    });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || "Trainer portal access could not be prepared." });
  }
}

module.exports = handler;
module.exports.sharedTemporaryPassword = sharedTemporaryPassword;
module.exports.trainerWelcomeEmail = trainerWelcomeEmail;
