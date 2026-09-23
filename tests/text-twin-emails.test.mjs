// Email twins (Joshua 2026-09-21): "Every lead, Lorenzo needs an email at the same time the text is fired. Add that
// in the automation, with the trainer's email used in the portal." Against a fake Supabase, a fake Make and a fake
// Resend (global fetch replaced), for LIVE (LDTT_SANDBOX unset) and the PRACTICE COPY (LDTT_SANDBOX=1):
//   - every Operations text also goes out as an email with the SAME words + the portal lead link, through Resend,
//     to Settings -> operations_email on live (default lorenzo@) and ONLY to practice_email_to on the practice copy;
//   - the email still goes when the text is skipped (no Operations phone, Make address not set);
//   - every trainer text also goes out as an email to the trainer's PORTAL LOGIN email on live (active portal_users
//     row with role trainer), else trainers.email, else skipped "trainer has no portal email"; practice copy:
//     practice_email_to only;
//   - Resend idempotency key `${leadId}:${kind}` (+ `:${hold}` for a booking); the same claimed step never sends twice;
//   - the practice copy never emails a real address.
// NOT deployed (tests/ is in .vercelignore). Nothing here talks to the real project, Make or Resend.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
process.env.SUPABASE_URL = "http://supabase.test";
delete process.env.LDTT_PRACTICE_ORIGIN;
const HOOKS = {
  LDTT_MAKE_HOOK_PATHWAY1: "https://hook.us2.make.com/twinhookone",
  LDTT_MAKE_HOOK_PATHWAY2: "https://hook.us2.make.com/twinhooktwo",
  LDTT_MAKE_HOOK_OPS: "https://hook.us2.make.com/twinhookops"
};
Object.assign(process.env, HOOKS);
const require = createRequire(import.meta.url);
const read = path => readFileSync(resolve(import.meta.dirname, "..", path), "utf8");

const TESTER = "+14402142915";
const LORENZO_PHONE = "+12165550111"; // fake
const TRAINER_PHONE = "+13305550123"; // fake
const LORENZO_EMAIL = "production@lorenzosdogtrainingteam.com, lorenzo@lorenzosdogtrainingteam.com"; // the default in lib/pipeline.js: the office inbox AND Lorenzo
const PRACTICE_TO = "practice-test@example.test"; // fake practice test address
const TRAINER_LOGIN = "trainer.login@example.test"; // fake portal login email
const TRAINER_ROW_EMAIL = "trainer.row@example.test"; // fake trainers.email
const T1 = "cbf54e9f-d68c-44ba-b6ad-d48549caca8e";
const T2 = "45875481-0bb3-420f-9add-6fdceb7efa51";
const T3 = "7a1c8a2e-1111-4222-8333-444455556666";
const LEAD_ID = "00000000-0000-4000-8000-0000000000aa";
const REAL = [LORENZO_EMAIL, TRAINER_LOGIN, TRAINER_ROW_EMAIL, "portal.admin@example.test", "old.login@example.test"];

function fakeWorld(settings = {}, { resendFail = false } = {}) {
  const db = {
    communications_testers: [{ phone: TESTER, active: true }],
    communications_settings: [],
    trainers: [
      { id: T1, slug: "lorenzo-miller", full_name: "Lorenzo Miller", phone: TRAINER_PHONE, email: TRAINER_ROW_EMAIL, status: "active" },
      { id: T2, slug: "daniel-bainbridge", full_name: "Daniel Bainbridge", phone: null, email: TRAINER_ROW_EMAIL, status: "active" },
      { id: T3, slug: "no-email", full_name: "Nora Noemail", phone: TRAINER_PHONE, email: null, status: "active" }
    ],
    portal_users: [
      { email: "old.login@example.test", role: "trainer", active: false, trainer_id: T1 },
      { email: "portal.admin@example.test", role: "admin", active: true, trainer_id: T1 },
      { email: TRAINER_LOGIN, role: "trainer", active: true, trainer_id: T1 }
    ],
    site_settings: [{ key: "pipeline_office_emails", value: { recipients: [], practice_trainer_phone: TESTER, practice_operations_phone: TESTER, practice_email_to: PRACTICE_TO, ...settings } }],
    leads: []
  };
  const calls = [];
  let resendN = 0;
  global.fetch = async (url, options = {}) => {
    const u = new URL(String(url));
    let body = options.body;
    if (typeof body === "string") { try { body = JSON.parse(body); } catch { /* text */ } }
    calls.push({ host: u.host, path: u.pathname, url: String(url), method: options.method || "GET", headers: options.headers || {}, body });
    const res = (status, data) => ({ ok: status < 400, status, text: async () => JSON.stringify(data), json: async () => data });
    if (u.host === "hook.us2.make.com") return res(200, "Accepted");
    if (u.host === "api.resend.com") return resendFail ? res(403, { message: "domain is not verified" }) : res(200, { id: `re-twin-${++resendN}` });
    if (u.host !== "supabase.test") throw new Error(`unexpected host ${u.host}`);
    const table = u.pathname.replace("/rest/v1/", "");
    const rows = db[table] || [];
    const filter = row => [...u.searchParams].every(([k, v]) => {
      if (["select", "limit", "order", "on_conflict"].includes(k)) return true;
      const m = v.match(/^eq\.(.*)$/);
      return m ? String(row[k]) === m[1] : true;
    });
    const method = options.method || "GET";
    if (method === "GET") return res(200, rows.filter(filter).map(r => JSON.parse(JSON.stringify(r))));
    if (method === "PATCH") {
      const hit = rows.filter(filter);
      hit.forEach(r => { Object.assign(r, JSON.parse(JSON.stringify(body))); if (table === "leads") r.version = (r.version || 1) + 1; });
      return res(200, hit.map(r => JSON.parse(JSON.stringify(r))));
    }
    if (method === "POST") { rows.push(body); return res(201, [body]); }
    return res(405, []);
  };
  return { db, calls };
}

function load(sandbox) {
  if (sandbox) process.env.LDTT_SANDBOX = "1"; else delete process.env.LDTT_SANDBOX;
  for (const key of Object.keys(require.cache)) if (/\/lib\/(pipeline|booking|sandbox|pipeline-texts|office-email)\.js$/.test(key)) delete require.cache[key];
  return require("../lib/pipeline.js");
}

const hookPosts = (calls, hook) => calls.filter(c => c.host === "hook.us2.make.com" && c.url.endsWith(hook)).map(c => c.body);
const twinEmails = calls => calls.filter(c => c.host === "api.resend.com").map(c => ({ ...c.body, key: c.headers["Idempotency-Key"] }));
const allRecipients = calls => twinEmails(calls).flatMap(e => e.to);

function withKey(fn) {
  return async () => {
    process.env.RESEND_API_KEY = "test-resend-key";
    try { await fn(); } finally { delete process.env.RESEND_API_KEY; }
  };
}

const opsFields = { client_name: "Pat Client", zip: "44118", problem: "pulling", source: "Ad page 2.0: Cleveland", next_step: "Booking link texted.", link: `https://lorenzosdogtrainingteam.com/staff?view=leads&lead=${LEAD_ID}` };
const lead = {
  id: LEAD_ID, version: 1, first_name: "Pat", last_name: "Client", phone: "+14405550199", sms_consent: true, zip: "44118",
  trainer_id: T1, trainer_slug: "lorenzo-miller", assigned_trainer_name: "Lorenzo Miller",
  raw_payload: { pipeline: { entered_at: "2026-09-21T12:00:00.000Z" }, booking: { trainer_slug: "lorenzo-miller", trainer_name: "Lorenzo Miller", slot_start: "2026-10-01T14:00:00.000Z", client: { first_name: "Pat", last_name: "Client", phone: "+14405550199", address: "1 Main St" }, dogs: [{ name: "Rex", behavior: "pulling" }], pre_eval: { rows: [["Age?", "3"]], flags: [] } } }
};
const booking = { hold_id: "hold-1", slot_start: "2026-10-01T14:00:00.000Z", trainer_slug: "lorenzo-miller", trainer_name: "Lorenzo Miller", location: "in_home", client: lead.raw_payload.booking.client, dogs: lead.raw_payload.booking.dogs };

test("live: the Operations text and its email fire together with the SAME words, to Lorenzo's email, idempotency key present", withKey(async () => {
  const { calls } = fakeWorld({ operations_phone: LORENZO_PHONE });
  const P = load(false);
  const r = await P.sendOpsAlert("new_lead", opsFields, { leadId: LEAD_ID });
  assert.equal(r.status, "sent", r.reason);
  const [post] = hookPosts(calls, "twinhookops");
  assert.equal(post.operations_phone, LORENZO_PHONE);
  assert.ok(post.message && post.message.includes("Pat Client"));
  assert.equal(r.email.status, "sent", r.email.reason);
  assert.equal(r.email.resend_id, "re-twin-1");
  assert.equal(r.email.to_masked, "pr***@lorenzosdogtrainingteam.com, lo***@lorenzosdogtrainingteam.com", "production@ AND Lorenzo");
  const [mail] = twinEmails(calls);
  assert.deepEqual(mail.to, LORENZO_EMAIL.split(",").map(x => x.trim()), "one email, both office addresses");
  assert.equal(mail.subject, "Track 500 · New lead: Pat Client");
  assert.ok(mail.text.startsWith(post.message), "the email carries the exact words of the text");
  assert.match(mail.text, new RegExp(`Open the lead in the portal: https://lorenzosdogtrainingteam\\.com/staff\\?view=leads&lead=${LEAD_ID}`));
  assert.equal(mail.key, `${LEAD_ID}:ops_new_lead`);
  assert.ok(!/PRACTICE COPY/.test(mail.subject + mail.text));
}));

test("live: the Operations email still goes when the text is skipped (no Operations phone; Make address not set)", withKey(async () => {
  {
    const { calls } = fakeWorld(); // no operations_phone saved
    const P = load(false);
    const r = await P.sendOpsAlert("eval_booked", { client_name: "Pat Client", trainer_name: "Lorenzo Miller", appointment_day: "Thursday", appointment_date: "October 1, 2026", appointment_time: "10:00 AM EDT", link: "x" }, { leadId: LEAD_ID, holdId: "hold-9" });
    assert.equal(r.status, "skipped");
    assert.match(r.reason, /No Operations phone on live/);
    assert.equal(hookPosts(calls, "twinhookops").length, 0, "no text");
    assert.equal(r.email.status, "sent", r.email.reason);
    const [mail] = twinEmails(calls);
    assert.deepEqual(mail.to, LORENZO_EMAIL.split(",").map(x => x.trim()), "one email, both office addresses");
    assert.equal(mail.subject, "Track 500 · Evaluation booked: Pat Client");
    assert.equal(mail.key, `${LEAD_ID}:ops_eval_booked:hold-9`, "a rebooking is a new booking: its hold is in the key");
    assert.match(mail.text, /Pat Client/);
  }
  {
    delete process.env.LDTT_MAKE_HOOK_OPS;
    try {
      const { calls } = fakeWorld({ operations_phone: LORENZO_PHONE, operations_email: "ops.custom@example.test" });
      const P = load(false);
      const r = await P.sendOpsAlert("new_lead", opsFields, { leadId: LEAD_ID });
      assert.equal(r.status, "skipped");
      assert.match(r.reason, /Operations Make address is not set/);
      assert.equal(r.email.status, "sent");
      assert.deepEqual(twinEmails(calls)[0].to, ["ops.custom@example.test"], "the saved Settings box wins over the default");
    } finally {
      process.env.LDTT_MAKE_HOOK_OPS = HOOKS.LDTT_MAKE_HOOK_OPS;
    }
  }
  {
    const { calls } = fakeWorld({ operations_email: "" });
    const P = load(false);
    const r = await P.sendOpsAlert("new_lead", opsFields, { leadId: LEAD_ID });
    assert.equal(r.email.status, "skipped");
    assert.match(r.email.reason, /No Operations email on live is saved in Settings \(operations_email\)/);
    assert.equal(twinEmails(calls).length, 0);
  }
}));

test("practice copy: the Operations email goes ONLY to practice_email_to, never Lorenzo; none saved -> skipped", withKey(async () => {
  {
    const { calls } = fakeWorld({ operations_phone: LORENZO_PHONE, operations_email: LORENZO_EMAIL });
    const P = load(true);
    const r = await P.sendOpsAlert("new_lead", opsFields, { leadId: LEAD_ID });
    assert.equal(r.status, "sent", r.reason);
    assert.equal(hookPosts(calls, "twinhookops")[0].operations_phone, TESTER);
    assert.equal(r.email.status, "sent");
    const [mail] = twinEmails(calls);
    assert.deepEqual(mail.to, [PRACTICE_TO]);
    assert.match(mail.subject, /^\[PRACTICE COPY\] Track 500 · New lead: Pat Client$/);
    assert.ok(mail.text.includes(hookPosts(calls, "twinhookops")[0].message));
  }
  {
    const { calls } = fakeWorld({ practice_email_to: "" });
    const P = load(true);
    const r = await P.sendOpsAlert("new_lead", opsFields, { leadId: LEAD_ID });
    assert.equal(r.email.status, "skipped");
    assert.match(r.email.reason, /no practice test address/);
    assert.equal(twinEmails(calls).length, 0);
  }
  // The helper itself refuses any other address on the practice copy (fail closed).
  fakeWorld();
  const P = load(true);
  const refused = await P.sendTextTwinEmail({ to: LORENZO_EMAIL, subject: "x", words: "y", leadId: LEAD_ID, kind: "ops_new_lead", settings: { practice_email_to: PRACTICE_TO } });
  assert.equal(refused.status, "skipped");
  assert.match(refused.reason, /only to the practice test address/);
}));

test("live: the trainer email goes to the trainer's PORTAL LOGIN email (active, role trainer) with the same words as the text", withKey(async () => {
  const { calls } = fakeWorld();
  const P = load(false);
  const r = await P.sendNewInquiryText({ lead, trainer: { id: T1, slug: "lorenzo-miller", full_name: "Lorenzo Miller" }, bookUrl: "https://lorenzosdogtrainingteam.com/book/lorenzo-miller?lead=1" });
  assert.equal(r.status, "sent", r.reason);
  const [post] = hookPosts(calls, "twinhooktwo");
  assert.equal(post.trainer_phone, TRAINER_PHONE);
  assert.equal(r.email.status, "sent", r.email.reason);
  const [mail] = twinEmails(calls);
  assert.deepEqual(mail.to, [TRAINER_LOGIN], "the active trainer login, not the inactive one, the admin row or trainers.email");
  assert.equal(mail.subject, "Track 500 · New inquiry: Pat Client");
  assert.ok(mail.text.startsWith(post.trainer_message), "same words as the trainer text");
  assert.equal(mail.key, `${LEAD_ID}:trainer_new_inquiry`);
  const pick = await P.trainerEmailFor(lead, { id: T1 }, {});
  assert.deepEqual(pick, { ok: true, email: TRAINER_LOGIN, source: "portal_users", reason: "" });
}));

test("live: no portal login -> trainers.email; nothing at all -> skipped 'trainer has no portal email'; the email goes even when the text is skipped", withKey(async () => {
  const { calls } = fakeWorld();
  const P = load(false);
  // Daniel has no phone (text skipped) and no portal login: the email falls back to trainers.email and still goes.
  const d = await P.sendNewInquiryText({ lead: { ...lead, trainer_id: T2, trainer_slug: "daniel-bainbridge" }, trainer: { id: T2, slug: "daniel-bainbridge", full_name: "Daniel Bainbridge" }, bookUrl: "https://x/book/daniel-bainbridge?lead=1" });
  assert.equal(d.status, "skipped");
  assert.match(d.reason, /trainer has no phone on file/);
  assert.equal(d.email.status, "sent", d.email.reason);
  assert.deepEqual(twinEmails(calls).at(-1).to, [TRAINER_ROW_EMAIL]);
  // Nora has no login and no trainers.email.
  const n = await P.sendNewInquiryText({ lead: { ...lead, trainer_id: T3, trainer_slug: "no-email" }, trainer: { id: T3, slug: "no-email", full_name: "Nora Noemail" }, bookUrl: "https://x" });
  assert.equal(n.status, "sent", "her text still goes");
  assert.equal(n.email.status, "skipped");
  assert.match(n.email.reason, /trainer has no portal email \(Nora Noemail\)/);
  assert.equal(twinEmails(calls).length, 1);
  // Unrouted lead: no trainer, no text, no email.
  const u = await P.sendNewInquiryText({ lead, trainer: null, bookUrl: null });
  assert.equal(u.email.status, "skipped");
  // Make not set: the trainer text is skipped, the email still goes.
  delete process.env.LDTT_MAKE_HOOK_PATHWAY2;
  try {
    const P2 = load(false);
    const before = twinEmails(calls).length;
    const pre = await P2.sendPreEvalTexts({ lead });
    assert.equal(pre.status, "skipped");
    assert.match(pre.reason, /pathway 2 address is not set/);
    assert.equal(pre.email.status, "sent");
    assert.equal(twinEmails(calls).length, before + 1);
    assert.deepEqual(twinEmails(calls).at(-1).to, [TRAINER_LOGIN]);
    assert.equal(twinEmails(calls).at(-1).subject, "Track 500 · Pre-evaluation answers: Pat Client");
    assert.equal(twinEmails(calls).at(-1).key, `${LEAD_ID}:pre_eval_answers`);
  } finally {
    process.env.LDTT_MAKE_HOOK_PATHWAY2 = HOOKS.LDTT_MAKE_HOOK_PATHWAY2;
  }
}));

test("practice copy: every trainer email goes to practice_email_to only; the real trainer login is never emailed", withKey(async () => {
  const { calls } = fakeWorld();
  const P = load(true);
  const trainer = { id: T1, slug: "lorenzo-miller", full_name: "Lorenzo Miller" };
  const a = await P.sendNewInquiryText({ lead, trainer, bookUrl: "https://x" });
  const b = await P.sendBookingTexts({ lead, booking, trainer, setting: { slug: "lorenzo-miller", time_zone: "America/New_York" }, settings: await P.loadSettings() });
  const c = await P.sendPreEvalTexts({ lead });
  const d = await P.sendEvalCompletedTexts({ lead });
  for (const r of [a, b, c, d]) assert.equal(r.email.status, "sent", JSON.stringify(r.email));
  const mails = twinEmails(calls);
  assert.equal(mails.length, 4);
  assert.deepEqual([...new Set(allRecipients(calls))], [PRACTICE_TO]);
  assert.ok(!REAL.some(email => JSON.stringify(calls).includes(email)), "no real address leaves the fake DB on the practice copy");
  assert.deepEqual(mails.map(m => m.key), [`${LEAD_ID}:trainer_new_inquiry`, `${LEAD_ID}:trainer_new_eval:hold-1`, `${LEAD_ID}:pre_eval_answers`, `${LEAD_ID}:trainer_log_deal`]);
  const trainerPost = hookPosts(calls, "twinhooktwo")[1];
  assert.ok(mails[1].text.includes(trainerPost.trainer_message), "the booking email twin carries the trainer_new_eval words");
  assert.ok(mails.every(m => /^\[PRACTICE COPY\] Track 500 · /.test(m.subject)));
  // No practice address saved: skipped, nothing sent.
  const w = fakeWorld({ practice_email_to: "" });
  const P2 = load(true);
  const none = await P2.sendPreEvalTexts({ lead });
  assert.equal(none.email.status, "skipped");
  assert.equal(twinEmails(w.calls).length, 0);
}));

test("no double sends: a second afterBooking on the same hold sends no second text or email; records land on the pipeline record", withKey(async () => {
  const { db, calls } = fakeWorld({ operations_phone: LORENZO_PHONE });
  db.leads.push(JSON.parse(JSON.stringify(lead)));
  const P = load(false);
  const trainer = { id: T1, slug: "lorenzo-miller", full_name: "Lorenzo Miller" };
  const first = await P.afterBooking({ lead: db.leads[0], booking, trainer, setting: { slug: "lorenzo-miller", time_zone: "America/New_York" } });
  assert.equal(first.texts.status, "sent");
  const mails = twinEmails(calls);
  // GO-LIVE 2026-09-23: the office booking email sends on live too (once, its own idempotency key).
  assert.deepEqual(mails.map(m => m.key).sort(), [`${LEAD_ID}:ops_eval_booked:hold-1`, `${LEAD_ID}:trainer_new_eval:hold-1`, `ldtt-booking-email-${LEAD_ID}-hold-1`].sort());
  const p = db.leads[0].raw_payload.pipeline;
  for (const rec of [p.ops_eval_booked_email, p.trainer_new_eval_email, p.booking_notices[0].ops_alert_email, p.booking_notices[0].trainer_email]) {
    assert.equal(rec.status, "sent");
    assert.ok(rec.at && rec.to_masked && rec.resend_id);
  }
  assert.equal("email" in p.booking_notices[0].texts, false, "the text record stays a text record");
  assert.equal("email" in p.booking_notices[0].ops_alert, false);
  const again = await P.afterBooking({ lead: db.leads[0], booking, trainer, setting: null });
  assert.match(again.texts.reason, /Already handled/);
  assert.equal(twinEmails(calls).length, 3, "never twice");
  assert.equal(hookPosts(calls, "twinhookops").length, 1);

  // afterPreEval / afterEvalCompleted record <kind>_email (their callers hold the first_submitted_at / version claims).
  await P.afterPreEval({ lead: db.leads[0] });
  await P.afterEvalCompleted({ lead: db.leads[0] });
  const q = db.leads[0].raw_payload.pipeline;
  assert.equal(q.pre_eval_answers_email.status, "sent");
  assert.equal(q.trainer_log_deal_email.status, "sent");
  assert.equal(q.pre_eval_answers_email.to_masked, "tr***@example.test");
  assert.equal("email" in q.pre_eval_text, false);
  const src = read("lib/pipeline.js");
  assert.match(src, /ops_new_lead_email: opsNewEmail/);
  assert.match(src, /trainer_new_inquiry_email: inquiryEmail/);
  assert.match(read("api/booking.js"), /if \(firstTime\) \{\s*await P\.afterPreEval/);
}));

test("no Resend key: the email is recorded as skipped (waiting for the key), the text is unaffected", async () => {
  delete process.env.RESEND_API_KEY;
  const { calls } = fakeWorld({ operations_phone: LORENZO_PHONE });
  const P = load(false);
  const r = await P.sendOpsAlert("new_lead", opsFields, { leadId: LEAD_ID });
  assert.equal(r.status, "sent");
  assert.equal(r.email.status, "skipped");
  assert.match(r.email.reason, /Resend key/);
  assert.equal(twinEmails(calls).length, 0);
});

test("a Resend failure is recorded with its reason and never breaks the text", withKey(async () => {
  const { calls } = fakeWorld({ operations_phone: LORENZO_PHONE }, { resendFail: true });
  const P = load(false);
  const r = await P.sendOpsAlert("new_lead", opsFields, { leadId: LEAD_ID });
  assert.equal(r.status, "sent");
  assert.equal(r.email.status, "failed");
  assert.match(r.email.reason, /not verified/);
  assert.equal(hookPosts(calls, "twinhookops").length, 1);
}));

test("settings: operations_email defaults to production@ and Lorenzo, is validated, and the portal box sits next to the live Operations phone", () => {
  fakeWorld();
  const P = load(false);
  assert.equal(P.DEFAULT_OPERATIONS_EMAIL, LORENZO_EMAIL);
  assert.equal(P.defaultSettings().operations_email, LORENZO_EMAIL);
  assert.equal(P.normalizeSettings({}).value.operations_email, LORENZO_EMAIL, "a row saved before the box existed gets the default");
  assert.equal(P.normalizeSettings({ operations_email: " Ops@Example.Test " }).value.operations_email, "ops@example.test");
  assert.equal(P.normalizeSettings({ operations_email: "" }).value.operations_email, "");
  assert.equal(P.normalizeSettings({ operations_email: "nope" }).errors.length, 1);
  const app = read("trainer-backoffice/app.js");
  const at = app.indexOf("data-pipeline-live-ops-phone value=");
  const box = app.indexOf("Operations email on live (Lorenzo)");
  assert.ok(at > 0 && box > at && box - at < 400, "the email box follows the Operations phone on live box");
  assert.match(app, /data-pipeline-live-ops-email value="\$\{escapeHtml\(s\.operations_email \|\| ""\)\}"/);
  assert.match(app, /operations_email: liveOpsEmail/);
  const src = read("lib/pipeline.js");
  assert.match(src, /if \(payload\.stage === "closed"\) return \{ \.\.\.payload, message: T\.render\(words\("ops_closed"\), payload\) \};/, "the closed Operations text has words for its twin once switched on");
  assert.equal((src.match(/async function sendTextTwinEmail\(/g) || []).length, 1, "one email helper");
  assert.equal(/formsubmit|form-delivery/i.test(src.slice(src.indexOf("// Email twins"), src.indexOf("// Operations alert (Joshua 2026-09-12)"))), false, "Resend only (rule 73)");
});
