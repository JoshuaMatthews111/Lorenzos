// Same-state team (Joshua 2026-09-16): "put those who are in the same state in their downline" until the MLM tree
// is known. api/trainer-lead-action.js: GET ?team=1 lists the downline (active trainers in the same state, Ohio == OH,
// drafts and self left out); action "handoff" moves a lead to a teammate in that downline and nowhere else.
// Run: node --test tests/
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
  { user_id: "u-other", role: "trainer", permission_level: "trainer", trainer_id: "t-2", active: true, access_status: "active", email: "other@example.com", first_name: "Dana", last_name: "Columbus" },
  { user_id: "u-texas", role: "trainer", permission_level: "trainer", trainer_id: "t-3", active: true, access_status: "active", email: "tex@example.com", first_name: "Tex", last_name: "Austin" },
  { user_id: "u-office", role: "admin", permission_level: "office_admin", active: true, access_status: "active", email: "angela@example.com", first_name: "Angela", last_name: "Office" }
];
// The practice trainers table: full names and codes mixed on purpose ("Ohio" == "OH"), a draft, an inactive row.
const TRAINERS = [
  { id: "t-1", full_name: "Harley McGrew", market: "Cleveland, OH", state: "Ohio", base_zip: "44101", slug: "harley-mcgrew", status: "active" },
  { id: "t-2", full_name: "Dana Columbus", market: "Columbus, OH", state: "OH", base_zip: "43201", slug: "dana-columbus", status: "active" },
  { id: "t-3", full_name: "Tex Austin", market: "Austin, TX", state: "Texas", base_zip: "78701", slug: "tex-austin", status: "active" },
  { id: "t-4", full_name: "New Trainer Draft", market: "", state: "State Pending", base_zip: "", slug: "new-trainer-draft", status: "active" },
  { id: "t-5", full_name: "Retired Ohioan", market: "Toledo, OH", state: "ohio", base_zip: "43601", slug: "retired-ohioan", status: "inactive" },
  { id: "t-6", full_name: "Pat Dayton", market: "Dayton, OH", state: " oh ", base_zip: "45401", slug: "pat-dayton", status: "active" },
  { id: "t-7", full_name: "Sam Houston", market: "Houston, TX", state: "TX", base_zip: "77001", slug: "sam-houston", status: "active" },
  // 2026-09-22: practice test rows and office drafts still marked active never show in the downline.
  { id: "t-8", full_name: "O'Brien Test 🐶 mto7wcs1", market: "Cleveland, OH", state: "Ohio", base_zip: "44101", slug: "o-brien-test-mto7wcs1", status: "active" },
  { id: "t-9", full_name: "Test Trainer Ohio", market: "Akron, OH", state: "OH", base_zip: "44301", slug: "test-trainer-ohio", status: "active" },
  { id: "t-10", full_name: "Office Draft", market: "Akron, OH", state: "OH", base_zip: "44301", slug: "office-draft-1788965328468", status: "active" }
];
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function world(status = "office_contacted", extra = {}) {
  const id = randomUUID();
  const store = {
    portal_users: USERS.map(u => ({ ...u })),
    trainers: TRAINERS.map(t => ({ ...t })),
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

const makeRes = () => ({ statusCode: 200, body: null, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(code) { this.statusCode = code; return this; }, json(p) { this.body = p; return this; }, end() { return this; } });

async function post(body, token = "u-trainer-token") {
  const res = makeRes();
  await handler({ method: "POST", headers: token ? { authorization: `Bearer ${token}` } : {}, body, query: {} }, res);
  return res;
}

async function get(query, token = "u-trainer-token") {
  const res = makeRes();
  await handler({ method: "GET", headers: token ? { authorization: `Bearer ${token}` } : {}, body: null, query }, res);
  return res;
}

test("GET ?team=1: the downline is every ACTIVE trainer in the same state (Ohio == OH), drafts and self left out", async () => {
  world();
  const res = await get({ team: "1" });
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(res.body.state, "OH");
  assert.equal(res.body.trainer_id, "t-1");
  assert.deepEqual(res.body.trainers.map(t => t.id), ["t-2", "t-6"], "Columbus (OH) and Dayton (' oh ') are in; Texas, the draft, the inactive row and Harley herself are out");
  assert.deepEqual(Object.keys(res.body.trainers[0]), ["id", "full_name", "market", "state", "base_zip", "slug"]);
  assert.deepEqual(res.body.trainers[0], { id: "t-2", full_name: "Dana Columbus", market: "Columbus, OH", state: "OH", base_zip: "43201", slug: "dana-columbus" });

  const texas = await get({ team: "1" }, "u-texas-token");
  assert.deepEqual(texas.body.trainers.map(t => t.id), ["t-7"], "a Texas trainer sees only Texas");
  assert.equal(texas.body.state, "TX");

  const spoof = await get({ team: "1", trainer_id: "t-3" });
  assert.deepEqual(spoof.body.trainers.map(t => t.id), ["t-2", "t-6"], "a trainer cannot look at another trainer's downline");
  const office = await get({ team: "1", trainer_id: "t-3" }, "u-office-token");
  assert.equal(office.statusCode, 200, JSON.stringify(office.body));
  assert.deepEqual(office.body.trainers.map(t => t.id), ["t-7"], "the office may pass trainer_id");
  assert.equal((await get({ team: "1" }, "u-office-token")).statusCode, 400, "the office must say which trainer");
  assert.equal((await get({}, "u-trainer-token")).statusCode, 400, "GET without ?team=1 is not a thing");
  assert.notEqual((await get({ team: "1" }, "")).statusCode, 200, "no token, no team");
});

test("handoff across states is refused (403) and writes nothing", async () => {
  const w = world();
  const res = await post({ action: "handoff", lead_id: w.id, to_trainer_id: "t-3", expected_version: 3 });
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.message, "Only a trainer in your state can take this lead.");
  for (const bad of ["t-4", "t-5", "nobody"]) {
    assert.equal((await post({ action: "handoff", lead_id: w.id, to_trainer_id: bad })).statusCode, 403, `${bad}: drafts, inactive and unknown trainers are not in the downline`);
  }
  assert.equal(w.store.leads[0].trainer_id, "t-1");
  assert.equal(w.writes.length, 0, "nothing was written");
});

test("handoff to a same-state teammate: only trainer_id is in the PATCH, version guarded, logged like the other actions", async () => {
  const w = world("evaluation_scheduled");
  const res = await post({ action: "handoff", lead_id: w.id, to_trainer_id: "t-2", expected_version: 3, note: "Closer to her" });
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(res.body.message, "Handed off to Dana Columbus.");
  assert.deepEqual(res.body.record, { id: w.id, trainer_id: "t-2", trainer_name: "Dana Columbus", status: "evaluation_scheduled", version: 4 });
  assert.equal(w.store.leads[0].trainer_id, "t-2");
  assert.equal(w.store.leads[0].status, "evaluation_scheduled", "the status is untouched");
  assert.equal(w.store.leads[0].version, 4, "the version moved on");
  const patch = w.writes.find(x => x.table === "leads");
  assert.deepEqual(Object.keys(patch.body), ["trainer_id"], "no other lead field is written (rule 83)");
  assert.equal(w.writes.filter(x => x.table === "leads").length, 1);

  const audit = w.store.audit_events[0];
  assert.equal(audit.action, "trainer_lead_handoff");
  assert.equal(audit.summary, "Handed off to Dana Columbus (same-state team). Note: Closer to her");
  assert.equal(audit.actor_email, "harley@example.com");
  assert.deepEqual(audit.before_data, { trainer_id: "t-1", status: "evaluation_scheduled" });
  assert.equal(audit.after_data.trainer_id, "t-2");
  assert.equal(w.store.lifecycle_events.length, 0, "no funnel word fits a handoff");
  const event = w.store.lead_events[0];
  assert.equal(event.event_type, "trainer_handoff");
  assert.equal(event.lead_id, w.id);
  assert.equal(event.note, "Closer to her");
  assert.deepEqual([event.raw_payload.from_trainer_id, event.raw_payload.to_trainer_id, event.raw_payload.by], ["t-1", "t-2", "trainer"]);

  // The lead left Harley: she can no longer act on it; Dana (now assigned) can hand it back within Ohio.
  assert.equal((await post({ action: "handoff", lead_id: w.id, to_trainer_id: "t-6" })).statusCode, 403);
  const back = await post({ action: "handoff", lead_id: w.id, to_trainer_id: "t-1" }, "u-other-token");
  assert.equal(back.statusCode, 200, JSON.stringify(back.body));
  assert.equal(w.store.leads[0].trainer_id, "t-1");
});

test("the trainer-name column is written only when the leads row has one; the office may hand off too", async () => {
  const named = world("office_contacted", { assigned_trainer_name: "Harley McGrew" });
  const res = await post({ action: "handoff", lead_id: named.id, to_trainer_id: "t-2" });
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  const patch = named.writes.find(x => x.table === "leads");
  assert.deepEqual(patch.body, { trainer_id: "t-2", assigned_trainer_name: "Dana Columbus" });

  const office = world();
  const ok = await post({ action: "handoff", lead_id: office.id, to_trainer_id: "t-6" }, "u-office-token");
  assert.equal(ok.statusCode, 200, JSON.stringify(ok.body));
  assert.equal(office.store.leads[0].trainer_id, "t-6");
  assert.equal(office.store.lead_events[0].raw_payload.by, "office");
  const cross = await post({ action: "handoff", lead_id: office.id, to_trainer_id: "t-3" }, "u-office-token");
  assert.equal(cross.statusCode, 403, "even the office keeps a handoff inside the lead's state; cross-state moves stay with the office's own assign tools");
});

test("bad input writes nothing: missing teammate, same trainer, stale version, another trainer's lead", async () => {
  const w = world();
  assert.equal((await post({ action: "handoff", lead_id: w.id })).statusCode, 400);
  assert.equal((await post({ action: "handoff", lead_id: w.id, to_trainer_id: "t-1" })).statusCode, 409, "already with that trainer");
  assert.equal((await post({ action: "handoff", lead_id: w.id, to_trainer_id: "t-2", expected_version: 1 })).statusCode, 409, "stale version");
  assert.equal((await post({ action: "handoff", lead_id: w.id, to_trainer_id: "t-1" }, "u-other-token")).statusCode, 403, "not their lead");
  assert.equal((await post({ action: "handoff", lead_id: "not-an-id", to_trainer_id: "t-2" })).statusCode, 400);
  assert.equal(w.writes.length, 0, "nothing was written");
  assert.equal(w.store.leads[0].trainer_id, "t-1");
});

test("the portal offers it to trainers: team loaded once from the GET, a Hand off control, and the team panel", () => {
  const app = read("trainer-backoffice/app.js");
  assert.match(app, /fetch\("\/api\/trainer-lead-action\?team=1"/, "the downline comes from the GET");
  assert.match(app, /let trainerTeam = null;/, "cached once per session in a module variable");
  assert.match(app, /data-trainer-lead-action="handoff"/, "the Hand off button");
  assert.match(app, /data-trainer-handoff-to/, "the teammate list");
  assert.match(app, /\$\{stage === "sold" \? "" : trainerHandoffBox\(lead, "card"\)\}/, "on each open trainer lead card");
  assert.match(app, /\$\{trainerTeamPanel\(\)\}/, "the dashboard panel");
  assert.match(app, /Your downline for now is every Lorenzo's trainer in your state\. The office can change this later\./);
  assert.match(app, /showToast\(`Handed off to \$\{teammate\.full_name\}`\)/);
  assert.match(app, /if \(session\.role === "admin" \|\| !lead\?\.remoteId\) return "";/, "trainer role only");
  const api = read("api/trainer-lead-action.js");
  assert.match(api, /require\("\.\.\/lib\/sandbox"\)/, "rule 5: every table call through supabaseRequest");
  assert.doesNotMatch(api, /\/auth\/v1\/user/, "sign-in is checked only by lib/portal-auth (rule 37)");
});
