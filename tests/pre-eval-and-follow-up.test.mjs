// Rule 81 (Joshua 2026-09-14): the pre-evaluation questions after booking, and the saved (NOT sending)
// follow-up texts to leads that did not book. Run: node --test tests/   Nothing here talks to the real project.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "test-key";
process.env.SUPABASE_URL = process.env.SUPABASE_URL || "https://supabase.test";
process.env.LDTT_SANDBOX = "";
const root = resolve(import.meta.dirname, "..");
const read = path => readFileSync(resolve(root, path), "utf8");
const PE = require("../lib/pre-eval.js");
const R = require("../lib/reengage.js");
const metrics = require("../trainer-backoffice/metrics.js");
const { renderBookingPage } = require("../lib/booking-page.js");

test("pre-eval: only known questions, only listed choices, capped text, required safety answers", () => {
  const { answers, errors } = PE.cleanAnswers({
    top_behavior: "Pulls on the leash\u0000", behaviors: ["Jumping", "Hacking", "Pulling on leash"], how_often: "Hourly",
    disruption: "4", bite_history: "No", bite_details: "should be dropped", children: "Yes", other_animals: "No",
    medical: "No", medical_details: "dropped too", evil: "<script>", dogs: [{ time_with_family: "2 years", where_from: "Rescue" }, { where_from: "Mars" }]
  }, ["Snoop", "Bella"]);
  assert.deepEqual(errors, []);
  assert.equal(answers.top_behavior, "Pulls on the leash", "control bytes removed");
  assert.deepEqual(answers.behaviors, ["Pulling on leash", "Jumping"], "unknown choice dropped, list order kept");
  assert.equal(answers.how_often, "", "a choice that is not listed is dropped");
  assert.equal(answers.disruption, "4");
  assert.equal(answers.bite_details, "", "a follow-up box whose trigger is not met is dropped");
  assert.equal(answers.medical_details, "");
  assert.equal(answers.evil, undefined, "unknown keys never stored");
  assert.deepEqual(answers.dogs, [{ time_with_family: "2 years", where_from: "Rescue" }, { time_with_family: "", where_from: "" }]);
  assert.equal(PE.cleanAnswers({ top_behavior: "x".repeat(5000) }).answers.top_behavior.length, 2000);

  const missing = PE.cleanAnswers({}, []);
  assert.equal(missing.errors.length, 4, "#1 behavior, bite history, children, other animals");
  const bite = PE.cleanAnswers({ top_behavior: "x", bite_history: "Bite that broke skin", bite_details: "at the door", children: "No", other_animals: "No" });
  assert.equal(bite.answers.bite_details, "at the door");
  assert.deepEqual(PE.safetyFlags(bite.answers), ["Bite history: Bite that broke skin"]);
});

test("pre-eval: answer rows read like the form, per dog by name, blanks left out", () => {
  const { answers } = PE.cleanAnswers({ top_behavior: "Barking", bite_history: "No", children: "No", other_animals: "Yes", disruption: "3", dogs: [{ where_from: "Shelter" }] }, ["Snoop"]);
  const rows = PE.answerRows(answers, ["Snoop"]);
  assert.deepEqual(rows[0], ["Where did you get Snoop?", "Shelter"]);
  assert.ok(rows.some(([q, a]) => q.startsWith("How much does it disrupt") && a === "3 of 5"));
  assert.ok(!rows.some(([, a]) => a === "" || (Array.isArray(a) && !a.length)));
});

test("Sales: a booked lead with answers is Eval Questions Completed; the status and the booked total do not move", () => {
  const booked = { dbStatus: "evaluation_scheduled", status: "Evaluation Scheduled", rawPayload: { sales_pipeline: true, booking: { slot_start: "x" } } };
  const answered = { ...booked, rawPayload: { sales_pipeline: true, booking: { slot_start: "x", pre_eval: { submitted_at: "2026-09-14T12:00:00Z" } } } };
  assert.equal(metrics.salesStageFor(booked), "booked");
  assert.equal(metrics.salesStageFor(answered), "confirmed");
  assert.equal(answered.status, "Evaluation Scheduled");
  assert.equal(metrics.salesTotals([booked], []).booked, metrics.salesTotals([answered], []).booked);
  assert.equal(metrics.salesStageFor({ ...answered, dbStatus: "evaluation_complete" }), "evaluated", "only a booked lead moves");
});

test("booking page: the questions step and thank-you exist, the spec is embedded safely, the text link opens them", () => {
  const html = renderBookingPage("lorenzo-miller", { practice: true });
  assert.ok(html.indexOf('id="stepPre"') > html.indexOf('id="stepDone"') && html.indexOf('id="stepThanks"') > html.indexOf('id="stepPre"'));
  assert.match(html, /var PRE = \[\{"key":"dog"/);
  assert.doesNotMatch(html.slice(html.indexOf("var PRE = ")), /<\/script>[\s\S]*var PRE/, "no early script close");
  assert.match(html, /if \(STEP === "questions" && LEAD\) \{ if \(o\.pre_eval_done\) showThanks\(o\); else showPre\(o\); return; \}/);
  assert.match(html, /postJSON\(\{ op: "pre_eval", lead_id: LEAD, answers: a \}\)/);
  const script = html.slice(html.lastIndexOf("<script>") + 8, html.lastIndexOf("</script>"));
  assert.doesNotThrow(() => new Function(script), "the page script compiles");
  assert.match(read("lib/pipeline.js"), /pre_eval_link: `\$\{B\.bookUrl\(booking\.trainer_slug, lead\.id\)\}&step=questions`,/);
  assert.match(read("api/booking.js"), /if \(body\.op === "pre_eval"\) return await preEval\(req, res, body\);/);
  const preEval = read("api/booking.js").match(/async function preEval\([\s\S]*?\n\}\n/)[0];
  assert.doesNotMatch(preEval, /status:|eval_scheduled_at|booking_holds/, "never changes the status, the time or a hold");
  assert.match(preEval, /Please book your free evaluation first\./);
});

test("booking API: the questions answer 404 on live like every booking route", async () => {
  const handler = require("../api/booking.js");
  const res = { statusCode: 0, headers: {}, setHeader() {}, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; }, end() { return this; } };
  await handler({ method: "POST", headers: {}, query: {}, body: { op: "pre_eval", lead_id: "00000000-0000-4000-8000-000000000000", answers: {} } }, res);
  assert.equal(res.statusCode, 404);
});

const NOW = Date.parse("2026-09-14T16:00:00Z"); // noon Eastern
const lead = (extra = {}) => ({ id: "L", first_name: "Angela Marie", phone: "(440) 555-0101", sms_consent: true, status: "new_inquiry", created_at: new Date(NOW - 5 * 60000).toISOString(), raw_payload: {}, ...extra });

test("follow-up texts: saved wording, 15 / 30 min / 24 h, sending OFF and no send code at all", () => {
  assert.equal(R.SENDING_ENABLED, false);
  assert.deepEqual(R.STEPS.map(s => s.minutes), [15, 30, 1440]);
  assert.match(R.FOLLOW_UP_TEXT, /^Hi \{\{first_name\}\}, this is \{\{sender_name\}\} with Lorenzo's Dog Training Team\. You reached out to us through our website for help with your dog, and I wanted to connect with you\.\n\nAre you looking for help with training your dog\? If so, reply YES and I will help you get started\.$/);
  assert.equal(R.textFor(lead()), R.FOLLOW_UP_TEXT.replace("{{first_name}}", "Angela").replace("{{sender_name}}", "Tim") + "\n\nReply STOP to opt out.");
  const src = read("lib/reengage.js").replace(/\/\/[^\n]*/g, "");
  assert.doesNotMatch(src, /fetch\(|postHook|make\.com|twilio|require\(/i, "the planner cannot send anything");
  const followupBlock = read("api/pipeline.js").match(/if \(op === "followup"\) \{[\s\S]*?\n      \}/)[0].replace(/\/\/[^\n]*/g, "");
  assert.doesNotMatch(followupBlock, /method: "(POST|PATCH|DELETE)"|postHook|send/i, "the preview only reads");
});

test("follow-up texts: who qualifies", () => {
  assert.equal(R.eligibility(lead()).ok, true);
  assert.equal(R.eligibility(lead({ sms_consent: false })).reason, "No SMS consent.");
  assert.equal(R.eligibility(lead({ phone: "" })).reason, "No phone.");
  assert.equal(R.eligibility(lead({ status: "evaluation_scheduled" })).reason, "Not an open inquiry.");
  assert.equal(R.eligibility(lead({ status: "do_not_contact" })).ok, false);
  assert.equal(R.eligibility(lead({ raw_payload: { booking: { slot_start: "x" } } })).reason, "Already booked or requested.");
  assert.equal(R.eligibility(lead({ raw_payload: { booking: { requested_at: "x" } } })).ok, false);
  assert.equal(R.eligibility(lead({ raw_payload: { pipeline: { lane: { key: "recruiting", label: "Recruiting" } } } })).ok, false);
  assert.equal(R.eligibility(lead({ raw_payload: { qa: true } })).ok, false);
  assert.equal(R.eligibility(lead({ status: "office_contacted" })).ok, true);
});

test("follow-up texts: the next step, quiet hours, and the backlog", () => {
  assert.deepEqual(R.plan(lead(), NOW).next.step, 1, "5 minutes in: the 15-minute text is next");
  assert.equal(R.plan(lead({ created_at: new Date(NOW - 20 * 60000).toISOString() }), NOW).next.step, 2);
  assert.equal(R.plan(lead({ created_at: new Date(NOW - 3 * 3600000).toISOString() }), NOW).next.step, 3);
  const night = Date.parse("2026-09-15T03:30:00Z"); // 11:30 PM Eastern
  const moved = R.outOfQuietHours(night);
  assert.equal(new Date(moved).toISOString(), "2026-09-15T12:00:00.000Z", "waits until 8 AM Eastern");
  assert.equal(R.outOfQuietHours(NOW), NOW, "daytime is not moved");
  const old = R.plan(lead({ status: "office_contacted", created_at: "2026-09-01T12:00:00Z" }), NOW);
  assert.equal(old.group, "backlog");
  const p = R.preview([lead(), lead({ status: "office_contacted", created_at: "2026-09-01T12:00:00Z" }), lead({ sms_consent: false })], NOW);
  assert.deepEqual(p.counts, { new: 1, backlog: 1, backlog_contacted: 1, not_eligible: 1 });
  assert.equal(p.sending, false);
});

