// "I called the client" + the 30-minute reminder (Zoom 2026-09-24, Angela: "a 30 minute trigger, then the bot
// automatically resends a reminder to the trainer to contact this. Once that has been checked off, then that stops.")
// Pins: the check-off (no status change, audited), the due rule (30 min .. 48 h, not checked off, not claimed, still
// Evaluation Scheduled, the eval not yet past, no qa), claim-first = ONE text ever, the master switch (default OFF),
// the portal button. Run: node --test tests/   Nothing here talks to the real project (global fetch is replaced).
import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "test-key";
process.env.SUPABASE_URL = process.env.SUPABASE_URL || "http://supabase.test";
process.env.LDTT_MAKE_HOOK_PATHWAY2 = "https://hook.us2.make.com/abc123pathway2";
const read = path => readFileSync(resolve(import.meta.dirname, "..", path), "utf8");
const TESTER = "+14405550123";
const NOW = Date.parse("2026-09-25T15:00:00Z");
const minutesAgo = m => new Date(NOW - m * 60000).toISOString();

function load(sandbox = true) {
  for (const m of ["../lib/sandbox.js", "../lib/booking.js", "../lib/pipeline.js"]) delete require.cache[require.resolve(m)];
  if (sandbox) process.env.LDTT_SANDBOX = "1"; else delete process.env.LDTT_SANDBOX;
  return require("../lib/pipeline.js");
}

function lead(over = {}, booking = {}, pipeline = {}) {
  return {
    id: randomUUID(), version: 1, first_name: "Diana", last_name: "M", phone: "(210) 555-0142", status: "evaluation_scheduled",
    trainer_id: "t-1", created_at: minutesAgo(40), sms_consent: true,
    raw_payload: { booking: { booked_at: minutesAgo(35), slot_start: new Date(NOW + 2 * 86400000).toISOString(), local_time_zone: "America/Chicago", client: { first_name: "Diana", last_name: "M", phone: "(210) 555-0142" }, ...booking }, pipeline },
    ...over
  };
}

function stub(world, calls) {
  global.fetch = async (url, options = {}) => {
    const u = new URL(String(url));
    let body = options.body;
    if (typeof body === "string") { try { body = JSON.parse(body); } catch { /* text */ } }
    const method = options.method || "GET";
    calls.push({ host: u.host, path: u.pathname, method, body, query: decodeURIComponent(u.search) });
    const res = (status, data, text) => ({ ok: status < 400, status, text: async () => text ?? JSON.stringify(data), json: async () => data });
    if (u.host === "hook.us2.make.com") return res(200, null, "Accepted");
    if (u.pathname.startsWith("/rest/v1/communications_testers")) return res(200, [{ phone: TESTER }]);
    if (u.pathname.startsWith("/rest/v1/site_settings")) return res(200, u.search.includes("pipeline_office_emails") ? [{ key: "pipeline_office_emails", value: world.settings }] : []);
    if (u.pathname.startsWith("/rest/v1/trainers")) return res(200, [{ id: "t-1", slug: "tabatha-shelley", full_name: "Tabatha Shelley", phone: "+18505550100", email: "t@example.test" }]);
    if (u.pathname.startsWith("/rest/v1/leads")) {
      if (method === "PATCH") {
        const hit = world.leads.find(l => u.search.includes(l.id) && u.search.includes(`version=eq.${l.version}`));
        if (!hit) return res(200, []);
        Object.assign(hit, body, { version: hit.version + 1 });
        return res(200, [JSON.parse(JSON.stringify(hit))]);
      }
      if (u.search.includes("id=eq.")) return res(200, world.leads.filter(l => u.search.includes(l.id)).map(l => JSON.parse(JSON.stringify(l))));
      return res(200, world.leads.filter(l => l.status === "evaluation_scheduled").map(l => JSON.parse(JSON.stringify(l))));
    }
    return res(200, []);
  };
}

test("the due rule: 30 minutes after the booking, up to 48 hours, only while not checked off / not claimed / still scheduled / eval ahead / not qa", () => {
  const P = load();
  assert.equal(P.trainerCallReminderDue(lead(), NOW), true);
  assert.equal(P.trainerCallReminderDue(lead({}, { booked_at: minutesAgo(29) }), NOW), false, "29 minutes: too early");
  assert.equal(P.trainerCallReminderDue(lead({}, { booked_at: minutesAgo(30) }), NOW), true, "30 minutes: due");
  assert.equal(P.trainerCallReminderDue(lead({}, { booked_at: minutesAgo(49 * 60) }), NOW), false, "older than 48 h: the backlog is left alone");
  assert.equal(P.trainerCallReminderDue(lead({}, {}, { trainer_intro_called_at: minutesAgo(5) }), NOW), false, "checked off: stops");
  assert.equal(P.trainerCallReminderDue(lead({}, {}, { trainer_call_reminder: { status: "sending" } }), NOW), false, "a claim (even a lost one) is final");
  for (const status of ["evaluation_cancelled", "evaluation_complete", "became_client", "lost_no_trainer_area", "archived"]) {
    assert.equal(P.trainerCallReminderDue(lead({ status }), NOW), false, status);
  }
  assert.equal(P.trainerCallReminderDue(lead({}, { slot_start: minutesAgo(1) }), NOW), false, "the evaluation time already passed");
  assert.equal(P.trainerCallReminderDue(lead({}, { booked_at: undefined }), NOW), false, "no online booking time: nothing to measure from");
  const qa = lead(); qa.raw_payload.qa = true;
  assert.equal(P.trainerCallReminderDue(qa, NOW), false, "a test row never");
  assert.equal(P.CALL_REMINDER_AFTER_MS, 30 * 60000);
  assert.equal(P.CALL_REMINDER_MAX_AGE_MS, 48 * 3600000);
});

test("master switch OFF (the default, and a settings row without the key): nothing is read, nothing is sent", async () => {
  for (const settings of [{}, { trainer_call_reminders: false }]) {
    const world = { settings, leads: [lead()] };
    const calls = [];
    stub(world, calls);
    const P = load();
    const out = await P.runTrainerCallReminders({ nowMs: NOW });
    assert.equal(out.on, false);
    assert.equal(calls.filter(c => c.path.startsWith("/rest/v1/leads")).length, 0);
    assert.equal(calls.filter(c => c.host === "hook.us2.make.com").length, 0);
  }
  assert.equal(load().defaultSettings().trainer_call_reminders, false);
  assert.equal(load().normalizeSettings({}).value.trainer_call_reminders, false);
});

test("ON: ONE text per lead, claim first; a second (or racing) run sends nothing more; a checked-off lead never gets one", async () => {
  const due = lead();
  const called = lead({}, {}, { trainer_intro_called_at: minutesAgo(10) });
  const world = { settings: { trainer_call_reminders: true, practice_trainer_phone: TESTER, practice_email_to: "practice@example.test" }, leads: [due, called] };
  const calls = [];
  stub(world, calls);
  const P = load();
  const [a, b] = await Promise.all([P.runTrainerCallReminders({ nowMs: NOW }), P.runTrainerCallReminders({ nowMs: NOW })]);
  const hooks = calls.filter(c => c.host === "hook.us2.make.com");
  assert.equal(hooks.length, 1, `exactly one text: ${JSON.stringify([a, b])}`);
  const hook = hooks[0].body;
  assert.equal(hook.pathway, "trainer_call_reminder");
  assert.equal(hook.customer_phone, "", "trainer branch only");
  assert.equal(hook.trainer_phone, TESTER, "the practice copy texts only the tester phone");
  assert.match(hook.trainer_message, /^Reminder: please call Diana M at \(210\) 555-0142 to introduce yourself before the evaluation on \w+day, September 27, 2026\. Then tap 'I called the client' in your portal: https?:\/\/\S+\/trainer-backoffice\?view=leads&lead=/);
  assert.equal(due.raw_payload.pipeline.trainer_call_reminder.status, "sent");
  assert.equal(called.raw_payload.pipeline.trainer_call_reminder, undefined, "checked off: never claimed, never texted");
  const again = await P.runTrainerCallReminders({ nowMs: NOW + 15 * 60000 });
  assert.equal(calls.filter(c => c.host === "hook.us2.make.com").length, 1, "the next tick sends nothing");
  assert.equal(again.sent.length, 0);
  const claims = calls.filter(c => c.method === "PATCH" && c.body?.raw_payload?.pipeline?.trainer_call_reminder?.status === "sending");
  const firstHook = calls.indexOf(hooks[0]);
  assert.ok(claims.length >= 1 && calls.indexOf(claims[0]) < firstHook, "the claim is written BEFORE the text");
});

test("the cron runs it after the follow-ups and the re-engage check, and a failure never breaks the tick", () => {
  const cron = read("api/cron/auto-followups.js");
  assert.match(cron, /const callReminders = await P\.runTrainerCallReminders\(\)\n\s*\.catch\(/);
  assert.ok(cron.indexOf("runReengageBatch") < cron.indexOf("runTrainerCallReminders"));
  const texts = require("../lib/pipeline-texts.js");
  const t = texts.TEXTS.find(x => x.key === "trainer_call_reminder");
  assert.equal(t.role, "trainer");
  assert.equal(t.words, "Reminder: please call {first_name} {last_name} at {phone} to introduce yourself before the evaluation on {appointment_day}, {appointment_date}. Then tap 'I called the client' in your portal: {trainer_portal_link}");
  assert.equal(texts.check("trainer_call_reminder", t.words).error, undefined);
});

test("saving the settings from a screen that does not show a switch keeps its stored value (trainer_emails_hold included)", async () => {
  const world = { settings: { trainer_emails_hold: true, trainer_call_reminders: false, office_turn_digest: false, auto_followups: false }, leads: [] };
  const calls = [];
  stub(world, calls);
  const P = load(false);
  const out = await P.saveSettings({ recipients: [], auto_followups: false }, "Office");
  assert.equal(out.ok, true, JSON.stringify(out));
  const written = calls.find(c => c.method === "POST" && c.path.startsWith("/rest/v1/site_settings")).body.value;
  assert.equal(written.trainer_emails_hold, true, "the go-live trainer email hold is no longer released by a save");
  assert.equal(written.trainer_call_reminders, false);
  const flipped = await P.saveSettings({ recipients: [], trainer_call_reminders: true }, "Office");
  assert.equal(flipped.settings.trainer_call_reminders, true, "a screen that shows the switch still changes it");
});

// ---- The trainer API: "I called the client" ------------------------------------------------------------------
const USERS = [
  { user_id: "u-t", role: "trainer", permission_level: "trainer", trainer_id: "t-1", active: true, access_status: "active", email: "tab@example.com", first_name: "Tabatha", last_name: "S" },
  { user_id: "u-o", role: "trainer", permission_level: "trainer", trainer_id: "t-2", active: true, access_status: "active", email: "o@example.com" }
];
function apiWorld(status = "evaluation_scheduled", pipeline = {}) {
  const id = randomUUID();
  const store = { portal_users: USERS.map(u => ({ ...u })), leads: [{ id, trainer_id: "t-1", status, version: 3, raw_payload: { booking: { booked_at: "x" }, pipeline } }], audit_events: [], lifecycle_events: [], lead_events: [] };
  const writes = [];
  global.fetch = async (url, options = {}) => {
    const u = new URL(url);
    const method = (options.method || "GET").toUpperCase();
    const json = (s, b) => new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json" } });
    if (u.pathname === "/auth/v1/user") {
      const token = String(options.headers?.Authorization || options.headers?.authorization || "").replace(/^Bearer\s+/, "");
      const pu = USERS.find(p => `${p.user_id}-token` === token);
      return pu ? json(200, { id: pu.user_id, email: pu.email }) : json(401, {});
    }
    const table = u.pathname.replace("/rest/v1/", "");
    const eq = rows => rows.filter(r => [...u.searchParams].every(([k, v]) => ["select", "limit", "order"].includes(k) || !v.startsWith("eq.") || String(r[k]) === v.slice(3)));
    const body = options.body ? JSON.parse(options.body) : null;
    if (method === "GET") return json(200, eq(store[table] || []));
    writes.push({ table, method, body });
    if (method === "POST") { store[table].push(body); return json(201, [body]); }
    const hits = eq(store[table]); hits.forEach(r => { Object.assign(r, body); r.version += 1; });
    return json(200, hits);
  };
  return { store, writes, id };
}
async function act(body, token = "u-t-token") {
  delete process.env.LDTT_SANDBOX;
  delete require.cache[require.resolve("../api/trainer-lead-action.js")];
  const handler = require("../api/trainer-lead-action.js");
  const res = { statusCode: 0, body: null, setHeader() {}, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; }, end() { return this; } };
  await handler({ method: "POST", headers: { authorization: `Bearer ${token}` }, body, query: {} }, res);
  return res;
}

test("API: 'I called the client' stamps pipeline.trainer_intro_called_at, keeps the rest, no status change, audited + a lead event; once only", async () => {
  const w = apiWorld("evaluation_scheduled", { booking_notices: [{ hold_id: "h1" }] });
  const res = await act({ action: "intro_called", lead_id: w.id, expected_version: 3 });
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(res.body.message, "Checked off: you called the client. No more reminders for this one.");
  const row = w.store.leads[0];
  assert.equal(row.status, "evaluation_scheduled");
  assert.ok(row.raw_payload.pipeline.trainer_intro_called_at);
  assert.deepEqual(row.raw_payload.pipeline.booking_notices, [{ hold_id: "h1" }], "the texting record is kept");
  assert.deepEqual(row.raw_payload.booking, { booked_at: "x" });
  assert.deepEqual(Object.keys(w.writes.find(x => x.table === "leads").body), ["raw_payload"]);
  assert.equal(w.store.audit_events[0].action, "trainer_lead_intro_called");
  assert.equal(w.store.lead_events[0].event_type, "trainer_intro_called");
  assert.equal(w.store.lifecycle_events.length, 0);
  const writes = w.writes.length;
  const again = await act({ action: "intro_called", lead_id: w.id });
  assert.equal(again.statusCode, 200);
  assert.equal(again.body.already, true);
  assert.equal(w.writes.length, writes, "a second tap writes nothing");
  const notScheduled = apiWorld("office_contacted");
  assert.equal((await act({ action: "intro_called", lead_id: notScheduled.id })).statusCode, 409);
  const other = apiWorld();
  assert.equal((await act({ action: "intro_called", lead_id: other.id }, "u-o-token")).statusCode, 403, "only the lead's own trainer (or the office)");
  assert.equal(notScheduled.writes.length + other.writes.length, 0);
});

test("portal: the Evaluation Scheduled card and panel show 'I called the client' until it is checked off, then a done line", () => {
  const app = read("trainer-backoffice/app.js");
  const fn = name => app.match(new RegExp(`function ${name}\\(.*\\) \\{\\n[\\s\\S]*?\\n\\}\\n`))[0];
  const escapeHtml = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const draw = rawPayload => {
    const ctx = { escapeHtml, leadRawPayload: l => l.rawPayload || {}, lead: { id: "L1", remoteId: "r1", owner: "Diana", status: "Evaluation Scheduled", rawPayload }, state: {}, leadStatusLabel: s => s, trainerHandoffBox: () => "" };
    vm.runInNewContext(`${app.match(/const TRAINER_LOST_REASONS = [^\n]*\n/)[0]}${app.match(/const TRAINER_ARCHIVE_REASONS = [^\n]*\n/)[0]}${fn("trainerCardNextStep")}\n${fn("trainerLeadActionsBox")}\nthis.card = trainerCardNextStep(lead, "scheduled"); this.panel = trainerLeadActionsBox(lead);`, ctx);
    return ctx;
  };
  const open = draw({});
  assert.match(open.card, /data-trainer-lead-action="intro_called" data-lead-ref="L1">I called the client<\/button>/);
  assert.match(open.panel, /data-trainer-lead-action="intro_called" data-lead-ref="L1">I called the client<\/button>/);
  const done = draw({ pipeline: { trainer_intro_called_at: "2026-09-25T15:00:00Z" } });
  assert.doesNotMatch(done.card + done.panel, /data-trainer-lead-action="intro_called"/);
  assert.match(done.card, /You called the client ✓/);
  assert.match(done.panel, /You called the client ✓/);
  assert.match(app, /data-pipeline-call-reminders \$\{s\.trainer_call_reminders \? "checked" : ""\}/, "the office switch, shown in Settings");
});
