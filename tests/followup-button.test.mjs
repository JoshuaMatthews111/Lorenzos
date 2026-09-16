// Joshua 2026-09-16: the "Has not booked yet" follow-up texts are an OFFICE BUTTON on the lead's detailed view
// (Sales Pipeline), not a timer. Practice copy, office admins, active tester phones only (rules 72/73).
// Run: node --test tests/   Nothing here talks to the real project (global fetch is replaced).
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "test-key";
process.env.SUPABASE_URL = process.env.SUPABASE_URL || "http://supabase.test";
process.env.LDTT_MAKE_HOOK_PATHWAY1 = "https://hook.us2.make.com/abc123followup";
const read = path => readFileSync(resolve(import.meta.dirname, "..", path), "utf8");

const TESTER = "+14405550123";
const lead = {
  id: "00000000-0000-4000-8000-000000000042", first_name: "Sam", last_name: "Tester", phone: "(440) 555-0123", sms_consent: true,
  raw_payload: { pipeline: { book_url: "https://ldtt-sandbox.vercel.app/book/fred-harris?lead=00000000-0000-4000-8000-000000000042" } }
};

function load(sandbox) {
  for (const m of ["../lib/sandbox.js", "../lib/booking.js", "../lib/pipeline.js"]) delete require.cache[require.resolve(m)];
  if (sandbox) process.env.LDTT_SANDBOX = "1"; else delete process.env.LDTT_SANDBOX;
  return require("../lib/pipeline.js");
}

function stubFetch(calls) {
  global.fetch = async (url, options = {}) => {
    const u = new URL(String(url));
    let body = options.body;
    if (typeof body === "string") { try { body = JSON.parse(body); } catch { /* keep text */ } }
    calls.push({ host: u.host, path: u.pathname, body });
    const res = (status, data, text) => ({ ok: status < 400, status, text: async () => text ?? JSON.stringify(data), json: async () => data });
    if (u.host === "hook.us2.make.com") return res(200, null, "Accepted");
    if (u.pathname.startsWith("/rest/v1/communications_testers")) return res(200, [{ phone: TESTER }]);
    if (u.pathname.startsWith("/rest/v1/site_settings")) return res(200, []); // no saved words: the starting words go
    return res(200, []);
  };
}

test("office button: Tim's follow-up posts to pathway 1 as a follow-up with the rendered words", async () => {
  const calls = [];
  stubFetch(calls);
  const P = load(true);
  const out = await P.sendFollowUpText({ lead, step: "tim" });
  assert.equal(out.status, "sent", JSON.stringify(out));
  assert.equal(out.pathway, 1);
  assert.equal(out.to_last4, "0123");
  const hook = calls.find(c => c.host === "hook.us2.make.com");
  assert.ok(hook, "posted to Make");
  assert.equal(hook.path, "/abc123followup");
  assert.equal(hook.body.pathway, "followup");
  assert.equal(hook.body.followup_key, "tim");
  assert.equal(hook.body.phone, TESTER);
  assert.equal(hook.body.customer_phone, TESTER);
  assert.equal(hook.body.practice, true);
  assert.ok(String(hook.body.message).startsWith("Hi Sam, this is Tim"), hook.body.message);

  const link = await P.sendFollowUpText({ lead, step: "link" });
  assert.equal(link.status, "sent", JSON.stringify(link));
  const hook2 = calls.filter(c => c.host === "hook.us2.make.com").at(-1);
  assert.equal(hook2.body.followup_key, "link");
  assert.match(String(hook2.body.message), /book\/fred-harris\?lead=/);
});

test("office button: not a tester phone, no consent, or a live copy = skipped, nothing posted", async () => {
  const calls = [];
  stubFetch(calls);
  const P = load(true);
  const stranger = await P.sendFollowUpText({ lead: { ...lead, phone: "(216) 555-9999" }, step: "tim" });
  assert.equal(stranger.status, "skipped");
  assert.match(stranger.reason, /not an active tester phone/);
  const noConsent = await P.sendFollowUpText({ lead: { ...lead, sms_consent: false }, step: "tim" });
  assert.equal(noConsent.status, "skipped");
  assert.equal(calls.filter(c => c.host === "hook.us2.make.com").length, 0, "no Make post");

  const live = load(false);
  const before = calls.length;
  const off = await live.sendFollowUpText({ lead, step: "tim" });
  assert.equal(off.status, "skipped");
  assert.match(off.reason, /practice copy only/);
  assert.equal(calls.length, before, "off the practice copy nothing is fetched at all");
});

test("the office lead panel draws the buttons, gated to office admins on the practice copy; trainer screens never do", () => {
  const app = read("trainer-backoffice/app.js");
  assert.match(app, /data-lead-followup-text="tim"/);
  assert.match(app, /data-lead-followup-text="link"/);
  const fn = app.slice(app.indexOf("function leadFollowUpTextBlock("), app.indexOf("async function sendLeadFollowUpTextNow("));
  assert.match(fn, /if \(!window\.LDTT_IS_SANDBOX \|\| session\.role !== "admin"\) return "";/);
  assert.match(fn, /lead\.smsConsent === "Yes" \|\| lead\.smsConsent === true/);
  assert.match(fn, /!lead\?\.phone/);
  assert.match(fn, /Send Tim's follow-up text/);
  assert.match(fn, /Send the booking link again/);
  // Drawn only from the office lead panel's booking block (leadBookingBlock), never from a trainer screen.
  const drawnAt = [...app.matchAll(/leadFollowUpTextBlock\(/g)].length;
  assert.equal(drawnAt, 2, "one definition, one call site");
  const bookingStart = app.indexOf("function leadBookingBlock(");
  const bookingBlock = app.slice(bookingStart, app.indexOf("\nfunction ", bookingStart + 10));
  assert.ok(bookingBlock.includes("leadFollowUpTextBlock(lead, Boolean(link))"), "called from the office Online booking block");
  // leadBookingBlock itself is drawn once, by the office lead panel (leadDetailPanel), so no trainer screen reaches it.
  const bookingCalls = [...app.matchAll(/\$\{leadBookingBlock\(lead\)\}/g)].length;
  assert.equal(bookingCalls, 1, "the booking block is drawn from one place");
  const panelStart = app.indexOf("function leadDetailPanel()");
  const panelEnd = app.indexOf("\nfunction ", panelStart + 10);
  assert.ok(app.slice(panelStart, panelEnd).includes("${leadBookingBlock(lead)}"), "that place is the office lead panel");
  // The click handler posts the op with the bearer token and gates again.
  assert.match(app, /op: "followup_send", lead_id: leadId, step/);
  assert.match(app, /closest\("\[data-lead-followup-text\]"\)/);
  // The API op is office-admin only and records through afterFollowUp.
  const api = read("api/pipeline.js");
  const block = api.slice(api.indexOf('if (op === "followup_send")'), api.indexOf('return res.status(400).json({ ok: false, message: "Unknown request." });', api.indexOf('if (op === "followup_send")')));
  assert.match(block, /authorizeRequest\(req, res, \{ require: "admin"/);
  assert.match(block, /P\.afterFollowUp\(\{ lead, step, by: access\.actor\?\.email \}\)/);
  // The timer stays off.
  assert.match(read("lib/reengage.js"), /const SENDING_ENABLED = false;/);
});
