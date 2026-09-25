// "Office's turn" (Zoom 2026-09-24, Lorenzo: "after the 24 hours ... the office needs to be notified that the time is
// up. So this has been bot touched three times and now it's time for the office.") An orange badge on the office board
// and lead panel (metrics.js officeTurn, rule 34), plus ONE optional daily email (switch office_turn_digest, OFF) -
// Rachel asked for FEWER emails, so there is no per-lead email. Run: node --test tests/  (no real project touched)
import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "test-key";
process.env.SUPABASE_URL = process.env.SUPABASE_URL || "http://supabase.test";
const M = require("../trainer-backoffice/metrics.js");
const read = path => readFileSync(resolve(import.meta.dirname, "..", path), "utf8");
const NOW = Date.parse("2026-09-25T15:00:00Z"); // 11 AM Eastern
const hoursAgo = h => new Date(NOW - h * 3600000).toISOString();
const row = (db, pipeline = {}, extra = {}) => ({ id: randomUUID(), dbStatus: db, status: db, first_name: "Pat", last_name: "Lee", phone: "2165550199", created_at: hoursAgo(30), raw_payload: { pipeline: { entered_at: hoursAgo(30), ...pipeline }, ...(extra.raw || {}) }, ...extra });

test("the rule: a pipeline lead, not booked, still New / Contacted / Engaged, after the chain is done or 24 h after it came in", () => {
  assert.deepEqual(M.officeTurn(row("new_inquiry"), NOW), { since: hoursAgo(6), why: "24h" });
  const chain = row("office_contacted", { entered_at: hoursAgo(20), followups: [{ step: "tim", status: "sent", at: hoursAgo(19.75) }, { step: "link", status: "sent", at: hoursAgo(19.5) }, { step: "care", status: "sent", at: hoursAgo(1) }] });
  assert.deepEqual(M.officeTurn(chain, NOW), { since: hoursAgo(1), why: "chain_done" }, "the chain finished (any recorded care step)");
  const inFlight = row("new_inquiry", { entered_at: hoursAgo(20), followups: [{ step: "care", status: "sending", at: hoursAgo(0.1) }] });
  assert.equal(M.officeTurn(inFlight, NOW), null, "a care step still being sent is not the end of the chain");
  assert.equal(M.officeTurn(row("new_inquiry", { entered_at: hoursAgo(23) }), NOW), null, "under 24 h: still the bot's turn");
  assert.ok(M.officeTurn(row("engaged_no_outcome"), NOW));
  assert.ok(M.officeTurn(row("follow_up_call_needed"), NOW));
  for (const db of ["evaluation_scheduled", "evaluation_complete", "became_client", "archived", "do_not_contact", "lost_no_trainer_area", "lost_price_concern", "bad_lead"]) {
    assert.equal(M.officeTurn(row(db), NOW), null, db);
  }
  for (const booking of [{ slot_start: "x" }, { requested_at: "x" }, { callback: { zip: "44128" } }]) {
    assert.equal(M.officeTurn(row("new_inquiry", {}, { raw: { booking } }), NOW), null, JSON.stringify(booking));
  }
  assert.equal(M.officeTurn({ dbStatus: "new_inquiry", raw_payload: {} }, NOW), null, "not a pipeline lead (no entered_at): never");
  assert.equal(M.officeTurn(row("new_inquiry", {}, { raw: { qa: true } }), NOW), null, "a test row never");
  assert.equal(M.officeTurn({ status: "Office Contacted", rawPayload: { pipeline: { entered_at: hoursAgo(25) } } }, NOW).why, "24h", "a portal row (screen words) works too");
  assert.equal(M.officeTurnRows([row("new_inquiry"), row("evaluation_scheduled")], NOW).length, 1);
});

test("portal: an orange 'Office's turn' badge on office Leads + Sales cards and the office lead panel; never for a trainer", () => {
  const app = read("trainer-backoffice/app.js");
  const fn = name => app.match(new RegExp(`function ${name}\\(.*\\) \\{\\n[\\s\\S]*?\\n\\}\\n`))[0];
  const escapeHtml = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const lead = { status: "New Inquiry", rawPayload: { pipeline: { entered_at: new Date(Date.now() - 30 * 3600000).toISOString() } } };
  const ctx = { METRICS: M, session: { role: "admin" }, escapeHtml, formatDateTime: () => "Sep 25, 9:00 AM", lead };
  vm.runInNewContext(`${fn("officeTurnInfo")}\n${fn("officeTurnTag")}\n${fn("officeTurnLine")}\nthis.tag = officeTurnTag(lead); this.line = officeTurnLine(lead); session.role = "trainer"; this.trainer = officeTurnTag(lead);`, ctx);
  assert.match(ctx.tag, /<span class="lead-tag-office-turn" title="Office's turn since Sep 25, 9:00 AM\. A day has passed since they came in and they have not booked\. Call them\.">Office's turn<\/span>/);
  assert.match(ctx.line, /Office's turn since Sep 25, 9:00 AM\./);
  assert.equal(ctx.trainer, "", "trainers never see it");
  assert.match(app, /\$\{recycledTag\(lead\)\}\$\{officeTurnTag\(lead\)\}`;\n  return `\$\{leadCardEvalLine\(lead\)\}/, "office Leads card");
  assert.match(app, /\$\{recycledTag\(lead\)\}\$\{officeTurnTag\(lead\)\}<\/small>/, "Sales card");
  assert.match(app, /\$\{officeTurnTag\(lead\)\}<\/h2>\$\{officeTurnLine\(lead\)\}/, "office lead panel");
  assert.match(read("trainer-backoffice/styles.css"), /\.lead-tag-office-turn \{[^}]*border: 1\.5px solid #ea580c/, "orange");
});

// ---- The daily digest ---------------------------------------------------------------------------------------
function load(sandbox) {
  for (const m of ["../lib/sandbox.js", "../lib/booking.js", "../lib/office-email.js", "../lib/pipeline.js"]) delete require.cache[require.resolve(m)];
  if (sandbox) process.env.LDTT_SANDBOX = "1"; else delete process.env.LDTT_SANDBOX;
  return require("../lib/pipeline.js");
}
function stub(world, calls) {
  global.fetch = async (url, options = {}) => {
    const u = new URL(String(url));
    let body = options.body;
    if (typeof body === "string") { try { body = JSON.parse(body); } catch { /* text */ } }
    const method = options.method || "GET";
    calls.push({ host: u.host, path: u.pathname, method, body, query: decodeURIComponent(u.search) });
    const res = (status, data) => ({ ok: status < 400, status, text: async () => JSON.stringify(data), json: async () => data, headers: new Headers() });
    if (u.host === "api.resend.com") { world.sent.push(body); return res(200, { id: `re_${world.sent.length}` }); }
    if (u.pathname.startsWith("/rest/v1/site_settings")) {
      if (u.search.includes("pipeline_office_emails")) return res(200, [{ key: "pipeline_office_emails", value: world.settings }]);
      if (u.search.includes("office_turn_digest_log") || (method === "POST" && body?.key === "office_turn_digest_log")) {
        if (method === "GET") return res(200, world.log ? [world.log] : []);
        if (method === "POST") { if (world.log) return res(409, { message: "duplicate" }); world.log = { key: body.key, value: body.value, updated_at: "t1" }; return res(201, [world.log]); }
        if (method === "PATCH") {
          if (u.search.includes("updated_at=eq.") && !u.search.includes(`updated_at=eq.${world.log?.updated_at}`)) return res(200, []);
          world.log = { ...world.log, value: body.value, updated_at: `t${Math.random()}` };
          return res(200, [world.log]);
        }
      }
      return res(200, []);
    }
    if (u.pathname.startsWith("/rest/v1/leads")) return res(200, world.leads);
    return res(200, []);
  };
}
const settings = { office_turn_digest: true, recipients: [{ label: "Rachel", email: "rachel@example.test" }, { label: "Missy", email: "missy@example.test" }], practice_email_to: "practice@example.test" };

test("digest OFF (default): nothing read, nothing sent", async () => {
  const world = { settings: { recipients: settings.recipients }, leads: [row("new_inquiry")], sent: [] };
  const calls = [];
  stub(world, calls);
  const P = load(false);
  const out = await P.runOfficeTurnDigest({ nowMs: NOW });
  assert.equal(out.on, false);
  assert.equal(calls.filter(c => c.path.startsWith("/rest/v1/leads") || c.host === "api.resend.com").length, 0);
  assert.equal(P.defaultSettings().office_turn_digest, false);
});

test("digest ON: ONE email a day after 9 AM Eastern, to the office team list only, listing the office's-turn leads; never twice", async () => {
  process.env.RESEND_API_KEY = "re_test_key";
  const due = row("new_inquiry");
  const booked = row("new_inquiry", {}, { raw: { booking: { slot_start: "x" } } });
  const world = { settings, leads: [due, booked, row("office_contacted", { entered_at: hoursAgo(2) })], sent: [] };
  const calls = [];
  stub(world, calls);
  const P = load(false);
  const early = await P.runOfficeTurnDigest({ nowMs: Date.parse("2026-09-25T12:30:00Z") }); // 8:30 AM Eastern
  assert.equal(early.waiting, true);
  const [a, b] = await Promise.all([P.runOfficeTurnDigest({ nowMs: NOW }), P.runOfficeTurnDigest({ nowMs: NOW })]);
  assert.equal(world.sent.length, 1, `one email: ${JSON.stringify([a, b])}`);
  const mail = world.sent[0];
  assert.deepEqual(mail.to, ["rachel@example.test", "missy@example.test"], "the office team list; never Production, never a client");
  assert.equal(mail.subject, "Office's turn: 1 lead to call (2026-09-25)");
  assert.match(mail.text, /- Pat Lee, \(216\) 555-0199, New Inquiry, office's turn since /);
  assert.match(mail.text, /\/staff\?view=leads&lead=/);
  const again = await P.runOfficeTurnDigest({ nowMs: NOW + 3600000 });
  assert.equal(again.already, true);
  assert.equal(world.sent.length, 1, "the same day never sends again");
  assert.equal(world.log.value.last_date, "2026-09-25");
  assert.equal(world.log.value.leads, 1);
  const resendCall = calls.find(c => c.host === "api.resend.com");
  assert.ok(resendCall);
  delete process.env.RESEND_API_KEY;
});

test("digest: an empty list sends nothing; the practice copy sends only to the practice inbox", async () => {
  process.env.RESEND_API_KEY = "re_test_key";
  const none = { settings, leads: [row("evaluation_scheduled")], sent: [] };
  stub(none, []);
  let P = load(false);
  const out = await P.runOfficeTurnDigest({ nowMs: NOW });
  assert.equal(out.email.status, "skipped");
  assert.equal(none.sent.length, 0);
  const practice = { settings, leads: [row("new_inquiry")], sent: [] };
  stub(practice, []);
  P = load(true);
  await P.runOfficeTurnDigest({ nowMs: NOW });
  assert.deepEqual(practice.sent[0].to, ["practice@example.test"]);
  assert.match(practice.sent[0].subject, /^\[PRACTICE COPY\] Office's turn:/);
  delete process.env.RESEND_API_KEY;
  const cron = read("api/cron/auto-followups.js");
  assert.match(cron, /const officeTurn = await P\.runOfficeTurnDigest\(\)\n\s*\.catch\(/);
  assert.match(read("trainer-backoffice/app.js"), /data-pipeline-office-turn-digest \$\{s\.office_turn_digest \? "checked" : ""\}/);
});
