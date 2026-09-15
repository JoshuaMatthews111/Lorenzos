// Rule 88 (office 2026-09-15 audit; meeting 2026-09-14; Rachel's "Updated Sandbox Notes"): times follow where the
// client is (calendar, typed eval time, email), the full address is required, the eval time stays at every status,
// and unticking Do Not Contact restores the lead's old status. Run: node --test tests/
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const require = createRequire(import.meta.url);
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "test-key";
const read = path => readFileSync(resolve(import.meta.dirname, "..", path), "utf8");
const Z = require("../lib/zip-timezone.js");

test("a typed eval time is read in the lead's zone, and shown back in it", () => {
  assert.equal(Z.wallTimeToIso("2026-09-17T08:00", "America/Chicago"), "2026-09-17T13:00:00.000Z");
  assert.equal(Z.wallTimeToIso("2026-09-17T08:00", "America/New_York"), "2026-09-17T12:00:00.000Z");
  assert.equal(Z.wallTimeToIso("2026-12-17T08:00", "America/Los_Angeles"), "2026-12-17T16:00:00.000Z");
  assert.equal(Z.wallTimeOf("2026-09-17T13:00:00.000Z", "America/Chicago"), "2026-09-17T08:00");
  assert.equal(Z.zoneLongName("America/Chicago", "2026-09-17T13:00:00Z"), "Central Daylight Time");
  const app = read("trainer-backoffice/app.js");
  assert.match(app, /const iso = evalAt\.value \? \(window\.LDTT_ZIP_TIMEZONE\?\.wallTimeToIso\(evalAt\.value, zone\) \|\| ""\) : "";/);
  assert.match(app, /value="\$\{escapeHtml\(datetimeLocalValue\(lead\.evalScheduledAt, leadTimeZone\(lead\)\)\)\}"/);
  assert.ok(!/your computer's time zone; shows on the Eval Scheduled card/.test(app));
});

test("the booking calendar shows the client's zone; the training center keeps the trainer's", () => {
  const api = read("api/booking.js");
  assert.match(api, /display_time_zone: displayZone,/);
  assert.match(api, /const displayIsClient = askedLocation !== "training_center" && Boolean\(B\.zipTimeZone\(askedZip\)\);/);
  const page = read("lib/booking-page.js");
  assert.ok(!/cal\.time_zone\b(?! \|\|)/.test(page.replace(/cal\.display_time_zone \|\| cal\.time_zone/g, "")), "every calendar time uses calZone()");
  assert.match(page, /cal\.display_is_client \? ", your time zone\."/);
  assert.match(page, /"&zip=" \+ encodeURIComponent\(/);
});

test("the full address: street, city, state and ZIP required; one full line downstream", () => {
  const B = require("../lib/booking.js");
  const base = { first_name: "A", last_name: "B", phone: "4405550100", email: "a@b.co" };
  const dog = { name: "Rex", sex: "Male", fixed: "Yes", vaccinated: "Yes", age: "3", age_unit: "Years", breed: "Lab", behavior: "Pulls" };
  const missing = B.validateEvalForm({ client: { ...base, address: "7519 Mentor Ave" }, dogs: [dog], location: "in_home" }, { locations: ["in_home"] });
  assert.ok(missing.errors.includes("City is required.") && missing.errors.includes("State is required.") && missing.errors.includes("ZIP code is required."));
  const ok = B.validateEvalForm({ client: { ...base, address: "7519 Mentor Ave", city: "Mentor", state: "OH", zip: "44060" }, dogs: [dog], location: "in_home" }, { locations: ["in_home"] });
  assert.deepEqual(ok.errors, []);
  assert.equal(ok.value.client.address, "7519 Mentor Ave, Mentor, OH 44060");
  assert.equal(ok.value.client.street, "7519 Mentor Ave");
  const LF = require("../lib/lead-forms.js");
  assert.deepEqual(LF.defaultFields("booking_eval").filter(f => f.group === "client").map(f => f.key), ["first_name", "last_name", "phone", "email", "address", "city", "state", "zip"]);
});

test("the office email spells out the zone, local received time and Track 500", () => {
  const M = require("../lib/office-email.js");
  const email = M.buildBookingEmail({ lead: { id: "l1", created_at: "2026-09-15T13:05:00Z", raw_payload: { pipeline: { entered_at: "x" } } }, booking: { when_label: "Thu, Sep 17, 8:00 AM CDT", slot_start: "2026-09-17T13:00:00Z", local_time_zone: "America/Chicago", trainer_name: "Lorenzo Miller", client: { first_name: "Sam", last_name: "Carter", address: "12 Main St, Destin, FL 32541" }, dogs: [] } });
  assert.match(email.text, /Time zone: Central Daylight Time/);
  assert.match(email.text, /Request received: Sep 15, 2026, 8:05 AM CDT/);
  assert.match(email.text, /Track 500: Yes/);
  assert.match(email.text, /Physical address: 12 Main St, Destin, FL 32541/);
});

test("the eval time stays at every status; unticking Do Not Contact restores the old status", () => {
  const app = read("trainer-backoffice/app.js");
  const line = app.slice(app.indexOf("function leadCardEvalLine(lead) {"), app.indexOf("function leadAlphaToggle"));
  assert.ok(!/if \(lead\.status !== "Evaluation Scheduled"\) return "";/.test(line));
  assert.match(app, /rawPayload\.status_before_dnc = current\?\.status && current\.status !== "Do Not Contact"/);
  assert.match(app, /status: dnc\.checked \? "Do Not Contact" : restore, rawPayload/);
});
