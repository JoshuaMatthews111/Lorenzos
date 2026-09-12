// One pipeline for every lead source + the texts (portal chain step 3, DO-NOT-BREAK rule 72). Against a
// fake Supabase, a fake Google and a fake Make (global fetch replaced), proves:
//   1. /api/pipeline answers 404 on live and makes no call at all;
//   2. a Contact Us lead (as submit-contact saves it) with SMS consent, a tester phone and a served ZIP
//      gets exactly ONE pathway 1 text with its booking link; a second call, or two at once, sends nothing more;
//   3. no SMS consent -> no text; a non-tester phone -> no text; no trainer for the ZIP -> no text and no
//      link (office follow-up); a trainer-page lead whose trainer takes no online bookings stays with that
//      trainer and gets no link; the free ebook opt-in is left alone; an old lead cannot start it;
//   4. /api/booking-lead texts once and never twice for a double submit;
//   5. a booking sends pathway 2 once (customer + the practice trainer-alert tester phone);
//   6. settings: defaults (4 addresses + Angela's empty slot), bad input refused, saving needs an office login;
//   7. JOSHUA'S HARD RULE: no email is sent by this step (no Resend, no FormSubmit), and the office's
//      CURRENT new-lead email path (relayFormDeliveries -> /api/form-delivery -> FormSubmit) is unchanged.
// NOT deployed (tests/ is in .vercelignore). Nothing here talks to the real project, Google or Make.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
process.env.SUPABASE_URL = "http://supabase.test";
delete process.env.LDTT_PRACTICE_ORIGIN;
process.env.LDTT_PRACTICE_HOST = "ldtt-sandbox.vercel.app";
process.env.LDTT_MAKE_HOOK_PATHWAY1 = "https://hook.us2.make.com/testhookone";
process.env.LDTT_MAKE_HOOK_PATHWAY2 = "https://hook.us2.make.com/testhooktwo";
const require = createRequire(import.meta.url);

const FAKE_KEY = `AIzaSy${"x".repeat(33)}`;
const nowSec = Math.floor(Date.now() / 1000);
const SLOT_A = nowSec - (nowSec % 3600) + 2 * 86400;
const TESTER = "+14402142915";

function fakeWorld() {
  const db = {
    leads: [], booking_holds: [], site_settings: [], lead_events: [], lifecycle_events: [],
    communications_testers: [
      { phone: "+1 (440) 214-2915", active: true },
      { phone: "440-821-7077", active: true },
      { phone: "+12165550000", active: false }
    ],
    trainers: [
      { id: "cbf54e9f-d68c-44ba-b6ad-d48549caca8e", slug: "lorenzo-miller", full_name: "Lorenzo Miller", market: "Cleveland, OH", state: "Ohio", headshot_url: "/x.jpg", status: "active" },
      { id: "45875481-0bb3-420f-9add-6fdceb7efa51", slug: "daniel-bainbridge", full_name: "Daniel Bainbridge", market: "Crestview", state: "Florida", headshot_url: "/d.jpg", status: "active" },
      { id: "11111111-0bb3-420f-9add-6fdceb7efa51", slug: "fred-harris", full_name: "Fred Harris", market: "Columbus, OH", state: "Ohio", headshot_url: "/f.jpg", status: "active" }
    ]
  };
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
    await new Promise(resolve => setImmediate(resolve)); // let concurrent callers interleave
    const res = (status, data, text) => ({ ok: status < 400, status, text: async () => text ?? JSON.stringify(data), json: async () => data });
    if (u.host === "calendar.google.com") return res(200, null, `<html>${FAKE_KEY}</html>`);
    if (u.host === "calendar-pa.clients6.google.com") return res(200, null, JSON.stringify([[[[[String(SLOT_A)], 60]]]]));
    if (u.host === "hook.us2.make.com") return res(200, null, "Accepted");
    if (u.host !== "supabase.test") throw new Error(`unexpected host ${u.host}`);
    if (u.pathname === "/auth/v1/user") return res(401, { message: "no" });
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
      if (op === "in") return val.replace(/^\(|\)$/g, "").split(",").includes(String(row[k]));
      return true;
    });
    if (method === "GET") return res(200, rows.filter(match).map(r => JSON.parse(JSON.stringify(r))));
    if (method === "POST") {
      const out = [];
      for (const r of Array.isArray(body) ? body : [body]) {
        if (table === "site_settings") {
          const existing = rows.find(x => x.key === r.key);
          if (existing) { Object.assign(existing, r); out.push(existing); continue; }
        }
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
  for (const m of ["../lib/sandbox.js", "../lib/portal-auth.js", "../lib/booking.js", "../lib/pipeline.js", "../api/booking-lead.js", "../api/booking.js", "../api/pipeline.js"]) delete require.cache[require.resolve(m)];
  if (sandbox) process.env.LDTT_SANDBOX = "1"; else delete process.env.LDTT_SANDBOX;
  return { P: require("../lib/pipeline.js"), pipelineApi: require("../api/pipeline.js"), leadApi: require("../api/booking-lead.js"), bookingApi: require("../api/booking.js") };
}

async function call(handler, { method = "POST", body, query = {}, headers = {} } = {}) {
  const res = { statusCode: 0, payload: null, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.statusCode = c; return this; }, json(d) { this.payload = d; return this; }, send() { return this; }, end() { return this; } };
  await handler({ method, body, query, headers: { host: "ldtt-sandbox.vercel.app", ...headers } }, res);
  return res;
}

// A lead exactly as submit-contact saves it from the Contact Us page (practice schema).
function formLead(db, over = {}) {
  const lead = {
    id: `aaaaaaaa-bbbb-4ccc-8ddd-${String(db.leads.length + 1).padStart(12, "0")}`, version: 1, created_at: new Date().toISOString(),
    first_name: "Joshua", last_name: "Proof", phone: "440-214-2915", email: "proof@example.test", zip: "44128", sms_consent: true,
    trainer_slug: null, comments: "Pulls on the leash", status: "new_inquiry", source_page: "contact.html", raw_payload: { source_page: "contact.html", qa: "true" }, ...over
  };
  db.leads.push(lead);
  return lead;
}
const hookCalls = (calls, n) => calls.filter(c => c.host === "hook.us2.make.com" && c.path === (n === 1 ? "/testhookone" : "/testhooktwo"));
const noEmail = calls => assert.equal(calls.filter(c => /resend\.com|formsubmit\.co/.test(c.host) || /form-delivery/.test(c.url)).length, 0, "this step never sends email");

test("live: /api/pipeline answers 404 and makes no call", async () => {
  const { pipelineApi } = load(false);
  const { calls } = fakeWorld();
  assert.equal((await call(pipelineApi, { body: { op: "enter", lead_id: "aaaaaaaa-bbbb-4ccc-8ddd-000000000001" } })).statusCode, 404);
  assert.equal((await call(pipelineApi, { method: "GET", query: { op: "settings" } })).statusCode, 404);
  assert.equal(calls.length, 0);
});

test("Contact Us lead with SMS consent: one booking-link text to the tester phone, never twice", async () => {
  const { pipelineApi } = load(true);
  const { db, calls } = fakeWorld();
  const lead = formLead(db);
  const res = await call(pipelineApi, { body: { op: "enter", lead_id: lead.id, via: "contact.html" } });
  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.trainer_slug, "lorenzo-miller");
  assert.equal(res.payload.book_url, `https://ldtt-sandbox.vercel.app/book/lorenzo-miller?lead=${lead.id}`);
  assert.equal(res.payload.texted, true);
  const hooks = hookCalls(calls, 1);
  assert.equal(hooks.length, 1);
  assert.equal(hooks[0].body.phone, TESTER);
  assert.equal(hooks[0].body.booking_link, res.payload.book_url);
  assert.equal(hooks[0].body.problem, "Pulls on the leash");
  const saved = db.leads[0];
  assert.equal(saved.trainer_slug, "lorenzo-miller");
  assert.equal(saved.raw_payload.sales_pipeline, true);
  assert.equal(saved.raw_payload.trainer_market, "Cleveland, OH");
  assert.equal(saved.raw_payload.booking.intake.trainer_slug, "lorenzo-miller");
  assert.equal(saved.raw_payload.pipeline.new_lead_text.status, "sent");
  assert.equal(saved.raw_payload.pipeline.new_lead_text.to_last4, "2915");
  assert.equal(saved.raw_payload.qa, "true", "the browser's own fields are kept as they were");
  assert.equal(saved.status, "new_inquiry", "entering the pipeline never changes the status");
  // Rule 20: every table call on the practice copy carries the practice profile.
  assert.ok(calls.filter(c => c.host === "supabase.test" && c.path.startsWith("/rest/v1/")).every(c => c.headers["Accept-Profile"] === "practice"));
  const again = await call(pipelineApi, { body: { op: "enter", lead_id: lead.id } });
  assert.equal(again.payload.already, true);
  assert.equal(hookCalls(calls, 1).length, 1, "a second call sends nothing");
  noEmail(calls);
});

test("two calls at the same moment (double click, two tabs): exactly one text", async () => {
  const { P } = load(true);
  const { db, calls } = fakeWorld();
  const lead = formLead(db);
  const [a, b] = await Promise.all([P.enterPipeline(lead.id, { via: "a" }), P.enterPipeline(lead.id, { via: "b" })]);
  assert.equal(a.status, 200);
  assert.equal(b.status, 200);
  assert.equal(hookCalls(calls, 1).length, 1);
  assert.equal([a.body, b.body].filter(x => x.already).length, 1);
});

test("no SMS consent, a non-tester phone, an unserved ZIP, an old lead: no text", async () => {
  const { pipelineApi } = load(true);
  const { db, calls } = fakeWorld();
  const noConsent = formLead(db, { sms_consent: false });
  const stranger = formLead(db, { phone: "216-555-0199" });
  const noTrainer = formLead(db, { zip: "90210" });
  const old = formLead(db, { created_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString() });
  for (const lead of [noConsent, stranger, noTrainer]) assert.equal((await call(pipelineApi, { body: { op: "enter", lead_id: lead.id } })).statusCode, 200);
  assert.equal((await call(pipelineApi, { body: { op: "enter", lead_id: old.id } })).statusCode, 409);
  assert.equal(hookCalls(calls, 1).length, 0);
  assert.match(db.leads.find(l => l.id === noConsent.id).raw_payload.pipeline.new_lead_text.reason, /No SMS consent/);
  assert.equal(db.leads.find(l => l.id === noConsent.id).raw_payload.sales_pipeline, true, "no consent: still a pipeline lead, just no texts");
  assert.match(db.leads.find(l => l.id === stranger.id).raw_payload.pipeline.new_lead_text.reason, /not an active tester/);
  const unserved = db.leads.find(l => l.id === noTrainer.id);
  assert.equal(unserved.raw_payload.pipeline.book_url, null);
  assert.equal(unserved.trainer_slug, null);
  assert.match(unserved.raw_payload.pipeline.new_lead_text.reason, /office follow-up/);
  assert.equal(db.leads.find(l => l.id === old.id).raw_payload.pipeline, undefined);
  noEmail(calls);
});

test("a trainer-page lead stays with its trainer; the free ebook opt-in is left alone", async () => {
  const { P } = load(true);
  const { db, calls } = fakeWorld();
  const fred = formLead(db, { trainer_slug: "fred-harris", zip: "44128" });
  const lorenzoPage = formLead(db, { trainer_slug: "lorenzo-miller", zip: "43004" });
  const ebook = formLead(db, { phone: "Not provided - PDF opt-in", sms_consent: false, raw_payload: { lead_type: "pdf_download" } });
  const r1 = await P.enterPipeline(fred.id);
  assert.equal(r1.body.book_url, null, "never handed to another trainer by ZIP");
  assert.equal(db.leads.find(l => l.id === fred.id).trainer_slug, "fred-harris");
  assert.match(db.leads.find(l => l.id === fred.id).raw_payload.pipeline.new_lead_text.reason, /does not take online bookings yet/);
  const r2 = await P.enterPipeline(lorenzoPage.id);
  assert.equal(r2.body.trainer_slug, "lorenzo-miller", "Lorenzo's own page books with Lorenzo whatever the ZIP");
  const r3 = await P.enterPipeline(ebook.id);
  assert.equal(r3.body.skipped, "ebook");
  assert.equal(db.leads.find(l => l.id === ebook.id).version, 1, "the ebook lead is not written");
  assert.equal(hookCalls(calls, 1).length, 1, "only Lorenzo's page lead is texted");
});

test("booking-lead (2.0 pages): texts once, a double submit never texts twice", async () => {
  const { leadApi } = load(true);
  const { db, calls } = fakeWorld();
  const body = { first_name: "Joshua", last_name: "Proof", phone: "440-214-2915", email: "p2@example.test", zip: "44128", problem: "Jumping", sms_consent: true, source_page: "ldtt-ads-v2" };
  const first = await call(leadApi, { body });
  const second = await call(leadApi, { body });
  assert.equal(first.statusCode, 200);
  assert.equal(first.payload.lead_id, second.payload.lead_id);
  assert.equal(first.payload.book_url, `https://ldtt-sandbox.vercel.app/book/lorenzo-miller?lead=${first.payload.lead_id}`);
  assert.equal(hookCalls(calls, 1).length, 1);
  assert.equal(hookCalls(calls, 1)[0].body.problem, "Jumping");
  assert.equal(db.leads[0].raw_payload.pipeline.new_lead_text.status, "sent");
  assert.equal(db.leads[0].raw_payload.booking.intake.via, "booking-lead", "booking-lead's own intake record is kept");
  noEmail(calls);
});

test("a booking sends pathway 2 once (customer + the practice trainer-alert tester phone), no email", async () => {
  const { bookingApi, P } = load(true);
  const { db, calls } = fakeWorld();
  const lead = formLead(db);
  const res = await call(bookingApi, { body: {
    trainer_slug: "lorenzo-miller", slot_start: SLOT_A, lead_id: lead.id, location: "training_center",
    client: { first_name: "Joshua", last_name: "Proof", phone: "440-214-2915", email: "proof@example.test", address: "1 Main St, Cleveland, OH 44128" },
    dogs: [{ name: "Rex", sex: "Male", fixed: "Yes", vaccinated: "Yes", age: "2", breed: "Lab", behavior: "Growls at visitors" }]
  } });
  assert.equal(res.statusCode, 200);
  assert.ok(!JSON.stringify(res.payload).includes("rachelleggett"), "the customer's browser never sees the office list");
  const h2 = hookCalls(calls, 2);
  assert.equal(h2.length, 1);
  assert.equal(h2[0].body.customer_phone, TESTER);
  assert.equal(h2[0].body.trainer_phone, TESTER, "practice copy: the trainer alert goes to the tester phone in the settings box");
  assert.equal(h2[0].body.service_address, "4815 Orchard Rd, Garfield Heights, OH 44128");
  assert.match(h2[0].body.safety_flag, /SAFETY/);
  assert.match(h2[0].body.trainer_portal_link, new RegExp(`/staff\\?view=leads&lead=${lead.id}$`));
  const saved = db.leads[0];
  assert.equal(saved.status, "evaluation_scheduled");
  assert.equal(saved.eval_scheduled_at, new Date(SLOT_A * 1000).toISOString());
  const notice = saved.raw_payload.pipeline.booking_notices.at(-1);
  assert.equal(notice.texts.status, "sent");
  assert.equal(notice.office_email, undefined, "no office email in this step (3b, Resend)");
  // The same hold never texts twice.
  const again = await P.afterBooking({ lead: saved, booking: saved.raw_payload.booking, trainer: { full_name: "Lorenzo Miller" }, setting: null });
  assert.equal(again.texts.status, "skipped");
  assert.equal(hookCalls(calls, 2).length, 1);
  noEmail(calls);
});

test("booking without SMS consent: no customer text, the trainer alert still goes", async () => {
  const { P } = load(true);
  const { calls } = fakeWorld();
  const booking = { trainer_slug: "lorenzo-miller", slot_start: new Date(SLOT_A * 1000).toISOString(), time_zone: "America/New_York", client: { first_name: "A", last_name: "B", phone: "440-214-2915", address: "x" }, dogs: [{ name: "Rex", behavior: "Pulls" }], location: "in_home" };
  const texts = await P.sendBookingTexts({ lead: { id: "l1", sms_consent: false }, booking, trainer: { full_name: "Lorenzo Miller" }, setting: null, settings: P.defaultSettings() });
  assert.equal(texts.status, "sent");
  assert.equal(hookCalls(calls, 2)[0].body.customer_phone, "");
  assert.equal(hookCalls(calls, 2)[0].body.trainer_phone, TESTER);
  assert.match(texts.notes, /no SMS consent/);
});

test("settings: defaults, bad input refused, save needs an office login", async () => {
  const { P, pipelineApi } = load(true);
  const { db } = fakeWorld();
  const d = P.defaultSettings();
  assert.deepEqual(d.recipients.map(r => r.email), ["marketing@lorenzosdogtrainingteam.com", "melissazuk@lorenzosdogtrainingteam.com", "rachelleggett@lorenzosdogtrainingteam.com", "tmillerk999@gmail.com", ""]);
  assert.deepEqual(d.recipients.at(-1), { label: "Angela", email: "" }, "Angela's slot is there, empty");
  assert.equal(P.normalizeSettings({ recipients: [{ label: "X", email: "not-an-email" }] }).errors.length, 1);
  assert.equal(P.normalizeSettings({ recipients: [], practice_trainer_phone: "12" }).errors.length, 1);
  const refused = await call(pipelineApi, { body: { op: "save_settings", recipients: [] } });
  assert.equal(refused.statusCode, 403);
  assert.equal((await call(pipelineApi, { method: "GET", query: { op: "settings" } })).statusCode, 403);
  assert.equal(db.site_settings.length, 0);
  const saved = await P.saveSettings({ recipients: [{ label: "Angela", email: "Angela@Example.test" }, { label: "Angela again", email: "angela@example.test" }], practice_trainer_phone: "(440) 214-2915" }, "Office Admin");
  assert.equal(saved.ok, true);
  assert.deepEqual(saved.settings.recipients, [{ label: "Angela", email: "angela@example.test" }]);
  assert.equal(saved.settings.practice_trainer_phone, TESTER);
  assert.equal(db.site_settings[0].key, "pipeline_office_emails");
  assert.equal((await P.loadSettings()).recipients.length, 1);
});

test("JOSHUA'S HARD RULE: FormSubmit keeps the Contact page, this step sends no email", () => {
  const script = read("script.js");
  const pipelineLib = read("lib/pipeline.js").replace(/\/\/[^\n]*/g, "");
  // relayFormDeliveries is untouched: it still opens with the /api/form-delivery call, and live reaches it
  // through a synchronous check (window.LDTT_IS_SANDBOX is never true on live).
  assert.match(script, /const relayFormDeliveries=async\(formType,entries,canonical,form\)=>\{\n  const response=await fetch\('\/api\/form-delivery',\{/);
  assert.match(script, /const deliverOrEnterPipeline=\(formType,entries,canonical,form\)=>window\.LDTT_IS_SANDBOX===true\n  \? enterPracticePipeline\(canonical,entries\)\n  : relayFormDeliveries\(formType,entries,canonical,form\);/);
  assert.match(read("api/form-delivery.js"), /const CONTACT_EMAIL = "https:\/\/formsubmit\.co\/ajax\/production@lorenzosdogtrainingteam\.com";/);
  assert.match(read("api/form-delivery.js"), /if \(blockedInSandbox\(res, "Submitting this form"\)\) return;/);
  assert.match(read("contact.html"), /<form class="panel form contact-intake" action="https:\/\/formsubmit\.co\/production@lorenzosdogtrainingteam\.com" method="POST"/);
  assert.ok(!/formsubmit|form-delivery|resend/i.test(pipelineLib), "the pipeline never touches FormSubmit, form-delivery or Resend");
  // Only submit-contact is let through on the practice copy; the other functions stay off (rule 20).
  assert.match(script, /const practiceFunctionOff=\(env,functionName\)=>practiceFormsOff\(env\)&&!\(LDTT_PRACTICE_LEAD_FORMS_ON&&functionName==='submit-contact'\);/);
  assert.match(script, /const LDTT_EDGE_PRACTICE_FLAG_DEPLOYED=false;/);
  assert.ok(!/\.trainer-application-form/.test(script.match(/PRACTICE_LEAD_FORM_SELECTOR='([^']+)'/)[1]), "trainer applications stay off on the practice copy");
});

function read(path) { return readFileSync(new URL(`../${path}`, import.meta.url), "utf8"); }
