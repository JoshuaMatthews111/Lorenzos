// Draft feature + delete/restore of trainer pages (Joshua 2026-09-10, rules 56 and 59),
// against a fake Supabase (global fetch replaced). Nothing here talks to the real project.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
process.env.SUPABASE_URL = "http://supabase.test";
const require = createRequire(import.meta.url);
const ADMIN_USER = { id: "admin-1", email: "office@example.test" };
const ADMIN_ROW = { user_id: "admin-1", role: "admin", permission_level: "office_admin", active: true, access_status: "active", email: "office@example.test", display_name: "Office Login" };
const RIGHT = "right-pass-123";

const LIVE = { id: "page-1", trainer_id: "t-1", slug: "karemela-sefferin", page_status: "published", locked: true, headline: "Live headline",
  style_settings: { brand_accent: "#d80f35" }, published_content: { trainer_name: "Karemela Sefferin", bio: "Live bio" }, published_revision: 61,
  draft_content: { trainer_name: "Karemela Sefferin", bio: "Live bio" }, revision: 61, updated_at: "2026-09-10T00:00:00Z" };
const DRAFT_ONLY = { ...LIVE, page_status: "draft", locked: false, published_content: null, published_revision: 0 };
const DELETED = { ...LIVE, page_status: "archived", locked: false, archived_at: "2026-09-10T01:00:00Z" };

function fakeSupabase(row, deletedBefore = null) {
  const calls = [];
  global.fetch = async (url, options = {}) => {
    const method = options.method || "GET";
    const path = String(url).replace(/^https?:\/\/[^/]+/, "");
    const body = options.body ? JSON.parse(options.body) : null;
    calls.push({ method, path, headers: options.headers || {}, body });
    const json = (status, data) => ({ ok: status < 400, status, text: async () => JSON.stringify(data), json: async () => data, headers: new Headers() });
    if (path.startsWith("/auth/v1/token")) return json(body?.password === RIGHT && body?.email === "office@example.test" ? 200 : 400, body?.password === RIGHT ? { access_token: "x" } : { error: "invalid_grant" });
    if (path.startsWith("/auth/v1/user")) return json(200, ADMIN_USER);
    if (path.startsWith("/rest/v1/portal_users")) return json(200, [ADMIN_ROW]);
    if (path.startsWith("/rest/v1/trainer_pages") && method === "GET") return json(200, row ? [row] : []);
    if (path.startsWith("/rest/v1/trainer_pages") && method === "PATCH") return json(200, [{ ...row, ...body, updated_at: "2026-09-10T02:00:00Z" }]);
    if (path.startsWith("/rest/v1/trainers")) return json(200, []);
    if (path.startsWith("/rest/v1/audit_events") && method === "GET") return json(200, deletedBefore ? [{ before_data: deletedBefore }] : []);
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
function load(sandbox) {
  delete require.cache[require.resolve("../api/operational-mutation.js")];
  delete require.cache[require.resolve("../lib/sandbox.js")];
  if (sandbox) process.env.LDTT_SANDBOX = "1"; else delete process.env.LDTT_SANDBOX;
  return require("../api/operational-mutation.js");
}
const patchOf = calls => calls.filter(c => c.method === "PATCH");

test("draft save on a LIVE page keeps it live and parks row settings in draft_content._row", async () => {
  const calls = fakeSupabase(LIVE);
  const res = await call(load(false), { operation: "update", entity_type: "trainer_page", id: "page-1", action: "trainer_page_draft_saved",
    changes: { page_status: "draft", locked: false, headline: "Draft headline", style_settings: { brand_accent: "#000000" }, draft_content: { trainer_name: "Karemela Sefferin", bio: "Draft bio" }, revision: 62 } });
  assert.equal(res.statusCode, 200); assert.equal(res.payload.draft_only, true);
  const [patch] = patchOf(calls);
  assert.equal(patch.body.page_status, "published"); assert.equal(patch.body.locked, true);
  assert.ok(!("headline" in patch.body) && !("style_settings" in patch.body) && !("published_content" in patch.body));
  assert.equal(patch.body.draft_content.bio, "Draft bio");
  assert.equal(patch.body.draft_content._row.headline, "Draft headline");
  assert.deepEqual(patch.body.draft_content._row.style_settings, { brand_accent: "#000000" });
});

test("a second draft save keeps the earlier parked settings", async () => {
  const calls = fakeSupabase({ ...LIVE, draft_content: { ...LIVE.draft_content, _row: { headline: "Earlier draft", hero_image_url: "/a.jpg" } } });
  await call(load(false), { operation: "update", entity_type: "trainer_page", id: "page-1", changes: { page_status: "draft", locked: false, headline: "Newer draft", draft_content: { bio: "x" } } });
  const [patch] = patchOf(calls);
  assert.equal(patch.body.draft_content._row.headline, "Newer draft");
  assert.equal(patch.body.draft_content._row.hero_image_url, "/a.jpg");
});

test("an old tab's draft save cannot publish row settings or overwrite the published copy", async () => {
  const calls = fakeSupabase(LIVE);
  await call(load(false), { operation: "update", entity_type: "trainer_page", id: "page-1", changes: { page_status: "published", locked: true, hero_image_url: "/new.jpg", published_content: { bio: "sneaky" } } });
  const [patch] = patchOf(calls);
  assert.ok(!("hero_image_url" in patch.body) && !("published_content" in patch.body));
  assert.equal(patch.body.draft_content._row.hero_image_url, "/new.jpg");
});

test("a real Publish writes the row settings as before", async () => {
  const calls = fakeSupabase(LIVE);
  const res = await call(load(false), { operation: "update", entity_type: "trainer_page", id: "page-1", action: "trainer_page_published", changes: { page_status: "published", locked: true, headline: "Published headline", draft_content: { bio: "New" } } });
  assert.equal(res.payload.draft_only, false);
  const [patch] = patchOf(calls);
  assert.equal(patch.body.headline, "Published headline"); assert.ok(!patch.body.draft_content._row);
});

test("a page that was never published saves drafts exactly as before", async () => {
  const calls = fakeSupabase(DRAFT_ONLY);
  await call(load(false), { operation: "update", entity_type: "trainer_page", id: "page-1", changes: { page_status: "draft", locked: false, headline: "Working" } });
  const [patch] = patchOf(calls);
  assert.equal(patch.body.page_status, "draft"); assert.equal(patch.body.headline, "Working");
});

test("delete needs a full name and a password; a wrong password changes nothing", async () => {
  let calls = fakeSupabase(LIVE);
  let res = await call(load(false), { operation: "delete_trainer_page", id: "page-1", deleted_by_name: "Rachel", password: RIGHT });
  assert.equal(res.statusCode, 400);
  res = await call(load(false), { operation: "delete_trainer_page", id: "page-1", deleted_by_name: "Rachel Leggett" });
  assert.equal(res.statusCode, 400);
  calls = fakeSupabase(LIVE);
  res = await call(load(false), { operation: "delete_trainer_page", id: "page-1", deleted_by_name: "Rachel Leggett", password: "wrong" });
  assert.equal(res.statusCode, 422); assert.equal(res.payload.wrongPassword, true);
  assert.equal(patchOf(calls).length, 0); assert.ok(!calls.some(c => c.path.startsWith("/rest/v1/audit_events")));
});

test("delete with the right password takes the page off the website and logs who did it, never the password", async () => {
  const calls = fakeSupabase(LIVE);
  const res = await call(load(false), { operation: "delete_trainer_page", id: "page-1", deleted_by_name: "Rachel  Leggett", password: RIGHT });
  assert.equal(res.statusCode, 200); assert.equal(res.payload.deleted, true);
  const [patch] = patchOf(calls);
  assert.equal(patch.body.page_status, "archived"); assert.equal(patch.body.locked, false); assert.ok(patch.body.archived_at);
  assert.ok(!("published_content" in patch.body) && !("draft_content" in patch.body), "content kept for restore");
  const log = calls.find(c => c.path.startsWith("/rest/v1/audit_events") && c.method === "POST");
  assert.equal(log.body.action, "trainer_page_deleted");
  assert.match(log.body.actor_name, /^Rachel Leggett \(login: Office Login\)$/);
  assert.match(log.body.summary, /Rachel Leggett deleted the Karemela Sefferin trainer page/);
  const everythingButAuth = JSON.stringify(calls.filter(c => !c.path.startsWith("/auth/v1/token")));
  assert.ok(!everythingButAuth.includes(RIGHT) && !JSON.stringify(res.payload).includes(RIGHT), "password never leaves the auth check");
});

test("restore brings the last published version back live and logs the name", async () => {
  const calls = fakeSupabase(DELETED, LIVE);
  const res = await call(load(false), { operation: "restore_trainer_page", id: "page-1", restored_by_name: "Joshua Matthews" });
  assert.equal(res.statusCode, 200);
  const [patch] = patchOf(calls);
  assert.equal(patch.body.page_status, "published"); assert.equal(patch.body.locked, true); assert.equal(patch.body.archived_at, null);
  const log = calls.find(c => c.path.startsWith("/rest/v1/audit_events") && c.method === "POST");
  assert.equal(log.body.action, "trainer_page_restored"); assert.match(log.body.actor_name, /^Joshua Matthews/);
  fakeSupabase(LIVE);
  const notDeleted = await call(load(false), { operation: "restore_trainer_page", id: "page-1", restored_by_name: "Joshua Matthews" });
  assert.equal(notDeleted.statusCode, 409);
});

test("practice copy: delete writes practice.trainer_pages, password still checked against the shared login", async () => {
  const calls = fakeSupabase(LIVE);
  const res = await call(load(true), { operation: "delete_trainer_page", id: "page-1", deleted_by_name: "Rachel Leggett", password: RIGHT });
  assert.equal(res.statusCode, 200);
  assert.equal(patchOf(calls)[0].headers["Content-Profile"], "practice");
  assert.ok(calls.some(c => c.path.startsWith("/auth/v1/token")));
  delete process.env.LDTT_SANDBOX;
});

test("a draft save on a DELETED page keeps it deleted and parks row settings, so Restore cannot leak them", async () => {
  const calls = fakeSupabase(DELETED);
  await call(load(false), { operation: "update", entity_type: "trainer_page", id: "page-1", changes: { page_status: "draft", locked: false, headline: "Edit", hero_image_url: "/draft.jpg", published_content: { bio: "x" }, draft_content: { bio: "draft" } } });
  const [patch] = patchOf(calls);
  assert.equal(patch.body.page_status, "archived"); assert.equal(patch.body.locked, false);
  assert.ok(!("headline" in patch.body) && !("hero_image_url" in patch.body) && !("published_content" in patch.body));
  assert.equal(patch.body.draft_content._row.headline, "Edit");
});

test("restore of a page that was OFFLINE when deleted brings it back as a draft, not live", async () => {
  const calls = fakeSupabase(DELETED, { ...LIVE, page_status: "draft", locked: false });
  const res = await call(load(false), { operation: "restore_trainer_page", id: "page-1", restored_by_name: "Joshua Matthews" });
  assert.equal(res.statusCode, 200); assert.equal(res.payload.live, false);
  const [patch] = patchOf(calls);
  assert.equal(patch.body.page_status, "draft"); assert.equal(patch.body.locked, false);
});

test("restore with no delete record stays on the safe side: draft", async () => {
  const calls = fakeSupabase(DELETED, null);
  await call(load(false), { operation: "restore_trainer_page", id: "page-1", restored_by_name: "Joshua Matthews" });
  assert.equal(patchOf(calls)[0].body.page_status, "draft");
});
