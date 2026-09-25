// The trainer hierarchy (the owner's chart "Hierarchy - 9-23-26", Joshua 2026-09-25). DO-NOT-BREAK rule 105.
// "Send a lead to someone in your downline": a lead only ever moves DOWN the tree, never up, never sideways.
// Lorenzo (trainer row lorenzo-miller) is the owner: he sees the whole tree and can send a lead to anyone on it.
//
// The tree lives in site_settings key "trainer_hierarchy" (both schemas, server only):
//   { owner_slug: "lorenzo-miller", updated_from: "Hierarchy - 9-23-26", nodes: [{ slug, parent_slug, rank }] }
// The owner is a node too (parent_slug null, rank "owner"). Every other node's parent_slug names another node.
//
// Pure helpers, no I/O: parse + validate the value, walk up (upline) and down (downline), and answer
// "is X in Y's downline". Every walk is cycle-safe, so a bad row can never hang a request; a value that does not
// validate is refused as a whole (readTree returns ok:false) and every hand-off is then refused (fail closed).
"use strict";

const SETTINGS_KEY = "trainer_hierarchy";
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// The chart's ring colours. Keys are what the setting stores; labels are what trainers read.
const RANKS = {
  owner: { label: "Owner", order: 0 },
  senior_vice_president: { label: "Senior Vice President", order: 1 },
  regional_director: { label: "Regional Director", order: 2 },
  master_trainer: { label: "Master Trainer", order: 3 },
  team_coordinator: { label: "Team Coordinator", order: 4 },
  executive_team_trainer: { label: "Executive Team Trainer", order: 5 },
  team_trainer: { label: "Team Trainer", order: 6 }
};

function rankLabel(rank) {
  return RANKS[rank]?.label || "";
}

const cleanSlug = value => String(value ?? "").trim().toLowerCase();

// Check a stored value. Returns { ok, errors[] }; errors are plain sentences for the office / logs.
function validateTree(value) {
  const errors = [];
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ok: false, errors: ["The chart is empty or not an object."] };
  const owner = cleanSlug(value.owner_slug);
  if (!SLUG.test(owner)) errors.push("owner_slug is missing or not a slug.");
  if (!Array.isArray(value.nodes) || !value.nodes.length) return { ok: false, errors: [...errors, "nodes is missing or empty."] };

  const parents = new Map();
  for (const [i, node] of value.nodes.entries()) {
    const slug = cleanSlug(node?.slug);
    const parent = node?.parent_slug == null || node?.parent_slug === "" ? null : cleanSlug(node.parent_slug);
    if (!SLUG.test(slug)) { errors.push(`Node ${i + 1} has no valid slug.`); continue; }
    if (parents.has(slug)) { errors.push(`${slug} is on the chart twice.`); continue; }
    if (!Object.prototype.hasOwnProperty.call(RANKS, node?.rank)) errors.push(`${slug} has an unknown rank "${node?.rank}".`);
    if (parent !== null && !SLUG.test(parent)) errors.push(`${slug} has a parent that is not a slug.`);
    if (parent === slug) errors.push(`${slug} reports to itself.`);
    parents.set(slug, parent);
  }
  if (SLUG.test(owner)) {
    if (!parents.has(owner)) errors.push(`The owner ${owner} is not on the chart.`);
    else if (parents.get(owner) !== null) errors.push(`The owner ${owner} must not report to anyone.`);
  }
  for (const [slug, parent] of parents) {
    if (slug === owner) continue;
    if (parent === null) errors.push(`${slug} reports to no one (only the owner may).`);
    else if (!parents.has(parent)) errors.push(`${slug} reports to ${parent}, who is not on the chart.`);
    if (value.nodes.find(n => cleanSlug(n?.slug) === slug)?.rank === "owner") errors.push(`${slug} has the owner rank but is not the owner.`);
  }
  // Cycles and reachability: walk up from every node; a walk must end at the owner within parents.size steps.
  for (const slug of parents.keys()) {
    const seen = new Set([slug]);
    let at = slug;
    let reached = at === owner;
    while (!reached) {
      const up = parents.get(at);
      if (up == null || !parents.has(up)) break;
      if (seen.has(up)) { errors.push(`${slug} is in a loop (${[...seen, up].join(" -> ")}).`); break; }
      seen.add(up);
      at = up;
      reached = at === owner;
    }
    if (!reached && !errors.some(e => e.startsWith(`${slug} `))) errors.push(`${slug} cannot be reached from the owner.`);
  }
  return { ok: errors.length === 0, errors };
}

// Parse a stored value into a tree object, or { ok:false, errors }. Only a valid chart is ever used.
function readTree(value) {
  const check = validateTree(value);
  if (!check.ok) return { ok: false, errors: check.errors };
  const nodes = new Map();
  const children = new Map();
  for (const node of value.nodes) {
    const slug = cleanSlug(node.slug);
    const parent = node.parent_slug == null || node.parent_slug === "" ? null : cleanSlug(node.parent_slug);
    nodes.set(slug, { slug, parent_slug: parent, rank: node.rank });
    if (!children.has(slug)) children.set(slug, []);
    if (parent !== null) (children.get(parent) || children.set(parent, []).get(parent)).push(slug);
  }
  return { ok: true, owner: cleanSlug(value.owner_slug), updated_from: String(value.updated_from || ""), nodes, children };
}

const has = (tree, slug) => Boolean(tree?.ok && tree.nodes.has(cleanSlug(slug)));

// The parent chain, nearest first: [parent, grandparent, ..., owner]. Unknown slug or the owner -> [].
function uplineOf(tree, slug) {
  const start = cleanSlug(slug);
  if (!has(tree, start)) return [];
  const out = [];
  const seen = new Set([start]);
  let at = tree.nodes.get(start).parent_slug;
  while (at && tree.nodes.has(at) && !seen.has(at)) {
    out.push(at);
    seen.add(at);
    at = tree.nodes.get(at).parent_slug;
  }
  return out;
}

// Every descendant, depth first in chart order, with depth (1 = reports straight to slug). Unknown slug -> [].
function downlineOf(tree, slug) {
  const start = cleanSlug(slug);
  if (!has(tree, start)) return [];
  const out = [];
  const seen = new Set([start]);
  const walk = (at, depth) => {
    for (const child of tree.children.get(at) || []) {
      if (seen.has(child)) continue;
      seen.add(child);
      out.push({ slug: child, parent_slug: at, depth, rank: tree.nodes.get(child).rank });
      walk(child, depth + 1);
    }
  };
  walk(start, 1);
  return out;
}

// Is `slug` somewhere below `ancestor`? Never true for yourself, for an unknown slug, or upward/sideways.
function isInDownline(tree, ancestor, slug) {
  const a = cleanSlug(ancestor);
  const s = cleanSlug(slug);
  if (!has(tree, a) || !has(tree, s) || a === s) return false;
  return uplineOf(tree, s).includes(a);
}

// May `from` send a lead to `to`? Down only. The owner may send to anyone on the chart but himself — which is the
// same set (every node is reachable from the owner), spelled out so the rule survives any future edit.
function canSendTo(tree, from, to) {
  const f = cleanSlug(from);
  const t = cleanSlug(to);
  if (!has(tree, f) || !has(tree, t) || f === t) return false;
  if (f === tree.owner) return true;
  return isInDownline(tree, f, t);
}

// The nested view of `slug`'s downline for the portal. `isListed(slug)` says whether that person is on this site
// (active trainer row); anyone not listed is left out, and their listed descendants move up to the nearest listed
// ancestor so no one below them is lost. `describe(slug, node)` adds the display fields. Depth is the drawn depth.
function nestedDownline(tree, slug, isListed = () => true, describe = (s, node) => ({ slug: s, rank: node.rank })) {
  const start = cleanSlug(slug);
  if (!has(tree, start)) return [];
  const seen = new Set([start]);
  const build = (at, depth) => {
    const out = [];
    for (const child of tree.children.get(at) || []) {
      if (seen.has(child)) continue;
      seen.add(child);
      if (isListed(child)) {
        const kids = build(child, depth + 1);
        out.push({ ...describe(child, tree.nodes.get(child)), depth, children: kids });
      } else {
        out.push(...build(child, depth));
      }
    }
    return out;
  };
  return build(start, 1);
}

// Flatten a nestedDownline() result depth first (the hand-off list order).
function flattenNested(list) {
  const out = [];
  const walk = items => { for (const item of items || []) { const { children, ...rest } = item; out.push(rest); walk(children); } };
  walk(list);
  return out;
}

module.exports = { SETTINGS_KEY, RANKS, rankLabel, validateTree, readTree, uplineOf, downlineOf, isInDownline, canSendTo, nestedDownline, flattenNested };
