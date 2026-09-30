// Rule 158 (Joshua 2026-09-30, option A): the booking page hides a Google free time that sits within one hour
// (the travel gap) of an evaluation we already know about for that trainer. Found the same day: Shantelle Tuck
// (a 10 AM pick right after a 9 AM session), Robert Wesling and Lorenzo Miller were double booked because a pick on
// our page never hid a time and Google's own buffer only guards Google-booked appointments.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
process.env.SUPABASE_URL = "http://supabase.test";
const require = createRequire(import.meta.url);

function load() {
  for (const m of ["../lib/sandbox.js", "../lib/booking.js"]) delete require.cache[require.resolve(m)];
  process.env.LDTT_SANDBOX = "1";
  return require("../lib/booking.js");
}

const HOUR = 3600;
const now = Date.UTC(2026, 9, 1, 12, 0, 0); // Thu Oct 1 2026, 8 AM Eastern
const day = Math.floor(Date.UTC(2026, 9, 3, 12, 0, 0) / 1000); // Sat Oct 3, 8 AM Eastern
const at = h => day + h * HOUR; // at(0) = 8 AM, at(2) = 10 AM ...
const slot = h => ({ start: at(h), minutes: 60 });
const iso = sec => new Date(sec * 1000).toISOString();
const ids = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

function fakeDb(db, { fail = false } = {}) {
  global.fetch = async url => {
    const u = new URL(String(url));
    if (fail) return { ok: false, status: 500, text: async () => JSON.stringify({ message: "down" }) };
    const rows = db[u.pathname.replace("/rest/v1/", "")] || [];
    const filters = [...u.searchParams].filter(([k]) => k !== "select");
    const hit = rows.filter(row => filters.every(([k, v]) => {
      const [op, ...rest] = v.split("."); const val = rest.join(".");
      if (op === "eq") return String(row[k]) === val;
      if (op === "gte") return String(row[k] ?? "") >= val;
      if (op === "in") return val.replace(/^\(|\)$/g, "").split(",").includes(String(row[k]));
      return true;
    }));
    return { ok: true, status: 200, text: async () => JSON.stringify(hit) };
  };
}

test("openSlots: a known 10 AM eval hides 9, 10 and 11 AM; 8 AM and noon stay (one hour to travel)", () => {
  const B = load();
  const busy = [{ start: at(2), end: at(3) }];
  const open = B.openSlots([0, 1, 2, 3, 4].map(slot), busy, now).map(s => s.start);
  assert.deepEqual(open, [at(0), at(4)]);
});

test("openSlots: Joshua's example - someone has 3 PM, so 4 PM is hidden and 5 PM is offered", () => {
  const B = load();
  const busy = [{ start: at(7), end: at(8) }]; // 3 PM - 4 PM
  const open = B.openSlots([slot(8), slot(9)], busy, now).map(s => s.start);
  assert.deepEqual(open, [at(9)], "4 PM hidden, 5 PM offered");
});

test("openSlots: no known bookings = Google's times exactly (minus the next hour); junk entries hide nothing", () => {
  const B = load();
  const soon = { start: Math.floor(now / 1000) + 600, minutes: 60 };
  const all = [soon, slot(0), slot(2)];
  assert.deepEqual(B.openSlots(all, [], now).map(s => s.start), [at(0), at(2)]);
  assert.deepEqual(B.openSlots(all, [{ slot_start: iso(at(0)) }, null], now).map(s => s.start), [at(0), at(2)]);
  assert.equal(B.TRAVEL_GAP_MINUTES, 60);
});

test("knownBookings: page picks and portal eval dates count; cancelled, moved, test and other-trainer times do not", async () => {
  const B = load();
  const db = {
    leads: [
      { id: ids(1), trainer_slug: "shantelle-tuck", status: "evaluation_scheduled", eval_scheduled_at: iso(at(2)) },          // portal eval 10 AM
      { id: ids(2), trainer_slug: "shantelle-tuck", status: "evaluation_cancelled", eval_scheduled_at: iso(at(4)) },          // cancelled
      { id: ids(3), trainer_slug: "shantelle-tuck", status: "evaluation_scheduled", eval_scheduled_at: iso(at(6)), qa: "true" }, // test lead
      { id: ids(4), trainer_slug: "robert-wesling", status: "evaluation_scheduled", eval_scheduled_at: iso(at(8)) },          // other trainer
      { id: ids(5), trainer_slug: "", status: "evaluation_scheduled", eval_scheduled_at: iso(at(10)) },                      // page pick, routed elsewhere
      { id: ids(6), trainer_slug: "shantelle-tuck", status: "evaluation_scheduled", eval_scheduled_at: iso(at(12)) }          // office moved it
    ],
    booking_holds: [
      { id: "h5", trainer_slug: "shantelle-tuck", status: "held", slot_start: iso(at(10)), slot_minutes: 60, lead_id: ids(5) },
      { id: "h6", trainer_slug: "shantelle-tuck", status: "held", slot_start: iso(at(9)), slot_minutes: 60, lead_id: ids(6) },  // stale: moved to at(12)
      { id: "h2", trainer_slug: "shantelle-tuck", status: "held", slot_start: iso(at(4)), slot_minutes: 60, lead_id: ids(2) },  // cancelled lead
      { id: "h7", trainer_slug: "shantelle-tuck", status: "released", slot_start: iso(at(1)), slot_minutes: 60, lead_id: ids(1) }
    ]
  };
  fakeDb(db);
  const busy = await B.knownBookings("shantelle-tuck", { now });
  assert.deepEqual(busy.map(b => b.start).sort((a, b) => a - b), [at(2), at(10), at(12)]);
  assert.ok(busy.every(b => b.end - b.start === HOUR));

  const mine = await B.knownBookings("shantelle-tuck", { now, excludeLeadId: ids(1) });
  assert.ok(!mine.some(b => b.start === at(2)), "the lead that is rebooking is never blocked by its own time");
});

test("knownBookings: a failed database read hides nothing (Google's times still show)", async () => {
  const B = load();
  fakeDb({}, { fail: true });
  assert.deepEqual(await B.knownBookings("lorenzo-miller", { now }), []);
});

test("the booking API uses the known bookings for the list AND for the re-check at booking time", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("../api/booking.js", import.meta.url), "utf8");
  assert.equal((src.match(/B\.openSlots\(slots, (busy|await B\.knownBookings\()/g) || []).length, 2);
  assert.ok(!/openSlots\(slots, (await B\.)?(activeHolds|holds)\)/.test(src), "holds alone never decide a time again");
});
