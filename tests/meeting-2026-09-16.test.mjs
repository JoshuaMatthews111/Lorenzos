// Meeting 2026-09-16 (Joshua, Lorenzo, Missy, Rachel):
//   1. Submit a Deal programs: Board and Train, Basic Obedience, Basic Obedience Plus, Obedience On Leash,
//      Obedience Off Leash, Behavior Modification, Other (type it). Puppy training and Service Dog left the list.
//   2. Two closed lead statuses, Canceled / Refunded and Canceled / Write off; they count with Lost, never sold.
//   3. Required boxes wear a red asterisk (portal, 2.0 pages, /book, Contact page).
//   4. Dates the office and trainers see read mm/dd/yyyy.
//   5. The Track 500 badge belongs only to leads from an ad landing page (old /ads/ pages or a 2.0 page).
//   6. The /book confirmation no longer says the office puts the time on the calendar.
// Run: node --test tests/   Nothing here talks to the real project.
import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "test-key";
const read = path => readFileSync(resolve(import.meta.dirname, "..", path), "utf8");
const app = read("trainer-backoffice/app.js");
const fn = name => app.match(new RegExp(`function ${name}\\([^)]*\\) \\{[\\s\\S]*?\\n\\}\\n`))[0];

function loadMetrics() {
  const window = {};
  vm.runInNewContext(read("trainer-backoffice/metrics.js"), { window, globalThis: window });
  return window.LDTT_METRICS;
}

test("1. Submit a Deal: the program list from the meeting; Puppy training and Service Dog Training are gone", () => {
  const list = app.match(/const DEAL_PROGRAM_CHOICES = (\[[^\]]*\]);/)[1];
  assert.deepEqual(JSON.parse(list), ["Board and Train", "Basic Obedience", "Basic Obedience Plus", "Obedience On Leash", "Obedience Off Leash", "Behavior Modification"]);
  assert.doesNotMatch(list, /Puppy|Service Dog/);
  assert.match(fn("dealProgramField"), /Other \(type it\)/);
});

test("2. Canceled / Refunded and Canceled / Write off exist everywhere statuses are listed, and count as Lost", () => {
  const statuses = app.match(/const leadStatuses = \[([\s\S]*?)\];/)[1];
  assert.match(statuses, /"Canceled \/ Refunded",\s*\n\s*"Canceled \/ Write off",/);
  const toDb = app.match(/const leadStatusToDb = \{([\s\S]*?)\};/)[1];
  assert.match(toDb, /"Canceled \/ Refunded": "canceled_refunded"/);
  assert.match(toDb, /"Canceled \/ Write off": "canceled_write_off"/);
  assert.match(fn("communicationsLeadIsActive"), /"canceled_refunded", "canceled_write_off"/, "no campaign goes to a canceled lead");
  assert.match(fn("statusClass"), /status\.startsWith\("Canceled"\)/, "the pill is the red Lost pill");

  const M = loadMetrics();
  assert.equal(M.LEAD_STATUS_TO_DB["Canceled / Refunded"], "canceled_refunded");
  assert.equal(M.LEAD_STATUS_TO_DB["Canceled / Write off"], "canceled_write_off");
  assert.equal(M.LEAD_STATUS_FROM_DB.canceled_write_off, "Canceled / Write off");
  const lostStage = M.SALES_STAGES.find(s => s[0] === "lost");
  assert.ok(lostStage[3].includes("canceled_refunded") && lostStage[3].includes("canceled_write_off"), "Sales tab: Lost column");
  assert.ok(!M.SALES_STAGES.find(s => s[0] === "won")[3].some(s => /canceled/.test(s)), "never Won");
  const leads = [{ status: "Canceled / Refunded" }, { status: "Canceled / Write off" }, { status: "Became a Client" }];
  // 2026-09-24 (Lorenzo): the six-column trainer task board puts both in Lost too.
  const trainerBoard = new Map(M.trainerLeadBoard(leads));
  assert.deepEqual([...trainerBoard.get("Lost")].map(l => l.status), ["Canceled / Refunded", "Canceled / Write off"]); // spread: the module runs in its own realm here
  assert.equal(M.trainerDashboard(leads, []).lost, 2);
  assert.equal(M.trainerDashboard(leads, []).won, 1);
  const board = Object.fromEntries(M.leadBoardColumnCounts(leads));
  assert.equal(board.Lost, 2, "office board: the Lost column");
  assert.equal(board["Became a Client"], 1);
});

test("3. required boxes wear a red asterisk: portal pass + CSS, 2.0 pages, /book, Contact page", () => {
  assert.match(app, /\n  renderView\(\);\n  markRequiredLabels\(document\);/, "runs after every portal redraw");
  const mark = fn("markRequiredLabels");
  assert.match(mark, /input\[required\], select\[required\], textarea\[required\]/);
  assert.match(mark, /control\.type === "checkbox" \|\| control\.type === "radio"/, "a consent checkbox gets no asterisk");
  assert.match(mark, /mark\.className = "required-mark"/);
  const portalCss = read("trainer-backoffice/styles.css");
  assert.match(portalCss, /\.required-mark \{ color: #c8102e !important;/);
  assert.match(portalCss, /\.optional-mark \{ color: #5b6a83;/);
  assert.match(app, /\n  markRequiredLabels\(document\);\n  markOptionalLabels\(document\);/, "optional pass runs right after the required pass");
  assert.match(portalCss, /label:has\(> input\[required\]\):not\(:has\(\.required-mark\)\)::before/);
  const v2css = read("assets/v2/v2.css");
  assert.match(v2css, /\.required-mark\{color:#c8102e!important;/);
  assert.match(v2css, /\.optional-mark\{color:#5b6a83;/);
  assert.match(read("assets/v2/v2.js"), /markOptional\(document\);/);
  assert.match(v2css, /\.lead label:has\(> input\[required\]\):not\(:has\(\.required-mark\)\)::before/);
  const v2js = read("assets/v2/v2.js");
  assert.match(v2js, /function markRequired\(root\)/);
  assert.match(v2js, /markRequired\(document\);/);
  const T = require("../lib/ad2-page-template.js");
  assert.match(T.renderPage(T.STARTERS[0], { practice: true }), /v2\.css\?v=20260930ad20/, "the browsers fetch the new css + js");
  const book = read("lib/booking-page.js");
  assert.match(book, /label:has\(> input\[required\]\):not\(:has\(\.req\)\)::before/);
  const contact = read("contact.html");
  for (const label of ["First Name", "Last Name", "Address Line 1", "City", "State", "ZIP Code", "Email Address", "Phone", "I want to...", "How did you hear about us?", "Comments"]) {
    assert.ok(contact.includes(`<label>${label}<span class="required-mark" aria-hidden="true">*</span>`), `Contact page: ${label}`);
  }
  assert.ok(!contact.includes('Address Line 2 <small>(optional)</small><span class="required-mark"'), "optional boxes stay plain");
  assert.match(read("styles.css"), /label:has\(> input\[required\]\):not\(:has\(\.required-mark\)\)::before/);
});

test("4. dates read \"September 17, 2026\" (Joshua 2026-09-17); times unchanged", () => {
  const ctx = {};
  vm.runInNewContext(`${fn("formatDate")}\n${fn("parseTimestamp")}\n${fn("formatDateTime")}`, ctx);
  assert.equal(ctx.formatDate("2026-09-17"), "September 17, 2026");
  assert.equal(ctx.formatDate("2026-01-05"), "January 5, 2026");
  assert.equal(ctx.formatDate(""), "—");
  assert.equal(ctx.formatDate("not a date"), "not a date");
  assert.match(ctx.formatDate("2026-09-17T14:05:00"), /^September 17, 2026$/);
  assert.match(ctx.formatDateTime("2026-09-17T14:05:00"), /^September 17, 2026, 2:05 PM$/);
  assert.ok(!/toLocaleDateString\(\)/.test(app), "no bare toLocaleDateString() left in the portal");
  assert.ok(!/toLocaleDateString\(\[\], \{ month: "short"/.test(app));
  assert.match(app, /<td>\$\{escapeHtml\(formatDate\(d\.sold_on\)\)\}<\/td>/, "Clients table: date of sale");
  assert.match(app, /escapeHtml\(formatDate\(p\.due_on\)\)/, "payment schedule dates");
});

test("5. Track 500 badge: ad landing pages and 2.0 pages only", () => {
  const ctx = { state: { leads: [] }, isPaidAdLandingPageLead: () => false };
  vm.runInNewContext(`${fn("escapeHtml")}\n${fn("leadRawPayload")}\n${fn("isAdPageAddress")}\n${fn("leadCameFromAdPage")}\n${fn("isTrack500Lead")}\n${fn("track500Tag")}\n${fn("dealTrack500Tag")}`, ctx);
  const pipeline = { entered_at: "2026-09-17T12:00:00Z", lane: "booking" };
  // 2.0 page: the form sends the page address.
  assert.equal(ctx.isTrack500Lead({ rawPayload: { source_page: "https://lorenzosdogtrainingteam.com/ads/miramar-beach", pipeline } }), true);
  assert.equal(ctx.isTrack500Lead({ rawPayload: { source_page: "ads/panama-city-beach" } }), true);
  assert.equal(ctx.isTrack500Lead({ rawPayload: {}, source_page: "/ads-v2/ann-arbor" }), true);
  // Old ad page: the form sends the page slug; the app's paid-ad classifier knows those slugs.
  ctx.isPaidAdLandingPageLead = lead => /dog-training-cleveland-oh/.test(String(lead.rawPayload?.source_page || ""));
  assert.equal(ctx.isTrack500Lead({ rawPayload: { source_page: "dog-training-cleveland-oh", pipeline } }), true);
  // Website forms, Contact page, trainer pages, vet referrals: no badge, even when the pipeline carried them.
  for (const raw of [
    { source_page: "contact.html", pipeline },
    { source_page: "Contact | Lorenzo's Dog Training Team", pipeline },
    { source_page: "book/eric-beck", pipeline },
    { source_page: "trainer_landing_footer", pipeline },
    { source_page: "Eric Beck | Dog Trainer", heard_about_us: "My Veterinarian", pipeline },
    { pipeline }
  ]) assert.equal(ctx.isTrack500Lead({ rawPayload: raw }), false, JSON.stringify(raw));
  assert.equal(ctx.track500Tag({ rawPayload: { source_page: "contact.html", pipeline } }), "");
  assert.match(ctx.track500Tag({ rawPayload: { source_page: "ads/miramar-beach" } }), /lead-tag-track500/);
  // A deal follows its lead.
  ctx.state.leads = [{ remoteId: "L1", rawPayload: { source_page: "ads/miramar-beach" } }, { remoteId: "L2", rawPayload: { source_page: "contact.html", pipeline } }];
  assert.match(ctx.dealTrack500Tag({ lead_id: "L1" }), /Track 500/);
  assert.equal(ctx.dealTrack500Tag({ lead_id: "L2" }), "");
  assert.equal(ctx.dealTrack500Tag({ lead_id: null }), "");
  assert.match(app, /\$\{escapeHtml\(d\.dog_name\)\}` : ""\}\$\{dealTrack500Tag\(d\)\}<\/small>/, "Sales deal card");
  assert.match(app, /<strong>\$\{escapeHtml\(d\.client_name\)\}<\/strong>\$\{dealTrack500Tag\(d\)\}/, "Clients table");
});

test("6. /book confirmation: no 'office puts your time on the calendar' step; trainer confirms, then the questions", () => {
  const book = read("lib/booking-page.js");
  assert.ok(!/puts your time on/.test(book));
  const booked = book.match(/if \(r\.booked\) \{[\s\S]*?\} else \{/)[0];
  assert.match(booked, /\$\("doneNext"\)\.innerHTML = "<li>Our office or " \+ esc\(who\.first_name\) \+ " calls you within 48 hours to confirm the day and time\.<\/li><li>Answer a few pre-evaluation questions/);
  assert.match(booked, /Have your dog and your questions ready\. The evaluation is free\./);
  assert.match(book, /step=questions/, "the pre-evaluation questions link stays");
});

test("Rachel 2026-09-29: /book says IN PERSON, not a phone call, at the start, the time step, the button and the done screen; the confirmation text says it too", () => {
  const book = read("lib/booking-page.js");
  assert.match(book, /<h1>Book your free in-person evaluation<\/h1>/);
  assert.equal((book.match(/<strong>In person, not a phone call\.<\/strong>/g) || []).length, 2, "ZIP step + time step");
  assert.match(book, /id="bookBtn">Book my in-person evaluation<\/button>/);
  assert.match(book, /Free in-person evaluation \(not a phone call\)/);
  assert.match(book, /within 48 hours to confirm/);
  const T = require("../lib/pipeline-texts.js");
  const words = T.wordsFor(null, "booking_confirmation");
  assert.match(words, /your free in-person evaluation is booked/);
  assert.match(words, /not a phone call\. Our office or \{trainer_first_name\} will call you within 48 hours/);
  assert.equal(T.check("booking_confirmation", words).error, undefined);
});
