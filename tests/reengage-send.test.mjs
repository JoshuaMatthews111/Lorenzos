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
        // created_at=gte.<iso> behaves like PostgREST: a lead with no created_at is treated as new.
        const oldest = decodeURIComponent((u.search.match(/created_at=gte\.([^&]+)/) || [])[1] || "");
        return res(200, world.leads.filter(l => l.status === status && (!oldest || !l.created_at || l.created_at >= oldest)));
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
  assert.match(String(hook.body.message), /^Hi Sam, it's Lorenzo's Dog Training Team\. You reached out about training for your dog and we'd still love to help\./);
  assert.ok(!/\{dog_name\}|training for Max/.test(String(hook.body.message)), "the words never name the dog (2026-09-24 rewrite)");
  assert.match(String(hook.body.message), /Reply STOP to opt out\.$/, "the opt-out line goes with the text");
  // 2026-09-26 (rule 121): with no 2.0 row in this stub, the nearest of the new 2.0 city pages (Navarre, ~30 miles
  // from 32507) is the link; before that page existed this was /book?zip=32507.
  assert.match(String(hook.body.message), /\/dog-training-navarre-fl\?zip=32507/);
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
      makeLead({ id: "00000000-0000-4000-8000-000000000052", status: "office_contacted" }),                       // other column -> not walked
      makeLead({ id: "00000000-0000-4000-8000-000000000053", created_at: "2026-06-01T00:00:00Z" })                // 100+ days old -> outside the 60-day window (Joshua 2026-09-23)
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
  // walked only the chosen column, test row held out, the 100-day-old lead outside the 60-day window
  assert.equal(out.walked, 3, "engaged_no_outcome holds 3 recent rows (incl. the qa row); the old lead is excluded");
  const leadsQuery = calls.find(c => c.path === "/rest/v1/leads" && c.query.includes("status=eq."));
  assert.ok(/created_at=gte\./.test(leadsQuery.query), "the walk carries the 60-day window (Joshua 2026-09-23)");
  assert.equal(calls.filter(c => c.host === "hook.us2.make.com").length, 1, "one text: Sam (consented tester)");
  assert.ok(out.skipped >= 1);
  // Joshua 2026-09-23: the LIVE ad page for that area (the Facebook ones), never the unfinished 2.0
  // page. The 2.0 row only names the nearest area; the link is the static page, ZIP prefilled.
  const hook = calls.find(c => c.host === "hook.us2.make.com");
  assert.match(String(hook.body.booking_link), /\/dog-training-pensacola-fl\?zip=32507&utm_source=text&utm_campaign=reengage$/);
  assert.ok(!/\/ads\//.test(String(hook.body.booking_link)), "a 2.0 page is never sent to a client");
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

// ---------------------------------------------------------------------------
// 2026-09-24, the four fixes Joshua asked for before the blast, plus the walk over BOTH columns.
// Everything here runs against the stubbed fetch above: no hook, no Resend, no Supabase is ever touched.
// ---------------------------------------------------------------------------

test("fix 2 - the name tidy: ALL CAPS is calmed down, an unusable greeting is dropped for \"Hi there,\", and a normal name is left exactly alone", () => {
  const P = load(true);
  const g = P.clientGreetingName;
  // shouting -> proper case (the live "TIMOTHY" row)
  assert.equal(g("TIMOTHY"), "Timothy");
  assert.equal(g("MARY ANN"), "Mary Ann");
  assert.equal(g("O'BRIEN"), "O'Brien");
  // not a usable greeting -> the name is dropped, never guessed at
  for (const bad of ["Larry or Laura", "LARRY OR LAURA", "Bob and Sue", "Larry/Laura", "Bob & Sue", "Client 2", "", "   ", null, undefined]) {
    assert.equal(g(bad), "there", `"${bad}" is not a greeting`);
  }
  // a name typed all in lower case gets its first letter back (live: cherie / jana / ken / rosie)
  assert.equal(g("cherie"), "Cherie");
  assert.equal(g("ken"), "Ken");
  // a normal name is untouched - including mixed case the office typed on purpose
  assert.equal(g("Timothy"), "Timothy");
  assert.equal(g("McDonald"), "McDonald");
  assert.equal(g("Shianne sipes"), "Shianne sipes", "only the FIRST letter is ever added back");
  assert.equal(g("Jose Luis"), "Jose Luis");
  // and it reads as a greeting in the finished words
  assert.match(X_render(P, "TIMOTHY"), /^Hi Timothy, it's Lorenzo's/);
  assert.match(X_render(P, "Larry or Laura"), /^Hi there, it's Lorenzo's/);
});

function X_render(P, firstName) {
  const T = require("../lib/pipeline-texts.js");
  return T.render(T.wordsFor(null, "reengage_invite"), { first_name: P.clientGreetingName(firstName), booking_link: "https://x/book" });
}

test("fix 2 end to end - the ALL CAPS lead is texted \"Hi Timothy\", and a \"Larry or Laura\" lead is texted \"Hi there\"", async () => {
  for (const [stored, expected] of [["TIMOTHY", "Hi Timothy,"], ["Larry or Laura", "Hi there,"]]) {
    const world = { leads: [makeLead({ first_name: stored })], adPages: [] };
    const calls = [];
    stubFetch(world, calls);
    const P = load(true);
    await P.sendReengageInvite({ lead: world.leads[0] });
    const hook = calls.find(c => c.host === "hook.us2.make.com");
    assert.ok(String(hook.body.message).startsWith(expected), `"${stored}" -> ${expected} (got: ${String(hook.body.message).slice(0, 40)})`);
    assert.ok(!String(hook.body.message).includes(stored) || stored === "TIMOTHY", "the raw stored name never reaches the client");
  }
});

test("fix 3 - a lead with NO ZIP goes to the live Contact Us page, never a bare /book; a lead WITH a ZIP is unaffected", async () => {
  const world = { leads: [makeLead({ zip: "" })], adPages: [] };
  const calls = [];
  stubFetch(world, calls);
  const P = load(true);
  // the blast asks for the Contact Us fallback
  const blast = await P.reengageBookingLink(world.leads[0], { noZip: "contact" });
  assert.equal(blast.kind, "contact");
  assert.match(blast.url, /\/contact$/);
  assert.ok(!/\/book/.test(blast.url), "no bare /book for someone we cannot place");
  // the unfinished-form timer keeps the original /book fallback (it is a different message: finish the form)
  const timer = await P.reengageBookingLink(world.leads[0]);
  assert.equal(timer.kind, "book");
  assert.match(timer.url, /\/book$/);
  // and the send really uses the Contact Us link
  await P.sendReengageInvite({ lead: world.leads[0] });
  const hook = calls.find(c => c.host === "hook.us2.make.com");
  assert.match(String(hook.body.booking_link), /\/contact\?utm_source=text&utm_campaign=reengage$/);
  assert.match(String(hook.body.message), /\/contact\?utm_source=text&utm_campaign=reengage\. Or call us/);
  assert.equal(world.leads[0].raw_payload.pipeline.reengage.link_kind, "contact", "the record says where they were sent");
});

test("fix 4 - dedupe by person across the WHOLE batch: the same email (or the same phone) in two rows gets ONE message, and the passed-over row is left untouched", async () => {
  const world = {
    leads: [
      makeLead({ id: "00000000-0000-4000-8000-000000000060", first_name: "Steven", email: "steven@example.test", phone: "(440) 555-0123", status: "office_contacted" }),
      makeLead({ id: "00000000-0000-4000-8000-000000000061", first_name: "Steven", email: "STEVEN@example.test", phone: "(216) 555-9999", status: "engaged_no_outcome" }), // same person, other column
      makeLead({ id: "00000000-0000-4000-8000-000000000062", first_name: "Dee", email: "", phone: "(440) 555-0123", status: "engaged_no_outcome" }),                      // same PHONE as the first
      makeLead({ id: "00000000-0000-4000-8000-000000000063", first_name: "Unique", email: "unique@example.test", phone: "(330) 555-7777", status: "office_contacted" })
    ],
    settings: { key: "reengage_batch", value: { armed: true, columns: ["office_contacted", "engaged_no_outcome"], send_at: "2026-09-24T11:00:00Z" }, updated_at: "2026-09-24T04:00:00Z" },
    adPages: []
  };
  const calls = [];
  stubFetch(world, calls);
  const P = load(true);
  const out = await P.runReengageBatch({ nowMs: Date.parse("2026-09-24T11:00:00Z") });
  assert.equal(out.ran, true, JSON.stringify(out));
  assert.equal(out.walked, 4, "all four rows were walked");
  assert.equal(out.deduped, 2, "the email twin and the phone twin were both passed over");
  // the two passed-over rows were never claimed: nothing at all was written to them
  assert.equal(world.leads[1].raw_payload.pipeline, undefined, "the email twin keeps a clean record");
  assert.equal(world.leads[2].raw_payload.pipeline, undefined, "the phone twin keeps a clean record");
  // the two people who should hear from us did
  assert.ok(world.leads[0].raw_payload.pipeline.reengage, "Steven was sent to once");
  assert.ok(world.leads[3].raw_payload.pipeline.reengage, "Unique was sent to");

  // and the row we KEEP is the richest one, not merely the first one walked (the live Steven pair: the
  // emptier row was created first, so walking order alone would have thrown away the textable one)
  const thin = makeLead({ id: "00000000-0000-4000-8000-000000000064", first_name: "Steven", email: "s@example.test", phone: "", zip: "", sms_consent: false, status: "office_contacted" });
  const full = makeLead({ id: "00000000-0000-4000-8000-000000000065", first_name: "Steven", email: "s@example.test", phone: "(440) 555-0123", zip: "32507", sms_consent: true, status: "office_contacted" });
  const picked = load(true).dedupeByPerson([thin, full]); // thin walked FIRST
  assert.ok(picked.keep.has(full.id), "the row with consent, a phone and a ZIP is the one that is kept");
  assert.ok(!picked.keep.has(thin.id));
  assert.equal(picked.passed.get(thin.id), "email");
  const reasons = out.details.filter(d => /deduped by/.test(d.reason || "")).map(d => d.reason);
  assert.equal(reasons.length, 2);
  assert.ok(reasons.some(r => /email/.test(r)) && reasons.some(r => /phone/.test(r)), "both routes named honestly");
});

test("both columns in one armed run, and a single `column` string still means exactly what it always meant", async () => {
  // the list form
  const n = load(true).normalizeReengageBatch({ armed: true, columns: ["office_contacted", "engaged_no_outcome"], send_at: "2026-09-24T11:00:00Z" });
  assert.deepEqual(n.columns, ["office_contacted", "engaged_no_outcome"]);
  assert.equal(n.column, "office_contacted", "`column` stays a string for every older reader");
  assert.equal(n.max_age_days, 60, "the 60-day window survives");
  // backward compatibility: the shape sitting on live today
  const old = load(true).normalizeReengageBatch({ armed: false, column: "engaged_no_outcome", send_at: "" });
  assert.deepEqual(old.columns, ["engaged_no_outcome"]);
  assert.equal(old.column, "engaged_no_outcome");
  // duplicates and junk are dropped, order kept
  const messy = load(true).normalizeReengageBatch({ columns: ["office_contacted", "OFFICE_CONTACTED", "", "bad-!!"], column: "office_contacted" });
  assert.deepEqual(messy.columns, ["office_contacted", "bad"]);

  // and the runner really walks both, one query per column, each carrying the 60-day window
  const world = {
    leads: [
      makeLead({ id: "00000000-0000-4000-8000-000000000070", email: "a@example.test", status: "office_contacted" }),
      makeLead({ id: "00000000-0000-4000-8000-000000000071", email: "b@example.test", status: "engaged_no_outcome" })
    ],
    settings: { key: "reengage_batch", value: { armed: true, columns: ["office_contacted", "engaged_no_outcome"], send_at: "2026-09-24T11:00:00Z", note: "keep me" }, updated_at: "2026-09-24T04:00:00Z" },
    adPages: []
  };
  const calls = [];
  stubFetch(world, calls);
  const P = load(true);
  const out = await P.runReengageBatch({ nowMs: Date.parse("2026-09-24T11:00:00Z") });
  assert.equal(out.walked, 2, "one lead from each column");
  assert.deepEqual(out.per_column, { office_contacted: 1, engaged_no_outcome: 1 });
  const walks = calls.filter(c => c.path === "/rest/v1/leads" && c.query.includes("status=eq."));
  assert.equal(walks.length, 2, "one walk per column");
  assert.ok(walks.every(w => /created_at=gte\./.test(w.query)), "every column carries the 60-day window");
  // the summary keeps what the key was carrying instead of quietly dropping it
  assert.equal(world.settings.value.note, "keep me", "the office's own note survives the run");
  assert.equal(world.settings.value.armed, false, "still disarmed afterwards");
  assert.deepEqual(world.settings.value.last_run.columns, ["office_contacted", "engaged_no_outcome"]);
});

test("THE TIMING GUARD: one minute before 7:00 AM Eastern it reports waiting and sends NOTHING; at 7:00 exactly it proceeds", async () => {
  const SEND_AT = "2026-09-24T11:00:00Z"; // 7:00 AM Eastern, 24 September 2026
  const settings = () => ({ key: "reengage_batch", value: { armed: true, columns: ["office_contacted"], send_at: SEND_AT }, updated_at: "2026-09-24T04:00:00Z" });

  // 06:59:00 Eastern = 10:59:00Z
  let world = { leads: [makeLead({ status: "office_contacted" })], settings: settings(), adPages: [] };
  let calls = [];
  stubFetch(world, calls);
  let P = load(true);
  let out = await P.runReengageBatch({ nowMs: Date.parse("2026-09-24T10:59:00Z") });
  assert.equal(out.waiting, true, "it is waiting");
  assert.equal(out.ran, undefined, "it did not run");
  assert.equal(calls.filter(c => c.host === "hook.us2.make.com").length, 0, "NOTHING was posted to Make");
  assert.equal(calls.filter(c => c.host === "api.resend.com").length, 0, "NOTHING was sent by email");
  assert.equal(world.settings.value.armed, true, "still armed, still waiting");
  assert.equal(world.leads[0].raw_payload.pipeline, undefined, "no lead was even claimed");
  // one second before the minute turns, still nothing
  out = await P.runReengageBatch({ nowMs: Date.parse(SEND_AT) - 1000 });
  assert.equal(out.waiting, true, "one second early is still early");
  assert.equal(calls.filter(c => c.host === "hook.us2.make.com").length, 0);

  // 07:00:00 Eastern = 11:00:00Z - the same key, the same lead, now it goes
  world = { leads: [makeLead({ status: "office_contacted" })], settings: settings(), adPages: [] };
  calls = [];
  stubFetch(world, calls);
  P = load(true);
  out = await P.runReengageBatch({ nowMs: Date.parse(SEND_AT) });
  assert.equal(out.ran, true, "at 7:00 exactly it proceeds");
  assert.equal(out.walked, 1);
  assert.equal(calls.filter(c => c.host === "hook.us2.make.com").length, 1, "and only then does anything leave");
});

test("only these people (Joshua 2026-09-29): an only_leads list sends to those leads and never touches anyone else in the column", async () => {
  const A = "00000000-0000-4000-8000-000000000071"; // listed, consented tester phone -> text + email
  const B = "00000000-0000-4000-8000-000000000072"; // listed, no texting permission -> email only
  const C = "00000000-0000-4000-8000-000000000073"; // NOT listed -> untouched
  const world = {
    leads: [
      makeLead({ id: A, status: "office_contacted" }),
      makeLead({ id: B, status: "office_contacted", first_name: "Bea", email: "bea@example.test", phone: "(330) 555-0188", sms_consent: false }),
      makeLead({ id: C, status: "office_contacted", first_name: "Cy", email: "cy@example.test", phone: "(216) 555-0199" })
    ],
    settings: { key: "reengage_batch", value: { armed: true, columns: ["office_contacted", "engaged_no_outcome"], only_leads: [A, B.toUpperCase(), "not-an-id"], send_at: "2026-09-29T08:30:00-04:00" }, updated_at: "2026-09-29T07:00:00Z" },
    adPages: [{ slug: "pensacola", published_content: { zip: "32504" } }]
  };
  const calls = [];
  stubFetch(world, calls);
  const P = load(true);
  const early = await P.runReengageBatch({ nowMs: Date.parse("2026-09-29T12:15:00Z") });
  assert.equal(early.waiting, true, "8:15 AM: still waiting for 8:30");
  const out = await P.runReengageBatch({ nowMs: Date.parse("2026-09-29T12:31:00Z") });
  assert.equal(out.ran, true, JSON.stringify(out));
  assert.equal(out.walked, 2, "only the 2 listed leads are walked");
  assert.equal(out.in_columns, 3);
  assert.equal(out.only_leads, 2, "the bad id is dropped; case does not matter");
  assert.equal(calls.filter(c => c.host === "hook.us2.make.com").length, 1, "one text: the listed consented lead");
  assert.ok(calls.filter(c => c.method === "PATCH" && c.path === "/rest/v1/leads" && c.query.includes(A)).length > 0, "the listed lead IS claimed (the check below is real)");
  assert.equal(calls.filter(c => c.method === "PATCH" && c.path === "/rest/v1/leads" && c.query.includes(C)).length, 0, "the unlisted lead is never claimed or written");
  assert.ok(world.leads.find(l => l.id === A).raw_payload.pipeline?.reengage, "A is recorded");
  assert.ok(world.leads.find(l => l.id === B).raw_payload.pipeline?.reengage, "B is recorded (email)");
  assert.equal(world.leads.find(l => l.id === C).raw_payload.pipeline?.reengage, undefined, "C untouched");
  assert.equal(world.settings.value.armed, false, "disarmed after the run");
  assert.equal(P.normalizeReengageBatch({ columns: ["office_contacted"] }).only_leads.length, 0, "no list = the whole column, as before");
});
