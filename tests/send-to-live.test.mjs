// Unit tests for api/send-to-live.js and api/practice-reset.js against a fake
// Supabase that keeps TWO schemas (public = live, practice = the practice copy)
// and picks one from the PostgREST profile headers, exactly like the real
// project. Run: node --test tests/
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
const resetHandler = require("../api/practice-reset.js");
const template = require("../lib/ad-page-template.js");

const OFFICE = { user_id: "u-office", role: "admin", permission_level: "office_admin", active: true, access_status: "active", email: "angela@lorenzosdogtrainingteam.com", first_name: "Angela", last_name: "Office" };
const SUPER = { user_id: "u-super", role: "admin", permission_level: "super_admin", active: true, access_status: "active", email: "joshua@lorenzosdogtrainingteam.com" };
const TRAINER = { user_id: "u-trainer", role: "trainer", permission_level: "trainer", active: true, access_status: "active", email: "trainer@lorenzosdogtrainingteam.com" };
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const PRACTICE_URL = key => `http://supabase.test/storage/v1/object/public/practice-trainer-page-assets/${key}`;
const LIVE_URL = key => `http://supabase.test/storage/v1/object/public/trainer-page-assets/${key}`;

function makeWorld({ tokens = { "office-token": OFFICE, "trainer-token": TRAINER, "super-token": SUPER }, live = {}, practice = {} } = {}) {
  const blank = () => ({ trainers: [], trainer_pages: [], trainer_page_versions: [], ad_pages: [], ad_page_revisions: [], portal_users: Object.values(tokens) });
  const schemas = {
    public: { ...blank(), ...live },
    practice: { ...blank(), send_to_live_log: [], ...practice }
  };
  const writes = [];   // every non-GET to a table, tagged with its schema
  const copies = [];   // storage copy calls
  const deleted = [];  // storage delete calls
  const rpcs = [];     // rpc calls
  const buckets = ["trainer-page-assets", "practice-trainer-page-assets", "trainer-submissions", "practice-trainer-submissions"];
  const objects = { "practice-trainer-page-assets": ["t1/hero.jpg"] };
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
    const headers = options.headers || {};
    if (u.pathname === "/auth/v1/user") {
      const token = String(headers.Authorization || "").replace(/^Bearer\s+/, "");
      const pu = tokens[token];
      return pu ? json(200, { id: pu.user_id, email: pu.email }) : json(401, { message: "bad token" });
    }
    if (u.pathname === "/storage/v1/object/copy") {
      const body = JSON.parse(options.body);
      copies.push(body);
      const have = objects[body.bucketId] || [];
      if (!have.includes(body.sourceKey)) return json(404, { message: "Object not found" });
      objects[body.destinationBucket] = objects[body.destinationBucket] || [];
      if (objects[body.destinationBucket].includes(body.destinationKey)) return json(409, { message: "The resource already exists" });
      objects[body.destinationBucket].push(body.destinationKey);
      return json(200, { Key: `${body.destinationBucket}/${body.destinationKey}` });
    }
    if (u.pathname === "/storage/v1/bucket") return json(200, buckets.map(id => ({ id })));
    if (u.pathname.startsWith("/storage/v1/object/list/")) {
      const bucket = decodeURIComponent(u.pathname.split("/").pop());
      return json(200, (objects[bucket] || []).map(name => ({ name, id: randomUUID() })));
    }
    if (method === "DELETE" && u.pathname.startsWith("/storage/v1/object/")) {
      const bucket = decodeURIComponent(u.pathname.split("/").pop());
      deleted.push({ bucket, prefixes: JSON.parse(options.body).prefixes });
      objects[bucket] = [];
      return json(200, []);
    }
    const profile = headers["Accept-Profile"] || headers["Content-Profile"];
    if (!profile) return json(500, { message: `test: request without a schema profile: ${method} ${u.pathname}` });
    const store = schemas[profile];
    if (!store) return json(406, { message: `The schema must be one of the following: public, graphql_public, practice` });
    const table = u.pathname.replace("/rest/v1/", "");
    if (table.startsWith("rpc/")) { rpcs.push({ profile, name: table.slice(4) }); return json(200, { reset_at: "2026-09-05T11:00:00.000Z", rows: { leads: 174 } }); }
    if (!store[table]) return json(404, { message: `Could not find the table '${profile}.${table}'` });
    const body = options.body ? JSON.parse(options.body) : null;
    if (method === "GET") return json(200, filters(store[table], u.searchParams));
    writes.push({ schema: profile, table, method, body, params: Object.fromEntries(u.searchParams) });
    if (method === "POST") {
      const rows = (Array.isArray(body) ? body : [body]).map(row => ({ id: randomUUID(), created_at: "2026-09-05T10:00:00.000Z", updated_at: "2026-09-05T10:00:00.000Z", ...row }));
      if (["trainer_pages", "ad_pages", "trainers"].includes(table) && rows.some(r => store[table].some(x => x.slug === r.slug))) {
        return json(409, { message: `duplicate key value violates unique constraint "${table}_slug_key"` });
      }
      store[table].push(...rows);
      return json(201, rows);
    }
    if (method === "PATCH") {
      const targets = filters(store[table], u.searchParams);
      targets.forEach(row => Object.assign(row, body, { updated_at: "2026-09-05T10:05:00.000Z" }));
      return json(200, targets);
    }
    return json(405, { message: "nope" });
  };
  handler.deps.fetch = fetch;
  handler.deps.now = () => new Date("2026-09-05T10:05:00.000Z");
  resetHandler.deps.fetch = fetch;
  return { live: schemas.public, practice: schemas.practice, writes, copies, deleted, rpcs, objects };
}

async function call(body, token = "office-token", method = "POST", fn = handler) {
  const res = { statusCode: 200, headers: {}, body: null, setHeader(k, v) { this.headers[k] = v; }, status(code) { this.statusCode = code; return this; }, json(payload) { this.body = payload; return this; }, end() { return this; } };
  await fn({ method, headers: { authorization: `Bearer ${token}` }, body }, res);
  return res;
}

const publishedWrites = writes => writes.filter(w => w.body && JSON.stringify(w.body).match(/"published_content"|"published_revision"|"published_at"|"page_status":"published"|"status":"published"|"locked":true|"auth_user_id"/));
const practiceWrites = writes => writes.filter(w => w.schema === "practice" && w.table !== "send_to_live_log");

test("refused (404) when not running as the practice copy", async () => {
  process.env.LDTT_SANDBOX = "";
  try {
    makeWorld();
    assert.equal((await call({ kind: "ad_page", id: "x" })).statusCode, 404);
    assert.equal((await call({}, "super-token", "POST", resetHandler)).statusCode, 404);
  } finally {
    process.env.LDTT_SANDBOX = "1";
  }
});

test("refused (403) for a trainer role and for no token", async () => {
  makeWorld();
  assert.equal((await call({ kind: "trainer_page", id: "x" }, "trainer-token")).statusCode, 403);
  assert.equal((await call({ kind: "trainer_page", id: "x" }, "")).statusCode, 403);
});

test("trainer page edited on the practice copy: the LIVE draft changes, published_content untouched, practice row untouched", async () => {
  const trainerId = randomUUID(); const pageId = randomUUID();
  const livePage = { id: pageId, trainer_id: trainerId, slug: "jane-doe", page_status: "published", locked: true, revision: 3, published_revision: 3, headline: "Old headline", draft_content: { trainer_name: "Jane Doe", bio: "old bio" }, published_content: { trainer_name: "Jane Doe", bio: "LIVE bio" }, style_settings: { font_family: "Inter" }, section_order: ["hero"] };
  const { live, practice, writes } = makeWorld({
    live: { trainers: [{ id: trainerId, slug: "jane-doe", full_name: "Jane Doe", status: "active" }], trainer_pages: [livePage] },
    practice: { trainers: [{ id: trainerId, slug: "jane-doe", full_name: "Jane Doe", status: "active" }], trainer_pages: [{ ...livePage, headline: "New headline from practice", draft_content: { trainer_name: "Jane Doe", bio: "new bio from practice" } }] }
  });
  const res = await call({ kind: "trainer_page", id: pageId });
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  const row = live.trainer_pages[0];
  assert.equal(row.headline, "New headline from practice");
  assert.equal(row.draft_content.bio, "new bio from practice");
  assert.equal(row.draft_content._sent_from_practice.by, OFFICE.email);
  assert.deepEqual(row.published_content, { trainer_name: "Jane Doe", bio: "LIVE bio" });
  assert.equal(row.page_status, "published", "an already-published page is not unpublished");
  assert.equal(row.locked, true);
  assert.equal(row.published_revision, 3);
  assert.equal(row.revision, 5);
  assert.equal(publishedWrites(writes).length, 0, "never writes published_* / locked / auth_user_id");
  assert.equal(live.trainer_page_versions.length, 1);
  assert.equal(live.trainer_page_versions[0].revision, 4);
  assert.match(live.trainer_page_versions[0].content._note, /^Sent from practice copy by angela@lorenzosdogtrainingteam.com at 2026-09-05T10:05:00.000Z$/);
  assert.equal(live.trainers.length, 1, "existing trainer is not duplicated");
  assert.equal(practiceWrites(writes).length, 0, "the practice tables are only read");
  assert.equal(practice.send_to_live_log.length, 1);
  assert.equal(practice.send_to_live_log[0].entity_id, pageId);
  assert.equal(practice.send_to_live_log[0].live_id, pageId);
  assert.match(res.body.message, /Trainer Network/);
});

test("practice-only trainer with uploaded photos: live trainer + unpublished page created, photos copied practice- → live bucket, URLs re-pointed, second send does not duplicate", async () => {
  const trainerId = randomUUID(); const pageId = randomUUID();
  const { live, practice, writes, copies, objects } = makeWorld({
    practice: {
      trainers: [{ id: trainerId, slug: "new-trainer", full_name: "New Trainer", email: "new@example.com", status: "active", access_status: "active", bio: "hi", headshot_url: PRACTICE_URL("t1/hero.jpg") }],
      trainer_pages: [{ id: pageId, trainer_id: trainerId, slug: "new-trainer", page_status: "published", locked: true, revision: 2, published_revision: 2, headline: "Hello", hero_image_url: PRACTICE_URL("t1/hero.jpg"), approved_photo_urls: [PRACTICE_URL("t1/hero.jpg")], draft_content: { trainer_name: "New Trainer", gallery: [{ url: PRACTICE_URL("t1/hero.jpg") }] }, published_content: { trainer_name: "New Trainer" }, style_settings: {}, section_order: ["hero"], public_url: "https://practice.example/newtrainer" }]
    }
  });
  const res = await call({ kind: "trainer_page", id: pageId });
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(res.body.trainer, "created");
  assert.equal(res.body.files_copied, 1);
  assert.equal(live.trainers.length, 1);
  assert.equal(live.trainers[0].status, "enrolled", "new live trainer is enrolled, not active");
  assert.equal(live.trainers[0].auth_user_id, undefined, "no auth user is ever attached");
  assert.equal(live.trainers[0].headshot_url, LIVE_URL("t1/hero.jpg"), "trainer photo points at the live bucket");
  assert.equal(live.trainer_pages.length, 1);
  const page = live.trainer_pages[0];
  assert.equal(page.page_status, "draft", "a page published on the practice copy arrives on live as a DRAFT");
  assert.equal(page.locked, false);
  assert.equal(page.trainer_id, live.trainers[0].id);
  assert.equal(page.public_url, undefined, "the practice URL is not copied to live");
  assert.equal(page.published_content, undefined);
  assert.equal(page.hero_image_url, LIVE_URL("t1/hero.jpg"));
  assert.deepEqual(page.approved_photo_urls, [LIVE_URL("t1/hero.jpg")]);
  assert.equal(page.draft_content.gallery[0].url, LIVE_URL("t1/hero.jpg"));
  assert.equal(JSON.stringify(page).includes("practice-trainer-page-assets"), false, "no practice bucket URL reaches live");
  assert.deepEqual(copies, [{ bucketId: "practice-trainer-page-assets", sourceKey: "t1/hero.jpg", destinationBucket: "trainer-page-assets", destinationKey: "t1/hero.jpg" }], "one copy per file, never a move");
  assert.deepEqual(objects["practice-trainer-page-assets"], ["t1/hero.jpg"], "the practice file is still there");
  assert.equal(publishedWrites(writes).length, 0);
  assert.equal(practiceWrites(writes).length, 0);
  assert.equal(practice.send_to_live_log.length, 1);

  // Second send of the same practice page: same live row, same trainer, copy skipped (already exists).
  practice.trainer_pages[0].headline = "Hello again";
  const again = await call({ kind: "trainer_page", id: pageId });
  assert.equal(again.statusCode, 200, JSON.stringify(again.body));
  assert.equal(live.trainer_pages.length, 1, "no duplicate live page");
  assert.equal(live.trainers.length, 1, "no duplicate live trainer");
  assert.equal(live.trainer_pages[0].headline, "Hello again");
  assert.equal(again.body.live_id, res.body.live_id);
  assert.equal(again.body.files_copied, 0);
  assert.equal(copies.length, 2, "copy is attempted again and the 409 is accepted");
  assert.equal(practice.send_to_live_log.length, 2);
});

test("ad page from the practice copy: live draft + revision note; second send updates, does not duplicate", async () => {
  const content = template.marketToContent(template.markets[0]);
  content.slug = "dog-training-dayton-oh"; content.market = "Dayton, OH"; content.city = "Dayton"; content.state = "OH";
  const practiceId = randomUUID();
  const { live, practice, writes } = makeWorld({ practice: { ad_pages: [{ id: practiceId, slug: content.slug, market: content.market, city: "Dayton", state: "OH", status: "published", draft_content: content, published_content: content, draft_revision: 1, published_revision: 1 }] } });
  const res = await call({ kind: "ad_page", id: practiceId });
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(live.ad_pages.length, 1);
  const row = live.ad_pages[0];
  assert.equal(row.status, "draft", "published on the practice copy arrives on live as a draft");
  assert.equal(row.slug, "dog-training-dayton-oh");
  assert.equal(row.draft_content.market, "Dayton, OH");
  assert.equal(row.published_content, undefined);
  assert.match(row.updated_by, /from practice copy/);
  assert.equal(live.ad_page_revisions.length, 1);
  assert.equal(live.ad_page_revisions[0].kind, "draft");
  assert.match(live.ad_page_revisions[0].created_by, /^Sent from practice copy by angela@/);
  assert.equal(publishedWrites(writes).length, 0);
  assert.equal(practiceWrites(writes).length, 0);
  assert.match(res.body.message, /Page Studio/);
  assert.equal(practice.send_to_live_log[0].entity_type, "ad_page");

  practice.ad_pages[0].draft_content = { ...content, title: "Second title" };
  const again = await call({ kind: "ad_page", id: practiceId });
  assert.equal(again.statusCode, 200, JSON.stringify(again.body));
  assert.equal(live.ad_pages.length, 1, "matched by slug, not duplicated");
  assert.equal(live.ad_pages[0].draft_content.title, "Second title");
  assert.equal(live.ad_pages[0].draft_revision, 2);
  assert.equal(live.ad_page_revisions.length, 2);
  assert.equal(publishedWrites(writes).length, 0);
});

test("ad page with a live PUBLISHED row: only the draft changes, the public copy stays", async () => {
  const liveId = randomUUID();
  const content = template.marketToContent(template.markets[0]);
  content.slug = "dog-training-akron-oh";
  const liveRow = { id: liveId, slug: content.slug, market: content.market, city: content.city, state: content.state, status: "published", draft_content: content, published_content: { ...content, title: "PUBLIC" }, draft_revision: 4, published_revision: 2, published_at: "2026-09-01T00:00:00Z" };
  const { live, writes } = makeWorld({ live: { ad_pages: [liveRow] }, practice: { ad_pages: [{ ...liveRow, draft_content: { ...content, title: "Practice title" } }] } });
  const res = await call({ kind: "ad_page", id: liveId });
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(live.ad_pages[0].status, "published");
  assert.equal(live.ad_pages[0].published_content.title, "PUBLIC");
  assert.equal(live.ad_pages[0].draft_content.title, "Practice title");
  assert.equal(live.ad_pages[0].draft_revision, 5);
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
  const { live } = makeWorld({ practice: { ad_pages: [{ id: randomUUID(), slug: "dog-training-x-oh", draft_content: { ...template.marketToContent(template.markets[0]), slug: "dog-training-x-oh" } }] } });
  delete live.ad_pages;
  const res = await call({ kind: "ad_page", slug: "dog-training-x-oh" });
  assert.equal(res.statusCode, 503);
  assert.match(res.body.message, /ad_pages table is not in the live database yet/);
});

test("practice reset: super admin only, calls practice.reset_from_live() and empties only practice-* buckets", async () => {
  const { rpcs, deleted, objects } = makeWorld();
  objects["trainer-page-assets"] = ["live/keep.jpg"];
  assert.equal((await call({}, "office-token", "POST", resetHandler)).statusCode, 403, "office admin cannot reset");
  assert.equal((await call({}, "", "POST", resetHandler)).statusCode, 403);
  const res = await call({}, "super-token", "POST", resetHandler);
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.deepEqual(rpcs, [{ profile: "practice", name: "reset_from_live" }], "the RPC resolves in the practice schema");
  assert.deepEqual(deleted.map(d => d.bucket).sort(), ["practice-trainer-page-assets"], "only a practice bucket with files is emptied");
  assert.deepEqual(objects["trainer-page-assets"], ["live/keep.jpg"], "live files are never touched");
  assert.match(res.body.message, /matches live/);
});
