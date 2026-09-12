// lead cards (meeting 2026-09-11, DO-NOT-BREAK rule 70). Against a fake Supabase
// (global fetch replaced), proves:
//   1. added_to_alpha + eval_scheduled_at are on the lead whitelist and save ALONE
//      (the PATCH carries only the key that was sent - no status, no notes);
//   2. added_to_alpha is a real boolean (anything but true saves false);
//   3. eval_scheduled_at is stored as an ISO timestamp; "" clears it; junk -> 400, no PATCH;
//   4. on the practice copy the same PATCH goes to schema practice;
//   5. the Sales stage label is "Eval Completed" with its key and statuses unchanged (rule 10).
// NOT deployed (tests/ is in .vercelignore). Nothing here talks to the real project.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
process.env.SUPABASE_URL = "http://supabase.test";
const require = createRequire(import.meta.url);

const ADMIN_USER = { id: "admin-1", email: "office@example.test" };
const ADMIN_ROW = { user_id: "admin-1", role: "admin", permission_level: "office_admin", active: true, access_status: "active", email: "office@example.test", display_name: "Office" };
const LEAD = { id: "lead-1", first_name: "Pat", last_name: "Doe", status: "evaluation_scheduled", eval_scheduled_at: null, added_to_alpha: false, version: 4, updated_at: "2026-09-12T00:00:00Z", raw_payload: {} };

function fakeSupabase() {
  const calls = [];
  global.fetch = async (url, options = {}) => {
    const method = options.method || "GET";
    const path = String(url).replace(/^https?:\/\/[^/]+/, "");
    const body = options.body ? JSON.parse(options.body) : null;
    calls.push({ method, path, headers: options.headers || {}, body });
    const json = (status, data) => ({ ok: status < 400, status, text: async () => JSON.stringify(data), json: async () => data, headers: new Headers() });
    if (path.startsWith("/auth/v1/user")) return json(200, ADMIN_USER);
    if (path.startsWith("/rest/v1/portal_users")) return json(200, [ADMIN_ROW]);
    if (path.startsWith("/rest/v1/leads") && method === "GET") return json(200, [LEAD]);
    if (path.startsWith("/rest/v1/leads") && method === "PATCH") return json(200, [{ ...LEAD, ...body, version: 5, updated_at: "2026-09-12T01:00:00Z" }]);
    if (method === "POST") return json(201, []);
    if (method === "GET") return json(200, []);
    throw new Error(`Unexpected fake Supabase call: ${method} ${path}`);
  };
  return calls;
}

async function call(handler, body) {
  const res = { statusCode: 0, payload: null, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.statusCode = c; return this; }, json(d) { this.payload = d; return this; }, end() { return this; } };
  await handler({ method: "POST", headers: { authorization: "Bearer fake-token" }, body }, res);
  return res;
}

function loadHandler(sandbox) {
  delete require.cache[require.resolve("../api/operational-mutation.js")];
  delete require.cache[require.resolve("../lib/sandbox.js")];
  if (sandbox) process.env.LDTT_SANDBOX = "1"; else delete process.env.LDTT_SANDBOX;
  return require("../api/operational-mutation.js");
}

const update = changes => ({ operation: "update", entity_type: "lead", id: "lead-1", action: "lead_updated", summary: "test", changes });
const leadPatches = calls => calls.filter(c => c.method === "PATCH" && c.path.startsWith("/rest/v1/leads"));

test("Added to Alpha saves alone, as a real yes/no", async () => {
  const handler = loadHandler(false);
  let calls = fakeSupabase();
  let res = await call(handler, update({ added_to_alpha: true }));
  assert.equal(res.statusCode, 200, JSON.stringify(res.payload));
  let patch = leadPatches(calls);
  assert.equal(patch.length, 1);
  assert.deepEqual(patch[0].body.added_to_alpha, true);
  assert.equal("status" in patch[0].body, false, "an Alpha tick must never resend the status");
  assert.equal("eval_scheduled_at" in patch[0].body, false, "an Alpha tick must never touch the eval time");

  calls = fakeSupabase();
  res = await call(handler, update({ added_to_alpha: "yes" }));
  assert.equal(res.statusCode, 200);
  assert.equal(leadPatches(calls)[0].body.added_to_alpha, false, "only a real true means yes");
});

test("Eval date + time is stored as ISO, cleared by empty, refused when unreadable", async () => {
  const handler = loadHandler(false);
  let calls = fakeSupabase();
  let res = await call(handler, update({ eval_scheduled_at: "2026-09-15T14:30:00-04:00" }));
  assert.equal(res.statusCode, 200, JSON.stringify(res.payload));
  let patch = leadPatches(calls);
  assert.equal(patch[0].body.eval_scheduled_at, "2026-09-15T18:30:00.000Z");
  assert.equal("added_to_alpha" in patch[0].body, false, "an eval save must never flip the Alpha tick");
  assert.equal("status" in patch[0].body, false);

  calls = fakeSupabase();
  res = await call(handler, update({ eval_scheduled_at: "" }));
  assert.equal(res.statusCode, 200);
  assert.equal(leadPatches(calls)[0].body.eval_scheduled_at, null);

  calls = fakeSupabase();
  res = await call(handler, update({ eval_scheduled_at: "next tuesday-ish" }));
  assert.equal(res.statusCode, 400);
  assert.match(res.payload.message, /eval date and time could not be read/i);
  assert.equal(leadPatches(calls).length, 0, "nothing is written for an unreadable time");
});

test("practice copy: the same save lands in schema practice", async () => {
  const handler = loadHandler(true);
  const calls = fakeSupabase();
  const res = await call(handler, update({ added_to_alpha: true }));
  assert.equal(res.statusCode, 200, JSON.stringify(res.payload));
  const patch = leadPatches(calls);
  assert.equal(patch.length, 1);
  const headers = Object.fromEntries(Object.entries(patch[0].headers).map(([k, v]) => [k.toLowerCase(), v]));
  assert.equal(headers["content-profile"], "practice");
  delete process.env.LDTT_SANDBOX;
});

test("Sales stage label is Eval Completed; key and statuses unchanged (rule 10)", () => {
  delete require.cache[require.resolve("../trainer-backoffice/metrics.js")];
  const metrics = require("../trainer-backoffice/metrics.js");
  const stage = metrics.SALES_STAGES.find(([key]) => key === "evaluated");
  assert.ok(stage, "the evaluated stage still exists");
  assert.equal(stage[1], "Eval Completed");
  assert.equal(stage[2], "sales");
  assert.deepEqual(stage[3], ["evaluation_complete"]);
  assert.equal(metrics.SALES_STAGES.some(([, label]) => /trainer'?s hands/i.test(label)), false);
});
