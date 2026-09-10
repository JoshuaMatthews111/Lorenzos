// publish-guard (fix/publish-guard, 2026-09-05) — ported to node --test for the
// release branch. The ops-log practice layer it originally tested against is gone
// (feat/practice-copy replaced it with a real `practice` schema), so the practice
// scenario now proves the SAME two call sites run with the practice profile headers.
// Proves, against a fake Supabase (global fetch replaced):
//   1. update  page_status=published on a row with no published content -> 400, no PATCH sent
//   2. update  page_status=published on a row that IS published          -> 200, PATCH sent
//   3. create  page_status=published with no content                     -> 400, no POST sent
//   4. update  page_status=draft on an empty row                         -> 200 (guard only bites on "published")
//   5. practice copy (LDTT_SANDBOX=1): same refusal, reads through Accept-Profile: practice, no PATCH
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
process.env.SUPABASE_URL = "http://supabase.test";
const require = createRequire(import.meta.url);

const ADMIN_USER = { id: "admin-1", email: "office@example.test" };
const ADMIN_ROW = { user_id: "admin-1", role: "admin", permission_level: "office_admin", active: true, access_status: "active", email: "office@example.test", display_name: "Office" };
const MESSAGE = "This trainer has no published page yet. Publish the page from Trainer Network → Edit Page first.";

function fakeSupabase(pageRow) {
  const calls = [];
  global.fetch = async (url, options = {}) => {
    const method = options.method || "GET";
    const path = String(url).replace(/^https?:\/\/[^/]+/, "");
    const headers = options.headers || {};
    calls.push({ method, path, headers, body: options.body ? JSON.parse(options.body) : null });
    const json = (status, data) => ({ ok: status < 400, status, text: async () => JSON.stringify(data), json: async () => data, headers: new Headers() });
    if (path.startsWith("/auth/v1/user")) return json(200, ADMIN_USER);
    if (path.startsWith("/rest/v1/portal_users")) return json(200, [ADMIN_ROW]);
    if (path.startsWith("/rest/v1/trainer_pages") && method === "GET") return json(200, pageRow ? [pageRow] : []);
    if (path.startsWith("/rest/v1/trainer_pages") && method === "PATCH") return json(200, [{ ...pageRow, ...(options.body ? JSON.parse(options.body) : {}), updated_at: "2026-09-05T00:00:00Z", version: 2 }]);
    if (path.startsWith("/rest/v1/trainer_pages") && method === "POST") return json(201, [{ id: "new-page", ...(options.body ? JSON.parse(options.body) : {}) }]);
    if (path.startsWith("/rest/v1/trainers")) return json(200, []);
    if (path.startsWith("/rest/v1/audit_events")) return json(201, null);
    if (path.startsWith("/rest/v1/lifecycle_events")) return json(201, null);
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

const EMPTY_ROW = { id: "page-1", trainer_id: "trainer-1", slug: "sample", page_status: "draft", locked: false, published_content: null, published_revision: 0, revision: 3, updated_at: "2026-09-01T00:00:00Z" };
const PUBLISHED_ROW = { ...EMPTY_ROW, page_status: "published", locked: true, published_content: { bio: "Real page" }, published_revision: 3 };

test("helpers: what counts as a published page, and the office wording", () => {
  const h = loadHandler(false);
  assert.equal(h.hasPublishedPage(EMPTY_ROW), false);
  assert.equal(h.hasPublishedPage({ ...PUBLISHED_ROW, published_content: {} }), false);
  assert.equal(h.hasPublishedPage({ ...PUBLISHED_ROW, published_revision: 0 }), false);
  assert.equal(h.hasPublishedPage(PUBLISHED_ROW), true);
  assert.equal(h.publishGuardViolation("trainer", null, { status: "active" }), null);
  assert.equal(h.PUBLISH_GUARD_MESSAGE, MESSAGE);
});

test("1. update to published on an empty row: 400, plain message, no PATCH, no audit row", async () => {
  const calls = fakeSupabase(EMPTY_ROW);
  const res = await call(loadHandler(false), { operation: "update", entity_type: "trainer_page", id: "page-1", changes: { page_status: "published", locked: true } });
  assert.equal(res.statusCode, 400); assert.equal(res.payload.publishGuard, true); assert.equal(res.payload.message, MESSAGE);
  assert.ok(!calls.some(c => c.method === "PATCH")); assert.ok(!calls.some(c => c.path.startsWith("/rest/v1/audit_events")));
});

test("2. update to published on a published row: 200, exactly one PATCH", async () => {
  const calls = fakeSupabase(PUBLISHED_ROW);
  const res = await call(loadHandler(false), { operation: "update", entity_type: "trainer_page", id: "page-1", action: "trainer_page_published", changes: { page_status: "published", locked: true, headline: "Updated" } });
  assert.equal(res.statusCode, 200); assert.equal(res.payload.ok, true);
  assert.equal(calls.filter(c => c.method === "PATCH").length, 1);
});

test("3. create with published and no content: 400, no POST to trainer_pages", async () => {
  const calls = fakeSupabase(null);
  const res = await call(loadHandler(false), { operation: "create", entity_type: "trainer_page", changes: { trainer_id: "trainer-1", slug: "sample", page_status: "published", locked: true } });
  assert.equal(res.statusCode, 400); assert.equal(res.payload.publishGuard, true);
  assert.ok(!calls.some(c => c.method === "POST" && c.path.startsWith("/rest/v1/trainer_pages")));
});

test("4. a draft save on an empty row still succeeds", async () => {
  const calls = fakeSupabase(EMPTY_ROW);
  const res = await call(loadHandler(false), { operation: "update", entity_type: "trainer_page", id: "page-1", changes: { page_status: "draft", headline: "Working" } });
  assert.equal(res.statusCode, 200); assert.equal(calls.filter(c => c.method === "PATCH").length, 1);
});

test("5. practice copy: the guard reads trainer_pages through the practice profile and refuses the same way; an accepted update PATCHes practice", async () => {
  let calls = fakeSupabase(EMPTY_ROW);
  let res = await call(loadHandler(true), { operation: "update", entity_type: "trainer_page", id: "page-1", changes: { page_status: "published", locked: true } });
  assert.equal(res.statusCode, 400); assert.equal(res.payload.publishGuard, true);
  const read = calls.find(c => c.method === "GET" && c.path.startsWith("/rest/v1/trainer_pages"));
  assert.equal(read.headers["Accept-Profile"], "practice");
  assert.ok(!calls.some(c => c.method === "PATCH"));
  calls = fakeSupabase(PUBLISHED_ROW);
  res = await call(loadHandler(true), { operation: "update", entity_type: "trainer_page", id: "page-1", changes: { page_status: "published", locked: true } });
  assert.equal(res.statusCode, 200);
  const patch = calls.find(c => c.method === "PATCH");
  assert.equal(patch.headers["Content-Profile"], "practice");
  delete process.env.LDTT_SANDBOX;
});
