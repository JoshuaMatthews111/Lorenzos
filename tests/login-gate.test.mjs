// release 2026-09-05: real staff logins on the practice copy.
// Joshua: "make sure they can log in with the same login and password they have on
// the live site, same permissions". auth.users is shared between live and the
// practice schema; practice.portal_users is a copy of public.portal_users. These
// tests pin the gates that decide who may sign in where:
//   - the API gate (lib/sandbox.js) lets a REAL staff email through on the practice
//     copy and on live, and refuses ONLY the three sandbox testing logins on live;
//   - the browser gate (trainer-backoffice/app.js) carries the same three emails,
//     is conditioned on !window.LDTT_IS_SANDBOX, and the only gates skipped on the
//     practice copy are must-change-password / complete-your-profile;
//   - a password change on the practice copy is refused (nobody locks themselves
//     out of live), and roles come from portal_users through the schema headers.
// Run: node --test tests/  (tests/ is in .vercelignore; nothing here talks to Supabase.)
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = rel => readFileSync(resolve(root, rel), "utf8");

const SANDBOX_ONLY = ["superadmin@lorenzosdogtrainingteam.com", "officeadmin@lorenzosdogtrainingteam.com", "trainer@lorenzosdogtrainingteam.com"];
const REAL_STAFF = ["angela@lorenzosdogtrainingteam.com", "Tim@LorenzosDogTrainingTeam.com", "production@lorenzosdogtrainingteam.com", "some.trainer@gmail.com"];

function loadSandboxLib(sandbox) {
  delete require.cache[require.resolve("../lib/sandbox.js")];
  if (sandbox) process.env.LDTT_SANDBOX = "1"; else delete process.env.LDTT_SANDBOX;
  return require("../lib/sandbox.js");
}
function fakeRes() {
  return { statusCode: 0, payload: null, status(code) { this.statusCode = code; return this; }, json(data) { this.payload = data; return this; } };
}

test("API gate, practice copy: a real staff email is never refused; the testing logins work too", () => {
  const lib = loadSandboxLib(true);
  assert.equal(lib.isSandbox(), true);
  for (const email of [...REAL_STAFF, ...SANDBOX_ONLY]) {
    const res = fakeRes();
    assert.equal(lib.blockedOutsideSandbox(res, email), false, email);
    assert.equal(res.statusCode, 0, `${email} must not be answered`);
  }
});

test("API gate, live: a real staff email passes; the three sandbox-only logins get 403 and nothing else does", () => {
  const lib = loadSandboxLib(false);
  assert.equal(lib.isSandbox(), false);
  for (const email of REAL_STAFF) {
    const res = fakeRes();
    assert.equal(lib.blockedOutsideSandbox(res, email), false, email);
    assert.equal(res.statusCode, 0);
  }
  for (const email of SANDBOX_ONLY) {
    const res = fakeRes();
    assert.equal(lib.blockedOutsideSandbox(res, email.toUpperCase()), true, email);
    assert.equal(res.statusCode, 403);
    assert.equal(res.payload.sandboxOnlyLogin, true);
  }
  assert.equal(lib.isSandboxOnlyLogin("superadmin@lorenzosdogtrainingteam.com "), true);
  assert.equal(lib.isSandboxOnlyLogin("superadmin2@lorenzosdogtrainingteam.com"), false);
});

test("auth paths pass through the schema switch untouched (logins are shared on purpose); table reads carry the practice profile", () => {
  const lib = loadSandboxLib(true);
  const auth = lib.supabaseRequest("/auth/v1/token?grant_type=password", { apikey: "k" });
  assert.equal(auth.path, "/auth/v1/token?grant_type=password");
  assert.deepEqual(auth.headers, { apikey: "k" });
  const users = lib.supabaseRequest("/rest/v1/portal_users?select=*&user_id=eq.x", {});
  assert.equal(users.headers["Accept-Profile"], "practice");
  assert.equal(users.headers["Content-Profile"], "practice");
  const live = loadSandboxLib(false).supabaseRequest("/rest/v1/portal_users?select=*", {});
  assert.equal(live.headers["Accept-Profile"], undefined);
});

test("browser gate: the same three emails, refused only when !window.LDTT_IS_SANDBOX, at the login box and at boot", () => {
  const app = read("trainer-backoffice/app.js");
  const listed = app.match(/const SANDBOX_ONLY_LOGINS = new Set\(\[([\s\S]*?)\]\);/)[1].match(/"[^"]+"/g).map(s => s.replace(/"/g, ""));
  assert.deepEqual(listed.sort(), [...SANDBOX_ONLY].sort());
  const gates = app.match(/if \(!window\.LDTT_IS_SANDBOX && isSandboxOnlyLogin\(portalUser\)\)/g) || [];
  assert.equal(gates.length, 2, "login submit + session boot");
  assert.equal(/if \(isSandboxOnlyLogin\(portalUser\)\)/.test(app), false, "no unconditional refusal");
  // The environment answer is awaited BEFORE the portal boots, so the flag is set when the gate runs.
  assert.match(app, /applyEnvironmentBadge\(\)\.finally\(\(\) => bootstrapApplication\(\)\);/);
  // The sign-in call itself carries no sandbox condition: same email + password as live.
  const supabase = read("trainer-backoffice/supabase.js");
  assert.match(supabase, /async function signIn\(username, password, options = \{\}\) \{[\s\S]*?"\/auth\/v1\/token\?grant_type=password"/);
  assert.equal(/signIn[\s\S]{0,600}(schema !== "public"|LDTT_IS_SANDBOX|isSandboxOnlyLogin)/.test(supabase.slice(supabase.indexOf("async function signIn"))), false);
});

test("browser: roles come from portal_users through the schema headers; only the password / profile gates are skipped on the practice copy; password change refused there", () => {
  const app = read("trainer-backoffice/app.js");
  const supabase = read("trainer-backoffice/supabase.js");
  assert.match(supabase, /async function currentPortalUser\(\)[\s\S]*?\/rest\/v1\/portal_users\?select=\*&user_id=eq\./);
  assert.match(supabase, /const schemaHeaders = path => \(schema !== "public" && String\(path\)\.startsWith\("\/rest\/v1\/"\) \? \{ "Accept-Profile": schema, "Content-Profile": schema \} : \{\}\);/);
  // must-change-password and complete-your-profile: every forced jump to Settings is sandbox-conditioned.
  const renderView = app.slice(app.indexOf("function renderView()"), app.indexOf("function renderView()") + 900);
  assert.match(renderView, /if \(!window\.LDTT_IS_SANDBOX && portalUser\?\.must_change_password\) \{\n\s*state\.activeView = "settings";/);
  assert.match(renderView, /if \(!window\.LDTT_IS_SANDBOX && portalProfileNeedsCompletion\(\)\) \{\n\s*state\.activeView = "settings";/);
  const bootGate = app.slice(app.indexOf("// Saving a password is refused in the sandbox"), app.indexOf("// Saving a password is refused in the sandbox") + 500);
  assert.match(bootGate, /if \(!window\.LDTT_IS_SANDBOX\) \{\n\s*if \(session\.role === "trainer" && portalUser\?\.must_change_password\)/);
  assert.equal(/^\s*if \(portalUser\?\.must_change_password\) \{\n\s*state\.activeView = "settings";/m.test(app), false, "no unconditional forced Settings jump");
  assert.match(app, /if \(!window\.LDTT_IS_SANDBOX && portalUser\?\.must_change_password && view\.dataset\.view !== "settings"\)/);
  // Access rules that are NOT skipped: disabled / revoked accounts are turned away everywhere.
  assert.equal((app.match(/if \(!portalUserHasAccess\(portalUser\)\)/g) || []).length >= 2, true);
  // Password change is the one login-related thing the practice copy refuses.
  assert.match(supabase, /async function changePassword\(password, profile = \{\}\) \{\n[\s\S]*?await environmentReady;\n\s*if \(schema !== "public"\) throw new Error\(PRACTICE_PASSWORD_MESSAGE\);/);
  assert.match(read("lib/sandbox.js"), /SANDBOX_ONLY_LOGINS = new Set\(\[/);
  const resetApi = read("api/reset-portal-password.js");
  assert.match(resetApi, /blockedInSandbox\(res/);
});
