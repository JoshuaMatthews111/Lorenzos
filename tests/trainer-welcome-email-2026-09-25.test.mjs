// Joshua 2026-09-25: a NEW trainer login uses the office's ONE shared temporary password (Vercel setting
// LDTT_TRAINER_SHARED_TEMP_PASSWORD, never in code) and the trainer is emailed their sign-in details when the office
// finishes onboarding. The office's final screen says whether the email went out.
// Run: node --test tests/   Nothing here talks to the real project (global fetch is replaced).
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const read = path => readFileSync(resolve(import.meta.dirname, "..", path), "utf8");
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "test-key";
process.env.SUPABASE_URL = process.env.SUPABASE_URL || "http://supabase.test";
const SAMPLE = "Sample1234!"; // a made-up value for the tests only

function load(sandbox = false) {
  for (const m of ["../lib/sandbox.js", "../lib/portal-auth.js", "../lib/office-email.js", "../api/ensure-trainer-user.js"]) {
    try { delete require.cache[require.resolve(m)]; } catch { /* not loaded */ }
  }
  if (sandbox) process.env.LDTT_SANDBOX = "1"; else delete process.env.LDTT_SANDBOX;
  // Office admin session stub: the handler's own admin check passes.
  const auth = require("../lib/portal-auth.js");
  auth.authorizeRequest = async () => ({ role: "super_admin", isAdmin: true, isSuperAdmin: true });
  return require("../api/ensure-trainer-user.js");
}

function world({ existingLogin = false, rpcAnswer = true } = {}) {
  const calls = [];
  global.fetch = async (url, options = {}) => {
    const u = new URL(String(url));
    let body = options.body;
    if (typeof body === "string") { try { body = JSON.parse(body); } catch { /* text */ } }
    calls.push({ host: u.host, path: u.pathname, search: u.search, method: options.method || "GET", body });
    const res = (status, data) => ({ ok: status < 400, status, headers: { get: () => null }, text: async () => JSON.stringify(data), json: async () => data });
    if (u.host === "api.resend.com") return res(200, { id: "email_123" });
    if (u.pathname === "/auth/v1/admin/users" && (options.method || "GET") === "GET") return res(200, { users: existingLogin ? [{ id: "u-1", email: "new.trainer@lorenzosdogtrainingteam.com", email_confirmed_at: "x" }] : [] });
    if (u.pathname === "/auth/v1/admin/users" && options.method === "POST") return res(200, { id: "u-1" });
    if (u.pathname.startsWith("/rest/v1/trainers") && (options.method || "GET") === "GET") return res(200, [{ id: "t-1", auth_user_id: null }]);
    if (u.pathname.startsWith("/rest/v1/trainers") && options.method === "PATCH") return res(200, [{ version: 2, updated_at: "now" }]);
    if (u.pathname.startsWith("/rest/v1/portal_users") && (options.method || "GET") === "GET") return res(200, []);
    if (u.pathname.startsWith("/rest/v1/portal_users")) return res(201, null);
    if (u.pathname === "/rest/v1/rpc/ldtt_set_new_trainer_temp_password") return res(200, rpcAnswer);
    if (u.pathname.startsWith("/rest/v1/communications_settings")) return res(200, []);
    return res(200, []);
  };
  return calls;
}

async function publish(handler) {
  let status = 0; let json = null;
  const res = { setHeader() {}, status(code) { status = code; return this; }, json(data) { json = data; return this; }, end() { return this; } };
  await handler({ method: "POST", headers: {}, body: { trainer_id: "t-1", email: "new.trainer@lorenzosdogtrainingteam.com", display_name: "Nia Trainer" } }, res);
  return { status, json };
}

test("the shared password setting must look right (capital first, ! last, no spaces) or it is not used", () => {
  const E = load();
  assert.equal(E.sharedTemporaryPassword({ LDTT_TRAINER_SHARED_TEMP_PASSWORD: SAMPLE }), SAMPLE);
  for (const bad of ["", "sample1234!", "Sample1234", "Sample 1234!", "Ab!"]) assert.equal(E.sharedTemporaryPassword({ LDTT_TRAINER_SHARED_TEMP_PASSWORD: bad }), "", JSON.stringify(bad));
});

test("the welcome email: portal link, username, temporary password, create-your-own step, office number, logo", () => {
  const E = load();
  const mail = E.trainerWelcomeEmail({ firstName: "Nia Trainer", email: "nia@lorenzosdogtrainingteam.com", password: SAMPLE });
  assert.equal(mail.subject, "Your Lorenzo's Dog Training Team trainer portal login");
  for (const words of ["Hi Nia,", "https://www.lorenzosdogtrainingteam.com/trainer-backoffice/", "Username: nia@lorenzosdogtrainingteam.com", `Temporary password: ${SAMPLE}`, "create your own password", "(866) 436-4959"]) assert.ok(mail.text.includes(words), words);
  assert.match(mail.html, /lorenzo-logo-transparent\.png/, "logo in the footer");
  assert.doesNotMatch(mail.text + mail.html, /\bTim\b|ldtt-sandbox/);
});

test("a NEW live login: created, switched to the shared password, then the trainer is emailed; the office is told", async () => {
  process.env.LDTT_TRAINER_SHARED_TEMP_PASSWORD = SAMPLE;
  process.env.RESEND_API_KEY = "re_test"; process.env.RESEND_FROM = "office@lorenzosdogtrainingteam.com";
  const E = load(false);
  const calls = world();
  const { status, json } = await publish(E);
  assert.equal(status, 200, JSON.stringify(json));
  assert.equal(json.created, true);
  assert.equal(json.shared_temp_password, true);
  assert.equal(json.temporary_password, "", "the shared password is never sent back to the screen");
  assert.deepEqual(json.login_email, { status: "sent", to: "new.trainer@lorenzosdogtrainingteam.com" });
  const rpc = calls.findIndex(c => c.path === "/rest/v1/rpc/ldtt_set_new_trainer_temp_password");
  const mail = calls.findIndex(c => c.host === "api.resend.com");
  const upsert = calls.findIndex(c => c.path.startsWith("/rest/v1/portal_users") && c.method === "POST");
  assert.ok(upsert >= 0 && rpc > upsert && mail > rpc, "portal row first, then the password, then the email");
  assert.deepEqual(calls[mail].body.to, ["new.trainer@lorenzosdogtrainingteam.com"]);
  assert.ok(calls[mail].body.text.includes(`Temporary password: ${SAMPLE}`));
});

test("no email when the login already existed, when the setting is missing, when the password could not be set, or on the practice copy", async () => {
  process.env.RESEND_API_KEY = "re_test"; process.env.RESEND_FROM = "office@lorenzosdogtrainingteam.com";
  process.env.LDTT_TRAINER_SHARED_TEMP_PASSWORD = SAMPLE;
  let E = load(false); let calls = world({ existingLogin: true });
  let out = await publish(E);
  assert.equal(out.json.login_email, null, "an existing login is not emailed");
  assert.equal(calls.filter(c => c.host === "api.resend.com").length, 0);

  delete process.env.LDTT_TRAINER_SHARED_TEMP_PASSWORD;
  E = load(false); calls = world();
  out = await publish(E);
  assert.equal(out.json.login_email.status, "skipped");
  assert.match(out.json.login_email.reason, /not set on the site/);
  assert.ok(out.json.temporary_password, "the old one-time random password is still shown to the office");
  assert.equal(calls.filter(c => c.host === "api.resend.com").length, 0);

  process.env.LDTT_TRAINER_SHARED_TEMP_PASSWORD = SAMPLE;
  E = load(false); calls = world({ rpcAnswer: false });
  out = await publish(E);
  assert.equal(out.json.login_email.status, "skipped");
  assert.equal(calls.filter(c => c.host === "api.resend.com").length, 0, "never email a password that was not set");

  E = load(true); calls = world();
  out = await publish(E);
  assert.equal(calls.filter(c => c.path === "/rest/v1/rpc/ldtt_set_new_trainer_temp_password" || c.host === "api.resend.com").length, 0, "the practice copy never creates a login or emails");
  delete process.env.LDTT_TRAINER_SHARED_TEMP_PASSWORD;
});

test("the office's final onboarding screen shows whether the welcome email went out", () => {
  const app = read("trainer-backoffice/app.js");
  assert.match(app, /Welcome email SENT to \$\{welcome\.to\}/);
  assert.match(app, /Welcome email NOT sent: /);
  assert.match(app, /<p class="welcome-email-notice \$\{/);
  assert.match(read("trainer-backoffice/styles.css"), /\.welcome-email-notice\.is-sent/);
});
