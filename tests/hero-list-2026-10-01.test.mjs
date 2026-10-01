// Rule 159 (office 2026-10-01, Arrison): the list in the top photo ("PROFESSIONAL DOG TRAINING") reads Puppy,
// Obedience, Behavior Modification, Board & Train, Service Dog like the cards, and each line opens its program panel.
// It keeps FIVE lines with the same words, so the office's position moves (elbox "hero:<n>") land where they did.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const T = require("../lib/ad2-page-template.js");

const heroOf = html => html.match(/<section (?:data-sb-sec="[^"]*" )?class="sec hero[\s\S]*?<\/section>/)[0];
const designs = ["d1", "d2", "d3"].map(d => T.STARTERS.find(s => s.design === d)).filter(Boolean);

test("every design: the top-photo list is Puppy, Obedience, Behavior, Board & Train, Service Dog and each line opens its panel", () => {
  assert.equal(designs.length, 3);
  for (const c of designs) {
    const html = T.renderPage(c, {});
    const keys = [...heroOf(html).matchAll(/<li class="a" data-open="svc-(\w+)" role="button" tabindex="0"/g)].map(m => m[1]);
    assert.deepEqual(keys, ["puppy", "obedience", "behavior", "board", "service"], c.design);
    for (const k of keys) assert.ok(html.includes(`id="m-svc-${k}"`), `${c.design}: panel ${k} exists`);
    assert.match(heroOf(html), /Puppy Training<br>&amp; Socialization/);
  }
});

test("the list keeps 5 lines and 12 positioned elements, so the office's moves stay on the same elements", () => {
  for (const c of designs) {
    const hero = heroOf(T.renderPage(c, {}));
    assert.equal((hero.match(/<li class="a"/g) || []).length, 5, c.design);
    assert.equal((hero.match(/<[a-z0-9]+ class="a[ "]/g) || []).length, 12, `${c.design}: hero:0 .. hero:11`);
  }
  // Tallahassee (live + sandbox) moves hero:9 - the Board & Train line before and after this change - and hero:4, the panel.
  const d1 = designs.find(c => c.design === "d1");
  const moved = T.renderPage({ ...d1, elbox: { "hero:9": { dx: -3, dy: 6 }, "hero:11": { dx: 8, dy: 17 } } }, {});
  const lis = [...heroOf(moved).matchAll(/<li class="a" data-open="svc-(\w+)"[^>]*style="([^"]*)"/g)];
  const board = lis.find(m => m[1] === "board");
  const plain = [...heroOf(T.renderPage(d1, {})).matchAll(/<li class="a" data-open="svc-(\w+)"[^>]*style="([^"]*)"/g)].find(m => m[1] === "board");
  assert.notEqual(board[2], plain[2], "hero:9 still moves the Board & Train line");
  assert.match(heroOf(moved), /<a class="a btn-white"[^>]*style="[^"]*--x:(?!.*--x)/);
});

test("Enter or Space on a list line opens it, and the lines look clickable", () => {
  const js = readFileSync(new URL("../assets/v2/v2.js", import.meta.url), "utf8");
  assert.match(js, /li\[data-open\]\[role=button\]/);
  const css = readFileSync(new URL("../assets/v2/v2.css", import.meta.url), "utf8");
  assert.match(css, /\.panel li\[data-open\]\{cursor:pointer\}/);
  assert.equal(T.VERSION, "20261001ad23");
});
