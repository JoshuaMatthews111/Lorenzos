// "Office Contacted" is SHOWN as "Office/Trainer Contacted" in both portals (Rachel 2026-09-24, owner agreed).
// Label only (DO-NOT-BREAK rule 10): the DB status stays office_contacted and the app's internal status value stays
// the string "Office Contacted" (leadStatusToDb, option VALUES, data-drop-status, filters, saved state, METRICS lists).
// ONE display function, leadStatusLabel() in app.js -> METRICS.statusLabel(), turns a status into screen words.
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
const fn = name => app.match(new RegExp(`function ${name}\\(.*\\) \\{\\n[\\s\\S]*?\\n\\}\\n`))[0];
const oneLine = name => app.match(new RegExp(`function ${name}\\(.*\\) \\{[^\\n]*\\}\\n`))[0];
const constant = name => app.match(new RegExp(`const ${name} = [\\[{][\\s\\S]*?[\\]}];\\n`))[0];
const escapeHtml = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// The visible TEXT of rendered HTML (tags and attribute values stripped).
const visibleText = html => html.replace(/<[^>]*>/g, "\n");
const BARE = /(^|[^/])Office Contacted/m;

function render(code, extra = {}) {
  const ctx = {
    METRICS: metrics, escapeHtml, state: {},
    leadSourceBadge: () => "", leadDogLabel: () => "Dog", serviceDogTag: () => "", track500Tag: () => "", recycledTag: () => "", recycledLine: () => "", leadScoreTag: () => "", leadScoreLine: () => "",
    leadMarketLabel: () => "", formatPhoneNumber: v => String(v || ""), leadRawPayload: l => l.rawPayload || {},
    leadEvalLabel: () => "", leadTimeZone: () => "", trainerHandoffBox: () => "", formatDateTime: v => String(v),
    leadCardDetailLines: () => "", leadAssignmentLine: () => "", leadAlphaToggle: () => "", leadAssignedHighlightClass: () => "",
    ...extra
  };
  vm.runInNewContext(`${oneLine("leadStatusLabel")}\n${code}`, ctx);
  return ctx.out;
}

const contacted = { id: "l1", owner: "Chloe", status: "Office Contacted", dbStatus: "office_contacted", createdAt: "2026-09-10", rawPayload: {} };

test("the vocabulary is unchanged: the value is still \"Office Contacted\" / office_contacted everywhere it is saved", () => {
  assert.equal(metrics.LEAD_STATUS_TO_DB["Office Contacted"], "office_contacted");
  assert.equal(metrics.LEAD_STATUS_FROM_DB.office_contacted, "Office Contacted");
  assert.equal(metrics.LEAD_STATUS_FROM_DB.follow_up_call_needed, "Office Contacted");
  assert.ok(metrics.BOARD_COLUMNS.includes("Office Contacted") && metrics.LEAD_STATUS_COUNT_ORDER.includes("Office Contacted"));
  assert.equal(metrics.CONVERSION_STAGE_RANK["Office Contacted"], 2);
  assert.match(app, /\n  "Office Contacted": "office_contacted",\n/, "app.js leadStatusToDb unchanged");
  assert.match(constant("leadStatuses"), /\n  "Office Contacted",\n/, "the status list keeps the value");
  assert.ok(!/Office\/Trainer Contacted/.test(JSON.stringify(metrics.LEAD_STATUS_TO_DB)), "the new words are never a saved value");
});

test("one display function: Office Contacted -> Office/Trainer Contacted, every other status shown as itself", () => {
  assert.equal(metrics.statusLabel("Office Contacted"), "Office/Trainer Contacted");
  Object.keys(metrics.LEAD_STATUS_TO_DB).filter(s => s !== "Office Contacted").forEach(s => assert.equal(metrics.statusLabel(s), s));
  assert.equal(metrics.statusLabel("Lost"), "Lost");
  assert.equal(render(`this.out = leadStatusLabel("Office Contacted");`), "Office/Trainer Contacted");
  assert.equal((app.match(/function leadStatusLabel\(/g) || []).length, 1);
});

test("office Leads board: header shows the new words, the drop value keeps the old", () => {
  const html = render(`var boardColumns = METRICS.BOARD_COLUMNS;\nfunction boardStatus(s) { return METRICS.boardStatus(s); }\n${fn("leadKanban")}\nthis.out = leadKanban(this.rows);`, { rows: [contacted] });
  assert.match(html, /<section class="kanban-column" data-drop-status="Office Contacted"><header><strong>Office\/Trainer Contacted<\/strong><span>1<\/span>/);
  assert.doesNotMatch(visibleText(html), BARE, "no bare \"Office Contacted\" label on the office board");
});

test("office status dropdown: every option VALUE unchanged, the words are the label", () => {
  // Lost vs Archive (Zoom 2026-09-24): the four older soft Lost statuses are no longer OFFERED, except on a lead that has one.
  const soft = new Set(metrics.SOFT_LOST_STATUSES.map(v => metrics.LEAD_STATUS_FROM_DB[v]));
  const html = render(`${constant("leadStatuses")}\n${fn("statusSelect")}\nthis.out = statusSelect(this.lead);`, { lead: contacted, SOFT_LOST_LABELS: soft });
  assert.match(html, /<option value="Office Contacted" selected>Office\/Trainer Contacted<\/option>/);
  const values = [...html.matchAll(/<option value="([^"]*)"/g)].map(m => m[1].replace(/&amp;/g, "&"));
  const list = vm.runInNewContext(`${constant("leadStatuses")}; leadStatuses`);
  assert.deepEqual(values, [...list].filter(status => !soft.has(status)), "one option per status, value = the status itself (what the change handler saves)");
  const oldLost = render(`${constant("leadStatuses")}\n${fn("statusSelect")}\nthis.out = statusSelect(this.lead);`, { lead: { ...contacted, status: "Lost / Price Concern" }, SOFT_LOST_LABELS: soft });
  assert.match(oldLost, /<option value="Lost \/ Price Concern" selected>Lost \/ Price Concern \(earlier reason\)<\/option>/, "a lead already on a soft Lost status still shows it (nothing moves)");
  assert.doesNotMatch(oldLost, /Lost \/ No Response/);
  assert.ok(list.includes("Lost: Doesn't Believe in Our Training Method") && list.includes("Lost: Dog Doesn't Qualify"), "the two new hard-no statuses are offered");
  assert.doesNotMatch(visibleText(html), BARE);
  assert.match(fn("leadWorkspaceControls"), /<option value="\$\{escapeHtml\(status\)\}"[^`]*leadOptionLabel\(leadStatusLabel\(status\)/, "the status FILTER keeps its values, shows the label");
});

test("trainer board (Rachel 2026-09-25): an Office Contacted lead sits under the office's header \"Office/Trainer Contacted\"", () => {
  const html = render(`${constant("TRAINER_BOARD_TONE")}\n${fn("trainerCardEvalLine")}\n${fn("trainerCardNextStep")}\n${fn("trainerPipelineBoard")}\nthis.out = trainerPipelineBoard(this.rows);`, { rows: [contacted] });
  assert.match(html, /<section class="sales-column marketing" data-board-column="contacted">\s*<header class="sales-column-head"><span class="sales-stage">Office\/Trainer Contacted<\/span><span class="sales-count">1<\/span>/);
  assert.doesNotMatch(visibleText(html), BARE);
});

test("every other place a lead status is SHOWN goes through leadStatusLabel", () => {
  // Status pills (trainer lead table, trainer lead panel, clients, lost table), the closed hint, the filter chip
  // text, the re-engage sample, toasts. A raw `escapeHtml(lead.status)` would show the bare value.
  assert.doesNotMatch(app, /escapeHtml\(lead\.status\)/);
  assert.doesNotMatch(app, /escapeHtml\(lead\.status \|\| "New Inquiry"\)/);
  assert.match(fn("trainerLeadDetailPanel"), /<span class="status live">\$\{escapeHtml\(leadStatusLabel\(lead\.status \|\| "New Inquiry"\)\)\}<\/span>/);
  assert.match(fn("leadPipelineTable"), /<span class="status \$\{statusClass\(lead\.status\)\}">\$\{escapeHtml\(leadStatusLabel\(lead\.status\)\)\}<\/span>/);
  assert.match(app, /labels\.push\(`Status: \$\{leadStatusLabel\(state\.leadStatusFilter\)\}`\)/);
  assert.match(app, /escapeHtml\(leadStatusLabel\(METRICS\.LEAD_STATUS_FROM_DB\?\.\[r\.status\] \|\| r\.status\)\)/);
  assert.match(app, /"Lead moved to " \+ leadStatusLabel\(column\.dataset\.dropStatus\)/);
  // The literal words "Office Contacted" survive in app.js ONLY as values/keys (never as display text).
  const lines = app.split("\n").filter(line => line.includes("Office Contacted") && !/^\s*\/\//.test(line));
  lines.forEach(line => assert.match(line, /"Office Contacted"/, `only as a quoted value: ${line.trim().slice(0, 120)}`));
  assert.doesNotMatch(app, /New Inquiry \/ Office Contacted \/ Engaged|of them in Office Contacted/, "the re-engage hints use the new words");
  assert.match(app, /New Inquiry \/ Office\/Trainer Contacted \/ Engaged/);
});

test("the Sales board never showed this status name, so it is unchanged", () => {
  assert.doesNotMatch(fn("salesBoardColumnsHtml"), /lead\.status|leadStatusLabel/);
});
