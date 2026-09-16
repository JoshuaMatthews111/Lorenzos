// Sandbox-only one-click trainer sign-in (Joshua 2026-09-16: "the trainer logins need to have no password
// on the sandbox, just for testing purposes only").
//
// THE GATE. This file answers 404 { ok:false } unless lib/sandbox.js isSandbox() is true, i.e. unless the
// deployment runs with LDTT_SANDBOX=1 (the practice copy). Live never sets that variable, so on live this
// route does not exist as far as the browser can tell, and the login card never draws the box (the client
// only renders it when window.LDTT_IS_SANDBOX is true, which /api/environment only says on the practice copy).
//
//   GET          -> the active trainer logins the tester may pick from: [{ email, full_name, market, state }].
//                   Read from practice.portal_users through supabaseRequest() (rule 33: same logins, practice
//                   schema), role = trainer, active, access_status active, trainer_id set, joined to trainers
//                   for the name. Nothing secret in the answer: no ids, no tokens, no passwords.
//   POST {email} -> if that email is one of those trainer rows, ask the Supabase Auth Admin API for a magic-link
//                   token (generate_link type "magiclink") and answer { ok:true, token_hash }. The browser then
//                   exchanges the hash at /auth/v1/verify for a normal session (trainer-backoffice/supabase.js
//                   signInWithTokenHash) and continues through the SAME post-login path as a password login.
//                   Admin / office rows and the sandbox admin testing logins are refused (403): trainers only.
//                   The action_link is never returned, and no password is set, changed or removed — a magic
//                   link leaves auth.users passwords untouched (rule 33: the practice copy never touches a real
//                   login's password).
//
// What this does NOT change (DO-NOT-BREAK rules 4, 7, 8, 33 — see the header of lib/portal-auth.js):
//   - RLS and the bearer-token verifier are untouched; the session this hands out is an ordinary trainer
//     session, so the trainer still sees only their own rows (rule 4, 7) and every API still verifies the
//     token through lib/portal-auth.js authorizeRequest (rule 8).
//   - Passwords are never written. Real staff logins keep working on the practice copy exactly as before
//     (rule 33); this only adds a second way in, on the practice copy only.
const { isSandbox, supabaseRequest, isSandboxOnlyLogin } = require("../lib/sandbox");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://ptnzaeprvkgjgtupmcty.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";

// The trainer testing login is a trainer row and may be used here; the two admin testing logins may not.
const TRAINER_TEST_LOGIN = "trainer@lorenzosdogtrainingteam.com";

function clean(value, max = 254) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
}

// Same shape as api/trainer-lead-action.js; the global fetch is read at call time so tests can replace it.
async function supabaseFetch(path, options = {}) {
  const target = supabaseRequest(path, options.headers || {});
  const response = await globalThis.fetch(`${SUPABASE_URL}${target.path}`, {
    ...options,
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, "Content-Type": "application/json", ...target.headers }
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) {
    const message = data?.msg || data?.message || data?.error_description || data?.error || `Supabase ${response.status}`;
    throw Object.assign(new Error(message), { status: response.status });
  }
  return data;
}

function isAdminTestLogin(email) {
  return isSandboxOnlyLogin(email) && email !== TRAINER_TEST_LOGIN;
}

// Active trainer logins only. The query already filters, and the rows are checked again here so a stale
// schema cache or a widened query can never let a non-trainer row through.
async function listTrainerLogins() {
  const users = await supabaseFetch(
    "/rest/v1/portal_users?select=email,role,active,access_status,trainer_id&role=eq.trainer&active=eq.true&access_status=eq.active&trainer_id=not.is.null&order=email.asc"
  );
  const rows = (Array.isArray(users) ? users : []).filter(row =>
    row && row.role === "trainer" && row.active === true && String(row.access_status || "") === "active" && row.trainer_id &&
    clean(row.email).includes("@") && !isAdminTestLogin(clean(row.email).toLowerCase())
  );
  if (!rows.length) return [];
  const ids = [...new Set(rows.map(row => String(row.trainer_id)))];
  const trainers = await supabaseFetch(
    `/rest/v1/trainers?select=id,full_name,market,state&id=in.(${ids.map(id => encodeURIComponent(id)).join(",")})`
  );
  const byId = new Map((Array.isArray(trainers) ? trainers : []).map(trainer => [String(trainer.id), trainer]));
  return rows
    .filter(row => byId.has(String(row.trainer_id))) // a portal row whose trainer is gone is not a trainer login
    .map(row => {
      const trainer = byId.get(String(row.trainer_id));
      return {
        email: clean(row.email).toLowerCase(),
        full_name: clean(trainer.full_name, 120),
        market: clean(trainer.market, 120),
        state: clean(trainer.state, 40)
      };
    })
    .sort((a, b) => a.full_name.localeCompare(b.full_name) || a.email.localeCompare(b.email));
}

const reply = (res, status, body) => res.status(status).json(body);

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  // The gate: outside the practice copy this route does not exist.
  if (!isSandbox()) return reply(res, 404, { ok: false });
  if (!["GET", "POST"].includes(req.method)) return reply(res, 405, { ok: false, message: "Use GET or POST." });
  if (!SERVICE_ROLE_KEY) return reply(res, 500, { ok: false, message: "Supabase service role key is not configured." });
  try {
    if (req.method === "GET") {
      return reply(res, 200, { ok: true, sandbox: true, trainers: await listTrainerLogins() });
    }
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const email = clean(body.email).toLowerCase();
    if (!email || !email.includes("@")) return reply(res, 400, { ok: false, message: "Pick a trainer first." });
    const trainers = await listTrainerLogins();
    if (isAdminTestLogin(email) || !trainers.some(trainer => trainer.email === email)) {
      console.warn(`[sandbox-trainer-login] refused: ${email} is not an active trainer login.`);
      return reply(res, 403, { ok: false, message: "Only an active trainer login can be used here. Office and admin logins still need their password." });
    }
    const generated = await supabaseFetch("/auth/v1/admin/generate_link", {
      method: "POST",
      body: JSON.stringify({ type: "magiclink", email })
    });
    const tokenHash = clean(generated?.properties?.hashed_token || generated?.hashed_token, 200);
    if (!tokenHash) throw new Error("Supabase did not return a sign-in token.");
    console.log(`[sandbox-trainer-login] ${email} signed in without a password (practice copy).`);
    return reply(res, 200, { ok: true, sandbox: true, email, token_hash: tokenHash });
  } catch (error) {
    console.error("[sandbox-trainer-login] failed", error?.message || error);
    return reply(res, error?.status && error.status >= 400 && error.status < 600 ? 502 : 500, { ok: false, message: error?.message || "The sandbox sign-in failed." });
  }
};
module.exports.listTrainerLogins = listTrainerLogins;
