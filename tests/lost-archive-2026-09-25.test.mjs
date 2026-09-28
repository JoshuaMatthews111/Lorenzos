// Lost vs Archive (Zoom 2026-09-24, Lorenzo + Angela; built 2026-09-25).
// Lorenzo: "Lost would be there's no need in us contacting them again." Hard no's = LOST: no trainer in their area, the
// client does not believe in our training method, the dog does not qualify, went with a competitor. EVERYTHING ELSE is
// ARCHIVE (maybe later / TTRG). Two new statuses (lost_method_not_a_fit, lost_dog_not_qualified), added in both schemas;
// every existing value unchanged (rule 10); the daily archive cron never sweeps a hard no into Archived.
// Run: node --test tests/   Nothing here talks to the real project.
import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
process.env.SUPABASE_URL = "http://supabase.test";
const M = require("../trainer-backoffice/metrics.js");
const read = path => readFileSync(resolve(import.meta.dirname, "..", path), "utf8");
const app = read("trainer-backoffice/app.js");
const fn = name => app.match(new RegExp(`(?:async )?function ${name}\\(.*\\) \\{\\n[\\s\\S]*?\\n\\}\\n`))[0];
const escapeHtml = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const NEW = ["lost_method_not_a_fit", "lost_dog_not_qualified"];
const HARD = ["lost_no_trainer_area", "lost_method_not_a_fit", "lost_dog_not_qualified", "lost_chose_another_provider"];

test("the vocabulary: four hard-no reasons -> statuses, four archive reasons, the soft Lost statuses listed apart", () => {
  assert.deepEqual(M.HARD_NO_LOST_REASONS, [
    ["no_trainer_area", "No trainer in their area", "lost_no_trainer_area"],
    ["method_not_a_fit", "Doesn't believe in our training method", "lost_method_not_a_fit"],
    ["dog_not_qualified", "Dog doesn't qualify (health, age, etc.)", "lost_dog_not_qualified"],
    ["competitor", "Went with a competitor", "lost_chose_another_provider"]
  ]);
  assert.deepEqual(M.HARD_NO_LOST_STATUSES, HARD);
  assert.deepEqual(M.ARCHIVE_REASONS.map(([, label]) => label), ["Not ready / money", "Talking it over with family", "Can't reach them", "Other"]);
  assert.deepEqual(M.SOFT_LOST_STATUSES, ["lost_no_response", "lost_price_concern", "lost_not_ready", "lost_client_complaint"]);
  // The trainer portal's literal lists say exactly the same words (the server maps them).
  const trainer = vm.runInNewContext(`${app.match(/const TRAINER_LOST_REASONS = [^\n]*\n/)[0]}${app.match(/const TRAINER_ARCHIVE_REASONS = [^\n]*\n/)[0]}; [TRAINER_LOST_REASONS, TRAINER_ARCHIVE_REASONS]`);
  assert.deepEqual(JSON.parse(JSON.stringify(trainer[0])), M.HARD_NO_LOST_REASONS.map(([k, l]) => [k, l]));
  assert.deepEqual(JSON.parse(JSON.stringify(trainer[1])), M.ARCHIVE_REASONS);
});

test("rule 10: every existing status key/value is unchanged; the two new statuses are ADDED everywhere a status map lives", () => {
  const before = {
    "New Inquiry": "new_inquiry", "Office Contacted": "office_contacted", "Engaged Lead: No Outcome": "engaged_no_outcome",
    "Evaluation Scheduled": "evaluation_scheduled", "Evaluation Cancelled": "evaluation_cancelled", "Evaluation Complete": "evaluation_complete",
    "Became a Client": "became_client", "Lost / No Response": "lost_no_response", "Lost / Price Concern": "lost_price_concern",
    "Lost / Not Ready": "lost_not_ready", "Lost / Chose Another Provider": "lost_chose_another_provider", "Lost: Client Complaint": "lost_client_complaint",
    "Lost: No Trainer in the Area": "lost_no_trainer_area", "Canceled / Refunded": "canceled_refunded", "Canceled / Write off": "canceled_write_off",
    "Bad Lead": "bad_lead", "Do Not Contact": "do_not_contact", "Archived": "archived"
  };
  for (const [label, value] of Object.entries(before)) assert.equal(M.LEAD_STATUS_TO_DB[label], value, label);
  assert.equal(M.LEAD_STATUS_TO_DB["Lost: Doesn't Believe in Our Training Method"], "lost_method_not_a_fit");
  assert.equal(M.LEAD_STATUS_TO_DB["Lost: Dog Doesn't Qualify"], "lost_dog_not_qualified");
  const appMap = vm.runInNewContext(`${app.match(/const leadStatusToDb = \{[\s\S]*?\n\};\n/)[0]}; leadStatusToDb`);
  assert.deepEqual(JSON.parse(JSON.stringify(appMap)), { "Site Visit": "site_visit", ...M.LEAD_STATUS_TO_DB }, "app.js and metrics.js agree");
  const list = vm.runInNewContext(`${app.match(/const leadStatuses = \[[\s\S]*?\n\];\n/)[0]}; leadStatuses`);
  for (const label of ["Lost: Doesn't Believe in Our Training Method", "Lost: Dog Doesn't Qualify"]) assert.ok(list.includes(label), label);
  for (const [file, pattern] of [
    ["api/communications.js", /"lost_method_not_a_fit", "lost_dog_not_qualified"/],
    ["lib/metrics-crosscheck.js", /"lost_method_not_a_fit", "lost_dog_not_qualified"/],
    ["lib/pipeline.js", /"lost_method_not_a_fit", "lost_dog_not_qualified"/],
    ["trainer-backoffice/app.js", /"lost_method_not_a_fit", "lost_dog_not_qualified"\n  \]\)\.has\(lead\.dbStatus/]
  ]) assert.match(read(file), pattern, file);
});

test("both boards + the trainer board put the new statuses in Lost; the Sales board too; nothing else moves", () => {
  for (const label of ["Lost: Doesn't Believe in Our Training Method", "Lost: Dog Doesn't Qualify"]) assert.equal(M.boardStatus(label), "Lost");
  for (const db of NEW) {
    assert.equal(M.trainerStageFor({ dbStatus: db }), "lost", db);
    assert.equal(M.salesStageFor({ dbStatus: db }), "lost", db);
  }
  const rows = NEW.map((db, i) => ({ id: `n${i}`, dbStatus: db, status: M.LEAD_STATUS_FROM_DB[db] }));
  assert.equal(M.lostLeadRows(rows).length, 2, "the Lost tile counts them");
  assert.equal(M.salesStageFor({ dbStatus: "lost_no_trainer_area" }), "winback", "existing Sales bucketing is unchanged (rule 10)");
  assert.equal(M.salesStageFor({ dbStatus: "lost_price_concern" }), "lost");
  const X = require("../lib/metrics-crosscheck.js");
  assert.ok(X);
});

test("the migration adds exactly the two statuses to the CHECK in BOTH schemas and drops nothing else", () => {
  const sql = read("supabase/migrations/20260925130000_lost_hard_no_statuses.sql");
  for (const schema of ["public", "practice"]) {
    const block = sql.slice(sql.indexOf(`alter table ${schema}.leads add constraint`));
    const values = [...block.slice(0, block.indexOf("]::text[]")).matchAll(/'([a-z_]+)'/g)].map(m => m[1]);
    assert.deepEqual(values.slice(-2), NEW, schema);
    assert.equal(values.length, 22, `${schema}: the 20 existing values + 2`);
    for (const value of Object.values(M.LEAD_STATUS_TO_DB)) assert.ok(values.includes(value), `${schema} keeps ${value}`);
  }
  assert.doesNotMatch(sql.replace(/--[^\n]*/g, ""), /\bupdate\b|\bdelete\b/i, "no row is rewritten");
});

test("the daily archive cron never sweeps a hard-no Lost lead into Archived; soft Lost statuses behave as before", async () => {
  const cron = require("../api/cron/archive-leads.js");
  for (const status of [...HARD, "archived", "became_client", "do_not_contact"]) assert.ok(cron.PROTECTED_STATUSES.includes(status), status);
  for (const soft of M.SOFT_LOST_STATUSES) assert.ok(!cron.PROTECTED_STATUSES.includes(soft), `${soft} still archives after 30 days, as today`);
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), method: options.method || "GET" });
    return new Response("[]", { status: 200 });
  };
  const res = { statusCode: 0, body: null, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
  await cron({ headers: { "x-vercel-cron": "1" }, query: { dry: "1" } }, res);
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  const query = decodeURIComponent(calls[0].url);
  assert.match(query, /status=not\.in\.\("archived","became_client","do_not_contact","lost_no_trainer_area","lost_method_not_a_fit","lost_dog_not_qualified","lost_chose_another_provider"\)/);
  assert.equal(calls.filter(c => c.method !== "GET").length, 0, "dry run writes nothing");
});

test("office panel: the Lost list is the four hard no's only; an old free-text reason shows as 'Earlier reason'; archive offers the four maybe-later reasons", () => {
  const ctx = { METRICS: M, escapeHtml, state: {}, leadStatusToDb: M.LEAD_STATUS_TO_DB };
  vm.runInNewContext(`${fn("officeLostOptions")}\n${fn("officeArchiveOptions")}\nthis.fresh = officeLostOptions({ status: "Office Contacted", lostReason: "" });\nthis.old = officeLostOptions({ status: "Lost / No Response", lostReason: "No response" });\nthis.hard = officeLostOptions({ status: "Lost: Dog Doesn't Qualify", lostReason: "Dog doesn't qualify (health, age, etc.)" });\nthis.archive = officeArchiveOptions({ id: "L1" });`, ctx);
  const labels = html => [...html.matchAll(/<option value="([a-z_]+)"[^>]*>([^<]+)</g)].map(m => [m[1], m[2].replace(/&#39;|&apos;/g, "'")]);
  assert.deepEqual(labels(ctx.fresh), M.HARD_NO_LOST_REASONS.map(([k, l]) => [k, l]));
  assert.doesNotMatch(ctx.fresh, /Price|No response|Not ready|Complaint|Schedule conflict|Location issue/);
  assert.match(ctx.old, /<option value="" selected disabled>Earlier reason: No response<\/option>/);
  assert.match(ctx.hard, /<option value="dog_not_qualified" selected>/);
  assert.deepEqual(labels(ctx.archive), M.ARCHIVE_REASONS);
  const panel = fn("leadDetailPanel");
  assert.match(panel, /data-lead-lost-reason="\$\{lead\.id\}">\$\{officeLostOptions\(lead\)\}/);
  assert.match(panel, /Archive \(maybe later\): why\?<select class="select-pill" data-lead-archive-reason/);
  // The pick moves the lead to the mapped Lost status (asked first); the archive click sends archive_reason.
  assert.match(app, /updateLeadRecord\(lostReason\.dataset\.leadLostReason, \{ status: leadStatusFromDb\[reason\[2\]\], lostReason: reason\[1\] \}\)/);
  assert.match(app, /Lost is a hard no: nobody contacts them again\. If they may come back later, use "Archive \(maybe later\)" instead\./);
  assert.match(app, /\.\.\.\(archiveWhy \? \{ archive_reason: archiveWhy\[0\] \} : \{\}\),/);
  assert.doesNotMatch(app, /dropStatus === "Lost" \? "Lost \/ No Response"/, "a drop on the Lost column no longer files 'No Response'");
});

test("trainer panel: Lost (hard no, four reasons) and Archive (maybe later) are two separate picks, one shared note", () => {
  const ctx = { escapeHtml, state: {}, leadStatusLabel: s => s, leadZoneHint: () => "the lead's time zone", datetimeLocalValue: () => "", leadTimeZone: () => "", trainerHandoffBox: () => "", lead: { id: "l1", remoteId: "r1", owner: "Pat", status: "Office Contacted" } };
  vm.runInNewContext(`${app.match(/const TRAINER_LOST_REASONS = [^\n]*\n/)[0]}${app.match(/const TRAINER_ARCHIVE_REASONS = [^\n]*\n/)[0]}${fn("trainerLeadActionsBox")}\nthis.out = trainerLeadActionsBox(lead);`, ctx);
  assert.match(ctx.out, /Lost\? Only a hard no: we won't contact them again<select data-trainer-lost-reason/);
  assert.match(ctx.out, /<option value="method_not_a_fit" >Doesn&#39;t believe in our training method<\/option>|<option value="method_not_a_fit" >Doesn't believe in our training method<\/option>/);
  assert.doesNotMatch(ctx.out, /value="price"|value="no_response"|value="complaint"/);
  assert.match(ctx.out, /Archive \(maybe later\): they may come back<select data-trainer-archive-reason/);
  assert.match(ctx.out, /data-trainer-lead-action="archive"[^>]*>Archive for later<\/button>/);
  const action = fn("trainerLeadAction");
  assert.match(action, /if \(!pick\.archiveReason\) \{ showToast\("Pick why this lead is archived for later\."\); return; \}/);
  assert.match(action, /body\.reason = pick\.archiveReason;/);
});

test("office archive op: an optional reason is merged into raw_payload.archive_reason; no reason = exactly as before; a bad reason is refused", async () => {
  const LEAD = { id: "lead-1", status: "office_contacted", version: 4, updated_at: "2026-09-24T11:00:13Z", raw_payload: { pipeline: { entered_at: "x" }, source_page: "contact.html" } };
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    const method = options.method || "GET";
    const path = String(url).replace(/^https?:\/\/[^/]+/, "");
    const body = options.body ? JSON.parse(options.body) : null;
    calls.push({ method, path, body });
    const json = (status, data) => ({ ok: status < 400, status, text: async () => JSON.stringify(data), json: async () => data, headers: new Headers() });
    if (path.startsWith("/auth/v1/user")) return json(200, { id: "admin-1", email: "rachel@example.test" });
    if (path.startsWith("/rest/v1/portal_users")) return json(200, [{ user_id: "admin-1", role: "admin", permission_level: "office_admin", active: true, access_status: "active", email: "rachel@example.test", display_name: "Rachel" }]);
    if (path.startsWith("/rest/v1/leads") && method === "GET") return json(200, [LEAD]);
    if (path.startsWith("/rest/v1/leads") && method === "PATCH") return json(200, [{ ...LEAD, ...body, version: 5 }]);
    if (method === "POST") return json(201, []);
    return json(200, []);
  };
  delete process.env.LDTT_SANDBOX;
  const handler = require("../api/operational-mutation.js");
  const call = async body => {
    const res = { statusCode: 0, payload: null, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.statusCode = c; return this; }, json(d) { this.payload = d; return this; }, end() { return this; } };
    await handler({ method: "POST", headers: { authorization: "Bearer t" }, body }, res);
    return res;
  };
  const withReason = await call({ operation: "archive", entity_type: "lead", id: "lead-1", expected_version: 4, archive_reason: "unreachable", summary: "x" });
  assert.equal(withReason.statusCode, 200, JSON.stringify(withReason.payload));
  const patch = calls.find(c => c.method === "PATCH").body;
  assert.equal(patch.status, "archived");
  assert.deepEqual(patch.raw_payload.pipeline, { entered_at: "x" }, "the rest of raw_payload is kept");
  assert.deepEqual([patch.raw_payload.archive_reason.reason, patch.raw_payload.archive_reason.label, patch.raw_payload.archive_reason.by, patch.raw_payload.archive_reason.by_name], ["unreachable", "Can't reach them", "office", "Rachel"]);
  calls.length = 0;
  const plain = await call({ operation: "archive", entity_type: "lead", id: "lead-1", expected_version: 4, summary: "x" });
  assert.equal(plain.statusCode, 200);
  assert.deepEqual(Object.keys(calls.find(c => c.method === "PATCH").body).sort(), ["archived_at", "archived_by", "status"], "the quick Archive button writes exactly what it always wrote");
  calls.length = 0;
  const bad = await call({ operation: "archive", entity_type: "lead", id: "lead-1", expected_version: 4, archive_reason: "competitor" });
  assert.equal(bad.statusCode, 400);
  assert.equal(calls.filter(c => c.method === "PATCH").length, 0);
});

test("the pipeline's automatic follow-ups stop on every real Lost status (the old list had wrong names)", () => {
  const P = require("../lib/pipeline.js");
  const base = { sms_consent: true, raw_payload: { pipeline: { entered_at: new Date(Date.now() - 3 * 3600000).toISOString(), new_lead_text: { status: "sent" } } } };
  assert.ok(P.autoFollowUpDue({ ...base, status: "new_inquiry" }).length > 0, "an open lead is still due");
  for (const status of [...HARD, ...M.SOFT_LOST_STATUSES]) assert.deepEqual(P.autoFollowUpDue({ ...base, status }), [], status);
});
