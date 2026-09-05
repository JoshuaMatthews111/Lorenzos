// portal-auth: one shared verifier (lib/portal-auth.js) behind every portal API.
// Each of the eleven token-checking endpoints is called with a super admin, an
// office admin, a trainer, a DISABLED admin, an admin whose permission_level is
// NULL (must fail closed) and no token, against a fake Supabase. Also covers the
// lead-action role gate in api/communications.js and the form-delivery origin
// check. Run: node --test tests/
// NOT deployed (tests/ is in .vercelignore). Nothing here talks to the real project.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";

const require = createRequire(import.meta.url);
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
process.env.SUPABASE_URL = "http://supabase.test";
process.env.LDTT_SANDBOX = "";
delete process.env.LDTT_EXTRA_ORIGINS;
delete process.env.LDTT_PRACTICE_HOST;

const portalAuth = require("../lib/portal-auth.js");
const operationalData = require("../api/operational-data.js");
const operationalMutation = require("../api/operational-mutation.js");
const managePortalUser = require("../api/manage-portal-user.js");
const pages = require("../api/pages.js");
const sendToLive = require("../api/send-to-live.js");
const communications = require("../api/communications.js");
const submitDeal = require("../api/submit-deal.js");
const socialLinks = require("../api/trainer-social-links.js");
const mediaUploadUrl = require("../api/trainer-media-upload-url.js");
const ensureTrainerUser = require("../api/ensure-trainer-user.js");
const resetPortalPassword = require("../api/reset-portal-password.js");
const practiceReset = require("../api/practice-reset.js");
const formDelivery = require("../api/form-delivery.js");

// Portal rows. Tokens are `${user_id}-token`.
const SUPER = { user_id: "u-super", role: "admin", permission_level: "super_admin", active: true, access_status: "active", email: "joshua@lorenzosdogtrainingteam.com", display_name: "Joshua" };
const OFFICE = { user_id: "u-office", role: "admin", permission_level: "office_admin", active: true, access_status: "active", email: "angela@lorenzosdogtrainingteam.com", first_name: "Angela", last_name: "Office" };
const TRAINER = { user_id: "u-trainer", role: "trainer", permission_level: "trainer", trainer_id: "t-1", active: true, access_status: "active", email: "harley@lorenzosdogtrainingteam.com" };
const DISABLED = { user_id: "u-disabled", role: "admin", permission_level: "super_admin", active: true, access_status: "disabled", email: "gone@lorenzosdogtrainingteam.com" };
const REVOKED = { user_id: "u-revoked", role: "admin", permission_level: "office_admin", active: true, access_status: "revoked", email: "revoked@lorenzosdogtrainingteam.com" };
const NULLPERM = { user_id: "u-nullperm", role: "admin", permission_level: null, active: true, access_status: "active", email: "nullperm@lorenzosdogtrainingteam.com" };
const ODDPERM = { user_id: "u-oddperm", role: "admin", permission_level: "manager", active: true, access_status: "active", email: "odd@lorenzosdogtrainingteam.com" };
const NO_TRAINER_ID = { user_id: "u-orphan", role: "trainer", permission_level: "trainer", trainer_id: null, active: true, access_status: "active", email: "orphan@lorenzosdogtrainingteam.com" };
const SANDBOX_SUPER = { user_id: "u-sandbox-super", role: "admin", permission_level: "super_admin", active: true, access_status: "active", email: "superadmin@lorenzosdogtrainingteam.com" };
const EVERYONE = [SUPER, OFFICE, TRAINER, DISABLED, REVOKED, NULLPERM, ODDPERM, NO_TRAINER_ID, SANDBOX_SUPER];
const TOKENS = { super: "u-super-token", office: "u-office-token", trainer: "u-trainer-token", disabled: "u-disabled-token", nullperm: "u-nullperm-token", none: "" };

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

// A fake Supabase: one in-memory store, PostgREST-style eq filters, RPC stubs,
// storage stubs and the auth endpoints the APIs touch. Unknown tables answer
// an empty list so the wide reads in operational-data get through.
function makeWorld({ portalUsers = EVERYONE, leads = [], trainers = [], pages: pageRows = [], adPages = [] } = {}) {
  const store = {
    portal_users: portalUsers.map(row => ({ ...row })),
    leads, trainers, trainer_pages: pageRows, ad_pages: adPages,
    audit_events: [], lead_events: [], lifecycle_events: [], deals: [], deal_payments: [], content_submissions: [],
    ad_page_revisions: [], site_settings: [], send_to_live_log: []
  };
  const writes = [];
  const rpcs = [];
  const filters = (rows, params) => {
    let out = rows;
    for (const [key, raw] of params) {
      if (["select", "order", "limit", "offset", "on_conflict"].includes(key)) continue;
      const [op, ...rest] = raw.split("."); const value = rest.join(".");
      if (op === "eq") out = out.filter(r => String(r[key]) === value);
      if (op === "neq") out = out.filter(r => String(r[key]) !== value);
      if (op === "is" && value === "null") out = out.filter(r => r[key] == null);
    }
    const limit = Number(params.get("limit") || 0);
    return limit ? out.slice(0, limit) : out;
  };
  const fetch = async (url, options = {}) => {
    const u = new URL(url);
    const method = (options.method || "GET").toUpperCase();
    const headers = options.headers || {};
    if (u.pathname === "/auth/v1/user") {
      const token = String(headers.Authorization || "").replace(/^Bearer\s+/, "");
      if (token === "id-less-token") return json(200, { email: "no-id@test" }); // a 200 with no id
      const pu = portalUsers.find(p => `${p.user_id}-token` === token);
      return pu ? json(200, { id: pu.user_id, email: pu.email }) : json(401, { message: "bad token" });
    }
    if (u.pathname.startsWith("/auth/v1/admin/users")) return json(200, { users: [] });
    if (u.pathname === "/storage/v1/bucket") return json(200, [{ id: "practice-trainer-page-assets" }]);
    if (u.pathname.startsWith("/storage/v1/object/list/")) return json(200, []);
    if (u.pathname.startsWith("/storage/v1/")) return json(200, { Key: "x" });
    const table = u.pathname.replace("/rest/v1/", "");
    const body = options.body ? JSON.parse(options.body) : null;
    if (table.startsWith("rpc/")) {
      const name = table.slice(4);
      rpcs.push({ name, args: body });
      if (name === "communications_claim_lead") return json(200, [{ claimed: true, lead_id: body.p_lead_id, owner_id: body.p_staff_id }]);
      if (name === "reset_from_live_by") return json(200, { reset_at: "2026-09-05T11:00:00.000Z", rows: { leads: 1 }, reset_by_name: body?.reset_by_name });
      return json(200, { ok: true });
    }
    if (!store[table]) return method === "GET" ? json(200, []) : json(404, { message: `no table ${table}` });
    if (method === "GET") return json(200, filters(store[table], u.searchParams));
    writes.push({ table, method, body, params: Object.fromEntries(u.searchParams) });
    if (method === "POST") {
      const rows = (Array.isArray(body) ? body : [body]).map(row => ({ id: randomUUID(), created_at: "2026-09-05T10:00:00.000Z", updated_at: "2026-09-05T10:00:00.000Z", ...row }));
      store[table].push(...rows);
      return json(201, rows);
    }
    if (method === "PATCH") {
      const targets = filters(store[table], u.searchParams);
      targets.forEach(row => Object.assign(row, body));
      return json(200, targets);
    }
    return json(405, { message: "nope" });
  };
  globalThis.fetch = fetch;
  pages.deps.fetch = fetch;
  sendToLive.deps.fetch = fetch;
  practiceReset.deps.fetch = fetch;
  return { store, writes, rpcs, fetch };
}

async function call(fn, { method = "POST", token = TOKENS.super, body = {}, query = {}, headers = {} } = {}) {
  const res = { statusCode: 200, body: null, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(code) { this.statusCode = code; return this; }, json(payload) { this.body = payload; return this; }, end() { return this; } };
  const reqHeaders = { ...headers };
  if (token) reqHeaders.authorization = `Bearer ${token}`;
  await fn({ method, headers: reqHeaders, body, query }, res);
  return res;
}

function quietWarn(run) {
  const warnings = [];
  const original = console.warn;
  console.warn = (...args) => warnings.push(args.map(String).join(" "));
  return Promise.resolve().then(run).finally(() => { console.warn = original; }).then(value => ({ value, warnings }));
}

// ---------------------------------------------------------------------------
// lib/portal-auth.js
// ---------------------------------------------------------------------------
test("lib: roles resolve to super_admin / office_admin / trainer with the right flags and actor", async () => {
  makeWorld();
  const superUser = await portalAuth.verifyPortalUser(TOKENS.super);
  assert.deepEqual([superUser.role, superUser.isAdmin, superUser.isSuperAdmin, superUser.trainerId], ["super_admin", true, true, null]);
  assert.deepEqual(superUser.actor, { id: "u-super", email: "joshua@lorenzosdogtrainingteam.com", name: "Joshua" });
  const office = await portalAuth.verifyPortalUser(TOKENS.office);
  assert.deepEqual([office.role, office.isAdmin, office.isSuperAdmin], ["office_admin", true, false]);
  assert.equal(office.actor.name, "Angela Office");
  const trainer = await portalAuth.verifyPortalUser(TOKENS.trainer);
  assert.deepEqual([trainer.role, trainer.isAdmin, trainer.isSuperAdmin, trainer.trainerId], ["trainer", false, false, "t-1"]);
});

test("lib: require narrows — admin refuses a trainer, super refuses an office admin, trainer refuses admins", async () => {
  makeWorld();
  assert.equal(await portalAuth.verifyPortalUser(TOKENS.trainer, { require: "admin" }), null);
  assert.equal(await portalAuth.verifyPortalUser(TOKENS.office, { require: "super" }), null);
  assert.equal(await portalAuth.verifyPortalUser(TOKENS.super, { require: "trainer" }), null);
  assert.ok(await portalAuth.verifyPortalUser(TOKENS.office, { require: "admin" }));
  assert.ok(await portalAuth.verifyPortalUser(TOKENS.super, { require: "super" }));
  assert.ok(await portalAuth.verifyPortalUser(TOKENS.trainer, { require: "trainer" }));
  await assert.rejects(() => portalAuth.verifyPortalUser(TOKENS.super, { require: "owner" }), /unknown requirement/);
});

test("refused: admin with NULL permission_level fails CLOSED (no admin powers) and is named in a console.warn; an unknown level too", async () => {
  makeWorld();
  const { value, warnings } = await quietWarn(() => portalAuth.verifyPortalUser(TOKENS.nullperm));
  assert.equal(value, null);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /u-nullperm/);
  assert.match(warnings[0], /null/);
  const odd = await quietWarn(() => portalAuth.verifyPortalUser("u-oddperm-token", { require: "any" }));
  assert.equal(odd.value, null);
  assert.match(odd.warnings[0], /u-oddperm/);
});

test("refused: disabled admin, revoked admin, trainer without a trainer_id, unknown role, bad token, no token, a 200 auth answer with no id", async () => {
  makeWorld({ portalUsers: [...EVERYONE, { user_id: "u-guest", role: "guest", permission_level: "super_admin", active: true, access_status: "active", email: "g@test" }] });
  assert.equal(await portalAuth.verifyPortalUser(TOKENS.disabled), null);
  assert.equal(await portalAuth.verifyPortalUser("u-revoked-token"), null);
  assert.equal(await portalAuth.verifyPortalUser("u-orphan-token"), null);
  assert.equal(await portalAuth.verifyPortalUser("u-guest-token"), null);
  assert.equal(await portalAuth.verifyPortalUser("no-such-token"), null);
  assert.equal(await portalAuth.verifyPortalUser(""), null);
  assert.equal(await portalAuth.verifyPortalUser(null), null);
  assert.equal(await portalAuth.verifyPortalUser("id-less-token"), null, "user.id is guarded (communications used to dereference it)");
});

test("lib: an inactive row is never read (active=eq.true is in the query), and the missing-column fallback still resolves the role", async () => {
  const world = makeWorld({ portalUsers: [{ ...SUPER, active: false }, OFFICE, TRAINER] });
  assert.equal(await portalAuth.verifyPortalUser(TOKENS.super), null);
  // Older table without permission_level / access_status: select=* fails, the narrow select answers.
  let calls = 0;
  const legacyFetch = async (url, options) => {
    const u = new URL(url);
    if (u.pathname === "/rest/v1/portal_users") {
      calls += 1;
      if (u.searchParams.get("select") === "*") return json(400, { code: "42703", message: "column portal_users.permission_level does not exist" });
      return json(200, [{ user_id: "u-trainer", role: "trainer", trainer_id: "t-1", active: true }]);
    }
    return world.fetch(url, options);
  };
  const trainer = await portalAuth.verifyPortalUser(TOKENS.trainer, { fetchImpl: legacyFetch });
  assert.equal(calls, 2);
  assert.deepEqual([trainer.role, trainer.trainerId], ["trainer", "t-1"]);
  // Under the same fallback an admin row has no permission_level → refused (fail closed), never promoted.
  const legacyAdmin = async (url, options) => {
    const u = new URL(url);
    if (u.pathname === "/rest/v1/portal_users") {
      if (u.searchParams.get("select") === "*") return json(400, { code: "42703", message: "column portal_users.permission_level does not exist" });
      return json(200, [{ user_id: "u-super", role: "admin", trainer_id: null, active: true }]);
    }
    return world.fetch(url, options);
  };
  const { value } = await quietWarn(() => portalAuth.verifyPortalUser(TOKENS.super, { fetchImpl: legacyAdmin }));
  assert.equal(value, null);
});

test("lib: fetchImpl is honoured and the portal_users read goes through the schema switch (practice profile on the practice copy)", async () => {
  const world = makeWorld();
  const seen = [];
  const spy = async (url, options) => { seen.push({ url: String(url), headers: options?.headers || {} }); return world.fetch(url, options); };
  process.env.LDTT_SANDBOX = "1";
  try {
    const result = await portalAuth.verifyPortalUser(TOKENS.office, { fetchImpl: spy });
    assert.ok(result);
    const read = seen.find(s => s.url.includes("/rest/v1/portal_users"));
    assert.equal(read.headers["Accept-Profile"], "practice");
    assert.equal(seen.find(s => s.url.includes("/auth/v1/user")).headers["Accept-Profile"], undefined, "auth calls carry no profile: logins are shared");
  } finally {
    process.env.LDTT_SANDBOX = "";
  }
});

test("lib: authorizeRequest answers the caller's status/message, and turns the sandbox-only testing logins away on live AFTER the null check", async () => {
  makeWorld();
  const refused = await call(async (req, res) => { const r = await portalAuth.authorizeRequest(req, res, { require: "super", message: "Nope." }); res.body = res.body || { passed: Boolean(r) }; }, { token: TOKENS.office });
  assert.equal(refused.statusCode, 403);
  assert.equal(refused.body.message, "Nope.");
  const none = await call(async (req, res) => { const r = await portalAuth.authorizeRequest(req, res, { status: 401, message: "Sign in." }); res.body = res.body || { passed: Boolean(r) }; }, { token: "" });
  assert.equal(none.statusCode, 401);
  assert.equal(none.body.sandboxOnlyLogin, undefined, "no token is a plain refusal, never the sandbox-login message");
  const sandboxLogin = await call(async (req, res) => { const r = await portalAuth.authorizeRequest(req, res, { require: "super" }); res.body = res.body || { passed: Boolean(r) }; }, { token: "u-sandbox-super-token" });
  assert.equal(sandboxLogin.statusCode, 403);
  assert.equal(sandboxLogin.body.sandboxOnlyLogin, true);
  process.env.LDTT_SANDBOX = "1";
  try {
    const onPractice = await call(async (req, res) => { const r = await portalAuth.authorizeRequest(req, res, { require: "super" }); res.status(200).json({ passed: Boolean(r) }); }, { token: "u-sandbox-super-token" });
    assert.equal(onPractice.body.passed, true, "the testing login works on the practice copy");
  } finally {
    process.env.LDTT_SANDBOX = "";
  }
});

// ---------------------------------------------------------------------------
// The eleven endpoints
// ---------------------------------------------------------------------------
test("operational-data: every role reads, a trainer gets only their own trainer's rows, refused: disabled admin, NULL permission_level, no token (403)", async () => {
  makeWorld({
    leads: [{ id: "l-1", trainer_id: "t-1", status: "new" }, { id: "l-2", trainer_id: "t-2", status: "new" }, { id: "l-3", trainer_id: null, status: "new" }],
    trainers: [{ id: "t-1", slug: "one", full_name: "One", status: "active" }, { id: "t-2", slug: "two", full_name: "Two", status: "active" }],
    pages: [{ id: "p-1", trainer_id: "t-1", slug: "one" }, { id: "p-2", trainer_id: "t-2", slug: "two" }]
  });
  const get = token => call(operationalData, { method: "GET", token });
  const asSuper = await get(TOKENS.super);
  assert.equal(asSuper.statusCode, 200);
  assert.equal(asSuper.body.leads.length, 3, "office staff see every lead");
  assert.equal((await get(TOKENS.office)).statusCode, 200);
  const asTrainer = await get(TOKENS.trainer);
  assert.equal(asTrainer.statusCode, 200);
  assert.deepEqual(asTrainer.body.leads.map(l => l.id), ["l-1"], "a trainer sees only leads with their own trainer_id");
  assert.deepEqual(asTrainer.body.pages.map(p => p.id), ["p-1"]);
  assert.equal((await get(TOKENS.disabled)).statusCode, 403);
  assert.equal((await quietWarn(() => get(TOKENS.nullperm))).value.statusCode, 403);
  assert.equal((await get(TOKENS.none)).statusCode, 403);
});

test("operational-mutation permanent_delete: super passes the gate, refused: office (403 super-only), trainer, disabled, NULL permission_level, no token (403)", async () => {
  makeWorld();
  const del = token => call(operationalMutation, { token, body: { operation: "permanent_delete", entity_type: "lead", id: "missing" } });
  const asSuper = await del(TOKENS.super);
  assert.notEqual(asSuper.statusCode, 403, `super admin reaches the operation (got ${asSuper.statusCode}: ${asSuper.body?.message})`);
  const asOffice = await del(TOKENS.office);
  assert.equal(asOffice.statusCode, 403);
  assert.match(asOffice.body.message, /Only a Super Admin can permanently delete/);
  const asTrainer = await del(TOKENS.trainer);
  assert.equal(asTrainer.statusCode, 403);
  assert.equal(asTrainer.body.message, "Active Admin or Office Admin access required.");
  assert.equal((await del(TOKENS.disabled)).statusCode, 403);
  assert.equal((await quietWarn(() => del(TOKENS.nullperm))).value.statusCode, 403);
  assert.equal((await del(TOKENS.none)).statusCode, 403);
});

test("manage-portal-user: super only; refused: office, trainer, disabled, NULL permission_level, no token (403); the sandbox testing login gets its own 403 only AFTER the null check", async () => {
  makeWorld();
  const manage = token => call(managePortalUser, { token, body: { action: "disable", user_id: "u-office" } });
  const asSuper = await manage(TOKENS.super);
  assert.equal(asSuper.statusCode, 200, asSuper.body?.message);
  for (const token of [TOKENS.office, TOKENS.trainer, TOKENS.disabled]) {
    const res = await manage(token);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.message, "Active Super Admin access required.");
  }
  assert.equal((await quietWarn(() => manage(TOKENS.nullperm))).value.statusCode, 403);
  const none = await manage(TOKENS.none);
  assert.equal(none.statusCode, 403);
  assert.equal(none.body.sandboxOnlyLogin, undefined);
  const sandboxLogin = await manage("u-sandbox-super-token");
  assert.equal(sandboxLogin.statusCode, 403);
  assert.equal(sandboxLogin.body.sandboxOnlyLogin, true);
});

test("pages archive: super passes, refused: office (403 super-only), trainer, disabled, NULL permission_level, no token (403)", async () => {
  makeWorld({ adPages: [{ id: "ad-1", slug: "dog-training-toledo-oh", page_type: "ad", status: "draft", draft_content: {} }] });
  const archive = token => call(pages, { token, body: { operation: "archive", id: "ad-1" } });
  const asSuper = await archive(TOKENS.super);
  assert.equal(asSuper.statusCode, 200, asSuper.body?.message);
  const asOffice = await archive(TOKENS.office);
  assert.equal(asOffice.statusCode, 403);
  assert.match(asOffice.body.message, /Only a Super Admin can remove a page/);
  const asTrainer = await archive(TOKENS.trainer);
  assert.equal(asTrainer.statusCode, 403);
  assert.match(asTrainer.body.message, /Page Studio is for office staff/);
  assert.equal((await archive(TOKENS.disabled)).statusCode, 403);
  assert.equal((await quietWarn(() => archive(TOKENS.nullperm))).value.statusCode, 403);
  assert.equal((await archive(TOKENS.none)).statusCode, 403);
  // Office staff still list pages (admin, not super).
  assert.equal((await call(pages, { method: "GET", token: TOKENS.office, query: { operation: "list" } })).statusCode, 200);
});

test("send-to-live (practice copy): office and super pass, refused: trainer, disabled, NULL permission_level, no token (403)", async () => {
  process.env.LDTT_SANDBOX = "1";
  try {
    makeWorld();
    const send = token => call(sendToLive, { token, body: { kind: "nothing", id: "x", sent_by_name: "Angela Office" } });
    for (const token of [TOKENS.super, TOKENS.office]) {
      const res = await send(token);
      assert.equal(res.statusCode, 400, `office staff reach the operation (got ${res.statusCode}: ${res.body?.message})`);
    }
    for (const token of [TOKENS.trainer, TOKENS.disabled, TOKENS.none]) assert.equal((await send(token)).statusCode, 403);
    assert.equal((await quietWarn(() => send(TOKENS.nullperm))).value.statusCode, 403);
  } finally {
    process.env.LDTT_SANDBOX = "";
  }
});

test("communications lead actions: office acts on any lead; a trainer only on a lead assigned to them (403 otherwise, nothing called); refused: disabled, NULL permission_level, no token", async () => {
  const world = makeWorld({ leads: [
    { id: "l-mine", trainer_id: "t-1", status: "new", claimed_by: null },
    { id: "l-theirs", trainer_id: "t-2", status: "new", claimed_by: null },
    { id: "l-nobody", trainer_id: null, status: "new", claimed_by: null }
  ] });
  const act = (operation, lead_id, token) => call(communications, { token, body: { operation, lead_id } });
  assert.equal((await act("claim_lead", "l-mine", TOKENS.trainer)).statusCode, 200);
  const theirs = await act("claim_lead", "l-theirs", TOKENS.trainer);
  assert.equal(theirs.statusCode, 403);
  assert.match(theirs.body.message, /Only the office or the trainer this lead is assigned to/);
  assert.equal((await act("claim_lead", "l-nobody", TOKENS.trainer)).statusCode, 403, "an unassigned lead is not a trainer's to claim");
  assert.equal((await act("release_lead", "l-theirs", TOKENS.trainer)).statusCode, 403);
  assert.equal((await act("mark_contacted", "l-theirs", TOKENS.trainer)).statusCode, 403);
  assert.deepEqual(world.rpcs.map(r => r.args.p_lead_id), ["l-mine"], "no RPC ran for the refused calls");
  assert.equal((await act("claim_lead", "l-theirs", TOKENS.office)).statusCode, 200);
  assert.equal((await act("mark_contacted", "l-nobody", TOKENS.super)).statusCode, 200);
  assert.equal((await act("claim_lead", "l-mine", TOKENS.disabled)).statusCode, 403);
  assert.equal((await quietWarn(() => act("claim_lead", "l-mine", TOKENS.nullperm))).value.statusCode, 403);
  assert.equal((await act("claim_lead", "l-mine", TOKENS.none)).statusCode, 403);
  // Per-op admin gates still hold: a trainer cannot save an alert list.
  assert.equal((await call(communications, { token: TOKENS.trainer, body: { operation: "save_alert_list", name: "x" } })).statusCode, 403);
  assert.equal((await call(communications, { method: "GET", token: TOKENS.trainer, query: { operation: "load" } })).statusCode, 200);
});

test("submit-deal: any active portal user; a trainer is pinned to their own trainer_id even when the body names another; refused: disabled, NULL permission_level, no token (403)", async () => {
  const world = makeWorld();
  const deal = (token, extra = {}) => call(submitDeal, { token, body: { client_name: "Sam", program: "Basic", sold_amount: 100, collected_amount: 100, trainer_id: "t-2", ...extra } });
  const asTrainer = await deal(TOKENS.trainer);
  assert.equal(asTrainer.statusCode, 200, asTrainer.body?.message);
  assert.equal(world.store.deals[0].trainer_id, "t-1", "body trainer_id ignored for a trainer");
  const asOffice = await deal(TOKENS.office);
  assert.equal(asOffice.statusCode, 200);
  assert.equal(world.store.deals[1].trainer_id, "t-2", "office staff may submit for a named trainer");
  assert.equal((await deal(TOKENS.super)).statusCode, 200);
  assert.equal((await deal(TOKENS.disabled)).statusCode, 403);
  assert.equal((await quietWarn(() => deal(TOKENS.nullperm))).value.statusCode, 403);
  assert.equal((await deal(TOKENS.none)).statusCode, 403);
});

test("trainer-social-links: a trainer writes their own row only; refused: disabled, NULL permission_level, no token (403)", async () => {
  const world = makeWorld({
    trainers: [{ id: "t-1", slug: "one", full_name: "One", status: "active" }, { id: "t-2", slug: "two", full_name: "Two", status: "active" }],
    pages: [{ id: "p-1", trainer_id: "t-1", slug: "one" }, { id: "p-2", trainer_id: "t-2", slug: "two" }]
  });
  const save = token => call(socialLinks, { token, body: { trainer_id: "t-2", instagram: "https://instagram.com/one" } });
  const asTrainer = await save(TOKENS.trainer);
  assert.equal(asTrainer.statusCode, 200, asTrainer.body?.message);
  assert.equal(asTrainer.body.trainer_id, "t-1");
  assert.equal(world.store.trainer_pages[1].social_instagram, undefined, "the other trainer's page is untouched");
  const asOffice = await save(TOKENS.office);
  assert.equal(asOffice.body.trainer_id, "t-2", "office staff may name the trainer");
  assert.equal((await save(TOKENS.disabled)).statusCode, 403);
  assert.equal((await quietWarn(() => save(TOKENS.nullperm))).value.statusCode, 403);
  assert.equal((await save(TOKENS.none)).statusCode, 403);
});

test("trainer-media-upload-url: office staff only; refused: trainer, DISABLED admin (used to pass), NULL permission_level, no token (403)", async () => {
  makeWorld();
  const upload = token => call(mediaUploadUrl, { token, body: {} });
  for (const token of [TOKENS.super, TOKENS.office]) {
    const res = await upload(token);
    assert.notEqual(res.statusCode, 403, `office staff reach the operation (got ${res.statusCode})`);
  }
  for (const token of [TOKENS.trainer, TOKENS.disabled, TOKENS.none]) {
    const res = await upload(token);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.message, "Active Admin or Office Admin access required.");
  }
  assert.equal((await quietWarn(() => upload(TOKENS.nullperm))).value.statusCode, 403);
});

test("ensure-trainer-user: office staff only; refused: trainer, DISABLED admin (used to pass), NULL permission_level (used to pass), no token (403)", async () => {
  makeWorld();
  const ensure = token => call(ensureTrainerUser, { token, body: {} });
  for (const token of [TOKENS.super, TOKENS.office]) assert.equal((await ensure(token)).statusCode, 400, "office staff reach the validation step");
  for (const token of [TOKENS.trainer, TOKENS.disabled, TOKENS.none]) {
    const res = await ensure(token);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.message, "Active admin access required.");
  }
  assert.equal((await quietWarn(() => ensure(TOKENS.nullperm))).value.statusCode, 403);
});

test("reset-portal-password: super only; refused: office, trainer, DISABLED super (used to pass), NULL permission_level, no token (403)", async () => {
  makeWorld();
  const reset = token => call(resetPortalPassword, { token, body: {} });
  assert.equal((await reset(TOKENS.super)).statusCode, 400, "super admin reaches the validation step");
  for (const token of [TOKENS.office, TOKENS.trainer, TOKENS.disabled, TOKENS.none]) {
    const res = await reset(token);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.message, "Super Admin access required.");
  }
  assert.equal((await quietWarn(() => reset(TOKENS.nullperm))).value.statusCode, 403);
});

test("practice-reset: 404 for everyone when LDTT_SANDBOX is unset; on the practice copy super only, refused: office, trainer, disabled, NULL permission_level, no token (403)", async () => {
  makeWorld();
  const reset = token => call(practiceReset, { token, body: { reset_by_name: "Joshua Matthews" } });
  assert.equal((await reset(TOKENS.super)).statusCode, 404);
  process.env.LDTT_SANDBOX = "1";
  try {
    makeWorld();
    const asSuper = await reset(TOKENS.super);
    assert.equal(asSuper.statusCode, 200, asSuper.body?.message);
    for (const token of [TOKENS.office, TOKENS.trainer, TOKENS.disabled, TOKENS.none]) {
      const res = await reset(token);
      assert.equal(res.statusCode, 403);
      assert.equal(res.body.message, "Super Admin access required.");
    }
    assert.equal((await quietWarn(() => reset(TOKENS.nullperm))).value.statusCode, 403);
  } finally {
    process.env.LDTT_SANDBOX = "";
  }
});

// ---------------------------------------------------------------------------
// api/form-delivery.js origin check
// ---------------------------------------------------------------------------
test("form-delivery allowedOrigin: the site, the practice site, localhost and LDTT_EXTRA_ORIGINS pass; a random vercel.app is refused off the practice copy; no Origin falls back to Referer; neither is refused", () => {
  const { allowedOrigin } = formDelivery;
  const req = headers => ({ headers });
  assert.equal(allowedOrigin(req({ origin: "https://www.lorenzosdogtrainingteam.com" })), true);
  assert.equal(allowedOrigin(req({ origin: "https://lorenzosdogtrainingteam.com" })), true);
  assert.equal(allowedOrigin(req({ origin: "https://practice.lorenzosdogtrainingteam.com" })), true);
  assert.equal(allowedOrigin(req({ origin: "http://localhost:3000" })), true);
  assert.equal(allowedOrigin(req({ origin: "http://127.0.0.1" })), true);
  assert.equal(allowedOrigin(req({ origin: "http://lorenzosdogtrainingteam.com" })), false, "the live site is https only");
  assert.equal(allowedOrigin(req({ origin: "https://evil.example.com" })), false);
  assert.equal(allowedOrigin(req({ origin: "https://lorenzosdogtrainingteam.com.evil.example" })), false);
  assert.equal(allowedOrigin(req({ origin: "https://ldtt-site-abc123-joshuamatthews111s-projects.vercel.app" })), false, "previews are refused off the practice copy");
  assert.equal(allowedOrigin(req({ referer: "https://www.lorenzosdogtrainingteam.com/contact.html" })), true, "no Origin → Referer host");
  assert.equal(allowedOrigin(req({ referer: "https://evil.example.com/contact.html" })), false);
  assert.equal(allowedOrigin(req({})), false, "no Origin and no Referer is refused");
  assert.equal(allowedOrigin(req({ origin: "null" })), false);
  process.env.LDTT_SANDBOX = "1";
  try {
    assert.equal(allowedOrigin(req({ origin: "https://ldtt-site-abc123-joshuamatthews111s-projects.vercel.app" })), true, "previews pass on the practice copy (the handler answers 423 there anyway)");
    assert.equal(allowedOrigin(req({ origin: "https://evil.example.com" })), false);
  } finally {
    process.env.LDTT_SANDBOX = "";
  }
  process.env.LDTT_EXTRA_ORIGINS = "https://staging.example.com, partner.example.org";
  process.env.LDTT_PRACTICE_HOST = "sandbox.lorenzosdogtrainingteam.com";
  try {
    assert.equal(allowedOrigin(req({ origin: "https://staging.example.com" })), true);
    assert.equal(allowedOrigin(req({ origin: "https://partner.example.org" })), true);
    assert.equal(allowedOrigin(req({ origin: "https://sandbox.lorenzosdogtrainingteam.com" })), true);
    assert.equal(allowedOrigin(req({ origin: "https://practice.lorenzosdogtrainingteam.com" })), false, "the practice host is whatever LDTT_PRACTICE_HOST says");
  } finally {
    delete process.env.LDTT_EXTRA_ORIGINS;
    delete process.env.LDTT_PRACTICE_HOST;
  }
});

test("form-delivery handler: a post with no Origin and no Referer is answered 403 before anything is read", async () => {
  makeWorld();
  const res = await call(formDelivery, { token: "", body: { form_type: "contact", entries: {} }, headers: {} });
  assert.equal(res.statusCode, 403);
  assert.match(res.body.message, /origin is not allowed/);
});
