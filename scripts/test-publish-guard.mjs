// publish-guard test. Runs api/operational-mutation.js against a fake Supabase
// (global fetch is replaced) and proves:
//   1. update  page_status=published on a row with no published content -> 400, no PATCH sent
//   2. update  page_status=published on a row that IS published          -> 200, PATCH sent
//   3. create  page_status=published with no content                     -> 400, no POST sent
//   4. update  page_status=draft on an empty row                         -> 200 (guard only bites on "published")
//   5. sandbox (LDTT_SANDBOX=1) update to published on an empty row      -> 400, nothing appended to the practice layer
// Usage: node scripts/test-publish-guard.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";

process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
const require = createRequire(import.meta.url);

const ADMIN_USER = { id: "admin-1", email: "office@example.test" };
const ADMIN_ROW = { user_id: "admin-1", role: "admin", permission_level: "office_admin", active: true, access_status: "active", email: "office@example.test", display_name: "Office" };

function fakeSupabase(pageRow) {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    const method = options.method || "GET";
    const path = String(url).replace(/^https?:\/\/[^/]+/, "");
    calls.push({ method, path, body: options.body ? JSON.parse(options.body) : null });
    const json = (status, data) => ({ ok: status < 400, status, text: async () => JSON.stringify(data), json: async () => data, headers: new Headers() });
    if (path.startsWith("/auth/v1/user")) return json(200, ADMIN_USER);
    if (path.startsWith("/rest/v1/portal_users")) return json(200, [ADMIN_ROW]);
    if (path.startsWith("/rest/v1/trainer_pages") && method === "GET") return json(200, pageRow ? [pageRow] : []);
    if (path.startsWith("/rest/v1/trainer_pages") && method === "PATCH") return json(200, [{ ...pageRow, ...(options.body ? JSON.parse(options.body) : {}), updated_at: "2026-09-05T00:00:00Z", version: 2 }]);
    if (path.startsWith("/rest/v1/trainer_pages") && method === "POST") return json(201, [{ id: "new-page", ...(options.body ? JSON.parse(options.body) : {}) }]);
    if (path.startsWith("/rest/v1/audit_events")) return json(201, null);
    if (path.startsWith("/rest/v1/lifecycle_events")) return json(201, null);
    // sandbox practice layer (Storage)
    if (path.startsWith("/storage/v1/bucket")) return json(200, {});
    if (path.startsWith("/storage/v1/object/sandbox-practice-layer/") && method === "GET") return json(404, {});
    if (path.startsWith("/storage/v1/object/sandbox-practice-layer/") && method === "POST") return json(200, {});
    throw new Error(`Unexpected fake Supabase call: ${method} ${path}`);
  };
  return { calls, fetchImpl };
}

async function callHandler(handler, body) {
  const res = {
    statusCode: 0,
    payload: null,
    headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    status(code) { this.statusCode = code; return this; },
    json(data) { this.payload = data; return this; },
    end() { return this; }
  };
  await handler({ method: "POST", headers: { authorization: "Bearer fake-token" }, body }, res);
  return res;
}

function loadHandler(sandbox) {
  delete require.cache[require.resolve("../api/operational-mutation.js")];
  delete require.cache[require.resolve("../lib/sandbox.js")];
  delete require.cache[require.resolve("../lib/sandbox-store.js")];
  if (sandbox) process.env.LDTT_SANDBOX = "1"; else delete process.env.LDTT_SANDBOX;
  return require("../api/operational-mutation.js");
}

const EMPTY_ROW = { id: "page-1", trainer_id: "trainer-1", slug: "sample", page_status: "draft", locked: false, published_content: null, published_revision: 0, revision: 3, updated_at: "2026-09-01T00:00:00Z" };
const PUBLISHED_ROW = { ...EMPTY_ROW, page_status: "published", locked: true, published_content: { bio: "Real page" }, published_revision: 3 };

const results = [];
const record = (label, passed) => { results.push([label, passed]); assert.equal(passed, true, label); };

// Pure helper checks
{
  const handler = loadHandler(false);
  record("helper: empty row is not a published page", handler.hasPublishedPage(EMPTY_ROW) === false);
  record("helper: {} content is not a published page", handler.hasPublishedPage({ ...PUBLISHED_ROW, published_content: {} }) === false);
  record("helper: revision 0 is not a published page", handler.hasPublishedPage({ ...PUBLISHED_ROW, published_revision: 0 }) === false);
  record("helper: real row is a published page", handler.hasPublishedPage(PUBLISHED_ROW) === true);
  record("helper: guard ignores other entities", handler.publishGuardViolation("trainer", null, { status: "active" }) === null);
  record("helper: guard message matches the office wording", handler.PUBLISH_GUARD_MESSAGE === "This trainer has no published page yet. Publish the page from Trainer Network → Edit Page first.");
}

// 1. refused update
{
  const { calls, fetchImpl } = fakeSupabase(EMPTY_ROW);
  global.fetch = fetchImpl;
  const res = await callHandler(loadHandler(false), { operation: "update", entity_type: "trainer_page", id: "page-1", changes: { page_status: "published", locked: true } });
  record("update to published on an empty row is refused with 400", res.statusCode === 400 && res.payload.publishGuard === true);
  record("refused update carries the plain office message", res.payload.message === "This trainer has no published page yet. Publish the page from Trainer Network → Edit Page first.");
  record("refused update never sends a PATCH", !calls.some(c => c.method === "PATCH"));
  record("refused update writes no audit row", !calls.some(c => c.path.startsWith("/rest/v1/audit_events")));
}

// 2. allowed update
{
  const { calls, fetchImpl } = fakeSupabase(PUBLISHED_ROW);
  global.fetch = fetchImpl;
  const res = await callHandler(loadHandler(false), { operation: "update", entity_type: "trainer_page", id: "page-1", changes: { page_status: "published", locked: true, headline: "Updated" } });
  record("update to published on a published row succeeds", res.statusCode === 200 && res.payload.ok === true);
  record("allowed update sends exactly one PATCH", calls.filter(c => c.method === "PATCH").length === 1);
}

// 3. refused create
{
  const { calls, fetchImpl } = fakeSupabase(null);
  global.fetch = fetchImpl;
  const res = await callHandler(loadHandler(false), { operation: "create", entity_type: "trainer_page", changes: { trainer_id: "trainer-1", slug: "sample", page_status: "published", locked: true } });
  record("create with published and no content is refused with 400", res.statusCode === 400 && res.payload.publishGuard === true);
  record("refused create never sends a POST to trainer_pages", !calls.some(c => c.method === "POST" && c.path.startsWith("/rest/v1/trainer_pages")));
}

// 4. draft save on an empty row is untouched
{
  const { calls, fetchImpl } = fakeSupabase(EMPTY_ROW);
  global.fetch = fetchImpl;
  const res = await callHandler(loadHandler(false), { operation: "update", entity_type: "trainer_page", id: "page-1", changes: { page_status: "draft", headline: "Working" } });
  record("draft save on an empty row still succeeds", res.statusCode === 200 && calls.filter(c => c.method === "PATCH").length === 1);
}

// 5. sandbox practice layer keeps the rule
{
  const { calls, fetchImpl } = fakeSupabase(EMPTY_ROW);
  global.fetch = fetchImpl;
  const res = await callHandler(loadHandler(true), { operation: "update", entity_type: "trainer_page", id: "page-1", changes: { page_status: "published", locked: true } });
  record("sandbox update to published on an empty row is refused", res.statusCode === 400 && res.payload.publishGuard === true && res.payload.sandbox === true);
  record("sandbox refusal appends nothing to the practice layer", !calls.some(c => c.method === "POST" && c.path.startsWith("/storage/v1/object/")));
}
{
  const { calls, fetchImpl } = fakeSupabase(PUBLISHED_ROW);
  global.fetch = fetchImpl;
  const res = await callHandler(loadHandler(true), { operation: "update", entity_type: "trainer_page", id: "page-1", changes: { page_status: "published", locked: true } });
  record("sandbox update to published on a published row is accepted", res.statusCode === 200 && res.payload.sandbox === true);
  record("sandbox acceptance appends one practice op", calls.filter(c => c.method === "POST" && c.path.startsWith("/storage/v1/object/")).length === 1);
}
delete process.env.LDTT_SANDBOX;

console.log(JSON.stringify({ ok: true, checks: results.map(([label]) => label) }, null, 2));
