// Rule 86 (office 2026-09-15; meeting 2026-09-14 49:30-51:30 and 52:00-56:00; Rachel's "Updated Sandbox Notes"):
// every eval time shows in the lead's local time zone from the ZIP (texts included), and each dog has Age units
// (weeks / months / years) shown beside Age in Rachel's order. Run: node --test tests/
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "test-key";
const Z = require("../lib/zip-timezone.js");
const read = path => readFileSync(resolve(import.meta.dirname, "..", path), "utf8");

test("ZIP -> time zone, including the split areas the 2.0 markets sit in", () => {
  const cases = {
    "44060": "America/New_York", "44128": "America/New_York", "48104": "America/New_York",
    "32550": "America/Chicago", "32407": "America/Chicago", "32301": "America/New_York", // Panhandle Central, Tallahassee Eastern
    "60601": "America/Chicago", "37203": "America/Chicago", "37902": "America/New_York", "46204": "America/New_York",
    "46320": "America/Chicago", "79901": "America/Denver", "85001": "America/Phoenix", "90210": "America/Los_Angeles",
    "83814": "America/Los_Angeles", "30303": "America/New_York"
  };
  for (const [zip, zone] of Object.entries(cases)) assert.equal(Z.timeZoneForZip(zip), zone, zip);
  assert.equal(Z.timeZoneForZip("123"), "");
  assert.equal(Z.timeZoneForZip(""), "");
  assert.equal(Z.zoneAbbr("2026-09-17T12:00:00Z", "America/Chicago"), "CDT");
  assert.equal(Z.zoneAbbr("2026-12-17T12:00:00Z", "America/Los_Angeles"), "PST");
});

test("the booking keeps the local zone and writes the time in it; texts use it", () => {
  const api = read("api/booking.js");
  assert.match(api, /const localTimeZone = B\.localTimeZone\(\{ location, zip: /);
  assert.match(api, /const whenLabel = B\.formatWhen\(slotIso, localTimeZone\);/);
  assert.match(api, /local_time_zone: localTimeZone,/);
  const lib = read("lib/booking.js");
  assert.match(lib, /function localTimeZone\(\{ location, zip, address, setting \}\) \{/);
  const B = require("../lib/booking.js");
  const setting = { time_zone: "America/New_York" };
  assert.equal(B.localTimeZone({ location: "in_home", zip: "32550", setting }), "America/Chicago");
  assert.equal(B.localTimeZone({ location: "in_home", zip: "", address: "12 Main St, Destin, FL 32541", setting }), "America/Chicago");
  assert.equal(B.localTimeZone({ location: "training_center", zip: "32550", setting }), "America/New_York", "the training center keeps the trainer's zone");
  assert.equal(B.localTimeZone({ location: "in_home", zip: "", setting }), "America/New_York");
  const pipe = read("lib/pipeline.js");
  assert.equal((pipe.match(/booking\?\.local_time_zone \|\| booking\?\.time_zone \|\| setting\?\.time_zone \|\| "America\/New_York"/g) || []).length, 2, "the trainer text and Tim's text");
  const app = read("trainer-backoffice/app.js");
  assert.match(app, /function leadTimeZone\(lead\) \{/);
  assert.match(app, /const label = leadEvalLabel\(lead\.evalScheduledAt, leadTimeZone\(lead\)\);/);
  for (const shell of ["staff.html", "trainer-backoffice/index.html"]) assert.match(read(shell), /lib\/zip-timezone\.js\?v=/, shell);
});

test("age units: a required Weeks / Months / Years choice right after Age; cards and email in Rachel's order", () => {
  const LF = require("../lib/lead-forms.js");
  const keys = LF.defaultFields("booking_eval").filter(f => f.group === "dog").map(f => f.key);
  assert.deepEqual(keys, ["name", "sex", "fixed", "vaccinated", "age", "age_unit", "breed", "behavior"]);
  const unit = LF.defaultFields("booking_eval").find(f => f.key === "age_unit");
  assert.deepEqual([unit.type, unit.required, unit.choices], ["select", true, ["Weeks", "Months", "Years"]]);
  // A form saved before this change gets Age units right after Age, not at the end.
  const old = LF.defaultFields("booking_eval").filter(f => f.key !== "age_unit");
  const merged = LF.normalizeFields("booking_eval", old, { previous: old, trustRemoved: true }).fields.filter(f => f.group === "dog").map(f => f.key);
  assert.deepEqual(merged, keys);
  const B = require("../lib/booking.js");
  const form = B.validateEvalForm({ client: { first_name: "A", last_name: "B", phone: "4405550100", email: "a@b.co", address: "1 Main St, Cleveland, OH 44128" }, dogs: [{ name: "Rex", sex: "Male", fixed: "Yes", vaccinated: "Yes", age: "3", breed: "Lab", behavior: "Pulls" }], location: "in_home" }, { locations: ["in_home"] });
  assert.ok(form.errors.some(e => /Age units is required/.test(e)), "age units is required");
  const ok = B.validateEvalForm({ client: { first_name: "A", last_name: "B", phone: "4405550100", email: "a@b.co", address: "1 Main St" }, dogs: [{ name: "Rex", sex: "Male", fixed: "Yes", vaccinated: "Yes", age: "3", age_unit: "Months", breed: "Lab", behavior: "Pulls" }], location: "in_home" }, { locations: ["in_home"] });
  assert.equal(ok.value.dogs[0].age_unit, "Months");
  const app = read("trainer-backoffice/app.js");
  const order = /row\("Sex", dog\??\.sex\)\}\$\{row\("Spayed\/Neutered\?", dog\??\.fixed\)\}\$\{row\("Age", dog\??\.age\)\}\$\{row\("Age units", dog\??\.age_unit\)\}\$\{row\("Breed", dog\??\.breed\)\}\$\{row\("Vaccinations up to date\?", dog\??\.vaccinated\)\}/g;
  assert.equal((app.match(order) || []).length, 2, "office lead details + trainer lead details");
  assert.match(read("lib/office-email.js"), /\["age", "Age"\], \["age_unit", "Age units"\], \["breed", "Breed"\], \["vaccinated", "Vaccinations up to date\?"\]/);
});
