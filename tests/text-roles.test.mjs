// Rule 82 (Joshua 2026-09-14, presentation): the one-phone text lock is off. Practice texts go only to ACTIVE tester
// phones (Communications -> Testers), by role: Client = the form's phone, Trainer + Operations = the Settings boxes.
// The Text messages editor's Send test still goes only to Joshua. Run: node --test tests/
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const read = path => readFileSync(resolve(import.meta.dirname, "..", path), "utf8");

test("texts go only to active tester phones, by role; Send test stays with Joshua", () => {
  const src = read("lib/pipeline.js");
  assert.match(src, /const PRACTICE_TEXT_ONLY_TO = null;/);
  assert.match(src, /const SEND_TEST_PHONE = "\+14402142915";/);
  const fn = src.match(/async function activeTesterPhones\(\) \{[\s\S]*?\n\}\n/)[0];
  assert.match(fn, /communications_testers\?active=eq\.true/);
  assert.match(fn, /return new Set\(\); \/\/ fail closed/);
  assert.match(src, /if \(!testers\.has\(phone\)\) return \{ \.\.\.base, status: "skipped"/, "Operations: tester phones only");
  // 2026-09-17: one helper each decides the phone; on the practice copy both still demand an active tester.
  assert.match(src, /if \(isSandbox\(\) && !\(testers && testers\.has\(phone\)\)\) return \{ ok: false, phone, reason: `Practice copy: /, "client: tester phones only on the practice copy");
  assert.match(src, /if \(testers && !testers\.has\(phone\)\) return \{ ok: false, phone, reason: `Trainer alert: /, "trainer: tester phones only on the practice copy");
  assert.match(src, /const trainerPick = trainerPhoneFor\(lead, trainerRow, settings, testers\);/);
  const sendTest = src.match(/async function sendTextTest\(key, draftWords\) \{[\s\S]*?\n\}\n/)[0];
  assert.match(sendTest, /const phone = SEND_TEST_PHONE;/);
  assert.match(read("trainer-backoffice/app.js"), /<h3 style="margin:18px 0 4px">Who gets each practice text<\/h3>/);
});
