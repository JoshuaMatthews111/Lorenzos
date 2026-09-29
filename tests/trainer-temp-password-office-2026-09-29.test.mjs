// Joshua 2026-09-29: the office (Super Admin) sets and can change the ONE temporary password new trainer logins get,
// from Portal Access. It is saved encrypted on the server (vault) and never sent back to the screen.
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
const OFFICE = "Office5678!"; // made-up values for the tests only
const VERCEL = "Vercel1234!";

function load({ role = "super_admin", sandbox = false } = {}) {
  for (const m of ["../lib/sandbox.js", "../lib/portal-auth.js", "../lib/office-email.js", "../api/ensure-trainer-user.js"]) {
    try { delete require.cache[require.resolve(m)]; } catch { /* not loaded */ }
  }
  if (sandbox) process.env.LDTT_SANDBOX = "1"; else delete process.env.LDTT_SANDBOX;
  const auth = require("../lib/portal-auth.js");
  auth.authorizeRequest = async (req, res, options) => {
    if (options.require === "super" && role !== "super_admin") { res.status(403).json({ ok: false, message: options.message }); return null; }
    return { role, isAdmin: true, isSuperAdmin: role === "super_admin", user: { id: "admin-1", email: "rachel@x.test" }, portalUser: { display_name: "Rachel" } };
  };
  return require("../api/ensure-trainer-user.js");
}

function world({ saved = null } = {}) {
  const calls = [];
  global.fetch = async (url, options = {}) => {
    const u = new URL(String(url));
    let body = options.body;
    if (typeof body === "string") { try { body = JSON.parse(body); } catch { /* text */ } }
    calls.push({ host: u.host, path: u.pathname, method: options.method || "GET", body });
    const res = (status, data) => ({ ok: status < 400, status, headers: { get: () => null }, text: async () => JSON.stringify(data), json: async () => data });
    if (u.host === "api.resend.com") return res(200, { id: "email_1" });
    if (u.pathname === "/rest/v1/rpc/ldtt_read_trainer_temp_password") return res(200, saved);
    if (u.pathname === "/rest/v1/rpc/ldtt_trainer_temp_password_status") return res(200, saved ? { is_set: true, updated_at: "2026-09-29T16:00:00Z", set_by_name: "Rachel" } : { is_set: false });
    if (u.pathname === "/rest/v1/rpc/ldtt_store_trainer_temp_password") { saved = body.p_password; return res(200, { is_set: true }); }
    if (u.pathname === "/auth/v1/admin/users" && (options.method || "GET") === "GET") return res(200, { users: [] });
    if (u.pathname === "/auth/v1/admin/users" && options.method === "POST") return res(200, { id: "u-1" });
    if (u.pathname.startsWith("/rest/v1/trainers") && (options.method || "GET") === "GET") return res(200, [{ id: "t-1", auth_user_id: null }]);
    if (u.pathname.startsWith("/rest/v1/trainers") && options.method === "PATCH") return res(200, [{ version: 2, updated_at: "now" }]);
    if (u.pathname.startsWith("/rest/v1/portal_users") && (options.method || "GET") === "GET") return res(200, []);
    if (u.pathname.startsWith("/rest/v1/portal_users")) return res(201, null);
    if (u.pathname === "/rest/v1/rpc/ldtt_set_new_trainer_temp_password") return res(200, true);
    return res(200, []);
  };
  return calls;
}

async function call(handler, body) {
  let status = 0; let json = null;
  const res = { setHeader() {}, status(code) { status = code; return this; }, json(data) { json = data; return this; }, end() { return this; } };
  await handler({ method: "POST", headers: {}, body }, res);
  return { status, json };
}

test("a Super Admin saves the temporary password; the shape is checked; it is never sent back", async () => {
  const E = load();
  let calls = world();
  for (const bad of ["office5678!", "Office5678", "Office 5678!", "Ab!"]) {
    const out = await call(E, { op: "save_temp_password", password: bad });
    assert.equal(out.status, 400, bad);
  }
  assert.equal(calls.filter(c => c.path.includes("ldtt_store_trainer_temp_password")).length, 0, "a bad shape is never saved");
  calls = world();
  const out = await call(E, { op: "save_temp_password", password: OFFICE });
  assert.equal(out.status, 200, JSON.stringify(out.json));
  const store = calls.find(c => c.path === "/rest/v1/rpc/ldtt_store_trainer_temp_password");
  assert.deepEqual(store.body, { p_password: OFFICE, p_actor: "admin-1", p_actor_name: "Rachel" });
  assert.equal(out.json.status.is_set, true);
  assert.ok(!JSON.stringify(out.json).includes(OFFICE), "the password is never in the answer");
});

test("only a Super Admin can see or change it; the practice copy never saves it", async () => {
  let E = load({ role: "office_admin" });
  let calls = world();
  let out = await call(E, { op: "save_temp_password", password: OFFICE });
  assert.equal(out.status, 403);
  out = await call(E, { op: "temp_password_status" });
  assert.equal(out.status, 403);
  assert.equal(calls.filter(c => c.path.includes("temp_password")).length, 0);

  E = load({ sandbox: true });
  calls = world();
  out = await call(E, { op: "save_temp_password", password: OFFICE });
  assert.equal(out.json.sandbox, true);
  assert.equal(calls.filter(c => c.path.includes("ldtt_store_trainer_temp_password")).length, 0);
  delete process.env.LDTT_SANDBOX;
});

test("a new trainer login gets the office's saved password (it wins over the Vercel setting); none saved = the Vercel setting", async () => {
  process.env.RESEND_API_KEY = "re_test"; process.env.RESEND_FROM = "office@lorenzosdogtrainingteam.com";
  process.env.LDTT_TRAINER_SHARED_TEMP_PASSWORD = VERCEL;
  let E = load();
  let calls = world({ saved: OFFICE });
  let out = await call(E, { trainer_id: "t-1", email: "new.trainer@lorenzosdogtrainingteam.com", display_name: "Nia Trainer" });
  assert.equal(out.json.shared_temp_password, true);
  assert.equal(out.json.temporary_password, "");
  assert.equal(calls.find(c => c.path === "/rest/v1/rpc/ldtt_set_new_trainer_temp_password").body.p_password, OFFICE);
  assert.ok(calls.find(c => c.host === "api.resend.com").body.text.includes(`Temporary password: ${OFFICE}`), "the email prints it (2026-09-29)");

  E = load();
  calls = world({ saved: null });
  out = await call(E, { trainer_id: "t-1", email: "new.trainer@lorenzosdogtrainingteam.com", display_name: "Nia Trainer" });
  assert.equal(calls.find(c => c.path === "/rest/v1/rpc/ldtt_set_new_trainer_temp_password").body.p_password, VERCEL);
  delete process.env.LDTT_TRAINER_SHARED_TEMP_PASSWORD;
});

test("the Portal Access box: Super Admin only, plain words, the password is cleared and never shown back", () => {
  const app = read("trainer-backoffice/app.js");
  assert.match(app, /\$\{trainerTempPasswordPanel\(\)\}/);
  assert.match(app, /"Temporary Password for New Trainers"/);
  assert.match(app, /data-trainer-temp-password-form/);
  assert.match(app, /op: "save_temp_password", password/);
  assert.match(app, /input\.value = "";/);
  assert.match(app, /Only a Super Admin can change the trainer temporary password\./);
  const sql = read("supabase/migrations/20260929120000_trainer_temp_password_setting.sql");
  assert.match(sql, /vault\.create_secret/);
  assert.match(sql, /grant execute on function public\.ldtt_read_trainer_temp_password\(\) to service_role;/);
  assert.doesNotMatch(sql, /to (anon|authenticated)/);
});

test("Send welcome email (Super Admin): only a never-signed-in trainer; the saved password is put on the login first, then printed", async () => {
  process.env.RESEND_API_KEY = "re_test"; process.env.RESEND_FROM = "office@lorenzosdogtrainingteam.com";
  const USER = "11111111-2222-4333-8444-555555555555";
  const E = load();
  const setup = (signedIn) => {
    const calls = world({ saved: OFFICE });
    const base = global.fetch;
    global.fetch = async (url, options = {}) => {
      const u = new URL(String(url));
      const res = (status, data) => ({ ok: status < 400, status, headers: { get: () => null }, text: async () => JSON.stringify(data), json: async () => data });
      if (u.pathname.startsWith("/rest/v1/portal_users") && (options.method || "GET") === "GET") { calls.push({ path: u.pathname, method: "GET" }); return res(200, [{ user_id: USER, role: "trainer", active: true, display_name: "Nia Trainer", email: "nia@x.test", must_change_password: true }]); }
      if (u.pathname === `/auth/v1/admin/users/${USER}`) return res(200, { id: USER, email: "nia@x.test", last_sign_in_at: signedIn ? "2026-09-20T00:00:00Z" : null });
      return base(url, options);
    };
    return calls;
  };
  let calls = setup(true);
  let out = await call(E, { op: "send_welcome", user_id: USER });
  assert.equal(out.status, 409, "already signed in: nothing sent");
  assert.equal(calls.filter(c => c.host === "api.resend.com").length, 0);
  calls = setup(false);
  out = await call(E, { op: "send_welcome", user_id: USER });
  assert.equal(out.status, 200, JSON.stringify(out.json));
  const setIdx = calls.findIndex(c => c.path === "/rest/v1/rpc/ldtt_set_new_trainer_temp_password");
  const mailIdx = calls.findIndex(c => c.host === "api.resend.com");
  assert.ok(setIdx >= 0 && mailIdx > setIdx, "password on the login first, then the email");
  assert.ok(calls[mailIdx].body.text.includes(`Temporary password: ${OFFICE}`));
  assert.equal(out.json.login_email.with_password, true);
  assert.ok(!JSON.stringify(out.json).includes(OFFICE), "the screen never gets the password");
  const denied = load({ role: "office_admin" });
  world();
  assert.equal((await call(denied, { op: "send_welcome", user_id: USER })).status, 403);
});
