// Office 2026-10-08: reassigning a lead (Shauna Leff, Brady -> Eric Beck) saved trainer_id but left trainer_slug on
// Brady, and the office screen matched the slug first. Now the id wins and both save paths move the slug too.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const read = f => fs.readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
test("office screen: trainer_id wins over a stale trainer_slug", () => {
  assert.match(read("trainer-backoffice/app.js"), /\(row\.trainer_id && state\.trainers\.find\(item => item\.remoteId === row\.trainer_id\)\) \|\| state\.trainers\.find\(item => item\.slug === row\.trainer_slug\)/);
});
test("hand-off and office assign both move trainer_slug", () => {
  assert.match(read("api/trainer-lead-action.js"), /changes\.trainer_slug = targetSlug \|\| targetRow\.slug/);
  assert.match(read("api/operational-mutation.js"), /if \(t\?\.slug\) changes\.trainer_slug = t\.slug;/);
});

test("a trainer note is saved once: server answers with the existing copy, the box empties", () => {
  assert.match(read("api/trainer-lead-action.js"), /if \(same\?\.id\) return reply\(res, 200, \{ ok: true, already: true/);
  assert.match(read("trainer-backoffice/app.js"), /if \(action === "note"\) \{ const box = document\.querySelector/);
});
