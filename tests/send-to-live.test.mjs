// Unit tests for api/send-to-live.js against a fake Supabase and a fake
// practice store. Run: node --test tests/send-to-live.test.mjs
// NOT deployed (tests/ is in .vercelignore). Nothing here talks to the real project.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";

const require = createRequire(import.meta.url);
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
process.env.SUPABASE_URL = "http://supabase.test";
process.env.LDTT_SANDBOX = "1";
const handler = require("../api/send-to-live.js");
const { applyOps } = require("../lib/sandbox-store.js");
const template = require("../lib/ad-page-template.js");

const OFFICE = { user_id: "u-office", role: "admin", permission_level: "office_admin", active: true, access_status: "active", email: "angela@lorenzosdogtrainingteam.com", first_name: "Angela", last_name: "Office" };
const TRAINER = { user_id: "u-trainer", role: "trainer", permission_level: "trainer", active: true, access_status: "active", email: "trainer@lorenzosdogtrainingteam.com" };
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function makeWorld({ tokens = { "office-token": OFFICE, "trainer-token": TRAINER }, tables = {} } = {}) {
  const db = { trainers: [], trainer_pages: [], trainer_page_versions: [], ad_pages: [], ad_page_revisions: [], portal_users: Object.values(tokens), ...tables };
  const writes = [];
  const ops = [];
  const filters = (rows, params) => {
    let out = rows;
    for (const [key, raw] of params) {
      if (["select", "order", "limit", "on_conflict"].includes(key)) continue;
      const [op, ...rest] = raw.split("."); const value = rest.join(".");
      if (op === "eq") out = out.filter(r => String(r[key]) === value);
    }
    const limit = Number(params.get("limit") || 0);
    return limit ? out.slice(0, limit) : out;
  };
  const fetch = async (url, options = {}) => {
    const u = new URL(url);
    const method = (options.method || "GET").toUpperCase();
    if (u.pathname === "/auth/v1/user") {
      const token = String(options.headers?.Authorization || "").replace(/^Bearer\s+/, "");
      const pu = tokens[token];
      return pu ? json(200, { id: pu.user_id, email: pu.email }) : json(401, { message: "bad token" });
    }
    const table = u.pathname.replace("/rest/v1/", "");
    if (!db[table]) return json(404, { message: `Could not find the table 'public.${table}'` });
    const body = options.body ? JSON.parse(options.body) : null;
    if (method === "GET") return json(200, filters(db[table], u.searchParams));
    writes.push({ table, method, body, params: Object.fromEntries(u.searchParams) });
    if (method === "POST") {
      const rows = (Array.isArray(body) ? body : [body]).map(row => ({ id: randomUUID(), created_at: "2026-09-05T10:00:00.000Z", updated_at: "2026-09-05T10:00:00.000Z", ...row }));
      if (table === "trainer_pages" || table === "ad_pages" || table === "trainers") {
        if (rows.some(r => db[table].some(x => x.slug === r.slug))) return json(409, { message: `duplicate key value violates unique constraint "${table}_slug_key"` });
      }
      db[table].push(...rows);
      return json(201, rows);
    }
    if (method === "PATCH") {
      const targets = filters(db[table], u.searchParams);
      targets.forEach(row => Object.assign(row, body, { updated_at: "2026-09-05T10:05:00.000Z" }));
      return json(200, targets);
    }
    return json(405, { message: "nope" });
  };
  const store = {
    readOps: async () => ops.slice(),
    appendOp: async op => { ops.push({ ...op, at: "2026-09-05T10:05:00.000Z" }); return op; },
    applyOps
  };
  handler.deps.fetch = fetch;
  handler.deps.store = store;
  handler.deps.now = () => new Date("2026-09-05T10:05:00.000Z");
  return { db, writes, ops, store };
}

async function call(body, token = "office-token", method = "POST") {
  const res = { statusCode: 200, headers: {}, body: null, setHeader(k, v) { this.headers[k] = v; }, status(code) { this.statusCode = code; return this; }, json(payload) { this.body = payload; return this; }, end() { return this; } };
  await handler({ method, headers: { authorization: `Bearer ${token}` }, body }, res);
  return res;
}

const publishedWrites = writes => writes.filter(w => w.body && JSON.stringify(w.body).match(/"published_content"|"published_revision"|"published_at"|"page_status":"published"|"status":"published"|"locked":true|"auth_user_id"/));

test("refused (404) when not running as the sandbox", async () => {
  process.env.LDTT_SANDBOX = "";
  try {
    makeWorld();
    const res = await call({ kind: "ad_page", id: "x" });
    assert.equal(res.statusCode, 404);
  } finally {
    process.env.LDTT_SANDBOX = "1";
  }
});

test("refused (403) for a trainer role and for no token", async () => {
  makeWorld();
  assert.equal((await call({ kind: "trainer_page", id: "x" }, "trainer-token")).statusCode, 403);
  assert.equal((await call({ kind: "trainer_page", id: "x" }, "")).statusCode, 403);
});

test("trainer page with a live row: practice edits land in the live draft, published_content untouched", async () => {
  const trainerId = randomUUID(); const pageId = randomUUID();
  const { db, writes, ops, store } = makeWorld({ tables: {
    trainers: [{ id: trainerId, slug: "jane-doe", full_name: "Jane Doe", status: "active" }],
    trainer_pages: [{ id: pageId, trainer_id: trainerId, slug: "jane-doe", page_status: "published", locked: true, revision: 3, published_revision: 3, headline: "Old headline", draft_content: { trainer_name: "Jane Doe", bio: "old bio" }, published_content: { trainer_name: "Jane Doe", bio: "LIVE bio" }, style_settings: { font_family: "Inter" }, section_order: ["hero"] }]
  } });
  await store.appendOp({ operation: "update", entity_type: "trainer_page", id: pageId, changes: { headline: "New headline from sandbox", draft_content: { trainer_name: "Jane Doe", bio: "new bio from sandbox" }, updated_at: "x" }, actor: OFFICE.email });
  const res = await call({ kind: "trainer_page", id: pageId });
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  const live = db.trainer_pages[0];
  assert.equal(live.headline, "New headline from sandbox");
  assert.equal(live.draft_content.bio, "new bio from sandbox");
  assert.equal(live.draft_content._sent_from_practice.by, OFFICE.email);
  assert.deepEqual(live.published_content, { trainer_name: "Jane Doe", bio: "LIVE bio" });
  assert.equal(live.page_status, "published", "an already-published page is not unpublished");
  assert.equal(live.locked, true);
  assert.equal(live.published_revision, 3);
  assert.equal(publishedWrites(writes).length, 0, "never writes published_* / locked / auth_user_id");
  assert.equal(db.trainer_page_versions.length, 1);
  assert.equal(db.trainer_page_versions[0].revision, 4);
  assert.match(db.trainer_page_versions[0].content._note, /^Sent from practice copy by angela@lorenzosdogtrainingteam.com at 2026-09-05T10:05:00.000Z$/);
  assert.equal(live.revision, 5);
  assert.equal(db.trainers.length, 1, "existing trainer is not duplicated");
  assert.equal(ops.at(-1).operation, "send_to_live");
  assert.equal(ops.at(-1).live_id, pageId);
  assert.match(res.body.message, /Trainer Network/);
});

test("trainer page whose trainer only exists in the practice layer: live trainer + unpublished page are created", async () => {
  const { db, writes, ops } = makeWorld();
  const sbxTrainer = `sbx-${randomUUID()}`; const sbxPage = `sbx-${randomUUID()}`;
  await handler.deps.store.appendOp({ operation: "create", entity_type: "trainer", record: { id: sbxTrainer, slug: "new-trainer", full_name: "New Trainer", email: "new@example.com", status: "active", access_status: "active", bio: "hi" }, actor: OFFICE.email });
  await handler.deps.store.appendOp({ operation: "create", entity_type: "trainer_page", record: { id: sbxPage, trainer_id: sbxTrainer, slug: "new-trainer", page_status: "draft", locked: false, headline: "Hello", draft_content: { trainer_name: "New Trainer" }, style_settings: {}, section_order: ["hero"], public_url: "https://sandbox.example/newtrainer" }, actor: OFFICE.email });
  const res = await call({ kind: "trainer_page", id: sbxPage });
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(res.body.trainer, "created");
  assert.equal(db.trainers.length, 1);
  assert.equal(db.trainers[0].status, "enrolled", "new live trainer is enrolled, not active");
  assert.equal(db.trainers[0].auth_user_id, undefined, "no auth user is ever attached");
  assert.equal(db.trainer_pages.length, 1);
  assert.equal(db.trainer_pages[0].page_status, "draft");
  assert.equal(db.trainer_pages[0].locked, false);
  assert.equal(db.trainer_pages[0].trainer_id, db.trainers[0].id);
  assert.equal(db.trainer_pages[0].public_url, undefined, "the sandbox URL is not copied to live");
  assert.equal(db.trainer_pages[0].published_content, undefined);
  assert.equal(publishedWrites(writes).length, 0);
  assert.equal(ops.at(-1).operation, "send_to_live");

  // second send of the same practice page updates the same live row
  await handler.deps.store.appendOp({ operation: "update", entity_type: "trainer_page", id: sbxPage, changes: { headline: "Hello again" }, actor: OFFICE.email });
  const again = await call({ kind: "trainer_page", id: sbxPage });
  assert.equal(again.statusCode, 200, JSON.stringify(again.body));
  assert.equal(db.trainer_pages.length, 1, "no duplicate live page");
  assert.equal(db.trainers.length, 1, "no duplicate live trainer");
  assert.equal(db.trainer_pages[0].headline, "Hello again");
  assert.equal(again.body.live_id, res.body.live_id);
});

test("ad page from the practice layer: live draft + revision note; second send updates, does not duplicate", async () => {
  const { db, writes, ops } = makeWorld();
  const content = template.marketToContent(template.markets[0]);
  content.slug = "dog-training-dayton-oh"; content.market = "Dayton, OH"; content.city = "Dayton"; content.state = "OH";
  const sbxId = `sbx-${randomUUID()}`;
  await handler.deps.store.appendOp({ operation: "create", entity_type: "ad_page", record: { id: sbxId, slug: content.slug, market: content.market, city: "Dayton", state: "OH", status: "draft", draft_content: content, published_content: null, draft_revision: 1, published_revision: 0 }, actor: OFFICE.email });
  const res = await call({ kind: "ad_page", id: sbxId });
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(db.ad_pages.length, 1);
  const live = db.ad_pages[0];
  assert.equal(live.status, "draft");
  assert.equal(live.slug, "dog-training-dayton-oh");
  assert.equal(live.draft_content.market, "Dayton, OH");
  assert.equal(live.published_content, undefined);
  assert.match(live.updated_by, /from practice copy/);
  assert.equal(db.ad_page_revisions.length, 1);
  assert.equal(db.ad_page_revisions[0].kind, "draft");
  assert.match(db.ad_page_revisions[0].created_by, /^Sent from practice copy by angela@/);
  assert.equal(publishedWrites(writes).length, 0);
  assert.match(res.body.message, /Page Studio/);
  assert.equal(ops.at(-1).operation, "send_to_live");

  // edit on the sandbox, send again: same row, new draft revision
  await handler.deps.store.appendOp({ operation: "update", entity_type: "ad_page", id: sbxId, changes: { draft_content: { ...content, title: "Second title" } }, actor: OFFICE.email });
  const again = await call({ kind: "ad_page", id: sbxId });
  assert.equal(again.statusCode, 200, JSON.stringify(again.body));
  assert.equal(db.ad_pages.length, 1, "matched by slug, not duplicated");
  assert.equal(db.ad_pages[0].draft_content.title, "Second title");
  assert.equal(db.ad_pages[0].draft_revision, 2);
  assert.equal(db.ad_page_revisions.length, 2);
  assert.equal(publishedWrites(writes).length, 0);
});

test("ad page with a live PUBLISHED row: only the draft changes, the public copy stays", async () => {
  const liveId = randomUUID();
  const content = template.marketToContent(template.markets[0]);
  content.slug = "dog-training-akron-oh";
  const { db, writes } = makeWorld({ tables: { ad_pages: [{ id: liveId, slug: content.slug, market: content.market, city: content.city, state: content.state, status: "published", draft_content: content, published_content: { ...content, title: "PUBLIC" }, draft_revision: 4, published_revision: 2, published_at: "2026-09-01T00:00:00Z" }] } });
  await handler.deps.store.appendOp({ operation: "update", entity_type: "ad_page", id: liveId, changes: { draft_content: { ...content, title: "Sandbox title" } }, actor: OFFICE.email });
  const res = await call({ kind: "ad_page", id: liveId });
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(db.ad_pages[0].status, "published");
  assert.equal(db.ad_pages[0].published_content.title, "PUBLIC");
  assert.equal(db.ad_pages[0].draft_content.title, "Sandbox title");
  assert.equal(db.ad_pages[0].draft_revision, 5);
  assert.equal(publishedWrites(writes).length, 0);
});

test("the draft-only guard refuses any body that carries a published field", () => {
  assert.throws(() => handler.assertDraftOnly({ published_content: {} }), /refused to write published_content/);
  assert.throws(() => handler.assertDraftOnly({ page_status: "published" }), /refused to publish/);
  assert.throws(() => handler.assertDraftOnly({ status: "published" }), /refused to publish/);
  assert.throws(() => handler.assertDraftOnly({ locked: true }), /refused to publish/);
  assert.throws(() => handler.assertDraftOnly({ auth_user_id: "x" }), /refused to write auth_user_id/);
  assert.doesNotThrow(() => handler.assertDraftOnly({ draft_content: {}, page_status: "draft" }));
});

test("ad_pages table missing on live gives a plain message, not a crash", async () => {
  const { db } = makeWorld();
  delete db.ad_pages;
  await handler.deps.store.appendOp({ operation: "create", entity_type: "ad_page", record: { id: "sbx-1", slug: "dog-training-x-oh", draft_content: { ...template.marketToContent(template.markets[0]), slug: "dog-training-x-oh" } }, actor: OFFICE.email });
  const res = await call({ kind: "ad_page", id: "sbx-1" });
  assert.equal(res.statusCode, 503);
  assert.match(res.body.message, /ad_pages table is not in the live database yet/);
});
