// Joshua 2026-09-23: "even the old ad pages have the same flow as the 2.0 pages when booking is made
// and the forms filled are the new one we made with the asterisks and same stage by stage and same
// processes." The 12 built-in market pages (dog-training-<city>.html) and every Page Studio ad page
// (page_type "ad") now carry the SAME evaluation form the 2.0 pages carry — required boxes wear the
// red asterisk, the rest say "(optional)", trainers appear under the ZIP box — posting to the same
// /api/booking-lead door (createLead: sameRequest reuse, needs-a-call stamping, ZIP routing, texts +
// email twins) and carrying on into /book via the answered book_url (assets/v2/v2.js).
// The Contact page's frozen FormSubmit flow is untouched (rule 73 pins its bytes elsewhere).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const read = path => readFileSync(resolve(import.meta.dirname, "..", path), "utf8");
const template = require("../lib/ad-page-template.js");

const marketFiles = readdirSync(resolve(import.meta.dirname, ".."))
  .filter(f => /^dog-training-[a-z-]+\.html$/.test(f));

test("the shared ad template renders the 2.0 evaluation form, not the old FormSubmit form", () => {
  const html = template.renderAdPage(template.marketToContent(template.markets[0]));
  const form = (html.match(/<form class="ad-form-card ad-form-card-v2 lead booking-intake"[\s\S]*?<\/form>/) || [""])[0];
  assert.ok(form, "the booking-intake form is on the page");
  assert.match(form, /data-kind="evaluation"/);
  assert.match(form, /data-endpoint="\/api\/booking-lead"/, "same door as the 2.0 pages (createLead)");
  assert.ok(!/formsubmit\.co/.test(form), "no FormSubmit action on the new form");
  assert.ok(!/name="i_want_to"/.test(form), "the old question set is gone");
  // asterisks + (optional), server-rendered so a curl can prove them on live
  for (const field of ["first_name", "last_name", "phone", "email", "address", "city", "zip"]) {
    assert.match(form, new RegExp(`<span class="required-mark" aria-hidden="true">\\*</span><(?:input|select)[^>]*name="${field === "city" ? "city" : field}"`), `${field} wears the red asterisk`);
  }
  assert.match(form, /<span class="required-mark" aria-hidden="true">\*<\/span><select name="state"/, "state wears it too");
  assert.equal((form.match(/class="optional-mark"/g) || []).length, 2, "dog name + problem say (optional)");
  // tel keyboard, address autofill, trainers-near-you area, SMS consent (single use case, rule 47)
  assert.match(form, /name="phone" type="tel" autocomplete="tel" inputmode="tel" required/);
  assert.match(form, /name="address" autocomplete="street-address"/);
  assert.match(form, /data-trainer-pick data-endpoint="\/api\/booking"/, "the ZIP box shows trainers near them");
  assert.match(form, /name="sms_consent"/);
  assert.ok(!/promotional|offers/i.test(form), "consent wording stays single-use-case (rule 47)");
  assert.match(form, /follow-up on my inquiry, scheduling and confirming my free consultation or evaluation, and appointment reminders/);
  assert.match(form, /Phone is required so Lorenzo's office can call about your request\./);
  // the same script the 2.0 pages use drives it (validation, phone format, picker, book_url redirect)
  assert.match(html, /assets\/v2\/v2\.js\?v=/, "assets/v2/v2.js is loaded");
  // the pixel Lead event and Google conversion still fire for the new class
  assert.match(html, /f\.classList\.contains\('contact-intake'\) \|\| f\.classList\.contains\('booking-intake'\)/);
  assert.match(html, /form\.classList\.contains\('contact-intake'\) \|\| form\.classList\.contains\('booking-intake'\)/);
  assert.equal((html.match(/eventID: id/g) || []).length, 2, "rule 12: one event ID, browser + server shape unchanged");
});

test("every generated market page carries the new form and none carries the old one", () => {
  assert.equal(marketFiles.length, 15, "the 15 built-in market pages (2026-09-26: +Navarre, Dallas, Durham, Flushing; Ann Arbor now 308s to /contact)");
  for (const file of marketFiles) {
    const html = read(file);
    assert.match(html, /class="ad-form-card ad-form-card-v2 lead booking-intake"/, file);
    assert.match(html, /data-endpoint="\/api\/booking-lead"/, file);
    assert.match(html, /required-mark/, file);
    assert.ok(!html.includes('data-google-form-endpoint'), `${file}: the old market form is gone`);
    assert.match(html, /assets\/v2\/v2\.js\?v=/, file);
  }
});

test("the practice copy lets the new form through (selector) and v2.js carries the UTM + zip-prefill additions", () => {
  const script = read("script.js");
  assert.match(script, /const PRACTICE_LEAD_FORM_SELECTOR='\.contact-intake,\.market-guide-form,\.ad-exit-form,\.office-lead-form,\.booking-intake';/,
    "script.js never switches the booking form off on the practice copy");
  const v2 = read("assets/v2/v2.js");
  assert.match(v2, /utm_source: qs\.get\("utm_source"\) \|\| ""/, "the ad click's UTM tags ride with the lead again");
  assert.match(v2, /var presetZip = String\(qs\.get\("zip"\) \|\| ""\)/, "a ?zip= link lands prefilled (re-engage)");
  // exit-popup suppression counts a started booking form too
  assert.match(read("ad-funnel.js"), /\.booking-intake input, \.booking-intake select, \.booking-intake textarea/);
});

test("the quiz test pages (lp-test-*) keep their own old form on purpose — listed, not converted", () => {
  for (const file of ["lp-test-pensacola-fl.html", "lp-test-cleveland-oh.html"]) {
    assert.match(read(file), /contact-intake lp-form/, `${file} still carries its quiz form`);
  }
  // and their generator's marker follows the new form class so a future regeneration still works
  assert.match(read("scripts/generate-lp-test.mjs"), /ad-form-card ad-form-card-v2 lead booking-intake/);
});
