// Joshua 2026-09-15: "production is not used for team emails ... production get the leads as well so they can log it
// into Alpha, not a part of my every day teams." Production (Alpha intake) is its own box: every new pipeline lead
// (not Contact Us: FormSubmit already sends those) + a copy of every booking. Run: node --test tests/
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "test-key";
const P = require("../lib/pipeline.js");
const M = require("../lib/office-email.js");
const read = path => readFileSync(resolve(import.meta.dirname, "..", path), "utf8");
const PROD = "production@lorenzosdogtrainingteam.com";

test("Production is not on the team list; it is the Alpha intake box", () => {
  const d = P.defaultSettings();
  assert.equal(d.recipients[0].email, "marketing@lorenzosdogtrainingteam.com");
  assert.ok(!d.recipients.some(r => r.email === PROD), "not a team line");
  assert.equal(d.alpha_email, PROD);
  assert.equal(P.normalizeSettings({ recipients: [] }).value.alpha_email, PROD, "an older saved row gets production@");
  assert.equal(P.normalizeSettings({ recipients: [], alpha_email: "" }).value.alpha_email, "", "clearing the box stops it");
  assert.equal(P.normalizeSettings({ recipients: [], alpha_email: "nope" }).errors.length, 1);
});

test("who gets what: new lead -> Production only; booking -> team + Production; practice -> the test address", () => {
  const s = { recipients: [{ label: "Marketing", email: "marketing@x.co" }, { label: "Tim", email: "tim@x.co" }], alpha_email: PROD, practice_email_to: "" };
  assert.deepEqual(P.emailRecipients(s, false, "new_lead").to, [PROD]);
  assert.deepEqual(P.emailRecipients(s, false, "").to, ["marketing@x.co", "tim@x.co", PROD]);
  assert.deepEqual(P.emailRecipients({ ...s, alpha_email: "tim@x.co" }, false, "").to, ["marketing@x.co", "tim@x.co"], "no double");
  assert.deepEqual(P.emailRecipients({ ...s, alpha_email: "" }, false, "new_lead").to, [], "box cleared: no new-lead email");
  const practice = P.emailRecipients({ ...s, practice_email_to: "test@x.co" }, true, "new_lead");
  assert.deepEqual(practice.to, ["test@x.co"]);
  assert.deepEqual(practice.redirectedFrom, [PROD]);
});

test("the New lead email: Track 500, the Alpha step, the client's local time, no booking claims", () => {
  const lead = { id: "11111111-2222-3333-4444-555555555555", first_name: "Sam", last_name: "Carter", phone: "4405550100", email: "s@c.co", zip: "32550", sms_consent: true, created_at: "2026-09-15T14:00:00Z", source_page: "https://ldtt-ads-v2-sandbox.vercel.app/miramar-beach", raw_payload: { dog_name: "Rex", problem: "Pulling" } };
  const e = M.buildNewLeadEmail({ lead, staffLink: "https://x/staff?lead=1", practice: true, redirectedFrom: [PROD], pipeline: { book_url: "https://x/book", new_lead_text: { status: "sent" } } });
  assert.match(e.subject, /^\[PRACTICE COPY\] Track 500 · New lead: Sam Carter, ZIP 32550$/);
  assert.ok(e.text.includes("Log this lead into Alpha"));
  assert.ok(e.text.includes("Time zone: Central Daylight Time"));
  assert.ok(e.text.includes("Booking link texted to the client."));
  assert.ok(e.text.includes("Dog name: Rex"));
  assert.ok(!/Eval booked/.test(e.text));
  assert.equal(M.buildBookingEmail({ lead, kind: "new_lead" }).subject.includes("New lead"), true, "the queue's builder routes kind new_lead");
});

test("enterPipeline queues it; Contact Us is skipped (FormSubmit already emails production@)", () => {
  const src = read("lib/pipeline.js");
  assert.match(src, /await queueNewLeadEmail\(won\)\.catch/);
  assert.match(src, /if \(!lead \|\| isContactUsLead\(lead\)\) return \{ status: "skipped" \};/);
  assert.match(src, /hold_id: "new_lead", kind: "new_lead"/);
  assert.match(src, /emailRecipients\(settings, isSandbox\(\), notice\.kind \|\| ""\)/);
  assert.match(read("trainer-backoffice/app.js"), /data-pipeline-alpha-email/);
});
