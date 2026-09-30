// Joshua 2026-09-25 (after the Lorenzo / Angela call):
//   1. The follow-up timer turns on at a set time (auto_followups_from). Before it: nothing. After it: only leads that
//      entered the pipeline at or after that time are counted, so the switch never texts older leads.
//   2. At most one follow-up text per lead per cron tick (a missed tick never sends two texts back to back).
//   3. Trainer emails come back with only the chosen kinds (trainer_email_kinds). No list = all kinds, as before.
//   4. A save that does not mention the two new settings keeps their stored values.
// Run: node --test tests/   Nothing here talks to the real project (global fetch is replaced).
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "test-key";
process.env.SUPABASE_URL = process.env.SUPABASE_URL || "http://supabase.test";
process.env.LDTT_MAKE_HOOK_PATHWAY1 = "https://hook.us2.make.com/abc123auto";

const TESTER = "+14405550123";
const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const START = Date.parse("2026-09-25T13:00:00Z");

function loadPipeline(sandbox = true) {
  for (const m of ["../lib/sandbox.js", "../lib/booking.js", "../lib/pipeline.js"]) delete require.cache[require.resolve(m)];
  if (sandbox) process.env.LDTT_SANDBOX = "1"; else delete process.env.LDTT_SANDBOX;
  return require("../lib/pipeline.js");
}

function lead(enteredMs, extra = {}) {
  return {
    id: "00000000-0000-4000-8000-000000000091", first_name: "Sam", last_name: "Tester", phone: "(440) 555-0123",
    sms_consent: true, status: "new_inquiry", version: 3, created_at: new Date(enteredMs).toISOString(),
    raw_payload: { pipeline: { entered_at: new Date(enteredMs).toISOString(), new_lead_text: { pathway: 1, status: "sent" } } },
    ...extra
  };
}

function stubWorld({ settings, row }) {
  const calls = [];
  const db = { lead: JSON.parse(JSON.stringify(row)) };
  global.fetch = async (url, options = {}) => {
    const u = new URL(String(url));
    let body = options.body;
    if (typeof body === "string") { try { body = JSON.parse(body); } catch { /* text */ } }
    calls.push({ host: u.host, path: u.pathname, search: u.search, method: options.method || "GET", body });
    const res = (status, data, text) => ({ ok: status < 400, status, text: async () => text ?? JSON.stringify(data), json: async () => data });
    if (u.host === "hook.us2.make.com") return res(200, null, "Accepted");
    if (u.pathname.startsWith("/rest/v1/communications_testers")) return res(200, [{ phone: TESTER }]);
    if (u.pathname.startsWith("/rest/v1/site_settings")) {
      if (u.search.includes("pipeline_office_emails")) return res(200, [{ value: { practice_email_to: "tester@example.test", ...settings } }]);
      return res(200, []);
    }
    if (u.pathname.startsWith("/rest/v1/leads")) {
      if ((options.method || "GET") === "GET") return res(200, db.lead ? [db.lead] : []);
      if (options.method === "PATCH") {
        const versionMatch = /version=eq\.(\d+)/.exec(u.search);
        if (versionMatch && Number(versionMatch[1]) !== db.lead.version) return res(200, []);
        db.lead = { ...db.lead, ...body, version: db.lead.version + 1 };
        return res(200, [db.lead]);
      }
    }
    return res(200, []);
  };
  return { calls, db };
}
const texts = calls => calls.filter(c => c.host === "hook.us2.make.com");

test("timer start: settings keep auto_followups_from as an ISO time; junk becomes blank", () => {
  const P = loadPipeline(true);
  assert.equal(P.normalizeSettings({ auto_followups_from: "2026-09-25T09:00:00-04:00" }).value.auto_followups_from, "2026-09-25T13:00:00.000Z");
  assert.equal(P.normalizeSettings({ auto_followups_from: "soon" }).value.auto_followups_from, "");
  assert.equal(P.normalizeSettings({}).value.auto_followups_from, "");
});

test("timer start: before the start time nothing is sent and nothing is written", async () => {
  const P = loadPipeline(true);
  const { calls } = stubWorld({ settings: { auto_followups: true, auto_followups_from: new Date(START).toISOString() }, row: lead(START - 2 * HOUR) });
  const out = await P.runAutoFollowUps({ nowMs: START - MIN });
  assert.equal(out.on, false);
  assert.equal(out.waiting, true);
  assert.equal(texts(calls).length, 0);
  assert.equal(calls.filter(c => c.method === "PATCH").length, 0);
});

test("timer start: a lead that entered before the start time never gets a follow-up", async () => {
  const P = loadPipeline(true);
  assert.deepEqual(P.autoFollowUpDue(lead(START - 20 * HOUR), START + MIN, { fromMs: START }), []);
  const { calls } = stubWorld({ settings: { auto_followups: true, auto_followups_from: new Date(START).toISOString() }, row: lead(START - 20 * HOUR) });
  const out = await P.runAutoFollowUps({ nowMs: START + MIN });
  assert.equal(out.on, true);
  assert.deepEqual(out.sent, []);
  assert.equal(texts(calls).length, 0, "the backlog is left alone");
});

test("timer start: a lead that entered after the start time follows the normal clock", async () => {
  const P = loadPipeline(true);
  const entered = START + 10 * MIN;
  assert.deepEqual(P.autoFollowUpDue(lead(entered), entered + 16 * MIN, { fromMs: START }), ["tim"]);
  const { calls } = stubWorld({ settings: { auto_followups: true, auto_followups_from: new Date(START).toISOString() }, row: lead(entered) });
  const out = await P.runAutoFollowUps({ nowMs: entered + 16 * MIN });
  assert.deepEqual(out.sent.map(s => s.step), ["tim"]);
  assert.equal(texts(calls).length, 1);
});

test("two overdue steps: ONE message (the booking link), the other recorded combined - never back to back", async () => {
  const P = loadPipeline(true);
  const entered = START + 10 * MIN;
  const { calls } = stubWorld({ settings: { auto_followups: true, auto_followups_from: new Date(START).toISOString() }, row: lead(entered) });
  const first = await P.runAutoFollowUps({ nowMs: entered + 40 * MIN });
  assert.deepEqual(first.sent.map(s => s.step), ["link"], "Joshua 2026-09-30: one message, the booking link");
  assert.equal(texts(calls).length, 1);
  const second = await P.runAutoFollowUps({ nowMs: entered + 55 * MIN });
  assert.deepEqual(second.sent.map(s => s.step), [], "the 15-minute step was combined, never sent late");
  assert.equal(texts(calls).length, 1);
});

test("trainer email kinds: only the listed kinds are emailed; no list = every kind", async () => {
  const P = loadPipeline(false);
  const settings = { trainer_email_kinds: ["trainer_new_inquiry", "trainer_new_eval", "pre_eval_answers"] };
  global.fetch = async () => { throw new Error("no network call expected for a switched-off kind"); };
  const off = await P.trainerTwinEmail("trainer_log_deal", { lead: { id: "x" }, trainer: { id: "t" }, settings, words: "hi", clientName: "A B" });
  assert.equal(off.status, "skipped");
  assert.match(off.reason, /trainer_email_kinds/);
  assert.deepEqual(P.normalizeSettings({ trainer_email_kinds: ["trainer_new_inquiry", "nope", "trainer_new_inquiry"] }).value.trainer_email_kinds, ["trainer_new_inquiry"]);
  assert.equal(P.normalizeSettings({}).value.trainer_email_kinds, null, "no list = all kinds (the old behavior)");
});

test("trainer email kinds: a listed kind still goes through the normal address lookup", async () => {
  const P = loadPipeline(false);
  const settings = { trainer_email_kinds: ["trainer_new_inquiry"], trainer_emails_hold: true };
  global.fetch = async () => { throw new Error("the hold answers before any lookup"); };
  const held = await P.trainerTwinEmail("trainer_new_inquiry", { lead: { id: "x" }, trainer: { id: "t" }, settings, words: "hi", clientName: "A B" });
  assert.equal(held.status, "skipped");
  assert.match(held.reason, /held/, "a listed kind reaches the address rules (here: the hold)");
});

test("a save that leaves out the timer start and the trainer email list keeps the stored values", async () => {
  const P = loadPipeline(false);
  let written = null;
  global.fetch = async (url, options = {}) => {
    const res = data => ({ ok: true, status: 200, text: async () => JSON.stringify(data), json: async () => data });
    if ((options.method || "GET") === "GET") return res([{ value: { auto_followups_from: "2026-09-25T13:00:00.000Z", trainer_email_kinds: ["trainer_new_inquiry"], trainer_emails_hold: false } }]);
    written = JSON.parse(options.body);
    return res([{ ...written }]);
  };
  const out = await P.saveSettings({ recipients: [], auto_followups: true }, "office@test");
  assert.equal(out.ok, true, JSON.stringify(out));
  assert.equal(written.value.auto_followups_from, "2026-09-25T13:00:00.000Z");
  assert.deepEqual(written.value.trainer_email_kinds, ["trainer_new_inquiry"]);
});
