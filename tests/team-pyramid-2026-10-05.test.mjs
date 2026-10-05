// My Team pyramid (DO-NOT-BREAK rule 171, 2026-10-05). The downline from GET ?team=1 drawn as a top-down chart:
// "You" at the top, Level 1 below, and so on; cards carry photo / initials, name, place, rank, Level, and email / phone
// links only when present. The API adds ONLY email + phone, ONLY on "me" and the downline (the same people as before).
// Run: node --test tests/   Nothing here talks to the real project.
import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
process.env.SUPABASE_URL = "http://supabase.test";
process.env.LDTT_SANDBOX = "";
const handler = require("../api/trainer-lead-action.js");
const read = path => readFileSync(resolve(import.meta.dirname, "..", path), "utf8");

// olga (owner) -> amy -> ben -> dee ; amy -> cal
const CHART = { owner_slug: "olga-owner", updated_from: "test", nodes: [
  { slug: "olga-owner", parent_slug: null, rank: "owner" },
  { slug: "amy-a", parent_slug: "olga-owner", rank: "senior_vice_president" },
  { slug: "ben-b", parent_slug: "amy-a", rank: "team_coordinator" },
  { slug: "cal-c", parent_slug: "amy-a", rank: "team_trainer" },
  { slug: "dee-d", parent_slug: "ben-b", rank: "team_trainer" }
] };
const TRAINERS = [
  { id: "t-own", full_name: "Olga Owner", market: "Cleveland, OH", state: "Ohio", slug: "olga-owner", status: "active", headshot_url: "", email: "olga@example.com", phone: "(555) 010-0100" },
  { id: "t-a", full_name: "Amy Able", market: "Boston", state: "MA", slug: "amy-a", status: "active", headshot_url: "", email: "amy@example.com", phone: "555-010-0101" },
  { id: "t-b", full_name: "Ben Baker", market: "Crestview", state: "Florida", slug: "ben-b", status: "active", headshot_url: "", email: " Ben@Example.com ", phone: "1 (555) 010-0102" },
  { id: "t-c", full_name: "Cal Cole", market: "Atlanta", state: "GA", slug: "cal-c", status: "active", headshot_url: "", email: "cal@example.com", phone: "5550100103" },
  { id: "t-d", full_name: "Dee Dunn", market: "Navarre, FL", state: "Florida", slug: "dee-d", status: "active", headshot_url: "", email: "not an email\"><script>", phone: "12" }
];
const USERS = [["u-a", "t-a"], ["u-b", "t-b"], ["u-d", "t-d"]].map(([user_id, trainer_id]) => ({ user_id, role: "trainer", permission_level: "trainer", trainer_id, active: true, access_status: "active", email: `${user_id}@example.com`, first_name: "x", last_name: "T" }));
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function world() {
  const store = { portal_users: USERS, trainers: TRAINERS, site_settings: [{ key: "trainer_hierarchy", value: CHART }] };
  const selects = [];
  globalThis.fetch = async (url, options = {}) => {
    const u = new URL(url);
    if (u.pathname === "/auth/v1/user") {
      const token = String(options.headers?.Authorization || options.headers?.authorization || "").replace(/^Bearer\s+/, "");
      const pu = USERS.find(p => `${p.user_id}-token` === token);
      return pu ? json(200, { id: pu.user_id, email: pu.email }) : json(401, {});
    }
    const table = u.pathname.replace("/rest/v1/", "");
    if ((options.method || "GET") !== "GET") return json(405, {});
    if (table === "trainers") selects.push(u.searchParams.get("select"));
    let rows = store[table] || [];
    for (const [key, raw] of u.searchParams) {
      if (["select", "order", "limit"].includes(key)) continue;
      const [op, ...rest] = raw.split(".");
      if (op === "eq") rows = rows.filter(r => String(r[key]) === rest.join("."));
    }
    return json(200, rows);
  };
  return { selects };
}
const makeRes = () => ({ statusCode: 200, body: null, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.statusCode = c; return this; }, json(p) { this.body = p; return this; }, end() { return this; } });
async function get(query, token) {
  const res = makeRes();
  await handler({ method: "GET", headers: { authorization: `Bearer ${token}` }, body: null, query }, res);
  return res;
}

test("API: ?team=1 adds email + phone to me and the downline only, cleaned; the upline gets none; nobody new appears", async () => {
  const { selects } = world();
  const res = await get({ team: "1" }, "u-b-token");
  assert.equal(res.statusCode, 200);
  const b = res.body;
  assert.equal(b.me.email, "ben@example.com", "trimmed + lower case");
  assert.equal(b.me.phone, "+15550100102", "a US number with the leading 1");
  assert.deepEqual(b.downline.map(p => p.slug), ["dee-d"], "still only Ben's own downline");
  assert.equal("email" in b.downline[0], false, "a broken address is left out, not shown");
  assert.equal("phone" in b.downline[0], false, "a broken phone is left out, not shown");
  for (const p of b.upline) { assert.equal("email" in p, false); assert.equal("phone" in p, false); }
  assert.ok(selects.every(s => s === "id,full_name,market,state,slug,status,headshot_url,email,phone"), "the team view reads the two extra columns");

  const amy = (await get({ team: "1" }, "u-a-token")).body;
  const flat = (l, o = []) => { for (const p of l) { o.push(p); flat(p.children || [], o); } return o; };
  const people = flat(amy.downline);
  assert.deepEqual(people.map(p => [p.slug, p.depth, p.email, p.phone]), [
    ["ben-b", 1, "ben@example.com", "+15550100102"], ["dee-d", 2, undefined, undefined], ["cal-c", 1, "cal@example.com", "+15550100103"]
  ]);
  assert.equal(amy.upline[0].slug, "olga-owner");
  assert.equal("phone" in amy.upline[0], false);
  const leaf = (await get({ team: "1" }, "u-d-token")).body;
  assert.deepEqual(leaf.downline, []);
  assert.equal(leaf.me.full_name, "Dee Dunn");
});

test("API: a trainer still cannot ask for someone else's team (trainer_id is office only)", async () => {
  world();
  const res = await get({ team: "1", trainer_id: "t-own" }, "u-d-token");
  assert.equal(res.body.me.id, "t-d", "the trainer_id is ignored for a trainer");
  assert.deepEqual(res.body.downline, []);
});

// ---- The portal -------------------------------------------------------------------------------------------
const app = read("trainer-backoffice/app.js");
const css = read("trainer-backoffice/styles.css");
const fn = name => app.match(new RegExp(`function ${name}\\(.*\\) \\{\\n[\\s\\S]*?\\n\\}\\n`))[0];
const constLine = name => app.match(new RegExp(`const ${name} = .*\\n`))[0];
const escapeHtml = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const FUNCS = ["flattenTrainerTeam", "teamRankBadge", "teamInitials", "teamAvatar", "teamNodeOpen", "teamNode", "teamPhoneLabel", "teamContactLinks", "teamPyramidCard", "teamPyramidNode", "teamLevelCounts", "teamPyramid", "trainerTeamView"];

function draw(team, layout = "pyramid") {
  const ctx = { escapeHtml, portalUser: { role: "trainer" }, remoteReady: true, trainerTeam: team, trainerTeamOpen: new Map(), loadTrainerTeam: () => null };
  vm.runInNewContext(`let trainerTeamLayout = ${JSON.stringify(layout)};\n${constLine("TEAM_RANK_KEYS")}${constLine("teamRankKey")}${FUNCS.map(fn).join("\n")}\nthis.out = trainerTeamView();`, ctx);
  return ctx.out;
}
const TEAM = (() => {
  const dee = { id: "t-d", slug: "dee-d", full_name: "Dee <Dunn>", place: "Navarre, FL", headshot_url: "javascript:alert(1)", rank: "team_trainer", rank_label: "Team Trainer", depth: 2, children: [] };
  const ben = { id: "t-b", slug: "ben-b", full_name: "Ben Baker", place: "Crestview, FL", headshot_url: "/assets/trainer-headshots/ben.jpg", rank: "team_coordinator", rank_label: "Team Coordinator", depth: 1, email: "ben@example.com", phone: "+15550100102", children: [dee] };
  const cal = { id: "t-c", slug: "cal-c", full_name: "Cal Cole", place: "Atlanta, GA", headshot_url: "https://example.supabase.co/x.jpg", rank: "team_trainer", rank_label: "Team Trainer", depth: 1, phone: "+15550100103", children: [] };
  const downline = [ben, cal];
  return { me: { full_name: "Amy Able", place: "Boston, MA", rank: "senior_vice_president", rank_label: "Senior Vice President", email: "amy@example.com" }, upline: [], is_owner: false, downline, flat: [ben, dee, cal] };
})();

test("portal: the pyramid is the main view: You at the top, Level labels, counts per level, contact links only when present", () => {
  const html = draw(TEAM);
  assert.match(html, /data-team-layout="pyramid" aria-pressed="true">Pyramid<\/button><button type="button" data-team-layout="list" aria-pressed="false">List<\/button>/);
  assert.match(html, /<ul class="pyr-levels" aria-label="People per level"><li>Level 1 <strong>2<\/strong> people<\/li><li>Level 2 <strong>1<\/strong> person<\/li><\/ul>/);
  assert.match(html, /<div class="pyr-card team-ring-senior_vice_president is-me">.*<span class="pyr-level">You<\/span><strong class="pyr-name">Amy Able<\/strong>/);
  assert.equal((html.match(/class="pyr-level">Level 1</g) || []).length, 2);
  assert.equal((html.match(/class="pyr-level">Level 2</g) || []).length, 1);
  assert.match(html, /<a href="mailto:ben@example\.com"/);
  assert.match(html, /<a href="tel:\+15550100102" aria-label="Call Ben Baker: \(555\) 010-0102">\(555\) 010-0102<\/a>/);
  assert.match(html, /<a href="tel:\+15550100103"/);
  assert.doesNotMatch(html, /mailto:[^"]*cal/, "Cal has no email, so no email link");
  assert.match(html, /<details class="pyr-branch" data-team-node="ben-b" open><summary aria-label="Ben Baker: 1 below\. Tap to open or close\.">1 below<\/summary>/, "branches fold with the same data-team-node as the list");
  assert.match(html, /Dee &lt;Dunn&gt;/, "names are escaped");
  assert.doesNotMatch(html, /javascript:/, "an unsafe photo is never drawn");
  assert.match(html, /<span>D&lt;<\/span><\/span><span class="pyr-level">Level 2/, "initials (escaped) when there is no usable photo");
  assert.match(html, /<img src="\/assets\/trainer-headshots\/ben\.jpg"/);
  assert.match(html, /<img src="https:\/\/example\.supabase\.co\/x\.jpg"/);
  assert.match(html, /data-team-expand="all">Open all/);
  assert.doesNotMatch(html, /lead_count|leadCount/, "no lead numbers (rules 7 + 34)");
});

test("portal: the list view (rule 105) is still one tap away and unchanged; a leaf still reads 'No one reports to you yet.'", () => {
  const list = draw(TEAM, "list");
  assert.match(list, /<ul class="team-tree"><li class="team-node"><details data-team-node="ben-b" open>/);
  assert.doesNotMatch(list, /pyr-card/);
  const leaf = draw({ ...TEAM, downline: [], flat: [] });
  assert.match(leaf, /No one reports to you yet\./);
  assert.doesNotMatch(leaf, /pyr-card/);
  assert.match(app, /if \(teamLayout\) \{ trainerTeamLayout = teamLayout\.dataset\.teamLayout === "list" \? "list" : "pyramid"; render\(\); return; \}/);
  assert.match(app, /restoreTeamPyramidScroll\(\); \/\/ rule 171/, "the chart keeps its sideways place across redraws");
});

test("portal CSS: the wide chart scrolls inside its own box; phones stack it indented with no sideways scroll", () => {
  assert.match(css, /\.team-view \{ grid-template-columns: minmax\(0, 1fr\); \}/, "the chart cannot stretch the page");
  assert.match(css, /\.pyr-scroll \{ overflow-x: auto;/);
  const phone = css.slice(css.indexOf("/* My Team pyramid (rule 171"), css.indexOf('/* Meeting 2026-09-16: "My calendar"'));
  assert.match(phone, /@media \(max-width: 640px\) \{\n  \.pyr-scroll \{ overflow: visible; padding: 0; \}/);
  assert.match(phone, /\.pyr-tree, \.pyr-children \{ display: block;/);
  assert.match(read("DO-NOT-BREAK.md"), /\n171\. \*\*My Team is a pyramid/);
});
