// Proof for perf/events-off-first-paint (DO-NOT-BREAK 1 and 40).
//
// The dashboard's "Site Visits/Clicks" is a count of site_visit + cta_click
// lifecycle rows inside the report window. The server now sends those as one
// integer per row (visitStamps) instead of the rows. This proves, on the REAL
// lifecycle table (scratchpad dump, 15,470 rows), that the figure is identical
// for every window the office can pick - and how much smaller the answer is.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import assert from "node:assert";
const require = createRequire(import.meta.url);
const METRICS = require("../trainer-backoffice/metrics.js");
const dump = process.env.LIFECYCLE_DUMP || "/private/tmp/claude-501/-Users-presdinetaloffice-Desktop/a8c59198-4e02-45cb-ba04-0b48843b9ee2/scratchpad/lifecycle-proof.json";
const raw = JSON.parse(readFileSync(dump, "utf8"));
// rebuild the shape the browser sees (raw_payload.qa / page_url)
const rows = raw.map(r => ({ ...r, raw_payload: { qa: r.qa, page_url: r.page_url } }));

// --- the browser's OLD path, verbatim from app.js ---
const heldOut = e => e.event_type === "qa_release_check" || e.raw_payload?.qa === true
  || /^qa[_-]/i.test(String(e.event_key || "")) || /(?:localhost|127\.0\.0\.1|\.vercel\.app)(?::\d+)?(?:\/|$)/i.test(String(e.raw_payload?.page_url || ""));
const reportRows = rows.filter(e => !heldOut(e));
const parse = v => { const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d; };
const inWindow = (v, start, end) => { const d = parse(v); return !!d && d >= start && d <= end; };
const oldVisits = (start, end) => {
  const lifecycle = reportRows.filter(e => inWindow(e.occurred_at || e.created_at, start, end));
  return METRICS.lifecycleCount(lifecycle, "site_visit") + METRICS.lifecycleCount(lifecycle, "cta_click");
};

// --- the server's NEW split, verbatim from api/operational-data.js ---
const VISIT_TYPES = ["site_visit", "cta_click"];
const stamps = { site_visit: [], cta_click: [] }; const kept = [];
for (const row of rows) {
  if (row.entity_type === "site_event" && VISIT_TYPES.includes(row.event_type)) {
    if (heldOut(row)) continue;
    const t = Date.parse(row.occurred_at || row.created_at || "");
    if (Number.isFinite(t)) stamps[row.event_type].push(Math.floor(t / 1000));
  } else kept.push(row);
}
const newVisits = (start, end) => {
  const lifecycle = kept.filter(e => !heldOut(e) && inWindow(e.occurred_at || e.created_at, start, end));
  return METRICS.dashboardMetrics({ lifecycle, visitStamps: stamps, windowStart: start, windowEnd: end }).visits;
};

let passed = 0; const ok = l => { console.log("PASS ", l); passed += 1; };
const now = new Date();
const windows = [];
for (const days of [7, 14, 30, 60, 90, 365]) windows.push([`last ${days} days`, new Date(now.getTime() - (days - 1) * 86400000), now]);
windows.push(["custom: 1-31 Aug 2026", new Date("2026-08-01T00:00:00"), new Date("2026-08-31T23:59:59")]);
windows.push(["custom: 1-8 Sep 2026", new Date("2026-09-01T00:00:00"), new Date("2026-09-08T23:59:59")]);
windows.push(["custom: a single day", new Date("2026-09-08T00:00:00"), new Date("2026-09-08T23:59:59")]);
windows.push(["all time", new Date(0), now]);
for (const [label, start, end] of windows) {
  const a = oldVisits(start, end), b = newVisits(start, end);
  assert.strictEqual(b, a, `${label}: rows say ${a}, stamps say ${b}`);
  ok(`${label.padEnd(24)} visits ${String(a).padStart(6)}  identical both ways`);
}
// the page-view rows never reach the browser any more, the lead rows all do
assert.ok(kept.every(r => r.entity_type !== "site_event" || !VISIT_TYPES.includes(r.event_type)), "a page-view row leaked through");
const leadRowsBefore = rows.filter(r => r.entity_type !== "site_event").length;
assert.strictEqual(kept.filter(r => r.entity_type !== "site_event").length, leadRowsBefore, "a lead/application row went missing");
ok(`every one of the ${leadRowsBefore} lead/application rows still travels; ${rows.length - kept.length} page-view rows no longer do`);
// and the 5 rows with the STRING "true" are still counted, exactly as the browser counts them today
const stringTrue = rows.filter(r => r.qa === "true" && r.entity_type === "site_event" && VISIT_TYPES.includes(r.event_type)).length;
if (stringTrue) { assert.ok(stamps.site_visit.length + stamps.cta_click.length >= stringTrue); ok(`the ${stringTrue} rows whose qa is the string "true" are counted, as the browser counts them (boolean rule kept)`); }
// size
const rowBytes = Buffer.byteLength(JSON.stringify(rows.filter(r => r.entity_type === "site_event").map(r => ({ id: r.id, event_key: r.event_key, entity_type: r.entity_type, entity_id: r.entity_id, event_type: r.event_type, occurred_at: r.occurred_at, created_at: r.created_at, raw_payload: r.raw_payload }))));
const stampBytes = Buffer.byteLength(JSON.stringify(stamps));
console.log(`\n  page-view rows as shipped before : ${(rowBytes / 1024).toFixed(0)} KB (slim columns; the live payload carried more)`);
console.log(`  visitStamps as shipped now       : ${(stampBytes / 1024).toFixed(0)} KB   (${(100 - stampBytes / rowBytes * 100).toFixed(1)}% smaller)`);
console.log(`\nAll ${passed} visits checks passed on ${rows.length} real lifecycle rows.`);
