// Joshua 2026-10-15: the trainers' Google calendars block booking slots with a 1-hour gap around EVERY event.
// Read-only (rule 71). Without the env the module is silent and booking behaves exactly as before.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

test("googleBusy: silent without env; busy blocks parsed to epoch seconds; failures return []", async () => {
  const GC = require("../lib/trainer-calendars.js");
  delete process.env.GCAL_REFRESH_TOKEN;
  GC.resetCaches();
  assert.equal(GC.ready(), false);
  assert.deepEqual(await GC.googleBusy("lorenzo@lorenzosdogtrainingteam.com"), [], "no env -> no blocks");

  process.env.GOOGLE_OAUTH_CLIENT_ID = "id";
  process.env.GOOGLE_OAUTH_CLIENT_SECRET = "secret";
  process.env.GCAL_REFRESH_TOKEN = "token";
  GC.resetCaches();
  const calls = [];
  const realFetch = global.fetch;
  global.fetch = async (url, opts) => {
    calls.push(String(url));
    if (String(url).includes("oauth2.googleapis.com")) return { ok: true, json: async () => ({ access_token: "at", expires_in: 3600 }) };
    return { ok: true, json: async () => ({ calendars: { "robert@x.com": { busy: [{ start: "2026-10-19T21:00:00Z", end: "2026-10-19T22:00:00Z" }] } } }) };
  };
  try {
    const busy = await GC.googleBusy("Robert@X.com");
    assert.deepEqual(busy, [{ start: Math.floor(Date.parse("2026-10-19T21:00:00Z") / 1000), end: Math.floor(Date.parse("2026-10-19T22:00:00Z") / 1000), source: "google" }]);
    const again = await GC.googleBusy("robert@x.com");
    assert.equal(again, busy, "60s cache: no second freebusy call");
    assert.equal(calls.filter(u => u.includes("freeBusy")).length, 1);
    // a failing calendar returns [] rather than breaking the page
    GC.resetCaches();
    global.fetch = async url => String(url).includes("oauth2") ? { ok: true, json: async () => ({ access_token: "at", expires_in: 3600 }) } : { ok: false, status: 403, json: async () => ({}) };
    assert.deepEqual(await GC.googleBusy("robert@x.com"), []);
  } finally {
    global.fetch = realFetch;
    delete process.env.GCAL_REFRESH_TOKEN;
    GC.resetCaches();
  }
});

test("a Google event hides booking slots within the 1-hour gap (Robert's Mon 4pm case)", () => {
  const B = require("../lib/booking.js");
  // Drop off Sophie 5-6pm; eval slots 4pm (clashes: ends 5pm, zero gap) and 7pm (exactly 1h after: allowed)
  const busy = [{ start: Date.parse("2026-10-19T21:00:00Z") / 1000, end: Date.parse("2026-10-19T22:00:00Z") / 1000, source: "google" }];
  const slots = [
    { start: Date.parse("2026-10-19T20:00:00Z") / 1000, minutes: 60 }, // 4pm ET
    { start: Date.parse("2026-10-19T23:00:00Z") / 1000, minutes: 60 }  // 7pm ET
  ];
  const open = B.openSlots(slots, busy, Date.parse("2026-10-18T12:00:00Z"));
  assert.equal(open.length, 1, "4pm hidden, 7pm stays");
  assert.equal(open[0].start, slots[1].start);
});

test("knownBookings merges the Google blocks for the trainer's email", () => {
  const src = require("node:fs").readFileSync(new URL("../lib/booking.js", import.meta.url), "utf8");
  assert.match(src, /select=id,email&limit=1/);
  assert.match(src, /GC\.ready\(\) \? await GC\.googleBusy\(me\?\.email, \{ now \}\)/);
  assert.match(src, /return \[\.\.\.out\.values\(\), \.\.\.googleBlocks\];/);
});
