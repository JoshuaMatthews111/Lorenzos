// Rule 95: "real trainer numbers" on the practice copy (Joshua 2026-09-22: "Make it fully ready for testing
// everything real in the sandbox with real trainer numbers, and still allow me to edit roles if necessary or type
// a number.").
//
// Against a fake Supabase + a fake Make + a fake Resend (global fetch replaced):
//   switch OFF  -> exactly today's behaviour: trainer texts to the ONE tester phone in Settings, trainer and
//                  Operations emails to the practice test address, Operations texts to practice_operations_phone.
//   switch ON   -> trainer texts to the trainer's OWN trainers.phone, trainer emails to their portal login,
//                  Operations to operations_phone / operations_email when filled in (else the practice boxes),
//                  and the CLIENT text is still refused unless the phone is an ACTIVE tester.
//   override    -> practice_trainer_override_phone beats both, switch on or off.
//   every number the practice copy texts this way is written back as an ACTIVE communications_testers row.
//   LIVE (LDTT_SANDBOX unset) is untouched by the switch, whatever the saved row says.
// NOT deployed (tests/ is in .vercelignore). Nothing here talks to the real project, Make or Resend.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
process.env.SUPABASE_URL = "http://supabase.test";
process.env.LDTT_MAKE_HOOK_PATHWAY1 = "https://hook.us2.make.com/realnumbershookone";
process.env.LDTT_MAKE_HOOK_PATHWAY2 = "https://hook.us2.make.com/realnumbershooktwo";
process.env.LDTT_MAKE_HOOK_OPS = "https://hook.us2.make.com/realnumbershookops";
process.env.RESEND_API_KEY = "test-resend-key";
const require = createRequire(import.meta.url);
const read = path => readFileSync(resolve(import.meta.dirname, "..", path), "utf8");

const TESTER = "+14402142915"; // the practice tester phone in the settings box
const OVERRIDE = "+14405550777"; // "send every trainer text to this number instead"
const TRAINER_REAL = "+13305550123"; // the assigned trainer's own phone (fake)
const LORENZO = "+12165550111"; // Operations phone on live (fake)
const STRANGER = "+14405550199"; // a lead's phone that is NOT a tester
const T1 = "cbf54e9f-d68c-44ba-b6ad-d48549caca8e";
const T2 = "45875481-0bb3-420f-9add-6fdceb7efa51";
const PRACTICE_INBOX = "production@lorenzosdogtrainingteam.com";
const TRAINER_LOGIN = "trainer.one@example.com";

function fakeWorld({ settings = {}, testers = [{ phone: TESTER, active: true }] } = {}) {
  const db = {
    communications_testers: testers.map(t => ({ id: `id-${t.phone}`, ...t })),
    trainers: [
      { id: T1, slug: "lorenzo-miller", full_name: "Lorenzo Miller", phone: TRAINER_REAL, email: "roster.one@example.com", status: "active" },
      { id: T2, slug: "daniel-bainbridge", full_name: "Daniel Bainbridge", phone: null, email: null, status: "active" }
    ],
    portal_users: [{ trainer_id: T1, role: "trainer", active: true, email: TRAINER_LOGIN, created_at: "2026-01-01T00:00:00Z" }],
    site_settings: [{
      key: "pipeline_office_emails",
      value: { recipients: [], practice_trainer_phone: TESTER, practice_operations_phone: TESTER, practice_email_to: PRACTICE_INBOX, ...settings }
    }],
    leads: []
  };
  const calls = [];
  global.fetch = async (url, options = {}) => {
    const u = new URL(String(url));
    let body = options.body;
    if (typeof body === "string") { try { body = JSON.parse(body); } catch { /* text */ } }
    calls.push({ host: u.host, path: u.pathname, url: String(url), method: options.method || "GET", body });
    const res = (status, data) => ({ ok: status < 400, status, text: async () => JSON.stringify(data), json: async () => data });
    if (u.host === "hook.us2.make.com") return res(200, "Accepted");
    if (u.host === "api.resend.com") return res(200, { id: "fake-resend-id" });
    const table = u.pathname.replace("/rest/v1/", "");
    const rows = db[table] || [];
    const filter = row => [...u.searchParams].every(([k, v]) => {
      if (["select", "limit", "order", "on_conflict"].includes(k)) return true;
      const m = v.match(/^eq\.(.*)$/);
      return m ? String(row[k]) === m[1] : true;
    });
    if ((options.method || "GET") === "GET") return res(200, rows.filter(filter));
    if (options.method === "PATCH") { const hit = rows.filter(filter); hit.forEach(r => Object.assign(r, body)); return res(200, hit); }
    if (options.method === "POST") { rows.push(body); return res(201, [body]); }
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
const testerRows = db => db.communications_testers.map(r => ({ phone: r.phone, active: r.active !== false }));

const lead = {
  id: "00000000-0000-4000-8000-000000000095", first_name: "Pat", last_name: "Client", phone: STRANGER, sms_consent: true,
  trainer_id: T1, trainer_slug: "lorenzo-miller", assigned_trainer_name: "Lorenzo Miller",
  raw_payload: { booking: { trainer_slug: "lorenzo-miller", trainer_name: "Lorenzo Miller", slot_start: "2026-10-01T14:00:00.000Z", client: { first_name: "Pat", last_name: "Client", phone: STRANGER, address: "1 Main St" }, dogs: [{ name: "Rex", behavior: "pulling" }], pre_eval: { rows: [["Age?", "3"]], flags: [] } } }
};
const booking = { hold_id: "h95", slot_start: "2026-10-01T14:00:00.000Z", trainer_slug: "lorenzo-miller", trainer_name: "Lorenzo Miller", location: "in_home", client: lead.raw_payload.booking.client, dogs: lead.raw_payload.booking.dogs };
const trainerNoPhoneCol = { id: T1, slug: "lorenzo-miller", full_name: "Lorenzo Miller" }; // what lib/booking trainerRow returns

test("the switch is a real setting: off by default, kept off for a row saved before it existed, and never on live", () => {
  fakeWorld();
  const P = load(true);
  assert.equal(P.defaultSettings().practice_real_numbers, false);
  assert.equal(P.defaultSettings().practice_trainer_override_phone, "");
  assert.equal(P.normalizeSettings({}).value.practice_real_numbers, false, "a row saved before the switch stays off");
  assert.equal(P.normalizeSettings({ practice_real_numbers: true }).value.practice_real_numbers, true);
  assert.equal(P.normalizeSettings({ practice_real_numbers: "yes" }).value.practice_real_numbers, false, "only a real true turns it on");
  assert.equal(P.normalizeSettings({ practice_trainer_override_phone: "440-555-0777" }).value.practice_trainer_override_phone, OVERRIDE);
  assert.equal(P.normalizeSettings({ practice_trainer_override_phone: "12" }).errors.length, 1, "10 digits or an error");
  assert.equal(P.practiceRealNumbers({ practice_real_numbers: true }), true);
  const L = load(false);
  assert.equal(L.practiceRealNumbers({ practice_real_numbers: true }), false, "live ignores the switch entirely");
  assert.equal(L.trainerOverridePhone({ practice_trainer_override_phone: OVERRIDE }), "", "live ignores the override entirely");
});

test("switch OFF: today's behaviour, byte for byte - tester phone for the trainer, practice inbox for both emails", async () => {
  const { calls, db } = fakeWorld();
  const P = load(true);
  const settings = await P.loadSettings();
  assert.equal(settings.practice_real_numbers, false);
  const out = await P.sendBookingTexts({ lead, booking, trainer: trainerNoPhoneCol, setting: null, settings });
  assert.equal(out.status, "sent", out.reason);
  const [post] = hookPosts(calls, "realnumbershooktwo");
  assert.equal(post.trainer_phone, TESTER, "the one tester phone in Settings");
  assert.equal(post.customer_phone, "", "the lead's phone is not a tester: dropped");
  assert.ok(!JSON.stringify(calls.filter(c => c.host !== "supabase.test")).includes(TRAINER_REAL), "the real trainer phone never leaves the database");
  const ops = await P.sendOpsAlert("new_lead", { client_name: "Pat Client" }, { leadId: lead.id });
  assert.equal(ops.status, "sent", ops.reason);
  assert.equal(hookPosts(calls, "realnumbershookops")[0].operations_phone, TESTER);
  assert.deepEqual(await P.trainerEmailFor(lead, trainerNoPhoneCol, settings), { ok: true, email: PRACTICE_INBOX, source: "practice_email_to", reason: "" });
  assert.deepEqual(P.opsEmailFor(settings), { ok: true, email: PRACTICE_INBOX, reason: "" });
  assert.deepEqual(testerRows(db), [{ phone: TESTER, active: true }], "nothing new is registered while the switch is off");
});

test("switch ON: the trainer's own phone and portal login, Operations on the live boxes, and every number registered as an active tester", async () => {
  const { calls, db } = fakeWorld({ settings: { practice_real_numbers: true, operations_phone: LORENZO, operations_email: "lorenzo@example.com" } });
  const P = load(true);
  const settings = await P.loadSettings();
  assert.equal(settings.practice_real_numbers, true);

  const out = await P.sendBookingTexts({ lead, booking, trainer: trainerNoPhoneCol, setting: null, settings });
  assert.equal(out.status, "sent", out.reason);
  const [post] = hookPosts(calls, "realnumbershooktwo");
  assert.equal(post.trainer_phone, TRAINER_REAL, "the assigned trainer's own number");
  assert.equal(post.customer_phone, "", "the client is STILL tester-gated: a stranger is never texted");
  assert.match(out.notes, /not an active tester phone/);
  assert.equal(post.practice, true, "it is still the practice copy");

  const ops = await P.sendOpsAlert("new_lead", { client_name: "Pat Client" }, { leadId: lead.id });
  assert.equal(ops.status, "sent", ops.reason);
  assert.equal(hookPosts(calls, "realnumbershookops")[0].operations_phone, LORENZO);

  const tmail = await P.trainerEmailFor(lead, { id: T1, full_name: "Lorenzo Miller" }, settings);
  assert.deepEqual(tmail, { ok: true, email: TRAINER_LOGIN, source: "portal_users", reason: "" }, "the trainer's portal login, like live");
  // Joshua 2026-09-22 (option B): the practice copy always emails the practice inbox, never a real one.
  assert.deepEqual(P.opsEmailFor(settings), { ok: true, email: PRACTICE_INBOX, reason: "" });

  const rows = testerRows(db);
  assert.ok(rows.some(r => r.phone === TRAINER_REAL && r.active), "the trainer's number is now an ACTIVE tester");
  assert.ok(rows.some(r => r.phone === LORENZO && r.active), "the Operations number is now an ACTIVE tester");
});

test("switch ON with the live Operations boxes empty: it falls back to the practice boxes, never to nobody", async () => {
  const { calls } = fakeWorld({ settings: { practice_real_numbers: true, operations_email: "" } });
  const P = load(true);
  const settings = await P.loadSettings();
  const ops = await P.sendOpsAlert("eval_booked", {}, { leadId: lead.id });
  assert.equal(ops.status, "sent", ops.reason);
  assert.equal(hookPosts(calls, "realnumbershookops")[0].operations_phone, TESTER, "the practice Operations phone");
  assert.deepEqual(P.opsEmailFor(settings), { ok: true, email: PRACTICE_INBOX, reason: "" }, "an empty Operations email box falls back to the practice inbox");
  // Joshua 2026-09-22 (option B): on the practice copy the Operations email ALWAYS goes to the practice inbox,
  // even when the Operations email box holds the live office address. No real inbox gets a rehearsal email.
  const kept = await (async () => { fakeWorld({ settings: { practice_real_numbers: true } }); return (load(true)).loadSettings(); })();
  assert.equal(load(true).opsEmailFor(kept).email, PRACTICE_INBOX);
});

test("switch ON, trainer with no phone on file: the trainer branch is skipped with the plain reason, nothing else changes", async () => {
  const { calls } = fakeWorld({ settings: { practice_real_numbers: true } });
  const P = load(true);
  const settings = await P.loadSettings();
  const l2 = { ...lead, trainer_id: T2, trainer_slug: "daniel-bainbridge", assigned_trainer_name: "Daniel Bainbridge" };
  const pre = await P.sendPreEvalTexts({ lead: l2 });
  assert.equal(pre.status, "skipped");
  assert.match(pre.reason, /trainer has no phone on file/);
  assert.equal(hookPosts(calls, "realnumbershooktwo").length, 0);
  assert.equal(P.trainerPhoneFor(l2, { full_name: "Daniel Bainbridge", phone: "" }, settings).ok, false);
});

test("the typed override beats everything, switch on or off, and is registered as a tester", async () => {
  for (const real of [false, true]) {
    const { calls, db } = fakeWorld({ settings: { practice_real_numbers: real, practice_trainer_override_phone: OVERRIDE, operations_phone: LORENZO } });
    const P = load(true);
    const settings = await P.loadSettings();
    assert.deepEqual(P.trainerPhoneFor(lead, { phone: TRAINER_REAL }, settings, new Set()), { ok: true, phone: OVERRIDE, reason: "" }, `override wins (switch ${real})`);
    const inquiry = await P.sendNewInquiryText({ lead, trainer: trainerNoPhoneCol, bookUrl: "https://x/book/lorenzo-miller?lead=1" });
    assert.equal(inquiry.status, "sent", inquiry.reason);
    const post = hookPosts(calls, "realnumbershooktwo").at(-1);
    assert.equal(post.trainer_phone, OVERRIDE, `every trainer text lands on the one handset (switch ${real})`);
    assert.equal(post.customer_phone, "");
    assert.ok(testerRows(db).some(r => r.phone === OVERRIDE && r.active), "the override number is an ACTIVE tester");
  }
});

test("guard rail: with the switch ON the practice copy still never texts a lead phone that is not an active tester", async () => {
  const { calls } = fakeWorld({ settings: { practice_real_numbers: true, practice_trainer_override_phone: OVERRIDE } });
  const P = load(true);
  const settings = await P.loadSettings();
  const testers = await P.activeTesterPhones();
  assert.equal(P.clientPhoneFor(STRANGER, testers).ok, false, "a stranger's phone is refused");
  assert.match(P.clientPhoneFor(STRANGER, testers).reason, /not an active tester phone/);
  assert.equal(P.newLeadTextPlan({ lead, bookUrl: "https://x", testers, routeNote: "" }).send, false, "no booking-link text to a stranger");
  assert.equal(P.careTextPlan({ lead, testers }).send, false, "no customer-care text to a stranger");
  const follow = await P.sendFollowUpText({ lead, step: "link" });
  assert.equal(follow.status, "skipped");
  assert.match(follow.reason, /not an active tester phone/);
  assert.equal(P.clientPhoneFor(TESTER, testers).ok, true, "a real tester is still textable");
  assert.ok(!JSON.stringify(hookPosts(calls, "realnumbershookone")).includes(STRANGER), "the stranger's number never reached Make");
  const out = await P.sendBookingTexts({ lead, booking, trainer: trainerNoPhoneCol, setting: null, settings });
  assert.equal(hookPosts(calls, "realnumbershooktwo").at(-1).customer_phone, "", "and never on the booking route either");
  assert.equal(out.status, "sent");
});

test("the email twin obeys the same switch: locked to the practice inbox when off, the resolved address when on", async () => {
  {
    const { calls } = fakeWorld();
    const P = load(true);
    const settings = await P.loadSettings();
    const blocked = await P.sendTextTwinEmail({ to: TRAINER_LOGIN, subject: "s", words: "w", leadId: lead.id, kind: "trainer_new_eval", settings });
    assert.equal(blocked.status, "skipped");
    assert.match(blocked.reason, /email twins go only to the practice test address/);
    assert.equal(calls.filter(c => c.host === "api.resend.com").length, 0, "nothing was sent");
  }
  {
    const { calls } = fakeWorld({ settings: { practice_real_numbers: true } });
    const P = load(true);
    const settings = await P.loadSettings();
    const sent = await P.sendTextTwinEmail({ to: TRAINER_LOGIN, subject: "s", words: "w", leadId: lead.id, kind: "trainer_new_eval", settings });
    // Joshua 2026-09-22 (option B): on the practice copy every twin email goes to the practice inbox only.
    assert.equal(sent.status, "skipped", "the practice copy never emails a real trainer inbox");
    assert.match(sent.reason, /practice test address/i);
    assert.equal(calls.filter(c => c.host === "api.resend.com").length, 0);
    const toInbox = await P.sendTextTwinEmail({ to: PRACTICE_INBOX, subject: "s", words: "w", leadId: lead.id, kind: "trainer_new_eval", settings });
    assert.equal(toInbox.status, "sent", toInbox.reason);
    const [mail] = calls.filter(c => c.host === "api.resend.com");
    // Rule 96 (Joshua 2026-09-22): with the switch ON the wording is plain, exactly like live.
    assert.ok(!/PRACTICE COPY/.test(mail.body.text), "with the switch on the inbox copy reads like the real thing");
    assert.ok(!/PRACTICE COPY/.test(mail.body.html), "and the HTML carries no practice notice either");
  }
});

// Rule 96: marked when the switch is OFF, plain when it is ON. Live is never marked either way.
test("rule 96: the practice marking follows the real-numbers switch (marked when off, plain when on)", async () => {
  {
    // Switch OFF: today's behaviour, unchanged.
    const { calls } = fakeWorld();
    const P = load(true);
    const settings = await P.loadSettings();
    assert.match(P.twinSubject("trainer_new_eval", "Pat Client", settings), /^\[PRACTICE COPY\] Track 500 · /);
    const sent = await P.sendTextTwinEmail({ to: PRACTICE_INBOX, subject: "s", words: "w", leadId: lead.id, kind: "trainer_new_eval", settings });
    assert.equal(sent.status, "sent", sent.reason);
    const [mail] = calls.filter(c => c.host === "api.resend.com");
    assert.match(mail.body.text, /PRACTICE COPY/, "off = marked");
  }
  {
    // Switch ON: the words people read are plain.
    const P = load(true);
    const settings = { ...(await P.loadSettings()), practice_real_numbers: true };
    const subject = P.twinSubject("trainer_new_eval", "Pat Client", settings);
    assert.ok(!/PRACTICE COPY/.test(subject), "on = no subject prefix");
    assert.match(subject, /^Track 500 · /, "the Track 500 tag stays");
  }
  {
    // LIVE is plain whatever the saved row says, and the switch cannot change that.
    const P = load(false);
    assert.ok(!/PRACTICE COPY/.test(P.twinSubject("trainer_new_eval", "Pat Client", { practice_real_numbers: false })));
    assert.ok(!/PRACTICE COPY/.test(P.twinSubject("trainer_new_eval", "Pat Client", { practice_real_numbers: true })));
  }
});

test("Send test follows the same rules: client to the locked phone, trainer to the override / test phone, Operations to the phone in use", async () => {
  process.env.LDTT_TEXTS_FROM_PORTAL = "1";
  const { calls } = fakeWorld({
    settings: { practice_real_numbers: true, practice_trainer_override_phone: OVERRIDE, operations_phone: LORENZO },
    testers: [{ phone: TESTER, active: true }]
  });
  const P = load(true);
  const settings = await P.loadSettings();
  assert.equal(P.sendTestPhoneFor("booking_link", settings).phone, TESTER, "a client test stays on the locked phone");
  assert.equal(P.sendTestPhoneFor("trainer_new_eval", settings).phone, OVERRIDE);
  assert.equal(P.sendTestPhoneFor("ops_new_lead", settings).phone, LORENZO);
  assert.equal(P.sendTestPhoneFor("trainer_new_eval", { ...settings, practice_trainer_override_phone: "" }).phone, TESTER, "no override: the trainer test phone, never a real trainer");
  const done = await P.sendTextTest("trainer_new_eval");
  assert.equal(done.ok, true, done.message);
  const post = hookPosts(calls, "realnumbershookone").at(-1);
  assert.equal(post.phone, OVERRIDE);
  assert.match(post.message, /^\[TEST\] /);
  delete process.env.LDTT_TEXTS_FROM_PORTAL;
});

test("the plain line under the switch names who gets what right now", async () => {
  fakeWorld();
  const P = load(true);
  const off = P.practiceRecipientSummary({ practice_trainer_phone: TESTER, practice_operations_phone: TESTER, practice_email_to: PRACTICE_INBOX });
  assert.match(off, /Trainer texts → the test phone \.\.\.2915\./);
  assert.match(off, /Operations → \.\.\.2915\./);
  assert.match(off, /Client → tester phones only\./);
  const on = P.practiceRecipientSummary({ practice_real_numbers: true, practice_operations_phone: TESTER, operations_phone: LORENZO, operations_email: "lorenzo@example.com", practice_email_to: PRACTICE_INBOX });
  assert.match(on, /Trainer texts → the trainer's own number\./);
  assert.match(on, /Operations → \.\.\.0111\./);
  assert.match(on, /Trainer emails → the trainer's own portal login\./);
  const one = P.practiceRecipientSummary({ practice_real_numbers: true, practice_trainer_override_phone: OVERRIDE, practice_operations_phone: TESTER });
  assert.match(one, /Trainer texts → one number, \.\.\.0777 \(every trainer text\)\./);
  const api = read("api/pipeline.js");
  assert.match(api, /recipient_summary: P\.practiceRecipientSummary\(settings\)/, "the settings answer carries the line");
  assert.match(api, /recipient_summary: P\.practiceRecipientSummary\(result\.settings\)/, "and so does the save answer");
});

test("the portal box: the switch, the override and every role box save through the existing save_settings op", () => {
  const app = read("trainer-backoffice/app.js");
  assert.match(app, /<h3 style="margin:18px 0 4px">Who gets the texts on the practice copy<\/h3>/);
  assert.match(app, /data-pipeline-real-numbers/);
  assert.match(app, /data-pipeline-trainer-override-phone/);
  assert.match(app, /The client text never changes:<\/strong> it only ever goes to a phone that is on <strong>Communications → Testers<\/strong>/, "the UI says the client stays tester-only");
  assert.match(app, /data-pipeline-recipient-line/, "the plain line is drawn under the switch");
  for (const box of ["data-pipeline-client-phone", "data-pipeline-trainer-phone", "data-pipeline-ops-phone", "data-pipeline-live-ops-phone", "data-pipeline-live-ops-email", "data-pipeline-practice-email"]) {
    assert.equal((app.match(new RegExp(box, "g")) || []).length >= 1, true, `${box} is on the panel`);
  }
  // Joshua 2026-09-23: the "Automatic follow-ups" switch rides the same save (tests/meeting-2026-09-23.test.mjs).
  // 2026-09-25: the two new switches (trainer_call_reminders, office_turn_digest) ride the same save, only when on screen.
  assert.match(app, /practice_real_numbers: realNumbers, practice_trainer_override_phone: trainerOverride, auto_followups: autoFollowups, \.\.\.newSwitches \}\)/, "all ride the existing save_settings op");
  assert.match(app, /\^data-pipeline-\(email\|label\|trainer-phone\|practice-email\|ops-phone\|live-ops-phone\|live-ops-email\|client-phone\|alpha-email\|trainer-override-phone\)=/, "rule 14: the new boxes keep their text through a redraw");
});

test("live is untouched: the saved switch changes nothing when LDTT_SANDBOX is unset", async () => {
  const { calls, db } = fakeWorld({ settings: { practice_real_numbers: true, practice_trainer_override_phone: OVERRIDE, operations_phone: LORENZO, operations_email: "lorenzo@example.com" } });
  const P = load(false);
  const settings = await P.loadSettings();
  const out = await P.sendBookingTexts({ lead, booking, trainer: trainerNoPhoneCol, setting: null, settings });
  assert.equal(out.status, "sent", out.reason);
  const [post] = hookPosts(calls, "realnumbershooktwo");
  assert.equal(post.trainer_phone, TRAINER_REAL, "live: the trainer's real phone, never the override");
  assert.notEqual(post.trainer_phone, OVERRIDE);
  assert.equal(post.customer_phone, STRANGER, "live: the lead's own phone, no tester list");
  assert.equal(post.practice, false);
  assert.equal(calls.filter(c => /communications_testers/.test(c.path)).length, 0, "live never reads or writes the tester list");
  assert.deepEqual(testerRows(db), [{ phone: TESTER, active: true }]);
  const ops = await P.sendOpsAlert("new_lead", {}, { leadId: lead.id });
  assert.equal(ops.status, "sent", ops.reason);
  assert.equal(hookPosts(calls, "realnumbershookops")[0].operations_phone, LORENZO);
});
