// Rule 83 (Joshua 2026-09-14, option A): trainers mark THEIR OWN leads Eval completed / Lost (with a reason) /
// Added to Alpha through api/trainer-lead-action.js, logged like an office change. Run: node --test tests/
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
process.env.SUPABASE_URL = "http://supabase.test";
process.env.LDTT_SANDBOX = "";
const handler = require("../api/trainer-lead-action.js");
const read = path => readFileSync(resolve(import.meta.dirname, "..", path), "utf8");

const USERS = [
  { user_id: "u-trainer", role: "trainer", permission_level: "trainer", trainer_id: "t-1", active: true, access_status: "active", email: "harley@example.com", first_name: "Harley", last_name: "McGrew" },
  { user_id: "u-other", role: "trainer", permission_level: "trainer", trainer_id: "t-2", active: true, access_status: "active", email: "other@example.com" },
  { user_id: "u-office", role: "admin", permission_level: "office_admin", active: true, access_status: "active", email: "angela@example.com", first_name: "Angela", last_name: "Office" }
];
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function world(status = "evaluation_scheduled", extra = {}) {
  const id = randomUUID();
  const store = {
    portal_users: USERS.map(u => ({ ...u })),
    leads: [{ id, trainer_id: "t-1", status, version: 3, added_to_alpha: false, first_name: "Priya", trainer_market: "Cleveland, OH", raw_payload: {}, ...extra }],
    audit_events: [], lifecycle_events: [], lead_events: []
  };
  const writes = [];
  const pick = (rows, params) => {
    let out = rows;
    for (const [key, raw] of params) {
      if (["select", "order", "limit", "on_conflict"].includes(key)) continue;
      const [op, ...rest] = raw.split("."); const value = rest.join(".");
      if (op === "eq") out = out.filter(r => String(r[key]) === value);
    }
    return out;
  };
  globalThis.fetch = async (url, options = {}) => {
    const u = new URL(url);
    const method = (options.method || "GET").toUpperCase();
    const headers = options.headers || {};
    if (u.pathname === "/auth/v1/user") {
      const token = String(headers.Authorization || headers.authorization || "").replace(/^Bearer\s+/, "");
      const pu = USERS.find(p => `${p.user_id}-token` === token);
      return pu ? json(200, { id: pu.user_id, email: pu.email }) : json(401, { message: "bad token" });
    }
    const table = u.pathname.replace("/rest/v1/", "");
    if (!store[table]) return method === "GET" ? json(200, []) : json(404, {});
    const body = options.body ? JSON.parse(options.body) : null;
    if (method === "GET") return json(200, pick(store[table], u.searchParams));
    writes.push({ table, method, body });
    if (method === "POST") { const rows = (Array.isArray(body) ? body : [body]).map(r => ({ id: randomUUID(), ...r })); store[table].push(...rows); return json(201, rows); }
    if (method === "PATCH") { const hits = pick(store[table], u.searchParams); hits.forEach(r => { Object.assign(r, body); if (table === "leads") r.version += 1; }); return json(200, hits); }
    return json(405, {});
  };
  return { store, writes, id };
}

async function call(body, token = "u-trainer-token") {
  const res = { statusCode: 200, body: null, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(code) { this.statusCode = code; return this; }, json(p) { this.body = p; return this; }, end() { return this; } };
  await handler({ method: "POST", headers: token ? { authorization: `Bearer ${token}` } : {}, body, query: {} }, res);
  return res;
}

test("eval completed: only from Evaluation Scheduled; logged like an office change (audit + funnel + status event)", async () => {
  const w = world();
  const res = await call({ action: "eval_completed", lead_id: w.id, expected_version: 3 });
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(w.store.leads[0].status, "evaluation_complete");
  assert.equal(w.store.audit_events[0].action, "trainer_lead_eval_completed");
  assert.equal(w.store.audit_events[0].actor_email, "harley@example.com");
  assert.equal(w.store.lifecycle_events[0].event_type, "evaluation_completed", "the funnel counts it like an office change");
  assert.deepEqual([w.store.lead_events[0].previous_status, w.store.lead_events[0].new_status], ["evaluation_scheduled", "evaluation_complete"]);
  const patch = w.writes.find(x => x.table === "leads");
  assert.deepEqual(Object.keys(patch.body), ["status"], "no other lead field is written");
  const again = await call({ action: "eval_completed", lead_id: w.id });
  assert.equal(again.statusCode, 409, "a lead that is not Evaluation Scheduled cannot be marked");
});

test("lost (Zoom 2026-09-24): ONLY the four hard-no reasons, each to its status + plain words; the old soft reasons now say Archive; a closed lead is refused", async () => {
  const none = world("office_contacted");
  assert.equal((await call({ action: "lost", lead_id: none.id })).statusCode, 400);
  for (const [reason, status, words] of [
    ["no_trainer_area", "lost_no_trainer_area", "No trainer in their area"],
    ["method_not_a_fit", "lost_method_not_a_fit", "Doesn't believe in our training method"],
    ["dog_not_qualified", "lost_dog_not_qualified", "Dog doesn't qualify (health, age, etc.)"],
    ["competitor", "lost_chose_another_provider", "Went with a competitor"],
    ["other_provider", "lost_chose_another_provider", "Went with a competitor"]
  ]) {
    const w = world("office_contacted");
    const ok = await call({ action: "lost", lead_id: w.id, reason, note: "Told us on the phone" });
    assert.equal(ok.statusCode, 200, `${reason}: ${JSON.stringify(ok.body)}`);
    assert.equal(w.store.leads[0].status, status, reason);
    assert.equal(w.store.leads[0].lost_reason, words, reason);
    assert.deepEqual(Object.keys(w.writes.find(x => x.table === "leads").body), ["status", "lost_reason"]);
    assert.equal(w.store.lifecycle_events.length, 0, "a hard no is not a funnel event");
    assert.equal(w.store.lead_events[0].note, "Told us on the phone");
    assert.match(w.store.audit_events[0].summary, new RegExp(`lost: ${words.replace(/[().]/g, "\\$&")}\\. Note: Told us on the phone`));
  }
  for (const soft of ["price", "not_ready", "no_response", "complaint"]) {
    const w = world("office_contacted");
    const res = await call({ action: "lost", lead_id: w.id, reason: soft });
    assert.equal(res.statusCode, 400, soft);
    assert.match(res.body.message, /Archive \(maybe later\)/);
    assert.equal(w.writes.length, 0);
  }
  for (const closed of ["became_client", "do_not_contact", "archived", "lost_not_ready", "lost_dog_not_qualified", "lost_method_not_a_fit"]) {
    const w = world(closed);
    assert.equal((await call({ action: "lost", lead_id: w.id, reason: "competitor" })).statusCode, 409, closed);
    assert.equal(w.writes.length, 0);
  }
});

test("archive (maybe later): archived + archived_at + raw_payload.archive_reason, kept restorable; soft reasons only; closed refused", async () => {
  const w = world("engaged_no_outcome", { raw_payload: { pipeline: { entered_at: "2026-09-20T00:00:00Z" }, source_page: "contact.html" } });
  const res = await call({ action: "archive", lead_id: w.id, reason: "family", note: "Talking to her husband", expected_version: 3 });
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(res.body.message, "Archived for later. The office sees it and can bring it back.");
  const row = w.store.leads[0];
  assert.equal(row.status, "archived");
  assert.ok(row.archived_at);
  assert.deepEqual(row.raw_payload.pipeline, { entered_at: "2026-09-20T00:00:00Z" }, "the rest of raw_payload is kept");
  assert.equal(row.raw_payload.source_page, "contact.html");
  assert.deepEqual([row.raw_payload.archive_reason.reason, row.raw_payload.archive_reason.label, row.raw_payload.archive_reason.note, row.raw_payload.archive_reason.by], ["family", "Talking it over with family", "Talking to her husband", "trainer"]);
  assert.deepEqual(Object.keys(w.writes.find(x => x.table === "leads").body).sort(), ["archived_at", "raw_payload", "status"]);
  assert.equal(w.store.audit_events[0].action, "trainer_lead_archive");
  assert.deepEqual([w.store.lead_events[0].previous_status, w.store.lead_events[0].new_status], ["engaged_no_outcome", "archived"]);
  for (const [reason, label] of [["not_ready_money", "Not ready / money"], ["unreachable", "Can't reach them"], ["other", "Other"]]) {
    const x = world("new_inquiry");
    assert.equal((await call({ action: "archive", lead_id: x.id, reason })).statusCode, 200, reason);
    assert.equal(x.store.leads[0].raw_payload.archive_reason.label, label);
  }
  const bad = world("new_inquiry");
  assert.equal((await call({ action: "archive", lead_id: bad.id, reason: "competitor" })).statusCode, 400, "a hard no is Lost, not Archive");
  assert.equal((await call({ action: "archive", lead_id: bad.id })).statusCode, 400);
  for (const closed of ["became_client", "archived", "lost_no_trainer_area"]) {
    const x = world(closed);
    assert.equal((await call({ action: "archive", lead_id: x.id, reason: "family" })).statusCode, 409, closed);
  }
  const other = world("new_inquiry");
  assert.equal((await call({ action: "archive", lead_id: other.id, reason: "family" }, "u-other-token")).statusCode, 403, "only the trainer it is assigned to");
  assert.equal(bad.writes.length + other.writes.length, 0);
});

test("added to Alpha: yes / no, no status change, audited", async () => {
  const w = world("evaluation_complete");
  const yes = await call({ action: "alpha", lead_id: w.id, value: true });
  assert.equal(yes.statusCode, 200);
  assert.equal(w.store.leads[0].added_to_alpha, true);
  assert.equal(w.store.leads[0].status, "evaluation_complete");
  assert.equal(w.store.lead_events.length, 0);
  assert.equal(w.store.audit_events[0].action, "trainer_lead_alpha");
  await call({ action: "alpha", lead_id: w.id, value: false });
  assert.equal(w.store.leads[0].added_to_alpha, false);
  // Joshua 2026-09-23: the trainer can clear the answer back to BLANK (null) - "not answered yet" is not "No".
  await call({ action: "alpha", lead_id: w.id, value: null });
  assert.equal(w.store.leads[0].added_to_alpha, null);
  await call({ action: "alpha", lead_id: w.id, value: "yes" });
  assert.equal(w.store.leads[0].added_to_alpha, null, "only a real boolean answers the question; anything else is blank");
});

test("the portal asks the question in plain words, blank first", async () => {
  const { readFileSync } = await import("node:fs");
  const app = readFileSync(new URL("../trainer-backoffice/app.js", import.meta.url), "utf8");
  assert.ok(app.includes("Have you logged this lead in Alpha?"), "the trainer sees the question, not a toggle");
  assert.ok(app.includes('<option value=""${alphaAnswer === "" ? " selected" : ""}>Pick Yes or No</option>'), "blank option first, selected until the trainer answers");
  assert.ok(app.includes("Yes, it is logged in Alpha") && app.includes("No, not yet"), "Yes and No are spelled out");
});

test("only the trainer the lead is assigned to (or the office); stale versions and bad input write nothing", async () => {
  const w = world();
  assert.equal((await call({ action: "eval_completed", lead_id: w.id }, "u-other-token")).statusCode, 403);
  assert.notEqual((await call({ action: "eval_completed", lead_id: w.id }, "")).statusCode, 200, "no token, no change");
  assert.equal((await call({ action: "eval_completed", lead_id: w.id, expected_version: 1 })).statusCode, 409);
  assert.equal((await call({ action: "delete", lead_id: w.id })).statusCode, 400);
  assert.equal((await call({ action: "alpha", lead_id: "not-an-id" })).statusCode, 400);
  assert.equal(w.writes.length, 0, "nothing was written");
  const office = await call({ action: "eval_completed", lead_id: w.id }, "u-office-token");
  assert.equal(office.statusCode, 200, "the office may do it too");
});

test("the door is the trainer's own (rule 7) and uses the schema switch (rule 5); the panel offers it", () => {
  const src = read("api/trainer-lead-action.js");
  assert.match(src, /require\("\.\.\/lib\/sandbox"\)/);
  assert.match(src, /const target = supabaseRequest\(path, options\.headers \|\| \{\}\);/);
  assert.match(src, /String\(before\.trainer_id \|\| ""\) !== String\(access\.trainerId \|\| ""\)/);
  assert.doesNotMatch(src, /\/auth\/v1\/user/, "sign-in is checked only by lib/portal-auth (rule 37)");
  const app = read("trainer-backoffice/app.js");
  assert.match(app, /\$\{trainerLeadActionsBox\(lead\)\}/);
  assert.match(app, /fetch\("\/api\/trainer-lead-action"/);
});

// Rachel 2026-09-24: "Mark contacted". A trainer moves their OWN New Inquiry lead to office_contacted
// (shown as "Office/Trainer Contacted"). Only from new_inquiry: on the office Leads board "Engaged Lead: No
// Outcome" comes AFTER "Office Contacted", so an engaged lead would move backwards. Same door, same guards.
test("contacted: New Inquiry -> office_contacted, logged like an office change, nothing else written", async () => {
  const w = world("new_inquiry");
  const res = await call({ action: "contacted", lead_id: w.id, expected_version: 3 });
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(w.store.leads[0].status, "office_contacted", "the DB value is the unchanged status key (rule 10)");
  assert.equal(res.body.message, "Marked contacted. The office sees it.");
  const patch = w.writes.find(x => x.table === "leads");
  assert.deepEqual(patch.body, { status: "office_contacted" }, "no other lead field is written");
  assert.equal(w.store.audit_events[0].action, "trainer_lead_contacted");
  assert.equal(w.store.audit_events[0].actor_email, "harley@example.com");
  assert.deepEqual([w.store.audit_events[0].before_data.status, w.store.audit_events[0].after_data.status], ["new_inquiry", "office_contacted"]);
  assert.deepEqual([w.store.lead_events[0].event_type, w.store.lead_events[0].previous_status, w.store.lead_events[0].new_status], ["status_changed", "new_inquiry", "office_contacted"]);
  assert.equal(w.store.lifecycle_events.length, 0, "office_contacted is not a funnel step, exactly like an office change");
  assert.deepEqual(w.writes.map(x => x.table).sort(), ["audit_events", "lead_events", "leads"], "no text, no email, no other table");
});

test("contacted: refused (409, plain words, nothing written) from every status other than New Inquiry", async () => {
  for (const status of ["office_contacted", "engaged_no_outcome", "follow_up_call_needed", "evaluation_scheduled", "evaluation_complete", "became_client", "lost_price_concern", "do_not_contact", "archived"]) {
    const w = world(status);
    const res = await call({ action: "contacted", lead_id: w.id });
    assert.equal(res.statusCode, 409, status);
    assert.match(res.body.message, /Only a New Inquiry lead can be marked contacted/);
    assert.equal(w.writes.length, 0, `${status}: nothing written`);
    assert.equal(w.store.leads[0].status, status);
  }
});

test("contacted: another trainer is refused (403) and a stale version is refused (409); nothing written", async () => {
  const other = world("new_inquiry");
  assert.equal((await call({ action: "contacted", lead_id: other.id }, "u-other-token")).statusCode, 403);
  assert.equal(other.writes.length, 0);
  const stale = world("new_inquiry");
  const res = await call({ action: "contacted", lead_id: stale.id, expected_version: 2 });
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.conflict, true);
  assert.equal(stale.writes.length, 0);
  assert.equal(stale.store.leads[0].status, "new_inquiry");
  assert.equal((await call({ action: "contacted", lead_id: stale.id }, "")).statusCode === 200, false, "no token, no change");
});
