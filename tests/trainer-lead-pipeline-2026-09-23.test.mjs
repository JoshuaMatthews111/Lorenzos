// Trainer lead board (Rachel, Business Operations Director) — REWRITTEN 2026-09-24 TWICE.
// 2026-09-23 added a separate "Lead Pipeline" tab drawn from the office SALES board. 2026-09-24 (commit 8e4433d)
// removed that tab and made My Leads a full mirror of the office Leads board (8 columns). The same night, on Zoom,
// Lorenzo overruled the mirror: "it should not mirror exactly like the admin ... The trainers is looking for did I
// do this, this and this ... Not a lot of clutter." Agreed: the pre-8e4433d trainer board plus ONE column:
//   New Inquiry | Contacted | Eval Scheduled | Eval Completed | Sold | Lost
// "Contacted" holds Office/Trainer Contacted AND Engaged Lead: No Outcome, so Shavon Striggles's lead Chloe
// Williams (engaged_no_outcome, the office spoke to her on 9/10) is in Contacted, never New Inquiry (Rachel's bug).
// Kept from 8e4433d: the tab is gone, view=leadPipeline lands on My Leads, trainer-only cards, Mark contacted,
// sideways-scroll memory, phone stacking. The OFFICE Leads board is byte-for-byte what 8e4433d drew.
// Run: node --test tests/   Nothing here talks to the real project.
import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";

const require = createRequire(import.meta.url);
const root = resolve(import.meta.dirname, "..");
const read = path => readFileSync(resolve(root, path), "utf8");
const metrics = require("../trainer-backoffice/metrics.js");
const app = read("trainer-backoffice/app.js");
const css = read("trainer-backoffice/styles.css");
const fn = name => app.match(new RegExp(`function ${name}\\(.*\\) \\{\\n[\\s\\S]*?\\n\\}\\n`))[0];
const oneLine = name => app.match(new RegExp(`function ${name}\\(.*\\) \\{[^\\n]*\\}\\n`))[0];
const constant = name => app.match(new RegExp(`const ${name} = [\\[{][\\s\\S]*?[\\]}];\\n`))[0];

const lead = (id, dbStatus, extra = {}) => ({
  id, dbStatus, owner: `Owner ${id}`, trainerId: extra.trainerId || "shavon-striggles",
  status: metrics.LEAD_STATUS_FROM_DB[dbStatus] || "New Inquiry",
  createdAt: "2026-09-20T12:00:00Z", rawPayload: {}, ...extra
});

const escapeHtml = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
function context(extra = {}) {
  return {
    METRICS: metrics, escapeHtml,
    leadSourceBadge: () => "<span class=\"source-badge\"></span>",
    leadDogLabel: () => "Dog", serviceDogTag: () => "", track500Tag: () => "", recycledTag: () => "", recycledLine: () => "",
    leadMarketLabel: () => "Cleveland, OH", formatPhoneNumber: v => String(v || ""),
    leadRawPayload: l => l.rawPayload || {}, leadEvalLabel: () => "Mon 9 AM", leadTimeZone: () => "America/New_York",
    trainerHandoffBox: () => "", formatDateTime: v => String(v), leadCardDetailLines: () => "", leadAssignmentLine: () => "",
    leadAlphaToggle: () => "", leadAssignedHighlightClass: () => "", state: {},
    ...extra
  };
}

// The REAL trainer board and the REAL office Leads board, run in a sandbox with only leaf helpers stubbed.
function renderBoards(leads, trainerLeadsFor = () => leads) {
  const ctx = context({ trainerLeads: trainerLeadsFor, currentTrainerId: () => "shavon-striggles" });
  vm.runInNewContext(
    `${oneLine("leadStatusLabel")}\n${constant("TRAINER_BOARD_TONE")}\n` +
    `${fn("trainerCardEvalLine")}\n${fn("trainerCardNextStep")}\n${fn("trainerPipelineBoard")}\n` +
    `var boardColumns = METRICS.BOARD_COLUMNS;\nfunction boardStatus(status) { return METRICS.boardStatus(status); }\n${fn("leadKanban")}\n` +
    `this.trainer = trainerPipelineBoard(trainerLeads(currentTrainerId()));\nthis.office = leadKanban(this.officeRows || []);`,
    Object.assign(ctx, { officeRows: leads })
  );
  return ctx;
}

const trainerHeaders = html => [...html.matchAll(/<span class="sales-stage">([^<]+)<\/span>/g)].map(m => m[1]);
const officeHeaders = html => [...html.matchAll(/<header><strong>([^<]+)<\/strong>/g)].map(m => m[1]);
const trainerColumn = (html, label) => html.split("<section class=\"sales-column").find(part => part.includes(`<span class="sales-stage">${label}</span>`)) || "";
const officeColumn = (html, value) => html.split("<section class=\"kanban-column\"").find(part => part.startsWith(` data-drop-status="${value}"`)) || "";

test("the Lead Pipeline tab is gone: My Leads sits directly under Dashboard, in the menu and the Page Editor preview", () => {
  const ctx = {
    METRICS: { navBadgeCounts: () => ({ myLeads: 3, paymentsDue: 0, mediaPending: 0, reviewsPending: 0 }) },
    filteredLeadRows: rows => rows, trainerLeads: () => [], state: { dealPayments: [] },
    trainerMediaSubmissions: () => [], trainerReviewSubmissions: () => []
  };
  vm.runInNewContext(`${fn("trainerNav")}\nthis.nav = trainerNav();`, ctx);
  const views = ctx.nav.map(entry => entry[0]);
  assert.ok(!views.includes("leadPipeline"), "no Lead Pipeline tab");
  assert.deepEqual([...views.slice(0, 2)], ["dashboard", "leads"]);
  assert.equal(ctx.nav[1][1], "My Leads");
  assert.equal(ctx.nav[1][3], 3, "the My Leads badge still comes from metrics.js (rule 34)");
  assert.doesNotMatch(app, /\n  leadPipeline\(\) \{/, "trainerScreens has no Lead Pipeline screen");
  assert.doesNotMatch(fn("portalPreviewViews"), /leadPipeline/, "the Page Editor preview list matches the menu (rule 80)");
  assert.doesNotMatch(app, /leadPipeline: \["Lead Pipeline"/, "no screen title for it either");
});

test("a saved, bookmarked or texted view=leadPipeline lands on My Leads with the lead open, never a blank screen", () => {
  assert.match(app, /const TRAINER_MOVED_VIEWS = \{ leadPipeline: "leads" \};/);
  assert.match(app, /if \(session\.role !== "admin" && TRAINER_MOVED_VIEWS\[state\.activeView\]\) state\.activeView = TRAINER_MOVED_VIEWS\[state\.activeView\];/);
  // The deep link from an old trainer text: applyUrlState reads it as "leads" and keeps the lead id.
  const ctx = { state: { activeView: "dashboard", trainers: [] }, window: { location: { search: "?view=leadPipeline&lead=65f976c2-d72c-4678-9b5f-2d96064454b3" } }, URLSearchParams };
  vm.runInNewContext(`${fn("applyUrlState")}\napplyUrlState();`, ctx);
  assert.equal(ctx.state.activeView, "leads");
  assert.equal(ctx.state.selectedLeadId, "65f976c2-d72c-4678-9b5f-2d96064454b3");
  // New links point at My Leads directly (lib/pipeline.js trainerLeadLink).
  assert.match(read("lib/pipeline.js"), /\/trainer-backoffice\?view=leads&lead=\$\{encodeURIComponent\(leadId\)\}/);
  assert.doesNotMatch(read("lib/pipeline.js").match(/function trainerLeadLink[\s\S]*?\n\}/)[0], /leadPipeline/);
});

const SIX = ["New Inquiry", "Contacted", "Eval Scheduled", "Eval Completed", "Sold", "Lost"];

test("My Leads draws SIX task columns (Lorenzo 2026-09-24), not the office's eight, with no office legends", () => {
  const { trainer, office } = renderBoards([lead("a", "new_inquiry")]);
  assert.deepEqual(trainerHeaders(trainer), SIX);
  assert.deepEqual(officeHeaders(office), ["New Inquiry", "Office/Trainer Contacted", "Engaged Lead: No Outcome", "Evaluation Scheduled", "Evaluation Cancelled", "Evaluation Complete", "Became a Client", "Lost"], "the office board keeps its eight");
  assert.match(app, /  leads\(\) \{\n    return `\$\{panel\("My Pipeline", "", trainerPipelineBoard\(trainerLeads\(currentTrainerId\(\)\)\), "pad"\)\}/, "My Leads = the board, no legends (\"not a lot of clutter\")");
  assert.doesNotMatch(fn("trainerPipelineBoard"), /BOARD_COLUMNS|boardStatus|leadStatusLabel/, "the trainer board never borrows the office columns or words");
});

test("Chloe Williams (engaged_no_outcome) is in \"Contacted\" for the trainer, never New Inquiry; the office still shows Engaged Lead: No Outcome", () => {
  const rows = [lead("chloe", "engaged_no_outcome", { owner: "Chloe Williams" }), lead("n", "new_inquiry"), lead("o", "office_contacted"), lead("s", "evaluation_scheduled"), lead("c", "evaluation_cancelled"), lead("b", "bad_lead"), lead("r", "canceled_refunded")];
  const { trainer, office } = renderBoards(rows);
  assert.ok(trainerColumn(trainer, "Contacted").includes("Chloe Williams"));
  assert.ok(!trainerColumn(trainer, "New Inquiry").includes("Chloe Williams"));
  assert.ok(trainerColumn(trainer, "Contacted").includes("Owner o"), "Office/Trainer Contacted lands in Contacted too");
  assert.ok(trainerColumn(trainer, "New Inquiry").includes("Owner n"));
  assert.ok(officeColumn(office, "Engaged Lead: No Outcome").includes("Chloe Williams"), "the office board is unchanged");
  for (const id of ["c", "b", "r"]) assert.ok(trainerColumn(trainer, "Lost").includes(`Owner ${id}`), `${id} in Lost`);
  assert.match(trainerColumn(trainer, "Lost"), /The evaluation was cancelled\. Call to rebook it\./);
  const counts = html => [...html.matchAll(/<span class="sales-count">(\d+)<\/span>/g)].map(m => Number(m[1]));
  assert.deepEqual(counts(trainer), [1, 2, 1, 0, 0, 3], "column counts come from metrics.js");
  assert.deepEqual(counts(trainer), metrics.trainerLeadBoard(rows).map(([, r]) => r.length));
});

test("the OFFICE Leads board is byte-for-byte what 8e4433d drew (same rows, every status)", () => {
  // Every DB status, rendered by the REAL leadKanban with the same leaf stubs the 8e4433d proof used.
  const dbs = ["new_inquiry", "office_contacted", "follow_up_call_needed", "engaged_no_outcome", "evaluation_scheduled", "evaluation_cancelled", "evaluation_complete", "became_client", "lost_no_response", "lost_price_concern", "lost_not_ready", "lost_chose_another_provider", "lost_client_complaint", "lost_no_trainer_area", "canceled_refunded", "canceled_write_off", "bad_lead", "do_not_contact", "archived"];
  const rows = dbs.map((db, i) => ({ id: `f${i}`, dbStatus: db, status: metrics.LEAD_STATUS_FROM_DB[db], owner: `Owner ${i} <${db}>`, dog: "Rex", createdAt: `2026-09-${String(10 + (i % 15)).padStart(2, "0")}T12:00:00Z` }));
  const ctx = { METRICS: metrics, escapeHtml, formatDateTime: v => String(v), leadCardDetailLines: l => `<p>${escapeHtml(l.dog || "")}</p>`, leadAssignmentLine: () => "", leadAlphaToggle: () => "", leadSourceBadge: () => "<span class=\"source-badge\"></span>", leadAssignedHighlightClass: () => "", rows };
  vm.runInNewContext(`${oneLine("leadStatusLabel")}\nvar boardColumns = METRICS.BOARD_COLUMNS;\nfunction boardStatus(status) { return METRICS.boardStatus(status); }\n${fn("leadKanban")}\nthis.html = leadKanban(rows);`, ctx);
  assert.equal(createHash("sha256").update(ctx.html).digest("hex"), "69dae2df45850a752c2ca3a496db2a4c7d5eabc07ba671b8f96f4818a659d229", "sha256 of the office board at 8e4433d");
  assert.deepEqual(metrics.BOARD_COLUMNS, ["New Inquiry", "Office Contacted", "Engaged Lead: No Outcome", "Evaluation Scheduled", "Evaluation Cancelled", "Evaluation Complete", "Became a Client", "Lost"]);
});

test("strict scoping (rule 7): only the signed-in trainer's leads, and never a Do Not Contact / Archived lead (rule 80)", () => {
  const mine = [lead("m1", "new_inquiry"), lead("m2", "do_not_contact"), lead("m3", "archived"), lead("m4", "bad_lead")];
  const theirs = [lead("x1", "new_inquiry", { trainerId: "someone-else" })];
  const { trainer } = renderBoards(mine.concat(theirs), () => mine);
  assert.ok(trainer.includes("Owner m1"));
  assert.ok(!trainer.includes("Owner x1"), "another trainer's lead is never drawn");
  assert.ok(!trainer.includes("Owner m2") && !trainer.includes("Owner m3"), "Do Not Contact / Archived are never handed to a trainer");
  assert.ok(trainerColumn(trainer, "Lost").includes("Owner m4"), "Bad Lead sits in Lost");
  assert.ok(!trainerColumn(trainer, "Lost").includes("Call to find out"), "but a Bad Lead is never a lead to call");
});

test("no office-only controls on the trainer board: no status dropdown, no drag/drop, no notes, no archive/delete, no assignment", () => {
  const { trainer } = renderBoards(["new_inquiry", "office_contacted", "engaged_no_outcome", "evaluation_scheduled", "evaluation_cancelled", "evaluation_complete", "became_client", "lost_price_concern"].map((s, i) => lead(`l${i}`, s)));
  for (const office of ["data-lead-status", "data-drop-status", "draggable", "data-new-office-note", "data-add-office-note", "data-archive-lead", "data-office-assignee", "data-lead-dnc", "<select"]) {
    assert.ok(!trainer.includes(office), `trainer board has no ${office}`);
  }
  assert.match(trainer, /class="sales-card trainer-card" data-open-lead=/, "a tap opens the trainer's own panel");
  assert.doesNotMatch(fn("trainerPipelineBoard"), /statusSelect|leadDetailPanel\(|permanentDeleteButton|officeAssigneeSelect/);
});

test("opening a lead keeps the board where it was scrolled sideways (the trainer board carries a covered class)", () => {
  const { trainer } = renderBoards([lead("a", "new_inquiry")]);
  assert.match(trainer, /^<div class="sales-board trainer-board trainer-leads-board">/);
  assert.match(app, /SIDEWAYS_SCROLL_SELECTOR = "\.sales-board, \.lead-kanban, \.table-wrap"/, "covers the office boards, the trainer board and the wide tables");
  assert.match(app, /const scrollPlaces = rememberSidewaysScroll\(\);\n  renderView\(\);/, "the place is taken before the redraw");
  assert.match(app, /restoreSidewaysScroll\(scrollPlaces\);/, "and put back after it");
  const remember = app.slice(app.indexOf("function rememberSidewaysScroll"), app.indexOf("function restoreSidewaysScroll"));
  assert.match(remember, /\$\{state\.activeView\}:\$\{index\}/, "a board only ever restores onto itself");
  const restore = app.slice(app.indexOf("function restoreSidewaysScroll"));
  assert.match(restore, /Math\.min\(left, Math\.max\(0, box\.scrollWidth - box\.clientWidth\)\)/, "never scrolls past the end of a shorter board");
});

test("mobile: the trainer board stacks at phone width and the office boards are untouched", () => {
  assert.match(css, /@media \(max-width: 720px\)[\s\S]*?\.sales-board\.trainer-leads-board \{[\s\S]*?grid-template-columns: 1fr/);
  assert.match(css, /\.sales-board\.trainer-leads-board \.sales-column \{[\s\S]*?max-height: none/);
  const block = css.match(/\/\* Rachel 2026-09-23\/24[\s\S]*?\n\}\n/)[0];
  block.split("\n").filter(line => line.includes("{") && line.includes(".sales-"))
    .forEach(line => assert.ok(line.includes("trainer-leads-board"), `office board must not be restyled: ${line.trim()}`));
});

test("the office Sales board keeps its shared renderer, and it is the only caller now", () => {
  assert.equal((app.match(/function salesBoardColumnsHtml\(/g) || []).length, 1);
  assert.match(app, /const columns = salesBoardColumnsHtml\(buckets, \{ deals, columnCounts \}\)/, "the office Sales board calls it");
  assert.equal((app.match(/salesBoardColumnsHtml\(/g) || []).length, 2, "defined once, called once (office)");
  assert.doesNotMatch(app, /trainerLeadPipelineBoard|trainerLeadPipelineRows/, "the 2026-09-23 trainer caller is gone");
});

test("Mark contacted: offered in the trainer's lead panel only for a New Inquiry lead", () => {
  const box = status => {
    const ctx = context({ trainerHandoffBox: () => "" });
    vm.runInNewContext(`${oneLine("leadStatusLabel")}\n${constant("TRAINER_LOST_REASONS")}\n${constant("TRAINER_ARCHIVE_REASONS")}\n${fn("trainerLeadActionsBox")}\nthis.html = trainerLeadActionsBox(this.lead);`,
      Object.assign(ctx, { lead: { id: "l1", remoteId: "65f976c2-d72c-4678-9b5f-2d96064454b3", owner: "Chloe", status } }));
    return ctx.html;
  };
  assert.match(box("New Inquiry"), /data-trainer-lead-action="contacted"[^>]*>Mark contacted<\/button>/);
  for (const status of ["Office Contacted", "Engaged Lead: No Outcome", "Evaluation Scheduled", "Became a Client", "Lost / Price Concern"]) {
    assert.doesNotMatch(box(status), /data-trainer-lead-action="contacted"/, status);
  }
  const action = fn("trainerLeadAction");
  assert.match(action, /if \(action === "contacted" && !window\.confirm\(/, "asks first");
  assert.match(action, /showToast\(payload\.message \|\| "Saved\."\)/, "toast");
  assert.match(action, /await reloadRemoteData\(\)/, "reload");
});
