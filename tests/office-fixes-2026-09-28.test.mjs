// Office reports 2026-09-28 (Missy + the team): the lead card said the follow-ups were "not sending yet" (they are ON
// since 2026-09-25), Eric Beck's pasted/uploaded video never reached his live page, and a trainer could not save a
// note or change the eval date + time on a lead. DO-NOT-BREAK rules 124-127.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = path => readFileSync(resolve(import.meta.dirname, "..", path), "utf8");
const app = read("trainer-backoffice/app.js");
const api = read("api/trainer-lead-action.js");

test("the lead card shows the follow-up texts that really went out; no 'waits for Joshua's go' on follow-ups or pre-eval", () => {
  assert.match(app, /label: "Follow-ups if not booked \(15 min, 30 min, next day\)"/);
  assert.match(app, /case "followup": return journeyFollowupState\(pipeline, booking, lead\);/);
  assert.doesNotMatch(app, /40 min, 24 h, 48 h\)", channel/);
  const fn = app.slice(app.indexOf("function journeyFollowupState"), app.indexOf("function journeyStepState"));
  assert.match(fn, /pipeline\.followups/);
  assert.match(fn, /came in before the follow-up texts started/);
  assert.match(app, /fromRecord\(pipeline\.pre_eval_text, "Answers texted to the trainer"\)/);
  assert.match(app, /Not switched on: Lorenzo is not texted when a deal closes\./);
});

test("a pasted or uploaded trainer video on a live page is published and checked", () => {
  const fn = app.slice(app.indexOf("async function saveTrainerVideoToLivePage"), app.indexOf("async function publishTrainerPageWorkflow"));
  assert.match(fn, /livePage \? publishTrainerPageWorkflow\(trainer, true\)/);
  assert.match(fn, /reportLiveLandingPage\(/);
  assert.match(app, /await saveTrainerVideoToLivePage\(trainer, `\$\{trainer\.name\} trainer video was set from/);
  assert.match(app, /await saveTrainerVideoToLivePage\(trainer, `\$\{trainer\.name\} trainer video was replaced with/);
});

test("a trainer saves a note on its own; it lands in the office's Office Notes list for that lead", () => {
  assert.match(app, /data-trainer-lead-action="note"/);
  assert.match(api, /"note", "eval_time"\]\.includes\(action\)/);
  const fn = api.slice(api.indexOf("async function trainerNote"), api.indexOf("module.exports = async function handler"));
  assert.match(fn, /\/rest\/v1\/office_notes/);
  assert.match(fn, /entity_type: "lead"/);
  assert.match(fn, /Trainer note \(\$\{who\}\)/);
});

test("a trainer can change the eval date + time on their own open lead (same field as the office)", () => {
  assert.match(app, /data-trainer-eval-at data-lead-ref=/);
  assert.match(app, /data-trainer-lead-action="eval_time"/);
  assert.match(api, /changes = \{ eval_scheduled_at: when \? when\.toISOString\(\) : null \}/);
  assert.match(api, /Eval date and time saved\. The office sees it\./);
});
