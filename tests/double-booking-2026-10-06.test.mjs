// Office 2026-10-06: "people are still being double booked". A lead moved to a trainer keeps its old trainer_slug,
// so knownBookings must also match the trainer's id, or that evaluation never hides its time.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("knownBookings matches the trainer by slug OR id", () => {
  const src = fs.readFileSync(new URL("../lib/booking.js", import.meta.url), "utf8");
  assert.match(src, /or=\(trainer_slug\.eq\.\$\{who\},trainer_id\.eq\.\$\{me\.id\}\)/);
  assert.match(src, /sbOrThrow\(`\/rest\/v1\/leads\?\$\{mine\}&status=eq\.evaluation_scheduled/);
});
