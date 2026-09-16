// Practice copy only: one-click trainer sign-in with no password (Joshua 2026-09-16), api/sandbox-trainer-login.js.
// Off the practice copy the route must not exist (404), on it only ACTIVE TRAINER rows may be listed or used,
// and no password is ever touched. Run: node --test tests/
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
process.env.SUPABASE_URL = "http://supabase.test";
const handler = require("../api/sandbox-trainer-login.js");
const read = path => readFileSync(resolve(import.meta.dirname, "..", path), "utf8");

const USERS = [
  { user_id: "u-harley", email: "harley@example.com", role: "trainer", active: true, access_status: "active", trainer_id: "t-1" },
  { user_id: "u-shannon", email: "shannon@example.com", role: "trainer", active: true, access_status: "active", trainer_id: "t-2" },
  { user_id: "u-old", email: "old@example.com", role: "trainer", active: false, access_status: "active", trainer_id: "t-3" },
  { user_id: "u-revoked", email: "revoked@example.com", role: "trainer", active: true, access_status: "revoked", trainer_id: "t-4" },
  { user_id: "u-orphan", email: "orphan@example.com", role: "trainer", active: true, access_status: "active", trainer_id: "t-gone" },
  { user_id: "u-office", email: "angela@example.com", role: "admin", permission_level: "office_admin", active: true, access_status: "active", trainer_id: null },
  { user_id: "u-super", email: "superadmin@lorenzosdogtrainingteam.com", role: "admin", permission_level: "super_admin", active: true, access_status: "active", trainer_id: null }
];
const TRAINERS = [
  { id: "t-1", full_name: "Harley McGrew", market: "Cleveland", state: "OH" },
  { id: "t-2", full_name: "Shannon Paskins", market: "Pensacola", state: "FL" },
  { id: "t-3", full_name: "Old Trainer", market: "Chicago", state: "IL" },
  { id: "t-4", full_name: "Revoked Trainer", market: "Atlanta", state: "GA" }
];
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

// Fake Supabase: PostgREST reads on portal_users / trainers and the auth admin generate_link call.
function world() {
  const calls = [];
  const filter = (rows, params) => {
    let out = rows;
    for (const [key, raw] of params) {
      if (["select", "order", "limit"].includes(key)) continue;
      const [op, ...rest] = raw.split("."); const value = rest.join(".");
      if (op === "eq") out = out.filter(r => String(r[key]) === value);
      else if (op === "not" && value === "is.null") out = out.filter(r => r[key] !== null && r[key] !== undefined);
      else if (op === "in") out = out.filter(r => value.replace(/^\(|\)$/g, "").split(",").map(decodeURIComponent).includes(String(r[key])));
    }
    return out;
  };
  globalThis.fetch = async (url, options = {}) => {
    const u = new URL(url);
    const method = (options.method || "GET").toUpperCase();
    calls.push({ path: u.pathname, method, headers: options.headers || {}, body: options.body ? JSON.parse(options.body) : null });
    if (u.pathname === "/auth/v1/admin/generate_link") {
      const body = JSON.parse(options.body);
      return json(200, { email: body.email, properties: { action_link: "https://never-returned.example/x", hashed_token: `hash-for-${body.email}`, verification_type: body.type } });
    }
    if (u.pathname === "/rest/v1/portal_users") return json(200, filter(USERS.map(r => ({ ...r })), u.searchParams));
    if (u.pathname === "/rest/v1/trainers") return json(200, filter(TRAINERS.map(r => ({ ...r })), u.searchParams));
    return json(404, { message: `unexpected ${method} ${u.pathname}` });
  };
  return { calls };
}

async function call(method, body) {
  const res = { statusCode: 200, body: null, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(code) { this.statusCode = code; return this; }, json(p) { this.body = p; return this; }, end() { return this; } };
  await handler({ method, headers: {}, body, query: {} }, res);
  return res;
}

test("off the practice copy (LDTT_SANDBOX unset) the route does not exist: 404 for GET and POST, Supabase never called", async () => {
  process.env.LDTT_SANDBOX = "";
  const w = world();
  const get = await call("GET");
  assert.equal(get.statusCode, 404);
  assert.deepEqual(get.body, { ok: false });
  const post = await call("POST", { email: "harley@example.com" });
  assert.equal(post.statusCode, 404);
  assert.deepEqual(post.body, { ok: false });
  assert.equal(w.calls.length, 0, "live never talks to Supabase for this route");
  delete process.env.LDTT_SANDBOX;
  const unset = await call("POST", { email: "harley@example.com" });
  assert.equal(unset.statusCode, 404);
  assert.equal(w.calls.length, 0);
});

test("practice copy GET lists only active trainer rows joined to a trainer, with no ids or secrets", async () => {
  process.env.LDTT_SANDBOX = "1";
  const w = world();
  const res = await call("GET");
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(res.body.ok, true);
  assert.deepEqual(res.body.trainers, [
    { email: "harley@example.com", full_name: "Harley McGrew", market: "Cleveland", state: "OH" },
    { email: "shannon@example.com", full_name: "Shannon Paskins", market: "Pensacola", state: "FL" }
  ], "inactive, revoked, orphaned and admin rows are left out");
  assert.ok(!JSON.stringify(res.body).includes("user_id"), "no auth ids in the answer");
  assert.ok(!JSON.stringify(res.body).includes("token"), "no tokens in the answer");
  const read = w.calls.find(c => c.path === "/rest/v1/portal_users");
  assert.equal(read.headers["Accept-Profile"], "practice", "reads practice.portal_users through supabaseRequest()");
  assert.equal(res.headers["Cache-Control"], "no-store, max-age=0");
});

test("practice copy POST for an admin / office email answers 403 and never asks Supabase for a token", async () => {
  process.env.LDTT_SANDBOX = "1";
  const w = world();
  for (const email of ["angela@example.com", "superadmin@lorenzosdogtrainingteam.com", "officeadmin@lorenzosdogtrainingteam.com", "nobody@example.com", "old@example.com", "revoked@example.com"]) {
    const res = await call("POST", { email });
    assert.equal(res.statusCode, 403, `${email}: ${JSON.stringify(res.body)}`);
    assert.equal(res.body.ok, false);
  }
  assert.equal(w.calls.filter(c => c.path === "/auth/v1/admin/generate_link").length, 0, "no magic link for a non-trainer");
  assert.equal(w.calls.filter(c => c.path.startsWith("/auth/v1/admin/users")).length, 0, "no auth user is ever written");
});

test("practice copy POST for an active trainer returns the magic-link token hash only (no action link, no password change)", async () => {
  process.env.LDTT_SANDBOX = "1";
  const w = world();
  const res = await call("POST", { email: "Harley@Example.com " });
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.deepEqual(res.body, { ok: true, sandbox: true, email: "harley@example.com", token_hash: "hash-for-harley@example.com" });
  const link = w.calls.find(c => c.path === "/auth/v1/admin/generate_link");
  assert.deepEqual(link.body, { type: "magiclink", email: "harley@example.com" });
  assert.ok(!JSON.stringify(res.body).includes("never-returned"), "the action_link stays on the server");
  assert.ok(!w.calls.some(c => c.body && Object.prototype.hasOwnProperty.call(c.body, "password")), "no password is set, changed or removed");
  assert.ok(!w.calls.some(c => c.method === "PUT" || c.method === "PATCH" || c.method === "DELETE"), "nothing is written");
});

test("the browser only draws the box on the practice copy and reuses the password sign-in path", () => {
  const html = read("trainer-backoffice/index.html");
  const app = read("trainer-backoffice/app.js");
  const portal = read("trainer-backoffice/supabase.js");
  assert.match(html, /id="sandboxTrainerLogin" hidden/, "the box ships hidden");
  assert.match(app, /async function setupSandboxTrainerLogin\(\) \{\s*if \(window\.LDTT_IS_SANDBOX !== true/, "shown only when /api/environment said sandbox");
  assert.match(app, /async function sandboxTrainerSignIn\([^)]*\) \{\s*if \(window\.LDTT_IS_SANDBOX !== true\) return;/, "the click does nothing off the practice copy");
  assert.match(app, /await window\.LDTT_PORTAL\.verifyPracticeTokenHash\(result\.token_hash, \{ remember \}\);\s*await finishPortalSignIn\(status\);/, "same post-login path as a password sign-in");
  assert.match(app, /await window\.LDTT_PORTAL\.signIn\(username, password, \{ remember: [^}]+\}\);[\s\S]{0,400}await finishPortalSignIn\(status\);/, "the password login uses the shared path too");
  assert.match(app, /document\.body\.classList\.add\("is-sandbox"\);\s*setupSandboxTrainerLogin\(\);/, "set up only once /api/environment answered sandbox");
  assert.match(app, /applyEnvironmentBadge\(\)\.finally\(\(\) => bootstrapApplication\(\)\);/, "the boot line is unchanged");
  assert.match(portal, /async function verifyPracticeTokenHash[\s\S]{0,300}window\.LDTT_IS_SANDBOX !== true\) throw/, "the portal client refuses the token exchange off the practice copy");
  assert.match(portal, /"\/auth\/v1\/verify"[\s\S]{0,200}type: "magiclink"/, "magic-link verify, not a password grant");
  const exchange = portal.slice(portal.indexOf("async function verifyPracticeTokenHash"), portal.indexOf("async function changePassword"));
  assert.doesNotMatch(exchange, /grant_type=password|password:/i, "the token exchange never sends a password");
  assert.match(exchange, /writeSession\(session, options\.remember === true\)/, "stored exactly like a password session");
});
