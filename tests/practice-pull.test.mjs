// Rule 46 (pull-on-read). The practice copy asks the database to copy live in
// before it reads; live's answers stay byte-identical. Node-side proof; the
// database side is tests/practice-pull.sql on a throwaway Postgres.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
process.env.SUPABASE_URL = "http://supabase.test";
process.env.LDTT_SANDBOX = "";
delete process.env.LDTT_PRACTICE_PULL;

const operationalData = require("../api/operational-data.js");

const SUPER = { user_id: "u-super", role: "admin", permission_level: "super_admin", active: true, access_status: "active", email: "joshua@lorenzosdogtrainingteam.com" };
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function makeWorld({ pull = () => json(200, { ok: true, last_ok_at: "2026-09-10T10:00:00.000Z", changed: ["leads"], errors: [] }) } = {}) {
  const calls = [];
  const store = {
    portal_users: [SUPER],
    leads: [{ id: "l-1", status: "new_inquiry", version: 3, updated_at: "2026-09-10T09:00:00.000Z" }],
    trainers: [], trainer_pages: [], ad_pages: [], audit_events: [], lead_events: [], lifecycle_events: [], deals: [], deal_payments: [],
    content_submissions: [], ad_page_revisions: [], site_settings: [], send_to_live_log: []
  };
  globalThis.fetch = async (url, options = {}) => {
    const u = new URL(url);
    const headers = options.headers || {};
    calls.push({ path: u.pathname, method: (options.method || "GET").toUpperCase(), profile: headers["Content-Profile"] || headers["Accept-Profile"] || "", prefer: headers.Prefer || "" });
    if (u.pathname === "/auth/v1/user") {
      const token = String(headers.Authorization || "").replace(/^Bearer\s+/, "");
      return token === "u-super-token" ? json(200, { id: SUPER.user_id, email: SUPER.email }) : json(401, { message: "bad token" });
    }
    if (u.pathname.startsWith("/auth/v1/admin/users")) return json(200, { users: [] });
    if (u.pathname.startsWith("/storage/v1/")) return json(200, []);
    const table = u.pathname.replace("/rest/v1/", "");
    if (table === "rpc/pull_from_live") return pull(options);
    if (table === "rpc/pull_status") return json(200, { last_ok_at: "2026-09-10T09:30:00.000Z" });
    if (table.startsWith("rpc/")) return json(200, { ok: true });
    if (!store[table]) return json(200, []);
    const rows = store[table];
    const res = json(200, rows);
    if (headers.Prefer && /count=exact/.test(headers.Prefer)) res.headers.set("content-range", `0-0/${rows.length}`);
    return res;
  };
  return { calls, store };
}

async function get(query = {}) {
  const res = { statusCode: 200, body: null, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(code) { this.statusCode = code; return this; }, json(payload) { this.body = payload; return this; }, end() { return this; } };
  await operationalData({ method: "GET", headers: { authorization: "Bearer u-super-token" }, query }, res);
  return res;
}

test("live (LDTT_SANDBOX unset): the pull is never called, the JSON carries no practiceSync, countRows sends no profile header", async () => {
  process.env.LDTT_SANDBOX = "";
  const world = makeWorld();
  const res = await get();
  assert.equal(res.statusCode, 200);
  assert.equal(world.calls.some(c => c.path.includes("pull_from_live") || c.path.includes("pull_status")), false, "no pull RPC on live");
  assert.equal("practiceSync" in res.body, false, "no practiceSync key on live");
  const count = world.calls.find(c => /count=exact/.test(c.prefer));
  assert.ok(count, "countRows still asks for an exact count");
  assert.equal(count.profile, "", "live countRows carries no schema profile header");
});

test("practice (LDTT_SANDBOX=1): the pull runs exactly once, before any table read, with the practice profile; the answer carries practiceSync", async () => {
  process.env.LDTT_SANDBOX = "1";
  const world = makeWorld();
  const res = await get();
  assert.equal(res.statusCode, 200);
  const pulls = world.calls.filter(c => c.path === "/rest/v1/rpc/pull_from_live");
  assert.equal(pulls.length, 1, "exactly one pull per request");
  assert.equal(pulls[0].method, "POST");
  assert.equal(pulls[0].profile, "practice", "the RPC resolves in schema practice");
  // The who-am-I lookup (portal_users) must come first: no pull for a refused caller.
  const firstTableRead = world.calls.findIndex(c => c.path.startsWith("/rest/v1/") && !c.path.startsWith("/rest/v1/rpc/") && !c.path.startsWith("/rest/v1/portal_users"));
  const authRead = world.calls.findIndex(c => c.path.startsWith("/rest/v1/portal_users"));
  const pullIndex = world.calls.findIndex(c => c.path === "/rest/v1/rpc/pull_from_live");
  assert.ok(authRead < pullIndex, "the caller is checked before any pull");
  assert.ok(pullIndex < firstTableRead, "the pull happens before the first data read");
  assert.deepEqual(res.body.practiceSync, { ok: true, reason: "pulled", lastMatchedAt: "2026-09-10T10:00:00.000Z", changed: ["leads"], errors: 0 });
  const count = world.calls.find(c => /count=exact/.test(c.prefer));
  assert.equal(count.profile, "practice", "practice countRows counts practice rows");
  process.env.LDTT_SANDBOX = "";
});

test("practice: a hanging pull still answers 200 within the budget, marked not ok with the last matched time; a 500 does the same", async () => {
  process.env.LDTT_SANDBOX = "1";
  const hang = makeWorld({ pull: options => new Promise((resolve, reject) => { options.signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" }))); }) });
  const started = Date.now();
  const res = await get();
  const took = Date.now() - started;
  assert.equal(res.statusCode, 200);
  assert.ok(took < 2500, `answered in ${took} ms`);
  assert.equal(res.body.practiceSync.ok, false);
  assert.equal(res.body.practiceSync.reason, "timeout");
  assert.equal(res.body.practiceSync.lastMatchedAt, "2026-09-10T09:30:00.000Z", "the last matched time comes from pull_status");
  assert.equal(res.body.leads.length, 1, "practice rows are still served");
  void hang;
  makeWorld({ pull: () => json(500, { message: "boom" }) });
  const failed = await get();
  assert.equal(failed.statusCode, 200);
  assert.equal(failed.body.practiceSync.ok, false);
  assert.equal(failed.body.practiceSync.reason, "error");
  process.env.LDTT_SANDBOX = "";
});

test("practice: a failed pull and a good pull produce different revisions for the same rows (so the top bar can change), and LDTT_PRACTICE_PULL=0 switches the pull off", async () => {
  process.env.LDTT_SANDBOX = "1";
  makeWorld();
  const good = await get();
  makeWorld({ pull: () => json(500, { message: "boom" }) });
  const bad = await get();
  assert.notEqual(good.body.serverRevision, bad.body.serverRevision, "revision differs between ok and stale");
  process.env.LDTT_PRACTICE_PULL = "0";
  const off = makeWorld();
  const res = await get();
  assert.equal(off.calls.some(c => c.path.includes("pull_from_live")), false, "env kill switch: no pull call");
  assert.equal(res.body.practiceSync.reason, "env_off");
  delete process.env.LDTT_PRACTICE_PULL;
  process.env.LDTT_SANDBOX = "";
});
