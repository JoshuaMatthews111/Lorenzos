// Hand-off down the trainer hierarchy (rule 105, Joshua 2026-09-25, owner's chart "Hierarchy - 9-23-26"). It replaced
// the same-state team of 2026-09-16 (rule 91). api/trainer-lead-action.js: GET ?team=1 = the caller's upline, the
// caller, and every ACTIVE person below them (nested; the owner gets the whole tree); action "handoff" moves a lead
// to someone in that downline and NOWHERE else: never up, never sideways, never to someone off the site.
// Run: node --test tests/   Nothing here talks to the real project.
import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
process.env.SUPABASE_URL = "http://supabase.test";
process.env.LDTT_SANDBOX = "";
const handler = require("../api/trainer-lead-action.js");
const read = path => readFileSync(resolve(import.meta.dirname, "..", path), "utf8");
const DOWNLINE_ONLY = "You can only send a lead to someone in your downline.";

// The chart:  olga (owner) -> amy -> ben -> dee
//                                    ben -> eve (INACTIVE on the site) -> gus
//                             amy -> cal
// sam is an active trainer who is NOT on the chart; "Test Trainer" is a practice test row.
const CHART = {
  owner_slug: "olga-owner", updated_from: "test chart",
  nodes: [
    { slug: "olga-owner", parent_slug: null, rank: "owner" },
    { slug: "amy-a", parent_slug: "olga-owner", rank: "senior_vice_president" },
    { slug: "ben-b", parent_slug: "amy-a", rank: "team_coordinator" },
    { slug: "cal-c", parent_slug: "amy-a", rank: "team_trainer" },
    { slug: "dee-d", parent_slug: "ben-b", rank: "team_trainer" },
    { slug: "eve-e", parent_slug: "ben-b", rank: "executive_team_trainer" },
    { slug: "gus-g", parent_slug: "eve-e", rank: "team_trainer" },
    { slug: "test-trainer", parent_slug: "ben-b", rank: "team_trainer" }
  ]
};
const TRAINERS = [
  { id: "t-own", full_name: "Olga Owner", market: "Cleveland, OH", state: "Ohio", slug: "olga-owner", status: "active", headshot_url: "/assets/trainer-headshots/Olga Owner 360_x_360.jpg" },
  { id: "t-a", full_name: "Amy Able", market: "Boston", state: "Massachusetts", slug: "amy-a", status: "active", headshot_url: "http://supabase.test/storage/v1/object/public/trainer-page-assets/t-a/profilePhoto-1.jpg" },
  { id: "t-b", full_name: "Ben Baker", market: "Crestview", state: "Florida", slug: "ben-b", status: "active", headshot_url: "javascript:alert(1)" },
  { id: "t-c", full_name: "Cal Cole", market: "Atlanta", state: "GA", slug: "cal-c", status: "active", headshot_url: "" },
  { id: "t-d", full_name: "Dee Dunn", market: "Navarre, FL", state: "Florida", slug: "dee-d", status: "active", headshot_url: null },
  { id: "t-e", full_name: "Eve Ellis", market: "Durham", state: "New Hampshire", slug: "eve-e", status: "inactive", headshot_url: null },
  { id: "t-g", full_name: "Gus Gray", market: "Panama City", state: "Florida", slug: "gus-g", status: "active", headshot_url: null },
  { id: "t-s", full_name: "Sam Stranger", market: "Austin", state: "Texas", slug: "sam-stranger", status: "active", headshot_url: null },
  { id: "t-x", full_name: "Test Trainer", market: "Akron", state: "OH", slug: "test-trainer", status: "active", headshot_url: null }
];
const USERS = [
  ["u-own", "t-own", "olga@example.com"], ["u-a", "t-a", "amy@example.com"], ["u-b", "t-b", "ben@example.com"], ["u-c", "t-c", "cal@example.com"],
  ["u-d", "t-d", "dee@example.com"], ["u-g", "t-g", "gus@example.com"], ["u-s", "t-s", "sam@example.com"]
].map(([user_id, trainer_id, email]) => ({ user_id, role: "trainer", permission_level: "trainer", trainer_id, active: true, access_status: "active", email, first_name: email.split("@")[0], last_name: "T" }))
  .concat([{ user_id: "u-office", role: "admin", permission_level: "office_admin", active: true, access_status: "active", email: "angela@example.com", first_name: "Angela", last_name: "Office" }]);
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function world({ status = "office_contacted", trainer = "t-b", chart = CHART, extra = {} } = {}) {
  const id = randomUUID();
  const store = {
    portal_users: USERS.map(u => ({ ...u })),
    trainers: TRAINERS.map(t => ({ ...t })),
    site_settings: chart ? [{ key: "trainer_hierarchy", value: JSON.parse(JSON.stringify(chart)) }] : [],
    leads: [{ id, trainer_id: trainer, status, version: 3, added_to_alpha: false, first_name: "Priya", trainer_market: "Cleveland, OH", raw_payload: {}, ...extra }],
    audit_events: [], lifecycle_events: [], lead_events: []
  };
  const writes = [];
  const pick = (rows, params) => {
    let out = rows;
    for (const [key, raw] of params) {
      if (["select", "order", "limit", "on_conflict"].includes(key)) continue;
      const [op, ...rest] = raw.split("."); const value = rest.join(".");
      if (op === "eq") out = out.filter(r => String(r[key]) === value);
    }
    return out;
  };
  globalThis.fetch = async (url, options = {}) => {
    const u = new URL(url);
    const method = (options.method || "GET").toUpperCase();
    const headers = options.headers || {};
    if (u.pathname === "/auth/v1/user") {
      const token = String(headers.Authorization || headers.authorization || "").replace(/^Bearer\s+/, "");
      const pu = USERS.find(p => `${p.user_id}-token` === token);
      return pu ? json(200, { id: pu.user_id, email: pu.email }) : json(401, { message: "bad token" });
    }
    const table = u.pathname.replace("/rest/v1/", "");
    if (!store[table]) return method === "GET" ? json(200, []) : json(404, {});
    const body = options.body ? JSON.parse(options.body) : null;
    if (method === "GET") return json(200, pick(store[table], u.searchParams));
    writes.push({ table, method, body });
    if (method === "POST") { const rows = (Array.isArray(body) ? body : [body]).map(r => ({ id: randomUUID(), ...r })); store[table].push(...rows); return json(201, rows); }
    if (method === "PATCH") { const hits = pick(store[table], u.searchParams); hits.forEach(r => { Object.assign(r, body); if (table === "leads") r.version += 1; }); return json(200, hits); }
    return json(405, {});
  };
  // Rule 7: a trainer's My Leads is every lead whose trainer_id is theirs (the portal and RLS both scope on it).
  const myLeads = trainerId => store.leads.filter(l => l.trainer_id === trainerId).map(l => l.id);
  return { store, writes, id, myLeads };
}

const makeRes = () => ({ statusCode: 200, body: null, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(code) { this.statusCode = code; return this; }, json(p) { this.body = p; return this; }, end() { return this; } });
async function post(body, token = "u-b-token") {
  const res = makeRes();
  await handler({ method: "POST", headers: token ? { authorization: `Bearer ${token}` } : {}, body, query: {} }, res);
  return res;
}
async function get(query, token = "u-b-token") {
  const res = makeRes();
  await handler({ method: "GET", headers: token ? { authorization: `Bearer ${token}` } : {}, body: null, query }, res);
  return res;
}
const slugs = list => list.map(p => p.slug);
const flat = (list, out = []) => { for (const p of list) { out.push([p.slug, p.depth]); flat(p.children || [], out); } return out; };

test("GET ?team=1 (Ben): upline owner-first, You, and every ACTIVE descendant nested — an inactive middle person drops out, the person below moves up", async () => {
  world();
  const res = await get({ team: "1" });
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  const b = res.body;
  assert.equal(b.ok, true);
  assert.deepEqual([b.me.slug, b.rank, b.rank_label, b.is_owner, b.on_chart, b.chart_ok], ["ben-b", "team_coordinator", "Team Coordinator", false, true, true]);
  assert.deepEqual(slugs(b.upline), ["olga-owner", "amy-a"], "the upline, owner first, own parent last");
  assert.deepEqual(flat(b.downline), [["dee-d", 1], ["gus-g", 1]], "Eve is inactive (not on the site): not listed; Gus moves up; the test row never shows");
  assert.equal(b.count, 2);
  assert.deepEqual(Object.keys(b.downline[0]), ["id", "slug", "full_name", "place", "headshot_url", "rank", "rank_label", "depth", "children"]);
  assert.deepEqual(b.downline[0], { id: "t-d", slug: "dee-d", full_name: "Dee Dunn", place: "Navarre, FL", headshot_url: "", rank: "team_trainer", rank_label: "Team Trainer", depth: 1, children: [] });
  assert.equal(JSON.stringify(b).includes("Eve Ellis"), false);
  assert.equal(b.upline[0].headshot_url, "/assets/trainer-headshots/olga-owner-360-x-360.jpg", "file names cleaned the same way as the portal's safeTrainerAssetUrl");
  assert.equal(b.upline[1].headshot_url, "http://supabase.test/storage/v1/object/public/trainer-page-assets/t-a/profilePhoto-1.jpg", "this project's public Storage passes");
  assert.equal(b.me.headshot_url, "", "anything else is dropped");
  assert.equal(b.upline[1].place, "Boston, MA", "market + state code");
});

test("GET ?team=1: the owner gets the whole tree; a leaf gets none; someone off the chart gets none", async () => {
  world();
  const owner = await get({ team: "1" }, "u-own-token");
  assert.equal(owner.body.is_owner, true);
  assert.equal(owner.body.rank_label, "Owner");
  assert.deepEqual(owner.body.upline, []);
  assert.deepEqual(flat(owner.body.downline), [["amy-a", 1], ["ben-b", 2], ["dee-d", 3], ["gus-g", 3], ["cal-c", 2]], "everyone active on the chart, Eve and Sam never");
  assert.equal(owner.body.count, 5);

  const leaf = await get({ team: "1" }, "u-d-token");
  assert.deepEqual(leaf.body.downline, []);
  assert.equal(leaf.body.count, 0);
  assert.deepEqual(slugs(leaf.body.upline), ["olga-owner", "amy-a", "ben-b"]);

  const stranger = await get({ team: "1" }, "u-s-token");
  assert.equal(stranger.statusCode, 200);
  assert.deepEqual([stranger.body.on_chart, stranger.body.downline, stranger.body.upline], [false, [], []]);

  const spoof = await get({ team: "1", trainer_id: "t-own" });
  assert.equal(spoof.body.me.slug, "ben-b", "a trainer cannot look at another trainer's view");
  const office = await get({ team: "1", trainer_id: "t-a" }, "u-office-token");
  assert.equal(office.statusCode, 200, JSON.stringify(office.body));
  assert.equal(office.body.me.slug, "amy-a", "the office may pass trainer_id");
  assert.equal((await get({ team: "1" }, "u-office-token")).statusCode, 400, "the office must say which trainer");
  assert.equal((await get({}, "u-b-token")).statusCode, 400, "GET without ?team=1 is not a thing");
  assert.notEqual((await get({ team: "1" }, "")).statusCode, 200, "no token, no team");
});

test("hand-off DOWN: only trainer_id in the PATCH, version guarded, logged; the lead lands in the receiver's My Leads and leaves the sender's", async () => {
  const w = world({ status: "evaluation_scheduled" });
  assert.deepEqual(w.myLeads("t-b"), [w.id]);
  const res = await post({ action: "handoff", lead_id: w.id, to_trainer_id: "t-d", expected_version: 3, note: "Closer to her" });
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(res.body.message, "Sent to Dee Dunn.");
  assert.deepEqual(res.body.record, { id: w.id, trainer_id: "t-d", trainer_name: "Dee Dunn", status: "evaluation_scheduled", version: 4 });
  assert.deepEqual(w.myLeads("t-d"), [w.id], "rule 7: the receiver's My Leads (trainer_id) now has it");
  assert.deepEqual(w.myLeads("t-b"), [], "it left the sender's board");
  assert.equal(w.store.leads[0].status, "evaluation_scheduled", "the status is untouched");
  const patches = w.writes.filter(x => x.table === "leads");
  assert.equal(patches.length, 1);
  assert.deepEqual(Object.keys(patches[0].body), ["trainer_id"], "no other lead field is written (rule 83)");

  const audit = w.store.audit_events[0];
  assert.equal(audit.action, "trainer_lead_handoff");
  assert.equal(audit.summary, "Sent to Dee Dunn (downline). Note: Closer to her");
  assert.equal(audit.actor_email, "ben@example.com");
  assert.deepEqual(audit.before_data, { trainer_id: "t-b", status: "evaluation_scheduled" });
  assert.deepEqual([audit.after_data.trainer_id, audit.after_data.from_slug, audit.after_data.to_slug], ["t-d", "ben-b", "dee-d"]);
  assert.equal(w.store.lifecycle_events.length, 0, "no funnel word fits a handoff");
  const event = w.store.lead_events[0];
  assert.equal(event.event_type, "trainer_handoff");
  assert.equal(event.note, "Closer to her");
  assert.deepEqual([event.raw_payload.from_trainer_id, event.raw_payload.to_trainer_id, event.raw_payload.by], ["t-b", "t-d", "trainer"]);

  // Ben no longer holds it; Dee (a leaf) cannot send it anywhere, least of all back up to Ben.
  assert.equal((await post({ action: "handoff", lead_id: w.id, to_trainer_id: "t-g" })).statusCode, 403);
  const up = await post({ action: "handoff", lead_id: w.id, to_trainer_id: "t-b" }, "u-d-token");
  assert.equal(up.statusCode, 403);
  assert.equal(up.body.message, DOWNLINE_ONLY);
});

test("hand-off two levels down past an inactive middle person is allowed (Gus sits under inactive Eve)", async () => {
  const w = world();
  const res = await post({ action: "handoff", lead_id: w.id, to_trainer_id: "t-g" });
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.deepEqual(w.myLeads("t-g"), [w.id]);
});

test("refused with 403 and NOTHING written: up, up to the owner, sideways, inactive, off the chart, a test row, unknown", async () => {
  const w = world();
  for (const [to, why] of [["t-a", "up"], ["t-own", "up to the owner"], ["t-c", "sideways"], ["t-e", "inactive (not on the site)"], ["t-s", "not on the chart"], ["t-x", "a practice test row"], ["nobody", "unknown"]]) {
    const res = await post({ action: "handoff", lead_id: w.id, to_trainer_id: to, expected_version: 3 });
    assert.equal(res.statusCode, 403, `${why}: ${JSON.stringify(res.body)}`);
    assert.equal(res.body.message, DOWNLINE_ONLY, why);
  }
  assert.equal(w.store.leads[0].trainer_id, "t-b");
  assert.equal(w.writes.length, 0, "nothing was written");
});

test("the owner may send to anyone active on the chart, and still never to someone off it", async () => {
  for (const to of ["t-a", "t-b", "t-c", "t-d", "t-g"]) {
    const w = world({ trainer: "t-own" });
    const res = await post({ action: "handoff", lead_id: w.id, to_trainer_id: to }, "u-own-token");
    assert.equal(res.statusCode, 200, `${to}: ${JSON.stringify(res.body)}`);
    assert.deepEqual(w.myLeads(to), [w.id]);
    assert.equal(w.store.audit_events[0].after_data.owner, true);
  }
  for (const to of ["t-s", "t-e", "t-x"]) {
    const w = world({ trainer: "t-own" });
    assert.equal((await post({ action: "handoff", lead_id: w.id, to_trainer_id: to }, "u-own-token")).statusCode, 403, to);
    assert.equal(w.writes.length, 0);
  }
});

test("the office hands off from the ASSIGNEE's downline (its own assign tools are unchanged); a trainer off the chart has no downline", async () => {
  const office = world();
  const ok = await post({ action: "handoff", lead_id: office.id, to_trainer_id: "t-d" }, "u-office-token");
  assert.equal(ok.statusCode, 200, JSON.stringify(ok.body));
  assert.equal(office.store.lead_events[0].raw_payload.by, "office");
  const up = world();
  assert.equal((await post({ action: "handoff", lead_id: up.id, to_trainer_id: "t-a" }, "u-office-token")).statusCode, 403, "even the office never sends a lead UP from its assignee");
  const offChart = world({ trainer: "t-s" });
  assert.equal((await post({ action: "handoff", lead_id: offChart.id, to_trainer_id: "t-d" }, "u-s-token")).statusCode, 403);
  assert.equal(up.writes.length + offChart.writes.length, 0);
});

test("fail closed: no chart, or a chart with a loop, refuses every hand-off and lists no one", async () => {
  const none = world({ chart: null });
  assert.equal((await post({ action: "handoff", lead_id: none.id, to_trainer_id: "t-d" })).statusCode, 403);
  const view = await get({ team: "1" });
  assert.deepEqual([view.body.chart_ok, view.body.downline, view.body.upline], [false, [], []]);
  const loop = JSON.parse(JSON.stringify(CHART));
  loop.nodes.find(n => n.slug === "amy-a").parent_slug = "dee-d";
  const looped = world({ chart: loop });
  assert.equal((await post({ action: "handoff", lead_id: looped.id, to_trainer_id: "t-d" })).statusCode, 403);
  assert.equal(none.writes.length + looped.writes.length, 0);
});

test("the trainer-name column is written only when the leads row has one", async () => {
  const named = world({ extra: { assigned_trainer_name: "Ben Baker" } });
  const res = await post({ action: "handoff", lead_id: named.id, to_trainer_id: "t-d" });
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.deepEqual(named.writes.find(x => x.table === "leads").body, { trainer_id: "t-d", assigned_trainer_name: "Dee Dunn" });
});

test("bad input writes nothing: missing person, same trainer, stale version, another trainer's lead, bad id", async () => {
  const w = world();
  assert.equal((await post({ action: "handoff", lead_id: w.id })).statusCode, 400);
  assert.equal((await post({ action: "handoff", lead_id: w.id, to_trainer_id: "t-b" })).statusCode, 409, "already with that trainer");
  assert.equal((await post({ action: "handoff", lead_id: w.id, to_trainer_id: "t-d", expected_version: 1 })).statusCode, 409, "stale version");
  assert.equal((await post({ action: "handoff", lead_id: w.id, to_trainer_id: "t-d" }, "u-a-token")).statusCode, 403, "not their lead, even for Ben's upline");
  assert.equal((await post({ action: "handoff", lead_id: "not-an-id", to_trainer_id: "t-d" })).statusCode, 400);
  assert.equal(w.writes.length, 0, "nothing was written");
});

// ---- The portal ------------------------------------------------------------------------------------------
const app = read("trainer-backoffice/app.js");
const css = read("trainer-backoffice/styles.css");
const fn = name => app.match(new RegExp(`function ${name}\\(.*\\) \\{\\n[\\s\\S]*?\\n\\}\\n`))[0];
const escapeHtml = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function drawHandoff(team, where) {
  const ctx = { session: { role: "trainer" }, state: {}, remoteReady: true, escapeHtml, trainerTeam: team, loadTrainerTeam: () => null, lead: { id: "l1", remoteId: "r1", owner: "Priya" } };
  vm.runInNewContext(`${fn("trainerHandoffBox")}\nthis.out = trainerHandoffBox(lead, ${JSON.stringify(where)});`, ctx);
  return ctx.out;
}

test("portal: My Team sits right after My Leads, in the menu and the Page Editor preview; the same-state panel is gone", () => {
  const ctx = {
    METRICS: { navBadgeCounts: () => ({ myLeads: 0, paymentsDue: 0, mediaPending: 0, reviewsPending: 0 }) },
    filteredLeadRows: rows => rows, trainerLeads: () => [], state: { dealPayments: [] },
    trainerMediaSubmissions: () => [], trainerReviewSubmissions: () => []
  };
  vm.runInNewContext(`${fn("trainerNav")}\nthis.nav = trainerNav();`, ctx);
  assert.equal(JSON.stringify(ctx.nav.slice(0, 3).map(e => [e[0], e[1]])), JSON.stringify([["dashboard", "Dashboard"], ["leads", "My Leads"], ["team", "My Team"]]));
  assert.match(fn("portalPreviewViews"), /\{ id: "leads", label: "My Leads" \},\n    \{ id: "team", label: "My Team" \},/);
  assert.match(app, /\n  team\(\) \{\n    return trainerTeamView\(\);\n  \},/, "the one page draws it once as its own section");
  assert.doesNotMatch(app, /trainerTeamPanel|Your downline for now is every Lorenzo's trainer in your state/);
  assert.match(app, /fetch\("\/api\/trainer-lead-action\?team=1"/, "the tree comes from the GET");
  assert.match(app, /let trainerTeam = null;/, "cached once per sign-in");
});

test("portal: the hand-off box lists the downline indented by level; a leaf gets nothing on the card and one plain line in the panel", () => {
  const team = { flat: [
    { id: "t-d", full_name: "Dee Dunn", place: "Navarre, FL", depth: 1 },
    { id: "t-g", full_name: "Gus Gray", place: "Panama City, FL", depth: 2 }
  ] };
  const box = drawHandoff(team, "card");
  assert.match(box, /Send to someone in your downline<select data-trainer-handoff-to/);
  assert.match(box, /<option value="t-d" >Dee Dunn · Navarre, FL<\/option>/);
  assert.match(box, /<option value="t-g" > └ Gus Gray · Panama City, FL<\/option>/, "level 2 is indented under level 1");
  assert.match(box, />Send<\/button>/);
  const leaf = { flat: [] };
  assert.equal(drawHandoff(leaf, "card"), "", "a leaf's card shows nothing at all");
  assert.equal(drawHandoff(leaf, "panel"), `<p class="field-hint trainer-handoff-note">No one reports to you yet, so there is no one to send this lead to.</p>`);
  assert.equal(drawHandoff(null, "card"), "", "nothing on the card while the team loads");
  assert.equal(drawHandoff({ flat: [], error: "boom" }, "card"), "");
});

test("portal: confirm names the person, toast 'Sent to {name}', the lead leaves the panel; My Team view wording and ranks", () => {
  const action = fn("trainerLeadAction");
  assert.match(action, /teammate = \(trainerTeam\?\.flat \|\| \[\]\)\.find\(t => t\.id === pick\.toTrainerId\) \|\| null;/, "only a name from the caller's own downline");
  assert.match(action, /window\.confirm\(`Send \$\{lead\.owner\} to \$\{teammate\.full_name\}\? The lead moves to \$\{teammate\.full_name\}'s My Leads and leaves your board\.`\)/);
  assert.match(action, /showToast\(`Sent to \$\{teammate\.full_name\}`\);/);
  assert.match(action, /if \(state\.selectedLeadId === lead\.id \|\| state\.selectedLeadId === lead\.remoteId\) state\.selectedLeadId = "";/);
  const view = fn("trainerTeamView");
  for (const words of ["Your upline", "No one reports to you yet.", "The whole team", "Your downline", ">You<"]) assert.ok(view.includes(words), words);
  assert.doesNotMatch(view, /lead_count|leadCount|trainerLeads\(/, "no lead counts for other trainers (rules 7 + 34)");
  for (const rank of ["owner", "senior_vice_president", "regional_director", "master_trainer", "team_coordinator", "executive_team_trainer", "team_trainer"]) {
    assert.match(css, new RegExp(`\\.team-rank-${rank} \\{ background: #`), `${rank} badge colour`);
    assert.match(css, new RegExp(`\\.team-ring-${rank} \\{ --ring: #`), `${rank} photo ring colour`);
  }
  assert.match(css, /@media \(max-width: 640px\) \{\n  \.team-me \{/, "phone layout");
  assert.match(app, /document\.addEventListener\("toggle", event => \{[\s\S]{0,200}trainerTeamOpen\.set/, "an opened branch survives a redraw");
  const api = read("api/trainer-lead-action.js");
  assert.match(api, /require\("\.\.\/lib\/sandbox"\)/, "rule 5: every table call through supabaseRequest");
  assert.match(api, /require\("\.\.\/lib\/hierarchy"\)/, "the one home of the tree helpers");
  assert.doesNotMatch(api, /\/auth\/v1\/user/, "sign-in is checked only by lib/portal-auth (rule 37)");
});
