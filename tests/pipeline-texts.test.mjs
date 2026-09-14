// Rule 84 (Joshua 2026-09-14, decision sheet): the office edits every text in the portal (Text messages),
// with a "currently being used" label and Send test; the finished words ride along with every Make send.
// Also: the gold service-dog tag, Contracted Revenue by collected, follow-up = Tim's text then the booking link.
// Run: node --test tests/   Nothing here talks to the real project.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "test-key";
process.env.SUPABASE_URL = process.env.SUPABASE_URL || "http://supabase.test";
const X = require("../lib/pipeline-texts.js");
const R = require("../lib/reengage.js");
const read = path => readFileSync(resolve(import.meta.dirname, "..", path), "utf8");

// Make's own words on 2026-09-14 ({{1.x}} -> {x}). Switching Make to the portal must change no text.
const MAKE_WORDS = {
  booking_link: "Hi {first_name}, this is Lorenzo’s Dog Training Team. We received your request for help with {problem}.\n\nYou can schedule your complimentary evaluation here:\n{booking_link}\n\nIf you have a question first, just reply to this message. Reply STOP to opt out.",
  booking_confirmation: "Hi {first_name} — you’re confirmed with {trainer_first_name} from Lorenzo’s Dog Training Team.\n\n📅 {appointment_day}, {appointment_date} at {appointment_time}\n📍 {service_address}\n\nBefore your trainer arrives, please complete these quick questions about {dog_name} so we can make the most of your evaluation:\n{pre_eval_link}\n\nWe look forward to meeting you.",
  trainer_new_eval: "🔔 NEW LDTT EVALUATION\n{first_name} {last_name}\n{appointment_day} at {appointment_time}\n{service_address}\n\nDog: {dog_name}\nPrimary concern: {problem}\n{safety_flag}\nPlease call the client today to introduce yourself, then mark CONTACTED: {trainer_portal_link}",
  ops_new_lead: "New LDTT lead: {client_name}, ZIP {zip}, {problem}. From: {source}. {next_step} {link}",
  ops_eval_booked: "Evaluation booked: {client_name} with {trainer_name}, {appointment_day} {appointment_date} at {appointment_time}. It is now in Eval Scheduled. {link}"
};

function fakeSb() {
  let row = null;
  const sb = async (path, options = {}) => {
    if (!options.method || options.method === "GET") return row ? [row] : [];
    row = { key: options.body.key, value: JSON.parse(JSON.stringify(options.body.value)), updated_at: options.body.updated_at };
    return [];
  };
  return { sb, get row() { return row; } };
}

test("starting words are exactly Make's words today, so the Make switch changes no text", () => {
  for (const [key, words] of Object.entries(MAKE_WORDS)) assert.equal(X.wordsFor(null, key), words, key);
  const inUse = X.TEXTS.filter(t => t.status === "in_use").map(t => t.key).sort();
  assert.deepEqual(inUse, Object.keys(MAKE_WORDS).sort(), "every text Make sends today is in the editor");
  assert.match(X.TEXTS.find(t => t.key === "trainer_new_eval").draft, /^Track 500 - Schedule Eval\n/, "the meeting's wording is offered as the first draft");
});

test("check: unknown fields, empty words and long texts are refused with the reason", () => {
  assert.match(X.check("booking_link", "Hi {first_name}, {bogus}").error, /Unknown field \{bogus\}/);
  assert.match(X.check("booking_link", "   ").error, /empty/);
  assert.match(X.check("booking_link", "x".repeat(700)).error, /Keep it under 640/);
  assert.equal(X.check("booking_link", "Hi {first_name}\u0000!").value, "Hi {first_name}!", "control characters removed");
  assert.equal(X.check("nope", "x").error, "Unknown text.");
  assert.equal(X.render("Hi {first_name}.\n{safety_flag}\n\n\nBye {nobody}", { first_name: "Sam" }), "Hi Sam.\n\nBye");
});

test("save / publish (full name) / discard / back to starting words", async () => {
  const f = fakeSb();
  const saved = await X.change(f.sb, { op: "save", key: "booking_link", words: "Hi {first_name}! Book here: {booking_link}" }, "Angela (angela@x)");
  assert.equal(saved.status, 200);
  assert.equal(X.wordsFor(f.row.value, "booking_link"), MAKE_WORDS.booking_link, "a draft does not change the words in use");
  const noName = await X.change(f.sb, { op: "publish", key: "booking_link", name: "Angela" }, "Angela (angela@x)");
  assert.equal(noName.status, 400, "one word is not a full name");
  const pub = await X.change(f.sb, { op: "publish", key: "booking_link", name: "Angela Simonton" }, "Angela (angela@x)");
  assert.equal(pub.status, 200);
  assert.equal(X.wordsFor(f.row.value, "booking_link"), "Hi {first_name}! Book here: {booking_link}");
  assert.match(f.row.value.texts.booking_link.published_by, /^Angela Simonton \(Angela/);
  assert.equal(f.row.value.texts.booking_link.previous, null, "the first publish has no earlier words");
  const view = X.view(f.row.value).find(t => t.key === "booking_link");
  assert.equal(view.starting_words, false); assert.equal(view.draft, null);
  assert.equal(view.preview, "Hi Sam! Book here: https://ldtt-sandbox.vercel.app/book/example");
  const reset = await X.change(f.sb, { op: "reset", key: "booking_link", name: "Angela Simonton" }, "Angela (angela@x)");
  assert.equal(reset.status, 200);
  assert.equal(X.wordsFor(f.row.value, "booking_link"), MAKE_WORDS.booking_link);
  const bad = await X.change(f.sb, { op: "save", key: "booking_link", words: "{oops}" }, "x");
  assert.equal(bad.status, 400);
  assert.ok(f.row.value.log.length >= 3, "every change is logged with who and when");
});

test("every Make send carries the portal's finished words; the test text goes only to the locked phone after the switch", () => {
  const src = read("lib/pipeline.js");
  assert.match(src, /async function postHook\(url, rawPayload\) \{\n  const payload = await withTextMessages\(rawPayload\);/);
  assert.match(src, /if \(payload\.pathway === "new_lead"\) return \{ \.\.\.payload, message: T\.render\(words\("booking_link"\), payload\) \};/);
  assert.match(src, /customer_message: T\.render\(words\("booking_confirmation"\), \{ \.\.\.payload, dog_name: payload\.dog_name \|\| "your dog" \}\), trainer_message: T\.render\(words\("trainer_new_eval"\), payload\)/);
  assert.match(src, /catch \{ state = null; \}/, "an unreadable editor never fails a send (starting words are used)");
  const test = src.match(/async function sendTextTest\(key, draftWords\) \{[\s\S]*?\n\}\n/)[0];
  assert.match(test, /const phone = PRACTICE_TEXT_ONLY_TO && PRACTICE_TEXT_ONLY_TO\[0\];/, "rule 82: the locked phone only");
  assert.match(test, /message = `\[TEST\] \$\{T\.render\(ok\.value, T\.SAMPLE\)\}`/);
  const api = read("api/pipeline.js");
  assert.match(api, /if \(process\.env\.LDTT_TEXTS_FROM_PORTAL !== "1"\) return res\.status\(409\)/, "Send test waits for the Make switch");
  assert.match(api, /\["text_save", "text_publish", "text_discard", "text_reset"\]\.includes\(op\)\) \{\n[^\n]*\n      const access = await authorizeRequest\(req, res, \{ require: "admin"/, "office staff only");
  const app = read("trainer-backoffice/app.js");
  assert.match(app, /if \(!window\.LDTT_IS_SANDBOX \|\| session\.role !== "admin"\) return "";\n  const title = "Text messages";/, "trainers never see the editor");
  assert.match(app, /<span>Currently being used<\/span>/);
});

test("service-dog leads wear a gold tag on office, Sales and trainer cards and in the lead details", () => {
  const app = read("trainer-backoffice/app.js");
  const fn = app.match(/function isServiceDogLead\(lead = \{\}\) \{[\s\S]*?\n\}\n/)[0];
  assert.match(fn, /service\[\\s-\]\*dog/);
  assert.ok((app.match(/\$\{serviceDogTag\(lead\)\}/g) || []).length >= 4, "four places");
  assert.match(read("trainer-backoffice/styles.css"), /\.lead-tag-service-dog \{/);
});

test("follow-up plan: Tim's text first, then the booking link at 40 min, 24 h and 48 h (still not sending)", () => {
  assert.deepEqual(R.STEPS.map(s => s.kind), ["tim", "link", "link", "link"]);
  assert.equal(R.SENDING_ENABLED, false);
  assert.equal(R.linkTextFor({ first_name: "Angela Marie" }, "https://x/book"), "Hi Angela, it's Lorenzo's Dog Training Team. Here is your link to book your free evaluation:\nhttps://x/book\n\nReply STOP to opt out.");
  const p = R.plan({ first_name: "A", phone: "4405550101", sms_consent: true, status: "new_inquiry", created_at: new Date(Date.parse("2026-09-14T16:00:00Z") - 20 * 60000).toISOString(), raw_payload: {} }, Date.parse("2026-09-14T16:00:00Z"));
  assert.deepEqual([p.next.step, p.next.kind], [2, "link"]);
  assert.equal(R.eligibility({ first_name: "A", phone: "1", sms_consent: true, status: "new_inquiry", raw_payload: { lead_type: "pdf_download" } }).ok, false, "booklet leads stay out (Joshua: No)");
});
