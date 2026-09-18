// Production-correct text routing (Joshua 2026-09-17). Against a fake Supabase + a fake Make (global fetch replaced):
//   LIVE (LDTT_SANDBOX unset):
//     - the trainer alert (booking, pre-eval answers, eval completed) goes to the assigned trainer's real phone
//       (trainers.phone, loaded by trainer_id / trainer_slug), never to the tester phone in Settings;
//     - a trainer with no phone on file -> skipped, reason "trainer has no phone on file";
//     - the customer confirmation goes to the lead's own phone, no tester list is read;
//     - Operations goes to Settings -> operations_phone; empty -> skipped with a clear reason;
//   SANDBOX (LDTT_SANDBOX=1): unchanged - tester phone from Settings for the trainer, practice_operations_phone
//     for Operations, active testers only, the real trainer phone is never used.
// NOT deployed (tests/ is in .vercelignore). Nothing here talks to the real project or Make.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
process.env.SUPABASE_URL = "http://supabase.test";
process.env.LDTT_MAKE_HOOK_PATHWAY1 = "https://hook.us2.make.com/routinghookone";
process.env.LDTT_MAKE_HOOK_PATHWAY2 = "https://hook.us2.make.com/routinghooktwo";
process.env.LDTT_MAKE_HOOK_OPS = "https://hook.us2.make.com/routinghookops";
const require = createRequire(import.meta.url);
const read = path => readFileSync(resolve(import.meta.dirname, "..", path), "utf8");

const TESTER = "+14402142915";
const LORENZO = "+12165550111"; // Operations phone on live (fake)
const TRAINER_REAL = "+13305550123"; // the assigned trainer's real phone (fake)
const CLIENT = "+14405550199"; // the lead's phone (fake, NOT a tester)
const T1 = "cbf54e9f-d68c-44ba-b6ad-d48549caca8e";
const T2 = "45875481-0bb3-420f-9add-6fdceb7efa51";

function fakeWorld({ settings = {} } = {}) {
  const db = {
    communications_testers: [{ phone: TESTER, active: true }],
    trainers: [
      { id: T1, slug: "lorenzo-miller", full_name: "Lorenzo Miller", phone: TRAINER_REAL, status: "active" },
      { id: T2, slug: "daniel-bainbridge", full_name: "Daniel Bainbridge", phone: null, status: "active" }
    ],
    site_settings: [{ key: "pipeline_office_emails", value: { recipients: [], practice_trainer_phone: TESTER, practice_operations_phone: TESTER, ...settings } }],
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
    const table = u.pathname.replace("/rest/v1/", "");
    const rows = db[table] || [];
    const filter = row => [...u.searchParams].every(([k, v]) => {
      if (["select", "limit", "order"].includes(k)) return true;
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
const testerReads = calls => calls.filter(c => /communications_testers/.test(c.path)).length;

const lead = {
  id: "00000000-0000-4000-8000-000000000001", first_name: "Pat", last_name: "Client", phone: CLIENT, sms_consent: true,
  trainer_id: T1, trainer_slug: "lorenzo-miller", assigned_trainer_name: "Lorenzo Miller",
  raw_payload: { booking: { trainer_slug: "lorenzo-miller", trainer_name: "Lorenzo Miller", slot_start: "2026-10-01T14:00:00.000Z", client: { first_name: "Pat", last_name: "Client", phone: CLIENT, address: "1 Main St" }, dogs: [{ name: "Rex", behavior: "pulling" }], pre_eval: { rows: [["Age?", "3"]], flags: [] } } }
};
const booking = { hold_id: "h1", slot_start: "2026-10-01T14:00:00.000Z", trainer_slug: "lorenzo-miller", trainer_name: "Lorenzo Miller", location: "in_home", client: lead.raw_payload.booking.client, dogs: lead.raw_payload.booking.dogs };
const trainerNoPhoneCol = { id: T1, slug: "lorenzo-miller", full_name: "Lorenzo Miller" }; // what lib/booking trainerRow returns (no phone column)

test("live: trainerPhoneFor picks the trainer's real phone; sandbox picks the Settings tester phone", async () => {
  fakeWorld();
  const live = load(false);
  const settings = { practice_trainer_phone: TESTER };
  assert.deepEqual(live.trainerPhoneFor(lead, { phone: "(330) 555-0123", full_name: "Lorenzo Miller" }, settings), { ok: true, phone: TRAINER_REAL, reason: "" });
  const none = live.trainerPhoneFor(lead, { phone: "", full_name: "Daniel Bainbridge" }, settings);
  assert.equal(none.ok, false);
  assert.match(none.reason, /trainer has no phone on file/);
  assert.equal(none.phone, "");
  assert.equal(live.trainerPhoneFor(lead, null, settings).ok, false, "no trainer row -> no phone");

  const sandbox = load(true);
  const pick = sandbox.trainerPhoneFor(lead, { phone: TRAINER_REAL }, settings, new Set([TESTER]));
  assert.deepEqual(pick, { ok: true, phone: TESTER, reason: "" }, "sandbox never uses the real trainer phone");
  assert.match(sandbox.trainerPhoneFor(lead, { phone: TRAINER_REAL }, {}, new Set([TESTER])).reason, /no tester phone saved/);
  assert.match(sandbox.trainerPhoneFor(lead, null, settings, new Set()).reason, /not an active tester phone/);
});

test("live booking: customer text to the lead's phone, trainer alert to trainers.phone (loaded by trainer_id); no tester list read", async () => {
  const { calls } = fakeWorld();
  const P = load(false);
  const settings = await P.loadSettings();
  const out = await P.sendBookingTexts({ lead, booking, trainer: trainerNoPhoneCol, setting: { slug: "lorenzo-miller", time_zone: "America/New_York" }, settings });
  assert.equal(out.status, "sent", out.reason || out.notes);
  const [post] = hookPosts(calls, "routinghooktwo");
  assert.equal(post.pathway, "booking_confirmed");
  assert.equal(post.customer_phone, CLIENT, "live: the lead's own phone");
  assert.equal(post.trainer_phone, TRAINER_REAL, "live: the trainer's real phone, not the Settings tester phone");
  assert.notEqual(post.trainer_phone, TESTER);
  assert.equal(post.practice, false);
  assert.equal(testerReads(calls), 0, "live never reads communications_testers");
  assert.ok(calls.some(c => /\/rest\/v1\/trainers/.test(c.path) && /id=eq\./.test(c.url) && /select=id,slug,full_name,phone/.test(c.url)), "the trainer row is loaded with its phone");
});

test("live booking: a trainer with no phone on file -> trainer branch skipped with the reason, customer still texted", async () => {
  const { calls } = fakeWorld();
  const P = load(false);
  const l2 = { ...lead, trainer_id: T2, trainer_slug: "daniel-bainbridge", assigned_trainer_name: "Daniel Bainbridge" };
  const out = await P.sendBookingTexts({ lead: l2, booking: { ...booking, trainer_slug: "daniel-bainbridge" }, trainer: { id: T2, slug: "daniel-bainbridge", full_name: "Daniel Bainbridge" }, setting: null, settings: await P.loadSettings() });
  assert.equal(out.status, "sent");
  assert.match(out.notes, /trainer has no phone on file/);
  const [post] = hookPosts(calls, "routinghooktwo");
  assert.equal(post.customer_phone, CLIENT);
  assert.equal(post.trainer_phone, "");
  // no customer either (no consent) -> the whole send is skipped with both reasons
  const both = await P.sendBookingTexts({ lead: { ...l2, sms_consent: false }, booking: { ...booking, trainer_slug: "daniel-bainbridge" }, trainer: { id: T2, slug: "daniel-bainbridge", full_name: "Daniel Bainbridge" }, setting: null, settings: await P.loadSettings() });
  assert.equal(both.status, "skipped");
  assert.match(both.reason, /no SMS consent/);
  assert.match(both.reason, /trainer has no phone on file/);
});

test("live: pre-eval answers and eval completed go to the trainer's real phone; no phone -> skipped", async () => {
  const { calls } = fakeWorld();
  const P = load(false);
  const pre = await P.sendPreEvalTexts({ lead });
  assert.equal(pre.status, "sent", pre.reason);
  const done = await P.sendEvalCompletedTexts({ lead });
  assert.equal(done.status, "sent", done.reason);
  const posts = hookPosts(calls, "routinghooktwo");
  assert.deepEqual(posts.map(p => p.pathway), ["pre_eval_answered", "eval_completed"]);
  for (const p of posts) {
    assert.equal(p.trainer_phone, TRAINER_REAL);
    assert.equal(p.customer_phone, "");
    assert.equal(p.practice, false);
  }
  assert.equal(testerReads(calls), 0);
  // by slug only (no trainer_id on the lead)
  const bySlug = await P.sendPreEvalTexts({ lead: { ...lead, trainer_id: null } });
  assert.equal(bySlug.status, "sent");
  assert.equal(hookPosts(calls, "routinghooktwo").at(-1).trainer_phone, TRAINER_REAL);
  // trainer without a phone
  const l2 = { ...lead, trainer_id: T2, trainer_slug: "daniel-bainbridge" };
  const n = calls.length;
  for (const fn of [P.sendPreEvalTexts, P.sendEvalCompletedTexts]) {
    const r = await fn({ lead: l2 });
    assert.equal(r.status, "skipped");
    assert.match(r.reason, /trainer has no phone on file/);
  }
  assert.equal(hookPosts(calls.slice(n), "routinghooktwo").length, 0, "nothing posted to Make");
});

test("live: Operations goes to Settings operations_phone; empty -> skipped with a clear reason; sandbox unchanged", async () => {
  {
    const { calls } = fakeWorld({ settings: { operations_phone: "(216) 555-0111" } });
    const P = load(false);
    const r = await P.sendOpsAlert("new_lead", { client_name: "Pat Client", link: "x" });
    assert.equal(r.status, "sent", r.reason);
    const [post] = hookPosts(calls, "routinghookops");
    assert.equal(post.operations_phone, LORENZO);
    assert.equal(post.stage, "new_lead");
    assert.equal(post.practice, false);
    assert.equal(testerReads(calls), 0);
  }
  {
    const { calls } = fakeWorld(); // no operations_phone saved
    const P = load(false);
    const r = await P.sendOpsAlert("eval_booked", {});
    assert.equal(r.status, "skipped");
    assert.match(r.reason, /No Operations phone on live is saved in Settings \(operations_phone\)/);
    assert.equal(hookPosts(calls, "routinghookops").length, 0);
  }
  {
    const { calls } = fakeWorld({ settings: { operations_phone: LORENZO } });
    const P = load(true);
    const r = await P.sendOpsAlert("new_lead", {});
    assert.equal(r.status, "sent", r.reason);
    const [post] = hookPosts(calls, "routinghookops");
    assert.equal(post.operations_phone, TESTER, "sandbox: the practice Operations tester phone, never Lorenzo's");
    assert.equal(post.practice, true);
    assert.ok(testerReads(calls) > 0, "sandbox still checks the tester list");
  }
});

test("sandbox unchanged: trainer alert to the Settings tester phone, non-tester client dropped, real trainer phone never used", async () => {
  const { calls } = fakeWorld();
  const P = load(true);
  const settings = await P.loadSettings();
  const out = await P.sendBookingTexts({ lead, booking, trainer: trainerNoPhoneCol, setting: null, settings });
  assert.equal(out.status, "sent", out.reason);
  const [post] = hookPosts(calls, "routinghooktwo");
  assert.equal(post.trainer_phone, TESTER);
  assert.equal(post.customer_phone, "", "the lead's phone is not a tester: dropped on the practice copy");
  assert.equal(post.practice, true);
  assert.match(out.notes, /not an active tester phone/);
  assert.ok(!JSON.stringify(calls).includes(TRAINER_REAL), "the real trainer phone never leaves the fake DB on the practice copy");
  const pre = await P.sendPreEvalTexts({ lead });
  assert.equal(pre.status, "sent");
  assert.equal(hookPosts(calls, "routinghooktwo").at(-1).trainer_phone, TESTER);
});

test("new inquiry: the routed trainer is texted through pathway 2 (trainer branch only) - live real phone, sandbox tester phone", async () => {
  {
    const { calls } = fakeWorld();
    const P = load(false);
    const r = await P.sendNewInquiryText({ lead: { ...lead, zip: "44118" }, trainer: trainerNoPhoneCol, bookUrl: "https://x/book/lorenzo-miller?lead=1" });
    assert.equal(r.status, "sent", r.reason);
    const [post] = hookPosts(calls, "routinghooktwo");
    assert.equal(post.pathway, "new_inquiry");
    assert.equal(post.trainer_phone, TRAINER_REAL);
    assert.equal(post.customer_phone, "");
    assert.equal(post.zip, "44118");
    assert.match(post.trainer_message, /New Track 500 inquiry/);
    assert.match(post.trainer_message, /Pat Client, ZIP 44118/);
    assert.match(post.trainer_message, /\/staff\?view=leads&lead=/);
    assert.equal(post.customer_message, "");
    assert.equal(post.practice, false);
    assert.equal(testerReads(calls), 0);
    const none = await P.sendNewInquiryText({ lead, trainer: { id: T2, slug: "daniel-bainbridge", full_name: "Daniel Bainbridge" }, bookUrl: "https://x" });
    assert.equal(none.status, "skipped");
    assert.match(none.reason, /trainer has no phone on file/);
    const unrouted = await P.sendNewInquiryText({ lead, trainer: null, bookUrl: null });
    assert.equal(unrouted.status, "skipped");
    assert.match(unrouted.reason, /No calendar trainer/);
    assert.equal(hookPosts(calls, "routinghooktwo").length, 1, "only the routed lead posted");
  }
  {
    const { calls } = fakeWorld();
    const P = load(true);
    const r = await P.sendNewInquiryText({ lead, trainer: trainerNoPhoneCol, bookUrl: "https://x" });
    assert.equal(r.status, "sent", r.reason);
    const [post] = hookPosts(calls, "routinghooktwo");
    assert.equal(post.trainer_phone, TESTER, "sandbox: the Settings tester phone");
    assert.equal(post.practice, true);
    assert.ok(!JSON.stringify(calls.filter(c => c.host === "hook.us2.make.com")).includes(TRAINER_REAL));
  }
  const src = read("lib/pipeline.js");
  assert.match(src, /if \(payload\.pathway === "new_inquiry"\) return \{ \.\.\.payload, trainer_message: T\.render\(words\("trainer_new_inquiry"\), payload\), customer_message: "" \};/);
  assert.match(src, /trainer_new_inquiry_text: inquiry/, "recorded on the pipeline record");
  const T = require("../lib/pipeline-texts.js");
  const t = T.TEXTS.find(x => x.key === "trainer_new_inquiry");
  assert.deepEqual({ stage: t.stage, role: t.role, status: t.status, fields: t.fields }, { stage: "new_lead", role: "trainer", status: "in_use", fields: ["first_name", "last_name", "zip", "problem", "trainer_portal_link"] });
});

test("live: pathway 1 plan uses the lead's phone with no tester check; settings carry operations_phone; the portal box exists", () => {
  fakeWorld();
  const P = load(false);
  const plan = P.newLeadTextPlan({ lead, bookUrl: "https://x/book/lorenzo-miller?lead=1", testers: new Set(), routeNote: "" });
  assert.deepEqual(plan, { send: true, phone: CLIENT });
  assert.equal(P.newLeadTextPlan({ lead: { ...lead, sms_consent: false }, bookUrl: "https://x", testers: new Set() }).send, false);
  const S = load(true);
  assert.equal(S.newLeadTextPlan({ lead, bookUrl: "https://x", testers: new Set(), routeNote: "" }).send, false, "sandbox: not a tester -> no text");
  assert.equal(S.normalizeSettings({}).value.operations_phone, "");
  assert.equal(S.normalizeSettings({ operations_phone: "216-555-0111" }).value.operations_phone, LORENZO);
  assert.equal(S.normalizeSettings({ operations_phone: "12" }).errors.length, 1);
  assert.equal(S.defaultSettings().operations_phone, "");
  const app = read("trainer-backoffice/app.js");
  assert.match(app, /Operations phone on live \(Lorenzo\)/);
  assert.match(app, /data-pipeline-live-ops-phone/);
  assert.match(app, /operations_phone: liveOpsPhone/);
  const src = read("lib/pipeline.js");
  assert.equal((src.match(/practice: true/g) || []).length, 1, "only the Send-test post is hard-wired to practice: true");
  assert.equal(/Texts are switched on for the practice copy only/.test(src), false, "no send path is gated to the practice copy any more");
});
