// Sandbox fix pass 2026-09-22 (critical audit follow-ups): trainer one-page on the practice copy ignores
// must_change_password, long eval dates on Sales/trainer cards, "(optional)" in brackets, the Lorenzo template label,
// and the 2.0 ad-page origin label that matches its Track 500 badge. Run: node --test tests/
import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const read = path => readFileSync(resolve(import.meta.dirname, "..", path), "utf8");
const app = read("trainer-backoffice/app.js");
const fn = name => app.match(new RegExp(`function ${name}\\([^)]*\\) \\{[\\s\\S]*?\\n\\}\\n`))[0];

test("trainer one-page: the practice copy ignores must_change_password; live still gates on it", () => {
  const run = (sandbox, mustChange) => {
    const ctx = {
      window: { LDTT_IS_SANDBOX: sandbox },
      session: { role: "trainer" },
      portalUser: { must_change_password: mustChange },
      state: { activeView: "dashboard" },
      portalProfileNeedsCompletion: () => false,
      trainerNav: () => [["dashboard"], ["leads"]],
      trainerScreens: { dashboard() {}, leads() {} }
    };
    vm.runInNewContext(`${fn("trainerOnePageViews")}\n${fn("trainerOnePageActive")}\nresult = trainerOnePageActive();`, ctx);
    return ctx.result;
  };
  assert.equal(run(true, true), true, "sandbox + flagged trainer: the whole one page");
  assert.equal(run(true, false), true);
  assert.equal(run(false, true), false, "live + flagged trainer: unchanged (password first)");
  assert.equal(run(false, false), true);
});

test("Sales and trainer cards: eval date in the long form", () => {
  const ctx = {};
  vm.runInNewContext(`${fn("parseTimestamp")}\n${fn("leadEvalLabel")}`, ctx);
  assert.equal(ctx.leadEvalLabel("2026-09-15T14:00:00Z", "America/New_York"), "Tuesday, September 15, 2026, 10:00 AM EDT");
  assert.equal(ctx.leadEvalLabel("2026-09-25T15:00:00Z", "America/Chicago"), "Friday, September 25, 2026, 10:00 AM CDT");
  assert.equal(ctx.leadEvalLabel("", "America/New_York"), "");
  assert.doesNotMatch(app, /weekday: "short", month: "short", day: "numeric", hour: "numeric"/, "the short \"Tue, Sep 15\" card format is gone");
});

test("\"optional\" is always in brackets on the portal's box labels", () => {
  for (const bare of ['<span class="hint">optional</span>', '"from the lead" : "optional"', "Add a picture to the text — optional", "<label>Optional Review Photo or Video"]) {
    assert.ok(!app.includes(bare), bare);
  }
  assert.ok(app.includes('<span class="hint">(optional) &mdash; marks them Became a Client</span>'));
  assert.ok(app.includes("<label>Review Photo or Video (optional)<input"));
});

test("the offered Operations template is labeled Lorenzo, never the old nickname", () => {
  const X = require("../lib/pipeline-texts.js");
  const ops = X.TEXTS.find(t => t.key === "ops_new_lead");
  assert.equal(ops.offered.name, "Track 500 (Lorenzo)");
  assert.ok(!JSON.stringify(X.TEXTS.map(t => [t.label, t.offered?.name])).includes("Tim"));
  assert.equal(X.TEXTS.find(t => t.key === "care_call").status, "in_use", "the office-call text is sent (pathway 1 hook)");
});

test("a 2.0 ad-page lead says where it came from, matching its Track 500 badge", () => {
  const ctx = {};
  vm.runInNewContext(`${fn("isAdPageAddress")}\n${fn("leadOriginLabel")}`, ctx);
  const label = source => ctx.leadOriginLabel({ source_page: source }, { source_page: source });
  assert.equal(label("https://ldtt-sandbox.vercel.app/ads/cleveland"), "Ad landing page 2.0");
  assert.equal(label("https://ldtt-ads-v2-sandbox.vercel.app/ann-arbor/"), "Ad landing page 2.0");
  assert.equal(label("ads/panama-city-beach"), "Ad landing page 2.0");
  assert.equal(label("contact.html"), "Website contact form");
  assert.equal(label("book/eric-beck"), "Website contact form");
  assert.equal(label("dog-training-cleveland-oh"), "Paid ad landing page");
  assert.equal(ctx.isAdPageAddress("https://lorenzosdogtrainingteam.com/contact"), false);
  assert.equal(ctx.isAdPageAddress("https://ldtt-ads-v2-sandbox.vercel.app/"), true);
});
