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

test("security 2026-09-23: no login via URL, the shells scrub credential params, and the staff form can never GET", () => {
  const { readFileSync } = require("node:fs");
  const read = f => readFileSync(new URL("../" + f, import.meta.url), "utf8");
  for (const shell of ["staff.html", "trainer-backoffice/index.html"]) {
    const html = read(shell);
    assert.match(html, /<form id="loginForm" class="login-form" method="post"/, `${shell}: the login form posts - a broken script can never put the password in the address`);
    assert.ok(html.includes('bad=["password","pass","pwd","passwd","username"]'), `${shell}: the URL scrubber is present`);
    const scrubAt = html.indexOf("history.replaceState");
    const firstOtherScript = html.indexOf("location.search", html.indexOf("</title>"));
    assert.ok(scrubAt > 0 && (firstOtherScript === -1 || scrubAt < firstOtherScript), `${shell}: the scrubber runs before any other script reads the URL`);
  }
  const app = read("trainer-backoffice/app.js");
  for (const bad of ['params.get("password")', 'params.get("pwd")', 'params.get("username")', 'get(\'password\')']) {
    assert.ok(!app.includes(bad), `app.js never reads ${bad} - the only way in is the login form (and the sandbox-only magic link)`);
  }
  // The magic-link token_hash stays a sandbox-only JSON answer, never a live link.
  const sbl = read("api/sandbox-trainer-login.js");
  assert.match(sbl, /if \(!isSandbox\(\)\) return reply\(res, 404/, "the passwordless door stays 404 on live");
  assert.ok(!sbl.includes("action_link:"), "the full magic link is never returned");
});

test("go-live: the LIVE booking page never wears the PRACTICE COPY bar (rule 96)", async () => {
  const { readFileSync } = require("node:fs");
  const src = readFileSync(new URL("../api/booking-page.js", import.meta.url), "utf8");
  assert.ok(src.includes("practice: isSandbox()"), "the flag follows the schema, never a hardcoded true");
  const handler = require("../api/booking-page.js");
  global.fetch = async () => ({ ok: true, status: 200, json: async () => [], text: async () => "[]", headers: new Headers() });
  const res = { statusCode: 0, headers: {}, setHeader() {}, status(c) { this.statusCode = c; return this; }, send(b) { this.body = b; return this; }, json(b) { this.body = b; return this; } };
  await handler({ method: "GET", headers: {}, query: {} }, res);
  assert.equal(res.statusCode, 200);
  assert.ok(!String(res.body).includes("PRACTICE COPY"), "no practice bar on live");
});

// POLICY REVERSAL 2026-09-23 (Joshua + Lorenzo, owner decision): clients now get TRANSACTIONAL email
// twins of their texts. There is still no signup / activation / verification email, ever, on any
// submit door (tests/lead-integrity-2026-09-23.test.mjs keeps pinning that).
test("client email twins: live sends to the lead's own address; the practice copy redirects to the practice inbox", async () => {
  process.env.RESEND_API_KEY = "re_test_key";
  const sent = [];
  global.fetch = async (url, options = {}) => {
    const u = String(url);
    if (u.includes("api.resend.com")) {
      sent.push({ body: JSON.parse(options.body), key: options.headers?.["Idempotency-Key"] });
      return { ok: true, status: 200, json: async () => ({ id: "em_1" }), text: async () => '{"id":"em_1"}', headers: new Headers() };
    }
    return { ok: true, status: 200, json: async () => [], text: async () => "[]", headers: new Headers() };
  };
  delete require.cache[require.resolve("../lib/pipeline.js")];
  delete process.env.LDTT_SANDBOX;
  const L = require("../lib/pipeline.js");
  const lead = { id: "00000000-0000-4000-8000-0000000000cc", email: "client@example.test", first_name: "Sam", raw_payload: {} };
  const r = await L.clientTwinEmail("booking_link", { lead, settings: {}, words: "Hi Sam, book here.", link: "https://www.lorenzosdogtrainingteam.com/book/x", idempotencyKey: "" });
  assert.equal(r.status, "sent", JSON.stringify(r));
  assert.equal(sent[0].body.to[0], "client@example.test", "live: the lead's OWN address");
  assert.equal(sent[0].key, "client:00000000-0000-4000-8000-0000000000cc:booking_link", "one idempotency key per lead + kind");
  assert.equal(sent[0].body.subject, "Book your free dog training evaluation");
  assert.ok(sent[0].body.text.includes("Reply to this email with STOP"), "every client email carries the opt-out");
  assert.ok(sent[0].body.html.includes("Lorenzo's Dog Training Team"), "the team signature");
  assert.ok(!/\bTim\b/.test(sent[0].body.text + sent[0].body.html + sent[0].body.subject));
  const noEmail = await L.clientTwinEmail("booking_link", { lead: { ...lead, email: "" }, settings: {}, words: "Hi." });
  assert.equal(noEmail.status, "skipped", "no address = no email, plain reason");
  // Practice copy: redirected to practice_email_to only.
  process.env.LDTT_SANDBOX = "1";
  delete require.cache[require.resolve("../lib/pipeline.js")];
  const LP = require("../lib/pipeline.js");
  const p = await LP.clientTwinEmail("care_call", { lead, settings: { practice_email_to: "inbox@practice.test" }, words: "Hi Sam." });
  assert.equal(p.status, "sent");
  assert.equal(sent.at(-1).body.to[0], "inbox@practice.test", "practice: only the practice inbox, never the real client");
  const pNone = await LP.clientTwinEmail("care_call", { lead, settings: { practice_email_to: "" }, words: "Hi Sam." });
  assert.equal(pNone.status, "skipped", "no practice inbox saved = nothing sent anywhere");
  delete process.env.LDTT_SANDBOX;
  delete require.cache[require.resolve("../lib/pipeline.js")];
});
