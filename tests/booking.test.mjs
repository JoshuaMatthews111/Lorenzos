// Online booking (portal chain step 2, DO-NOT-BREAK rule 71). Against a fake Supabase and a
// fake Google (global fetch replaced), proves:
//   1. ZIP routing: 440xx/441xx -> lorenzo-miller, 325xx -> daniel-bainbridge, else no trainer;
//   2. every new route answers 404 on live and makes no call at all;
//   3. /api/booking-lead honours the contract, CORS for the 2.0 pages, practice schema only,
//      one lead for a double submit, no booking link for an unserved ZIP;
//   4. availability = Google's free times minus held times minus the next hour; the Google key
//      never reaches the browser;
//   5. a booking holds the slot, moves the lead to evaluation_scheduled with the eval time,
//      keeps sales_pipeline + every eval answer, writes the lifecycle event; the same time
//      again answers 409 with no lead change; a rebook releases the old hold;
//   6. a missing Alpha field or a location the trainer does not offer answers 400 with no writes;
//   7. the only Google call is ListAvailableSlots (source grep + the runtime guard).
// NOT deployed (tests/ is in .vercelignore). Nothing here talks to the real project or Google.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
process.env.SUPABASE_URL = "http://supabase.test";
delete process.env.LDTT_PRACTICE_ORIGIN;
process.env.LDTT_PRACTICE_HOST = "ldtt-sandbox.vercel.app";
const require = createRequire(import.meta.url);

const FAKE_KEY = `AIzaSy${"x".repeat(33)}`;
const nowSec = Math.floor(Date.now() / 1000);
const SLOT_A = nowSec - (nowSec % 3600) + 2 * 86400;
const SLOT_B = SLOT_A + 3600;
const SLOT_SOON = nowSec + 600; // inside the one-hour notice window: never offered
const iso = sec => new Date(sec * 1000).toISOString();

function fakeWorld() {
  const db = {
    leads: [], booking_holds: [], site_settings: [], lead_events: [], lifecycle_events: [],
    trainers: [
      { id: "cbf54e9f-d68c-44ba-b6ad-d48549caca8e", slug: "lorenzo-miller", full_name: "Lorenzo Miller", market: "Cleveland, OH", state: "Ohio", headshot_url: "/assets/trainer-bio-photos/lorenzo-miller.jpg", status: "active" },
      { id: "45875481-0bb3-420f-9add-6fdceb7efa51", slug: "daniel-bainbridge", full_name: "Daniel Bainbridge", market: "Crestview", state: "Florida", headshot_url: "https://example.test/d.jpg", status: "active" }
    ]
  };
  const calls = [];
  let n = 0;
  const uuid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
  global.fetch = async (url, options = {}) => {
    const u = new URL(String(url));
    const method = options.method || "GET";
    const headers = options.headers || {};
    const body = typeof options.body === "string" && headers["Content-Type"] === "application/json" ? JSON.parse(options.body) : options.body;
    calls.push({ host: u.host, method, path: u.pathname, url: String(url), headers, body });
    const res = (status, data, text) => ({ ok: status < 400, status, text: async () => text ?? JSON.stringify(data), json: async () => data });
    if (u.host === "calendar.google.com") return res(200, null, `<html><script>var k="${FAKE_KEY}";</script></html>`);
    if (u.host === "calendar-pa.clients6.google.com") return res(200, null, JSON.stringify([[[[[String(SLOT_A)], 60]], [[[String(SLOT_B)], 60]], [[[String(SLOT_SOON)], 60]]]]));
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
        if (table === "booking_holds" && rows.some(h => h.status === "held" && h.trainer_slug === r.trainer_slug && h.slot_start === r.slot_start)) return res(409, { code: "23505", message: "duplicate key value violates unique constraint" });
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

const intake = over => ({ first_name: "Pat", last_name: "Tester", phone: "440-555-0100", email: "pat@example.test", zip: "44128", problem: "Pulling on the leash", dog_name: "Rex", sms_consent: true, source_page: "ldtt-ads-v2/cleveland", ...over });
const evalBody = over => ({
  trainer_slug: "lorenzo-miller", slot_start: SLOT_A, location: "in_home",
  client: { first_name: "Pat", last_name: "Tester", phone: "440-555-0100", email: "pat@example.test", address: "1 Main St, Cleveland, OH 44128" },
  dogs: [{ name: "Rex", sex: "Male", fixed: "Yes", vaccinated: "Yes", age: "2 years", breed: "Lab", behavior: "Pulls on the leash" }],
  ...over
});
const writes = calls => calls.filter(c => c.host === "supabase.test" && c.method !== "GET");

test("ZIP routing and Google slot parsing", () => {
  const { B } = load(true);
  assert.equal(B.trainerForZip("44128").slug, "lorenzo-miller");
  assert.equal(B.trainerForZip("44101-1234").slug, "lorenzo-miller");
  assert.equal(B.trainerForZip("32536").slug, "daniel-bainbridge");
  assert.equal(B.trainerForZip("90210"), null);
  assert.equal(B.trainerForZip("abc"), null);
  assert.deepEqual(B.parseSlots([[[[["1789387200"], 60]], [[["1789416000"], 60]]]]), [{ start: 1789387200, minutes: 60 }, { start: 1789416000, minutes: 60 }]);
  assert.deepEqual(B.parseSlots(null), []);
  // A stored settings row wins per trainer (office edits), unknown values fall back safely.
  const merged = B.mergeSettings([{ slug: "daniel-bainbridge", zip_prefixes: ["32536"], location_mode: "hack<script>" }]);
  const daniel = merged.find(t => t.slug === "daniel-bainbridge");
  assert.deepEqual(daniel.zip_prefixes, ["32536"]);
  assert.equal(daniel.location_mode, "in_home");
  assert.equal(daniel.time_zone, "America/Chicago");
});

test("every new route answers 404 on live and makes no call", async () => {
  const { leadApi, bookingApi, pageApi } = load(false);
  const { calls } = fakeWorld();
  assert.equal((await call(leadApi, { body: intake() })).statusCode, 404);
  assert.equal((await call(leadApi, { method: "OPTIONS", headers: { origin: "https://ldtt-ads-v2-sandbox.vercel.app" } })).statusCode, 404);
  assert.equal((await call(bookingApi, { method: "GET", query: { trainer: "lorenzo-miller" } })).statusCode, 404);
  assert.equal((await call(bookingApi, { body: evalBody() })).statusCode, 404);
  assert.equal((await call(pageApi, { method: "GET", query: { slug: "lorenzo-miller" } })).statusCode, 404);
  assert.equal(calls.length, 0);
});

test("booking-lead: CORS preflight allows the 2.0 pages only", async () => {
  const { leadApi } = load(true);
  fakeWorld();
  const ok = await call(leadApi, { method: "OPTIONS", headers: { origin: "https://ldtt-ads-v2-sandbox.vercel.app" } });
  assert.equal(ok.statusCode, 204);
  assert.equal(ok.headers["Access-Control-Allow-Origin"], "https://ldtt-ads-v2-sandbox.vercel.app");
  assert.match(ok.headers["Access-Control-Allow-Methods"], /POST/);
  const evil = await call(leadApi, { method: "OPTIONS", headers: { origin: "https://evil.example" } });
  assert.equal(evil.headers["Access-Control-Allow-Origin"], undefined);
});

test("booking-lead: Cleveland and Crestview ZIPs get their trainer's booking link, in the practice schema", async () => {
  const { leadApi } = load(true);
  const { db, calls } = fakeWorld();
  const cle = await call(leadApi, { body: intake(), headers: { origin: "https://ldtt-ads-v2-sandbox.vercel.app" } });
  assert.equal(cle.statusCode, 200);
  assert.equal(cle.payload.ok, true);
  assert.equal(cle.payload.trainer_slug, "lorenzo-miller");
  assert.equal(cle.payload.book_url, `https://ldtt-sandbox.vercel.app/book/lorenzo-miller?lead=${cle.payload.lead_id}`);
  const lead = db.leads.find(l => l.id === cle.payload.lead_id);
  assert.equal(lead.status, "new_inquiry");
  assert.equal(lead.sms_consent, true);
  assert.equal(lead.trainer_slug, "lorenzo-miller");
  assert.equal(lead.raw_payload.sales_pipeline, true);
  assert.equal(lead.raw_payload.booking.intake.via, "booking-lead");
  assert.equal(lead.raw_payload.trainer_market, "Cleveland, OH", "the card's market label reads raw_payload");
  assert.ok(db.lifecycle_events.some(e => e.event_type === "form_received" && e.entity_id === lead.id));
  // Rule 20: every table call on the practice copy carries the practice profile.
  assert.ok(calls.filter(c => c.host === "supabase.test").every(c => c.headers["Accept-Profile"] === "practice" && c.headers["Content-Profile"] === "practice"));

  const fl = await call(leadApi, { body: intake({ email: "fl@example.test", phone: "850-555-0100", zip: "32536" }) });
  assert.equal(fl.payload.trainer_slug, "daniel-bainbridge");
  assert.match(fl.payload.book_url, /\/book\/daniel-bainbridge\?lead=/);

  const none = await call(leadApi, { body: intake({ email: "ca@example.test", phone: "310-555-0100", zip: "90210", sms_consent: "no" }) });
  assert.equal(none.payload.ok, true);
  assert.equal(none.payload.trainer_slug, null);
  assert.equal(none.payload.book_url, null);
  assert.match(none.payload.message, /office will call/);
  assert.equal(db.leads.find(l => l.id === none.payload.lead_id).sms_consent, false);

  const again = await call(leadApi, { body: intake() });
  assert.equal(again.payload.lead_id, cle.payload.lead_id, "a double submit returns the same lead");
  assert.equal(db.leads.length, 3);

  const bad = await call(leadApi, { body: { phone: "440" } });
  assert.equal(bad.statusCode, 400);
});

test("availability: Google's free times minus held times and the next hour; the key never leaves the server", async () => {
  const { bookingApi } = load(true);
  const { db, calls } = fakeWorld();
  db.booking_holds.push({ id: "h1", trainer_slug: "lorenzo-miller", slot_start: iso(SLOT_B), status: "held", lead_id: "x" });
  const res = await call(bookingApi, { method: "GET", query: { trainer: "lorenzo-miller" } });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.payload.slots.map(s => s.start), [SLOT_A]);
  assert.equal(res.payload.trainer.name, "Lorenzo Miller");
  assert.equal(res.payload.trainer.market, "Cleveland, OH");
  assert.deepEqual(res.payload.locations, ["in_home", "training_center"]);
  assert.equal(res.payload.training_center_address, "4815 Orchard Rd, Garfield Heights, OH 44128");
  assert.ok(!JSON.stringify(res.payload).includes(FAKE_KEY));
  const google = calls.filter(c => c.host === "calendar-pa.clients6.google.com");
  assert.equal(google.length, 1);
  assert.ok(google.every(c => c.path === "/$rpc/google.internal.calendar.v1.AppointmentBookingService/ListAvailableSlots"));
  // Second read inside a minute is served from the short cache.
  await call(bookingApi, { method: "GET", query: { trainer: "lorenzo-miller" } });
  assert.equal(calls.filter(c => c.host === "calendar-pa.clients6.google.com").length, 1);
  const daniel = await call(bookingApi, { method: "GET", query: { trainer: "daniel-bainbridge" } });
  assert.deepEqual(daniel.payload.locations, ["in_home"]);
  assert.equal(daniel.payload.trainer.market, "Crestview, Florida");
  assert.equal((await call(bookingApi, { method: "GET", query: { trainer: "nobody" } })).statusCode, 404);
});

test("booking: holds the slot, moves the lead to Eval Scheduled with the time, 409 on the same slot, rebook releases", async () => {
  const { leadApi, bookingApi } = load(true);
  const { db } = fakeWorld();
  const created = await call(leadApi, { body: intake() });
  const leadId = created.payload.lead_id;
  const res = await call(bookingApi, { body: evalBody({ lead_id: leadId, location: "training_center", dogs: [evalBody().dogs[0], { name: "Bella", sex: "Female", fixed: "No", vaccinated: "Yes", age: "8 months", breed: "Beagle", behavior: "Jumping" }] }) });
  assert.equal(res.statusCode, 200, JSON.stringify(res.payload));
  assert.equal(res.payload.eval_scheduled_at, iso(SLOT_A));
  assert.match(res.payload.location, /4815 Orchard Rd/);
  const lead = db.leads.find(l => l.id === leadId);
  assert.equal(lead.status, "evaluation_scheduled");
  assert.equal(lead.eval_scheduled_at, iso(SLOT_A));
  assert.equal(lead.raw_payload.sales_pipeline, true);
  assert.equal(lead.raw_payload.booking.intake.via, "booking-lead", "the intake record is kept");
  assert.equal(lead.raw_payload.booking.dogs.length, 2);
  assert.equal(lead.raw_payload.booking.dogs[1].breed, "Beagle");
  assert.equal(lead.raw_payload.booking.location, "training_center");
  assert.equal(lead.dog_name, "Rex, Bella");
  assert.equal(lead.address_line_1, "1 Main St, Cleveland, OH 44128");
  assert.equal(db.booking_holds.filter(h => h.status === "held").length, 1);
  assert.ok(db.lifecycle_events.some(e => e.event_type === "evaluation_scheduled" && e.entity_id === leadId));
  assert.ok(db.lead_events.some(e => e.event_type === "status_changed" && e.new_status === "evaluation_scheduled"));

  // The same time again (another customer): 409, no lead moves.
  const other = await call(leadApi, { body: intake({ email: "sam@example.test", phone: "440-555-0199" }) });
  const before = JSON.stringify(db.leads.find(l => l.id === other.payload.lead_id));
  const clash = await call(bookingApi, { body: evalBody({ lead_id: other.payload.lead_id }) });
  assert.equal(clash.statusCode, 409);
  assert.equal(clash.payload.taken, true);
  assert.equal(JSON.stringify(db.leads.find(l => l.id === other.payload.lead_id)), before);

  // The held slot is gone from the calendar.
  const open = await call(bookingApi, { method: "GET", query: { trainer: "lorenzo-miller", lead: leadId } });
  assert.ok(!open.payload.slots.some(s => s.start === SLOT_A));
  assert.equal(open.payload.booked.slot_start, iso(SLOT_A));

  // Rebooking the same lead releases its first time.
  const rebook = await call(bookingApi, { body: evalBody({ lead_id: leadId, slot_start: iso(SLOT_B) }) });
  assert.equal(rebook.statusCode, 200);
  assert.deepEqual(db.booking_holds.filter(h => h.status === "held").map(h => h.slot_start), [iso(SLOT_B)]);
  assert.equal(db.leads.find(l => l.id === leadId).eval_scheduled_at, iso(SLOT_B));
});

test("booking: a missing Alpha field or a location the trainer does not offer answers 400 with no writes", async () => {
  const { bookingApi } = load(true);
  const { calls } = fakeWorld();
  const missingBreed = await call(bookingApi, { body: evalBody({ dogs: [{ ...evalBody().dogs[0], breed: "" }] }) });
  assert.equal(missingBreed.statusCode, 400);
  assert.match(missingBreed.payload.message, /Breed/);
  const noAddress = await call(bookingApi, { body: evalBody({ client: { ...evalBody().client, address: "" } }) });
  assert.equal(noAddress.statusCode, 400);
  const noLocation = await call(bookingApi, { body: evalBody({ location: "" }) });
  assert.equal(noLocation.statusCode, 400, "Cleveland must pick in-home or the training center");
  const center = await call(bookingApi, { body: evalBody({ trainer_slug: "daniel-bainbridge", location: "training_center" }) });
  assert.equal(center.statusCode, 400);
  assert.match(center.payload.message, /in-home/);
  const noDog = await call(bookingApi, { body: evalBody({ dogs: [] }) });
  assert.equal(noDog.statusCode, 400);
  assert.equal(writes(calls).length, 0);
});

test("booking: no lead id makes a practice lead from the eval form", async () => {
  const { bookingApi } = load(true);
  const { db } = fakeWorld();
  const res = await call(bookingApi, { body: evalBody({ trainer_slug: "daniel-bainbridge", slot_start: SLOT_A, client: { ...evalBody().client, address: "9 Oak St, Crestview, FL 32536" } }) });
  assert.equal(res.statusCode, 200, JSON.stringify(res.payload));
  assert.equal(db.leads.length, 1);
  assert.equal(db.leads[0].status, "evaluation_scheduled");
  assert.equal(db.leads[0].zip, "32536");
  assert.equal(db.leads[0].sms_consent, false, "the booking page never assumes texting consent");
});

test("the booking page: 200 on the practice copy, 404 for a bad slug", async () => {
  const { pageApi } = load(true);
  fakeWorld();
  const ok = await call(pageApi, { method: "GET", query: { slug: "lorenzo-miller" } });
  assert.equal(ok.statusCode, 200);
  assert.match(ok.sent, /PRACTICE COPY/);
  assert.match(ok.sent, /var SLUG = "lorenzo-miller";/);
  assert.match(ok.sent, /Behavioral challenges/);
  assert.match(ok.sent, /Vaccinations up to date\?/);
  assert.equal((await call(pageApi, { method: "GET", query: { slug: "<script>" } })).statusCode, 404);
});

test("the only Google call is ListAvailableSlots (source + runtime guard)", () => {
  const { B } = load(true);
  const files = ["lib/booking.js", "lib/booking-page.js", "api/booking.js", "api/booking-lead.js", "api/booking-page.js"];
  for (const file of files) {
    const text = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    assert.ok(!/AppointmentBookingService\/(?!ListAvailableSlots)/.test(text), `${file} names another booking method`);
    assert.ok(!/\/calendar\/v3\/|events\.insert|BookAppointment|CreateBooking|CreateAppointment/i.test(text.replace(/Booking in Google is not allowed/g, "")), `${file} writes to Google`);
  }
  assert.throws(() => B.assertReadOnlyGoogleCall("https://calendar-pa.clients6.google.com/$rpc/google.internal.calendar.v1.AppointmentBookingService/CreateBooking?x"));
  assert.doesNotThrow(() => B.assertReadOnlyGoogleCall(`${B.LIST_SLOTS_URL}?x`));
});
