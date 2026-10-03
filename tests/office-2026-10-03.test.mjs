// Office 2026-10-03: (1) saving an eval time moves an open lead to Evaluation Scheduled; (2) two or more dogs
// each get the dog questions, labeled by name, and household questions are asked once.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const PE = require("../lib/pre-eval.js");

test("trainer eval_time moves an open lead to Evaluation Scheduled, never back", () => {
  const src = fs.readFileSync(new URL("../api/trainer-lead-action.js", import.meta.url), "utf8");
  assert.match(src, /const BEFORE_EVAL = new Set\(\["site_visit", "new_inquiry", "office_contacted", "engaged_no_outcome", "follow_up_call_needed", "evaluation_cancelled"\]\)/);
  assert.match(src, /if \(when && BEFORE_EVAL\.has\(before\.status\)\) \{ changes\.status = "evaluation_scheduled";/);
});

test("office eval time save moves an open lead unless the save sets a status itself", () => {
  const src = fs.readFileSync(new URL("../api/operational-mutation.js", import.meta.url), "utf8");
  assert.match(src, /if \(when && !\("status" in changes\) && BEFORE_EVAL\.includes\(before\.status\)\) changes\.status = "evaluation_scheduled";/);
});

test("one dog: answers and rows read exactly as before", () => {
  const { answers, errors } = PE.cleanAnswers({ top_behavior: "pulling", bite_history: "No", children: "No", other_animals: "No" }, ["Max"]);
  assert.deepEqual(errors, []);
  assert.deepEqual(answers.more_dogs, []);
  assert.deepEqual(PE.answerRows(answers, ["Max"]).slice(0, 2), [["What is the #1 behavior you want help with?", "pulling"], ["Has your dog ever bitten a person?", "No"]]);
});

test("two dogs: each dog answers, rows and flags name the dog, household once", () => {
  const body = { top_behavior: "pulling", bite_history: "No", children: "Yes", other_animals: "No", dogs: [{}, {}],
    more_dogs: [{ top_behavior: "barking", bite_history: "Attempted bite", bite_details: "mail carrier", children: "No" }] };
  const { answers, errors } = PE.cleanAnswers(body, ["Max", "Bella"]);
  assert.deepEqual(errors, []);
  assert.equal(answers.more_dogs[0].children, undefined, "household questions are not stored per dog");
  const rows = PE.answerRows(answers, ["Max", "Bella"]);
  assert.ok(rows.some(r => r[0] === "Max: What is the #1 behavior you want help with?" && r[1] === "pulling"));
  assert.ok(rows.some(r => r[0] === "Bella: What is the #1 behavior you want help with?" && r[1] === "barking"));
  assert.ok(rows.some(r => r[0] === "Are there children in the household?" && r[1] === "Yes"));
  assert.deepEqual(PE.safetyFlags(answers, ["Max", "Bella"]), ["Bella: Bite history: Attempted bite"]);
});

test("two dogs: the second dog's required answers are required", () => {
  const { errors } = PE.cleanAnswers({ top_behavior: "x", bite_history: "No", children: "No", other_animals: "No", dogs: [{}, {}] }, ["Max", "Bella"]);
  assert.deepEqual(errors, ["Please answer for Bella: What is the #1 behavior you want help with?", "Please answer for Bella: Has your dog ever bitten a person?"]);
});
