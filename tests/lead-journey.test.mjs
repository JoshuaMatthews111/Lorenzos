// Lead journey TEST flow (Joshua 2026-09-11): api/lead-journey.js against a fake Supabase and
// a fake Twilio. Nothing here talks to the real project or sends a real text.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
process.env.SUPABASE_URL = "http://supabase.test";
process.env.TWILIO_ACCOUNT_SID = "ACtest";
process.env.TWILIO_AUTH_TOKEN = "test-token";
process.env.TWILIO_FROM_NUMBER = "+18885550100";
const require = createRequire(import.meta.url);
const J = require("../lib/lead-journey.js");

const ADMIN_USER = { id: "admin-1", email: "office@example.test" };
const ADMIN_ROW = { user_id: "admin-1", role: "admin", permission_level: "super_admin", active: true, access_status: "active", email: "office@example.test", display_name: "Office Login" };
const TESTERS = [
  { id: "t-josh", display_name: "Joshua", phone: "(440) 555-0101", active: true },
  { id: "t-tim", display_name: "Tim", phone: "440-555-0102", active: true },
  { id: "t-off", display_name: "Old tester", phone: "440-555-0199", active: false }
];

function fakeWorld({ beforeClaim } = {}) {
  const db = { lead_journeys: [], journey_messages: [], communications_testers: TESTERS.map(t => ({ ...t })) };
  const texts = [];
  let n = 0;
  const filtersOf = query => [...new URLSearchParams(query)].filter(([k]) => !["select", "order", "limit"].includes(k));
  const match = (row, filters) => filters.every(([col, expr]) => {
    const dot = expr.indexOf(".");
    const op = expr.slice(0, dot), val = expr.slice(dot + 1);
    const v = row[col] == null ? null : String(row[col]);
    if (op === "eq") return v === val;
    if (op === "in") return val.replace(/^\(|\)$/g, "").split(",").includes(v);
    if (op === "lte") return v != null && v <= val;
    if (op === "gte") return v != null && v >= val;
    throw new Error(`fake: unsupported filter ${op}`);
  });
  global.fetch = async (url, options = {}) => {
    const method = options.method || "GET";
    const json = (status, data) => ({ ok: status < 400, status, text: async () => JSON.stringify(data), json: async () => data, headers: new Headers() });
    if (String(url).includes("api.twilio.com")) {
      const form = new URLSearchParams(options.body);
      texts.push({ to: form.get("To"), from: form.get("From"), body: form.get("Body") });
      return json(201, { sid: `SM${texts.length}` });
    }
    const path = String(url).replace(/^https?:\/\/[^/]+/, "");
    const [base, query = ""] = path.split("?");
    const body = options.body ? JSON.parse(options.body) : null;
    if (base.startsWith("/auth/v1/user")) return json(200, ADMIN_USER);
    if (base === "/rest/v1/portal_users") return json(200, [ADMIN_ROW]);
    const table = base.replace("/rest/v1/", "");
    if (!db[table]) throw new Error(`fake: unexpected call ${method} ${path}`);
    const filters = filtersOf(query);
    if (method === "GET") return json(200, db[table].filter(row => match(row, filters)));
    if (method === "POST") {
      const rows = (Array.isArray(body) ? body : [body]).map(row => ({ id: `id-${++n}`, status: table === "journey_messages" ? "scheduled" : undefined, created_at: new Date().toISOString(), ...row }));
      db[table].push(...rows);
      return json(201, rows);
    }
    if (method === "PATCH") {
      if (beforeClaim && body.status === "sending") beforeClaim(db);
      const hit = db[table].filter(row => match(row, filters));
      hit.forEach(row => Object.assign(row, body));
      return json(200, hit);
    }
    throw new Error(`fake: unexpected method ${method}`);
  };
  return { db, texts };
}

function load(sandbox) {
  delete require.cache[require.resolve("../api/lead-journey.js")];
  delete require.cache[require.resolve("../lib/sandbox.js")];
  if (sandbox) process.env.LDTT_SANDBOX = "1"; else delete process.env.LDTT_SANDBOX;
  return require("../api/lead-journey.js");
}
async function call(handler, { method = "POST", body = null, auth = true } = {}) {
  const res = { statusCode: 0, payload: null, status(c) { this.statusCode = c; return this; }, json(d) { this.payload = d; return this; }, setHeader() {}, end() { return this; } };
  await handler({ method, query: {}, body, headers: auth ? { authorization: "Bearer fake-token" } : {} }, res);
  return res;
}
const START = { operation: "start", first_name: "Sam", last_name: "Test", zip: "44105", problem: "Pulling on the leash", dog_name: "Max", customer_tester: "t-josh", trainer_tester: "t-tim", speed: "fast" };

test("the test flow does not exist on live (404) and needs an admin login on the practice copy", async () => {
  fakeWorld();
  assert.equal((await call(load(false), { body: START })).statusCode, 404);
  assert.equal((await call(load(true), { body: START, auth: false })).statusCode, 403);
});

test("a Cleveland ZIP routes to the Cleveland trainers and texts the booking link to the customer tester only", async () => {
  const { db, texts } = fakeWorld();
  const res = await call(load(true), { body: START });
  assert.equal(res.statusCode, 200, JSON.stringify(res.payload));
  const journey = db.lead_journeys[0];
  assert.equal(journey.market_name, "Cleveland");
  assert.equal(journey.primary_trainer, "Eric Beck");
  assert.equal(journey.backup_trainer, "John DelBane");
  assert.deepEqual(db.journey_messages.map(m => m.template_key), ["LDTT_Lead_Booking_Link", "LDTT_Unanswered_24Hr", "LDTT_Unanswered_72Hr"]);
  assert.equal(texts.length, 1);
  assert.equal(texts[0].to, "+14405550101");
  assert.ok(texts[0].body.startsWith("[LDTT TEST] Hi Sam, this is Lorenzo’s Dog Training Team."));
  assert.ok(!/\{\{/.test(texts[0].body), "no unfilled {{fields}}");
  assert.deepEqual(db.journey_messages.map(m => m.status), ["sent", "scheduled", "scheduled"]);
});

test("Cleveland Heights ZIPs go to Harley McGrew first", async () => {
  const { db } = fakeWorld();
  await call(load(true), { body: { ...START, zip: "44118" } });
  assert.equal(db.lead_journeys[0].primary_trainer, "Harley McGrew");
});

test("booking stops the unanswered follow-ups, confirms to the customer and alerts the trainer tester", async () => {
  const { db, texts } = fakeWorld();
  const handler = load(true);
  await call(handler, { body: START });
  const id = db.lead_journeys[0].id;
  const res = await call(handler, { body: { operation: "action", journey_id: id, action: "book" } });
  assert.equal(res.statusCode, 200, JSON.stringify(res.payload));
  const byKey = key => db.journey_messages.find(m => m.template_key === key);
  assert.equal(byKey("LDTT_Unanswered_24Hr").status, "cancelled");
  assert.equal(byKey("LDTT_Booking_Confirmation").status, "sent");
  assert.equal(byKey("LDTT_Trainer_New_Eval").status, "sent");
  assert.equal(byKey("LDTT_Customer_24Hr_Reminder").status, "scheduled");
  const trainerText = texts.find(t => t.body.includes("NEW LDTT EVALUATION"));
  assert.equal(trainerText.to, "+14405550102");
  assert.ok(texts.find(t => t.body.includes("you’re confirmed with Eric")));
  const contacted = await call(handler, { body: { operation: "action", journey_id: id, action: "contacted" } });
  assert.equal(contacted.statusCode, 200);
  assert.equal(byKey("LDTT_Trainer_Contact_Reminder").status, "cancelled");
  assert.equal(byKey("LDTT_Escalation_Market_Leader").status, "cancelled");
  assert.equal(byKey("LDTT_Customer_24Hr_Reminder").status, "scheduled", "reminders stay after contact");
});

test("a number that is not an active tester is never texted", async () => {
  const { db, texts } = fakeWorld();
  const handler = load(true);
  db.journey_messages.push(
    { id: "m1", journey_id: "j", template_key: "LDTT_Unanswered_24Hr", to_role: "customer", to_phone: "(216) 555-0000", body: "x", due_at: "2000-01-01T00:00:00.000Z", status: "scheduled" },
    { id: "m2", journey_id: "j", template_key: "LDTT_Unanswered_24Hr", to_role: "customer", to_phone: "440-555-0199", body: "x", due_at: "2000-01-01T00:00:00.000Z", status: "scheduled" },
    { id: "m3", journey_id: "j", template_key: "LDTT_Escalation_Market_Leader", to_role: "leader", to_phone: null, body: "x", due_at: "2000-01-01T00:00:00.000Z", status: "scheduled" }
  );
  const res = await call(handler, { body: { operation: "tick" } });
  assert.equal(res.payload.skipped, 3);
  assert.equal(texts.length, 0);
  assert.deepEqual(db.journey_messages.map(m => m.status), ["skipped", "skipped", "skipped"]);
});

test("a text another screen already claimed is not sent twice", async () => {
  const { db, texts } = fakeWorld({ beforeClaim: store => store.journey_messages.forEach(m => { if (m.status === "scheduled") m.status = "sending"; }) });
  db.journey_messages.push({ id: "m1", journey_id: "j", template_key: "LDTT_Unanswered_24Hr", to_role: "customer", to_phone: "440-555-0101", body: "x", due_at: "2000-01-01T00:00:00.000Z", status: "scheduled" });
  await call(load(true), { body: { operation: "tick" } });
  assert.equal(texts.length, 0);
});

test("stop cancels every text still waiting, and a finished lead refuses more steps", async () => {
  const { db } = fakeWorld();
  const handler = load(true);
  await call(handler, { body: START });
  const id = db.lead_journeys[0].id;
  await call(handler, { body: { operation: "action", journey_id: id, action: "stop" } });
  assert.ok(db.journey_messages.every(m => m.status !== "scheduled"));
  assert.equal(db.lead_journeys[0].state, "DO NOT CONTACT");
  assert.equal((await call(handler, { body: { operation: "action", journey_id: id, action: "book" } })).statusCode, 409);
});

test("a ZIP with no trainer goes to a person (operations tester), never a dead end", async () => {
  const { db, texts } = fakeWorld();
  await call(load(true), { body: { ...START, zip: "43215", operations_tester: "t-tim" } });
  assert.equal(db.lead_journeys[0].market_key, null);
  assert.deepEqual(db.journey_messages.map(m => m.template_key), ["LDTT_Not_Serviceable_Handoff"]);
  assert.equal(texts[0].to, "+14405550102");
});

test("message library: every text fills in, and marketing texts stay held (customer care number only)", () => {
  for (const key of Object.keys(J.TEMPLATES)) {
    const text = J.render(key, { first_name: "A", last_name: "B", problem: "p", booking_link: "L", trainer_first_name: "T", trainer_name: "T N", appointment_day: "d", appointment_date: "dt", appointment_time: "t", service_address: "a", pre_eval_link: "P", trainer_portal_link: "TP", client_name: "A B", link: "K", reschedule_link: "R", rebook_link: "RB", priority_rebook_link: "PR", zip: "44105", safety_flag_if_any: "", dog_name: "" });
    assert.ok(!/\{\{/.test(text), key);
    assert.equal(J.TEMPLATES[key].kind, "care", key);
  }
  for (const key of J.HELD_MARKETING) assert.ok(!J.TEMPLATES[key], `${key} must not be sendable`);
  assert.equal(J.marketForZip("44105"), "cleveland");
  assert.equal(J.marketForZip("90210"), null);
});
