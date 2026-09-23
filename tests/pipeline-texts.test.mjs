// Rule 84 (Joshua 2026-09-14): the SUPER ADMIN edits every text in the portal (Text messages): role chips, a stage
// timeline, several templates per text with ONE in use, Send test; the finished words ride along with every Make send.
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

// Make's own words on 2026-09-14 ({{1.x}} -> {x}), plus the 2026-09-15 changes Joshua asked for:
// trainer_new_eval gains {appointment_date} ("day of week, date and time"), and pre_eval_answers is now
// in use (the trainer's "eval questions completed" text with a portal prompt).
const MAKE_WORDS = {
  booking_link: "Hi {first_name}, this is Lorenzo’s Dog Training Team. We received your request for help with {problem}.\n\nYou can schedule your complimentary evaluation here:\n{booking_link}\n\nReply STOP to opt out.", // meeting 2026-09-16: no "reply to this message" (replies go nowhere)
  booking_confirmation: "Hi {first_name} — you’re confirmed with {trainer_first_name} from Lorenzo’s Dog Training Team.\n\n📅 {appointment_day}, {appointment_date} at {appointment_time}\n📍 {service_address}\n\nBefore your trainer arrives, please complete these quick questions about {dog_name} so we can make the most of your evaluation:\n{pre_eval_link}\n\nWe look forward to meeting you.",
  trainer_new_eval: "🔔 NEW LDTT EVALUATION\n{first_name} {last_name}\n{appointment_day}, {appointment_date} at {appointment_time}\n{service_address}\n\nDog: {dog_name}\nPrimary concern: {problem}\n{safety_flag}\nPlease call the client today to introduce yourself, then mark CONTACTED: {trainer_portal_link}",
  ops_new_lead: "New LDTT lead: {client_name}, ZIP {zip}, {problem}. From: {source}. {next_step} {link}",
  ops_eval_booked: "Evaluation booked: {client_name} with {trainer_name}, {appointment_day} {appointment_date} at {appointment_time}. It is now in Eval Scheduled. {link}",
  // Joshua 2026-09-16: "instruct them to log in and log the deal in the portal using this link" (after Eval completed).
  trainer_log_deal: "🚨🚨 Track 500 - Eval completed 🚨🚨\n{first_name} {last_name} ({dog_name}).\nPlease log in to the trainer portal and log the deal here: {trainer_portal_link}",
  // Joshua 2026-09-17: the trainer's new-inquiry text (pathway 2, trainer branch, pathway "new_inquiry").
  trainer_new_inquiry: "🚨🚨 New Track 500 inquiry 🚨🚨\n{first_name} {last_name}, ZIP {zip}\nConcern: {problem}\nThey just got your booking link. Watch for the booking, or call to help them pick a time: {trainer_portal_link}",
  // 2026-09-22: the office-call text is sent (pathway 1 hook when LDTT_MAKE_HOOK_CARE is unset).
  care_call: "Hi {first_name}, thanks for contacting Lorenzo's Dog Training Team. Our office will call you shortly from (216) 475-5999. Reply STOP to opt out.",
  pre_eval_answers: "📝 EVAL QUESTIONS COMPLETED\n{first_name} {last_name}\n{appointment_day}, {appointment_date} at {appointment_time}\n{service_address}\n\n{safety_flag}\n{answers_summary}\n\nLog in to the trainer portal to view the full answers and lead details: {trainer_portal_link}"
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

test("starting words are exactly the agreed words, so the Make switch changes no text", () => {
  for (const [key, words] of Object.entries(MAKE_WORDS)) assert.equal(X.wordsFor(null, key), words, key);
  const inUse = X.TEXTS.filter(t => t.status === "in_use").map(t => t.key).sort();
  assert.deepEqual(inUse, Object.keys(MAKE_WORDS).sort(), "every text Make sends today is in the editor, and only those say Sending now");
  assert.match(X.TEXTS.find(t => t.key === "trainer_new_eval").offered.words, /^🚨🚨 Track 500 - Schedule Eval 🚨🚨\n\{first_name\} \{last_name\}\n\{appointment_day\}, \{appointment_date\} at/, "the meeting's wording is offered as a template (two emojis each side, date included — Joshua 2026-09-16)");
  const P = require("../lib/pipeline.js");
  assert.equal(X.render(X.wordsFor(null, "care_call"), { first_name: "Sam" }), P.CARE_TEXT("Sam"), "the office-call text starts as today's words");
});

test("every text sits at a known stage and goes to a known role", () => {
  const stages = new Set(X.STAGES.map(s => s.key));
  const roles = new Set(X.ROLES.map(r => r.key));
  for (const t of X.TEXTS) { assert.ok(stages.has(t.stage), t.key); assert.ok(roles.has(t.role), t.key); }
  assert.deepEqual(X.STAGES.map(s => s.key), ["new_lead", "not_booked", "booked", "answered", "closed"]);
  const v = X.view(null);
  assert.equal(v.texts.length, X.TEXTS.length);
  assert.ok(v.texts.every(t => t.active_id === "starting" && t.templates[0].builtin), "starting words are always the first template");
});

test("check: unknown fields, empty words and long texts are refused with the reason", () => {
  assert.match(X.check("booking_link", "Hello {first_name}, {bogus}").error, /Unknown field \{bogus\}/);
  assert.match(X.check("booking_link", "   ").error, /empty/);
  assert.match(X.check("booking_link", "x".repeat(700)).error, /Keep it under 640/);
  assert.equal(X.check("booking_link", "Hello {first_name}\u0000!").value, "Hello {first_name}!", "control characters removed");
  assert.equal(X.check("nope", "x").error, "Unknown text.");
  assert.match(X.check("ops_new_lead", "{next_step} {link}").error, /words of your own/, "a text made only of fields can come out empty");
  assert.equal(X.render("Hi {first_name}.\n{safety_flag}\n\n\nBye {nobody}", { first_name: "Sam" }), "Hi Sam.\n\nBye");
});

test("templates: add several, edit, put one in use (full name), never delete the one in use", async () => {
  const f = fakeSb();
  const who = "Angela (angela@x)";
  const one = await X.change(f.sb, { op: "template_save", key: "booking_link", name: "Short", words: "Hi {first_name}! Book here: {booking_link}" }, who);
  assert.equal(one.status, 200);
  const two = await X.change(f.sb, { op: "template_save", key: "booking_link", name: "Friendly", words: "Hey {first_name}, pick a time: {booking_link}" }, who);
  const [idOne, idTwo] = [one.body.saved_id, two.body.saved_id];
  assert.ok(idOne && idTwo && idOne !== idTwo);
  assert.equal(X.wordsFor(f.row.value, "booking_link"), MAKE_WORDS.booking_link, "saving a template does not change the words in use");
  assert.equal((await X.change(f.sb, { op: "activate", key: "booking_link", id: idTwo, fullName: "Angela" }, who)).status, 400, "one word is not a full name");
  assert.equal((await X.change(f.sb, { op: "activate", key: "booking_link", id: idTwo, fullName: "Angela Simonton" }, who)).status, 200);
  assert.equal(X.wordsFor(f.row.value, "booking_link"), "Hey {first_name}, pick a time: {booking_link}");
  assert.match(f.row.value.texts.booking_link.active_by, /^Angela Simonton \(Angela/);
  assert.equal((await X.change(f.sb, { op: "template_delete", key: "booking_link", id: idTwo }, who)).status, 409, "the template in use cannot be deleted");
  assert.equal((await X.change(f.sb, { op: "template_delete", key: "booking_link", id: "starting" }, who)).status, 400, "the starting words stay");
  assert.equal((await X.change(f.sb, { op: "template_save", key: "booking_link", id: "starting", name: "x", words: "Hi" }, who)).status, 400, "the starting words cannot be edited");
  await X.change(f.sb, { op: "template_save", key: "booking_link", id: idTwo, name: "Friendly", words: "Hey there {first_name}! {booking_link}" }, who);
  assert.equal(X.wordsFor(f.row.value, "booking_link"), "Hey there {first_name}! {booking_link}", "editing the template in use changes the words in use");
  const view = X.view(f.row.value).texts.find(t => t.key === "booking_link");
  assert.equal(view.templates.length, 3); assert.equal(view.active_name, "Friendly");
  assert.equal(view.preview, "Hey there Sam! https://ldtt-sandbox.vercel.app/book/example");
  assert.equal((await X.change(f.sb, { op: "template_delete", key: "booking_link", id: idOne }, who)).status, 200);
  assert.equal((await X.change(f.sb, { op: "activate", key: "booking_link", id: "starting", fullName: "Angela Simonton" }, who)).status, 200);
  assert.equal(X.wordsFor(f.row.value, "booking_link"), MAKE_WORDS.booking_link, "back to the starting words");
  assert.equal((await X.change(f.sb, { op: "template_save", key: "booking_link", name: "Bad", words: "{oops}" }, who)).status, 400);
  assert.ok(f.row.value.log.length >= 6, "every change is logged with who and when");
});

test("a text has at most 10 templates; words saved by the first editor carry over", async () => {
  const f = fakeSb();
  for (let i = 0; i < X.MAX_TEMPLATES; i++) assert.equal((await X.change(f.sb, { op: "template_save", key: "ops_new_lead", name: `T${i}`, words: `Lead {client_name} ${i}` }, "x")).status, 200);
  assert.equal((await X.change(f.sb, { op: "template_save", key: "ops_new_lead", name: "one more", words: "Lead {client_name}" }, "x")).status, 400);
  const old = { texts: { booking_link: { published: "Hi {first_name} {booking_link}", published_by: "A B (a@x)", draft: "Draft {first_name}" } } };
  assert.equal(X.wordsFor(old, "booking_link"), "Hi {first_name} {booking_link}");
  assert.deepEqual(X.slotOf(old, "booking_link").templates.map(t => t.name), ["Published earlier", "Draft"]);
});

test("every Make send carries the portal's finished words; the test text goes only to the locked phone after the switch", () => {
  const src = read("lib/pipeline.js");
  assert.match(src, /async function postHook\(url, rawPayload\) \{\n  const payload = await withTextMessages\(rawPayload\);/);
  assert.match(src, /if \(payload\.pathway === "new_lead"\) return \{ \.\.\.payload, message: T\.render\(words\("booking_link"\), payload\) \};/);
  assert.match(src, /customer_message: T\.render\(words\("booking_confirmation"\), \{ \.\.\.payload, dog_name: payload\.dog_name \|\| "your dog" \}\), trainer_message: T\.render\(words\("trainer_new_eval"\), payload\)/);
  assert.match(src, /catch \{ state = null; \}/, "an unreadable editor never fails a send (starting words are used)");
  assert.match(src, /const words = key => \{ const saved = T\.wordsFor\(state, key\); return T\.check\(key, saved\)\.error \? T\.wordsFor\(null, key\) : saved; \};/, "words that fail the checks are never sent");
  assert.match(read("supabase/migrations/20260914120000_practice_pipeline_texts_server_only.sql"), /as restrictive for all to authenticated, anon\n  using \(key <> 'pipeline_texts'\)\n  with check \(key <> 'pipeline_texts'\);/, "no browser login can read or write the texts row");
  const test = src.match(/async function sendTextTest\(key, draftWords\) \{[\s\S]*?\n\}\n/)[0];
  // Rule 95: the phone comes from sendTestPhoneFor (client = the locked phone, trainer = override / test phone,
  // Operations = the Operations phone in use) and must still be an ACTIVE tester.
  assert.match(test, /const \{ phone, role \} = sendTestPhoneFor\(key, settings\);/, "rule 95: a test is routed by role");
  assert.match(test, /if \(!phone \|\| !testers\.has\(phone\)\) return \{ ok: false, message: "The test phone is not an active tester phone\." \};/, "rule 84: a test still needs an active tester phone");
  assert.match(src, /if \(role === "trainer"\) return \{ role, phone: trainerOverridePhone\(s\) \|\| e164\(s\.practice_trainer_phone \|\| ""\) \|\| SEND_TEST_PHONE \};/, "a trainer test never reaches a real trainer");
  assert.match(src, /return \{ role: "client", phone: SEND_TEST_PHONE \};/, "rule 84: a client test still goes only to Joshua");
  assert.match(test, /message = `\[TEST\] \$\{T\.render\(ok\.value, T\.SAMPLE\)\}`/);
  const api = read("api/pipeline.js");
  assert.match(api, /if \(process\.env\.LDTT_TEXTS_FROM_PORTAL !== "1"\) return res\.status\(409\)/, "Send test waits for the Make switch");
  assert.match(api, /\["text_template_save", "text_template_delete", "text_activate"\]\.includes\(op\)\) \{\n[^\n]*\n      const access = await authorizeRequest\(req, res, \{ require: "super"/, "Super Admin only");
  assert.match(api, /if \(op === "text_test"\) \{\n[^\n]*\n      const access = await authorizeRequest\(req, res, \{ require: "super"/, "Send test: Super Admin only");
  assert.match(api, /if \(op === "texts"\) \{\n(?:[^\n]*\n){2}        if \(!access\.isSuperAdmin\) return res\.status\(403\)/, "office admins cannot even read the texts");
  assert.match(src, /if \(payload\.pathway === "customer_care"\) return \{ \.\.\.payload, message: T\.render\(words\("care_call"\), payload\) \};/);
  const app = read("trainer-backoffice/app.js");
  assert.match(app, /function pipelineTextsPanel\(\) \{\n  if \(!window\.LDTT_IS_SANDBOX \|\| !isSuperAdmin\(\)\) return "";/, "only the Super Admin sees the page");
  assert.match(app, /Currently being used · /);
  assert.match(app, /data-ptx-role=/); assert.match(app, /class="ptx-timeline"/); assert.match(app, /data-ptx-activate=/);
});

test("reengage_invite (Joshua 2026-09-23): a client TEMPLATE only — exact words, editable like the others, wired to no trigger and no scheduler", () => {
  const t = X.TEXTS.find(x => x.key === "reengage_invite");
  assert.ok(t, "the template exists");
  assert.equal(t.role, "client");
  assert.equal(t.stage, "not_booked");
  assert.equal(t.status, "not_yet", "it never claims to be sending");
  assert.equal(t.words, "Hi {first_name}, it's Lorenzo's Dog Training Team. We spoke about training for {dog_name}. We would love to help. Pick a free evaluation time here: {booking_link}. Or call us at (216) 475-5999.");
  assert.deepEqual(t.fields, ["first_name", "dog_name", "booking_link"]);
  assert.equal(X.check("reengage_invite", t.words).value, t.words, "the default words pass the editor's own checks");
  assert.equal(X.render(X.wordsFor(null, "reengage_invite"), { first_name: "Sam", dog_name: "Max", booking_link: "https://x/book" }),
    "Hi Sam, it's Lorenzo's Dog Training Team. We spoke about training for Max. We would love to help. Pick a free evaluation time here: https://x/book. Or call us at (216) 475-5999.");
  // TEMPLATE ONLY: nothing sends it. Neither the pipeline's send code nor the follow-up scheduler names the key.
  assert.ok(!read("lib/pipeline.js").includes("reengage_invite"), "lib/pipeline.js never sends it");
  assert.ok(!read("lib/reengage.js").includes("reengage_invite"), "the follow-up scheduler never reads it");
  assert.equal(R.SENDING_ENABLED, false, "the scheduler itself is still off");
});

test("service-dog leads wear a gold tag on office, Sales and trainer cards and in the lead details", () => {
  const app = read("trainer-backoffice/app.js");
  const fn = app.match(/function isServiceDogLead\(lead = \{\}\) \{[\s\S]*?\n\}\n/)[0];
  assert.match(fn, /service\[\\s-\]\*dog/);
  assert.ok((app.match(/\$\{serviceDogTag\(lead\)\}/g) || []).length >= 4, "four places");
  assert.match(read("trainer-backoffice/styles.css"), /\.lead-tag-service-dog \{/);
});

test("follow-up plan: Lorenzo's text first, then the booking link at 30 min and 24 h (still not sending; Joshua 2026-09-16)", () => {
  assert.deepEqual(R.STEPS.map(s => s.kind), ["tim", "link", "link"]);
  assert.equal(R.SENDING_ENABLED, false);
  assert.equal(R.linkTextFor({ first_name: "Angela Marie" }, "https://x/book"), "Hi Angela, it's Lorenzo's Dog Training Team. Here is your link to book your free evaluation:\nhttps://x/book\n\nReply STOP to opt out.");
  const p = R.plan({ first_name: "A", phone: "4405550101", sms_consent: true, status: "new_inquiry", created_at: new Date(Date.parse("2026-09-14T16:00:00Z") - 20 * 60000).toISOString(), raw_payload: {} }, Date.parse("2026-09-14T16:00:00Z"));
  assert.deepEqual([p.next.step, p.next.kind], [2, "link"]);
  assert.equal(R.eligibility({ first_name: "A", phone: "1", sms_consent: true, status: "new_inquiry", raw_payload: { lead_type: "pdf_download" } }).ok, false, "booklet leads stay out (Joshua: No)");
});

test("appointment_date reads \"September 15, 2026\" (Joshua 2026-09-17): the sample and the real slotParts carry the year", () => {
  assert.equal(X.SAMPLE.appointment_date, "September 15, 2026");
  assert.equal(X.SAMPLE.appointment_day, "Tuesday");
  const src = readFileSync(resolve(import.meta.dirname, "../lib/pipeline.js"), "utf8");
  assert.match(src, /date: date\.toLocaleDateString\("en-US", \{ \.\.\.opts, month: "long", day: "numeric", year: "numeric" \}\)/);
  assert.match(src, /day: date\.toLocaleDateString\("en-US", \{ \.\.\.opts, weekday: "long" \}\)/, "appointment_day stays the weekday name");
});
