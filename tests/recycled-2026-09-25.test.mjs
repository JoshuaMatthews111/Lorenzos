// Recycled leads (Zoom 2026-09-24, Lorenzo + Angela; built 2026-09-25). A lead is "Recycled" when an OLDER lead exists
// for the same person: the same email (case-insensitive) or the same 10-digit phone. DISPLAY ONLY - no lead is
// created, changed or counted differently. metrics.js owns the matching (rule 34); the office matches over every loaded
// lead, a trainer gets a server stamp on their own rows (rule 7).
// Run: node --test tests/   Nothing here talks to the real project.
import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const M = require("../trainer-backoffice/metrics.js");
const read = path => readFileSync(resolve(import.meta.dirname, "..", path), "utf8");
const app = read("trainer-backoffice/app.js");
const fn = (src, name) => src.match(new RegExp(`(?:async )?function ${name}\\(.*\\) \\{\\n[\\s\\S]*?\\n\\}\\n`))[0];
const escapeHtml = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

test("same email (any case) or same 10-digit phone (any format) makes the NEWER lead Recycled; the first one never is", () => {
  const rows = [
    { id: "diana-1", createdAt: "2026-08-02T15:00:00Z", email: "Diana.M@Example.com", phone: "" },
    { id: "diana-2", createdAt: "2026-09-24T12:30:00Z", email: " diana.m@example.com ", phone: "(210) 555-0142" },
    { id: "phone-only", createdAt: "2026-09-25T09:00:00Z", email: "", phone: "+1 210 555 0142" },
    { id: "stranger", createdAt: "2026-09-25T10:00:00Z", email: "someone@else.com", phone: "2165550199" }
  ];
  const index = M.recycledIndex(rows);
  assert.equal(index.has("diana-1"), false, "the first request is not recycled");
  assert.deepEqual(index.get("diana-2"), { firstAt: "2026-08-02T15:00:00Z", firstLeadId: "diana-1", count: 3 });
  assert.deepEqual(index.get("phone-only"), { firstAt: "2026-08-02T15:00:00Z", firstLeadId: "diana-1", count: 3 }, "linked through Diana's second lead: first came in on her FIRST lead");
  assert.equal(index.has("stranger"), false);
});

test("placeholder and impossible phones never make two people one; blank email and phone match nobody", () => {
  const rows = [
    { id: "a", createdAt: "2026-09-01", phone: "0000000000" }, { id: "b", createdAt: "2026-09-02", phone: "000-000-0000" },
    { id: "c", createdAt: "2026-09-03", phone: "1111111111" }, { id: "d", createdAt: "2026-09-04", phone: "1111111111" },
    { id: "e", createdAt: "2026-09-05", phone: "1215550100" }, { id: "f", createdAt: "2026-09-06", phone: "1215550100" },
    { id: "g", createdAt: "2026-09-07", email: "", phone: "" }, { id: "h", createdAt: "2026-09-08", email: "", phone: "" },
    { id: "i", createdAt: "2026-09-09", email: "not-an-email" }, { id: "j", createdAt: "2026-09-10", email: "not-an-email" }
  ];
  assert.equal(M.recycledIndex(rows).size, 0);
  assert.deepEqual(M.personMatchKeys({ email: "A@B.co", phone: "1-216-555-0199" }), ["e:a@b.co", "p:2165550199"]);
});

test("the booking's email counts too, and a tie on time goes to the lower id (stable, never both)", () => {
  const rows = [
    { id: "b", createdAt: "2026-09-10T00:00:00Z", rawPayload: { booking: { client: { email: "pat@x.com" } } } },
    { id: "a", createdAt: "2026-09-10T00:00:00Z", email: "PAT@x.com" }
  ];
  const index = M.recycledIndex(rows);
  assert.equal(index.size, 1);
  assert.equal(index.get("b").firstLeadId, "a");
});

test("efficient: 20,000 leads in well under a second (union-find over keys, no pairwise loop)", () => {
  const rows = Array.from({ length: 20000 }, (_, i) => ({ id: `l${i}`, createdAt: new Date(Date.UTC(2026, 0, 1) + i * 60000).toISOString(), email: `p${i % 12000}@x.com`, phone: "" }));
  const started = Date.now();
  const index = M.recycledIndex(rows);
  assert.ok(Date.now() - started < 1000, `took ${Date.now() - started} ms`);
  assert.equal(index.size, 8000);
});

test("display only: no count, board column or status changes (the same rows give the same numbers)", () => {
  const rows = [
    { id: "1", status: "New Inquiry", createdAt: "2026-09-01", email: "a@a.com" },
    { id: "2", status: "New Inquiry", createdAt: "2026-09-02", email: "a@a.com" }
  ];
  const before = JSON.stringify([M.leadStatusCounts(rows), M.leadBoardColumnCounts(rows)]);
  M.recycledIndex(rows);
  assert.equal(JSON.stringify([M.leadStatusCounts(rows), M.leadBoardColumnCounts(rows)]), before);
  assert.equal(JSON.stringify(rows[1]).includes("recycled"), false, "the rows are not changed");
});

test("portal: a blue 'Recycled' badge with a tooltip naming when they first came in, on office cards, Sales cards, both lead panels and trainer cards", () => {
  const leads = [
    { id: "L1", createdAt: "2026-08-02T15:00:00Z", email: "d@x.com", rawPayload: {} },
    { id: "L2", createdAt: "2026-09-24T12:30:00Z", email: "D@x.com", rawPayload: {} }
  ];
  const ctx = { METRICS: M, session: { role: "admin" }, state: { leads }, escapeHtml, formatDate: () => "Aug 2, 2026", formatDateTime: () => "Aug 2, 2026, 11:00 AM" };
  vm.runInNewContext(`${app.match(/const RECYCLE_ICON = `[^`]*`;\n/)[0]}let recycledCache = { rows: null, length: -1, index: new Map() };\n${fn(app, "recycledInfo")}\n${fn(app, "recycledTag")}\n${fn(app, "recycledLine")}\nthis.tag = recycledTag(state.leads[1]); this.none = recycledTag(state.leads[0]); this.line = recycledLine(state.leads[1]);\nsession.role = "trainer"; this.trainerNoStamp = recycledTag(state.leads[1]); this.trainerStamp = recycledTag({ id: "T", recycledFirstAt: "2026-08-02T15:00:00Z", recycledCount: 2 });`, ctx);
  assert.match(ctx.tag, /class="lead-tag-recycled" title="Recycled: this person came back\. They first came in Aug 2, 2026\."><svg class="recycle-icon"[^>]*>.*<\/svg>Recycled<\/span>/);
  assert.equal(ctx.none, "", "the first request wears no badge");
  assert.match(ctx.line, /They first came in Aug 2, 2026, 11:00 AM/);
  assert.equal(ctx.trainerNoStamp, "", "a trainer never matches across leads in the browser (rule 7)");
  assert.match(ctx.trainerStamp, /Recycled<\/span>/, "the trainer's server-stamped row wears it");
  assert.match(app, /\$\{needsCallTag\(lead\)\}\$\{recycledTag\(lead\)\}`;\n  return `\$\{leadCardEvalLine\(lead\)\}/, "office Leads card");
  assert.match(app, /\$\{track500Tag\(lead\)\}\$\{needsCallTag\(lead\)\}\$\{recycledTag\(lead\)\}<\/small>/, "Sales card");
  assert.match(app, /<h2>\$\{escapeHtml\(lead\.owner\)\}\$\{needsCallTag\(lead\)\}\$\{recycledTag\(lead\)\}<\/h2>\$\{recycledLine\(lead\)\}/, "office lead panel");
  assert.match(fn(app, "trainerPipelineBoard"), /\$\{track500Tag\(lead\)\}\$\{recycledTag\(lead\)\}<\/small>/, "trainer card");
  assert.match(fn(app, "trainerLeadDetailPanel"), /\$\{recycledTag\(lead\)\}<\/p>\$\{recycledLine\(lead\)\}/, "trainer lead panel");
  assert.match(read("trainer-backoffice/styles.css"), /\.lead-tag-recycled \{[^}]*color: #1d4ed8/, "blue");
});

test("trainer rows: the server stamps ONLY recycled_first_at + recycled_count on the trainer's own rows, QA rows never match", async () => {
  const src = read("api/operational-data.js");
  assert.match(src, /await stampRecycled\(leads\)\.catch\(/, "stamped in the trainer loader, a failure never blocks sign-in");
  const everyone = [
    { id: "old", created_at: "2026-08-01T00:00:00Z", email: "k@x.com", phone: null, qa: null },
    { id: "mine", created_at: "2026-09-24T00:00:00Z", email: "K@x.com", phone: null, qa: null },
    { id: "qa-old", created_at: "2026-07-01T00:00:00Z", email: "z@x.com", phone: null, qa: "true" },
    { id: "mine2", created_at: "2026-09-24T00:00:00Z", email: "z@x.com", phone: null, qa: null }
  ];
  const calls = [];
  const ctx = { METRICS: M, supabaseFetchAll: async path => { calls.push(path); return everyone; } };
  vm.runInNewContext(`${fn(src, "stampRecycled")}\nthis.run = stampRecycled;`, ctx);
  const leads = [{ id: "mine", email: "K@x.com" }, { id: "mine2", email: "z@x.com" }];
  await ctx.run(leads);
  assert.deepEqual(leads[0], { id: "mine", email: "K@x.com", recycled_first_at: "2026-08-01T00:00:00Z", recycled_count: 2 });
  assert.deepEqual(leads[1], { id: "mine2", email: "z@x.com" }, "a QA row never makes a real lead recycled");
  assert.equal(calls[0], "/rest/v1/leads?select=id,created_at,email,phone,qa:raw_payload->>qa&order=created_at.asc", "read only the four columns it needs");
  await ctx.run([]);
  assert.equal(calls.length, 1, "no leads, no query");
});
