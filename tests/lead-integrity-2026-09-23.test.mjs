// Lead integrity, Joshua 2026-09-23. Two demands, both proved here against a stubbed database.
//
// A. "Pensacola makes a new lead" must hold for EVERY door, not just the two pages that showed the
//    bug. This file walks the SAME person through all 12 ad 2.0 pages one after another, then
//    through the Contact page / trainer landing pages / market guide + ebook forms / the office lead
//    form, then /book with no lead and the no-trainer callback, and pins:
//      - every door makes its OWN lead and routes it to that market's trainer;
//      - a lead that already booked is never handed to the next request, same page or not;
//      - picking a DIFFERENT trainer on the same page is a new request too (fixed today);
//      - the genuine double submit (same door, same page, same ZIP, first lead untouched, inside 30
//        minutes) still answers ONE lead and enters the pipeline once, so it still texts once.
//
// B. Test leads never mix with live leads or live counts:
//      - every server Supabase call goes through the lib/sandbox.js schema switch, so the practice
//        copy can only write `practice` (api/send-to-live.js is the one documented exception, and it
//        may only write DRAFT columns);
//      - nothing copies practice rows into public: the reset / structure sync / pull are live ->
//        practice only;
//      - the qa hold-out (metrics.js, rule 1) still drops a test row from every count;
//      - NEW rule 98: an office smoke test on the LIVE site uses the set phrase "LDTT TEST" (or an
//        email tagged +ldtt-test) and the two server doors stamp raw_payload.qa = true, so the
//        existing hold-out catches it. Checked against live: nothing already there matches.
//
// NOT deployed (tests/ is in .vercelignore). Nothing here talks to the real project or to Google.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync, readdirSync } from "node:fs";

process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
process.env.SUPABASE_URL = "http://supabase.test";
delete process.env.LDTT_PRACTICE_ORIGIN;
delete process.env.RESEND_API_KEY;
delete process.env.LDTT_MAKE_HOOK_PATHWAY1;
delete process.env.LDTT_MAKE_HOOK_PATHWAY2;
process.env.LDTT_PRACTICE_HOST = "ldtt-sandbox.vercel.app";
const require = createRequire(import.meta.url);
const root = new URL("../", import.meta.url);
const read = path => readFileSync(new URL(path, root), "utf8");

// ---------------------------------------------------------------------------
// The 12 markets, straight out of lib/ad-page-markets.js (one 2.0 page each, rule 85).
// ---------------------------------------------------------------------------
const MK = require("../lib/ad-page-markets.js");
const MARKETS = (MK.markets || MK.MARKETS).map(m => ({
  slug: m.slug,
  // /ads/<market>: the short slug the 2.0 pages use (scripts/migrate-ad2-markets.mjs).
  ad2: m.slug.replace(/^dog-training-/, "").replace(/-[a-z]{2}$/, ""),
  market: m.market,
  zip: (m.zipCodes || [])[0]
}));
// One trainer per market, based at that market's own ZIP, each with a live calendar.
const TRAINERS = () => MARKETS.map((m, i) => ({
  id: `00000000-0000-4000-9000-${String(i + 1).padStart(12, "0")}`,
  slug: `trainer-${m.ad2}`,
  full_name: `Trainer ${m.ad2}`,
  market: m.market,
  state: "Ohio",
  headshot_url: "",
  status: "active",
  base_zip: m.zip
}));
const BOOKING_SETTINGS = () => ({
  key: "booking_trainers",
  value: {
    trainers: TRAINERS().map(t => ({
      slug: t.slug,
      trainer_id: t.id,
      schedule_id: `AcZssZ${"a".repeat(30)}${String(t.slug.length).padStart(2, "0")}`,
      time_zone: "America/New_York",
      slot_minutes: 60,
      zip_prefixes: [],
      location_mode: "in_home",
      active: true
    }))
  }
});

function fakeWorld() {
  const db = { leads: [], booking_holds: [], site_settings: [BOOKING_SETTINGS()], lead_events: [], lifecycle_events: [], communications_testers: [], trainers: TRAINERS() };
  const calls = [];
  let n = 0;
  const uuid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
  global.fetch = async (url, options = {}) => {
    const u = new URL(String(url));
    const method = options.method || "GET";
    let body = options.body;
    if (typeof body === "string") { try { body = JSON.parse(body); } catch { /* keep text */ } }
    calls.push({ host: u.host, method, path: u.pathname, url: String(url), headers: options.headers || {}, body });
    const res = (status, data) => ({ ok: status < 400, status, text: async () => JSON.stringify(data), json: async () => data });
    if (u.host !== "supabase.test") throw new Error(`unexpected host ${u.host}`);
    const table = u.pathname.replace("/rest/v1/", "");
    const rows = db[table];
    if (!rows) throw new Error(`unknown table ${table}`);
    const filters = [...u.searchParams].filter(([k]) => !["select", "order", "limit", "on_conflict"].includes(k));
    const match = row => filters.every(([k, v]) => {
      const [op, ...rest] = v.split(".");
      const val = rest.join(".");
      if (op === "eq") return String(row[k]) === val;
      if (op === "neq") return String(row[k]) !== val;
      if (op === "gte") return String(row[k] ?? "") >= val;
      return true;
    });
    if (method === "GET") return res(200, rows.filter(match));
    if (method === "POST") {
      const out = [];
      for (const r of Array.isArray(body) ? body : [body]) {
        const row = { id: uuid(), created_at: new Date().toISOString(), ...(table === "leads" ? { version: 1 } : {}), ...r };
        rows.push(row);
        out.push(row);
      }
      return res(201, out);
    }
    if (method === "PATCH") {
      const hit = rows.filter(match);
      hit.forEach(r => Object.assign(r, body));
      return res(200, hit);
    }
    throw new Error(`unexpected ${method}`);
  };
  return { db, calls };
}

function load(sandbox = true) {
  for (const m of ["../lib/sandbox.js", "../lib/office-test-lead.js", "../lib/booking.js", "../api/booking-lead.js", "../api/booking.js"]) delete require.cache[require.resolve(m)];
  if (sandbox) process.env.LDTT_SANDBOX = "1"; else delete process.env.LDTT_SANDBOX;
  return { B: require("../lib/booking.js"), leadApi: require("../api/booking-lead.js") };
}

async function call(handler, { method = "POST", body, query = {}, headers = {} } = {}) {
  const res = { statusCode: 0, payload: null, sent: null, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.statusCode = c; return this; }, json(d) { this.payload = d; return this; }, send(d) { this.sent = d; return this; }, end() { return this; } };
  await handler({ method, body, query, headers: { host: "ldtt-sandbox.vercel.app", ...headers } }, res);
  return res;
}

// One person, every door. Exactly what Joshua does when he walks the markets.
const PERSON = { first_name: "Joshua", last_name: "Matthews", phone: "440-555-0100", email: "mr.matthews.test@example.test" };
const adSubmit = (market, over = {}) => ({
  ...PERSON, zip: market.zip, problem: "Pulling on the leash", dog_name: "Rex", sms_consent: false,
  source_page: `https://ldtt-sandbox.vercel.app/ads/${market.ad2}`, ...over
});
const markBooked = row => {
  row.status = "evaluation_scheduled";
  row.raw_payload = { ...row.raw_payload, booking: { ...row.raw_payload.booking, slot_start: new Date(Date.now() + 86400000).toISOString() } };
};

// ===========================================================================
// A. Every door
// ===========================================================================

test("A: the 12 ad 2.0 markets are the 12 markets on file, and every one of their ZIPs is a real ZIP", () => {
  const { B } = load(true);
  assert.equal(MARKETS.length, 12, "12 ad 2.0 pages (rule 85)");
  assert.equal(new Set(MARKETS.map(m => m.ad2)).size, 12, "each page has its own /ads/<market> address");
  MARKETS.forEach(m => {
    assert.match(m.zip, /^\d{5}$/, `${m.ad2} has a ZIP`);
    assert.ok(B.centroid(m.zip), `${m.ad2}: ZIP ${m.zip} is in the bundled Census file (rule 74)`);
  });
});

test("A: the SAME person walks all 12 ad 2.0 pages one after another - 12 leads, each routed to that market's trainer", async () => {
  const { leadApi } = load(true);
  const { db } = fakeWorld();
  const seen = [];
  for (const market of MARKETS) {
    const out = await call(leadApi, { body: adSubmit(market) });
    assert.equal(out.statusCode, 200, `${market.ad2} answered`);
    assert.ok(out.payload.lead_id, `${market.ad2} saved a lead`);
    assert.equal(out.payload.duplicate, undefined, `${market.ad2} is a NEW lead, never a reused one`);
    assert.ok(!seen.includes(out.payload.lead_id), `${market.ad2} did not hand back an earlier market's lead`);
    seen.push(out.payload.lead_id);
    const row = db.leads.find(l => l.id === out.payload.lead_id);
    assert.equal(row.zip, market.zip, `${market.ad2} kept its own ZIP`);
    assert.equal(row.trainer_slug, `trainer-${market.ad2}`, `${market.ad2} routed to its own market's trainer`);
    assert.equal(row.status, "new_inquiry");
    assert.equal(row.raw_payload.booking.slot_start, undefined, `${market.ad2} carries no earlier booking`);
    assert.equal(out.payload.book_url, `https://ldtt-sandbox.vercel.app/book/trainer-${market.ad2}?lead=${row.id}`);
  }
  assert.equal(db.leads.length, 12, "12 pages, 12 leads");
  assert.equal(new Set(db.leads.map(l => l.trainer_slug)).size, 12, "12 different trainers");
});

test("A: it still holds when every market is BOOKED before the next one is opened", async () => {
  const { leadApi } = load(true);
  const { db } = fakeWorld();
  const ids = [];
  for (const market of MARKETS) {
    const out = await call(leadApi, { body: adSubmit(market) });
    const row = db.leads.find(l => l.id === out.payload.lead_id);
    assert.ok(!ids.includes(row.id), `${market.ad2} never reopened a finished booking`);
    ids.push(row.id);
    markBooked(row); // the person goes all the way through before opening the next market page
  }
  assert.equal(db.leads.length, 12);
  assert.equal(db.leads.filter(l => l.status === "evaluation_scheduled").length, 12);
});

test("A: back to the SAME page after booking = a NEW lead (the first one is finished)", async () => {
  const { leadApi } = load(true);
  const { db } = fakeWorld();
  const market = MARKETS.find(m => m.ad2 === "pensacola");
  const first = await call(leadApi, { body: adSubmit(market) });
  markBooked(db.leads.find(l => l.id === first.payload.lead_id));
  const again = await call(leadApi, { body: adSubmit(market) });
  assert.notEqual(again.payload.lead_id, first.payload.lead_id, "the same page must not reopen the finished booking");
  assert.equal(again.payload.duplicate, undefined);
  assert.equal(db.leads.length, 2);
  assert.equal(db.leads[1].status, "new_inquiry");
});

test("A: the genuine double submit still answers ONE lead and enters the pipeline once", async () => {
  const { leadApi } = load(true);
  const { db } = fakeWorld();
  const market = MARKETS.find(m => m.ad2 === "cleveland");
  const one = await call(leadApi, { body: adSubmit(market) });
  const two = await call(leadApi, { body: adSubmit(market) });
  assert.equal(two.payload.lead_id, one.payload.lead_id, "the same form sent twice is one lead");
  assert.equal(two.payload.duplicate, true);
  assert.equal(db.leads.length, 1, "no second row, so no second text");
  assert.equal(db.lead_events.length, 1, "one form_submitted event, not two");
});

test("A: picking a DIFFERENT trainer on the same page is a new request (2.0 trainer cards)", async () => {
  const { leadApi } = load(true);
  const { db } = fakeWorld();
  // Pensacola and Tallahassee's first ZIPs are both in the Pensacola area, so both trainers are cards
  // for this ZIP: the visitor can change their mind without changing page or ZIP.
  const market = MARKETS.find(m => m.ad2 === "pensacola");
  const other = MARKETS.find(m => m.ad2 === "tallahassee");
  const first = await call(leadApi, { body: adSubmit(market, { trainer_slug: `trainer-${market.ad2}` }) });
  assert.equal(db.leads[0].trainer_slug, `trainer-${market.ad2}`);
  // Same page, same ZIP, same minute - but a different trainer picked.
  const second = await call(leadApi, { body: adSubmit(market, { trainer_slug: `trainer-${other.ad2}` }) });
  assert.notEqual(second.payload.lead_id, first.payload.lead_id, "a different pick is a different request");
  assert.equal(db.leads.length, 2);
  assert.equal(db.leads[1].trainer_slug, `trainer-${other.ad2}`, "the new lead goes to the trainer they picked");
  // ...and picking the SAME trainer twice is still one double submit.
  const third = await call(leadApi, { body: adSubmit(market, { trainer_slug: `trainer-${other.ad2}` }) });
  assert.equal(third.payload.lead_id, second.payload.lead_id);
  assert.equal(db.leads.length, 2);
});

test("A: the pick is kept as picked_slug, apart from where the lead was routed", async () => {
  const { B } = load(true);
  const base = { status: "new_inquiry", zip: "32501", source_page: "/ads/pensacola", raw_payload: { booking: { intake: { via: "booking-lead", zip: "32501", picked_slug: "trainer-pensacola" } } } };
  const ask = slug => ({ intake: { zip: "32501", source_page: "/ads/pensacola", trainer_slug: slug }, via: "booking-lead" });
  assert.equal(B.sameRequest(base, ask("trainer-pensacola")), true, "same pick = double submit");
  assert.equal(B.sameRequest(base, ask("trainer-tallahassee")), false, "different pick = new request");
  assert.equal(B.sameRequest(base, ask("")), true, "a form with no trainer box is unchanged");
  // A lead made before picked_slug existed is left exactly as it was.
  const old = { ...base, raw_payload: { booking: { intake: { via: "booking-lead", zip: "32501" } } } };
  assert.equal(B.sameRequest(old, ask("trainer-tallahassee")), true, "older rows keep the old behaviour");
});

test("A: every OTHER door makes its own lead - /book with no lead, the no-trainer callback, and a second trainer's booking page", async () => {
  const { B } = load(true);
  const { db } = fakeWorld();
  const settings = await B.loadSettings();
  const cleveland = MARKETS.find(m => m.ad2 === "cleveland");
  const setting = B.settingBySlug(settings, "trainer-cleveland");
  const trainer = await B.trainerRow("trainer-cleveland");
  // The booking page's own form (no lead on the link): api/booking.js leadForForm().
  const intake = zip => ({ ...PERSON, zip, problem: "", dog_name: "Rex", sms_consent: false });
  const a = await B.createLead({ intake: { ...intake(cleveland.zip), source_page: "book/trainer-cleveland" }, setting, trainer, via: "booking-page" });
  const b = await B.createLead({ intake: { ...intake(cleveland.zip), source_page: "book/trainer-columbus" }, setting, trainer, via: "booking-page" });
  assert.notEqual(b.lead.id, a.lead.id, "a different trainer's booking page is a different request");
  // The same page twice, untouched, inside 30 minutes: still one lead.
  const again = await B.createLead({ intake: { ...intake(cleveland.zip), source_page: "book/trainer-cleveland" }, setting, trainer, via: "booking-page" });
  assert.equal(again.lead.id, a.lead.id);
  assert.equal(again.reused, true);
  // The no-trainer callback is its own door and never answers a booking-page lead.
  const c = await B.createLead({ intake: { ...intake(cleveland.zip), source_page: "book/no-trainer-nearby" }, setting: null, trainer: null, via: "booking-callback" });
  assert.notEqual(c.lead.id, a.lead.id);
  // ...and neither of them ever answers an ad 2.0 lead.
  const d = await B.createLead({ intake: { ...intake(cleveland.zip), source_page: `https://ldtt-sandbox.vercel.app/ads/${cleveland.ad2}` }, setting, trainer, via: "booking-lead" });
  assert.ok(![a.lead.id, b.lead.id, c.lead.id].includes(d.lead.id), "a different door is always a different request");
  assert.equal(db.leads.length, 4);
});

test("A: the Contact page, trainer landing pages, market guide / ebook and office lead form key on a per-submit id, so every submit is a new lead", () => {
  const fn = read("supabase/functions/submit-contact/index.ts");
  // submit-contact has no reuse-by-person path at all: the only key it upserts on is the browser's id.
  assert.match(fn, /onConflict: sourceSubmissionId \? "source_submission_id" : undefined/);
  assert.match(fn, /async function tooManyRecent/); // the only email lookup is a rate limit (4 in 10 min)
  assert.match(fn, /rows\.length >= 4/);
  // ...and every browser door mints a fresh id on every submit (time + random), so two submits never collide.
  const doors = [
    ["script.js", /entries\.submission_id=`\$\{isReleaseQaHost\?'qa-release-':'web-'\}\$\{Date\.now\(\)\}-\$\{Math\.random\(\)/],          // Contact page + every .contact-intake
    ["script.js", /entries\.submission_id=`practice-\$\{Date\.now\(\)\}-\$\{Math\.random\(\)/],                                             // the practice-copy capture
    ["ad-funnel.js", /submissionId = `\$\{isQaLeadSubmission\(\) \? "qa-release-" : "ebook-"\}\$\{Date\.now\(\)\}-\$\{Math\.random\(\)/],    // market guide / ebook
    ["market-landing.js", /submissionId = `\$\{isQaLeadSubmission\(\) \? "qa-release-" : "ebook-"\}\$\{Date\.now\(\)\}-\$\{Math\.random\(\)/],
    ["trainer-backoffice/app.js", /submission_id: `\$\{isReleaseQaHost\(\) \? "qa-release-" : "trainer-"\}\$\{Date\.now\(\)\}-\$\{Math\.random\(\)/] // trainer landing + office lead form
  ];
  doors.forEach(([file, pattern]) => assert.match(read(file), pattern, `${file}: a fresh submission id per submit`));
  // The 2.0 pages keep no lead id of their own: they only follow the book_url the server just answered.
  const v2 = read("assets/v2/v2.js");
  assert.match(v2, /var next = data\.book_url \? safeUrl\(data\.book_url\) : "";/);
  assert.match(v2, /source_page: location\.origin \+ location\.pathname/, "each 2.0 page sends its own address");
  assert.ok(!/localStorage[^\n]*lead/i.test(v2), "no remembered lead id on the 2.0 pages");
});

// ===========================================================================
// B. Test leads never mix with live leads or live counts
// ===========================================================================

test("B1: every server Supabase call goes through the lib/sandbox.js schema switch", () => {
  const sandbox = read("lib/sandbox.js");
  assert.match(sandbox, /function dbSchema\(\) \{\n  return isSandbox\(\) \? "practice" : "public";/);
  assert.match(sandbox, /if \(schema === "public"\) return \{ path, headers: \{ \.\.\.headers \} \};/, "live is byte-for-byte unchanged");
  const files = [
    ...readdirSync(new URL("api/", root)).filter(f => f.endsWith(".js")).map(f => `api/${f}`),
    ...readdirSync(new URL("api/cron/", root)).filter(f => f.endsWith(".js")).map(f => `api/cron/${f}`),
    ...readdirSync(new URL("api/webhooks/", root)).filter(f => f.endsWith(".js")).map(f => `api/webhooks/${f}`),
    ...readdirSync(new URL("lib/", root)).filter(f => f.endsWith(".js")).map(f => `lib/${f}`)
  ];
  const offenders = files.filter(file => {
    if (file === "lib/sandbox.js" || file === "api/send-to-live.js") return false; // the switch itself, and rule 18
    const src = read(file);
    if (!/\/rest\/v1\/|\/storage\/v1\//.test(src)) return false;
    // Either it calls supabaseRequest itself, or it goes through a helper that does
    // (B.sb / B.sbOrThrow from lib/booking.js, supabaseFetch from api/communications.js).
    return !/supabaseRequest|B\.sbOrThrow|B\.sb\(|supabaseFetch|sbOrThrow\(|\bsb\(/.test(src);
  });
  assert.deepEqual(offenders, [], "a file that talks to a table or a bucket without the schema switch");
  // Nobody but send-to-live.js may name a schema in a REST header.
  const named = files.filter(file => !["api/send-to-live.js", "lib/sandbox.js"].includes(file) && /"(?:Accept|Content)-Profile"/.test(read(file)));
  assert.deepEqual(named, [], "only lib/sandbox.js (the switch) and api/send-to-live.js (rule 18) name a schema");
});

test("B1: the practice copy can only write practice - a REST call on the practice copy carries the practice profile", () => {
  const S = (() => { delete require.cache[require.resolve("../lib/sandbox.js")]; process.env.LDTT_SANDBOX = "1"; return require("../lib/sandbox.js"); })();
  assert.equal(S.dbSchema(), "practice");
  assert.deepEqual(S.supabaseRequest("/rest/v1/leads").headers, { "Accept-Profile": "practice", "Content-Profile": "practice" });
  assert.equal(S.bucketName("trainer-page-assets"), "practice-trainer-page-assets");
  assert.equal(S.rewriteStoragePath("/storage/v1/object/public/trainer-page-assets/a.jpg"), "/storage/v1/object/public/practice-trainer-page-assets/a.jpg");
  delete require.cache[require.resolve("../lib/sandbox.js")];
  delete process.env.LDTT_SANDBOX;
  const L = require("../lib/sandbox.js");
  assert.equal(L.dbSchema(), "public");
  assert.deepEqual(L.supabaseRequest("/rest/v1/leads", { Prefer: "x" }), { path: "/rest/v1/leads", headers: { Prefer: "x" } }, "live: path and headers untouched");
  assert.equal(L.bucketName("trainer-page-assets"), "trainer-page-assets");
});

test("B2: nothing copies a practice row into public - send to live is DRAFT columns only, and 404 off the practice copy", () => {
  const src = read("api/send-to-live.js");
  assert.match(src, /if \(!isSandbox\(\)\) return res\.status\(404\)/, "404 on live, before auth");
  assert.match(src, /const FORBIDDEN_KEYS = new Set\(\["published_content", "published_revision", "published_at", "auth_user_id"\]\);/);
  assert.match(src, /if \(schema === "public" && options\.body && path\.startsWith\("\/rest\/v1\/"\)\) assertDraftOnly/, "every live-bound body is checked first");
  // The guard itself, run for real.
  delete require.cache[require.resolve("../api/send-to-live.js")];
  process.env.LDTT_SANDBOX = "1";
  const api = require("../api/send-to-live.js");
  const assertDraftOnly = api.internal?.assertDraftOnly;
  if (assertDraftOnly) {
    ["published_content", "published_revision", "published_at", "auth_user_id"].forEach(key => {
      assert.throws(() => assertDraftOnly({ [key]: "x" }), `${key} is refused`);
    });
    assert.throws(() => assertDraftOnly({ status: "published" }));
    assert.throws(() => assertDraftOnly({ locked: true }));
    assert.doesNotThrow(() => assertDraftOnly({ draft_content: {}, headline: "x" }));
  }
  // Storage: a practice upload is COPIED to the live bucket, never moved out of practice.
  assert.match(src, /storage\/v1\/object\/copy/);
  assert.ok(!/storage\/v1\/object\/move/.test(src), "send to live never moves a practice file");
});

test("B2: the reset and the structure sync are live -> practice only, never the reverse", () => {
  const migration = read("supabase/migrations/20260905200000_practice_schema.sql");
  // reset_from_live(): truncate practice, then INSERT INTO practice SELECT FROM public.
  assert.match(migration, /insert into practice\.%I \(%s\) select %s from public\.%I/);
  assert.match(migration, /truncate table/);
  // Every write in the two functions names a practice object. Nothing writes a public table.
  const functions = migration.match(/create or replace function practice\.[\s\S]*?\$function\$|create or replace function practice\.[\s\S]*?\$\$;/gi) || [migration];
  functions.forEach(fn => {
    assert.ok(!/insert\s+into\s+public\./i.test(fn), "no insert into public.*");
    assert.ok(!/update\s+public\./i.test(fn), "no update public.*");
    assert.ok(!/delete\s+from\s+public\./i.test(fn), "no delete from public.*");
    assert.ok(!/truncate[^;]*\bpublic\./i.test(fn), "no truncate of a public table");
  });
  // The service-role gate is on both functions.
  assert.match(migration, /may only be run with the service role/);
  // The pull (rule 46) is the same direction: it reads public and writes practice.
  const pull = read("supabase/migrations/20260910120000_practice_pull_from_live.sql");
  assert.ok(!/insert\s+into\s+public\.|update\s+public\.\w+\s+set|delete\s+from\s+public\./i.test(pull), "the pull never writes a public table");
  // api/practice-reset.js: sandbox only, super admin only, practice RPC, practice-* buckets only.
  const reset = read("api/practice-reset.js");
  assert.match(reset, /if \(!isSandbox\(\)\) return res\.status\(404\)/);
  assert.match(reset, /require: "super"/);
  assert.match(reset, /rpc\/reset_from_live_by/);
  assert.match(reset, /\.filter\(id => id\.startsWith\("practice-"\)\)/, "only practice-* buckets are emptied");
});

test("B3: the qa hold-out still drops a test row from every count, on live and on the practice copy", () => {
  const METRICS = loadMetrics();
  const rows = [
    { id: "1", raw_payload: {} },
    { id: "2", raw_payload: { qa: true } },
    { id: "3", raw_payload: { qa: false } }
  ].map(r => METRICS.normalizeLeadRow(r));
  assert.deepEqual(METRICS.excludeQa(rows, METRICS.isQaLead).map(r => r.id), ["1", "3"]);
  assert.equal(METRICS.isQaLead({ raw_payload: { qa: true } }), true);
  assert.equal(METRICS.isQaLead({ raw_payload: {} }), false);
  // Rule 1 is untouched: the hold-out reads the flag only, never a name or an email.
  const metrics = read("trainer-backoffice/metrics.js");
  assert.match(metrics, /function isQaLead\(row\) \{\n    if \(!row\) return false;\n    if \(row\.isTest === true\) return true;\n    return rawOf\(row\)\.qa === true;\n  \}/);
  // Every screen that counts leads goes through it.
  const app = read("trainer-backoffice/app.js");
  assert.match(app, /function allLeadRows\(\) \{\n  return excludeTestLeads\(/);
  assert.match(app, /function excludeTestLeads\(rows\) \{\n  if \(state\.showTestLeads\) return rows;\n  return METRICS\.excludeQa\(rows, METRICS\.isQaLead\);/);
  assert.match(app, /METRICS\.salesPipelineRows\(allLeadRows\(\), \{ keepQa: state\.showTestLeads \}\)/, "the Sales tab counts the same rows");
});

test("B3: today's practice-host change cannot reach live - live's host is the domain", () => {
  // Rule 97: the practice copy stopped stamping qa because it is a *.vercel.app host. Live is the
  // domain, so isReleaseQaHost was already false there and nothing about live moved.
  const script = read("script.js");
  assert.match(script, /if\(isReleaseQaHost&&!onPracticeCopy\(\)\) data\.set\('qa','true'\);/);
  const app = read("trainer-backoffice/app.js");
  assert.match(app, /window\.LDTT_IS_SANDBOX === true/);
  ["ad-funnel.js", "market-landing.js"].forEach(file => {
    assert.match(read(file), /const isQaLeadSubmission = \(\) => isReleaseQaHost && window\.LDTT_IS_SANDBOX !== true;/, file);
  });
  // The host test only ever looks for localhost / 127.0.0.1 / *.vercel.app, never the live domain, so on
  // the domain it has always answered false and today's change moved nothing there.
  const hostTests = [
    (script.match(/const isReleaseQaHost=[^;]+;/) || [""])[0],
    (app.match(/function isReleaseQaHost\(\) \{[\s\S]*?\n\}/) || [""])[0],
    (read("ad-funnel.js").match(/const isReleaseQaHost = [^;]+;/) || [""])[0],
    (read("market-landing.js").match(/const isReleaseQaHost = [^;]+;/) || [""])[0]
  ];
  hostTests.forEach((src, i) => {
    assert.ok(src, `host test ${i} found`);
    assert.ok(/localhost/.test(src) && /vercel\\?\.app/.test(src), `host test ${i} names only the preview hosts`);
    assert.ok(!/lorenzosdogtrainingteam/.test(src), `host test ${i}: the live domain is never a QA host`);
  });
  assert.match(hostTests[1], /if \(window\.LDTT_IS_SANDBOX === true\) return false;/, "the practice copy is not a QA host (rule 97)");
});

test("B4 (rule 98): the office smoke-test pattern is narrow - LDTT TEST and a +ldtt-test email, nothing else", () => {
  const { isOfficeTestLead, OFFICE_TEST_LAST_NAME } = require("../lib/office-test-lead.js");
  assert.equal(OFFICE_TEST_LAST_NAME, "LDTT TEST");
  const yes = [
    { first_name: "Melissa", last_name: "LDTT TEST", email: "melissa@lorenzosdogtrainingteam.com" },
    { first_name: "Melissa", last_name: "ldtt test", email: "" },
    { first_name: "Melissa", last_name: "LDTT-Test", email: "" },
    { first_name: "LDTT", last_name: "TEST", email: "" },
    { first_name: "Rachel", last_name: "Smith", email: "office+ldtt-test@lorenzosdogtrainingteam.com" },
    { first_name: "Rachel", last_name: "Smith", email: "ldtt-test@lorenzosdogtrainingteam.com" }
  ];
  const no = [
    { first_name: "Rachel", last_name: "Smith", email: "rachel@example.com" },
    { first_name: "Terry", last_name: "Tester", email: "terry@example.com" },      // a real surname
    { first_name: "Test", last_name: "Testerson", email: "test@example.com" },     // still a real person
    { first_name: "Quality", last_name: "Assurance", email: "qa@example.com" },
    { first_name: "Dana", last_name: "Ldt", email: "dana+test@example.com" },
    { first_name: "", last_name: "", email: "" }
  ];
  yes.forEach(row => assert.equal(isOfficeTestLead(row), true, JSON.stringify(row)));
  no.forEach(row => assert.equal(isOfficeTestLead(row), false, JSON.stringify(row)));
});

test("B4 (rule 98): a smoke-test lead is stamped raw_payload.qa = true and the hold-out drops it; a real lead is untouched", async () => {
  const { B } = load(true);
  const { db } = fakeWorld();
  const settings = await B.loadSettings();
  const setting = B.settingBySlug(settings, "trainer-cleveland");
  const trainer = await B.trainerRow("trainer-cleveland");
  const base = { phone: "440-555-0199", zip: MARKETS[0].zip, problem: "", dog_name: "Rex", sms_consent: false, source_page: "contact.html" };
  const real = await B.createLead({ intake: { ...base, first_name: "Rachel", last_name: "Smith", email: "rachel@example.com" }, setting, trainer, via: "booking-lead" });
  const smoke = await B.createLead({ intake: { ...base, first_name: "Melissa", last_name: "LDTT TEST", email: "melissa@lorenzosdogtrainingteam.com" }, setting, trainer, via: "booking-lead" });
  assert.equal("qa" in real.lead.raw_payload, false, "a real lead carries no qa key at all");
  assert.equal(smoke.lead.raw_payload.qa, true);
  assert.equal(typeof smoke.lead.raw_payload.qa, "boolean", "a real JSON boolean, never the string \"true\"");
  const METRICS = loadMetrics();
  const counted = METRICS.excludeQa(db.leads.map(r => METRICS.normalizeLeadRow(r)), METRICS.isQaLead);
  assert.equal(counted.length, 1, "the smoke-test lead is out of the counts");
  assert.equal(counted[0].id, real.lead.id);
});

test("B4 (rule 98): submit-contact stamps the same way, keeps the row out of Meta, and leaves rule 97 alone", () => {
  const fn = read("supabase/functions/submit-contact/index.ts");
  assert.match(fn, /import \{ isOfficeTestLead \} from "\.\.\/_shared\/office-test-lead\.ts";/);
  assert.match(fn, /const officeTest = isOfficeTestLead\(\{ first_name: firstName, last_name: lastName, email \}\);/);
  assert.match(fn, /const isQaSubmission = officeTest\n\s+\|\| payload\.qa === true/);
  assert.match(fn, /const storedPayload = officeTest \? \{ \.\.\.payload, qa: true \} : payload;/);
  assert.ok(!/raw_payload: payload\b/.test(fn), "every stored row uses storedPayload");
  // Rule 13: a qa row never reaches Meta.
  assert.match(fn, /const metaAllowed = metaTestMode \|\| \(!isQaSubmission && schema !== "practice"\);/);
  // Rule 97: only the NAME adds a stamp. The host test still only picks the lifecycle event type.
  assert.ok(!/storedPayload = .*page_url/.test(fn));
  assert.match(fn, /event_type: isQaSubmission \? "qa_release_check" : "form_received"/);
  // The two copies of the rule agree.
  const js = read("lib/office-test-lead.js");
  const ts = read("supabase/functions/_shared/office-test-lead.ts");
  ["ldtttest", "\\+ldtt-test", "\\^ldtt-test@"].forEach(bit => {
    assert.match(js, new RegExp(bit), `lib copy: ${bit}`);
    assert.match(ts, new RegExp(bit), `edge copy: ${bit}`);
  });
});

test("B4 (Joshua's hard constraint): a REAL client's lead row is stored exactly as before - same columns, same keys, same values, no qa", async () => {
  const { B } = load(true);
  const { db, calls } = fakeWorld();
  const settings = await B.loadSettings();
  const setting = B.settingBySlug(settings, "trainer-cleveland");
  const trainer = await B.trainerRow("trainer-cleveland");
  const intake = {
    first_name: "Rachel", last_name: "Smith", phone: "440-555-0177", email: "rachel@example.com",
    address: "1 Main St", city: "Cleveland", state: "Ohio", zip: MARKETS[0].zip,
    problem: "Pulling", dog_name: "Rex", sms_consent: true, lead_source: "Website",
    source_page: "contact.html", utm_source: "google", extras: { "Extra: Dog's age": "2" }
  };
  await B.createLead({ intake, setting, trainer, via: "booking-lead" });
  const post = calls.find(c => c.method === "POST" && c.path === "/rest/v1/leads");
  // The exact column list this door has always written - nothing added, nothing dropped.
  assert.deepEqual(Object.keys(post.body).sort(), [
    "address_line_1", "assigned_trainer_name", "city", "comments", "dog_name", "email", "first_name",
    "last_name", "lead_source", "phone", "raw_payload", "service_interest", "sms_consent", "source_page",
    "state", "status", "trainer_id", "trainer_market", "trainer_slug", "trainer_state", "zip"
  ]);
  // ...and the stored payload for a real client carries no qa key at all.
  assert.deepEqual(Object.keys(post.body.raw_payload).sort(), [
    "Extra: Dog's age", "address", "booking", "city", "sales_pipeline", "sms_consent", "source_page",
    "state", "trainer_market", "utm_source"
  ], "a real client's raw_payload is unchanged: no qa, nothing else new");
  assert.equal(post.body.status, "new_inquiry");
  // The two bookkeeping rows every lead has always written are still exactly two.
  assert.equal(db.lead_events.length, 1);
  assert.equal(db.lifecycle_events.length, 1);
  assert.equal(db.lead_events[0].event_type, "form_submitted");
  assert.equal(db.lifecycle_events[0].event_type, "form_received");
  // The only NEW thing on the row is picked_slug inside booking.intake, and it is null when no trainer
  // was picked - the shape the 2.0 pages, /book and the callback all already send.
  assert.equal(post.body.raw_payload.booking.intake.picked_slug, null);
  // Edge Function: with no office-test match the stored payload is the SAME OBJECT the browser sent.
  assert.match(read("supabase/functions/submit-contact/index.ts"), /const storedPayload = officeTest \? \{ \.\.\.payload, qa: true \} : payload;/);
});

test("B4 (Joshua's hard constraint): nothing here sends the person who filled the form an email of any kind", () => {
  // No activation / confirmation / verification email exists on any submit path, and today's change
  // added none. The only mail on a submit is the OFFICE email (rule 73, Resend, to the office) and the
  // existing FormSubmit / form-delivery fan-out, both unchanged.
  const changed = ["lib/booking.js", "lib/office-test-lead.js", "supabase/functions/submit-contact/index.ts", "supabase/functions/_shared/office-test-lead.ts"];
  changed.forEach(file => {
    const src = read(file);
    assert.ok(!/resend|sendgrid|mailgun|postmark|nodemailer|sendEmail|confirmation email|verify your email/i.test(src), `${file} sends no email`);
  });
  // The lead's own email address is never used as a send target by the lead doors.
  assert.ok(!/to:\s*\[?\s*(intake|payload|client)\.email/i.test(read("lib/booking.js")));
  assert.ok(!/api\.resend\.com/.test(read("supabase/functions/submit-contact/index.ts")));
});

test("B: KNOWN GAP, pinned on purpose - the hold-out reads a BOOLEAN, so a string \"true\" is still counted", () => {
  const METRICS = loadMetrics();
  // Live carries 3 rows (all 2026-08-06 release checks, all archived / do-not-contact) whose
  // raw_payload.qa is the string "true" instead of a boolean. The SQL in rule 1's verification recipe
  // casts, so it drops them; metrics.js compares with === true, so it keeps them. 290 live rows:
  // the SQL hold-out answers 283, the screens answer 286. Changing isQaLead would MOVE a live number,
  // so it is Joshua's call, not the code's. This test exists so nobody "fixes" it by accident.
  assert.equal(METRICS.isQaLead({ raw_payload: { qa: "true" } }), false, "string qa is NOT held out today");
  assert.equal(METRICS.isQaLead({ raw_payload: { qa: true } }), true);
  // Rule 98 never creates this shape: both doors write a real boolean.
  assert.match(read("lib/booking.js"), /\.\.\.\(isOfficeTestLead\(intake\) \? \{ qa: true \} : \{\}\),/);
  assert.match(read("supabase/functions/submit-contact/index.ts"), /\{ \.\.\.payload, qa: true \}/);
});

// metrics.js is a browser file with a UMD-ish tail; load it the way the cron does.
function loadMetrics() {
  delete require.cache[require.resolve("../trainer-backoffice/metrics.js")];
  return require("../trainer-backoffice/metrics.js");
}
