// Meeting 2026-09-16: trainers see their calendar in the trainer portal. GET /api/trainer-calendar answers the
// Google appointment page (built from the booking_trainers row), the time zone and the upcoming booked
// evaluations; the dashboard draws "My calendar" from it. Run: node --test tests/
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
process.env.SUPABASE_URL = "http://supabase.test";
process.env.LDTT_SANDBOX = "";
const handler = require("../api/trainer-calendar.js");
const read = path => readFileSync(resolve(import.meta.dirname, "..", path), "utf8");

const USERS = [
  { user_id: "u-trainer", role: "trainer", permission_level: "trainer", trainer_id: "t-1", active: true, access_status: "active", email: "harley@example.com" },
  { user_id: "u-nocal", role: "trainer", permission_level: "trainer", trainer_id: "t-2", active: true, access_status: "active", email: "other@example.com" },
  { user_id: "u-office", role: "admin", permission_level: "office_admin", active: true, access_status: "active", email: "angela@example.com" }
];
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const SCHEDULE_ID = "AcZssZ0abc123TESTSCHEDULE";
const future = hours => new Date(Date.now() + hours * 3600 * 1000).toISOString();

function world() {
  const store = {
    portal_users: USERS.map(u => ({ ...u })),
    trainers: [{ id: "t-1", slug: "harleymcgrew", full_name: "Harley McGrew" }, { id: "t-2", slug: "nocalendar", full_name: "No Calendar" }],
    site_settings: [{ key: "booking_trainers", value: { trainers: [{ slug: "harleymcgrew", schedule_id: SCHEDULE_ID, time_zone: "America/New_York", location_mode: "in_home", zip_prefixes: ["441"], active: true }] } }],
    leads: [
      { id: "L-soon", trainer_id: "t-1", status: "evaluation_scheduled", first_name: "Priya", last_name: "Rao", raw_payload: { booking: { slot_start: future(48), location: "in_home", location_label: "In-home", client: { address: "12 Elm St", city: "Cleveland", state: "OH", zip: "44101" } } } },
      { id: "L-sooner", trainer_id: "t-1", status: "evaluation_scheduled", first_name: "Ben", last_name: "Ortiz", raw_payload: { booking: { slot_start: future(2), location: "training_center", location_label: "Training center: 1 Main St", client: { address: "9 Oak Ave" } } } },
      { id: "L-past", trainer_id: "t-1", status: "evaluation_complete", first_name: "Old", last_name: "Lead", raw_payload: { booking: { slot_start: "2020-01-01T10:00:00Z" } } },
      { id: "L-nobook", trainer_id: "t-1", status: "evaluation_scheduled", first_name: "Nob", last_name: "Ooking", raw_payload: {} },
      { id: "L-other", trainer_id: "t-2", status: "evaluation_scheduled", first_name: "Some", last_name: "One", raw_payload: { booking: { slot_start: future(5) } } }
    ]
  };
  const requests = [];
  const pick = (rows, params) => {
    let out = rows;
    for (const [key, raw] of params) {
      if (["select", "order", "limit"].includes(key)) continue;
      const [op, ...rest] = raw.split("."); const value = rest.join(".");
      if (op === "eq") out = out.filter(r => String(r[key]) === value);
      if (op === "in") { const set = value.replace(/^\(|\)$/g, "").split(","); out = out.filter(r => set.includes(String(r[key]))); }
    }
    return out;
  };
  globalThis.fetch = async (url, options = {}) => {
    const u = new URL(url);
    requests.push(u.pathname + u.search);
    const headers = options.headers || {};
    if (u.pathname === "/auth/v1/user") {
      const token = String(headers.Authorization || headers.authorization || "").replace(/^Bearer\s+/, "");
      const pu = USERS.find(p => `${p.user_id}-token` === token);
      return pu ? json(200, { id: pu.user_id, email: pu.email }) : json(401, { message: "bad token" });
    }
    assert.match(u.pathname, /^\/rest\/v1\//, "only the database is read");
    const table = u.pathname.replace("/rest/v1/", "");
    if (!store[table]) return json(200, []);
    return json(200, pick(store[table], u.searchParams));
  };
  return { store, requests };
}

async function call(token = "u-trainer-token", query = {}) {
  const res = { statusCode: 200, body: null, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(code) { this.statusCode = code; return this; }, json(p) { this.body = p; return this; }, end() { return this; } };
  await handler({ method: "GET", headers: token ? { authorization: `Bearer ${token}` } : {}, query }, res);
  return res;
}

test("trainer with a booking row: the Google page URL is built from the schedule id; upcoming bookings, soonest first", async () => {
  world();
  const res = await call();
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(res.body.has_calendar, true);
  assert.equal(res.body.time_zone, "America/New_York");
  assert.equal(res.body.google_page_url, `https://calendar.google.com/calendar/appointments/schedules/${SCHEDULE_ID}`);
  const text = JSON.stringify({ ...res.body, google_page_url: "" });
  assert.ok(!text.includes(SCHEDULE_ID), "the schedule id is only ever inside the URL");
  assert.deepEqual(res.body.booked.map(b => b.lead_id), ["L-sooner", "L-soon"], "past, unbooked and other trainers' leads are left out");
  const [first, second] = res.body.booked;
  assert.equal(first.client, "Ben Ortiz");
  assert.equal(first.location, "Training center: 1 Main St");
  assert.equal(first.address, "", "no client address for a training-center evaluation");
  assert.match(first.when_label, /^[A-Z][a-z]+day, [A-Z][a-z]+ \d{1,2}, \d{4}, \d{1,2}:\d{2} [AP]M E[SD]T$/, "formatWhen in the trainer's zone");
  assert.equal(second.location, "In-home");
  assert.equal(second.address, "12 Elm St, Cleveland, OH 44101");
});

test("trainer without a booking row: 404, no calendar on file yet", async () => {
  world();
  const res = await call("u-nocal-token");
  assert.equal(res.statusCode, 404);
  assert.equal(res.body.has_calendar, false);
  assert.match(res.body.message, /no booking calendar on file yet/i);
});

test("a trainer cannot read another trainer's calendar by passing trainer_id; the office can", async () => {
  const w = world();
  const sneaky = await call("u-nocal-token", { trainer_id: "t-1" });
  assert.equal(sneaky.statusCode, 404, "the trainer_id in the query is ignored for a trainer");
  const office = await call("u-office-token", { trainer_id: "t-1" });
  assert.equal(office.statusCode, 200, JSON.stringify(office.body));
  assert.equal(office.body.trainer_id, "t-1");
  assert.equal(office.body.booked.length, 2);
  assert.ok(w.requests.some(r => r.startsWith("/rest/v1/leads?") && r.includes("trainer_id=eq.t-1")), "leads are read for the named trainer");
  const noId = await call("u-office-token");
  assert.equal(noId.statusCode, 400, "the office must name a trainer");
});

test("no token: refused", async () => {
  world();
  const res = await call(null);
  assert.equal(res.statusCode, 403);
});

test("source: My calendar sits on the trainer dashboard, between the tiles and Your team, and not in the admin screens", () => {
  const app = read("trainer-backoffice/app.js");
  const trainerStart = app.indexOf("const trainerScreens = {");
  const dashboard = app.slice(trainerStart, app.indexOf("deals() {", trainerStart));
  assert.ok(dashboard.includes("${trainerCalendarPanel()}${trainerTeamPanel()}"), "calendar panel below the tiles, above Your team");
  const adminStart = app.indexOf("const adminScreens = {");
  assert.ok(!app.slice(adminStart, trainerStart).includes("trainerCalendarPanel"), "no calendar panel in the admin screens");
  assert.ok(app.includes('fetch("/api/trainer-calendar"'), "loaded from the API");
  assert.ok(app.includes("let trainerCalendarPromise = null"), "loaded once per session, like loadTrainerTeam");
  assert.ok(app.includes("Open my Google booking calendar"));
  assert.ok(app.includes('target="_blank" rel="noopener noreferrer"'), "opens in a new tab");
  assert.ok(app.includes("No booking calendar on file yet. Ask the office to send your Google booking link."));
  assert.ok(app.includes('data-trainer-calendar-reload]'), "Try again is wired");
  const css = read("trainer-backoffice/styles.css");
  assert.ok(css.includes(".trainer-calendar-list"));
  const api = read("api/trainer-calendar.js");
  assert.ok(api.includes("supabaseRequest("), "rule 5: every table read goes through the schema switch");
});
