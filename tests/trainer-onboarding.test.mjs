// onboarding: unit tests for the trainer-onboarding API fixes (2026-09-05) against
// a fake Supabase. Covers api/operational-mutation.js (plain duplicate messages,
// one email per trainer) and api/ensure-trainer-user.js (staff-login guard, live
// creates the login, the practice copy never touches auth). Run: node --test tests/
// NOT deployed (tests/ is in .vercelignore). Nothing here talks to the real project.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";

const require = createRequire(import.meta.url);
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
process.env.SUPABASE_URL = "http://supabase.test";
process.env.LDTT_TRAINER_TEMP_PASSWORD = "temp-pass-for-tests";
const mutation = require("../api/operational-mutation.js");
const ensureTrainerUser = require("../api/ensure-trainer-user.js");
const sandbox = require("../lib/sandbox.js");
const socialLinks = require("../api/trainer-social-links.js");

const HARLEY = { user_id: "u-harley", role: "trainer", permission_level: "trainer", trainer_id: "t-harley", active: true, access_status: "active", email: "trainer@lorenzosdogtrainingteam.com" };
const SUPER = { user_id: "u-super", role: "admin", permission_level: "super_admin", active: true, access_status: "active", email: "joshua@lorenzosdogtrainingteam.com", display_name: "Joshua" };
const ANGELA = { user_id: "u-angela", role: "admin", permission_level: "office_admin", active: true, access_status: "active", email: "angela@lorenzosdogtrainingteam.com", display_name: "Angela Office" };
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function makeWorld({ trainers = [], pages = [], portalUsers = [SUPER, ANGELA, HARLEY], authUsers = [] } = {}) {
  const store = { trainers, trainer_pages: pages, portal_users: portalUsers, audit_events: [], lifecycle_events: [], lead_events: [] };
  const writes = [];
  const authAdminCalls = [];
  const filters = (rows, params) => {
    let out = rows;
    for (const [key, raw] of params) {
      if (["select", "order", "limit", "on_conflict"].includes(key)) continue;
      const [op, ...rest] = raw.split("."); const value = rest.join(".");
      if (op === "eq") out = out.filter(r => String(r[key]) === value);
      if (op === "neq") out = out.filter(r => String(r[key]) !== value);
      if (op === "ilike") out = out.filter(r => String(r[key] || "").toLowerCase() === value.toLowerCase());
    }
    const limit = Number(params.get("limit") || 0);
    return limit ? out.slice(0, limit) : out;
  };
  globalThis.fetch = async (url, options = {}) => {
    const u = new URL(url);
    const method = (options.method || "GET").toUpperCase();
    const headers = options.headers || {};
    if (u.pathname === "/auth/v1/user") {
      const token = String(headers.Authorization || "").replace(/^Bearer\s+/, "");
      const pu = portalUsers.find(p => `${p.user_id}-token` === token);
      return pu ? json(200, { id: pu.user_id, email: pu.email }) : json(401, { message: "bad token" });
    }
    if (u.pathname === "/auth/v1/admin/users") {
      authAdminCalls.push({ method, body: options.body ? JSON.parse(options.body) : null });
      if (method === "GET") return json(200, { users: authUsers });
      const created = { id: randomUUID(), email: JSON.parse(options.body).email };
      authUsers.push(created);
      return json(200, created);
    }
    if (u.pathname.startsWith("/auth/v1/admin/users/")) { authAdminCalls.push({ method, path: u.pathname }); return json(200, {}); }
    const table = u.pathname.replace("/rest/v1/", "");
    const body = options.body ? JSON.parse(options.body) : null;
    if (!store[table]) return json(404, { message: `no table ${table}` });
    if (method === "GET") return json(200, filters(store[table], u.searchParams));
    writes.push({ table, method, body, params: Object.fromEntries(u.searchParams) });
    if (method === "POST") {
      const rows = (Array.isArray(body) ? body : [body]).map(row => ({ id: randomUUID(), created_at: "2026-09-05T10:00:00.000Z", updated_at: "2026-09-05T10:00:00.000Z", version: 1, ...row }));
      if (["trainers", "trainer_pages"].includes(table) && rows.some(r => store[table].some(x => x.slug === r.slug))) {
        return json(409, { code: "23505", message: `duplicate key value violates unique constraint "${table}_slug_key"` });
      }
      if (table === "portal_users" && u.searchParams.get("on_conflict") === "user_id") {
        rows.forEach(row => { const existing = store.portal_users.find(p => p.user_id === row.user_id); if (existing) Object.assign(existing, row); else store.portal_users.push(row); });
        return json(201, rows);
      }
      store[table].push(...rows);
      return json(201, rows);
    }
    if (method === "PATCH") {
      const targets = filters(store[table], u.searchParams);
      if (table === "trainers" && body.slug && store.trainers.some(x => x.slug === body.slug && !targets.includes(x))) {
        return json(409, { code: "23505", message: `duplicate key value violates unique constraint "trainers_slug_key"` });
      }
      targets.forEach(row => Object.assign(row, body, { updated_at: "2026-09-05T10:05:00.000Z", version: Number(row.version || 1) + 1 }));
      return json(200, targets);
    }
    return json(405, { message: "nope" });
  };
  return { store, writes, authAdminCalls, authUsers };
}

async function call(fn, body, token = "u-super-token") {
  const res = { statusCode: 200, body: null, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(code) { this.statusCode = code; return this; }, json(payload) { this.body = payload; return this; }, end() { return this; } };
  await fn({ method: "POST", headers: { authorization: `Bearer ${token}` }, body }, res);
  return res;
}

const create = (changes, token) => call(mutation, { operation: "create", entity_type: "trainer", action: "trainer_created", summary: "t", changes }, token);
const update = (id, changes, token) => call(mutation, { operation: "update", entity_type: "trainer", id, action: "trainer_profile_updated", summary: "t", changes }, token);

test("a second trainer with the same web address gets a plain sentence (409), not a Postgres error, and no audit row", async () => {
  const world = makeWorld({ trainers: [{ id: "t1", slug: "jane-doe", full_name: "Jane Doe", email: "jane@example.com", status: "active" }] });
  const res = await create({ slug: "jane-doe", full_name: "Jane Doe", email: "other@example.com", status: "active" });
  assert.equal(res.statusCode, 409);
  assert.match(res.body.message, /already uses that web address/);
  assert.doesNotMatch(res.body.message, /duplicate key|constraint/);
  assert.equal(world.store.audit_events.length, 0);
  assert.equal(world.store.trainers.length, 1);
});

test("two trainers cannot share an email (it is the portal login): create and update both answer 409 and write nothing", async () => {
  const world = makeWorld({ trainers: [
    { id: "t1", slug: "jane-doe", full_name: "Jane Doe", email: "Jane@Example.com", status: "active", version: 1 },
    { id: "t2", slug: "bob-ray", full_name: "Bob Ray", email: "bob@example.com", status: "active", version: 1 }
  ] });
  const created = await create({ slug: "jane-doe-2", full_name: "Jane Doe", email: "jane@example.com", status: "active" });
  assert.equal(created.statusCode, 409);
  assert.match(created.body.message, /Another trainer \(Jane Doe\) already uses jane@example.com/);
  const updated = await update("t2", { email: "jane@example.com" });
  assert.equal(updated.statusCode, 409);
  assert.equal(world.writes.length, 0, "no table was written");
  // Saving a trainer with their OWN email is still fine.
  const own = await update("t2", { email: "bob@example.com", phone: "555" });
  assert.equal(own.statusCode, 200);
  assert.equal(world.store.trainers[1].phone, "555");
  // An archived trainer does not block the address.
  world.store.trainers[0].status = "archived";
  assert.equal((await update("t2", { email: "jane@example.com" })).statusCode, 200);
});

test("ensure-trainer-user refuses to turn a STAFF login into a trainer login (409, portal_users untouched, no auth call)", async () => {
  const world = makeWorld({
    trainers: [{ id: "t9", slug: "new-guy", full_name: "New Guy", email: "angela@lorenzosdogtrainingteam.com", status: "active", auth_user_id: null }],
    authUsers: [{ id: "u-angela", email: "angela@lorenzosdogtrainingteam.com" }]
  });
  for (const sandboxFlag of ["", "1"]) {
    process.env.LDTT_SANDBOX = sandboxFlag;
    const res = await call(ensureTrainerUser, { trainer_id: "t9", email: "angela@lorenzosdogtrainingteam.com", display_name: "New Guy" });
    assert.equal(res.statusCode, 409, `sandbox=${sandboxFlag}`);
    assert.equal(res.body.staffLogin, true);
    assert.match(res.body.message, /is a staff login \(Angela Office\)/);
  }
  process.env.LDTT_SANDBOX = "";
  const angela = world.store.portal_users.find(p => p.user_id === "u-angela");
  assert.equal(angela.role, "admin");
  assert.equal(angela.trainer_id, undefined);
  assert.equal(world.writes.filter(w => w.table === "portal_users").length, 0);
  assert.equal(world.authAdminCalls.filter(c => c.method === "POST").length, 0);
});

test("LIVE: a new trainer email creates the login with the temporary password and a trainer portal row that must change it", async () => {
  process.env.LDTT_SANDBOX = "";
  const world = makeWorld({ trainers: [{ id: "t5", slug: "sam-hill", full_name: "Sam Hill", email: "sam@example.com", status: "active", auth_user_id: null }] });
  const res = await call(ensureTrainerUser, { trainer_id: "t5", email: "sam@example.com", display_name: "Sam Hill" });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.created, true);
  assert.equal(res.body.temporary_password, "temp-pass-for-tests");
  const created = world.authAdminCalls.find(c => c.method === "POST");
  assert.equal(created.body.email, "sam@example.com");
  assert.equal(created.body.password, "temp-pass-for-tests");
  const row = world.store.portal_users.find(p => p.trainer_id === "t5");
  assert.equal(row.role, "trainer");
  assert.equal(row.must_change_password, true);
  assert.equal(world.store.trainers[0].auth_user_id, created ? world.authUsers.at(-1).id : null);
});

test("PRACTICE COPY: never creates or changes an auth user; with no login it enables the trainer and says so, with an existing login it links it", async () => {
  process.env.LDTT_SANDBOX = "1";
  assert.equal(sandbox.isSandbox(), true);
  try {
    const world = makeWorld({
      trainers: [
        { id: "t6", slug: "no-login", full_name: "No Login", email: "nologin@example.com", status: "active", auth_user_id: null },
        { id: "t7", slug: "has-login", full_name: "Has Login", email: "trainer@lorenzosdogtrainingteam.com", status: "active", auth_user_id: null }
      ],
      authUsers: [{ id: "u-sandbox-trainer", email: "trainer@lorenzosdogtrainingteam.com" }]
    });
    const none = await call(ensureTrainerUser, { trainer_id: "t6", email: "nologin@example.com", display_name: "No Login" });
    assert.equal(none.statusCode, 200);
    assert.equal(none.body.user_id, null);
    assert.equal(none.body.created, false);
    assert.match(none.body.message, /no login was created/);
    assert.equal(world.store.trainers[0].access_status, "active");
    assert.equal(world.store.portal_users.some(p => p.trainer_id === "t6"), false, "no portal row without a login (FK to auth.users)");
    const linked = await call(ensureTrainerUser, { trainer_id: "t7", email: "trainer@lorenzosdogtrainingteam.com", display_name: "Has Login" });
    assert.equal(linked.statusCode, 200);
    assert.equal(linked.body.user_id, "u-sandbox-trainer");
    assert.match(linked.body.message, /No login was created or changed/);
    assert.equal(world.store.portal_users.find(p => p.user_id === "u-sandbox-trainer").trainer_id, "t7");
    assert.equal(world.authAdminCalls.filter(c => c.method !== "GET").length, 0, "no auth admin write on the practice copy");
  } finally {
    process.env.LDTT_SANDBOX = "";
  }
});

test("a trainer saves their own social links (own trainer only, links cleaned, a bad link refused with a plain sentence)", async () => {
  const world = makeWorld({
    trainers: [{ id: "t-harley", slug: "harley-mcgrew", full_name: "Harley McGrew", status: "active", social_links: { facebook: "https://facebook.com/old" } }, { id: "t-other", slug: "other", full_name: "Other", status: "active" }],
    pages: [{ id: "p-harley", trainer_id: "t-harley", slug: "harley-mcgrew", social_facebook: "https://facebook.com/old" }, { id: "p-other", trainer_id: "t-other", slug: "other" }]
  });
  // trainer_id in the body is ignored for a trainer: they can only write their own row
  const res = await call(socialLinks, { trainer_id: "t-other", instagram: "instagram.com/harley", facebook: "", tiktok: "https://tiktok.com/@harley" }, "u-harley-token");
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.links, { facebook: null, instagram: "https://instagram.com/harley", tiktok: "https://tiktok.com/@harley" });
  assert.equal(world.store.trainer_pages[0].social_instagram, "https://instagram.com/harley");
  assert.equal(world.store.trainer_pages[0].social_facebook, null);
  assert.equal(world.store.trainer_pages[1].social_instagram, undefined, "the other trainer's page is untouched");
  assert.deepEqual(world.store.trainers[0].social_links, { facebook: null, instagram: "https://instagram.com/harley", tiktok: "https://tiktok.com/@harley" });
  const bad = await call(socialLinks, { instagram: "not a link" }, "u-harley-token");
  assert.equal(bad.statusCode, 400);
  assert.match(bad.body.message, /instagram link is not a web address/);
  assert.equal((await call(socialLinks, { instagram: "https://instagram.com/x" }, "no-such-token")).statusCode, 403);
});
