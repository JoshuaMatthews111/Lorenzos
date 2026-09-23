// The 9:30 AM re-engage sender (Joshua 2026-09-23) — ARMED BUT UNAIMED.
// Pins: idempotency (a lead can never get the blast twice), consent gating (text only with SMS
// consent; the email twin goes regardless, rule 99), the kill switch (armed:false or a missing
// key stops everything), disarm-after-run (the runner disarms BEFORE the first send and writes a
// summary), and the practice email redirect (practice_email_to only).
// Run: node --test tests/   Nothing here talks to the real project (global fetch is replaced).
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "test-key";
process.env.SUPABASE_URL = process.env.SUPABASE_URL || "http://supabase.test";
process.env.LDTT_MAKE_HOOK_PATHWAY1 = "https://hook.us2.make.com/abc123reengage";
const read = path => readFileSync(resolve(import.meta.dirname, "..", path), "utf8");

const TESTER = "+14405550123";
const LEAD_ID = "00000000-0000-4000-8000-000000000042";

function makeLead(over = {}) {
  return {
    id: LEAD_ID, version: 1, first_name: "Sam", last_name: "Tester", dog_name: "Max",
    phone: "(440) 555-0123", email: "sam@example.test", zip: "32507", sms_consent: true,
    status: "engaged_no_outcome", raw_payload: {}, ...over
  };
}

function load(sandbox) {
  for (const m of ["../lib/sandbox.js", "../lib/booking.js", "../lib/pipeline.js"]) delete require.cache[require.resolve(m)];
  if (sandbox) process.env.LDTT_SANDBOX = "1"; else delete process.env.LDTT_SANDBOX;
  return require("../lib/pipeline.js");
}

// Stateful stub: the lead row and the settings row live in `world`, PATCHes really change them,
// so the claim-before-send and never-twice behaviour is exercised for real.
function stubFetch(world, calls) {
  global.fetch = async (url, options = {}) => {
    const u = new URL(String(url));
    let body = options.body;
    if (typeof body === "string") { try { body = JSON.parse(body); } catch { /* text */ } }
    calls.push({ host: u.host, path: u.pathname, method: options.method || "GET", body, query: u.search });
    const res = (status, data, text) => ({ ok: status < 400, status, text: async () => text ?? JSON.stringify(data), json: async () => data });
    if (u.host === "hook.us2.make.com") return res(world.hookStatus || 200, null, world.hookStatus >= 400 ? "Filtered" : "Accepted");
    if (u.host === "api.resend.com") { world.resendSends = (world.resendSends || []); world.resendSends.push(body); return res(200, { id: `re_${world.resendSends.length}` }); }
    if (u.pathname.startsWith("/rest/v1/communications_testers")) return res(200, [{ phone: TESTER }]);
    if (u.pathname.startsWith("/rest/v1/ad_pages")) return res(200, world.adPages || []);
    if (u.pathname.startsWith("/rest/v1/site_settings")) {
      if ((options.method || "GET") === "PATCH") {
        if (!world.settings) return res(200, []);
        if (u.search.includes("updated_at=eq.") && !u.search.includes(encodeURIComponent(world.settings.updated_at))) return res(200, []);
        world.settings = { ...world.settings, value: body.value, updated_at: new Date(Date.now() + (++world.tick || 1)).toISOString() };
        world.settingsWrites = (world.settingsWrites || []).concat([body.value]);
        return res(200, [world.settings]);
      }
      if (u.search.includes("key=eq.reengage_batch")) return res(200, world.settings ? [world.settings] : []);
      return res(200, world.otherSettings || []);
    }
    if (u.pathname.startsWith("/rest/v1/leads")) {
      if ((options.method || "GET") === "PATCH") {
        const match = world.leads.find(l => u.search.includes(l.id) && u.search.includes(`version=eq.${l.version}`));
        if (!match) return res(200, []);
        Object.assign(match, body, { version: match.version + 1 });
        return res(200, [match]);
      }
      const one = world.leads.find(l => u.search.includes(l.id));
      if (u.search.includes("id=eq.")) return res(200, one ? [one] : []);
      if (u.search.includes("status=eq.")) {
        const status = decodeURIComponent((u.search.match(/status=eq\.([^&]+)/) || [])[1] || "");
        return res(200, world.leads.filter(l => l.status === status));
      }
      return res(200, world.leads);
    }
    return res(200, []);
  };
}

test("one lead, once ever: the claim is written first, the second call is refused, nothing posts twice (idempotency)", async () => {
  const world = { leads: [makeLead()], adPages: [] };
  const calls = [];
  stubFetch(world, calls);
  const P = load(true);
  const first = await P.sendReengageInvite({ lead: world.leads[0], by: "Test Runner" });
  assert.equal(first.status, "sent", JSON.stringify(first));
  assert.equal(first.text.status, "sent");
  assert.equal(first.text.to_last4, "0123");
  assert.equal(calls.filter(c => c.host === "hook.us2.make.com").length, 1);
  assert.ok(world.leads[0].raw_payload.pipeline.reengage, "the record is on the lead");
  // the hook payload carries the reengage words with the booking link
  const hook = calls.find(c => c.host === "hook.us2.make.com");
  assert.equal(hook.body.pathway, "reengage");
  assert.match(String(hook.body.message), /^Hi Sam, it's Lorenzo's Dog Training Team\. We spoke about training for Max\./);
  assert.match(String(hook.body.message), /book\?zip=32507/);
  // second call: refused, no new post, no new email
  const again = await P.sendReengageInvite({ lead: world.leads[0], by: "Test Runner" });
  assert.equal(again.status, "skipped");
  assert.match(again.reason, /never goes twice/);
  assert.equal(calls.filter(c => c.host === "hook.us2.make.com").length, 1, "still one Make post");
  // even a lead whose record says only "sending" (a lost claim) is done forever
  world.leads.push(makeLead({ id: "00000000-0000-4000-8000-000000000043", raw_payload: { pipeline: { reengage: { status: "sending" } } } }));
  const lost = await P.sendReengageInvite({ lead: world.leads[1] });
  assert.equal(lost.status, "skipped");
  assert.equal(calls.filter(c => c.host === "hook.us2.make.com").length, 1);
});

test("consent gating: no SMS consent = no text and no Make post, but the email twin still goes (rule 99, owner decision)", async () => {
  const world = { leads: [makeLead({ sms_consent: false })], otherSettings: [{ key: "pipeline_office_emails", value: { practice_email_to: "practice@example.test" } }] };
  const calls = [];
  stubFetch(world, calls);
  process.env.RESEND_API_KEY = "re_test_key";
  const P = load(true);
  const out = await P.sendReengageInvite({ lead: world.leads[0] });
  delete process.env.RESEND_API_KEY;
  assert.equal(calls.filter(c => c.host === "hook.us2.make.com").length, 0, "no Make post without consent");
  assert.equal(out.text.status, "skipped");
  assert.match(out.text.reason, /No SMS consent/);
  assert.equal(out.client_email.status, "sent", JSON.stringify(out.client_email));
  assert.equal(out.status, "sent", "email-only still counts as handled");
  // practice email redirect: the ONLY address Resend saw is the practice test inbox, never the lead's
  const to = (world.resendSends || []).flatMap(s => s.to || []);
  assert.deepEqual(to, ["practice@example.test"], "practice copy redirects every client email");
  assert.ok(String((world.resendSends || [])[0]?.text || "").includes("STOP"), "opt-out line rides along");
});

test("'sent' means the HOOK answered 200 (the Make tester filters may still drop it - the morning switch is a Make change)", async () => {
  const world = { leads: [makeLead()], hookStatus: 410 };
  const calls = [];
  stubFetch(world, calls);
  const P = load(true);
  const out = await P.sendReengageInvite({ lead: world.leads[0] });
  assert.equal(out.text.status, "failed", "a non-200 hook answer is never recorded as sent");
  assert.match(out.text.reason, /Make answered 410/);
});

test("kill switch: no key, or armed:false, or not yet send_at = the batch does nothing at all", async () => {
  const calls = [];
  const P = load(true);
  // no key
  let world = { leads: [makeLead()] };
  stubFetch(world, calls);
  let out = await P.runReengageBatch();
  assert.equal(out.armed, false);
  assert.match(out.message, /kill switch/);
  // armed:false (the shipped state: column preset, NOT armed - Joshua "we don't send yet")
  world = { leads: [makeLead()], settings: { key: "reengage_batch", value: { armed: false, column: "engaged_no_outcome", send_at: "" }, updated_at: "2026-09-23T09:00:00Z" } };
  stubFetch(world, calls);
  out = await P.runReengageBatch();
  assert.equal(out.armed, false);
  // armed but before send_at: waiting, nothing sent
  world = { leads: [makeLead()], settings: { key: "reengage_batch", value: { armed: true, column: "engaged_no_outcome", send_at: "2126-01-01T09:30:00-04:00" }, updated_at: "2026-09-23T09:00:00Z" } };
  stubFetch(world, calls);
  out = await P.runReengageBatch();
  assert.equal(out.waiting, true);
  assert.equal(calls.filter(c => c.host === "hook.us2.make.com").length, 0, "no send in any of the three states");
});

test("disarm-after-run: the runner disarms BEFORE the first send, walks the column once, holds test rows out, and writes the summary", async () => {
  const world = {
    leads: [
      makeLead(),
      makeLead({ id: "00000000-0000-4000-8000-000000000050", first_name: "Ada", email: "", sms_consent: false }), // no email, no consent -> skipped
      makeLead({ id: "00000000-0000-4000-8000-000000000051", raw_payload: { qa: true } }),                        // test row -> held out
      makeLead({ id: "00000000-0000-4000-8000-000000000052", status: "office_contacted" })                        // other column -> not walked
    ],
    settings: { key: "reengage_batch", value: { armed: true, column: "engaged_no_outcome", send_at: "2026-09-23T09:30:00-04:00" }, updated_at: "2026-09-23T09:00:00Z" },
    adPages: [{ slug: "pensacola", published_content: { zip: "32504" } }]
  };
  const calls = [];
  stubFetch(world, calls);
  const P = load(true);
  const out = await P.runReengageBatch({ nowMs: Date.parse("2026-09-23T13:31:00Z") + 3600000 * 24 });
  assert.equal(out.ran, true, JSON.stringify(out));
  // the disarm PATCH happened before any Make post
  const disarmIndex = calls.findIndex(c => c.method === "PATCH" && c.path.startsWith("/rest/v1/site_settings") && c.body?.value?.armed === false);
  const firstHook = calls.findIndex(c => c.host === "hook.us2.make.com");
  assert.ok(disarmIndex > -1 && firstHook > -1 && disarmIndex < firstHook, "disarmed before the first send");
  // walked only the chosen column, test row held out
  assert.equal(out.walked, 3, "engaged_no_outcome holds 3 rows (incl. the qa row)");
  assert.equal(calls.filter(c => c.host === "hook.us2.make.com").length, 1, "one text: Sam (consented tester)");
  assert.ok(out.skipped >= 1);
  // the ad 2.0 page within 50 miles is the link, ZIP prefilled
  const hook = calls.find(c => c.host === "hook.us2.make.com");
  assert.match(String(hook.body.booking_link), /\/ads\/pensacola\?zip=32507$/);
  // the summary landed in the key and it stays disarmed
  const final = world.settings.value;
  assert.equal(final.armed, false);
  assert.equal(final.last_run.column, "engaged_no_outcome");
  assert.equal(final.last_run.walked, 3);
  // a second run does nothing (disarmed), and re-arming could never double-text (per-lead record)
  const again = await P.runReengageBatch({ nowMs: Date.parse("2026-09-23T13:40:00Z") });
  assert.equal(again.armed, false);
  assert.equal(calls.filter(c => c.host === "hook.us2.make.com").length, 1);
});

test("the live link falls back to /book?zip= when no ad 2.0 page is near; the ad2 lookup only reads published pages", async () => {
  const world = { leads: [makeLead({ zip: "99801" })], adPages: [{ slug: "pensacola", published_content: { zip: "32504" } }] }; // Juneau, AK: nothing near
  const calls = [];
  stubFetch(world, calls);
  const P = load(true);
  const link = await P.reengageBookingLink(world.leads[0]);
  assert.equal(link.kind, "book");
  assert.match(link.url, /\/book\?zip=99801$/);
  const q = calls.find(c => c.path.startsWith("/rest/v1/ad_pages"));
  assert.ok(q && q.query.includes("page_type=eq.ad2") && q.query.includes("status=eq.published"), "published ad2 pages only");
});

test("wiring pins: the cron checks the batch, the office door is Super Admin only, and arming needs a column + time", () => {
  const cron = read("api/cron/auto-followups.js");
  assert.match(cron, /P\.runReengageBatch\(\)/, "the existing cadence checks the key");
  const api = read("api/pipeline.js");
  assert.match(api, /if \(op === "reengage_send"\) \{\n[\s\S]{0,400}?require: "super"/, "reengage_send: Super Admin only");
  assert.match(api, /if \(op === "reengage_batch_save"\) \{\n[\s\S]{0,500}?require: "super"/, "arming: Super Admin only");
  assert.match(api, /To arm the batch it needs a status column and a send_at time\./);
  const lib = read("lib/pipeline.js");
  assert.match(lib, /const REENGAGE_KEY = "reengage_batch";/);
  assert.match(lib, /DISARM FIRST/, "the claim-is-the-kill-switch note stays");
  // "sent" only on a 200 from the hook (the tester lock drops texts AFTER the webhook accepts)
  assert.match(lib, /"sent" ONLY on a 200 from the hook/);
});
