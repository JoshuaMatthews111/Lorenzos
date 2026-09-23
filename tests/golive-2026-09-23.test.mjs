// Go-live night 2026-09-23 (Joshua): while trainer_emails_hold is true in the pipeline settings row,
// LIVE trainer email twins are held — no trainer inbox gets an email until the office flips it off.
// The practice copy is untouched (its twins already go only to the practice test address, rule 95).
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "test-key";
process.env.SUPABASE_URL = process.env.SUPABASE_URL || "http://supabase.test";
delete process.env.LDTT_SANDBOX; // LIVE

const P = require("../lib/pipeline.js");

test("trainer_emails_hold: a live trainer email twin is held with a plain reason, before any lookup", async () => {
  global.fetch = async () => { throw new Error("nothing may be read while the hold is on"); };
  const pick = await P.trainerEmailFor({ trainer_id: "t-1" }, { id: "t-1", full_name: "Fred Harris", email: "fred@x" }, { trainer_emails_hold: true });
  assert.equal(pick.ok, false);
  assert.match(pick.reason, /held \(go-live switch trainer_emails_hold\)/);
});

test("trainer_emails_hold survives normalizeSettings and defaults to OFF", () => {
  assert.equal(P.defaultSettings().trainer_emails_hold, false);
  assert.equal(P.normalizeSettings({}).value.trainer_emails_hold, false, "a row saved before the key existed stays off");
  assert.equal(P.normalizeSettings({ trainer_emails_hold: true }).value.trainer_emails_hold, true);
  assert.equal(P.normalizeSettings({ trainer_emails_hold: "true" }).value.trainer_emails_hold, true);
  assert.equal(P.normalizeSettings({ trainer_emails_hold: "yes" }).value.trainer_emails_hold, false, "only a real true turns it on");
});

test("go-live: on LIVE the shared office line never counts as a trainer's phone (no trainer text to (866) 436-4959)", () => {
  const pick = P.trainerPhoneFor({ }, { full_name: "Fred Harris", phone: "(866) 436-4959" }, null, null);
  assert.equal(pick.ok, false);
  assert.match(pick.reason, /still on the shared office number/);
  const real = P.trainerPhoneFor({ }, { full_name: "Fred Harris", phone: "(619) 876-3022" }, null, null);
  assert.equal(real.ok, true);
  assert.equal(real.phone, "+16198763022");
});
