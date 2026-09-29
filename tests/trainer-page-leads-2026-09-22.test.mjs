// Joshua 2026-09-22 (voice note), two gaps on the PRACTICE COPY:
//
// A. "Trainer landing page leads are missing from the office Leads screen." They showed in the trainer portal
//    and in the Sales panels, but not on Leads. CAUSE (proved against the real practice rows
//    2565397d-…47e6b5 and 59f927b7-…6932e95e1f538, both raw_payload.qa = "true", versus the ad-2.0 lead
//    9d871aca-…52d9 whose qa is null): the practice copy is a *.vercel.app preview (rule 50), and every
//    browser lead form treated a *.vercel.app host as a RELEASE-QA host and stamped raw_payload.qa = true.
//    Rule 1 holds qa rows out of every count, so those real practice leads vanished from the office Leads
//    screen — while trainerLeads() (the trainer portal) reads state.leads with NO hold-out and still showed
//    them. Fix: the practice copy is not a release-QA host. The hold-out itself is untouched.
//
// B. "Trainer landing page leads must follow the same flow as the ad pages 2.0." The 2.0 page reads book_url
//    off the answer and sends the browser there (assets/v2/v2.js). A trainer page now does the same, with the
//    trainer FIXED: the pipeline already answers /book/<that trainer>?lead=<id> for a trainer-page lead, and
//    when that trainer has no calendar the client falls back to the ZIP flow instead of the office only.
//
// Live must not change at all: on the live host isReleaseQaHost was already false, the redirect refuses
// unless window.LDTT_IS_SANDBOX is true, and the FormSubmit / Google Sheet / portal deliveries are untouched
// (their byte-for-byte hashes live in tests/office-email.test.mjs).
//
// Run: node --test tests/   Nothing here talks to the real project.
import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const require_ = createRequire(import.meta.url);
const root = resolve(import.meta.dirname, "..");
const read = path => readFileSync(resolve(root, path), "utf8");

const app = read("trainer-backoffice/app.js");
const script = read("script.js");
const pipelineLib = read("lib/pipeline.js");
const bookingLib = read("lib/booking.js");
const METRICS = require_(resolve(root, "trainer-backoffice/metrics.js"));

// A function lifted out of app.js and run in a bare context, so its decisions can be checked directly.
function lift(name, { hostname, sandbox }) {
  const source = app.match(new RegExp(`function ${name}\\([^)]*\\) \\{[\\s\\S]*?\\n\\}`));
  assert.ok(source, `${name} in app.js`);
  const ctx = { window: { location: { hostname }, LDTT_IS_SANDBOX: sandbox }, String, encodeURIComponent };
  vm.runInNewContext(`${source[0]}\nthis.fn = ${name};`, ctx);
  return ctx.fn;
}

// The two real trainer-page rows, shaped the way /api/operational-data hands them to the browser.
const trainerPageRow = {
  id: "2565397d-5dc9-499a-a67e-e4bd647916b5",
  status: "new_inquiry",
  created_at: "2026-09-23T01:13:58.790Z",
  trainer_slug: "daniel-bainbridge",
  raw_payload: { qa: true, sales_pipeline: true, source_page: "trainer landing page: Daniel Bainbridge", event_type: "trainer_form_submitted" }
};
const ad2Row = {
  id: "9d871aca-7ce1-4f09-a289-b42051c17ff2",
  status: "new_inquiry",
  created_at: "2026-09-23T01:15:57.594Z",
  trainer_slug: "michael-king",
  raw_payload: { sales_pipeline: true, source_page: "https://ldtt-sandbox.vercel.app/ads/pensacola" }
};

// ---------------------------------------------------------------------------
// A. The office Leads screen
// ---------------------------------------------------------------------------

test("A: the cause — a qa-stamped lead is dropped from the office Leads rows while the ad-2.0 lead survives", () => {
  const rows = [trainerPageRow, ad2Row].map(row => METRICS.normalizeLeadRow(row));
  assert.equal(METRICS.isQaLead(rows[0]), true, "the trainer-page row as it was really saved");
  assert.equal(METRICS.isQaLead(rows[1]), false, "the ad-2.0 row");
  // allLeadRows() -> excludeTestLeads() -> METRICS.excludeQa: the office Leads screen loses the first row.
  assert.deepEqual(METRICS.excludeQa(rows).map(r => r.id), [ad2Row.id]);
  // ...and that is the ONLY reason: nothing about the row's source, lane or trainer is filtered.
  const unstamped = METRICS.normalizeLeadRow({ ...trainerPageRow, raw_payload: { ...trainerPageRow.raw_payload, qa: false } });
  assert.equal(METRICS.isQaLead(unstamped), false);
  assert.deepEqual(METRICS.excludeQa([unstamped, ...rows.slice(1)]).map(r => r.id), [trainerPageRow.id, ad2Row.id]);
});

test("A: why it still showed elsewhere — the trainer portal reads state.leads with no QA hold-out", () => {
  // trainerLeads() (trainer portal "All My Leads") filters state.leads directly...
  assert.match(app, /function trainerLeads\(id = currentTrainerId\(\)\) \{\n  const trainer = findTrainer\(id\);\n  return state\.leads\.filter\(/);
  // ...while the office screens go through allLeadRows() -> excludeTestLeads().
  assert.match(app, /function allLeadRows\(\) \{\n  return excludeTestLeads\(/);
  assert.match(app, /function excludeTestLeads\(rows\) \{\n  if \(state\.showTestLeads\) return rows;\n  return METRICS\.excludeQa\(rows, METRICS\.isQaLead\);\n\}/);
  assert.match(app, /return `\$\{leadSourceRecordNotice\(\)\}\$\{testLeadNotice\(\)\}\$\{panel\("Office Lead Pipeline"/);
});

test("A: the fix — the practice copy is not a release-QA host, so no trainer-page lead is stamped qa there", () => {
  const live = lift("isReleaseQaHost", { hostname: "lorenzosdogtrainingteam.com", sandbox: undefined });
  const liveWww = lift("isReleaseQaHost", { hostname: "www.lorenzosdogtrainingteam.com", sandbox: undefined });
  const practice = lift("isReleaseQaHost", { hostname: "ldtt-sandbox.vercel.app", sandbox: true });
  const preview = lift("isReleaseQaHost", { hostname: "ldtt-site-abc123.vercel.app", sandbox: undefined });
  const local = lift("isReleaseQaHost", { hostname: "localhost", sandbox: undefined });

  assert.equal(practice(), false, "the practice copy: real practice leads, not QA rows");
  assert.equal(preview(), true, "a plain preview with no sandbox flag is still a release-QA host");
  assert.equal(local(), true, "localhost is still a release-QA host");
  // LIVE IS UNCHANGED: it never matched either host test, with or without the new line.
  assert.equal(live(), false);
  assert.equal(liveWww(), false);
  const before = hostname => /^(localhost|127\.0\.0\.1)$/.test(hostname) || /\.vercel\.app$/i.test(hostname);
  for (const host of ["lorenzosdogtrainingteam.com", "www.lorenzosdogtrainingteam.com"]) {
    assert.equal(lift("isReleaseQaHost", { hostname: host, sandbox: undefined })(), before(host));
    assert.equal(lift("isReleaseQaHost", { hostname: host, sandbox: true })(), before(host));
  }
  // The trainer landing page's lead payload takes its qa flag from exactly this function.
  assert.match(app, /qa: isReleaseQaHost\(\),/);
  assert.match(app, /submission_id: `\$\{isReleaseQaHost\(\) \? "qa-release-" : "trainer-"\}/);
});

test("A: the same stamp is gone from the practice Contact Us capture and the ebook opt-in forms", () => {
  // script.js: the practice-only block asks the sandbox flag at call time.
  assert.match(script, /const onPracticeCopy=\(\)=>window\.LDTT_IS_SANDBOX===true;/);
  assert.match(script, /if\(isReleaseQaHost&&!onPracticeCopy\(\)\) data\.set\('qa','true'\);/);
  // The frozen LIVE serialiser (wireAsyncForm, rule 73) still stamps exactly as it always did.
  const wire = script.slice(script.indexOf("const wireAsyncForm="), script.indexOf("const relayFormDeliveries="));
  assert.match(wire, /if\(isReleaseQaHost\) data\.set\('qa','true'\);/);
  assert.doesNotMatch(wire, /onPracticeCopy|LDTT_IS_SANDBOX/);
  // ad-funnel.js / market-landing.js: the LEAD payload asks the flag; the site-event stamp is left alone.
  for (const file of ["ad-funnel.js", "market-landing.js"]) {
    const src = read(file);
    assert.match(src, /const isQaLeadSubmission = \(\) => isReleaseQaHost && window\.LDTT_IS_SANDBOX !== true;/, file);
    assert.match(src, /qa: isQaLeadSubmission\(\),/, file);
    assert.match(src, /qa: isReleaseQaHost,/, `${file}: the tracking event keeps its own stamp`);
    assert.equal(src.split("qa: isQaLeadSubmission(),").length, 2, `${file}: one lead payload`);
    // With the flag off (live, or a real release-QA run) the value is exactly what it was.
    for (const [hostQa, sandbox, expected] of [[true, true, false], [true, undefined, true], [false, true, false], [false, undefined, false]]) {
      const ctx = { window: { LDTT_IS_SANDBOX: sandbox }, isReleaseQaHost: hostQa };
      vm.runInNewContext("this.fn = () => isReleaseQaHost && window.LDTT_IS_SANDBOX !== true;", ctx);
      assert.equal(ctx.fn(), expected);
    }
  }
});

test("A: the QA hold-out itself is untouched — a genuine qa row is still held out of every count (rule 1)", () => {
  const metrics = read("trainer-backoffice/metrics.js");
  assert.match(metrics, /function isQaLead\(row\) \{\n    if \(!row\) return false;\n    if \(row\.isTest === true\) return true;\n    return rawOf\(row\)\.qa === true;\n  \}/);
  const qaRelease = METRICS.normalizeLeadRow({ id: "old", status: "new_inquiry", created_at: "2026-08-06T07:22:03Z", raw_payload: { qa: true, submission_id: "qa-release-1787" } });
  assert.equal(METRICS.isQaLead(qaRelease), true);
  assert.deepEqual(METRICS.excludeQa([qaRelease]), []);
});

// ---------------------------------------------------------------------------
// B. The trainer landing page follows the ad-pages-2.0 flow
// ---------------------------------------------------------------------------

const lead = { lead_id: "2565397d-5dc9-499a-a67e-e4bd647916b5" };
const fixedLink = "https://ldtt-sandbox.vercel.app/book/daniel-bainbridge?lead=2565397d-5dc9-499a-a67e-e4bd647916b5";

test("B: the trainer is fixed — the client goes to the pipeline's own /book/<that trainer>?lead= link", () => {
  const url = lift("trainerPageBookingUrl", { hostname: "ldtt-sandbox.vercel.app", sandbox: true });
  // Exactly what /api/pipeline answered for the two real practice rows.
  assert.equal(url({ zip: "32502" }, lead, { ok: true, book_url: fixedLink, trainer_slug: "daniel-bainbridge" }), fixedLink);
  // No trainer picker is built here: the helper never invents a /book/<slug> address of its own.
  const helper = app.match(/function trainerPageBookingUrl\(entries, canonical, pipeline\) \{[\s\S]*?\n\}/)[0];
  assert.doesNotMatch(helper, /\/book\/\$\{/);
});

test("B: that trainer has no calendar -> the ZIP flow, not the office only", () => {
  const url = lift("trainerPageBookingUrl", { hostname: "ldtt-sandbox.vercel.app", sandbox: true });
  // lib/pipeline.js answers book_url null when settingBySlug finds no calendar for the page's trainer.
  assert.equal(url({ zip: "32536" }, lead, { ok: true, book_url: null, trainer_slug: null }), `/book?lead=${lead.lead_id}&zip=32536`);
  // No ZIP typed: the booking page still fills it from the lead (/api/booking?lead=).
  assert.equal(url({}, lead, { ok: true, book_url: null }), `/book?lead=${lead.lead_id}`);
  // The ZIP is digits only, 5 max, URL-safe.
  assert.equal(url({ zip: "32536-1234&x=1" }, lead, {}), `/book?lead=${lead.lead_id}&zip=32536`);
});

test("B: it never redirects on live, without a lead, for an ebook opt-in, or against the server's lane", () => {
  const liveUrl = lift("trainerPageBookingUrl", { hostname: "lorenzosdogtrainingteam.com", sandbox: undefined });
  assert.equal(liveUrl({ zip: "32502" }, lead, { ok: true, book_url: fixedLink }), "", "live never redirects");
  const undef = lift("trainerPageBookingUrl", { hostname: "ldtt-sandbox.vercel.app", sandbox: false });
  assert.equal(undef({ zip: "32502" }, lead, { book_url: fixedLink }), "");

  const url = lift("trainerPageBookingUrl", { hostname: "ldtt-sandbox.vercel.app", sandbox: true });
  assert.equal(url({ zip: "32502" }, { application_id: "a1" }, { book_url: fixedLink }), "", "no saved lead");
  assert.equal(url({ zip: "32502" }, null, {}), "");
  assert.equal(url({ zip: "32502" }, lead, { ok: true, skipped: "ebook" }), "", "the free-ebook opt-in is not a booking lead");
  assert.equal(url({ zip: "32502" }, lead, { ok: false, message: "This request is too old to start the online pipeline." }), "");
  assert.equal(url({ zip: "32502" }, lead, { ok: true, lane: "office_call" }), "", "the server's lane table wins");
  assert.equal(url({ zip: "32502" }, lead, { ok: true, lane: "recruiting" }), "");
  assert.equal(url({ zip: "32502" }, lead, { ok: true, lane: { key: "office_follow_up" } }), "");
  assert.equal(url({ zip: "32502" }, lead, null), `/book?lead=${lead.lead_id}&zip=32502`, "the pipeline could not be reached: still the ZIP flow");
});

test("B: the redirect runs only after the pipeline answered, and the live delivery path is untouched", () => {
  const handler = app.slice(app.indexOf('if (event.target.classList.contains("office-lead-form"))'), app.indexOf('if (event.target.classList.contains("public-review-form"))'));
  const sandboxBranch = handler.slice(handler.indexOf("if (window.LDTT_IS_SANDBOX === true) {"), handler.indexOf('const relayResponse = await fetch("/api/form-delivery"'));
  // The pipeline is entered first (its texts + emails go out), THEN the browser is sent on.
  assert.ok(sandboxBranch.indexOf('op: "enter"') < sandboxBranch.indexOf("const bookingUrl = trainerPageBookingUrl("));
  assert.match(sandboxBranch, /const bookingUrl = trainerPageBookingUrl\(entries, canonical, pipeline\);\n        if \(bookingUrl\) \{\n          setLandingStatus\("Saved\. Taking you to pick your evaluation time…", "success"\);\n          window\.location\.assign\(bookingUrl\);\n          return;\n        \}/);
  // No booking link (no calendar trainer AND no lead): today's thank-you, unchanged.
  assert.match(sandboxBranch, /event\.target\.reset\(\);\n        setLandingStatus\("Thank you\. Your consultation request was submitted\./);
  // The practice branch never touches FormSubmit, the Google Sheet or the office relay (comments aside —
  // the Rule 72 note above it names /api/form-delivery only to say it answers 423 on the practice copy).
  assert.doesNotMatch(sandboxBranch.replace(/\/\/[^\n]*/g, ""), /formsubmit|form-delivery|submitLandingEmail|recordClientFormDelivery/i);
  // LIVE, below the branch, is exactly what it was: form-delivery, then the FormSubmit retry from the browser.
  const liveBranch = handler.slice(handler.indexOf('const relayResponse = await fetch("/api/form-delivery"'));
  assert.match(liveBranch, /body: JSON\.stringify\(\{ form_type: "contact", entries, canonical \}\)/);
  assert.match(liveBranch, /delivery\.destination === "formsubmit_email" && delivery\.status === "failed"/);
  assert.match(liveBranch, /await submitLandingEmail\(entries, trainer\);\n          await recordClientFormDelivery\(entries, canonical, "accepted"\);/);
  assert.doesNotMatch(liveBranch, /trainerPageBookingUrl|location\.assign/);
  assert.match(read("api/form-delivery.js"), /const CONTACT_EMAIL = "https:\/\/formsubmit\.co\/ajax\/production@lorenzosdogtrainingteam\.com";/);
  // window.location.assign appears in app.js's public form handling only for this redirect.
  assert.equal(handler.split("window.location.assign(bookingUrl)").length, 2);
});

test("B: the pipeline already sends the client text, the New inquiry trainer text, Tim's text/email and the office email", () => {
  // A trainer-page lead stays with ITS trainer and gets that trainer's booking link.
  assert.match(pipelineLib, /const pageSlug = clean\(lead\.trainer_slug, 80\)\.toLowerCase\(\);/);
  assert.match(pipelineLib, /if \(pageSlug\) \{\n    setting = B\.settingBySlug\(settings, pageSlug\);/);
  assert.match(pipelineLib, /const bookUrl = linkSlug \? B\.bookUrl\(linkSlug, lead\.id\) : null;/);
  assert.match(bookingLib, /const bookUrl = \(slug, leadId\) => `\$\{practiceOrigin\(\)\}\/book\/\$\{encodeURIComponent\(slug\)\}\?lead=\$\{encodeURIComponent\(leadId\)\}`;/);
  // 1. the client's booking-link text (pathway 1), 2. the trainer's NEW INQUIRY text + its email twin,
  // 3. Tim / Operations' new-lead text + its email twin, 4. the office's queued Resend email.
  assert.match(pipelineLib, /text = await sendNewLeadText\(\{ lead: won, trainer, bookUrl: B\.taggedLink\(bookUrl, "text", "new_lead"\), phone: plan\.phone \}\)/);
  assert.match(pipelineLib, /const \{ email: inquiryEmail, \.\.\.inquiry \} = await sendNewInquiryText\(\{ lead: won, trainer: routed \? trainer : null, bookUrl: routed \? bookUrl : null \}\)/);
  const inquiry = pipelineLib.match(/async function sendNewInquiryText\(\{ lead, trainer, bookUrl \}\) \{[\s\S]*?\n\}/)[0];
  assert.match(inquiry, /const base = \{ kind: "trainer_new_inquiry", at: now\(\) \};/);
  assert.match(inquiry, /pathway: "new_inquiry",/);
  assert.match(inquiry, /trainerTwinEmail\("trainer_new_inquiry",/);
  assert.match(pipelineLib, /await sendOpsAlert\("new_lead", \{/);
  assert.match(pipelineLib, /await queueNewLeadEmail\(won\)/);
  // The order inside enterPipeline: claim -> client text -> Tim -> trainer New inquiry -> office email -> answer.
  const enter = pipelineLib.slice(pipelineLib.indexOf("async function enterPipeline("), pipelineLib.indexOf("async function enterOtherLane("));
  const at = needle => { const i = enter.indexOf(needle); assert.ok(i > 0, needle); return i; };
  assert.ok(at("won = rows?.[0] || null;") < at("text = await sendNewLeadText("));
  assert.ok(at("text = await sendNewLeadText(") < at('await sendOpsAlert("new_lead"'));
  assert.ok(at('await sendOpsAlert("new_lead"') < at("await sendNewInquiryText("));
  assert.ok(at("await sendNewInquiryText(") < at("await queueNewLeadEmail(won)"));
  assert.ok(at("await queueNewLeadEmail(won)") < at("book_url: bookUrl,\n      texted:"));
});

test("B: this is the same flow the ad pages 2.0 use — book_url off the answer, then the browser follows it", () => {
  const v2 = read("assets/v2/v2.js");
  assert.match(v2, /var next = data\.book_url \? safeUrl\(data\.book_url\) : "";/);
  assert.match(v2, /location\.assign\(next\);/);
  // /api/booking-lead answers the same contract the trainer page now reads.
  assert.match(read("api/booking-lead.js"), /book_url: slug \? B\.bookUrl\(slug, lead\.id\) : null,/);
});
