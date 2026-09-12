// Vetting pass 2026-09-12 (DO-NOT-BREAK rule 78): what a picky client found in the practice-copy screenshots.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const read = p => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("booking cards show one state style: the postal code, never the full name", () => {
  const B = require("../lib/booking.js");
  assert.equal(B.marketLabel({ market: "Crestview", state: "Florida" }), "Crestview, FL");
  assert.equal(B.marketLabel({ market: "Streetsboro, Ohio" }), "Streetsboro, OH");
  assert.equal(B.marketLabel({ market: "Cleveland, OH" }), "Cleveland, OH");
  assert.equal(B.marketLabel({ market: "Market pending", service_area: "Cleveland Heights, OH" }), "Cleveland Heights, OH");
  assert.equal(B.marketLabel({ market: "Lakewood, Cleveland" }), "Lakewood, Cleveland", "only a real state name is shortened");
});

test("booking page: the distance never breaks onto two lines", () => {
  const page = read("lib/booking-page.js");
  assert.match(page, /\.nowrap\{white-space:nowrap\}/);
  assert.match(page, /<span class="nowrap">· ' \+ esc\(milesText\(c\.miles\)\)/, "the dot travels with the distance, never left dangling");
});

test("practice banner never covers the lead panel's close button or the full-screen editor top bar", () => {
  const app = read("trainer-backoffice/app.js");
  const css = read("trainer-backoffice/styles.css");
  assert.match(app, /setProperty\("--ldtt-banner-h", `\$\{banner\.offsetHeight\}px`\)/);
  assert.match(css, /body\.is-sandbox \.lead-detail-panel\{top:var\(--ldtt-banner-h,0px\);height:calc\(100vh - var\(--ldtt-banner-h,0px\)\)\}/);
  assert.match(css, /body\.is-sandbox\.ps-builder-fullscreen \.page-editor-shell\.fullscreen-builder\{top:var\(--ldtt-banner-h,0px\)\}/);
  assert.ok(!/(^|[^-])\.lead-detail-panel\{[^}]*top:var/.test(css.replace(/body\.is-sandbox \.lead-detail-panel\{[^}]*\}/, "")), "live keeps top:0");
});

test("full-screen Page Editor keeps a way to Lead forms and Page Studio", () => {
  const studio = read("trainer-backoffice/page-studio.js");
  assert.match(studio, /\[\["formEditor", "Lead forms"\], \["pageStudio", "Page Studio"\]\]/);
  assert.match(studio, /door\.dataset\.view = view/);
});

test("the Sales board never says 'ready for testing'", () => {
  const app = read("trainer-backoffice/app.js");
  assert.ok(!app.includes("ready for testing"));
  assert.ok(app.includes('<p class="sales-empty">No leads in this stage yet.</p>'));
});
