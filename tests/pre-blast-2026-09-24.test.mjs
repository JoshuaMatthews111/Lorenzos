// 2026-09-24, before the 7 AM re-engage send.
//  1. The client EMAIL copy of a text no longer repeats the link, the phone number or a texting opt-out.
//  2. The practice-copy trainer sign-in route answers nothing to an anonymous caller (portal audit: it could
//     list every trainer login and mint a token that opens the trainer's REAL live portal).
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
process.env.SUPABASE_URL = process.env.SUPABASE_URL || "http://supabase.test";
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "test-key";

test("email copy: link shown once (as the button), phone once, no texting opt-out", () => {
  const P = require("../lib/pipeline.js");
  const T = require("../lib/pipeline-texts.js");
  const words = key => Object.values(T.TEXTS).find(t => t.key === key).words;
  const link = "https://lorenzosdogtrainingteam.com/dog-training-cleveland-oh?zip=44233";
  const re = P.emailBodyFromTextWords(T.render(words("reengage_invite"), { first_name: "Lisa", booking_link: link }), link);
  assert.equal(re, "Hi Lisa, it's Lorenzo's Dog Training Team. You reached out about training for your dog and we'd still love to help. Pick a free evaluation time here:");
  assert.ok(!re.includes(link) && !/Reply STOP/i.test(re) && !/436-4959/.test(re));
  const care = P.emailBodyFromTextWords(T.render(words("care_call"), { first_name: "Katie" }), "");
  assert.match(care, /Our office will call you shortly from \(866\) 436-4959\.$/, "a sentence that gives the number is kept");
  assert.ok(!/Reply STOP/i.test(care));
  assert.equal(P.emailBodyFromTextWords("Hello there.", ""), "Hello there.", "plain words come back unchanged");
});

test("practice sign-in route: an anonymous caller gets 401 and no trainer list", async () => {
  process.env.LDTT_SANDBOX = "1";
  for (const m of ["../lib/sandbox.js", "../lib/portal-auth.js", "../api/sandbox-trainer-login.js"]) delete require.cache[require.resolve(m)];
  const calls = [];
  global.fetch = async url => { calls.push(String(url)); return { ok: false, status: 401, text: async () => "{}", json: async () => ({}) }; };
  const handler = require("../api/sandbox-trainer-login.js");
  for (const method of ["GET", "POST"]) {
    let status = 0, body = null;
    const res = { setHeader() {}, status(s) { status = s; return this; }, json(b) { body = b; return this; }, end() { return this; } };
    await handler({ method, headers: {}, body: { email: "trainer@example.com" } }, res);
    assert.equal(status, 401, method);
    assert.equal(body.ok, false);
    assert.ok(!("trainers" in body) && !("token_hash" in body), "nothing handed out");
  }
  assert.ok(!calls.some(u => /portal_users|generate_link/.test(u)), "no login was listed or minted");
  delete process.env.LDTT_SANDBOX;
});
