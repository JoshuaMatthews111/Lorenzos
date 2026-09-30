// Lead score (Zoom 2026-09-29, Lorenzo + Angela; built 2026-09-30). Hot / Warm / Nurture + Top-paying, from what the
// lead itself says or does. Display only.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const require = createRequire(import.meta.url);
const M = require("../trainer-backoffice/metrics.js");
const read = path => readFileSync(resolve(import.meta.dirname, "..", path), "utf8");
const lead = (raw = {}, over = {}) => ({ id: "l1", raw_payload: raw, ...over });

test("Lorenzo's examples score as he ranked them", () => {
  const bite = M.leadScore(lead({ problem: "Our dog bit the neighbor and animal control came out" }));
  assert.equal(bite.tier, "warm"); assert.equal(bite.score, 5); assert.equal(bite.topPaying, true); assert.equal(bite.safety, true);
  const baby = M.leadScore(lead({ comments: "Baby on the way in December and the dog jumps on everyone" }));
  assert.equal(baby.reasons[0].key, "baby"); assert.equal(baby.topPaying, true);
  const vet = M.leadScore(lead({ heard_about_us: "My Veternarian" }));
  assert.equal(vet.reasons[0].key, "referral");
  const referred = M.leadScore(lead({}, { lead_source: "Referred by a past client" }));
  assert.equal(referred.reasons[0].key, "referral");
  const expensive = M.leadScore(lead({ problem: "I paid $60,000 for this protection dog and he pulls me everywhere" }));
  assert.ok(expensive.reasons.some(r => r.key === "expensive"));
  const elderly = M.leadScore(lead({ comments: "My mom is 82 years old and the puppy knocks her down" }));
  assert.ok(elderly.reasons.some(r => r.key === "elderly"));
});

test("Angela's engagement points: booked +3, pre-evaluation answered +2 -> Hot with a bite", () => {
  const l = lead({ booking: { slot_start: "2026-10-01T14:00:00Z", pre_eval: { first_submitted_at: "x", answers: { bite_history: "Bite that broke skin", disruption: "5" } } } });
  const s = M.leadScore(l);
  assert.deepEqual(s.reasons.map(r => r.key).sort(), ["aggression", "booked", "impact", "pre_eval"]);
  assert.equal(s.score, 9); assert.equal(s.tier, "hot");
  assert.equal(M.leadScore(lead({ problem: "pulls on the leash" })).tier, "nurture", "no signs yet");
});

test("the Kind filter offers Hot / Warm / Nurture / Top-paying, and cards + the lead panel show the score", () => {
  const keys = M.LEAD_KIND_FILTERS.map(([k]) => k);
  for (const k of ["hot", "warm", "nurture", "top_paying"]) assert.ok(keys.includes(k), k);
  assert.ok(M.leadKinds(lead({ problem: "bit a child, police report" })).has("top_paying"));
  const app = read("trainer-backoffice/app.js");
  assert.equal((app.match(/\$\{recycledTag\(lead\)\}\$\{leadScoreTag\(lead\)\}/g) || []).length, 5, "office + trainer cards");
  assert.equal((app.match(/\$\{recycledLine\(lead\)\}\$\{leadScoreLine\(lead\)\}/g) || []).length, 2, "office + trainer lead panels");
});
