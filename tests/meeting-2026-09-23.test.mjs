// Meeting changes 2026-09-23 (Joshua):
//   1. The OFFICE answers the same three-state Alpha question the trainer portal asks
//      (blank / Yes / No) — the card and the detail panel are selects, and the save
//      door writes true / false / null (see also tests/lead-cards.test.mjs).
//   2. A lead whose ZIP has no bookable trainer is stamped raw_payload.needs_office_call
//      and wears a red "Needs a call" badge in the office portal.
//   3. Automatic follow-ups: the three "has not booked yet" texts fire by the clock
//      (15 min / 30 min / 24 h after pipeline.entered_at) behind a Settings switch
//      that is OFF by default. A claimed step never sends twice; a manual button press
//      marks the step done; booking or closing the lead stops the chain.
// Run: node --test tests/   Nothing here talks to the real project (global fetch is replaced).
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "test-key";
process.env.SUPABASE_URL = process.env.SUPABASE_URL || "http://supabase.test";
process.env.LDTT_MAKE_HOOK_PATHWAY1 = "https://hook.us2.make.com/abc123auto";
const read = path => readFileSync(resolve(import.meta.dirname, "..", path), "utf8");

const TESTER = "+14405550123";
const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const T0 = Date.parse("2026-09-23T12:00:00Z");

function loadPipeline(sandbox = true) {
  for (const m of ["../lib/sandbox.js", "../lib/booking.js", "../lib/pipeline.js"]) delete require.cache[require.resolve(m)];
  if (sandbox) process.env.LDTT_SANDBOX = "1"; else delete process.env.LDTT_SANDBOX;
  return require("../lib/pipeline.js");
}

function makeLead(overrides = {}, pipeline = {}) {
  return {
    id: "00000000-0000-4000-8000-000000000077", first_name: "Sam", last_name: "Tester", phone: "(440) 555-0123",
    sms_consent: true, status: "new_inquiry", version: 3, created_at: new Date(T0 - 20 * MIN).toISOString(),
    raw_payload: {
      pipeline: {
        entered_at: new Date(T0 - 20 * MIN).toISOString(),
        book_url: "https://ldtt-sandbox.vercel.app/book/fred-harris?lead=x",
        new_lead_text: { pathway: 1, status: "sent" },
        ...pipeline
      }
    },
    ...overrides
  };
}

// ---------------------------------------------------------------------------
// 3a. autoFollowUpDue — the clock and the stop rules
// ---------------------------------------------------------------------------
test("auto follow-ups: due steps follow the 15 min / 30 min / 24 h clock", () => {
  const P = loadPipeline(true);
  const at = mins => P.autoFollowUpDue(makeLead({ raw_payload: { pipeline: { entered_at: new Date(T0 - mins * MIN).toISOString(), new_lead_text: { status: "sent" } } } }), T0);
  assert.deepEqual(at(10), [], "nothing before 15 minutes");
  assert.deepEqual(at(16), ["tim"], "Lorenzo's follow-up at 15 minutes");
  assert.deepEqual(at(31), ["tim", "link"], "the booking link again at 30 minutes");
  assert.deepEqual(at(25 * 60), ["tim", "link", "care"], "the care text at 24 hours");
});

test("auto follow-ups: a recorded step never fires again (manual press marks it done)", () => {
  const P = loadPipeline(true);
  const lead = makeLead({}, { followups: [{ step: "tim", status: "sent", by: "office@x" }, { step: "link", status: "skipped" }] });
  assert.deepEqual(P.autoFollowUpDue(lead, T0 + 25 * HOUR - 20 * MIN), ["care"], "tim and link are done, whatever their outcome");
});

test("auto follow-ups: booking, closing, no consent, no first text, or an old lead stops the chain", () => {
  const P = loadPipeline(true);
  const base = () => makeLead();
  const withBooking = b => { const l = base(); l.raw_payload.booking = b; return l; };
  assert.deepEqual(P.autoFollowUpDue(withBooking({ slot_start: "2026-09-24T14:00:00Z" }), T0), [], "booked online: stop");
  assert.deepEqual(P.autoFollowUpDue(withBooking({ requested_at: "2026-09-23T11:00:00Z" }), T0), [], "requested a trainer: stop");
  assert.deepEqual(P.autoFollowUpDue(withBooking({ callback: { zip: "44128" } }), T0), [], "asked for a callback: stop");
  for (const status of ["became_client", "archived", "do_not_contact", "lost_no_response", "evaluation_scheduled", "evaluation_complete"]) {
    assert.deepEqual(P.autoFollowUpDue(makeLead({ status }), T0), [], `status ${status}: stop`);
  }
  assert.deepEqual(P.autoFollowUpDue(makeLead({ sms_consent: false }), T0), [], "no SMS consent: nothing");
  const noFirst = makeLead({ raw_payload: { pipeline: { entered_at: new Date(T0 - 20 * MIN).toISOString(), new_lead_text: { status: "skipped" } } } });
  assert.deepEqual(P.autoFollowUpDue(noFirst, T0), [], "first text never went: no chain");
  const old = makeLead({ raw_payload: { pipeline: { entered_at: new Date(T0 - 9 * 24 * HOUR).toISOString(), new_lead_text: { status: "sent" } } } });
  assert.deepEqual(P.autoFollowUpDue(old, T0), [], "older than the window: the backlog is left alone");
});

// ---------------------------------------------------------------------------
// 3b. runAutoFollowUps — the switch, the claim, and the send
// ---------------------------------------------------------------------------
function stubWorld({ autoOn, lead }) {
  const calls = [];
  const db = { lead: JSON.parse(JSON.stringify(lead)) };
  global.fetch = async (url, options = {}) => {
    const u = new URL(String(url));
    let body = options.body;
    if (typeof body === "string") { try { body = JSON.parse(body); } catch { /* text */ } }
    calls.push({ host: u.host, path: u.pathname, search: u.search, method: options.method || "GET", body });
    const res = (status, data, text) => ({ ok: status < 400, status, text: async () => text ?? JSON.stringify(data), json: async () => data });
    if (u.host === "hook.us2.make.com") return res(200, null, "Accepted");
    if (u.pathname.startsWith("/rest/v1/communications_testers")) return res(200, [{ phone: TESTER }]);
    if (u.pathname.startsWith("/rest/v1/site_settings")) {
      if (u.search.includes("pipeline_office_emails")) return res(200, [{ value: { auto_followups: autoOn, practice_email_to: "tester@example.test" } }]);
      return res(200, []);
    }
    if (u.pathname.startsWith("/rest/v1/leads")) {
      if ((options.method || "GET") === "GET") {
        return res(200, db.lead ? [db.lead] : []);
      }
      if (options.method === "PATCH") {
        // version-guarded claim, like the real PostgREST: a stale version matches nothing
        const versionMatch = /version=eq\.(\d+)/.exec(u.search);
        if (versionMatch && Number(versionMatch[1]) !== db.lead.version) return res(200, []);
        db.lead = { ...db.lead, ...body, version: db.lead.version + 1 };
        return res(200, [db.lead]);
      }
    }
    return res(200, []);
  };
  return { calls, db };
}

test("runAutoFollowUps: master switch OFF sends nothing at all", async () => {
  const P = loadPipeline(true);
  const { calls } = stubWorld({ autoOn: false, lead: makeLead() });
  const out = await P.runAutoFollowUps({ nowMs: T0 });
  assert.equal(out.on, false);
  assert.deepEqual(out.sent, []);
  assert.equal(calls.filter(c => c.host === "hook.us2.make.com").length, 0, "no text left the building");
  assert.equal(calls.filter(c => c.method === "PATCH").length, 0, "nothing was written");
});

test("runAutoFollowUps: switch ON claims the step, sends to the tester phone, and never re-sends", async () => {
  const P = loadPipeline(true);
  const { calls, db } = stubWorld({ autoOn: true, lead: makeLead() });
  const out = await P.runAutoFollowUps({ nowMs: T0 });
  assert.equal(out.on, true);
  assert.deepEqual(out.sent.map(s => s.step), ["tim"], JSON.stringify(out));
  const hook = calls.find(c => c.host === "hook.us2.make.com");
  assert.ok(hook, "posted to Make pathway 1");
  assert.equal(hook.body.pathway, "followup");
  assert.equal(hook.body.followup_key, "tim");
  assert.equal(hook.body.phone, TESTER, "practice copy: active tester phone only");
  assert.equal(hook.body.practice, true);
  const record = db.lead.raw_payload.pipeline.followups;
  assert.equal(record.length, 1);
  assert.equal(record[0].step, "tim");
  assert.equal(record[0].status, "sent");
  assert.equal(record[0].by, "auto");

  // Second run at the same clock: the recorded step blocks a re-send.
  const before = calls.filter(c => c.host === "hook.us2.make.com").length;
  const again = await P.runAutoFollowUps({ nowMs: T0 });
  assert.deepEqual(again.sent, [], "nothing due twice");
  assert.equal(calls.filter(c => c.host === "hook.us2.make.com").length, before, "no second text");
});

test("runAutoFollowUps: a lost version race means no claim and no text", async () => {
  const P = loadPipeline(true);
  const { calls, db } = stubWorld({ autoOn: true, lead: makeLead() });
  // Somebody else bumps the version between every read and write: every claim PATCH misses.
  const origFetch = global.fetch;
  global.fetch = async (url, options = {}) => {
    if (String(url).includes("/rest/v1/leads") && (options.method || "GET") === "PATCH") {
      db.lead.version += 1; // the race
    }
    return origFetch(url, options);
  };
  // The claim retries 3 times inside mergePipelineRecord and then gives up quietly.
  const out = await P.runAutoFollowUps({ nowMs: T0 });
  assert.deepEqual(out.sent, [], "no claim, no send");
  assert.equal(calls.filter(c => c.host === "hook.us2.make.com").length, 0, "no text without a won claim");
});

// ---------------------------------------------------------------------------
// 3c. The cron door and the wiring
// ---------------------------------------------------------------------------
test("cron endpoint: refuses outsiders, answers the Vercel cron header", async () => {
  loadPipeline(true);
  delete require.cache[require.resolve("../api/cron/auto-followups.js")];
  const handler = require("../api/cron/auto-followups.js");
  const { calls } = stubWorld({ autoOn: false, lead: null });
  const run = async headers => {
    let code = 0, payload = null;
    const res = { setHeader() {}, status(c) { code = c; return this; }, json(p) { payload = p; return this; } };
    await handler({ headers, query: {} }, res);
    return { code, payload };
  };
  const outsider = await run({});
  assert.equal(outsider.code, 403);
  const cron = await run({ "x-vercel-cron": "1" });
  assert.equal(cron.code, 200, JSON.stringify(cron.payload));
  assert.equal(cron.payload.on, false, "switch off: the run reports itself off and fires nothing");
  assert.equal(calls.filter(c => c.host === "hook.us2.make.com").length, 0);
});

test("wiring: vercel.json schedules the cron; the Settings panel carries the switch", () => {
  const vercel = JSON.parse(read("vercel.json"));
  const cron = (vercel.crons || []).find(c => c.path === "/api/cron/auto-followups");
  assert.ok(cron, "the auto follow-up cron is scheduled");
  assert.equal(cron.schedule, "*/15 * * * *");
  const app = read("trainer-backoffice/app.js");
  assert.ok(app.includes("data-pipeline-auto-followups"), "the Settings switch renders");
  assert.ok(app.includes("auto_followups: autoFollowups"), "the switch is saved with the other settings");
  const P = loadPipeline(true);
  assert.equal(P.defaultSettings().auto_followups, false, "default OFF");
  assert.equal(P.normalizeSettings({ auto_followups: true }).value.auto_followups, true);
  assert.equal(P.normalizeSettings({}).value.auto_followups, false, "a row saved before the switch existed stays OFF");
});

// ---------------------------------------------------------------------------
// 1. The office Alpha question is the same three-state select as the trainer's
// ---------------------------------------------------------------------------
test("office Alpha question: card = compact red toggle button; the worded three-state select lives ONLY in the opened lead panel", () => {
  const app = read("trainer-backoffice/app.js");
  const card = app.slice(app.indexOf("function leadAlphaToggle"), app.indexOf("function datetimeLocalValue"));
  // Go-live hotfix 2026-09-23: no select on any card - the button is blank-aware.
  assert.ok(!card.includes("<select"), "the card control carries NO select");
  assert.ok(card.includes('<button type="button" class="lead-alpha-toggle'), "the card control is the red toggle button");
  for (const words of ["Added to Alpha?", "Added to Alpha? No", "Added to Alpha"]) assert.ok(card.includes(words), `card says "${words}"`);
  // The click toggles yes <-> blank and never opens the card.
  assert.ok(app.includes('saveLeadAlpha(alphaToggle.dataset.leadAlpha, (alphaLead?.alphaAnswer || "") === "yes" ? "" : "yes")'), "click: blank/no -> yes, yes -> blank");
  assert.ok(!app.includes('select[data-lead-alpha]"'), "no change handler for a card select remains");
  // The worded question stays in the OPENED panels (office + trainer), as a select.
  assert.ok(app.includes('data-lead-alpha-check="${lead.id}"'), "the office detail panel keeps the three-state control");
  const detail = app.slice(app.indexOf('class="lead-alpha-check"'), app.indexOf('data-lead-lost-reason'));
  for (const words of ["Have you logged this lead in Alpha?", "Pick Yes or No", "Yes, it is logged in Alpha", "No, not yet"]) {
    assert.ok(detail.includes(words), `office panel select says "${words}"`);
  }
  assert.ok(!detail.includes('type="checkbox"'), "the old collapse-blank-into-No checkbox is gone");
  const trainer = app.slice(app.indexOf('class="trainer-alpha-question"'), app.indexOf("data-trainer-lost-reason"));
  assert.ok(trainer.includes("Pick Yes or No") && trainer.includes("No, not yet"), "the trainer panel keeps the same worded select");
  // The red-button styling covers both panel questions.
  const css = read("trainer-backoffice/styles.css");
  assert.ok(/\.lead-detail-panel \.lead-alpha-check,\n\.trainer-lead-update \.trainer-alpha-question \{/.test(css), "both panel questions share the red styling block");
  const save = app.slice(app.indexOf("function saveLeadAlpha"), app.indexOf("async function persistLeadWorkflow"));
  assert.ok(save.includes('answer === "yes" ? true : answer === "no" ? false : null'), "the office save still writes true/false/null (tri-state data unchanged)");
});

// ---------------------------------------------------------------------------
// 2. Needs a call — the stamp and the badge
// ---------------------------------------------------------------------------
test("needs a call: the no-trainer lead is stamped and the office wears the badge", () => {
  const booking = read("lib/booking.js");
  assert.ok(booking.includes("...(setting ? {} : { needs_office_call: true })"), "createLead stamps a lead with no bookable trainer");
  const api = read("api/booking.js");
  assert.ok(api.includes("needs_office_call: true"), "the callback request stamps the lead too");
  const app = read("trainer-backoffice/app.js");
  assert.ok(app.includes("function leadNeedsOfficeCall"), "the badge reads the stamp");
  assert.ok(app.includes('needs_office_call === true'), "a real true only");
  assert.ok(app.includes('lead-tag-needs-call'), "the badge renders");
  assert.ok(app.includes(">Needs a call</span>"), "with the agreed words");
  const css = read("trainer-backoffice/styles.css");
  assert.ok(css.includes(".lead-tag-needs-call"), "and its own (red outline) style");
  // The client already reads "our office will call you" on the no-trainer screen; keep it that way.
  const page = read("lib/booking-page.js");
  assert.ok(page.includes("our office will call you"), "client-facing wording: the office will reach out");
});

// ---------------------------------------------------------------------------
// 6. Speed: ad2-studio.js and form-editor.js no longer block the portal
// ---------------------------------------------------------------------------
test("speed: the two editor scripts load with defer in both portal shells", () => {
  for (const file of ["staff.html", "trainer-backoffice/index.html"]) {
    const html = read(file);
    assert.match(html, /<script defer src="\/?trainer-backoffice\/ad2-studio\.js\?v=/, `${file}: ad2-studio.js defers`);
    assert.match(html, /<script defer src="\/?trainer-backoffice\/form-editor\.js\?v=/, `${file}: form-editor.js defers`);
    // app.js must stay a blocking script: the defer scripts use its globals.
    assert.match(html, /<script src="\/?trainer-backoffice\/app\.js\?v=/, `${file}: app.js still loads first, blocking`);
  }
});

// ---------------------------------------------------------------------------
// 7. Spanish PREVIEW on the Pensacola 2.0 page only
// ---------------------------------------------------------------------------
test("Spanish preview: Pensacola only, never the editor, form submits unchanged", async () => {
  for (const m of ["../lib/ad-page-template.js", "../lib/ad2-usmap.js", "../lib/ad2-page-template.js"]) delete require.cache[require.resolve(m)];
  const T = require("../lib/ad2-page-template.js");
  const content = T.fromStarter("panama-city-beach", { newSlug: "pensacola" });
  const html = T.renderPage(content, { practice: true });
  assert.ok(html.includes('id="es-toggle"'), "the Pensacola page carries the toggle");
  assert.ok(html.includes("Español"), "labelled Espanol");
  // The dictionary swaps words client-side; the form's field names are untouched in the HTML.
  for (const nm of ['name="first_name"', 'name="phone"', 'name="zip"', 'name="sms_consent"']) assert.ok(html.includes(nm), `${nm} unchanged`);
  const other = T.renderPage(T.fromStarter("panama-city-beach", { newSlug: "cleveland" }), { practice: true });
  assert.ok(!other.includes('id="es-toggle"'), "no other page gets the preview");
  const editor = T.renderPage(content, { practice: true, editor: true });
  assert.ok(!editor.includes('id="es-toggle"'), "Page Studio's editor view is untouched");
  const src = read("lib/ad2-page-template.js");
  assert.ok(src.includes("PREVIEW ONLY"), "clearly marked as a preview in code");
  // The toggle locks each option's submitted value to the English text before translating the label.
  assert.ok(src.includes('opt.setAttribute("value", opt.textContent)'), "option values locked so submits never change");
});
