// The 7:00 AM re-engage blast AT SCALE (2026-09-24, before the send). Proves, with the real runner and the
// network replaced, that ~115 leads are each messaged EXACTLY ONCE even when:
//   - Resend answers 429 (rate limit) on some calls and is slow on others -> the 429s are retried and land;
//   - the run hits its time budget part-way -> it writes "incomplete" and the next tick carries on;
//   - the function is KILLED part-way (no final write at all) -> a later tick carries on once the run is
//     stale, the lead that was in flight is never sent twice, and two racing ticks cannot both carry on.
// Also pins the Resend pacing/429 helper itself, and that ordinary callers still make exactly one attempt.
// Nothing here talks to the real project: global.fetch is replaced before anything runs.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
process.env.SUPABASE_URL = "http://supabase.test";
process.env.LDTT_MAKE_HOOK_PATHWAY1 = "https://hook.us2.make.com/abc123reengage";
process.env.RESEND_API_KEY = "re_stub_not_a_real_key";
const read = path => readFileSync(resolve(import.meta.dirname, "..", path), "utf8");

const SEND_AT = "2026-09-24T11:00:00Z";
const AT = offsetMin => Date.parse(SEND_AT) + offsetMin * 60 * 1000;
const ZIPS = ["44118", "60618", "30052", "78245", "32501", "", "02021", "92105"];
const AD2 = [["cleveland", "44118"], ["chicago", "60618"], ["atlanta", "30052"], ["san-antonio", "78245"], ["pensacola", "32501"], ["san-diego", "92105"]]
  .map(([slug, zip]) => ({ slug, published_content: { zip } }));

function load() {
  for (const m of ["../lib/sandbox.js", "../lib/booking.js", "../lib/office-email.js", "../lib/pipeline.js"]) delete require.cache[require.resolve(m)];
  delete process.env.LDTT_SANDBOX; // LIVE mode: the real recipient rules, with the network replaced
  return require("../lib/pipeline.js");
}

// 115 rows: 100 office_contacted + 15 engaged_no_outcome, about half with SMS consent, one duplicate PERSON
// (row 114 shares row 3's email) - so 114 people should each get exactly one message.
function makeLeads(n = 115) {
  const leads = [];
  for (let i = 0; i < n; i += 1) {
    const id = `00000000-0000-4000-8000-${String(100000000000 + i)}`;
    leads.push({
      id, version: 1, first_name: `Person${i}`, last_name: "Synthetic", dog_name: "",
      phone: "",
      email: `person${i}@example.test`, zip: ZIPS[i % ZIPS.length], sms_consent: i % 2 === 0,
      status: i < 100 ? "office_contacted" : "engaged_no_outcome", created_at: "2026-09-10T12:00:00Z", raw_payload: {}
    });
  }
  // every phone a distinct, well-formed 10-digit number
  leads.forEach((l, i) => { l.phone = `(216) 5${String(i % 100).padStart(2, "0")}-${String(4000 + i)}`; });
  if (n > 114) { // one person, two rows
    leads[114].email = leads[3].email;
    leads[114].sms_consent = false; leads[114].zip = "";
  }
  return leads;
}

const res = (status, data, text, headers = {}) => ({
  ok: status < 400, status, headers: { get: k => headers[String(k).toLowerCase()] ?? null },
  text: async () => text ?? JSON.stringify(data), json: async () => data
});

function stubWorld(world) {
  world.calls = [];
  world.hookPosts = [];          // lead ids posted to Make
  world.resendAccepted = new Map(); // idempotency key -> count accepted
  world.resendCalls = 0;
  world.resend429 = 0;
  world.resendStarts = [];
  global.fetch = async (url, options = {}) => {
    const u = new URL(String(url));
    let body = options.body;
    if (typeof body === "string") { try { body = JSON.parse(body); } catch { /* text */ } }
    const method = options.method || "GET";
    world.calls.push({ host: u.host, path: u.pathname, method, body, query: u.search });
    if (u.host === "hook.us2.make.com") {
      world.hookPosts.push(body.lead_id);
      if (world.hangOnHook && world.hookPosts.length === world.hangOnHook) return new Promise(() => {}); // the function is killed here
      if (world.hookPosts.length % 9 === 0) await new Promise(r => setTimeout(r, 15)); // a slow Make answer
      if (world.advanceOnHook) world.clock.now += world.advanceOnHook;
      return res(200, null, "Accepted");
    }
    if (u.host === "api.resend.com") {
      world.resendCalls += 1;
      world.resendStarts.push(Date.now());
      if (world.advanceOnEmail) world.clock.now += world.advanceOnEmail;
      if (world.resendCalls % 6 === 0) { world.resend429 += 1; return res(429, { name: "rate_limit_exceeded", message: "Too many requests" }, undefined, { "retry-after": "0.01" }); }
      if (world.resendCalls % 5 === 0) await new Promise(r => setTimeout(r, 20)); // a slow Resend answer
      const key = options.headers?.["Idempotency-Key"];
      world.resendAccepted.set(key, (world.resendAccepted.get(key) || 0) + 1);
      return res(200, { id: `re_${world.resendCalls}` });
    }
    if (u.pathname.startsWith("/rest/v1/ad_pages")) return res(200, AD2);
    if (u.pathname.startsWith("/rest/v1/site_settings")) {
      if (method === "PATCH") {
        if (!world.settings) return res(200, []);
        if (u.search.includes("updated_at=eq.") && !u.search.includes(encodeURIComponent(world.settings.updated_at))) return res(200, []);
        world.settings = { ...world.settings, value: JSON.parse(JSON.stringify(body.value)), updated_at: `2026-09-24T11:00:00.${String(++world.tick).padStart(6, "0")}Z` };
        return res(200, [world.settings]);
      }
      if (u.search.includes("key=eq.reengage_batch")) return res(200, world.settings ? [world.settings] : []);
      return res(200, []);
    }
    if (u.pathname.startsWith("/rest/v1/leads")) {
      if (method === "PATCH") {
        const match = world.leads.find(l => u.search.includes(`id=eq.${l.id}`) && u.search.includes(`version=eq.${l.version}`));
        if (!match) return res(200, []);
        Object.assign(match, JSON.parse(JSON.stringify(body)), { version: match.version + 1 });
        return res(200, [match]);
      }
      if (u.search.includes("id=eq.")) { const one = world.leads.find(l => u.search.includes(`id=eq.${l.id}`)); return res(200, one ? [JSON.parse(JSON.stringify(one))] : []); }
      if (u.search.includes("status=eq.")) {
        const status = decodeURIComponent((u.search.match(/status=eq\.([^&]+)/) || [])[1] || "");
        return res(200, JSON.parse(JSON.stringify(world.leads.filter(l => l.status === status))));
      }
      return res(200, []);
    }
    world.stray = (world.stray || 0) + 1;
    return res(200, []);
  };
}

function armedWorld() {
  return {
    leads: makeLeads(), tick: 0, clock: { now: 0 },
    settings: { key: "reengage_batch", updated_at: "2026-09-24T08:00:00Z",
      value: { armed: true, columns: ["office_contacted", "engaged_no_outcome"], column: "office_contacted", send_at: SEND_AT, max_age_days: 60, note: "office note survives" } }
  };
}

// Every kept person got exactly one email (one accepted Resend call per idempotency key) and, with consent,
// exactly one text; the duplicate row got nothing; nobody twice.
function assertExactlyOnce(world, { except = [] } = {}) {
  const people = world.leads.filter(l => l.id !== world.leads[114].id && !except.includes(l.id));
  for (const lead of people) {
    assert.equal(world.resendAccepted.get(`client:${lead.id}:reengage_invite`), 1, `one email for ${lead.first_name}`);
    const posts = world.hookPosts.filter(id => id === lead.id).length;
    assert.equal(posts, lead.sms_consent ? 1 : 0, `${lead.sms_consent ? "one text" : "no text"} for ${lead.first_name}`);
    assert.equal(lead.raw_payload.pipeline.reengage.status, "sent");
  }
  assert.equal(world.resendAccepted.get(`client:${world.leads[114].id}:reengage_invite`), undefined, "the duplicate person's second row is never emailed");
  assert.ok(!world.hookPosts.includes(world.leads[114].id));
  assert.equal(world.leads[114].raw_payload.pipeline, undefined, "the passed-over row is never claimed");
  for (const [key, count] of world.resendAccepted) assert.equal(count, 1, `accepted once: ${key}`);
  assert.equal(new Set(world.hookPosts).size, world.hookPosts.length, "no lead texted twice");
  assert.equal(world.stray || 0, 0, "no stray network call");
}

test("AT SCALE: 115 rows, Resend 429s + slow answers, the time budget hit part-way, the next tick finishes: every person exactly once", async t => {
  const world = armedWorld();
  world.advanceOnEmail = 8_000; // each Resend call "takes" 8 s on the runner's clock -> the 600 s budget stops the first run part-way
  stubWorld(world);
  const P = load();
  const clock = () => world.clock.now;

  const first = await P.runReengageBatch({ nowMs: AT(0), clock, emailPaceMs: 2 });
  assert.equal(first.ran, true, JSON.stringify(first).slice(0, 300));
  assert.equal(first.stopped_early, true, "the budget stopped the first run part-way");
  assert.ok(first.remaining > 0 && first.sent > 0, `sent ${first.sent}, remaining ${first.remaining}`);
  assert.equal(world.settings.value.status, "incomplete");
  assert.equal(world.settings.value.armed, false, "still disarmed: the claim is the kill switch");
  assert.equal(world.settings.value.note, "office note survives");

  // the next cron tick carries on - immediately, because the first run said "incomplete"
  const second = await P.runReengageBatch({ nowMs: AT(15), clock, emailPaceMs: 2 });
  assert.equal(second.ran, true);
  assert.equal(second.resumed, true);
  assert.equal(second.stopped_early, false);
  assert.equal(second.already_done, first.sent, "the second run skips everyone the first run reached");
  assert.equal(first.sent + second.sent, 114, "114 people, all reached across the two ticks");
  assert.equal(world.settings.value.status, "done");
  assert.equal(world.settings.value.runs.length, 2);

  // and a third tick does nothing at all
  const third = await P.runReengageBatch({ nowMs: AT(30), clock });
  assert.equal(third.armed, false);
  assert.equal(third.ran, undefined);

  assert.ok(world.resend429 > 5, `Resend answered 429 ${world.resend429} times`);
  assert.equal(first.emails_failed + second.emails_failed, 0, "every 429 was retried and landed");
  assertExactlyOnce(world);
  assert.equal(world.hookPosts.length, 57, "57 of the 114 people gave SMS consent: 57 texts");
  t.diagnostic(`tick 1: sent ${first.sent}, stopped early with ${first.remaining} left; tick 2 (resumed): sent ${second.sent}, already done ${second.already_done}; Resend 429s answered ${world.resend429}, all retried; texts ${world.hookPosts.length}; emails ${world.resendAccepted.size}`);
});

test("KILLED mid-run: no final write at all; a tick 5 minutes later leaves it alone, the stale-run tick carries on, two racing ticks cannot both carry on, and the in-flight lead is never sent twice", async t => {
  const world = armedWorld();
  world.hangOnHook = 20; // the 20th Make post never answers: the function dies there
  stubWorld(world);
  const P = load();

  const killed = P.runReengageBatch({ nowMs: AT(0), emailPaceMs: 1 });
  const outcome = await Promise.race([killed.then(() => "finished"), new Promise(r => setTimeout(() => r("killed"), 1500))]);
  assert.equal(outcome, "killed");
  assert.equal(world.settings.value.status, "running", "a killed run leaves the key at running, disarmed");
  assert.equal(world.settings.value.armed, false);
  const inFlight = world.hookPosts[19];
  const inFlightLead = world.leads.find(l => l.id === inFlight);
  assert.equal(inFlightLead.raw_payload.pipeline.reengage.status, "sending", "claimed, never finished");
  const sentBeforeKill = world.leads.filter(l => l.raw_payload.pipeline?.reengage?.status === "sent").length;

  // 11:05 - the run is not stale yet (it could still be alive): do nothing
  const early = await P.runReengageBatch({ nowMs: AT(5), emailPaceMs: 1 });
  assert.equal(early.running, true);
  assert.equal(early.ran, undefined);

  // 11:15 - stale: two ticks race; exactly one carries on
  const [a, b] = await Promise.all([
    P.runReengageBatch({ nowMs: AT(15), emailPaceMs: 1 }),
    P.runReengageBatch({ nowMs: AT(15), emailPaceMs: 1 })
  ]);
  const ran = [a, b].filter(r => r.ran);
  assert.equal(ran.length, 1, "only one tick carries the run on");
  const resumed = ran[0];
  assert.equal(resumed.resumed, true);
  assert.deepEqual(resumed.interrupted, [inFlight], "the in-flight lead is reported for the office, not re-sent");
  assert.equal(resumed.already_done, sentBeforeKill);
  assert.equal(sentBeforeKill + resumed.sent, 113, "everyone except the one in flight at the kill");
  assert.equal(world.settings.value.status, "done");

  // the in-flight lead: its email went once (email goes before the text), its text was attempted once, never again
  assert.equal(world.resendAccepted.get(`client:${inFlight}:reengage_invite`), 1);
  assert.equal(world.hookPosts.filter(id => id === inFlight).length, 1);
  assertExactlyOnce(world, { except: [inFlight] });
  t.diagnostic(`killed after ${sentBeforeKill} sent; 11:05 tick left it alone; 11:15 racing ticks -> one carried on and sent ${resumed.sent}; interrupted (reported, not re-sent): 1`);
});

test("the resume guards: a done run, a stopped run (resume:false or status stopped), and a stale run long after send_at are all left alone", async () => {
  const P = load();
  const base = { armed: false, columns: ["office_contacted"], send_at: SEND_AT, status: "running", run_started_at: SEND_AT };
  assert.equal(P.reengageResumeState(base, AT(15)).resume, true, "stale running run: carry on");
  assert.equal(P.reengageResumeState(base, AT(5)).resume, false, "fresh running run: leave it");
  assert.equal(P.reengageResumeState({ ...base, status: "done" }, AT(15)).resume, false);
  assert.equal(P.reengageResumeState({ ...base, status: "stopped" }, AT(15)).resume, false);
  assert.equal(P.reengageResumeState({ ...base, resume: false }, AT(15)).resume, false);
  assert.equal(P.reengageResumeState({ ...base, status: "incomplete" }, AT(1)).resume, true, "incomplete: carry on at once");
  assert.equal(P.reengageResumeState({ ...base, status: "incomplete" }, AT(7 * 60)).resume, false, "never hours later");
  assert.equal(P.reengageResumeState({ ...base, resumes: P.REENGAGE_MAX_RESUMES }, AT(15)).resume, false);
  assert.equal(P.reengageResumeState({ ...base, armed: true }, AT(15)).resume, false, "armed is the first-run path, not a resume");
  assert.ok(P.REENGAGE_RUN_STALE_MS > 800 * 1000, "stale threshold is longer than the function's maxDuration");
  assert.ok(P.REENGAGE_BUDGET_MS + 120 * 1000 <= 800 * 1000, "the budget leaves room for the last lead inside maxDuration");
});

test("Resend helper: paced when asked, a 429 honours Retry-After and is retried a bounded number of times; ordinary callers still make ONE attempt", async () => {
  for (const m of ["../lib/office-email.js"]) delete require.cache[require.resolve(m)];
  const M = require("../lib/office-email.js");
  const starts = [];
  let answer429 = 0;
  global.fetch = async () => {
    starts.push(Date.now());
    if (answer429 > 0) { answer429 -= 1; return res(429, { message: "Too many requests" }, undefined, { "retry-after": "0.2" }); }
    return res(200, { id: "re_ok" });
  };
  const email = { to: ["a@example.test"], subject: "s", html: "<p>h</p>", text: "t", idempotencyKey: "k1" };
  const cfg = { ready: true, key: "re_stub", from: "x <x@example.test>" };

  // pacing: five sends at 80 ms pace are at least ~80 ms apart
  for (let i = 0; i < 5; i += 1) assert.equal((await M.sendViaResend(email, { ...cfg, paceMs: 80 })).ok, true);
  const gaps = starts.slice(1).map((t, i) => t - starts[i]);
  assert.ok(gaps.every(g => g >= 75), `paced gaps ${gaps.join(",")}`);

  // 429 twice then OK: retried, waited Retry-After (0.2 s) each time, landed
  starts.length = 0; answer429 = 2;
  const t0 = Date.now();
  const ok = await M.sendViaResend(email, { ...cfg, retry429: 4 });
  assert.equal(ok.ok, true); assert.equal(ok.attempts, 3);
  assert.ok(Date.now() - t0 >= 380, "honoured Retry-After");

  // 429 forever: bounded, then an honest failure
  answer429 = 100; starts.length = 0;
  const gaveUp = await M.sendViaResend(email, { ...cfg, retry429: 2 });
  assert.equal(gaveUp.ok, false); assert.equal(gaveUp.status, 429); assert.equal(starts.length, 3);

  // an ordinary caller (no opt-in): exactly ONE attempt, no waiting - form submits never wait on this
  answer429 = 1; starts.length = 0;
  const plain = await M.sendViaResend(email, cfg);
  assert.equal(plain.ok, false); assert.equal(starts.length, 1);
  assert.ok(M.RETRY_WAIT_CAP_MS <= 5000);
});

test("a number no US phone can have (area code 121, like five live leads) is never posted to Make - the email still goes, so three bad numbers in a row cannot switch pathway 1 off", async () => {
  const world = armedWorld();
  world.leads = makeLeads(6).map((l, i) => ({ ...l, sms_consent: true, phone: i < 4 ? `(12${i}) 555-04${10 + i}` : l.phone }));
  stubWorld(world);
  const P = load();
  assert.equal(P.reengageDialable("+12165551234"), true);
  assert.equal(P.reengageDialable("+11215550414"), false, "area code starting 1");
  assert.equal(P.reengageDialable("+12160551234"), false, "exchange starting 0");
  const out = await P.runReengageBatch({ nowMs: AT(0), emailPaceMs: 1 });
  assert.equal(out.ran, true);
  assert.equal(world.hookPosts.length, 2, "only the two dialable numbers reach Make");
  for (const lead of world.leads.slice(0, 4)) {
    const r = lead.raw_payload.pipeline.reengage;
    assert.equal(r.text.status, "skipped"); assert.match(r.text.reason, /Not a dialable US number/);
    assert.equal(r.client_email.status, "sent", "the email still goes"); assert.equal(r.status, "sent");
  }
  assert.equal(world.resendAccepted.size, 6);
});

test("wiring pins: the cron function has an explicit maxDuration, and the batch run opts in to pacing + 429 retries", () => {
  const vercel = JSON.parse(read("vercel.json"));
  assert.equal(vercel.functions["api/cron/auto-followups.js"].maxDuration, 800);
  const src = read("lib/pipeline.js");
  assert.match(src, /paceMs: emailPaceMs, retry429: REENGAGE_EMAIL_RETRY_429/);
  assert.match(src, /sendReengageInvite\(\{ lead, by: "reengage_batch", emailConfig, settings: runSettings \}\)/);
  assert.match(read("api/cron/auto-followups.js"), /P\.runReengageBatch\(\)/);
});
