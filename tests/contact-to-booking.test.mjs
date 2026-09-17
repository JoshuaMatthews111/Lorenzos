// Meeting 2026-09-16 (Lorenzo, Missy, Rachel): on the PRACTICE COPY, a Contact Us submit whose "I want to..."
// answer is a booking lane goes straight into the booking flow (/book?lead=&zip=), prefilled, instead of
// stopping at "the office will contact you". Source assertions against script.js and lib/booking-page.js:
//   1. the redirect helper exists only in the practice block and refuses unless window.LDTT_IS_SANDBOX;
//   2. it fires only for .contact-intake forms whose answer is one of the three booking answers - never for
//      the phone-consultation or become-a-trainer answers, never for the recruiting form;
//   3. the live Contact handler, FormSubmit / Google Sheet / portal deliveries and the PDF opt-in forms are
//      untouched (the byte-for-byte hashes live in tests/office-email.test.mjs; here we check the practice
//      block still never names them);
//   4. the booking page pre-fills the ZIP step and the client details from the lead (/api/booking?lead=).
// Run: node --test tests/   Nothing here talks to the real project.
import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = path => readFileSync(resolve(import.meta.dirname, "..", path), "utf8");
const block = (s, a, b) => { const i = s.indexOf(a); const j = s.indexOf(b, i); assert.ok(i >= 0 && j > i, `block ${a}`); return s.slice(i, j); };

const script = read("script.js");
const practice = block(script, "const enterPracticePipeline=", "const updateStoredDelivery=");

// The helper, run in a bare sandbox so its decisions can be checked.
function helper({ sandbox }) {
  const code = block(script, "const CONTACT_BOOKING_ANSWERS=", "const practiceContactEntries=") + "\nthis.practiceBookingUrl=practiceBookingUrl;this.contactAnswerBooks=contactAnswerBooks;";
  const ctx = { window: { LDTT_IS_SANDBOX: sandbox }, String, Array, encodeURIComponent };
  vm.runInNewContext(code, ctx);
  return ctx;
}
const contactForm = { matches: sel => sel === ".contact-intake" };
const recruitingForm = { matches: sel => sel === ".trainer-application-form" };
const canonical = { lead_id: "00000000-0000-4000-8000-000000000042" };

test("the redirect lives in the practice block, behind LDTT_IS_SANDBOX, and the live Contact handler is untouched", () => {
  assert.match(practice, /const practiceBookingUrl=\(form,entries,canonical,pipeline\)=>\{\n  if\(!window\.LDTT_IS_SANDBOX\) return '';/);
  assert.match(practice, /const bookingUrl=practiceBookingUrl\(form,entries,canonical,pipeline\);\n    if\(bookingUrl\)\{/);
  assert.match(practice, /say\('Saved\. Taking you to pick your trainer and time…','success'\);\n      window\.location\.assign\(bookingUrl\);\n      return;/);
  // Only the practice capture listener (sandbox only) reaches submitPracticeContact.
  assert.match(practice, /publicEnvironment\.then\(env=>\{\n  if\(!env\?\.sandbox\) return;/);
  // The redirect happens AFTER the lead is saved and the pipeline enter ran, never before.
  assert.ok(practice.indexOf("await enterPracticePipeline(canonical,entries)") < practice.indexOf("const bookingUrl=practiceBookingUrl("));
  // The live handler never redirects and never names the helper.
  const live = block(script, "const contactForm=document.querySelector", "document.querySelectorAll('a[href=\"contact.html#form\"]')");
  assert.doesNotMatch(live, /practiceBookingUrl|location\.assign|\/book\?/);
  assert.doesNotMatch(block(script, "const wireAsyncForm=", "const relayFormDeliveries="), /practiceBookingUrl|location\.assign/);
  // The practice block still never posts to FormSubmit / form-delivery (the Google Sheet + inbox fan-out).
  assert.ok(!/formsubmit|form-delivery|relayFormDeliveries\(/i.test(practice));
  // window.location.assign appears in script.js only inside the practice block.
  assert.equal(script.split("window.location.assign(bookingUrl)").length, 2);
});

test("booking answers redirect; phone consultation and become-a-trainer keep the thank-you; recruiting form never redirects", () => {
  const { practiceBookingUrl, contactAnswerBooks } = helper({ sandbox: true });
  const answers = read("contact.html").match(/<select required name="i_want_to">([\s\S]*?)<\/select>/)[1].match(/<option>([^<]+)<\/option>/g).map(o => o.replace(/<\/?option>/g, ""));
  assert.equal(answers.length, 5, "the five Contact Us answers");
  const booking = answers.filter(contactAnswerBooks);
  assert.deepEqual(booking, [
    "Schedule an in person evaluation with a trainer in my area",
    "Schedule a virtual evaluation",
    "Schedule a training session with my dog trainer"
  ]);
  assert.equal(contactAnswerBooks("Schedule a free phone consultation to receive more information"), false);
  assert.equal(contactAnswerBooks("Learn more about becoming a dog trainer"), false);
  // Same answers as the server's lane table (lib/pipeline.js CONTACT_US_LANES).
  const lanes = read("lib/pipeline.js");
  for (const a of booking) assert.match(lanes, new RegExp(`answer: "${a}", lane: "booking"`));
  assert.match(lanes, /answer: "Schedule a free phone consultation to receive more information", lane: "office_call"/);
  assert.match(lanes, /answer: "Learn more about becoming a dog trainer", lane: "recruiting"/);

  for (const a of booking) {
    assert.equal(practiceBookingUrl(contactForm, { i_want_to: a, zip: "44105" }, canonical, { ok: true, book_url: null }), "/book?lead=00000000-0000-4000-8000-000000000042&zip=44105");
  }
  // No ZIP typed: the page still opens on the ZIP step with the lead's ZIP from /api/booking?lead=.
  assert.equal(practiceBookingUrl(contactForm, { i_want_to: booking[0], zip: "" }, canonical, {}), "/book?lead=00000000-0000-4000-8000-000000000042");
  // ZIP is digits only, 5 max, URL-safe.
  assert.equal(practiceBookingUrl(contactForm, { i_want_to: booking[0], zip: "44105-1234&x=1" }, canonical, {}), "/book?lead=00000000-0000-4000-8000-000000000042&zip=44105");
  // The pipeline's own book_url (a routed trainer) wins when it answers one.
  assert.equal(practiceBookingUrl(contactForm, { i_want_to: booking[1], zip: "44105" }, canonical, { book_url: "https://ldtt-sandbox.vercel.app/book/fred-harris?lead=x" }), "https://ldtt-sandbox.vercel.app/book/fred-harris?lead=x");
  // Phone consultation / become-a-trainer: no redirect (today's thank-you).
  assert.equal(practiceBookingUrl(contactForm, { i_want_to: "Schedule a free phone consultation to receive more information", zip: "44105" }, canonical, { lane: "office_call" }), "");
  assert.equal(practiceBookingUrl(contactForm, { i_want_to: "Learn more about becoming a dog trainer", zip: "44105" }, canonical, { lane: "recruiting" }), "");
  assert.equal(practiceBookingUrl(contactForm, { i_want_to: "", zip: "44105" }, canonical, {}), "");
  // The server's lane table wins if it disagrees with the answer, and an ebook skip never redirects.
  assert.equal(practiceBookingUrl(contactForm, { i_want_to: booking[0], zip: "44105" }, canonical, { lane: "office_follow_up" }), "");
  assert.equal(practiceBookingUrl(contactForm, { i_want_to: booking[0], zip: "44105" }, canonical, { skipped: "ebook" }), "");
  // Never the recruiting form, never without a saved lead.
  assert.equal(practiceBookingUrl(recruitingForm, { i_want_to: booking[0], zip: "44105" }, canonical, {}), "");
  assert.equal(practiceBookingUrl(contactForm, { i_want_to: booking[0], zip: "44105" }, { application_id: "a1" }, {}), "");
  assert.equal(practiceBookingUrl(contactForm, { i_want_to: booking[0], zip: "44105" }, null, {}), "");
});

test("live (LDTT_IS_SANDBOX false) never redirects, whatever the answer", () => {
  const { practiceBookingUrl } = helper({ sandbox: false });
  assert.equal(practiceBookingUrl(contactForm, { i_want_to: "Schedule a virtual evaluation", zip: "44105" }, canonical, { book_url: "/book?lead=x" }), "");
  const { practiceBookingUrl: undef } = helper({ sandbox: undefined });
  assert.equal(undef(contactForm, { i_want_to: "Schedule a virtual evaluation", zip: "44105" }, canonical, {}), "");
});

test("the recruiting form and the PDF opt-in forms are outside the practice Contact listener", () => {
  // The practice capture listener takes ONLY .contact-intake forms.
  assert.match(practice, /if\(!form\|\|!form\.matches\('\.contact-intake'\)\|\|form\.closest\('#publicSite'\)\) return;/);
  const selector = script.match(/PRACTICE_LEAD_FORM_SELECTOR='([^']+)'/)[1];
  assert.ok(!/trainer-application-form|pdf-optin/.test(selector));
  assert.doesNotMatch(practice, /trainer-application-form|pdf-optin/);
});

test("the booking page pre-fills the ZIP step and the client details from the lead", () => {
  const page = read("lib/booking-page.js");
  // Start: ?lead= (and/or ?zip=) -> /api/booking?lead=&zip= -> the ZIP box is filled and trainers listed.
  assert.match(page, /var LEAD = params\.get\("lead"\) \|\| "";/);
  assert.match(page, /getJSON\("\/api\/booking\?" \+ \(LEAD \? "lead=" \+ encodeURIComponent\(LEAD\) : ""\)/);
  assert.match(page, /leadInfo = res\.j\.lead \|\| null;/);
  assert.match(page, /\$\("zip"\)\.value = res\.j\.zip;\n\s+zipNow = res\.j\.zip;/);
  // Client details step: name, phone, email, street address, city, state, ZIP from the lead, typed once.
  assert.match(page, /\["first_name", "last_name", "phone", "email", "address", "city", "state", "zip"\]\.forEach\(function \(k\) \{ if \(l\[k\] && f\.elements\[k\]\) f\.elements\[k\]\.value = l\[k\]; \}\);/);
  // /api/booking?lead= answers the lead with exactly those fields (address = the Contact form's address_line_1).
  const api = read("api/booking.js");
  const prefill = block(api, "function prefillOf(row)", "\n}\n");
  for (const k of ["first_name", "last_name", "phone", "email", "city", "state"]) assert.match(prefill, new RegExp(`${k}: row\\.${k} \\|\\| ""`));
  assert.match(prefill, /address: row\.address_line_1 \|\| ""/);
  assert.match(prefill, /zip: B\.digits\(row\.zip\)\.slice\(0, 5\)/);
  assert.match(api, /const zip = B\.digits\(req\.query\?\.zip\)\.slice\(0, 5\) \|\| lead\?\.zip \|\| "";/);
});
