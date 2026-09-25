// "Not sent because..." on the lead journey (Joshua, Zoom 2026-09-24): on the call a lead card's journey showed a
// text as "not sent" with no explanation. Every not-sent line in "What happened with this person" (rule 87) now
// says WHY in plain words, from the reason the pipeline already recorded (lib/pipeline.js). Nothing is invented.
// Run: node --test tests/   Nothing here talks to the real project.
import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const app = readFileSync(resolve(root, "trainer-backoffice/app.js"), "utf8");
const fn = name => app.match(new RegExp(`function ${name}\\(.*\\) \\{\\n[\\s\\S]*?\\n\\}\\n`))[0];
const constant = name => app.match(new RegExp(`const ${name} = [\\[{][\\s\\S]*?[\\]}];\\n`))[0];

function load() {
  const ctx = {
    leadRawPayload: lead => lead.rawPayload || {}, formatDateTime: v => String(v || ""),
    leadEvalLabel: () => "Fri 10 AM", leadTimeZone: () => "America/New_York"
  };
  vm.runInNewContext(`${constant("JOURNEY_NOT_SENT_REASONS")}\n${fn("journeyNotSentReason")}\n${fn("journeyNotePart")}\n${fn("journeyWhen")}\n${fn("journeyStepState")}\nthis.api = { journeyNotSentReason, journeyStepState };`, ctx);
  return ctx.api;
}
const { journeyNotSentReason: plain, journeyStepState: step } = load();

test("the reasons the pipeline records read as plain words", () => {
  const cases = [
    ["No SMS consent: no texts.", {}, "the client did not agree to texts"],
    ["Customer: no SMS consent, no customer text.", {}, "the client did not agree to texts"],
    ["No textable phone number.", { phone: "" }, "no phone number on file"],
    ["No textable phone number.", { phone: "555-12" }, "the phone number on file cannot exist (it is not a 10-digit US number)"],
    ["Not a dialable US number (area code or exchange starts with 0 or 1): no text, the email still goes.", {}, "the phone number cannot exist (its area code or exchange is not a real US one)"],
    ["No Operations phone on live is saved in Settings (operations_phone): no Operations text.", {}, "no phone number is saved for Lorenzo (Operations) in Settings"],
    ["Trainer alert: Michael King is still on the shared office number — no trainer text until their real number is loaded.", {}, "the trainer's own phone number is not loaded yet (they are still on the office line)"],
    ["Trainer alert: trainer has no phone on file (Jane Doe).", {}, "the trainer has no phone number on file"],
    ["The Make pathway 1 address is not set on this deployment.", {}, "the texting connection is not set up on this site"],
    ["The Operations Make address is not set on this deployment.", {}, "the texting connection is not set up on this site"],
    ["Make answered 400: Bad request", {}, "the texting service refused it (error 400)"],
    ["Free phone consultation: no booking-link text.", {}, "this kind of request does not get a booking link"],
    ["No calendar trainer for this lead: no trainer text.", {}, "no trainer with a calendar was matched to this lead"],
    ["Practice copy: ...1234 is not an active tester phone.", {}, "practice copy: that phone is not on the tester list, so nothing was sent to it"],
    ["", {}, "no reason was recorded"],
    ["Something new the pipeline says.", {}, "Something new the pipeline says"]
  ];
  for (const [reason, lead, words] of cases) assert.equal(plain(reason, lead), words, reason);
});

test("every not-sent line on the journey carries its plain reason; none is a bare \"Not sent\"", () => {
  const lead = { phone: "", smsConsent: false, rawPayload: { pipeline: {
    entered_at: "2026-09-24T12:00:00Z",
    new_lead_text: { status: "skipped", reason: "No SMS consent: no texts." },
    ops_new_lead: { status: "skipped", reason: "No Operations phone on live is saved in Settings (operations_phone): no Operations text." },
    booking_notices: [{ texts: { status: "skipped", reason: "Customer: no SMS consent, no customer text. Trainer alert: Michael King is still on the shared office number — no trainer text until their real number is loaded.", notes: "" },
      ops_alert: { status: "failed", reason: "Make answered 500: error" }, office_email: { status: "skipped", reason: "No address is saved for this email in Settings." } }]
  }, booking: { slot_start: "2026-09-25T14:00:00Z" } } };
  const got = key => step({ key }, lead).detail;
  assert.equal(got("link"), "Not sent: the client did not agree to texts");
  assert.equal(got("ops_new"), "Not sent: no phone number is saved for Lorenzo (Operations) in Settings");
  assert.equal(got("confirm"), "Not sent: the client did not agree to texts", "the customer half of the notes");
  assert.equal(got("alert"), "Not sent: the trainer's own phone number is not loaded yet (they are still on the office line)", "the trainer half");
  assert.equal(got("ops_booked"), "Not sent (it failed): the texting service refused it (error 500)");
  assert.equal(got("email"), "Not sent: no email address is saved for it in Settings");
  // No record at all: says so plainly.
  const bare = { rawPayload: { pipeline: {} } };
  for (const key of ["care", "ops_new"]) assert.match(step({ key }, bare).detail, /^Not sent: nothing was recorded for this step/);
  // The source never falls back to a bare "Not sent".
  assert.doesNotMatch(fn("journeyStepState"), /detail: "Not sent"/);
  assert.match(fn("leadPipelineNotices"), /journeyNotSentReason\(item\.reason \|\| item\.notes, lead\)/, "the office notices use the same words");
});
