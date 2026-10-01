// Rule 161 (office 2026-10-01, Arrison: "add Illinois and NY to the state tabs"; Joshua: "from now on the site will
// automatically add a state when one does not exist"): Find a Trainer builds its state buttons from the trainer cards.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const src = readFileSync(new URL("../script.js", import.meta.url), "utf8");
const start = src.indexOf("const US_STATES=");
const end = src.indexOf("function refreshStateFilters()");
const ctx = { escapePublicText: s => String(s) };
vm.createContext(ctx);
vm.runInContext(`${src.slice(start, end)}; this.trainerCardStates = trainerCardStates;`, ctx);

const card = ({ name, tag, location, area }) => ({
  dataset: { search: `${name} ${location} ${area}`.toLowerCase() },
  querySelector: sel => ({ ".trainer-info .tag": { textContent: tag }, ".trainer-card-location": { textContent: location }, ".trainer-info h3": { textContent: name } })[sel] || null
});

test("a trainer counts in their own state, any state their location names, and the metro areas they serve", () => {
  const states = c => [...ctx.trainerCardStates(card(c))].sort();
  assert.deepEqual(states({ name: "Jasmine Bland", tag: "Indiana", location: "Hammond, Indiana", area: "Northwest Indiana (NWI) and the Chicagoland area" }), ["Illinois", "Indiana"]);
  assert.deepEqual(states({ name: "Sean Urena", tag: "New York", location: "Flushing, NY", area: "Flushing, NY" }), ["New York"]);
  assert.deepEqual(states({ name: "Tristan Gray", tag: "New Hampshire", location: "Durham, NH", area: "Durham and surrounding New Hampshire communities" }), ["New Hampshire"]);
  assert.deepEqual(states({ name: "Virginia Ohio", tag: "Ohio", location: "Cleveland, OH", area: "Cleveland and surrounding Ohio communities" }), ["Ohio"], "a trainer's name is never a state");
  assert.deepEqual(states({ name: "New Trainer", tag: "Colorado", location: "Denver, CO", area: "" }), ["Colorado"], "a new state needs no code change");
});

test("the buttons are rebuilt from the cards (first paint already has Illinois and New York); filter by state, not by text", () => {
  assert.match(src, /function refreshStateFilters\(\)\{[\s\S]*filtersBox\.innerHTML=/);
  assert.match(src, /refreshStateFilters\(\); \/\/ rule 161: the live roster may bring a new state\n  updateTrainers\(\);/);
  assert.match(src, /card\.dataset\.states\.split\('\|'\)\.includes\(filter\)/);
  assert.doesNotMatch(src, /const buttons=\[\.\.\.document\.querySelectorAll\('\.filter-btn'\)\]/, "no fixed button list");
  const html = readFileSync(new URL("../find-a-trainer.html", import.meta.url), "utf8");
  for (const s of ["illinois", "new york"]) assert.match(html, new RegExp(`data-filter="${s}"`));
  assert.doesNotMatch(html, /ten state directories/);
});
