// Portal chain step 3b (DO-NOT-BREAK rule 73). Against a fake Supabase, a fake Google, a fake Make and a
// fake Resend (global fetch replaced), proves:
//   1. JOSHUA'S HARD RULE: the Contact page's FormSubmit submit is byte-for-byte what it was before step 3
//      (hashes of the handler, relayFormDeliveries, submitEmailRelay, wireAsyncForm and the delivery object
//      equal commit 1176038), and running relayFormDeliveries still posts to /api/form-delivery and, when the
//      server email fails, to FormSubmit production@ from the browser;
//   2. the office booking email goes ONLY through Resend, and with no RESEND_API_KEY it is QUEUED on the lead
//      ("Office email waiting for the Resend key"), never sent another way, and the booking still succeeds;
//   3. once the key is present, "send queued" (and the next booking) sends every queued email once, to the
//      practice test address on the practice copy, with every eval answer, the time, the trainer, the Alpha
//      instruction and the lead link; a Resend failure is recorded and retried; a rebooked lead only emails
//      its current booking;
//   4. Contact Us = Option C: the "I want to..." answer picks the lane; ad pages always take the booking lane;
//      the customer-care text never goes through the pathway 1 hook.
// NOT deployed (tests/ is in .vercelignore). Nothing here talks to the real project, Google, Make or Resend.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import vm from "node:vm";

process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
process.env.SUPABASE_URL = "http://supabase.test";
delete process.env.LDTT_PRACTICE_ORIGIN;
process.env.LDTT_PRACTICE_HOST = "ldtt-sandbox.vercel.app";
process.env.LDTT_MAKE_HOOK_PATHWAY1 = "https://hook.us2.make.com/testhookone";
process.env.LDTT_MAKE_HOOK_PATHWAY2 = "https://hook.us2.make.com/testhooktwo";
const require = createRequire(import.meta.url);
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const FAKE_KEY = `AIzaSy${"x".repeat(33)}`;
const nowSec = Math.floor(Date.now() / 1000);
const SLOT_A = nowSec - (nowSec % 3600) + 2 * 86400;
const SLOT_B = SLOT_A + 3600;
const TESTER = "+14402142915";
const OFFICE = ["marketing@lorenzosdogtrainingteam.com", "melissazuk@lorenzosdogtrainingteam.com", "rachelleggett@lorenzosdogtrainingteam.com", "tmillerk999@gmail.com"];

function getPath(row, key) {
  if (!key.includes("->")) return row[key];
  const parts = key.split(/->>?/);
  return parts.reduce((v, p) => (v && typeof v === "object" ? v[p] : undefined), row);
}

function fakeWorld({ resendFail = false } = {}) {
  const world = { resendFail, resendN: 0 };
  const db = {
    leads: [], booking_holds: [], site_settings: [], lead_events: [], lifecycle_events: [],
    communications_testers: [{ phone: "+1 (440) 214-2915", active: true }, { phone: "440-821-7077", active: true }],
    trainers: [
      { id: "cbf54e9f-d68c-44ba-b6ad-d48549caca8e", slug: "lorenzo-miller", full_name: "Lorenzo Miller", market: "Cleveland, OH", state: "Ohio", headshot_url: "/x.jpg", status: "active", base_zip: "44128" },
      { id: "45875481-0bb3-420f-9add-6fdceb7efa51", slug: "daniel-bainbridge", full_name: "Daniel Bainbridge", market: "Crestview", state: "Florida", headshot_url: "/d.jpg", status: "active", base_zip: "32536" }
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
    await new Promise(resolve => setImmediate(resolve));
    const res = (status, data, text) => ({ ok: status < 400, status, text: async () => text ?? JSON.stringify(data), json: async () => data });
    if (u.host === "calendar.google.com") return res(200, null, `<html>${FAKE_KEY}</html>`);
    if (u.host === "calendar-pa.clients6.google.com") return res(200, null, JSON.stringify([[[[[String(SLOT_A)], 60]], [[[String(SLOT_B)], 60]]]]));
    if (u.host === "hook.us2.make.com") return res(200, null, "Accepted");
    if (u.host === "api.resend.com") {
      if (world.resendFail) return res(403, { name: "validation_error", message: "The lorenzosdogtrainingteam.com domain is not verified." });
      return res(200, { id: `re-test-${++world.resendN}` });
    }
    if (u.host !== "supabase.test") throw new Error(`unexpected host ${u.host}`);
    if (u.pathname === "/auth/v1/user") return res(401, { message: "no" });
    const table = u.pathname.replace("/rest/v1/", "");
    const rows = db[table];
    if (!rows) throw new Error(`unknown table ${table}`);
    const filters = [...u.searchParams].filter(([k]) => !["select", "order", "limit", "on_conflict"].includes(k));
    const match = row => filters.every(([k, v]) => {
      const [op, ...rest] = v.split(".");
      const val = rest.join(".");
      const cell = getPath(row, k);
      if (op === "eq") return String(cell) === val;
      if (op === "neq") return String(cell) !== val;
      if (op === "gte") return String(cell ?? "") >= val;
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
  return { db, calls, world };
}

function load() {
  for (const m of ["../lib/sandbox.js", "../lib/portal-auth.js", "../lib/booking.js", "../lib/office-email.js", "../lib/pipeline.js", "../api/booking-lead.js", "../api/booking.js", "../api/pipeline.js"]) delete require.cache[require.resolve(m)];
  process.env.LDTT_SANDBOX = "1";
  return { P: require("../lib/pipeline.js"), M: require("../lib/office-email.js"), pipelineApi: require("../api/pipeline.js"), bookingApi: require("../api/booking.js") };
}

async function call(handler, { method = "POST", body, query = {}, headers = {} } = {}) {
  const res = { statusCode: 0, payload: null, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.statusCode = c; return this; }, json(d) { this.payload = d; return this; }, send() { return this; }, end() { return this; } };
  await handler({ method, body, query, headers: { host: "ldtt-sandbox.vercel.app", ...headers } }, res);
  return res;
}

function contactLead(db, answer, over = {}) {
  const lead = {
    id: `aaaaaaaa-bbbb-4ccc-8ddd-${String(db.leads.length + 1).padStart(12, "0")}`, version: 1, created_at: new Date().toISOString(),
    first_name: "Joshua", last_name: "Proof", phone: "440-214-2915", email: `p${db.leads.length}@example.test`, zip: "44128", sms_consent: true,
    trainer_slug: null, comments: "Pulls on the leash", status: "new_inquiry", source_page: "contact.html", service_interest: answer,
    raw_payload: { source_page: "contact.html", i_want_to: answer, qa: "true" }, ...over
  };
  db.leads.push(lead);
  return lead;
}

const bookingBody = (leadId, slot = SLOT_A) => ({
  trainer_slug: "lorenzo-miller", slot_start: slot, lead_id: leadId, location: "training_center",
  client: { first_name: "Joshua", last_name: "Proof", phone: "440-214-2915", email: "proof@example.test", address: "1 Main St, Cleveland, OH 44128" },
  dogs: [
    { name: "Rex", sex: "Male", fixed: "Yes", vaccinated: "Yes", age: "2", breed: "Labrador", behavior: "Growls at visitors" },
    { name: "Bella", sex: "Female", fixed: "No", vaccinated: "Yes", age: "6 months", breed: "Beagle", behavior: "Jumps on guests" }
  ]
});

const resendCalls = calls => calls.filter(c => c.host === "api.resend.com");
const hooks = (calls, path) => calls.filter(c => c.host === "hook.us2.make.com" && c.path === path);
const noFormSubmit = calls => assert.equal(calls.filter(c => /formsubmit\.co/.test(c.host) || /form-delivery/.test(c.url)).length, 0, "the pipeline never touches FormSubmit");

// ---------------------------------------------------------------------------
// 1. FormSubmit: byte-for-byte + it still receives the post
// ---------------------------------------------------------------------------
const h = s => createHash("sha256").update(s).digest("hex").slice(0, 16);
const block = (s, a, b) => { const i = s.indexOf(a); const j = s.indexOf(b, i); assert.ok(i >= 0 && j > i, `block ${a}`); return s.slice(i, j); };

test("JOSHUA'S HARD RULE: the Contact page's FormSubmit submit is byte-for-byte the pre-step-3 code (1176038)", () => {
  const s = read("script.js");
  assert.equal(h(block(s, "const relayFormDeliveries=", "\n};\n")), "dc94a4b4502033b1", "relayFormDeliveries");
  assert.equal(h(block(s, "const contactForm=document.querySelector", "document.querySelectorAll('a[href=\"contact.html#form\"]')")), "14ed922c20ecc4f3", "the Contact handler");
  assert.equal(h(block(s, "window.LDTT_FORM_DELIVERY={", "};")), "392ac4bd96f241db", "the delivery object");
  assert.equal(h(block(s, "const submitEmailRelay=", "\n};\n")), "01e03717224c248b", "submitEmailRelay");
  assert.equal(h(block(s, "const wireAsyncForm=", "const relayFormDeliveries=")), "e262f739d5c5fe3c", "wireAsyncForm");
  assert.match(read("contact.html"), /<form class="panel form contact-intake" action="https:\/\/formsubmit\.co\/production@lorenzosdogtrainingteam\.com" method="POST"[^>]*data-email-endpoint="https:\/\/formsubmit\.co\/ajax\/production@lorenzosdogtrainingteam\.com">/);
  // The practice listener is separate, practice-only, and never posts to FormSubmit.
  const practice = block(s, "const enterPracticePipeline=", "const updateStoredDelivery=");
  assert.match(practice, /publicEnvironment\.then\(env=>\{\n  if\(!env\?\.sandbox\) return;/);
  assert.ok(!/formsubmit|form-delivery|relayFormDeliveries\(/i.test(practice));
});

test("FormSubmit still receives the post: relayFormDeliveries -> /api/form-delivery, and the browser retry to FormSubmit production@", async () => {
  const s = read("script.js");
  const code = [block(s, "const buildMailPayload=", "\n};\n") + "\n};", block(s, "const submitEmailRelay=", "\n};\n") + "\n};", block(s, "const relayFormDeliveries=", "\n};\n") + "\n};"].join("\n") + "\nthis.relay = relayFormDeliveries;";
  const posts = [];
  const sandbox = {
    FormData, URLSearchParams, JSON, Error, String, Object, Array, console,
    fetch: async (url, options = {}) => {
      posts.push({ url: String(url), body: options.body });
      if (String(url) === "/api/form-delivery") {
        const b = JSON.parse(options.body);
        return { ok: true, status: 200, json: async () => (b.client_delivery ? { ok: true } : { ok: true, deliveries: [{ destination: "google_sheet", status: "accepted" }, { destination: "formsubmit_email", status: "failed" }] }) };
      }
      return { ok: true, status: 200, text: async () => JSON.stringify({ success: "true" }) };
    }
  };
  vm.runInNewContext(code, sandbox);
  const entries = { first_name: "Jane", last_name: "Doe", email: "jane@example.test", i_want_to: "Schedule a virtual evaluation", comments: "Hi" };
  const result = await sandbox.relay("contact", entries, { lead_id: "l-1" }, { dataset: { emailEndpoint: "https://formsubmit.co/ajax/production@lorenzosdogtrainingteam.com" } });
  assert.equal(posts[0].url, "/api/form-delivery");
  assert.equal(JSON.parse(posts[0].body).form_type, "contact");
  assert.equal(posts[1].url, "https://formsubmit.co/ajax/production@lorenzosdogtrainingteam.com", "FormSubmit receives the post");
  assert.equal(posts[1].body.get("first_name"), "Jane");
  assert.equal(posts[1].body.get("_subject"), "New Lorenzo's Dog Training Team Contact Form Submission");
  assert.equal(JSON.parse(posts[2].body).client_delivery.status, "accepted");
  assert.equal(result.deliveries.find(d => d.destination === "formsubmit_email").via, "browser_fallback");
});

// ---------------------------------------------------------------------------
// 2 + 3. The office email: Resend only, queued without the key
// ---------------------------------------------------------------------------
test("no RESEND_API_KEY: the booking succeeds, the office email is QUEUED, nothing is sent by any path", async () => {
  delete process.env.RESEND_API_KEY;
  const { bookingApi, P } = load();
  const { db, calls } = fakeWorld();
  const lead = contactLead(db, "Schedule an in person evaluation with a trainer in my area");
  const res = await call(bookingApi, { body: bookingBody(lead.id) });
  assert.equal(res.statusCode, 200);
  const notice = db.leads[0].raw_payload.pipeline.booking_notices.at(-1);
  assert.equal(notice.office_email.status, "queued");
  assert.equal(notice.office_email.reason, "Office email waiting for the Resend key");
  assert.equal(db.leads[0].raw_payload.pipeline.office_email_pending, true);
  assert.equal(resendCalls(calls).length, 0);
  noFormSubmit(calls);
  const flush = await P.sendQueuedOfficeEmails();
  assert.equal(flush.resend_ready, false);
  assert.equal(flush.waiting, 1);
  assert.equal(resendCalls(calls).length, 0, "no key: the retry sends nothing either");
  assert.equal(await P.queuedOfficeEmailCount(), 1);
});

test("the key arrives: 'send queued' sends the saved email ONCE through Resend, to the practice test address, with everything the office needs", async () => {
  delete process.env.RESEND_API_KEY;
  let { bookingApi, P } = load();
  const { db, calls } = fakeWorld();
  const lead = contactLead(db, "Schedule an in person evaluation with a trainer in my area");
  assert.equal((await call(bookingApi, { body: bookingBody(lead.id) })).statusCode, 200);
  process.env.RESEND_API_KEY = "test-resend-key";
  process.env.RESEND_FROM = "Lorenzo's Dog Training Team <no-reply@lorenzosdogtrainingteam.com>";
  try {
    ({ P } = load());
    const flush = await P.sendQueuedOfficeEmails();
    assert.equal(flush.sent.length, 1);
    const sent = resendCalls(calls);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].url, "https://api.resend.com/emails");
    assert.equal(sent[0].headers.Authorization, "Bearer test-resend-key");
    assert.equal(sent[0].headers["Idempotency-Key"], `ldtt-booking-email-${lead.id}-${db.leads[0].raw_payload.booking.hold_id}`);
    assert.deepEqual(sent[0].body.to, ["marketing@lorenzosdogtrainingteam.com"], "practice copy: the one test address, never the office list by default");
    assert.equal(sent[0].body.from, "Lorenzo's Dog Training Team <no-reply@lorenzosdogtrainingteam.com>");
    const { html, text, subject } = sent[0].body;
    assert.match(subject, /^\[PRACTICE COPY\] Eval booked: Joshua Proof with Lorenzo Miller/);
    assert.ok(text.includes("Log this client into Alpha, then open the staff portal and mark this lead \"Added to Alpha\"."), "the Alpha instruction, word for word");
    for (const needle of ["Log this client into Alpha, then open the staff portal and mark this lead &quot;Added to Alpha&quot;.", `/staff?view=leads&amp;lead=${lead.id}`, "Lorenzo Miller", "Training center: 4815 Orchard Rd, Garfield Heights, OH 44128", "Joshua Proof", "440-214-2915", "proof@example.test", "1 Main St, Cleveland, OH 44128", "Rex", "Bella", "Labrador", "Beagle", "6 months", "Growls at visitors", "Jumps on guests", "Spayed/Neutered?", "Vaccinations up to date?", "Behavioral challenges", "Dog 2 of 2", "Schedule an in person evaluation with a trainer in my area", ...OFFICE]) {
      assert.ok(html.includes(needle), `html has ${needle}`);
    }
    assert.match(text, /Log this client into Alpha/);
    assert.match(text, new RegExp(`/staff\\?view=leads&lead=${lead.id}`));
    assert.match(text, /Booked time: /);
    const mail = db.leads[0].raw_payload.pipeline.booking_notices.at(-1).office_email;
    assert.equal(mail.status, "sent");
    assert.equal(mail.resend_id, "re-test-1");
    assert.equal(db.leads[0].raw_payload.pipeline.office_email_pending, false);
    const again = await P.sendQueuedOfficeEmails();
    assert.equal(again.sent.length, 0);
    assert.equal(resendCalls(calls).length, 1, "never twice");
    noFormSubmit(calls);
  } finally {
    delete process.env.RESEND_API_KEY; delete process.env.RESEND_FROM;
  }
});

test("with the key, a booking emails at once AND sends the older queued emails; clearing the test address sends to the office list", async () => {
  delete process.env.RESEND_API_KEY;
  let { bookingApi, P } = load();
  const { db, calls } = fakeWorld();
  const older = contactLead(db, "Schedule a virtual evaluation");
  assert.equal((await call(bookingApi, { body: bookingBody(older.id, SLOT_A) })).statusCode, 200);
  process.env.RESEND_API_KEY = "test-resend-key";
  try {
    ({ bookingApi, P } = load());
    await P.saveSettings({ recipients: [...OFFICE.map(email => ({ label: "x", email })), { label: "Angela", email: "" }], practice_trainer_phone: TESTER, practice_email_to: "" }, "Office Admin");
    const newer = contactLead(db, "Schedule a training session with my dog trainer");
    const res = await call(bookingApi, { body: bookingBody(newer.id, SLOT_B) });
    assert.equal(res.statusCode, 200);
    const sent = resendCalls(calls);
    assert.equal(sent.length, 2, "this booking + the one that was waiting");
    assert.deepEqual(sent[0].body.to, OFFICE);
    assert.equal(sent[0].body.html.includes("PRACTICE COPY"), true);
    assert.ok(db.leads.every(l => l.raw_payload.pipeline.booking_notices.at(-1).office_email.status === "sent"));
  } finally {
    delete process.env.RESEND_API_KEY;
  }
});

test("a Resend failure never breaks the booking; it is recorded, shown, and retried", async () => {
  process.env.RESEND_API_KEY = "test-resend-key";
  try {
    const { bookingApi, P } = load();
    const { db, calls, world } = fakeWorld({ resendFail: true });
    const lead = contactLead(db, "Schedule a virtual evaluation");
    const res = await call(bookingApi, { body: bookingBody(lead.id) });
    assert.equal(res.statusCode, 200);
    let mail = db.leads[0].raw_payload.pipeline.booking_notices.at(-1).office_email;
    assert.equal(mail.status, "failed");
    assert.match(mail.reason, /not verified/);
    assert.equal(db.leads[0].raw_payload.pipeline.office_email_pending, true);
    world.resendFail = false;
    const flush = await P.sendQueuedOfficeEmails();
    assert.equal(flush.sent.length, 1);
    mail = db.leads[0].raw_payload.pipeline.booking_notices.at(-1).office_email;
    assert.equal(mail.status, "sent");
    assert.ok(mail.attempts >= 2);
    assert.equal(resendCalls(calls).filter(c => c.body.to).length >= 2, true);
  } finally {
    delete process.env.RESEND_API_KEY;
  }
});

test("a rebooked lead only emails its CURRENT booking", async () => {
  delete process.env.RESEND_API_KEY;
  let { bookingApi, P } = load();
  const { db, calls } = fakeWorld();
  const lead = contactLead(db, "Schedule a virtual evaluation");
  assert.equal((await call(bookingApi, { body: bookingBody(lead.id, SLOT_A) })).statusCode, 200);
  assert.equal((await call(bookingApi, { body: bookingBody(lead.id, SLOT_B) })).statusCode, 200);
  process.env.RESEND_API_KEY = "test-resend-key";
  try {
    ({ P } = load());
    const flush = await P.sendQueuedOfficeEmails();
    assert.equal(flush.sent.length, 1);
    assert.equal(flush.superseded, 1);
    const notices = db.leads[0].raw_payload.pipeline.booking_notices;
    assert.equal(notices[0].office_email.status, "superseded");
    assert.equal(notices[1].office_email.status, "sent");
    assert.equal(resendCalls(calls).length, 1);
  } finally {
    delete process.env.RESEND_API_KEY;
  }
});

test("send_queued and the settings need an office login; settings report the Resend state", async () => {
  delete process.env.RESEND_API_KEY;
  const { pipelineApi, P } = load();
  const { calls } = fakeWorld();
  assert.equal((await call(pipelineApi, { body: { op: "send_queued" } })).statusCode, 403);
  assert.equal(resendCalls(calls).length, 0);
  assert.equal(P.defaultSettings().practice_email_to, "marketing@lorenzosdogtrainingteam.com");
  assert.equal(P.normalizeSettings({ recipients: [] }).value.practice_email_to, "marketing@lorenzosdogtrainingteam.com", "a row saved before 3b keeps the test address");
  assert.equal(P.normalizeSettings({ recipients: [], practice_email_to: "" }).value.practice_email_to, "");
  assert.equal(P.normalizeSettings({ recipients: [], practice_email_to: "nope" }).errors.length, 1);
});

// ---------------------------------------------------------------------------
// 4. Contact Us = Option C
// ---------------------------------------------------------------------------
test("lanes: the Contact Us answer picks the lane; ad pages and the Site Builder /contact page are handled", () => {
  const { P } = load();
  const lane = (answer, over = {}) => P.decideLane({ source_page: "contact.html", raw_payload: { source_page: "contact.html", i_want_to: answer }, ...over }).key;
  assert.equal(lane("Schedule an in person evaluation with a trainer in my area"), "booking");
  assert.equal(lane("Schedule a virtual evaluation"), "booking");
  assert.equal(lane("Schedule a training session with my dog trainer"), "booking");
  assert.equal(lane("Schedule a free phone consultation to receive more information"), "office_call");
  assert.equal(lane("Learn more about becoming a dog trainer"), "recruiting");
  assert.equal(lane(""), "office_follow_up");
  assert.equal(lane("Something else"), "office_follow_up");
  assert.equal(lane("  schedule a VIRTUAL evaluation "), "booking", "case and spaces do not matter");
  assert.equal(P.decideLane({ source_page: "site-page", raw_payload: { page_url: "https://ldtt-sandbox.vercel.app/contact", i_want_to: "Learn more about becoming a dog trainer" } }).key, "recruiting", "Site Builder /contact is Contact Us too");
  assert.equal(P.decideLane({ source_page: "dog-training-cleveland-oh.html", raw_payload: { source_page: "dog-training-cleveland-oh.html", i_want_to: "Schedule an online consultation" } }).key, "booking", "ad pages always book");
  assert.equal(P.decideLane({ source_page: "trainer landing page: Fred Harris", raw_payload: {} }).key, "booking");
  assert.equal(P.CONTACT_US_LANES.length, 5);
  assert.equal(P.normalizeLanes({ lanes: [{ answer: "Schedule a virtual evaluation", lane: "office_call" }, { answer: "x", lane: "made_up" }] }).length, 1, "an office override is read; unknown lanes are ignored");
});

test("phone consultation: customer-care text only through its own Make route, never the pathway 1 hook; lane logged; not on Sales", async () => {
  delete process.env.LDTT_MAKE_HOOK_CARE;
  let { pipelineApi } = load();
  const { db, calls } = fakeWorld();
  const a = contactLead(db, "Schedule a free phone consultation to receive more information");
  const r1 = await call(pipelineApi, { body: { op: "enter", lead_id: a.id } });
  assert.equal(r1.statusCode, 200);
  assert.equal(r1.payload.lane, "office_call");
  assert.equal(r1.payload.book_url, null);
  assert.equal(hooks(calls, "/testhookone").length, 0, "the booking-link text is never sent for this lane");
  const saved = db.leads[0];
  assert.equal(saved.raw_payload.pipeline.lane.key, "office_call");
  assert.match(saved.raw_payload.pipeline.care_text.reason, /LDTT_MAKE_HOOK_CARE is not set/);
  assert.equal(saved.raw_payload.sales_pipeline, undefined, "stays in the office's normal follow-up");
  assert.equal(saved.trainer_slug, null);
  process.env.LDTT_MAKE_HOOK_CARE = "https://hook.us2.make.com/testhookcare";
  try {
    ({ pipelineApi } = load());
    const b = contactLead(db, "Schedule a free phone consultation to receive more information");
    const noConsent = contactLead(db, "Schedule a free phone consultation to receive more information", { sms_consent: false });
    await call(pipelineApi, { body: { op: "enter", lead_id: b.id } });
    await call(pipelineApi, { body: { op: "enter", lead_id: noConsent.id } });
    const care = hooks(calls, "/testhookcare");
    assert.equal(care.length, 1, "one text, and none without SMS consent");
    assert.equal(care[0].body.phone, TESTER);
    assert.match(care[0].body.message, /Our office will call you shortly\./);
    assert.equal(hooks(calls, "/testhookone").length, 0);
    assert.equal(db.leads.find(l => l.id === b.id).raw_payload.pipeline.care_text.status, "sent");
    assert.match(db.leads.find(l => l.id === noConsent.id).raw_payload.pipeline.care_text.reason, /No SMS consent/);
    // The care route can never be the pathway 1 hook.
    process.env.LDTT_MAKE_HOOK_CARE = process.env.LDTT_MAKE_HOOK_PATHWAY1;
    assert.equal(load().P.careHookUrl(), "");
  } finally {
    delete process.env.LDTT_MAKE_HOOK_CARE;
  }
  noFormSubmit(calls);
});

test("recruiting and unknown answers: no client text; a Contact Us evaluation answer gets the booking-link text", async () => {
  const { pipelineApi } = load();
  const { db, calls } = fakeWorld();
  const recruit = contactLead(db, "Learn more about becoming a dog trainer");
  const blank = contactLead(db, "");
  const virtual = contactLead(db, "Schedule a virtual evaluation");
  for (const l of [recruit, blank, virtual]) assert.equal((await call(pipelineApi, { body: { op: "enter", lead_id: l.id } })).statusCode, 200);
  assert.equal(db.leads.find(l => l.id === recruit.id).raw_payload.pipeline.lane.key, "recruiting");
  assert.equal(db.leads.find(l => l.id === blank.id).raw_payload.pipeline.lane.key, "office_follow_up");
  const v = db.leads.find(l => l.id === virtual.id);
  assert.equal(v.raw_payload.pipeline.lane.key, "booking");
  assert.equal(v.raw_payload.sales_pipeline, true);
  const one = hooks(calls, "/testhookone");
  assert.equal(one.length, 1);
  assert.equal(one[0].body.lead_id, virtual.id);
});
