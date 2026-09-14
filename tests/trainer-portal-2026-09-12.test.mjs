// Trainer portal changes from the 2026-09-12 meeting (Joshua, Tim, Angela). DO-NOT-BREAK rule 80.
//   - Dashboard tiles: Assigned / Evaluations Scheduled / Evaluations Completed / Sold / Lost (metrics.js).
//   - Working board: New Inquiry -> Eval Scheduled -> Eval Completed -> Sold -> Lost (metrics.js).
//   - "My Deals" is "Clients": Clients (Track 500 countdown) / Revenue / Collected / Balance Due / Contracted Revenue.
//   - Performance left the menu (saved screen -> Dashboard); Communications left the menu, its screen is kept.
//   - Submit a Deal: the lead fills client + dog; Program is a dropdown with "Other (type it)".
//   - Sales column "Confirmed" reads "Eval Questions Completed" (label only). Booking radius 30 miles.
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

test("trainer board: every listed status lands in exactly one column; cancelled sits with Lost; never-call statuses and unknown are not drawn", () => {
  const leads = [
    lead("a", "New Inquiry"), lead("b", "Office Contacted"), lead("c", "Engaged Lead: No Outcome"),
    lead("d", "Evaluation Scheduled"), lead("e", "Evaluation Complete"), lead("f", "Became a Client"),
    lead("g", "Lost - Price Concern"), lead("h", "Evaluation Cancelled"), lead("i", "Archived"), lead("j", "Something Else"),
    lead("k", "Do Not Contact"), lead("l", "Bad Lead")
  ];
  const board = metrics.trainerPipeline(leads);
  assert.deepEqual([...board.keys()], ["inquiry", "scheduled", "completed", "sold", "lost"]);
  assert.deepEqual(board.get("inquiry").map(l => l.id), ["a", "b", "c"]);
  assert.deepEqual(board.get("scheduled").map(l => l.id), ["d"]);
  assert.deepEqual(board.get("completed").map(l => l.id), ["e"]);
  assert.deepEqual(board.get("sold").map(l => l.id), ["f"]);
  assert.deepEqual(board.get("lost").map(l => l.id), ["g", "h"], "a trainer is never told to call Do Not Contact, Bad Lead or Archived");
  assert.equal([...board.values()].flat().length, leads.length - 4);
  assert.deepEqual(metrics.TRAINER_PIPELINE_STAGES.map(s => s[1]), ["New Inquiry", "Eval Scheduled", "Eval Completed", "Sold", "Lost"]);
});

test("trainer dashboard tiles agree with the board (rule 34: one source)", () => {
  const leads = [lead("a", "New Inquiry"), lead("d", "Evaluation Scheduled"), lead("dd", "Evaluation Scheduled"), lead("e", "Evaluation Complete"), lead("f", "Became a Client"), lead("g", "Lost - Not Ready")];
  const dash = metrics.trainerDashboard(leads, [{ status: "Pending" }]);
  const board = metrics.trainerPipeline(leads);
  assert.equal(dash.assigned, 6);
  assert.equal(dash.newInquiries, board.get("inquiry").length, "New Inquiries tile (2026-09-14) = the board's first column");
  assert.equal(dash.evalScheduled, board.get("scheduled").length);
  assert.equal(dash.evalCompleted, board.get("completed").length);
  assert.equal(dash.won, board.get("sold").length);
  assert.equal(dash.lost, board.get("lost").length);
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
  assert.equal(td.revenueGoal, 1250000); assert.equal(td.revenueToGo, 1250000 - 7600);
  const done = metrics.trainerDeals([{ id: "x", client_name: "Big", sold_amount: 2000000, collected_amount: 0, balance_due: 0, status: "paid" }], [], "2026-09-13");
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
  assert.deepEqual(tiles, ["New Inquiries", "Assigned Leads", "Evaluations Scheduled", "Evaluations Completed", "Sold", "Lost", "Clients"]);
  assert.doesNotMatch(dash, /Assigned Leads & Office Notes|My Locked Trainer Page|trainerPipelineBoard|trainerClientsSummary/);
  assert.match(app, /  leads\(\) \{\n[^\n]*\n    return `\$\{panel\("My Pipeline", "", trainerPipelineBoard\(trainerLeads\(currentTrainerId\(\)\)\), "pad"\)\}\$\{panel\("All My Leads & Office Notes"/);
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
  const old = ctx.dealProgramField({ program: "Basic Obedience", program_choice: "" });
  assert.match(old, /value="__other" selected/);
  assert.match(old, /data-deal-field="program" value="Basic Obedience"/, "an older deal keeps its words");
  const xss = ctx.dealProgramField({ program: '<img src=x onerror=alert(1)>', program_choice: "" });
  assert.doesNotMatch(xss, /<img/);
  assert.match(app, /if \(key === "lead_id"\) \{\n      const lead = value \? trainerLeads\(currentTrainerId\(\)\)\.find/);
  assert.match(app, /data-deal-field="client_name" value="\$\{escapeHtml\(f\.client_name\)\}" required placeholder="e\.g\. Kathy Robinson" \$\{f\.lead_id \? "readonly" : ""\}/);
  assert.match(app, /body: JSON\.stringify\(\{ lead_id: f\.lead_id, client_name: f\.client_name, dog_name: f\.dog_name, program: f\.program,/, "the server still gets the same fields");
});

test("booking radius is 30 miles everywhere the client or the office reads it", () => {
  assert.match(read("lib/booking.js"), /const RADIUS_MILES = 30;/);
  for (const file of ["lib/booking-page.js", "lib/office-email.js", "trainer-backoffice/app.js"]) {
    assert.doesNotMatch(read(file), /50 miles/, `${file} still says 50 miles`);
  }
});
