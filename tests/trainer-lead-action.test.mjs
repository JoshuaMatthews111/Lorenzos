// Rule 83 (Joshua 2026-09-14, option A): trainers mark THEIR OWN leads Eval completed / Lost (with a reason) /
// Added to Alpha through api/trainer-lead-action.js, logged like an office change. Run: node --test tests/
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
process.env.SUPABASE_URL = "http://supabase.test";
process.env.LDTT_SANDBOX = "";
const handler = require("../api/trainer-lead-action.js");
const read = path => readFileSync(resolve(import.meta.dirname, "..", path), "utf8");

const USERS = [
  { user_id: "u-trainer", role: "trainer", permission_level: "trainer", trainer_id: "t-1", active: true, access_status: "active", email: "harley@example.com", first_name: "Harley", last_name: "McGrew" },
  { user_id: "u-other", role: "trainer", permission_level: "trainer", trainer_id: "t-2", active: true, access_status: "active", email: "other@example.com" },
  { user_id: "u-office", role: "admin", permission_level: "office_admin", active: true, access_status: "active", email: "angela@example.com", first_name: "Angela", last_name: "Office" }
];
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function world(status = "evaluation_scheduled", extra = {}) {
  const id = randomUUID();
  const store = {
    portal_users: USERS.map(u => ({ ...u })),
    leads: [{ id, trainer_id: "t-1", status, version: 3, added_to_alpha: false, first_name: "Priya", trainer_market: "Cleveland, OH", raw_payload: {}, ...extra }],
    audit_events: [], lifecycle_events: [], lead_events: []
  };
  const writes = [];
  const pick = (rows, params) => {
    let out = rows;
    for (const [key, raw] of params) {
      if (["select", "order", "limit", "on_conflict"].includes(key)) continue;
      const [op, ...rest] = raw.split("."); const value = rest.join(".");
      if (op === "eq") out = out.filter(r => String(r[key]) === value);
    }
    return out;
  };
  globalThis.fetch = async (url, options = {}) => {
    const u = new URL(url);
    const method = (options.method || "GET").toUpperCase();
    const headers = options.headers || {};
    if (u.pathname === "/auth/v1/user") {
      const token = String(headers.Authorization || headers.authorization || "").replace(/^Bearer\s+/, "");
      const pu = USERS.find(p => `${p.user_id}-token` === token);
      return pu ? json(200, { id: pu.user_id, email: pu.email }) : json(401, { message: "bad token" });
    }
    const table = u.pathname.replace("/rest/v1/", "");
    if (!store[table]) return method === "GET" ? json(200, []) : json(404, {});
    const body = options.body ? JSON.parse(options.body) : null;
    if (method === "GET") return json(200, pick(store[table], u.searchParams));
    writes.push({ table, method, body });
    if (method === "POST") { const rows = (Array.isArray(body) ? body : [body]).map(r => ({ id: randomUUID(), ...r })); store[table].push(...rows); return json(201, rows); }
    if (method === "PATCH") { const hits = pick(store[table], u.searchParams); hits.forEach(r => { Object.assign(r, body); if (table === "leads") r.version += 1; }); return json(200, hits); }
    return json(405, {});
  };
  return { store, writes, id };
}

async function call(body, token = "u-trainer-token") {
  const res = { statusCode: 200, body: null, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(code) { this.statusCode = code; return this; }, json(p) { this.body = p; return this; }, end() { return this; } };
  await handler({ method: "POST", headers: token ? { authorization: `Bearer ${token}` } : {}, body, query: {} }, res);
  return res;
}

test("eval completed: only from Evaluation Scheduled; logged like an office change (audit + funnel + status event)", async () => {
  const w = world();
  const res = await call({ action: "eval_completed", lead_id: w.id, expected_version: 3 });
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(w.store.leads[0].status, "evaluation_complete");
  assert.equal(w.store.audit_events[0].action, "trainer_lead_eval_completed");
  assert.equal(w.store.audit_events[0].actor_email, "harley@example.com");
  assert.equal(w.store.lifecycle_events[0].event_type, "evaluation_completed", "the funnel counts it like an office change");
  assert.deepEqual([w.store.lead_events[0].previous_status, w.store.lead_events[0].new_status], ["evaluation_scheduled", "evaluation_complete"]);
  const patch = w.writes.find(x => x.table === "leads");
  assert.deepEqual(Object.keys(patch.body), ["status"], "no other lead field is written");
  const again = await call({ action: "eval_completed", lead_id: w.id });
  assert.equal(again.statusCode, 409, "a lead that is not Evaluation Scheduled cannot be marked");
});

test("lost: needs a reason; maps to the Lost statuses; no-response feeds the funnel; a closed lead is refused", async () => {
  const price = world("office_contacted");
  assert.equal((await call({ action: "lost", lead_id: price.id })).statusCode, 400);
  const ok = await call({ action: "lost", lead_id: price.id, reason: "price", note: "Wants to wait until spring" });
  assert.equal(ok.statusCode, 200, JSON.stringify(ok.body));
  assert.equal(price.store.leads[0].status, "lost_price_concern");
  assert.equal(price.store.lifecycle_events.length, 0, "only no-response is a funnel event, like the office");
  assert.equal(price.store.lead_events[0].note, "Wants to wait until spring");
  assert.match(price.store.audit_events[0].summary, /Note: Wants to wait until spring/);
  const quiet = world("evaluation_complete");
  await call({ action: "lost", lead_id: quiet.id, reason: "no_response" });
  assert.equal(quiet.store.leads[0].status, "lost_no_response");
  assert.equal(quiet.store.lifecycle_events[0].event_type, "lost_no_response");
  for (const closed of ["became_client", "do_not_contact", "archived", "lost_not_ready"]) {
    const w = world(closed);
    assert.equal((await call({ action: "lost", lead_id: w.id, reason: "price" })).statusCode, 409, closed);
    assert.equal(w.writes.length, 0);
  }
});

test("added to Alpha: yes / no, no status change, audited", async () => {
  const w = world("evaluation_complete");
  const yes = await call({ action: "alpha", lead_id: w.id, value: true });
  assert.equal(yes.statusCode, 200);
  assert.equal(w.store.leads[0].added_to_alpha, true);
  assert.equal(w.store.leads[0].status, "evaluation_complete");
  assert.equal(w.store.lead_events.length, 0);
  assert.equal(w.store.audit_events[0].action, "trainer_lead_alpha");
  await call({ action: "alpha", lead_id: w.id, value: false });
  assert.equal(w.store.leads[0].added_to_alpha, false);
});

test("only the trainer the lead is assigned to (or the office); stale versions and bad input write nothing", async () => {
  const w = world();
  assert.equal((await call({ action: "eval_completed", lead_id: w.id }, "u-other-token")).statusCode, 403);
  assert.notEqual((await call({ action: "eval_completed", lead_id: w.id }, "")).statusCode, 200, "no token, no change");
  assert.equal((await call({ action: "eval_completed", lead_id: w.id, expected_version: 1 })).statusCode, 409);
  assert.equal((await call({ action: "delete", lead_id: w.id })).statusCode, 400);
  assert.equal((await call({ action: "alpha", lead_id: "not-an-id" })).statusCode, 400);
  assert.equal(w.writes.length, 0, "nothing was written");
  const office = await call({ action: "eval_completed", lead_id: w.id }, "u-office-token");
  assert.equal(office.statusCode, 200, "the office may do it too");
});

test("the door is the trainer's own (rule 7) and uses the schema switch (rule 5); the panel offers it", () => {
  const src = read("api/trainer-lead-action.js");
  assert.match(src, /require\("\.\.\/lib\/sandbox"\)/);
  assert.match(src, /const target = supabaseRequest\(path, options\.headers \|\| \{\}\);/);
  assert.match(src, /String\(before\.trainer_id \|\| ""\) !== String\(access\.trainerId \|\| ""\)/);
  assert.doesNotMatch(src, /\/auth\/v1\/user/, "sign-in is checked only by lib/portal-auth (rule 37)");
  const app = read("trainer-backoffice/app.js");
  assert.match(app, /\$\{trainerLeadActionsBox\(lead\)\}/);
  assert.match(app, /fetch\("\/api\/trainer-lead-action"/);
});
