// Booking page redesign (portal chain step 3c, Joshua 2026-09-12, DO-NOT-BREAK rule 74). Against a fake
// Supabase and a fake Google (global fetch replaced), proves:
//   1. the bundled Census ZCTA centroids give real distances (44105 -> 44128 about 5 miles);
//   2. step 1: GET /api/booking?zip= lists every listed trainer within 50 miles, nearest first, with miles,
//      calendar yes/no and the location rule (Cleveland = in-home or training center); drafts, inactive
//      trainers and trainers without a Base ZIP are never listed; nobody within 50 miles = empty list;
//      an unknown ZIP says so; a lead link pre-fills the ZIP;
//   3. "Request this trainer" (no calendar): the lead keeps its status (NOT Eval Scheduled), gets the chosen
//      trainer and every answer, no hold, no Google call, and ONE queued office email (Resend only);
//   4. the no-trainer callback tells the office (queued email) and needs a name + phone;
//   5. routing for the texts uses the radius: a ZIP near only no-calendar trainers still gets a link;
//   6. the page itself: ZIP first, questions before the calendar, then the congratulations; /book works
//      with no trainer in the address; live answers 404;
//   7. the office emails for a request / callback, while the booked-time email is unchanged;
//   8. the portal saves Base ZIP as 5 digits or empty, never anything else.
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

const TRAINERS = () => [
  { id: "cbf54e9f-d68c-44ba-b6ad-d48549caca8e", slug: "lorenzo-miller", full_name: "Lorenzo Miller", market: "Cleveland, OH", state: "Ohio", headshot_url: "/assets/l.jpg", status: "active", base_zip: "44128" },
  { id: "aaaaaaaa-0000-4000-8000-000000000001", slug: "eric-beck", full_name: "Eric Beck", market: "Cleveland", state: "Ohio", headshot_url: "https://example.test/e.jpg", status: "active", base_zip: "44113" },
  { id: "aaaaaaaa-0000-4000-8000-000000000002", slug: "brady-deremer", full_name: "Brady DeRemer", market: "Streetsboro", state: "Ohio", headshot_url: "javascript:alert(1)", status: "active", base_zip: "44241" },
  { id: "45875481-0bb3-420f-9add-6fdceb7efa51", slug: "daniel-bainbridge", full_name: "Daniel Bainbridge", market: "Crestview", state: "Florida", headshot_url: "/d.jpg", status: "active", base_zip: "32536" },
  { id: "aaaaaaaa-0000-4000-8000-000000000003", slug: "michael-king", full_name: "Michael King", market: "Navarre, FL", state: "Florida", headshot_url: "/m.jpg", status: "active", base_zip: "32566" },
  { id: "aaaaaaaa-0000-4000-8000-000000000004", slug: "aryson-whorley", full_name: "Aryson Whorley", market: "Atlanta", state: "Georgia", headshot_url: "/a.jpg", status: "active", base_zip: "30303" },
  { id: "aaaaaaaa-0000-4000-8000-000000000005", slug: "office-draft-123", full_name: "New Trainer Draft", market: "Market Pending", state: "State Pending", headshot_url: "", status: "active", base_zip: "44113" },
  { id: "aaaaaaaa-0000-4000-8000-000000000006", slug: "gone-trainer", full_name: "Gone Trainer", market: "Cleveland", state: "Ohio", headshot_url: "", status: "inactive", base_zip: "44114" },
  { id: "aaaaaaaa-0000-4000-8000-000000000007", slug: "no-zip", full_name: "No Zip", market: "Cleveland", state: "Ohio", headshot_url: "", status: "active", base_zip: null }
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
      if (k.includes("->")) return true;
      if (op === "eq") return String(row[k]) === val;
      if (op === "neq") return String(row[k]) !== val;
      if (op === "gte") return String(row[k] ?? "") >= val;
      if (op === "not" && val === "is.null") return row[k] != null;
      return true;
    });
    if (method === "GET") return res(200, rows.filter(match).map(r => JSON.parse(JSON.stringify(r))));
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
      hit.forEach(r => { Object.assign(r, JSON.parse(JSON.stringify(body))); if (table === "leads") r.version = (r.version || 1) + 1; });
      return res(200, hit.map(r => JSON.parse(JSON.stringify(r))));
    }
    throw new Error(`unexpected ${method}`);
  };
  return { db, calls };
}

function load(sandbox) {
  for (const m of ["../lib/sandbox.js", "../lib/booking.js", "../lib/pipeline.js", "../lib/office-email.js", "../lib/booking-page.js", "../api/booking-lead.js", "../api/booking.js", "../api/booking-page.js"]) delete require.cache[require.resolve(m)];
  if (sandbox) process.env.LDTT_SANDBOX = "1"; else delete process.env.LDTT_SANDBOX;
  return { B: require("../lib/booking.js"), M: require("../lib/office-email.js"), leadApi: require("../api/booking-lead.js"), bookingApi: require("../api/booking.js"), pageApi: require("../api/booking-page.js") };
}

async function call(handler, { method = "POST", body, query = {}, headers = {} } = {}) {
  const res = { statusCode: 0, payload: null, sent: null, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.statusCode = c; return this; }, json(d) { this.payload = d; return this; }, send(d) { this.sent = d; return this; }, end() { return this; } };
  await handler({ method, body, query, headers: { host: "ldtt-sandbox.vercel.app", ...headers } }, res);
  return res;
}

const formBody = over => ({
  client: { first_name: "Pat", last_name: "Tester", phone: "440-555-0100", email: "pat@example.test", address: "1 Main St, Cleveland, OH 44105" },
  dogs: [{ name: "Rex", sex: "Male", fixed: "Yes", vaccinated: "Yes", age: "2 years", breed: "Lab", behavior: "Pulls on the leash" }],
  zip: "44105",
  ...over
});
const writes = calls => calls.filter(c => c.host === "supabase.test" && c.method !== "GET");

test("the bundled Census ZIP centroids give real distances", () => {
  const Z = require("../lib/zip-distance.js");
  const table = JSON.parse(readFileSync(new URL("../lib/zip-centroids.json", import.meta.url), "utf8"));
  assert.ok(Object.keys(table).length > 30000, "the national ZCTA file, not a sample");
  const cle = Z.milesBetween("44105", "44128");
  assert.ok(cle > 4 && cle < 6, `44105 -> 44128 is about 5 miles (got ${cle})`);
  assert.ok(Z.milesBetween("44105", "32536") > 600);
  assert.equal(Z.milesBetween("44105", "00000"), null);
  assert.equal(Z.milesBetween("abc", "44128"), null);
  assert.equal(Z.milesBetween("32536", "32536"), 0);
});

test("step 1: ZIP 44105 lists Cleveland-area trainers nearest first with miles; drafts, inactive and no-ZIP trainers never", async () => {
  const { bookingApi } = load(true);
  const { calls } = fakeWorld();
  const res = await call(bookingApi, { method: "GET", query: { zip: "44105" } });
  assert.equal(res.statusCode, 200);
  const list = res.payload.trainers;
  const slugs = list.map(t => t.slug);
  assert.ok(slugs.includes("lorenzo-miller"));
  assert.ok(!slugs.includes("office-draft-123") && !slugs.includes("gone-trainer") && !slugs.includes("no-zip"));
  assert.ok(!slugs.includes("daniel-bainbridge"), "Florida is not within 50 miles of Cleveland");
  assert.deepEqual(list.map(t => t.miles_exact), [...list.map(t => t.miles_exact)].sort((a, b) => a - b), "nearest first");
  assert.ok(list.every(t => t.miles <= 50));
  const lorenzo = list.find(t => t.slug === "lorenzo-miller");
  assert.equal(lorenzo.miles, 5);
  assert.equal(lorenzo.calendar, true);
  assert.equal(lorenzo.market, "Cleveland, OH");
  assert.equal(lorenzo.photo, "/assets/l.jpg");
  const eric = list.find(t => t.slug === "eric-beck");
  assert.equal(eric.calendar, false, "no schedule id = request this trainer");
  assert.deepEqual(eric.locations, ["in_home", "training_center"], "Cleveland trainers offer the training center");
  assert.equal(eric.training_center_address, "4815 Orchard Rd, Garfield Heights, OH 44128");
  const brady = list.find(t => t.slug === "brady-deremer");
  assert.deepEqual(brady.locations, ["in_home"], "Streetsboro is in-home only");
  assert.equal(brady.photo, "", "an unsafe photo address is dropped");
  assert.equal(res.payload.radius, 50);
  assert.equal(calls.filter(c => c.host.includes("google")).length, 0, "step 1 never asks Google");
  assert.ok(calls.filter(c => c.host === "supabase.test").every(c => c.headers["Accept-Profile"] === "practice"), "rule 20: practice schema only");
});

test("step 1: 32536 lists Daniel first; 59101 has nobody within 50 miles; bad and unknown ZIPs; a lead link pre-fills the ZIP", async () => {
  const { bookingApi } = load(true);
  const { db } = fakeWorld();
  const fl = await call(bookingApi, { method: "GET", query: { zip: "32536" } });
  assert.equal(fl.payload.trainers[0].slug, "daniel-bainbridge");
  assert.equal(fl.payload.trainers[0].miles, 0);
  assert.equal(fl.payload.trainers[0].calendar, true);
  assert.deepEqual(fl.payload.trainers[0].locations, ["in_home"]);
  assert.ok(fl.payload.trainers.some(t => t.slug === "michael-king" && !t.calendar));
  const none = await call(bookingApi, { method: "GET", query: { zip: "59101" } });
  assert.equal(none.statusCode, 200);
  assert.deepEqual(none.payload.trainers, []);
  assert.equal(none.payload.unknown_zip, undefined);
  const unknown = await call(bookingApi, { method: "GET", query: { zip: "00000" } });
  assert.equal(unknown.payload.unknown_zip, true);
  assert.equal((await call(bookingApi, { method: "GET", query: { zip: "441" } })).statusCode, 400);
  db.leads.push({ id: "11111111-2222-4333-8444-555555555555", first_name: "Lee", last_name: "Link", phone: "4405550111", email: "lee@example.test", zip: "44105", status: "new_inquiry", version: 1, raw_payload: {} });
  const viaLead = await call(bookingApi, { method: "GET", query: { lead: "11111111-2222-4333-8444-555555555555" } });
  assert.equal(viaLead.payload.zip, "44105");
  assert.equal(viaLead.payload.lead.first_name, "Lee");
  assert.ok(viaLead.payload.trainers.some(t => t.slug === "lorenzo-miller"));
});

test("request this trainer (no calendar): not Eval Scheduled, chosen trainer + every answer kept, no hold, no Google, one queued office email", async () => {
  const { bookingApi } = load(true);
  const { db, calls } = fakeWorld();
  const res = await call(bookingApi, { body: formBody({ op: "request", trainer_slug: "eric-beck", location: "training_center" }) });
  assert.equal(res.statusCode, 200, JSON.stringify(res.payload));
  assert.equal(res.payload.requested, true);
  assert.match(res.payload.location, /4815 Orchard Rd/);
  const lead = db.leads.find(l => l.id === res.payload.lead_id);
  assert.notEqual(lead.status, "evaluation_scheduled", "only a real picked time is Eval Scheduled");
  assert.equal(lead.eval_scheduled_at, undefined);
  assert.equal(lead.trainer_slug, "eric-beck");
  assert.equal(lead.raw_payload.booking.requested, true);
  assert.equal(lead.raw_payload.booking.slot_start, undefined);
  assert.equal(lead.raw_payload.booking.dogs[0].breed, "Lab");
  assert.equal(lead.raw_payload.booking.location, "training_center");
  assert.equal(lead.raw_payload.sales_pipeline, true);
  assert.equal(db.booking_holds.length, 0);
  assert.equal(calls.filter(c => c.host.includes("google")).length, 0);
  const notices = lead.raw_payload.pipeline.booking_notices;
  assert.equal(notices.length, 1);
  assert.equal(notices[0].kind, "trainer_request");
  assert.equal(notices[0].office_email.status, "queued");
  assert.equal(notices[0].office_email.reason, "Office email waiting for the Resend key");
  assert.equal(lead.raw_payload.pipeline.office_email_pending, true);
  // A double tap for the same trainer never queues a second email.
  await call(bookingApi, { body: formBody({ op: "request", trainer_slug: "eric-beck", location: "training_center", lead_id: lead.id }) });
  assert.equal(db.leads.find(l => l.id === lead.id).raw_payload.pipeline.booking_notices.length, 1);
  // A trainer WITH a calendar must be booked with a time; a bad form writes nothing.
  assert.equal((await call(bookingApi, { body: formBody({ op: "request", trainer_slug: "lorenzo-miller", location: "in_home" }) })).statusCode, 400);
  const before = writes(calls).length;
  const bad = await call(bookingApi, { body: formBody({ op: "request", trainer_slug: "brady-deremer", location: "in_home", dogs: [{ name: "Rex" }] }) });
  assert.equal(bad.statusCode, 400);
  const center = await call(bookingApi, { body: formBody({ op: "request", trainer_slug: "brady-deremer", location: "training_center" }) });
  assert.equal(center.statusCode, 400, "Streetsboro offers in-home only");
  assert.equal(writes(calls).length, before);
  assert.equal((await call(bookingApi, { body: formBody({ op: "request", trainer_slug: "office-draft-123", location: "in_home" }) })).statusCode, 404);
});

test("a booked lead cannot be turned into a request; the request is superseded by a later booking", async () => {
  const { bookingApi } = load(true);
  const { db } = fakeWorld();
  const booked = await call(bookingApi, { body: formBody({ trainer_slug: "lorenzo-miller", slot_start: SLOT_A, location: "in_home" }) });
  assert.equal(booked.statusCode, 200, JSON.stringify(booked.payload));
  const again = await call(bookingApi, { body: formBody({ op: "request", trainer_slug: "eric-beck", location: "in_home", lead_id: booked.payload.lead_id }) });
  assert.equal(again.statusCode, 409);
  assert.equal(db.leads.find(l => l.id === booked.payload.lead_id).status, "evaluation_scheduled");
  // The congratulations screen comes back when the link is opened again.
  const reopened = await call(bookingApi, { method: "GET", query: { lead: booked.payload.lead_id } });
  assert.equal(reopened.payload.outcome.booked, true);
  assert.equal(reopened.payload.outcome.trainer_name, "Lorenzo Miller");
});

test("no trainer within 50 miles: the callback tells the office (queued email) and needs a name and a phone", async () => {
  const { bookingApi } = load(true);
  const { db } = fakeWorld();
  const noPhone = await call(bookingApi, { body: { op: "callback", zip: "59101", client: { first_name: "Mo" } } });
  assert.equal(noPhone.statusCode, 400);
  assert.equal(db.leads.length, 0);
  const res = await call(bookingApi, { body: { op: "callback", zip: "59101", client: { first_name: "Mo", last_name: "Tana", phone: "406-555-0100", email: "mo@example.test" } } });
  assert.equal(res.statusCode, 200, JSON.stringify(res.payload));
  const lead = db.leads.find(l => l.id === res.payload.lead_id);
  assert.equal(lead.zip, "59101");
  assert.equal(lead.status, "new_inquiry");
  assert.match(lead.raw_payload.booking.callback.reason, /No trainer within 50 miles of ZIP 59101/);
  const notice = lead.raw_payload.pipeline.booking_notices[0];
  assert.equal(notice.kind, "no_trainer");
  assert.equal(notice.office_email.status, "queued");
});

test("text routing uses the radius: near only no-calendar trainers still gets a link; nobody near gets none", async () => {
  const { leadApi } = load(true);
  const { db } = fakeWorld();
  const atl = await call(leadApi, { body: { first_name: "Ann", phone: "404-555-0100", email: "ann@example.test", zip: "30303", sms_consent: true, source_page: "ads-v2/atlanta" } });
  assert.equal(atl.statusCode, 200, JSON.stringify(atl.payload));
  assert.equal(atl.payload.trainer_slug, "aryson-whorley");
  assert.match(atl.payload.book_url, /\/book\/aryson-whorley\?lead=/);
  assert.match(atl.payload.message, /Pick your trainer/);
  assert.equal(db.leads.find(l => l.id === atl.payload.lead_id).trainer_slug, undefined, "no trainer is assigned until the client picks");
  const cle = await call(leadApi, { body: { first_name: "Cy", phone: "216-555-0100", email: "cy@example.test", zip: "44105", sms_consent: false, source_page: "ads-v2/cleveland" } });
  assert.equal(cle.payload.trainer_slug, "lorenzo-miller", "the nearest trainer WITH a calendar is assigned");
  const mt = await call(leadApi, { body: { first_name: "Mo", phone: "406-555-0100", email: "mo@example.test", zip: "59101", sms_consent: true, source_page: "ads-v2/x" } });
  assert.equal(mt.payload.trainer_slug, null);
  assert.equal(mt.payload.book_url, null);
});

test("the page: ZIP first, questions before the calendar, then the congratulations; /book works with no trainer; 404 on live", async () => {
  const { pageApi } = load(true);
  fakeWorld();
  const bare = await call(pageApi, { method: "GET", query: {} });
  assert.equal(bare.statusCode, 200);
  const html = bare.sent;
  const at = id => html.indexOf(`id="${id}"`);
  assert.ok(at("stepZip") > 0 && at("stepZip") < at("stepForm") && at("stepForm") < at("stepTime") && at("stepTime") < at("stepDone"), "Joshua's order: ZIP -> questions -> calendar -> done");
  assert.match(html, /Enter your ZIP code/);
  assert.match(html, /The office will match you with a trainer/);
  assert.match(html, /Request this trainer — the office will schedule you/);
  assert.match(html, /866\.436\.4959/);
  assert.match(html, /Behavioral challenges/);
  assert.match(html, /Vaccinations up to date\?/);
  assert.match(html, /var SLUG = "";/);
  const withSlug = await call(pageApi, { method: "GET", query: { slug: "lorenzo-miller" } });
  assert.match(withSlug.sent, /var SLUG = "lorenzo-miller";/);
  const live = load(false);
  assert.equal((await call(live.pageApi, { method: "GET", query: {} })).statusCode, 404);
  assert.equal((await call(live.bookingApi, { method: "GET", query: { zip: "44105" } })).statusCode, 404);
  assert.equal((await call(live.bookingApi, { body: formBody({ op: "request", trainer_slug: "eric-beck" }) })).statusCode, 404);
  const vercel = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
  const i = vercel.rewrites.findIndex(r => r.source === "/book");
  assert.ok(i >= 0 && i < vercel.rewrites.findIndex(r => r.source === "/:slug"), "/book must win over the trainer catch-all");
});

test("office emails: request + callback wording; the booked-time email is unchanged", () => {
  const { M } = load(true);
  const lead = { id: "L1", first_name: "Pat", last_name: "Tester", phone: "4405550100", zip: "44105", raw_payload: {} };
  const req = M.buildBookingEmail({ lead, booking: { trainer_name: "Eric Beck", requested: true, location_label: "In-home", client: { first_name: "Pat", last_name: "Tester", phone: "4405550100" }, dogs: [{ name: "Rex", breed: "Lab" }] }, staffLink: "https://x/staff", practice: true, kind: "trainer_request" });
  assert.match(req.subject, /^\[PRACTICE COPY\] Trainer requested: Pat Tester wants Eric Beck/);
  assert.match(req.text, /schedule the free evaluation with Eric Beck/);
  assert.match(req.text, /Breed: Lab/);
  const cb = M.buildBookingEmail({ lead, booking: { callback: { zip: "59101", phone: "4065550100" } }, kind: "no_trainer" });
  assert.match(cb.subject, /^Callback needed: Pat Tester, no trainer within 50 miles of ZIP 59101/);
  const booked = M.buildBookingEmail({ lead, booking: { when_label: "Mon, Sep 14, 8:00 AM EDT", trainer_name: "Lorenzo Miller" } });
  assert.match(booked.subject, /^Eval booked: Pat Tester with Lorenzo Miller, Mon, Sep 14, 8:00 AM EDT/);
  assert.match(booked.text, /Log this client into Alpha/);
});

test("the portal saves Base ZIP as 5 digits or empty (server check on create and update)", () => {
  const src = readFileSync(new URL("../api/operational-mutation.js", import.meta.url), "utf8");
  assert.match(src, /"base_zip" \/\/ rule 74/);
  assert.equal((src.match(/const zipCheck = cleanBaseZip\(changes\.base_zip\);/g) || []).length, 2, "both create and update check it");
  const fn = new Function(`${src.match(/function cleanBaseZip\(value\) \{[\s\S]*?\n\}/)[0]}; return cleanBaseZip;`)();
  assert.deepEqual(fn("44128"), { value: "44128" });
  assert.deepEqual(fn(" "), { value: null });
  assert.deepEqual(fn(null), { value: null });
  assert.ok(fn("4412").error);
  assert.ok(fn("44128-1234").error);
  assert.ok(fn("<script>").error);
  const app = readFileSync(new URL("../trainer-backoffice/app.js", import.meta.url), "utf8");
  assert.match(app, /\{ profile: "profileBaseZip", public: "savedBaseZip", landing: null, label: "Base ZIP \(booking page distance\)", baseZip: true \}/);
  assert.match(app, /profileBaseZip: \["base_zip", /);
  assert.match(app, /\.\.\.\(trainer\.profileBaseZip !== undefined \? \{ base_zip: /, "a full save never blanks a Base ZIP the portal did not load");
});
