// Trainer portal changes from the 2026-09-12 meeting (Joshua, Tim, Angela). DO-NOT-BREAK rule 80.
//   - Dashboard tiles: Assigned / Evaluations Scheduled / Evaluations Completed / Sold / Lost (metrics.js).
//   - Working board: New Inquiry -> Eval Scheduled -> Eval Completed -> Sold -> Lost (metrics.js).
//   - "My Deals" is "Clients": Clients (Track 500 countdown) / Revenue / Collected / Balance Due / Contracted Revenue.
//   - Performance left the menu (saved screen -> Dashboard); Communications left the menu, its screen is kept.
//   - Submit a Deal: the lead fills client + dog; Program is a dropdown with "Other (type it)".
//   - Sales column "Confirmed" reads "Eval Questions Completed" (label only). Booking radius 30 miles then;
//     50 miles since Joshua 2026-09-16 (the radius test below pins 50).
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

const lead = (id, status, extra = {}) => ({ id, status, createdAt: `2026-09-${String(10 + id.length).padStart(2, "0")}T12:00:00Z`, ...extra });

// Lorenzo, Zoom 2026-09-24 (overruling the 8-column mirror of the same day): the trainer board is a TASK board,
// "not a lot of clutter" - the pre-2026-09-24 board plus ONE column, Contacted. Bucketed by database status in
// metrics.js (TRAINER_PIPELINE_STAGES). Do Not Contact / Archived never drawn (rule 80).
test("trainer board: six columns New Inquiry | Contacted | Eval Scheduled | Eval Completed | Sold | Lost; every drawn lead in exactly one; Do Not Contact / Archived never drawn", () => {
  const leads = [
    lead("a", "New Inquiry"), lead("b", "Office Contacted"), lead("c", "Engaged Lead: No Outcome"),
    lead("d", "Evaluation Scheduled"), lead("e", "Evaluation Complete"), lead("f", "Became a Client"),
    lead("g", "Lost / Price Concern"), lead("h", "Evaluation Cancelled"), lead("i", "Archived"),
    lead("k", "Do Not Contact"), lead("l", "Bad Lead"), lead("m", "Canceled / Refunded"), lead("n", "Office Contacted", { dbStatus: "follow_up_call_needed" })
  ];
  const board = new Map(metrics.trainerLeadBoard(leads));
  assert.deepEqual([...board.keys()], ["New Inquiry", "Contacted", "Eval Scheduled", "Eval Completed", "Sold", "Lost"]);
  assert.deepEqual(metrics.TRAINER_PIPELINE_STAGES.map(s => s[1]), [...board.keys()], "one list in metrics.js (rule 34)");
  const ids = column => board.get(column).map(l => l.id);
  assert.deepEqual(ids("New Inquiry"), ["a"], "new_inquiry ONLY");
  assert.deepEqual(ids("Contacted"), ["b", "c", "n"], "Office/Trainer Contacted + Engaged Lead: No Outcome");
  assert.deepEqual(ids("Eval Scheduled"), ["d"]);
  assert.deepEqual(ids("Eval Completed"), ["e"]);
  assert.deepEqual(ids("Sold"), ["f"]);
  assert.deepEqual(ids("Lost"), ["g", "h", "l", "m"], "lost_*, cancelled evaluation, bad lead, canceled_*");
  assert.equal([...board.values()].flat().length, leads.length - 2, "only Archived + Do Not Contact are left out");
  assert.ok(!metrics.TRAINER_PIPELINE_STAGES.some(s => s[2].includes("do_not_contact") || s[2].includes("archived")));
  // The DB status wins when the row carries one (a real row always does).
  assert.equal(metrics.trainerStageFor({ status: "New Inquiry", dbStatus: "engaged_no_outcome" }), "contacted");
});

test("trainer dashboard tiles agree with the board (rule 34: one source)", () => {
  const leads = [lead("a", "New Inquiry"), lead("b", "Office Contacted"), lead("c", "Engaged Lead: No Outcome"), lead("d", "Evaluation Scheduled"), lead("dd", "Evaluation Scheduled"), lead("e", "Evaluation Complete"), lead("f", "Became a Client"), lead("g", "Lost / Not Ready"), lead("h", "Evaluation Cancelled"), lead("k", "Do Not Contact")];
  const dash = metrics.trainerDashboard(leads, [{ status: "Pending" }]);
  const board = new Map(metrics.trainerLeadBoard(leads));
  assert.equal(dash.assigned, 10);
  assert.equal(dash.newInquiries, board.get("New Inquiry").length, "New Inquiries = the board's New Inquiry column");
  assert.equal(dash.newInquiries, 1, "a contacted or engaged lead is never counted as a New Inquiry");
  assert.equal(dash.contacted, board.get("Contacted").length);
  assert.equal(dash.contacted, 2);
  assert.equal(dash.evalScheduled, board.get("Eval Scheduled").length);
  assert.equal(dash.evalCompleted, board.get("Eval Completed").length);
  assert.equal(dash.won, board.get("Sold").length);
  assert.equal(dash.lost, board.get("Lost").length);
  assert.equal(dash.lost, 2, "Lost / Not Ready + Evaluation Cancelled; Do Not Contact is never shown to a trainer");
  assert.equal(dash.pendingSubmissions, 1, "the old figure is still there");
});

test("Clients tiles: a client counts once, revenue = sold, Track 500 counts down from 500 and $1,250,000", () => {
  const deals = [
    { id: "d1", trainer_id: "t", client_id: "c1", client_name: "Kathy", sold_amount: 5000, collected_amount: 1000, balance_due: 4000, status: "open" },
    { id: "d2", trainer_id: "t", client_id: "c1", client_name: "Kathy", sold_amount: 800, collected_amount: 800, balance_due: 0, status: "paid" },
    { id: "d3", trainer_id: "t", lead_id: "L9", client_name: "Erica", sold_amount: 1800, collected_amount: 600, balance_due: 1200, status: "open" },
    { id: "d4", trainer_id: "t", client_name: "Gone", sold_amount: 9999, collected_amount: 0, balance_due: 9999, status: "cancelled" }
  ];
  const td = metrics.trainerDeals(deals, [], "2026-09-13");
  assert.equal(td.count, 3, "cancelled deal left out");
  assert.equal(td.clients, 2, "Kathy's two deals are one client");
  assert.equal(td.revenue, 7600); assert.equal(td.sold, 7600);
  assert.equal(td.collected, 2400); assert.equal(td.balanceDue, 5200);
  assert.equal(td.clientGoal, 500); assert.equal(td.clientsToGo, 498);
  assert.equal(td.revenueGoal, 1250000); assert.equal(td.revenueToGo, 1250000 - 2400, "counts down by COLLECTED (Joshua 2026-09-14)");
  const done = metrics.trainerDeals([{ id: "x", client_name: "Big", sold_amount: 2000000, collected_amount: 2000000, balance_due: 0, status: "paid" }], [], "2026-09-13");
  assert.equal(done.revenueToGo, 0, "never below zero");
});

test("Sales column label only: key confirmed, status site_visit, label Eval Questions Completed", () => {
  const confirmed = metrics.SALES_STAGES.find(s => s[0] === "confirmed");
  assert.deepEqual(confirmed, ["confirmed", "Eval Questions Completed", "marketing", ["site_visit"]]);
});

test("trainer menu: Clients replaces My Deals, Performance and Communications are gone, their code is kept", () => {
  const nav = app.match(/function trainerNav\(\) \{[\s\S]*?\n\}\n/)[0];
  assert.match(nav, /\["deals", "Clients", "trophy"/);
  assert.doesNotMatch(nav, /"performance"|"communications"|My Deals/);
  assert.match(app, /const TRAINER_RETIRED_VIEWS = \["performance"\];/);
  assert.match(app, /if \(session\.role !== "admin" && TRAINER_RETIRED_VIEWS\.includes\(state\.activeView\)\) state\.activeView = "dashboard";/);
  assert.match(app, /  communications\(\) \{\n    return communicationsScreen\(\);/, "the Communications screen is kept (Log a call)");
  assert.match(app, /data-view="communications">Log a call<\/button>/);
  const preview = app.match(/function portalPreviewViews\(\) \{[\s\S]*?\n\}\n/)[0];
  assert.match(preview, /\{ id: "deals", label: "Clients" \}/, "the Page Editor preview matches the real menu");
  assert.doesNotMatch(preview, /performance/);
});

test("one page (Joshua 2026-09-14): every tab is a section in menu order, a tab click scrolls with no redraw, the highlight follows the scroll", () => {
  const dash = app.match(/const trainerScreens = \{\n  dashboard\(\) \{[\s\S]*?\n  \},\n  deals\(\)/)[0];
  // Tiles New Inquiries ... Clients; the Dashboard section is the tiles only, so no part is drawn twice.
  const tiles = [...dash.matchAll(/\["[a-z]+", "([^"]+)", /g)].map(m => m[1]);
  // Joshua 2026-09-15: "we don't need the assigned lead card anymore" — six tiles.
  assert.deepEqual(tiles, ["New Inquiries", "Evaluations Scheduled", "Evaluations Completed", "Sold", "Lost", "Clients"]);
  assert.doesNotMatch(dash, /Assigned Leads & Office Notes|My Locked Trainer Page|trainerPipelineBoard|trainerClientsSummary/);
  assert.match(app, /  leads\(\) \{\n    return `\$\{panel\("My Pipeline", "", trainerPipelineBoard\(trainerLeads\(currentTrainerId\(\)\)\), "pad"\)\}\$\{panel\("All My Leads & Office Notes"/);
  const onePage = app.match(/function trainerOnePage\(\) \{[\s\S]*?\n\}\n/)[0];
  assert.match(onePage, /const nav = trainerNav\(\);/, "sections follow the menu order");
  assert.match(onePage, /id="trainer-sec-\$\{view\}" data-spy-view="\$\{view\}"/);
  assert.match(onePage, /trainer-onepage-tabs/, "phones get the sticky tab strip");
  assert.match(app, /target\.innerHTML = onePage \? trainerOnePage\(\) : \(screens\[state\.activeView\]\?\.\(\) \|\| screens\.dashboard\(\)\);/);
  const click = app.match(/on the trainer's one page a tab is a jump[\s\S]*?return;\n    \}/)[0];
  assert.doesNotMatch(click, /render\(|reloadRemoteData/, "a tab click never redraws or reloads");
  assert.match(click, /scrollToTrainerSection\(view\.dataset\.view\);/);
  const spy = app.match(/let trainerSpyFrame = 0;[\s\S]*?\nfunction wireTrainerScrollSpy\(\) \{[\s\S]*?\n\}\n/)[0];
  assert.doesNotMatch(spy, /state\.activeView =|render\(|reloadRemoteData/, "never changes the screen, never redraws");
  assert.match(spy, /window\.addEventListener\("scroll", trainerSpyOnScroll, \{ passive: true \}\);/, "one light scroll listener, added once");
  assert.match(spy, /requestAnimationFrame\(trainerSpyUpdate\)/, "measured once per frame");
  assert.match(spy, /if \(window\.innerHeight \+ window\.scrollY >= document\.documentElement\.scrollHeight - 4\) current = sections\[sections\.length - 1\];/, "the last section lights at the bottom");
  assert.match(app, /  pinTrainerTab\(view\);\n  section\.scrollIntoView\(\{ behavior: smooth \? "smooth" : "auto", block: "start" \}\);/, "a tapped tab stays lit");
  assert.match(app, /restoreScrollState\(target, scrolled\);\n  wireTrainerScrollSpy\(\);/);
  // Both upload forms are on the one page with the same field names: a submit reads only its own panel.
  const submit = app.match(/if \(event\.target\.id === "submitDemoContent"\) \{[\s\S]*?const reviewVideoUrl[^\n]*\n/)[0];
  assert.match(submit, /const scope = event\.target\.closest\("\.panel"\) \|\| document;/);
  assert.doesNotMatch(submit, /document\.querySelector\('\[name="submission-/);
});

test("Submit a Deal: Program dropdown keeps any program; picking a lead fills and locks client + dog", () => {
  const escapeSrc = app.match(/function escapeHtml\([\s\S]*?\n\}\n/)[0];
  const listSrc = app.match(/const DEAL_PROGRAM_CHOICES = \[[^\]]*\];/)[0];
  const fieldSrc = app.match(/function dealProgramField\(f\) \{[\s\S]*?\n\}\n/)[0];
  const ctx = {};
  vm.runInNewContext(`${escapeSrc}\n${listSrc.replace("const ", "var ")}\n${fieldSrc}`, ctx);
  const known = ctx.dealProgramField({ program: "Behavior Modification", program_choice: "" });
  assert.match(known, /<option value="Behavior Modification" selected>/);
  assert.doesNotMatch(known, /data-deal-field="program"/, "no typing box for a listed program");
  // Meeting 2026-09-16: the real program list. Puppy training and Service Dog Training left it; an older
  // deal that named one keeps its words under Other.
  assert.deepEqual(Array.from(ctx.DEAL_PROGRAM_CHOICES), ["Board and Train", "Basic Obedience", "Basic Obedience Plus", "Obedience On Leash", "Obedience Off Leash", "Behavior Modification"]);
  assert.match(known, /<option value="Basic Obedience Plus" >/);
  assert.match(known, /<option value="__other"[^>]*>Other \(type it\)<\/option>/);
  const old = ctx.dealProgramField({ program: "Puppy Training & Socialization", program_choice: "" });
  assert.match(old, /value="__other" selected/);
  assert.match(old, /data-deal-field="program" value="Puppy Training &amp; Socialization"/, "an older deal keeps its words");
  const xss = ctx.dealProgramField({ program: '<img src=x onerror=alert(1)>', program_choice: "" });
  assert.doesNotMatch(xss, /<img/);
  assert.match(app, /if \(key === "lead_id"\) \{\n      const lead = value \? trainerLeads\(currentTrainerId\(\)\)\.find/);
  assert.match(app, /data-deal-field="client_name" value="\$\{escapeHtml\(f\.client_name\)\}" required placeholder="e\.g\. Kathy Robinson" \$\{f\.lead_id \? "readonly" : ""\}/);
  assert.match(app, /: JSON\.stringify\(\{ lead_id: f\.lead_id, client_name: f\.client_name, dog_name: f\.dog_name, program: f\.program,/, "a new deal still sends the same fields (edits use op update)");
});

// Joshua 2026-09-16: 50 miles (Tim's 2026-09-12 meeting had said 30). The page and the office email read
// RADIUS_MILES instead of spelling a number, so the next change is one line in lib/booking.js.
// trainer-backoffice/app.js still spells "30 miles" in its hints (other agents own that file on 2026-09-16);
// it is checked separately below so the gap is visible, not hidden.
test("booking radius is 50 miles everywhere the client or the office reads it", () => {
  assert.match(read("lib/booking.js"), /const RADIUS_MILES = 50;/);
  for (const file of ["lib/booking-page.js", "lib/office-email.js"]) {
    assert.doesNotMatch(read(file), /\b(30|50) miles/, `${file} spells the radius instead of reading RADIUS_MILES`);
  }
});

test("trainer-backoffice/app.js hints say 50 miles, never 30 (Joshua 2026-09-16)", () => {
  const app = readFileSync(new URL("../trainer-backoffice/app.js", import.meta.url), "utf8");
  assert.ok(!/30 miles|30-mile/.test(app), "app.js still says 30 miles somewhere");
  assert.ok(app.includes("within 50 miles of this ZIP"), "Base ZIP hint says 50 miles");
});

// Joshua 2026-09-16: "the roles can be established in the setting in the sales pipeline, not in the settings of
// the site ... only for super admin these settings are seen, and the wording also which should be able to be changed."
test("text wording + pipeline roles live under Sales Pipeline (Super Admin only), not under Settings", () => {
  const fn = name => {
    const start = app.indexOf(`function ${name}(`);
    assert.ok(start > -1, `${name} exists`);
    return app.slice(start, app.indexOf("\n}\n", start));
  };
  const settingsStart = app.indexOf("    settings() {");
  const settings = app.slice(settingsStart, app.indexOf("\n  }\n", settingsStart));
  assert.ok(settingsStart > -1);
  assert.doesNotMatch(settings, /pipelineTextsPanel\(|followUpTextsPanel\(|pipelineSettingsPanel\(/, "Settings no longer draws the text, follow-up or email panels");
  assert.match(settings, /practiceResetPanel\(\)/, "Settings keeps the practice-copy tools");
  assert.match(settings, /Sales Pipeline/, "Settings tells the Super Admin where the wording went");
  assert.match(fn("salesPipelineView"), /pipelineSettingsSection\(\)/);
  // Joshua 2026-09-16: "don't put it near the pipeline in any way; make it open in the same tab but a different tab
  // under Sales." Sub-tabs: Pipeline | Text settings & test scenarios (Super Admin, practice copy). Neither draws the other.
  const view = fn("salesPipelineView");
  assert.match(view, /salesTabsRow\(tab\)/, "the Sales view starts with the sub-tab row");
  assert.match(view, /if \(tab === "settings"\) return `\$\{tabsRow\}\$\{pipelineSettingsSection\(\)\}`;/, "the settings tab draws ONLY the settings section");
  assert.match(view, /return `\$\{tabsRow\}\$\{salesPipelineBoard\(\)\}`;/, "the board tab draws ONLY the board");
  assert.doesNotMatch(view, /sales-board|metricGrid|Close Rate by Source/, "no board markup in the dispatcher");
  const board = fn("salesPipelineBoard");
  assert.match(board, /sales-board/);
  assert.doesNotMatch(board, /pipelineSettingsSection|pipelineTextsPanel|pipelineTestScenariosPanel|followUpTextsPanel|pipelineSettingsPanel/, "the board never includes the settings");
  const tabsRow = fn("salesTabsRow");
  assert.match(tabsRow, /class="communications-tabs sales-tabs"/, "reuses the Communications tab styling");
  assert.match(tabsRow, /data-sales-tab="\$\{id\}"/);
  assert.match(tabsRow, /\["board", "Pipeline"\]/);
  assert.match(tabsRow, /salesSettingsTabAvailable\(\) \? \[\["settings", "Text settings & test scenarios"\]\] : \[\]/, "the settings tab exists only when allowed");
  assert.match(fn("salesSettingsTabAvailable"), /window\.LDTT_IS_SANDBOX\) && isSuperAdmin\(\)/, "Super Admin on the practice copy only");
  assert.match(fn("salesTabCurrent"), /state\.salesTab === "settings" && salesSettingsTabAvailable\(\) \? "settings" : "board"/, "a saved settings pick falls back to the board for everyone else");
  assert.match(app, /salesTab: "board",/, "default sub-tab is the board");
  assert.match(app, /const salesTab = event\.target\.closest\("\[data-sales-tab\]"\);\n  if \(salesTab\) \{\n[^\n]*\n    state\.salesTab = salesTab\.dataset\.salesTab === "settings" \? "settings" : "board";\n    saveState\(\);/, "document-level click delegate, like data-communications-section");
  const section = fn("pipelineSettingsSection");
  assert.match(section, /pipelineTestScenariosPanel\(\)/, "Test scenarios sit in the settings tab, above the wording");
  assert.ok(section.indexOf("pipelineTestScenariosPanel()") < section.indexOf('panel("Pipeline settings"'), "scenarios come before the roles/stages and wording panels");
  assert.doesNotMatch(section, /sales-board|salesPipelineBoard/, "the settings never include the board");
  // The scenarios panel: sandbox + Super Admin only, one "Send test" per row through the existing text_test op.
  const scenarios = fn("pipelineTestScenariosPanel");
  assert.match(scenarios, /^function pipelineTestScenariosPanel\(\) \{\n  if \(!window\.LDTT_IS_SANDBOX \|\| !isSuperAdmin\(\)\) return "";/);
  assert.match(scenarios, /data-ptx-test="\$\{escapeHtml\(keys\.join\(","\)\)\}"/, "a row sends every text of the scenario");
  // Rule 95: a test now follows the same rules as the real text; the note says which handset each role reaches.
  assert.match(scenarios, /A test follows the same rules as the real text \(rule 95\)/, "says how a test is routed");
  assert.match(scenarios, /a test never reaches a real trainer/, "a trainer test can never reach a real trainer");
  assert.match(fn("pipelineTextClick"), /if \(keys\.length > 1\) ptextSendTests\(keys\); else ptextPost\(\{ op: "text_test", key, words \}\);/);
  const list = app.slice(app.indexOf("const PIPELINE_TEST_SCENARIOS = ["), app.indexOf("function pipelineTestScenariosPanel("));
  const texts = readFileSync(new URL("../lib/pipeline-texts.js", import.meta.url), "utf8");
  for (const label of ["New lead (Cleveland 44118)", "New lead, nobody in range (10001)", "Evaluation booked", "Pre-eval answered", "Eval completed → log the deal"]) assert.ok(list.includes(`label: "${label}"`), `scenario ${label}`);
  const expected = { new_lead_cleveland: ["booking_link", "trainer_new_inquiry", "ops_new_lead"], new_lead_nobody: [null, null, "ops_new_lead"], eval_booked: ["booking_confirmation", "trainer_new_eval", "ops_eval_booked"], pre_eval_answered: [null, "pre_eval_answers", null], eval_completed: [null, "trainer_log_deal", null] };
  for (const [id, [client, trainer, operations]] of Object.entries(expected)) {
    const row = list.slice(list.indexOf(`id: "${id}"`), list.indexOf("email:", list.indexOf(`id: "${id}"`)));
    assert.ok(row.includes(`client: ${client ? `"${client}"` : "null"}`), `${id} client text`);
    assert.ok(row.includes(`trainer: ${trainer ? `"${trainer}"` : "null"}`), `${id} trainer text`);
    assert.ok(row.includes(`operations: ${operations ? `"${operations}"` : "null"}`), `${id} operations text`);
    for (const key of [client, trainer, operations].filter(Boolean)) assert.ok(texts.includes(`key: "${key}"`), `${key} is a real text in lib/pipeline-texts.js`);
  }
  assert.match(list, /Production email|email: "/, "each row says what the office gets by email");
  assert.match(section, /^function pipelineSettingsSection\(\) \{\n  if \(!isSuperAdmin\(\)\) return "";/, "office admins and trainers see nothing extra");
  assert.match(section, /pipelineTextsPanel\(\)/);
  assert.match(section, /followUpTextsPanel\(\)/);
  assert.match(section, /pipelineSettingsPanel\(\)/);
  assert.match(section, /Who gets which text, and the words they get\. Super Admin only\./);
  const fallback = app.slice(app.indexOf("const PIPELINE_TEXT_ROLE_FALLBACK = ["), app.indexOf("function pipelineSettingsSection("));
  for (const role of ["client", "trainer", "operations"]) assert.match(fallback, new RegExp(`key: "${role}"`), `role legend lists ${role}`);
  assert.match(section, /PIPELINE_TEXT_ROLE_FALLBACK/, "the legend falls back to the catalog roles before the texts load");
  assert.match(section, /data-ptx-role=/, "role chips filter the texts");
  assert.match(section, /data-ptx-stage=/, "stage chips filter the texts");
  // The click delegate on document handles both, so the panels work wherever they render.
  assert.match(app, /event\.target\.closest\("\[data-ptx-role\], \[data-ptx-stage\], \[data-ptx-open\]/);
  assert.match(fn("pipelineTextClick"), /hit\("stage"\)/);
  assert.doesNotMatch(app, /activeView === "settings"[^\n]*pipelineTexts/, "no Settings-only guard on the texts");
});
