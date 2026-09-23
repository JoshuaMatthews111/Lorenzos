// A finished booking is never handed to the NEXT request (Joshua 2026-09-22 voice note; DO-NOT-BREAK
// rules 71 + 74). "After someone fills the form out and goes through with it, then clicks again, it still
// says thank you, we filled your form... After I finished with Lorenzo (Cleveland), I went to Pensacola - a
// completely different market - and it showed me Lorenzo's completed form again, with the booking made."
//
// THE CAUSE, proved below: lib/booking.js createLead() answered ANY lead with the same email (or phone)
// from the same door inside 30 minutes - whatever market it came from and whatever had happened to it
// since. The second, different-market submit was therefore given the FIRST lead's id, and /book?lead=<id>
// rightly drew that lead's finished booking. Against a fake Supabase this file proves:
//   1. a second submit from a DIFFERENT market (different ZIP / different page) makes its OWN lead;
//   2. a second submit is never merged into a lead that already booked, requested a trainer or asked for a
//      callback - a new lead every time, whatever the clock says;
//   3. a second submit is never merged into a lead the office already moved on (status past new_inquiry);
//   4. a real double submit (same door, same page, same ZIP, first lead untouched) still answers ONE lead,
//      so rule 71's double-submit guard is unchanged;
//   5. the booking page's four entry rules: /book = ZIP screen, /book?zip= = ZIP screen for that ZIP,
//      /book/<slug>?lead=<booked id> = the finished screen WITH "Book another evaluation" (a fresh booking,
//      no lead id) and a "Change my time" note pointing at the office number;
//   6. the server never reuses a row across doors, and submit-contact (the Contact page) has no reuse path
//      at all - it keys only on the browser's per-submit submission_id, so every submit is a new lead.
// NOT deployed (tests/ is in .vercelignore). Nothing here talks to the real project or Google.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
process.env.SUPABASE_URL = "http://supabase.test";
delete process.env.LDTT_PRACTICE_ORIGIN;
delete process.env.RESEND_API_KEY;
delete process.env.LDTT_MAKE_HOOK_PATHWAY1;
delete process.env.LDTT_MAKE_HOOK_PATHWAY2;
process.env.LDTT_PRACTICE_HOST = "ldtt-sandbox.vercel.app";
const require = createRequire(import.meta.url);

const FAKE_KEY = `AIzaSy${"x".repeat(33)}`;
const nowSec = Math.floor(Date.now() / 1000);
const SLOT_A = nowSec - (nowSec % 3600) + 2 * 86400;
const iso = sec => new Date(sec * 1000).toISOString();

const TRAINERS = () => [
  { id: "cbf54e9f-d68c-44ba-b6ad-d48549caca8e", slug: "lorenzo-miller", full_name: "Lorenzo Miller", market: "Cleveland, OH", state: "Ohio", headshot_url: "/assets/l.jpg", status: "active", base_zip: "44128" },
  { id: "45875481-0bb3-420f-9add-6fdceb7efa51", slug: "daniel-bainbridge", full_name: "Daniel Bainbridge", market: "Crestview", state: "Florida", headshot_url: "/d.jpg", status: "active", base_zip: "32536" }
];

function fakeWorld() {
  const db = { leads: [], booking_holds: [], site_settings: [], lead_events: [], lifecycle_events: [], communications_testers: [], trainers: TRAINERS() };
  const calls = [];
  let n = 0;
  const uuid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
  global.fetch = async (url, options = {}) => {
    const u = new URL(String(url));
    const method = options.method || "GET";
    const headers = options.headers || {};
    let body = options.body;
    if (typeof body === "string") { try { body = JSON.parse(body); } catch { /* keep text */ } }
    calls.push({ host: u.host, method, path: u.pathname, url: String(url), headers, body });
    const res = (status, data, text) => ({ ok: status < 400, status, text: async () => text ?? JSON.stringify(data), json: async () => data });
    if (u.host === "calendar.google.com") return res(200, null, `<html>${FAKE_KEY}</html>`);
    if (u.host === "calendar-pa.clients6.google.com") return res(200, null, JSON.stringify([[[[[String(SLOT_A)], 60]]]]));
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
        const row = { id: uuid(), created_at: new Date().toISOString(), ...(table === "leads" ? { version: 1 } : {}), ...(table === "booking_holds" ? { status: "held" } : {}), ...r };
        rows.push(row);
        out.push(row);
      }
      return res(201, out);
    }
    if (method === "PATCH") {
      const hit = rows.filter(match);
      hit.forEach(r => { Object.assign(r, body); if (table === "leads") r.version = (r.version || 1) + 1; });
      return res(200, hit);
    }
    throw new Error(`unexpected ${method}`);
  };
  return { db, calls };
}

function load(sandbox) {
  for (const m of ["../lib/sandbox.js", "../lib/booking.js", "../lib/booking-page.js", "../api/booking-lead.js", "../api/booking.js", "../api/booking-page.js"]) delete require.cache[require.resolve(m)];
  if (sandbox) process.env.LDTT_SANDBOX = "1"; else delete process.env.LDTT_SANDBOX;
  return { B: require("../lib/booking.js"), leadApi: require("../api/booking-lead.js"), bookingApi: require("../api/booking.js"), pageApi: require("../api/booking-page.js") };
}

async function call(handler, { method = "POST", body, query = {}, headers = {} } = {}) {
  const res = { statusCode: 0, payload: null, sent: null, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.statusCode = c; return this; }, json(d) { this.payload = d; return this; }, send(d) { this.sent = d; return this; }, end() { return this; } };
  await handler({ method, body, query, headers: { host: "ldtt-sandbox.vercel.app", ...headers } }, res);
  return res;
}

// The same person, the same email: exactly what Joshua did on the two 2.0 ad pages.
const EMAIL = "mr.matthews.test@example.test";
const cleveland = over => ({ first_name: "Joshua", last_name: "Matthews", phone: "440-555-0100", email: EMAIL, zip: "44128", problem: "Pulling on the leash", dog_name: "Rex", sms_consent: false, source_page: "https://ldtt-sandbox.vercel.app/ads/cleveland", ...over });
const pensacola = over => cleveland({ zip: "32536", source_page: "https://ldtt-sandbox.vercel.app/ads/pensacola", ...over });

// A lead that already went all the way through, seeded the way api/booking.js leaves it.
function seedBooked(db, over = {}) {
  const row = {
    id: "11111111-1111-4111-8111-111111111111", version: 3, created_at: new Date().toISOString(),
    first_name: "Joshua", last_name: "Matthews", email: EMAIL, phone: "440-555-0100", zip: "44128",
    status: "evaluation_scheduled", trainer_slug: "lorenzo-miller", trainer_market: "Cleveland, OH",
    source_page: "https://ldtt-sandbox.vercel.app/ads/cleveland", eval_scheduled_at: iso(SLOT_A),
    raw_payload: {
      sales_pipeline: true, trainer_market: "Cleveland, OH",
      booking: {
        intake: { via: "booking-lead", trainer_slug: "lorenzo-miller", trainer_name: "Lorenzo Miller", zip: "44128", received_at: new Date().toISOString() },
        via: "online_booking", trainer_slug: "lorenzo-miller", trainer_name: "Lorenzo Miller",
        slot_start: iso(SLOT_A), slot_minutes: 60, time_zone: "America/New_York",
        when_label: "Thursday, October 1, 2026, 4:00 PM EDT", location: "in_home", location_label: "In-home",
        client: { first_name: "Joshua", address: "1 Main St, Cleveland, OH 44128" }, dogs: [{ name: "Rex" }]
      }
    },
    ...over
  };
  db.leads.push(row);
  return row;
}

test("THE CAUSE: a second submit from a different market gets its OWN lead, never the first market's booked one", async () => {
  const { leadApi } = load(true);
  const { db } = fakeWorld();

  const cle = await call(leadApi, { body: cleveland() });
  assert.equal(cle.statusCode, 200);
  assert.equal(cle.payload.trainer_slug, "lorenzo-miller");

  // Joshua then finished that booking. (api/booking.js does this; seeded here so no Google call is needed.)
  const first = db.leads.find(l => l.id === cle.payload.lead_id);
  first.status = "evaluation_scheduled";
  first.raw_payload = { ...first.raw_payload, booking: { ...first.raw_payload.booking, slot_start: iso(SLOT_A), trainer_slug: "lorenzo-miller", trainer_name: "Lorenzo Miller" } };

  // ...and went to a completely different market, same email, minutes later.
  const pns = await call(leadApi, { body: pensacola() });
  assert.equal(pns.statusCode, 200);
  assert.notEqual(pns.payload.lead_id, cle.payload.lead_id, "the Pensacola submit must NOT answer the Cleveland lead");
  assert.equal(db.leads.length, 2, "a new market is a new lead row");
  const second = db.leads.find(l => l.id === pns.payload.lead_id);
  assert.equal(second.status, "new_inquiry");
  assert.equal(second.zip, "32536");
  assert.equal(second.trainer_slug, "daniel-bainbridge", "routed to this market's trainer, not Lorenzo");
  assert.equal(second.raw_payload.booking.slot_start, undefined, "the new lead carries no booking");
  assert.match(pns.payload.book_url, new RegExp(`/book/daniel-bainbridge\\?lead=${second.id}$`));
  // The first lead's finished booking is untouched.
  assert.equal(first.status, "evaluation_scheduled");
  assert.equal(first.raw_payload.booking.slot_start, iso(SLOT_A));
});

test("a new request is NEVER merged into a lead that booked, requested a trainer or asked for a callback", async () => {
  for (const over of [
    {}, // booked
    { status: "new_inquiry", raw_payload: { booking: { intake: { via: "booking-lead", zip: "44128" }, requested: true, requested_at: new Date().toISOString(), trainer_slug: "lorenzo-miller" } } },
    { status: "new_inquiry", raw_payload: { booking: { intake: { via: "booking-lead", zip: "44128" }, callback: { zip: "44128", requested_at: new Date().toISOString() } } } }
  ]) {
    const { leadApi } = load(true);
    const { db } = fakeWorld();
    const booked = seedBooked(db, over);
    // Same market, same page, same email, same door: only the finished state makes this a new request.
    const again = await call(leadApi, { body: cleveland() });
    assert.equal(again.statusCode, 200);
    assert.notEqual(again.payload.lead_id, booked.id, "never merged into a finished lead");
    assert.equal(db.leads.length, 2);
  }
});

test("a new request is never merged into a lead the office already moved on", async () => {
  const { leadApi } = load(true);
  const { db } = fakeWorld();
  const moved = seedBooked(db, { status: "office_contacted", eval_scheduled_at: null, raw_payload: { booking: { intake: { via: "booking-lead", zip: "44128" } } } });
  const again = await call(leadApi, { body: cleveland() });
  assert.notEqual(again.payload.lead_id, moved.id);
  assert.equal(db.leads.length, 2);
});

test("rule 71 unchanged: a real double submit (same door, page, ZIP, lead untouched) still answers ONE lead", async () => {
  const { leadApi } = load(true);
  const { db } = fakeWorld();
  const one = await call(leadApi, { body: cleveland() });
  const two = await call(leadApi, { body: cleveland() });
  assert.equal(two.payload.lead_id, one.payload.lead_id, "the same form sent twice is still one lead");
  assert.equal(two.payload.duplicate, true);
  assert.equal(db.leads.length, 1);
  // ...and the pipeline is entered once, so a double tap never texts twice.
  assert.equal(db.leads[0].raw_payload.booking.intake.via, "booking-lead");
});

test("sameRequest(): the one rule the door uses, spelled out", () => {
  const { B } = load(true);
  const base = { status: "new_inquiry", zip: "44128", source_page: "/ads/cleveland", raw_payload: { booking: { intake: { via: "booking-lead", zip: "44128" } } } };
  const ask = { intake: { zip: "44128", source_page: "/ads/cleveland" }, via: "booking-lead" };
  assert.equal(B.sameRequest(base, ask), true);
  assert.equal(B.sameRequest(base, { ...ask, via: "booking-page" }), false, "a different door is a different request");
  assert.equal(B.sameRequest(base, { intake: { zip: "32536", source_page: "/ads/cleveland" }, via: "booking-lead" }), false, "a different ZIP is a different market");
  assert.equal(B.sameRequest(base, { intake: { zip: "44128", source_page: "/ads/pensacola" }, via: "booking-lead" }), false, "a different page is a different request");
  assert.equal(B.sameRequest({ ...base, status: "became_client" }, ask), false);
  assert.equal(B.sameRequest({ ...base, raw_payload: { booking: { intake: { via: "booking-lead", zip: "44128" }, slot_start: iso(SLOT_A) } } }, ask), false);
  assert.equal(B.sameRequest({}, ask), false, "a row with no intake is never reused");
});

test("the Contact page always starts a fresh booking: submit-contact has no reuse-by-person path", () => {
  const fn = readFileSync(new URL("../supabase/functions/submit-contact/index.ts", import.meta.url), "utf8");
  // The only key it ever upserts on is the browser's per-submit submission_id, so a new submit = a new lead.
  assert.match(fn, /onConflict: sourceSubmissionId \? "source_submission_id" : undefined/);
  assert.ok(!/raw_payload.*booking.*intake/s.test(fn.split("\n").filter(l => /selectRows/.test(l)).join("\n")), "it never looks up an earlier booking to reuse");
  // The email lookup it does have is a rate limit (4 in 10 minutes), not a reuse.
  assert.match(fn, /async function tooManyRecent/);
  assert.match(fn, /rows\.length >= 4/);
});

test("booking page entry rules: /book and /book?zip= always start at the ZIP screen", async () => {
  const { pageApi } = load(true);
  fakeWorld();
  const page = (await call(pageApi, { method: "GET", query: { slug: "" } })).sent;
  // No lead and no ZIP on the address: the ZIP box, nothing fetched, nothing resumed.
  assert.match(page, /if \(!LEAD && zipParam\.length !== 5\) \{ \$\("zip"\)\.focus\(\); return; \}/);
  // A ZIP on the address always starts fresh, even when an old lead id is still on the link.
  assert.match(page, /var freshZip = zipParam\.length === 5 && STEP !== "questions";/);
  assert.match(page, /var o = freshZip \? null : res\.j\.outcome;/);
});

test("booking page: a finished booking reopens on the congratulations screen with a way out", async () => {
  const { pageApi } = load(true);
  fakeWorld();
  const page = (await call(pageApi, { method: "GET", query: { slug: "lorenzo-miller" } })).sent;
  // The confirmation text's link still lands on the finished screen (rule 74 step 4)...
  assert.match(page, /if \(o && \(o\.booked \|\| o\.requested\)\) \{/);
  // ...and that screen is no longer a dead end.
  assert.match(page, /<a class="btn btn-ghost startover-btn" id="bookAnother" href="\/book">Book another evaluation<\/a>/);
  assert.match(page, /<strong>Change my time\?<\/strong> Our office moves it for you — call 866\.436\.4959/);
  assert.match(page, /if \(over\) over\.hidden = false;/);
  // The same way out on the pre-evaluation thank-you screen.
  assert.match(page, /<a class="btn btn-ghost startover-btn" href="\/book">Book another evaluation<\/a>/);
  // "Book another evaluation" carries NO lead id, so the next booking is a brand-new one.
  assert.ok(!/href="\/book\?lead=/.test(page), "the start-over link never carries a lead id");
});

test("/api/booking?lead=<booked id>: the finished booking comes back, and ONLY for that lead", async () => {
  const { bookingApi } = load(true);
  const { db } = fakeWorld();
  const booked = seedBooked(db);
  db.booking_holds.push({ id: "h1", trainer_slug: "lorenzo-miller", slot_start: iso(SLOT_A), status: "held", lead_id: booked.id });

  const reopened = await call(bookingApi, { method: "GET", query: { lead: booked.id } });
  assert.equal(reopened.statusCode, 200);
  assert.equal(reopened.payload.outcome.booked, true, "the confirmation link still reopens the finished screen");
  assert.equal(reopened.payload.outcome.trainer_slug, "lorenzo-miller");
  assert.equal(reopened.payload.zip, "44128", "the ZIP screen behind it is this lead's ZIP");

  // A brand-new lead from another market carries no outcome: the page starts at the ZIP screen.
  const fresh = { id: "22222222-2222-4222-8222-222222222222", version: 1, created_at: new Date().toISOString(), first_name: "Joshua", email: EMAIL, phone: "440-555-0100", zip: "32536", status: "new_inquiry", source_page: "https://ldtt-sandbox.vercel.app/ads/pensacola", raw_payload: { booking: { intake: { via: "booking-lead", zip: "32536" } } } };
  db.leads.push(fresh);
  const next = await call(bookingApi, { method: "GET", query: { lead: fresh.id } });
  assert.equal(next.payload.outcome, null, "a fresh lead never inherits the other lead's booking");
  assert.equal(next.payload.zip, "32536");
  assert.ok(next.payload.trainers.some(t => t.slug === "daniel-bainbridge"), "the new market's trainers are offered");

  // With no lead at all: the ZIP screen, no outcome.
  const bare = await call(bookingApi, { method: "GET", query: {} });
  assert.equal(bare.payload.outcome, null);
  assert.equal(bare.payload.need_zip, true);
});

test("the 2.0 pages hand the visitor to the lead they just made, and nothing else", () => {
  const v2 = readFileSync(new URL("../assets/v2/v2.js", import.meta.url), "utf8");
  // The page only ever follows the book_url the server answered for THIS submit; it keeps no lead id of its own.
  assert.match(v2, /var next = data\.book_url \? safeUrl\(data\.book_url\) : "";/);
  assert.ok(!/localStorage[^\n]*lead/i.test(v2), "no remembered lead id on the 2.0 pages");
});

test("GO-LIVE 2026-09-23: the booking routes serve LIVE too; the reuse rule is the same on both schemas", async () => {
  const { leadApi, bookingApi, pageApi } = load(false);
  fakeWorld();
  assert.equal((await call(leadApi, { body: cleveland() })).statusCode, 200, "a live lead can be created");
  assert.equal((await call(bookingApi, { method: "GET", query: { zip: "44128" } })).statusCode, 200, "the live nearby list answers");
  assert.equal((await call(pageApi, { method: "GET", query: { slug: "lorenzo-miller" } })).statusCode, 200, "the live booking page renders");
});
