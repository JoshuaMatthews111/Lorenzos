// 2026-09-24 (portal audit): an office lead save used to REPLACE the stored raw_payload with the browser's
// copy, which could be minutes old. That erased the texting record (including the re-engage once-only
// record written at 7 AM), the booking answers, the red "Needs a call" stamp and the test-row stamp.
// The save is now merged, and the keys only the server writes always keep their stored value.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
process.env.SUPABASE_URL = "http://supabase.test";
const require = createRequire(import.meta.url);

const ADMIN_USER = { id: "admin-1", email: "office@example.test" };
const ADMIN_ROW = { user_id: "admin-1", role: "admin", permission_level: "office_admin", active: true, access_status: "active", email: "office@example.test", display_name: "Office" };
const STORED = {
  source_page: "dog-training-cleveland-oh",
  needs_office_call: true,
  booking: { intake: { zip: "44128" } },
  pipeline: { reengage: { status: "sent", at: "2026-09-24T11:00:12Z" } },
  follow_up_date: "2026-09-20",
  office_extra: "kept"
};
const LEAD = { id: "lead-1", first_name: "Pat", status: "office_contacted", version: 4, updated_at: "2026-09-24T11:00:13Z", raw_payload: STORED };

function fakeSupabase() {
  const calls = [];
  global.fetch = async (url, options = {}) => {
    const method = options.method || "GET";
    const path = String(url).replace(/^https?:\/\/[^/]+/, "");
    const body = options.body ? JSON.parse(options.body) : null;
    calls.push({ method, path, body });
    const json = (status, data) => ({ ok: status < 400, status, text: async () => JSON.stringify(data), json: async () => data, headers: new Headers() });
    if (path.startsWith("/auth/v1/user")) return json(200, ADMIN_USER);
    if (path.startsWith("/rest/v1/portal_users")) return json(200, [ADMIN_ROW]);
    if (path.startsWith("/rest/v1/leads") && method === "GET") return json(200, [LEAD]);
    if (path.startsWith("/rest/v1/leads") && method === "PATCH") return json(200, [{ ...LEAD, ...body, version: 5 }]);
    if (method === "POST") return json(201, []);
    return json(200, []);
  };
  return calls;
}

async function call(handler, body) {
  const res = { statusCode: 0, payload: null, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.statusCode = c; return this; }, json(d) { this.payload = d; return this; }, end() { return this; } };
  await handler({ method: "POST", headers: { authorization: "Bearer fake-token" }, body }, res);
  return res;
}

test("a save from an old screen keeps the texting record, booking, badge and source; the follow-up date still saves", async () => {
  delete process.env.LDTT_SANDBOX;
  for (const m of ["../api/operational-mutation.js", "../lib/sandbox.js"]) delete require.cache[require.resolve(m)];
  const calls = fakeSupabase();
  const handler = require("../api/operational-mutation.js");
  // The browser copy predates 7 AM: no pipeline record, no badge, and it carries a stale follow-up date change.
  const staleBrowserPayload = { source_page: "something-else", follow_up_date: "2026-09-30", office_extra: "kept" };
  const res = await call(handler, { operation: "update", entity_type: "lead", id: "lead-1", action: "lead_updated", summary: "t",
    changes: { status: "office_contacted", raw_payload: staleBrowserPayload } });
  assert.equal(res.statusCode, 200, JSON.stringify(res.payload));
  const patch = calls.find(c => c.method === "PATCH" && c.path.startsWith("/rest/v1/leads"));
  const saved = patch.body.raw_payload;
  assert.deepEqual(saved.pipeline, STORED.pipeline, "the 7 AM send record survives");
  assert.deepEqual(saved.booking, STORED.booking, "booking answers survive");
  assert.equal(saved.needs_office_call, true, "the red badge survives");
  assert.equal(saved.source_page, "dog-training-cleveland-oh", "where the lead came from cannot be rewritten by the office screen");
  assert.equal(saved.follow_up_date, "2026-09-30", "the office's own change still saves");
  assert.equal(saved.office_extra, "kept");
});

test("a server-owned key the server removed is not put back by an old screen", async () => {
  const calls = fakeSupabase();
  const handler = require("../api/operational-mutation.js");
  LEAD.raw_payload = { follow_up_date: null };
  await call(handler, { operation: "update", entity_type: "lead", id: "lead-1", action: "lead_updated", summary: "t",
    changes: { raw_payload: { pipeline: { reengage: { status: "sent" } }, qa: true, follow_up_date: null } } });
  const saved = calls.find(c => c.method === "PATCH").body.raw_payload;
  assert.ok(!("pipeline" in saved) && !("qa" in saved), "stale server keys are dropped, not resurrected");
  LEAD.raw_payload = STORED;
});
