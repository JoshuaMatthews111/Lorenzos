// Joshua 2026-09-29: the lead record shows when they were first received, each time they came back (recycled) with the
// page and what changed, and how they booked - from the link in a text or an email. The Leads pipeline has a "Kind"
// filter (Recycled, Booked from a text link, ...) whose numbers match what it shows.
// Run: node --test tests/
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const read = path => readFileSync(resolve(import.meta.dirname, "..", path), "utf8");
const M = require("../trainer-backoffice/metrics.js");
const B = require("../lib/booking.js");

test("links are tagged text/email + message, only on our own site", () => {
  assert.equal(B.taggedLink("https://www.lorenzosdogtrainingteam.com/book/fredharris?lead=abc", "email", "reengage"),
    "https://www.lorenzosdogtrainingteam.com/book/fredharris?lead=abc&utm_source=email&utm_campaign=reengage");
  assert.equal(B.taggedLink("https://ldtt-sandbox.vercel.app/contact", "text", "followup_link"), "https://ldtt-sandbox.vercel.app/contact?utm_source=text&utm_campaign=followup_link");
  assert.equal(B.taggedLink("https://example.com/x", "text", "new_lead"), "https://example.com/x", "never another site's link");
  assert.equal(B.taggedLink("", "text", "new_lead"), "");
  assert.equal(B.taggedLink("https://www.lorenzosdogtrainingteam.com/book", "sms", "new_lead"), "https://www.lorenzosdogtrainingteam.com/book", "unknown channel: untouched");
  assert.deepEqual(B.linkFrom({ source: "text", campaign: "followup_link" }, "t"), { channel: "text", message: "followup_link", at: "t" });
  assert.deepEqual(B.linkFrom({ source: "email", campaign: "<script>" }, "t"), { channel: "email", message: "", at: "t" });
  assert.equal(B.linkFrom({ source: "facebook" }), null, "an ad's utm_source is not one of our links");
  assert.equal(B.linkFrom(undefined), null);
});

test("the booking page sends the link back and the booking API stamps it (book, trainer request, call request)", () => {
  const page = read("lib/booking-page.js");
  assert.match(page, /var LINK_FROM = params\.get\("utm_source"\) \? \{ source: params\.get\("utm_source"\), campaign: params\.get\("utm_campaign"\) \|\| "" \} : undefined;/);
  assert.match(page, /lead_id: LEAD \|\| undefined,\n      link_from: LINK_FROM,/);
  assert.match(page, /op: "callback", zip: zipNow, lead_id: LEAD \|\| undefined, link_from: LINK_FROM,/);
  const api = read("api/booking.js");
  assert.equal((api.match(/const linkFrom = B\.linkFrom\(body\.link_from\);/g) || []).length, 3);
  assert.match(api, /booked_at: now,\n            \.\.\.\(linkFrom \? \{ link_from: linkFrom \} : \{\}\)/);
  assert.match(api, /dogs,\n          \.\.\.\(linkFrom \? \{ link_from: linkFrom \} : \{\}\)/);
});

test("which link: the booking stamp first, else a lead that came in from a tagged link; words in plain English", () => {
  const booked = { raw_payload: { booking: { slot_start: "2026-10-01T15:00:00Z", link_from: { channel: "text", message: "followup_link", at: "x" } } } };
  assert.equal(M.linkFromWords(M.linkFromOf(booked)), "the link in the 30-minute follow-up text");
  const cameIn = { raw_payload: { utm_source: "email", utm_campaign: "reengage" } };
  assert.equal(M.linkFromOf(cameIn).on, "lead");
  assert.equal(M.linkFromWords(M.linkFromOf(cameIn)), "the link in the re-engage invite email");
  assert.equal(M.linkFromOf({ raw_payload: { utm_source: "facebook" } }), null, "a paid ad is not a text/email link");
});

test("what changed between two requests: page, how they heard, phone (digits only), ZIP, dog", () => {
  const a = { page: "Contact Us page", heard_about_us: "Facebook", phone: "(440) 555-1234", dog_name: "Rex" };
  const b = { page: "Cleveland ad page", heard_about_us: "Google", phone: "4405551234", zip: "44128", dog_name: "rex" };
  assert.deepEqual(M.requestChanges(a, b), ["Came in through: Contact Us page → Cleveland ad page", "How they heard about us: Facebook → Google", "ZIP: 44128 (new)"]);
  assert.deepEqual(M.requestChanges(a, { ...a }), []);
});

test("lead kinds for the pipeline filter", () => {
  const k = (lead, ctx) => [...M.leadKinds(lead, ctx)].sort();
  assert.deepEqual(k({ raw_payload: { booking: { slot_start: "x", link_from: { channel: "email", message: "reengage" } } } }, { recycled: true }), ["booked_from_email", "booked_online", "from_email", "recycled"]);
  assert.deepEqual(k({ raw_payload: { utm_source: "text", utm_campaign: "reengage", pipeline: { entered_at: "x" } } }), ["from_text", "unfinished"]);
  assert.deepEqual(k({ raw_payload: { booking: { requested: true }, needs_office_call: true } }, { officeTurn: true }), ["asked_trainer", "needs_call", "office_turn"]);
  assert.deepEqual(k({ raw_payload: { lead_type: "pdf_download", pipeline: { entered_at: "x" } } }), ["ebook"]);
  assert.deepEqual(k({ raw_payload: { pipeline: { entered_at: "x" }, booking: { dogs: [{ name: "Rex" }] } } }), [], "answered the dog questions: not unfinished");
  for (const [value] of M.LEAD_KIND_FILTERS) assert.ok(/^[a-z_]+$/.test(value));
});

test("the portal: Kind filter with counts, the same rows on the board, Lead history on the office record only", () => {
  const app = read("trainer-backoffice/app.js");
  assert.match(app, /&& \(ignore\.has\("kind"\) \|\| kindFilter === "All" \|\| leadKindSet\(lead\)\.has\(kindFilter\)\)/);
  assert.match(app, /leadOptionLabel\(label, leadFilterCount\(baseRows, \{ leadKindFilter: value \}\)\)/);
  assert.match(app, /data-lead-filter="kind"/);
  assert.match(app, /leadKindFilter: state\.leadKindFilter,/);
  assert.match(app, /function leadHistoryBlock\(lead\) \{\n  if \(session\.role !== "admin" \|\| !lead\) return "";/);
  assert.match(app, /\$\{leadHistoryBlock\(lead\)\}\$\{leadExtraAnswersBlock\(lead\)\}/);
  assert.doesNotMatch(app.match(/function trainerLeadDetailPanel\(\) \{[\s\S]*?\n\}/)[0], /leadHistoryBlock/, "the trainer panel never draws it (rule 7)");
});
