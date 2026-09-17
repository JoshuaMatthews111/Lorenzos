// Joshua 2026-09-15: "the trainer never gets the text response of the eval questions filled out ... they
// need to see it and then prompt them to log in to the portal to view more details about this lead."
// Run: node --test tests/   Nothing here talks to the real project.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "test-key";
process.env.SUPABASE_URL = process.env.SUPABASE_URL || "http://supabase.test";
const P = require("../lib/pipeline.js");
const T = require("../lib/pipeline-texts.js");
const read = path => readFileSync(resolve(import.meta.dirname, "..", path), "utf8");

test("the answers summary is short, readable and points to the portal for the rest", () => {
  const rows = [
    ["What is the #1 behavior you want help with?", "Pulling on the leash"],
    ["How often does the problem happen?", "Daily"],
    ["Are there children in the household?", "Yes"]
  ];
  const summary = P.answersSummary(rows);
  assert.match(summary, /Pulling on the leash/);
  assert.match(summary, /Daily/);
  assert.equal(summary.split("\n").length, 3, "three answers, three lines");
  const many = Array.from({ length: 20 }, (_, i) => [`Question ${i + 1}?`, "A fairly long answer that uses up room ".repeat(2)]);
  const capped = P.answersSummary(many);
  assert.ok(capped.length < 700, "capped for a text message");
  assert.match(capped, /more answers in the portal/);
});

test("the trainer text renders with day, date, time, address and the portal prompt", () => {
  const words = T.wordsFor(null, "pre_eval_answers");
  const rendered = T.render(words, {
    first_name: "Angela", last_name: "Simonton",
    appointment_day: "Thursday", appointment_date: "September 17, 2026", appointment_time: "10:00 AM EDT",
    service_address: "123 Main St, Cleveland, OH 44105",
    safety_flag: "", answers_summary: "• #1 behavior: pulling on the leash",
    trainer_portal_link: "https://ldtt-sandbox.vercel.app/staff?view=leads&lead=x"
  });
  assert.match(rendered, /Thursday, September 17, 2026 at 10:00 AM EDT/);
  assert.match(rendered, /123 Main St/);
  assert.match(rendered, /Log in to the trainer portal/);
  assert.doesNotMatch(rendered, /Track 500/, "trainer answer texts carry no internal code words");
  assert.equal(T.TEXTS.find(t => t.key === "pre_eval_answers").status, "in_use");
});

test("submitting the questions the FIRST time texts the trainer; edits do not", () => {
  const booking = read("api/booking.js");
  assert.match(booking, /const firstTime = !booking\.pre_eval\?\.first_submitted_at/);
  assert.match(booking, /if \(firstTime\) \{\s*await P\.afterPreEval\(\{ lead: record \}\)/);
  const pipeline = read("lib/pipeline.js");
  assert.match(pipeline, /pathway: "pre_eval_answered"/);
  assert.match(pipeline, /customer_phone: ""/, "the customer branch stays empty: this text is for the trainer only");
  assert.match(pipeline, /trainer_message: T\.render\(words\("pre_eval_answers"\), payload\)/);
});
