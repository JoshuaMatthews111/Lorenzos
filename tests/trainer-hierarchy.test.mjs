// The trainer hierarchy helpers (rule 105, Joshua 2026-09-25, from the owner's chart "Hierarchy - 9-23-26").
// lib/hierarchy.js is the ONE home of the tree logic: validate, upline, downline, "is X in Y's downline", can send.
// Also pins the stored chart: the committed migration's value validates, has the owner + the 30 people, and every
// rank matches the chart's ring colours.
// Run: node --test tests/   Nothing here talks to the real project.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const H = require("../lib/hierarchy.js");
const read = path => readFileSync(resolve(import.meta.dirname, "..", path), "utf8");

const MIGRATION = "supabase/migrations/20260925120000_trainer_hierarchy.sql";
const chartFromMigration = () => JSON.parse(read(MIGRATION).match(/\$chart\$([\s\S]*?)\$chart\$/)[1]);

// A small chart:  own -> a -> b -> d
//                            b -> e -> g
//                       a -> c
const small = () => ({
  owner_slug: "own", updated_from: "test",
  nodes: [
    { slug: "own", parent_slug: null, rank: "owner" },
    { slug: "a", parent_slug: "own", rank: "senior_vice_president" },
    { slug: "b", parent_slug: "a", rank: "team_coordinator" },
    { slug: "c", parent_slug: "a", rank: "team_trainer" },
    { slug: "d", parent_slug: "b", rank: "team_trainer" },
    { slug: "e", parent_slug: "b", rank: "executive_team_trainer" },
    { slug: "g", parent_slug: "e", rank: "team_trainer" }
  ]
});

test("validateTree: the small chart is valid; readTree builds it", () => {
  assert.deepEqual(H.validateTree(small()), { ok: true, errors: [] });
  const tree = H.readTree(small());
  assert.equal(tree.ok, true);
  assert.equal(tree.owner, "own");
  assert.deepEqual(tree.children.get("b"), ["d", "e"]);
});

test("validateTree refuses cycles, missing parents, unknown ranks, duplicates, a second root and a bad owner", () => {
  const bad = mutate => { const v = small(); mutate(v); return H.validateTree(v); };
  const cycle = bad(v => { v.nodes.find(n => n.slug === "a").parent_slug = "g"; });
  assert.equal(cycle.ok, false);
  assert.ok(cycle.errors.some(e => /loop/.test(e)), cycle.errors.join(" | "));
  const self = bad(v => { v.nodes.find(n => n.slug === "c").parent_slug = "c"; });
  assert.ok(self.errors.some(e => /reports to itself/.test(e)));
  const missing = bad(v => { v.nodes.find(n => n.slug === "d").parent_slug = "nobody"; });
  assert.ok(missing.errors.some(e => /d reports to nobody, who is not on the chart/.test(e)), missing.errors.join(" | "));
  const rank = bad(v => { v.nodes.find(n => n.slug === "d").rank = "grand_wizard"; });
  assert.ok(rank.errors.some(e => /unknown rank/.test(e)));
  const dup = bad(v => { v.nodes.push({ slug: "d", parent_slug: "a", rank: "team_trainer" }); });
  assert.ok(dup.errors.some(e => /twice/.test(e)));
  const orphanRoot = bad(v => { v.nodes.push({ slug: "z", parent_slug: null, rank: "team_trainer" }); });
  assert.ok(orphanRoot.errors.some(e => /z reports to no one/.test(e)));
  const ownerMissing = bad(v => { v.owner_slug = "ghost"; });
  assert.ok(ownerMissing.errors.some(e => /owner ghost is not on the chart/.test(e)));
  const ownerHasBoss = bad(v => { v.nodes[0].parent_slug = "a"; });
  assert.equal(ownerHasBoss.ok, false);
  const secondOwnerRank = bad(v => { v.nodes.find(n => n.slug === "c").rank = "owner"; });
  assert.ok(secondOwnerRank.errors.some(e => /owner rank but is not the owner/.test(e)));
  for (const junk of [null, undefined, "x", [], {}, { owner_slug: "own" }, { owner_slug: "own", nodes: [] }]) {
    assert.equal(H.validateTree(junk).ok, false, JSON.stringify(junk));
    assert.equal(H.readTree(junk).ok, false);
  }
  // A cycle never hangs a walk: readTree refuses the value, so no helper ever walks it.
  const looped = small(); looped.nodes.find(n => n.slug === "a").parent_slug = "g";
  assert.equal(H.readTree(looped).ok, false);
});

test("uplineOf: nearest first, ends at the owner; unknown slug and the owner have none", () => {
  const tree = H.readTree(small());
  assert.deepEqual(H.uplineOf(tree, "g"), ["e", "b", "a", "own"]);
  assert.deepEqual(H.uplineOf(tree, "c"), ["a", "own"]);
  assert.deepEqual(H.uplineOf(tree, "own"), []);
  assert.deepEqual(H.uplineOf(tree, "nobody"), []);
  assert.deepEqual(H.uplineOf(tree, " G "), ["e", "b", "a", "own"], "slugs are trimmed and lower-cased");
  assert.deepEqual(H.uplineOf({ ok: false }, "g"), [], "an invalid chart has no upline");
});

test("downlineOf: every descendant, depth first, with depth; a leaf and an unknown slug have none", () => {
  const tree = H.readTree(small());
  assert.deepEqual(H.downlineOf(tree, "b").map(n => [n.slug, n.depth]), [["d", 1], ["e", 1], ["g", 2]]);
  assert.deepEqual(H.downlineOf(tree, "own").map(n => n.slug), ["a", "b", "d", "e", "g", "c"], "the owner gets the whole tree");
  assert.deepEqual(H.downlineOf(tree, "d"), []);
  assert.deepEqual(H.downlineOf(tree, "nobody"), []);
});

test("isInDownline / canSendTo: down only — never up, never sideways, never yourself, never a stranger", () => {
  const tree = H.readTree(small());
  assert.equal(H.isInDownline(tree, "b", "g"), true, "two levels down");
  assert.equal(H.isInDownline(tree, "b", "d"), true);
  assert.equal(H.isInDownline(tree, "b", "a"), false, "up");
  assert.equal(H.isInDownline(tree, "b", "own"), false, "up to the owner");
  assert.equal(H.isInDownline(tree, "b", "c"), false, "sideways (same parent)");
  assert.equal(H.isInDownline(tree, "d", "e"), false, "sideways (siblings)");
  assert.equal(H.isInDownline(tree, "d", "g"), false, "a cousin's child");
  assert.equal(H.isInDownline(tree, "b", "b"), false, "yourself");
  assert.equal(H.isInDownline(tree, "b", "stranger"), false, "not on the chart");
  assert.equal(H.isInDownline(tree, "stranger", "d"), false, "an unknown sender has no downline");
  assert.equal(H.canSendTo(tree, "b", "g"), true);
  assert.equal(H.canSendTo(tree, "b", "a"), false);
  assert.equal(H.canSendTo(tree, "own", "g"), true, "the owner may send to anyone on the chart");
  assert.equal(H.canSendTo(tree, "own", "c"), true);
  assert.equal(H.canSendTo(tree, "own", "own"), false);
  assert.equal(H.canSendTo(tree, "own", "stranger"), false, "not even the owner can send to someone off the chart");
  assert.equal(H.canSendTo({ ok: false }, "own", "a"), false, "an invalid chart refuses everything");
});

test("nestedDownline: not on the site = not listed, and the people under them move up a level", () => {
  const tree = H.readTree(small());
  const active = new Set(["a", "b", "c", "d", "g"]); // e is inactive
  const view = H.nestedDownline(tree, "b", s => active.has(s));
  assert.deepEqual(view, [
    { slug: "d", rank: "team_trainer", depth: 1, children: [] },
    { slug: "g", rank: "team_trainer", depth: 1, children: [] }
  ]);
  const whole = H.nestedDownline(tree, "own", s => active.has(s));
  assert.deepEqual(H.flattenNested(whole).map(n => [n.slug, n.depth]), [["a", 1], ["b", 2], ["d", 3], ["g", 3], ["c", 2]]);
  assert.equal(H.flattenNested(whole).some(n => n.slug === "e"), false);
  assert.deepEqual(H.nestedDownline(tree, "d"), [], "a leaf");
  assert.deepEqual(H.nestedDownline(tree, "nobody"), []);
});

test("the stored chart (committed migration): owner + 30 people, valid, the chart's ranks, server-only in both schemas", () => {
  const value = chartFromMigration();
  assert.deepEqual(H.validateTree(value), { ok: true, errors: [] });
  assert.equal(value.owner_slug, "lorenzo-miller");
  assert.equal(value.updated_from, "Hierarchy - 9-23-26");
  assert.equal(value.nodes.length, 31, "Lorenzo + 30");
  const tree = H.readTree(value);
  assert.deepEqual(tree.children.get("lorenzo-miller"), ["john-delbane"], "the owner sits above John DelBane");
  assert.equal(H.downlineOf(tree, "lorenzo-miller").length, 30);
  const byRank = rank => value.nodes.filter(n => n.rank === rank).map(n => n.slug).sort();
  assert.deepEqual(byRank("owner"), ["lorenzo-miller"]);
  assert.deepEqual(byRank("senior_vice_president"), ["emilio-marotta", "john-delbane"]);
  assert.deepEqual(byRank("regional_director"), ["shavon-striggles"]);
  assert.deepEqual(byRank("master_trainer"), ["daniel-bainbridge"]);
  assert.deepEqual(byRank("team_coordinator"), ["carolina-perez", "eric-beck", "eric-hardaway", "jacob-perez", "michael-king", "robert-wesling", "tristan-gray"]);
  assert.deepEqual(byRank("executive_team_trainer"), ["bailey-brown", "clark-patton", "victoria-bayleigh-morris"]);
  assert.equal(byRank("team_trainer").length, 16);
  // Spot checks straight off the chart.
  assert.deepEqual(H.uplineOf(tree, "karemela-sefferin"), ["genevieve-twilla", "fred-harris", "carolina-perez", "jacob-perez", "daniel-bainbridge", "shavon-striggles", "emilio-marotta", "john-delbane", "lorenzo-miller"]);
  assert.deepEqual(H.downlineOf(tree, "daniel-bainbridge").map(n => n.slug), ["tristan-gray", "victoria-bayleigh-morris", "bailey-brown", "jasmine-bland", "shannon-paskins", "tabatha-shelley", "jacob-perez", "carolina-perez", "fred-harris", "genevieve-twilla", "karemela-sefferin", "giovanni-gutierrez", "sean-urena", "michael-king", "clark-patton", "dylan-atkinson", "arion-goble"]);
  assert.deepEqual(H.downlineOf(tree, "eric-beck").map(n => n.slug), ["brady-deremer", "harley-mcgrew"]);
  assert.equal(H.canSendTo(tree, "daniel-bainbridge", "shavon-striggles"), false, "never up");
  assert.equal(H.canSendTo(tree, "daniel-bainbridge", "robert-wesling"), false, "never sideways");
  const sql = read(MIGRATION);
  for (const schema of ["public", "practice"]) {
    assert.match(sql, new RegExp(`create policy "trainer_hierarchy_server_only" on ${schema}\\.site_settings\\n  as restrictive for all to authenticated, anon\\n  using \\(key <> 'trainer_hierarchy'\\)\\n  with check \\(key <> 'trainer_hierarchy'\\);`), `${schema}: no browser login can read or write the chart`);
  }
  assert.ok(sql.indexOf("create policy") < sql.indexOf("insert into public.site_settings"), "the policy exists before the row does");
  assert.equal(H.SETTINGS_KEY, "trainer_hierarchy");
  assert.match(H.SETTINGS_KEY, /^[a-z_]{1,40}$/, "fits the site_settings key CHECK");
});
