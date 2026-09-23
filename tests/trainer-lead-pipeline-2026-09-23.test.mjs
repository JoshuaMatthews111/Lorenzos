// Trainer "Lead Pipeline" tab (Rachel via Joshua, 2026-09-23).
// The trainer gets the SAME board the office sees — same columns, same wording, same card — with only their
// OWN leads (DO-NOT-BREAK rule 7). It goes directly ABOVE "My Leads"; the old "My Pipeline" board stays.
//
// The bug this pins: METRICS.TRAINER_PIPELINE_STAGES lumps new_inquiry + office_contacted +
// engaged_no_outcome into one column LABELLED "New Inquiry", so a lead the office had already engaged still
// read "New Inquiry" to the trainer. The new tab buckets on METRICS.SALES_STAGES, exactly like the office.
// Run: node --test tests/   Nothing here talks to the real project.
import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const root = resolve(import.meta.dirname, "..");
const read = path => readFileSync(resolve(root, path), "utf8");
const metrics = require("../trainer-backoffice/metrics.js");
const app = read("trainer-backoffice/app.js");
const css = read("trainer-backoffice/styles.css");
const fn = name => app.match(new RegExp(`function ${name}\\(.*\\) \\{\\n[\\s\\S]*?\\n\\}\\n`))[0];

const lead = (id, dbStatus, extra = {}) => ({
  id, dbStatus, owner: `Owner ${id}`, trainerId: extra.trainerId || "eric-beck",
  status: metrics.LEAD_STATUS_FROM_DB[dbStatus] || "New Inquiry",
  createdAt: "2026-09-20T12:00:00Z", rawPayload: {}, ...extra
});

// The leaf helpers the card markup calls. Stubbed so the test renders the real board, not a copy of it.
function boardContext(extra = {}) {
  return {
    METRICS: metrics,
    SALES_STAGES: metrics.SALES_STAGES,
    escapeHtml: s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"),
    leadSourceBadge: () => "<span class=\"source-badge\"></span>",
    leadDogLabel: () => "Dog",
    serviceDogTag: () => "",
    track500Tag: () => "",
    needsCallTag: () => "",
    salesTrainerLine: () => "Trainer",
    leadCardEvalLine: () => "",
    dealTrack500Tag: () => "",
    paymentsForDeal: () => [],
    trainerName: () => "Trainer",
    trainerIdFromRemote: () => "",
    fmtMoney: v => `$${v}`,
    formatDate: v => String(v),
    SOURCE_MARKS: { trainer: { svg: "", tone: "trainer", label: "Trainer" } },
    ...extra
  };
}

function renderTrainerBoard(leads, trainerLeadsFor = () => leads) {
  const ctx = boardContext({ trainerLeads: trainerLeadsFor, currentTrainerId: () => "eric-beck" });
  vm.runInNewContext(
    `${fn("salesBoardColumnsHtml")}\n${fn("trainerLeadPipelineRows")}\n${fn("trainerLeadPipelineBoard")}\n` +
    `var TRAINER_PIPELINE_HIDDEN_DB_STATUSES = ["do_not_contact", "archived"];\n` +
    `this.html = trainerLeadPipelineBoard();`,
    ctx
  );
  return ctx.html;
}

const columnLabels = html => [...html.matchAll(/<span class="sales-stage">([^<]+)<\/span>/g)].map(m => m[1].replace(/&amp;/g, "&"));

test("the trainer nav has Lead Pipeline directly ABOVE My Leads, and My Leads is still there", () => {
  const ctx = {
    METRICS: { navBadgeCounts: () => ({ myLeads: 3, paymentsDue: 0, mediaPending: 0, reviewsPending: 0 }) },
    filteredLeadRows: rows => rows,
    trainerLeads: () => [],
    state: { dealPayments: [] },
    trainerMediaSubmissions: () => [],
    trainerReviewSubmissions: () => []
  };
  vm.runInNewContext(`${fn("trainerNav")}\nthis.nav = trainerNav();`, ctx);
  const views = ctx.nav.map(entry => entry[0]);
  assert.equal(views[views.indexOf("leads") - 1], "leadPipeline", "Lead Pipeline sits directly above My Leads");
  assert.equal(ctx.nav[views.indexOf("leadPipeline")][1], "Lead Pipeline");
  assert.equal(ctx.nav[views.indexOf("leads")][1], "My Leads", "nothing was removed");
  // The badge comes from metrics.js (rule 34), never a number invented in app.js.
  assert.equal(ctx.nav[views.indexOf("leadPipeline")][3], 3);
  assert.match(app, /leadPipeline\(\) \{/, "trainerScreens has the screen");
  assert.match(app, /\{ id: "leadPipeline", label: "Lead Pipeline" \}/, "the Page Editor preview list matches the menu (rule 80)");
});

test("the trainer board draws the OFFICE columns, not the old lumped \"New Inquiry\"", () => {
  const html = renderTrainerBoard([lead("a", "new_inquiry")]);
  assert.deepEqual(columnLabels(html), metrics.SALES_STAGES.map(s => s[1]));
  assert.deepEqual(columnLabels(html), ["Captured & Responded", "Booked", "Eval Questions Completed", "Eval Completed", "Won", "Lost", "Win-back"]);
  assert.ok(!columnLabels(html).includes("New Inquiry"), "no column is called \"New Inquiry\" any more");
  // The old board is still there for now — it is the one that lumps the three statuses.
  assert.deepEqual(metrics.TRAINER_PIPELINE_STAGES[0], ["inquiry", "New Inquiry", ["New Inquiry", "Office Contacted", "Engaged Lead: No Outcome"]]);
});

test("an engaged lead reads the same to the office and to the trainer: \"Captured & Responded\"", () => {
  const rows = [lead("a", "new_inquiry"), lead("b", "office_contacted"), lead("c", "engaged_no_outcome"), lead("d", "evaluation_scheduled")];
  // Office: the exact call salesPipelineBoard() makes.
  const office = metrics.salesBuckets(rows, metrics.SALES_STAGES);
  assert.deepEqual(office.get("captured").map(l => l.id), ["a", "b", "c"]);
  // Trainer: the rendered board.
  const html = renderTrainerBoard(rows);
  const captured = html.split("<section class=\"sales-column")[1];
  assert.match(captured, /Captured &amp; Responded/);
  ["Owner a", "Owner b", "Owner c"].forEach(owner => assert.ok(captured.includes(owner), `${owner} is in Captured & Responded`));
  assert.ok(!captured.includes("Owner d"), "the booked lead is in Booked, not Captured & Responded");
  assert.match(html, /<span class="sales-count">3<\/span>/, "the column count matches the office bucket");
});

test("strict scoping (rule 7): only the signed-in trainer's leads, and never a Do Not Contact / Archived lead", () => {
  const mine = [lead("m1", "new_inquiry"), lead("m2", "do_not_contact"), lead("m3", "archived")];
  const theirs = [lead("x1", "new_inquiry", { trainerId: "someone-else" })];
  // trainerLeads() is the only source: a lead belonging to another trainer never reaches the renderer.
  const html = renderTrainerBoard(mine.concat(theirs), () => mine);
  assert.ok(html.includes("Owner m1"));
  assert.ok(!html.includes("Owner x1"), "another trainer's lead is never drawn");
  assert.ok(!html.includes("Owner m2") && !html.includes("Owner m3"), "Do Not Contact / Archived are never handed to a trainer to call (rule 80)");
});

test("no office-only money on the trainer board: no tiles, no deal cards", () => {
  const html = renderTrainerBoard([lead("a", "became_client")]);
  assert.ok(!html.includes("deal-card"), "deal cards are office-only");
  assert.ok(!html.includes("metric-card") && !html.includes("Close Rate"), "the Sales money tiles are office-only");
  assert.match(app, /function trainerLeadPipelineBoard\([\s\S]*?deals: \[\]/, "the trainer always passes an empty deal list");
});

test("one renderer, so office and trainer can never drift", () => {
  assert.equal((app.match(/function salesBoardColumnsHtml\(/g) || []).length, 1);
  assert.match(app, /const columns = salesBoardColumnsHtml\(buckets, \{ deals, columnCounts \}\)/, "the office board calls the shared renderer");
  assert.match(app, /salesBoardColumnsHtml\(buckets, \{ deals: \[\], moreSuffix/, "the trainer board calls the same renderer");
});

test("the trainer screen carries the office's own legends, word for word", () => {
  const screen = app.match(/leadPipeline\(\) \{[\s\S]*?\n  \},/)[0];
  assert.ok(screen.includes("sourceLegend()") && screen.includes("badgeLegend()"), "same key as the office Leads screen");
  assert.ok(screen.includes("trainerLeadPipelineBoard()"));
});

test("mobile: the trainer board stacks at phone width and the office board is untouched", () => {
  assert.match(css, /@media \(max-width: 720px\)[\s\S]*?\.sales-board\.trainer-lead-pipeline \{[\s\S]*?grid-template-columns: 1fr/);
  assert.match(css, /\.sales-board\.trainer-lead-pipeline \.sales-column \{[\s\S]*?max-height: none/);
  // Every phone override is scoped to the trainer board's own class.
  const block = css.match(/\/\* Rachel 2026-09-23[\s\S]*?\n\}\n/)[0];
  block.split("\n").filter(line => line.includes("{") && line.includes(".sales-"))
    .forEach(line => assert.ok(line.includes("trainer-lead-pipeline"), `office board must not be restyled: ${line.trim()}`));
});
