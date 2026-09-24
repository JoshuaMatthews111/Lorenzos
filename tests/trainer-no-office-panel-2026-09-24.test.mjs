// Audit 2026-09-24 (rule 7): the trainer's "All My Leads & Office Notes" table is leadPipelineTable(false),
// and that function always ended with ${leadDetailPanel()} — the OFFICE "Full Lead Record" panel, whose
// markup carries the status select, owner assignment, eval date box, office-note editor, Do Not Contact,
// Archive and permanent delete. For a trainer with a lead open it was drawn into the page underneath the
// trainer's own read-only panel (same fixed box, so it was hidden, but reachable by Tab / screen readers,
// and it shifted the scroll-restore list). The server refused the writes, but rule 7 says a trainer never
// sees an office-only control. Now the office panel is drawn only for the office; the trainer panel
// carries its own scrim, so tapping outside still closes it exactly as before.
// Nothing here talks to the real project.
import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const app = readFileSync(resolve(import.meta.dirname, "..", "trainer-backoffice/app.js"), "utf8");
const fn = name => app.match(new RegExp(`function ${name}\\(.*\\) \\{\\n[\\s\\S]*?\\n\\}\\n`))[0];

test("leadPipelineTable draws the office lead panel only when admin", () => {
  const body = fn("leadPipelineTable");
  assert.match(body, /\$\{admin \? leadDetailPanel\(\) : ""\}`;/);
  assert.doesNotMatch(body.replace(/\$\{admin \? leadDetailPanel\(\) : ""\}/, ""), /leadDetailPanel\(\)/, "no other unconditional call");
  assert.match(app, /leads\(\) \{[\s\S]{0,400}leadPipelineTable\(false\)/, "the trainer's My Leads still uses the shared table");
});

test("the trainer panel has its own click-outside scrim (it used to borrow the office panel's)", () => {
  const body = fn("trainerLeadDetailPanel");
  assert.match(body, /<\/aside><div class="lead-detail-scrim" data-close-lead><\/div>`;/);
  assert.match(app, /if \(event\.target\.closest\("\[data-close-lead\]"\)\) \{ state\.selectedLeadId = ""; saveState\(\); return; \}/);
});

test("rendered for a trainer: the table's tail carries no office control; for the office it does", () => {
  const office = '<aside class="lead-detail-panel"><select data-lead-status="x"></select><button data-archive-lead="x"></button></aside><div class="lead-detail-scrim" data-close-lead></div>';
  const ctx = {
    allLeadRows: () => [{ id: "a" }], trainerLeads: () => [{ id: "a" }], filteredLeadRows: rows => rows,
    leadSheetView: () => "", leadDateControls: () => "", assignedLeadNotice: () => "", leadWorkspaceControls: () => "",
    leadResultCountText: () => "", escapeHtml: s => String(s ?? ""), leadDetailPanel: () => office,
    state: { leadViewMode: "table", selectedLeadId: "a" }, session: { role: "trainer" }
  };
  const handler = { has: () => true, get: (t, k) => (k in t ? t[k] : k === Symbol.unscopables ? undefined : (typeof globalThis[k] !== "undefined" ? globalThis[k] : () => "")) };
  const sandbox = new Proxy(ctx, handler);
  const run = admin => vm.runInNewContext(`with (sb) { (function(){ ${fn("leadPipelineTable")}; return leadPipelineTable(${admin}); })() }`, { sb: sandbox });
  const trainerHtml = run(false);
  assert.doesNotMatch(trainerHtml, /data-lead-status|data-archive-lead|Full Lead Record/, "no office control for a trainer");
  const officeHtml = run(true);
  assert.match(officeHtml, /data-lead-status/, "the office still gets its panel");
});
