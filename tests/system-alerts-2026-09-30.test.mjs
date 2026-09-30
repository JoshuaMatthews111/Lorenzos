// The alert bell (Zoom 2026-09-29, Angela + Lorenzo): every open problem names its owner and its fix, and it can
// only leave the list by being fixed. Run: node --test tests/
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "test-key";
process.env.SUPABASE_URL = process.env.SUPABASE_URL || "http://supabase.test";
const SA = require("../lib/system-alerts.js");
const read = path => readFileSync(resolve(import.meta.dirname, "..", path), "utf8");
const NOW = Date.parse("2026-09-30T15:00:00Z");
const H = 3600 * 1000;
const lead = (over = {}) => ({ id: "00000000-0000-4000-8000-0000000000a1", first_name: "Hadley", last_name: "Adams", status: "new_inquiry",
  created_at: new Date(NOW - 5 * H).toISOString(), source_page: "trainer landing page: Bailey Brown", raw_payload: { source_page: "trainer landing page: Bailey Brown" }, ...over });

test("a website lead that never started its texts is a SYSTEM alert owned by Joshua (Hadley A.)", () => {
  const a = SA.leadAlerts(lead(), NOW).filter(x => x.type === "no_pipeline"); // (it is also "waiting" after 15 minutes)
  assert.equal(a.length, 1);
  assert.equal(a[0].type, "no_pipeline");
  assert.equal(a[0].owner, SA.JOSHUA);
  assert.equal(a[0].level, "system");
  assert.match(a[0].what, /Hadley A\. came in from the website but the automatic texts and emails never started/);
  assert.match(a[0].fix, /Office: call the client now/);
  const np = l => SA.leadAlerts(l, NOW).filter(x => x.type === "no_pipeline").length;
  assert.equal(np(lead({ raw_payload: { lead_type: "pdf_download", source_page: "dog-training-cleveland-oh" } })), 0, "the free e-book never starts texts, so that is no system fault (it still shows as waiting for the office)");
  assert.equal(SA.leadAlerts(lead({ raw_payload: { qa: true, source_page: "contact.html" } }), NOW).length, 0, "test rows never alert");
  assert.equal(SA.leadAlerts(lead({ created_at: new Date(NOW - 10 * 60 * 1000).toISOString() }), NOW).length, 0, "20 minutes of grace first");
  assert.equal(SA.leadAlerts(lead({ status: "office_contacted" }), NOW).length, 0, "the office reached the client: fixed");
});

test("no trainer in range and still New Inquiry after an hour: an OFFICE alert with the fix (Brandi H.)", () => {
  const brandi = lead({ first_name: "Brandi", last_name: "Hill", status: "new_inquiry", created_at: new Date(NOW - 2 * H).toISOString(),
    raw_payload: { source_page: "https://www.lorenzosdogtrainingteam.com/dog-training-chicago-il", pipeline: { entered_at: new Date(NOW - 2 * H).toISOString(), new_lead_text: { status: "skipped", reason: "No trainer within 50 miles of this ZIP yet: office follow-up, no text." } } } });
  const a = SA.leadAlerts(brandi, NOW);
  assert.equal(a.length, 1);
  assert.equal(a[0].type, "needs_call");
  assert.equal(a[0].owner, SA.OFFICE);
  assert.match(a[0].fix, /virtual evaluation with Lorenzo/);
  assert.equal(SA.leadAlerts({ ...brandi, status: "office_contacted" }, NOW).length, 0, "moving the card clears it");
});

test("a New Inquiry lead over a day old names its trainer as owner; failed texts and stuck office emails are system alerts", () => {
  const old = lead({ status: "new_inquiry", assigned_trainer_name: "Eric Beck", created_at: new Date(NOW - 30 * H).toISOString(),
    raw_payload: { source_page: "contact.html", pipeline: { entered_at: new Date(NOW - 30 * H).toISOString(), new_lead_text: { status: "sent" } } } });
  const w = SA.leadAlerts(old, NOW);
  assert.equal(w[0].type, "waiting");
  assert.match(w[0].owner, /^Eric Beck \(trainer\), then the office$/);
  const broken = lead({ raw_payload: { source_page: "contact.html", pipeline: {
    entered_at: new Date(NOW - 5 * H).toISOString(), new_lead_text: { status: "failed", reason: "Make answered 500", at: new Date(NOW - 5 * H).toISOString() },
    booking_notices: [{ hold_id: "new_lead", kind: "new_lead", office_email: { status: "queued", queued_at: new Date(NOW - 2 * H).toISOString() } }]
  } } });
  const types = SA.leadAlerts(broken, NOW).map(a => a.type).filter(t => t !== "waiting").sort();
  assert.deepEqual(types, ["office_email_new_lead", "text_failed_first_booking_link_text"]);
});

test("an office email copy that failed but the browser retry delivered is NOT an alert; one never delivered is", () => {
  const byId = new Map([[lead().id, lead()]]);
  const t = iso => new Date(NOW - iso * H).toISOString();
  const fixed = [{ destination: "formsubmit_email", submission_id: "s1", entity_id: lead().id, status: "failed", created_at: t(3) }, { destination: "formsubmit_email", submission_id: "s1", entity_id: lead().id, status: "accepted", created_at: t(3) }];
  assert.equal(SA.deliveryAlerts(fixed, byId, NOW).length, 0);
  const lost = [{ destination: "formsubmit_email", submission_id: "s2", entity_id: lead().id, status: "failed", error_summary: "Load failed", created_at: t(3) }];
  const a = SA.deliveryAlerts(lost, byId, NOW);
  assert.equal(a.length, 1);
  assert.match(a[0].what, /FormSubmit office email copy for Hadley A\. never arrived \(Load failed\)/);
  assert.equal(SA.deliveryAlerts(lost, new Map([[lead().id, lead({ status: "office_contacted" })]]), NOW).length, 0, "picked up: fixed");
});

test("merge: an alert keeps its first-seen time, and it leaves ONLY by not being found again (then it is 'resolved')", () => {
  const a = { id: "no_pipeline:x", type: "no_pipeline", owner: SA.JOSHUA, what: "w", level: "system" };
  const one = SA.mergeAlerts(null, [a], "2026-09-30T14:00:00.000Z");
  assert.deepEqual(one.fresh_ids, ["no_pipeline:x"]);
  const two = SA.mergeAlerts({ open: one.open, resolved: [] }, [a], "2026-09-30T14:15:00.000Z");
  assert.equal(two.open[0].first_seen, "2026-09-30T14:00:00.000Z");
  assert.deepEqual(two.fresh_ids, [], "not new the second time, so no second text");
  const three = SA.mergeAlerts({ open: two.open, resolved: [] }, [], "2026-09-30T14:30:00.000Z");
  assert.equal(three.open.length, 0);
  assert.equal(three.resolved[0].resolved_at, "2026-09-30T14:30:00.000Z");
});

test("the portal: a bell for office staff, the list with owner + fix, and NO dismiss or close-alert control", () => {
  const app = read("trainer-backoffice/app.js");
  assert.match(app, /fetch\("\/api\/pipeline\?op=system_alerts"/);
  assert.match(app, /\$\{systemAlertsBell\(\)\}/);
  assert.match(app, /<dt>Owner<\/dt><dd>\$\{escapeHtml\(a\.owner \|\| ""\)\}<\/dd><dt>How to fix<\/dt>/);
  const dialog = app.slice(app.indexOf("function renderSystemAlertsDialog()"), app.indexOf("setInterval(() => { if (session.loggedIn && session.role === \"admin\""));
  assert.doesNotMatch(dialog, /dismiss|resolve-alert|data-close-alert=/i, "only the panel closes, never an alert");
  const api = read("api/pipeline.js");
  assert.match(api, /if \(op === "system_alerts"\) \{/);
  assert.match(read("api/cron/auto-followups.js"), /const alerts = await SA\.runSystemAlerts\(\)\n      \.catch\(/, "runs on the 15-minute timer and can never stop the texts");
  assert.match(read("supabase/migrations/20260930120000_system_alerts_server_only.sql"), /using \(key <> 'system_alerts'\)/);
});

test("Joshua 2026-09-30 (A): the trainer is reminded on the client's follow-up clock - 15 min, 30 min, 24 h - never at night", () => {
  const P = require("../lib/pipeline.js");
  const at = (h, m = 0, d = 30) => Date.parse(`2026-09-${d}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00-04:00`);
  const l = (over = {}, pipe = {}) => ({ id: "00000000-0000-4000-8000-0000000000b2", status: "new_inquiry", trainer_slug: "eric-beck", created_at: new Date(at(10)).toISOString(),
    raw_payload: { pipeline: { entered_at: new Date(at(10)).toISOString(), ...pipe } }, ...over });
  assert.deepEqual(P.trainerWaitingReminderDue(l(), at(10, 10)), [], "nothing before 15 minutes");
  assert.deepEqual(P.trainerWaitingReminderDue(l(), at(10, 16)), ["tim"], "15 minutes: with the first client follow-up");
  assert.deepEqual(P.trainerWaitingReminderDue(l({}, { trainer_waiting_reminders: [{ step: "tim", status: "sent" }] }), at(10, 31)), ["link"], "30 minutes");
  assert.deepEqual(P.trainerWaitingReminderDue(l({}, { trainer_waiting_reminders: [{ step: "tim" }, { step: "link" }] }), at(10) + 24 * 3600 * 1000 + 60000), ["care"], "24 hours");
  assert.deepEqual(P.trainerWaitingReminderDue(l({ status: "office_contacted" }), at(10, 16)), [], "someone moved the card: it stops");
  assert.deepEqual(P.trainerWaitingReminderDue(l({ trainer_slug: null }), at(10, 16)), [], "no trainer: the office bell owns it");
  assert.deepEqual(P.trainerWaitingReminderDue(l({ raw_payload: { booking: { slot_start: "x" }, pipeline: { entered_at: new Date(at(10)).toISOString() } } }), at(10, 16)), [], "booked: it stops");
  const night = l({ created_at: new Date(at(20, 50)).toISOString() }, { entered_at: new Date(at(20, 50)).toISOString() });
  assert.deepEqual(P.trainerWaitingReminderDue(night, at(21, 10)), [], "never after 9 PM");
  assert.deepEqual(P.trainerWaitingReminderDue(night, Date.parse("2026-10-01T08:05:00-04:00")), ["tim", "link"], "8 AM: both overdue steps, sent as ONE text (the newest)");
  assert.deepEqual(P.trainerWaitingReminderDue(l({}, { entered_at: "2026-09-29T12:00:00Z" }), at(10, 16)), [], "the backlog before the switch is left alone");
  // The bell: New Inquiry after 15 minutes (the first follow-up moment).
  const w = SA.leadAlerts({ id: "x1", first_name: "Ann", status: "new_inquiry", assigned_trainer_name: "Eric Beck", created_at: new Date(NOW - 20 * 60 * 1000).toISOString(), raw_payload: { source_page: "contact.html", pipeline: { entered_at: new Date(NOW - 20 * 60 * 1000).toISOString(), new_lead_text: { status: "sent" } } } }, NOW);
  assert.equal(w[0]?.type, "waiting");
  const X = require("../lib/pipeline-texts.js");
  assert.equal(X.render(X.wordsFor(null, "trainer_waiting_reminder"), { first_name: "Ann", last_name: "Lee", phone: "(216) 555-0100", waited: "30 minutes", trainer_portal_link: "L" }),
    "⏰ Ann Lee is still waiting for a call (30 minutes since they came in).\n(216) 555-0100\nPlease call now, then move the card in your portal: L");
  const src = read("lib/pipeline.js");
  assert.match(src, /const step = due\[due\.length - 1\];/, "overdue steps go as one text");
});
