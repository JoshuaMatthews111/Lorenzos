// Joshua 2026-09-28 (option A): the leads that never reached the office Google Sheet are resent ONCE, by the server,
// behind a disarmed switch that turns itself off before it works (the email_campaign pattern).
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "test-key";
process.env.SUPABASE_URL = process.env.SUPABASE_URL || "http://supabase.test";
delete process.env.LDTT_SANDBOX;
const G = require("../lib/google-sheet-resend.js");
const src = readFileSync(resolve(import.meta.dirname, "..", "lib/google-sheet-resend.js"), "utf8");

test("not armed = nothing is read or sent", async () => {
  const calls = [];
  global.fetch = async (url, opts = {}) => { calls.push([String(url), opts.method || "GET"]); return { ok: true, status: 200, text: async () => JSON.stringify([{ key: G.KEY, value: { armed: false }, updated_at: "t" }]) }; };
  const out = await G.runGoogleSheetResend();
  assert.equal(out.armed, false);
  assert.equal(calls.filter(([u]) => /docs\.google\.com/.test(u)).length, 0);
  assert.equal(calls.filter(([, m]) => m !== "GET").length, 0);
});

test("the row keeps the lead's answers and says when it first came in", () => {
  const { entries, received } = G.entriesFor({ first_name: "Ann", last_name: "Lee", email: "a@x.com", phone: "2165551234", created_at: "2026-09-25T13:18:41Z",
    raw_payload: { i_want_to: "Download the free 5-step calm dog blueprint", heard_about_us: "Paid ads market page", comments: "Pulls on leash" } });
  assert.match(entries.comments, /^Resent 2026-09-28: first received Sep 25, 2026, 9:18 AM ET/);
  assert.match(entries.comments, /Pulls on leash$/);
  assert.match(received, /Sep 25, 2026/);
  assert.equal(entries.first_name, "Ann");
});

test("safety: disarm first, dry mode sends nothing, every send is recorded, practice never sends", () => {
  assert.match(src, /updated_at=eq\.\$\{encodeURIComponent\(row\.updated_at\)\}/);
  assert.match(src, /armed: false, status: "running"/);
  assert.match(src, /if \(mode === "dry"\) \{[\s\S]*?continue;\n    \}/);
  assert.match(src, /payload_hash: "resend-2026-09-28"/);
  assert.match(src, /if \(isSandbox\(\)\) \{ skipped \+= 1; continue; \}/);
});
