// Office report 2026-09-28: "Delivery Google: Failed - Google Form response Sheet returned 400". The office Google Form
// refuses a row with an empty required answer or a choice not on its list. Every e-book download and every Contact Us
// "Referred by a past client" / "Is a past client" failed. Only the Google copy is fitted; the lead itself is unchanged.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "test-key";
const { entriesForGoogleSheet } = require("../api/form-delivery.js");

test("an e-book download fills every required Google answer and keeps the real request in Comments", () => {
  const out = entriesForGoogleSheet("contact", { first_name: "Ann", last_name: "Lee", email: "a@x.com", phone: "(216) 555-1234",
    i_want_to: "Download the free 5-step calm dog blueprint", heard_about_us: "Paid ads market page", vet_or_previous_client: "Free ebook landing page", sms_consent: "no" });
  for (const key of ["address_line_1", "city", "state", "zip"]) assert.equal(out[key], "Not given", key);
  assert.equal(out.i_want_to, "Schedule a free phone consultation to receive more information");
  assert.equal(out.heard_about_us, "Other");
  assert.equal(out.heard_about_us_other, "Paid ads market page");
  assert.match(out.comments, /^Website request: Download the free 5-step calm dog blueprint/);
  assert.match(out.comments, /SMS opt-in: No/);
});

test("past-client answers become the Google choice 'A Former Client'; Google's own choices pass unchanged", () => {
  for (const heard of ["Referred by a past client", "Is a past client"]) {
    assert.equal(entriesForGoogleSheet("contact", { heard_about_us: heard, i_want_to: "Schedule an in person evaluation with a trainer in my area" }).heard_about_us, "A Former Client");
  }
  const ok = entriesForGoogleSheet("contact", { last_name: "L", address_line_1: "1 Main", city: "C", state: "OH", zip: "44101", email: "e@x.com", phone: "2165551234",
    heard_about_us: "Google Search", i_want_to: "Schedule an in person evaluation with a trainer in my area", comments: "hi" });
  assert.equal(ok.heard_about_us, "Google Search");
  assert.equal(ok.i_want_to, "Schedule an in person evaluation with a trainer in my area");
  assert.equal(ok.address_line_1, "1 Main");
  assert.match(ok.comments, /^hi/);
});

test("trainer applications are untouched", () => {
  const out = entriesForGoogleSheet("trainer_application", { first_name: "T", heard_about_us: "Referred by a past client" });
  assert.equal(out.heard_about_us, "Referred by a past client");
  assert.equal(out.city, undefined);
});
