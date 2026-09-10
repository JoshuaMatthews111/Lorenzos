// Numbers tests (2026-09-05): every figure on every panel comes from
// trainer-backoffice/metrics.js, so dashboard == board == report == CSV, QA
// rows are held out everywhere (leads AND applications), the Sales tab is bot
// leads + deals only, and the nightly cross-check in api/cron/site-health.js
// files "LDTT: numbers disagree: <figure>" when the two computations differ.
// Run: node --test tests/   NOT deployed. Nothing here talks to the real project.
import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
process.env.SUPABASE_URL = "https://supabase.test";
process.env.LDTT_SANDBOX = "";
const metrics = require("../trainer-backoffice/metrics.js");
const crosscheck = require("../lib/metrics-crosscheck.js");
const healthCron = require("../api/cron/site-health.js");
const root = resolve(import.meta.dirname, "..");

// ---------------------------------------------------------------------------
// Fixture: ~30 leads across sources / statuses (2 qa rows, 1 bot-handled
// sales_pipeline lead), ~10 applications (1 qa row), a few deals, a few clients.
// ---------------------------------------------------------------------------
const STATUSES = ["new_inquiry", "new_inquiry", "new_inquiry", "office_contacted", "follow_up_call_needed", "engaged_no_outcome", "evaluation_scheduled", "evaluation_scheduled", "evaluation_cancelled", "evaluation_complete", "evaluation_complete", "became_client", "became_client", "became_client", "lost_no_response", "lost_price_concern", "lost_not_ready", "lost_chose_another_provider", "lost_client_complaint", "lost_no_trainer_area", "bad_lead", "do_not_contact", "archived", "archived", "new_inquiry", "office_contacted", "evaluation_scheduled", "site_visit"];
const SOURCES = ["Website Contact Form", "Google Ads", "Facebook", "Referral", "Trainer Page", "Yelp", "Instagram"];
function rawLeads() {
  const rows = STATUSES.map((status, i) => ({
    id: `lead-${i + 1}`, status, lead_source: SOURCES[i % SOURCES.length], trainer_id: `t-${(i % 3) + 1}`,
    first_name: `Person${i + 1}`, last_name: "Test", email: `p${i + 1}@example.com`,
    created_at: `2026-08-${String((i % 28) + 1).padStart(2, "0")}T10:00:00Z`,
    raw_payload: { qa: false, ad_market: i % 4 === 0 ? "Cleveland / Akron, OH" : "" }
  }));
  rows.push({ id: "lead-qa-1", status: "new_inquiry", lead_source: "Website Contact Form", first_name: "QA", last_name: "Release", email: "qa@example.com", created_at: "2026-08-30T10:00:00Z", raw_payload: { qa: true } });
  rows.push({ id: "lead-qa-2", status: "became_client", lead_source: "Google Ads", first_name: "QA", last_name: "Verification", email: "qa2@example.com", created_at: "2026-08-30T11:00:00Z", raw_payload: { qa: true } });
  // The one lead the bot handled: on the Sales board, still counted on Leads.
  rows.push({ id: "lead-bot", status: "evaluation_scheduled", lead_source: "Google Ads", first_name: "Bot", last_name: "Handled", email: "bot@example.com", created_at: "2026-08-31T09:00:00Z", raw_payload: { qa: false, sales_pipeline: true } });
  return rows;
}
const APP_STATUSES = ["new_application", "new_application", "new_application", "reviewing", "discovery_follow_up", "discovery_follow_up", "moved_forward", "not_a_fit", "archived"];
function rawApplications() {
  const rows = APP_STATUSES.map((status, i) => ({ id: `app-${i + 1}`, status, first_name: `Applicant${i + 1}`, last_name: "Person", email: `a${i + 1}@example.com`, created_at: `2026-08-${String(i + 1).padStart(2, "0")}T09:00:00Z`, received_at: `2026-08-${String(i + 1).padStart(2, "0")}T09:00:00Z`, raw_payload: { qa: false } }));
  rows.push({ id: "app-qa", status: "new_application", first_name: "qa-probe", last_name: "Bot", email: "qa-probe@example.com", created_at: "2026-08-30T09:00:00Z", received_at: "2026-08-30T09:00:00Z", raw_payload: { qa: true } });
  return rows;
}
function rawDeals() {
  return [
    { id: "deal-1", lead_id: "lead-12", client_id: "c-1", trainer_id: "t-1", status: "active", sold_amount: 2400, collected_amount: 800, balance_due: 1600, sold_on: "2026-08-20", client_name: "Person12", program: "Board & Train" },
    { id: "deal-2", lead_id: null, client_id: "c-2", trainer_id: "t-2", status: "active", sold_amount: 1200, collected_amount: 1200, balance_due: 0, sold_on: "2026-08-22", client_name: "Walk-in", program: "Private" },
    { id: "deal-3", lead_id: "lead-13", client_id: "c-3", trainer_id: "t-1", status: "cancelled", sold_amount: 999, collected_amount: 0, balance_due: 999, sold_on: "2026-08-23", client_name: "Person13", program: "Private" }
  ];
}
const CLIENTS = [{ id: "c-1", status: "Active" }, { id: "c-2", status: "Active" }, { id: "c-3", status: "Past" }, { id: "c-4", status: "Won" }];
const PAYMENTS = [
  { id: "p1", deal_id: "deal-1", status: "collected", due_on: "2026-08-20", amount: 800, sequence: 0 },
  { id: "p2", deal_id: "deal-1", status: "scheduled", due_on: "2026-09-01", amount: 800, sequence: 1 },
  { id: "p3", deal_id: "deal-1", status: "scheduled", due_on: "2026-09-20", amount: 800, sequence: 2 },
  { id: "p4", deal_id: "deal-3", status: "scheduled", due_on: "2026-09-01", amount: 999, sequence: 0 }
];

const normalized = () => ({
  leads: rawLeads().map(row => metrics.normalizeLeadRow(row)),
  applications: rawApplications().map(metrics.normalizeApplicationRow),
  deals: rawDeals().map(metrics.normalizeDealRow)
});

test("metrics.js: the same API in Node (require) and in a simulated browser (window)", () => {
  const source = readFileSync(resolve(root, "trainer-backoffice/metrics.js"), "utf8");
  const window = {};
  vm.runInNewContext(source, { window });
  assert.ok(window.LDTT_METRICS, "browser build sets window.LDTT_METRICS");
  assert.deepEqual(Object.keys(window.LDTT_METRICS).sort(), Object.keys(metrics).sort());
  assert.equal(window.LDTT_METRICS.leadRows(rawLeads().map(r => window.LDTT_METRICS.normalizeLeadRow(r))).length, metrics.leadRows(normalized().leads).length);
  assert.ok(!/document\.|\bstate\.|fetch\(/.test(source), "metrics.js touches no DOM, state or network");
});

test("QA hold-out: 2 qa leads and 1 qa application leave every count; nothing else moves", () => {
  const { leads, applications } = normalized();
  assert.equal(leads.length, 31);
  assert.equal(metrics.leadRows(leads).length, 29, "31 rows minus the 2 raw_payload.qa rows");
  assert.equal(metrics.leadRows(leads).filter(l => l.isTest).length, 0);
  // Leads: the flag only (DO-NOT-BREAK rule 1) — a real person whose name starts with "QA" is still a lead.
  assert.equal(metrics.isQaLead({ first_name: "qa-something", rawPayload: { qa: false } }), false);
  assert.equal(metrics.isQaLead({ rawPayload: { qa: true } }), true);
  // Applications: the flag, or a qa-/qa_ name or email.
  assert.equal(applications.length, 10);
  assert.equal(metrics.applicationRows(applications).length, 9);
  assert.equal(metrics.isQaApplication({ first_name: "qa_probe", rawPayload: {} }), true);
  assert.equal(metrics.isQaApplication({ email: "QA-bot@x.test", rawPayload: {} }), true);
  assert.equal(metrics.isQaApplication({ first_name: "Quincy", email: "quincy@x.test", rawPayload: {} }), false);
  // The "show test leads" toggle keeps the QA rows (the office inspects them there).
  assert.equal(metrics.salesPipelineRows([...leads, { inSalesPipeline: true, isTest: true, rawPayload: { qa: true } }], { keepQa: true }).length, 2);
});

test("dashboard == board columns == report == CSV for every lead figure", () => {
  const { leads, applications } = normalized();
  const rows = metrics.leadRows(leads);
  const submitted = metrics.submittedLeadRows(rows);
  const apps = metrics.applicationRows(applications);
  assert.equal(submitted.length, 28, "29 real leads minus the one site_visit row");

  // Board columns sum to the Leads-tab total; each column matches the status count.
  const columns = metrics.leadBoardColumnCounts(rows);
  assert.equal(columns.reduce((sum, [, n]) => sum + n, 0), rows.length - 1, "every submitted-or-not status lands in exactly one column (site_visit has no column)");
  const byStatus = Object.fromEntries(metrics.leadStatusCounts(rows));
  for (const [column, n] of columns) if (column !== "Lost") assert.equal(n, byStatus[column], column);
  assert.equal(Object.fromEntries(columns).Lost, metrics.lostLeadRows(rows).length);
  assert.equal(metrics.lostLeadRows(rows).length, 10, "6 lost statuses + bad lead + do not contact + 2 archived");

  // Dashboard tiles = donut slices = funnel bottom = report tiles.
  const dash = metrics.dashboardMetrics({ leadRows: submitted, appRows: apps, lifecycle: [], officeNotes: [] });
  const donut = Object.fromEntries(metrics.leadSummary(submitted, apps).buckets);
  const funnel = metrics.companyConversionCounts(submitted);
  assert.equal(dash.forms, 28);
  assert.equal(dash.contactForms, 28, "no paid-ad classifier → everything is a contact form");
  assert.equal(dash.evalScheduled, 4); assert.equal(donut["Eval Scheduled"], 4); assert.equal(byStatus["Evaluation Scheduled"], 4);
  assert.equal(dash.evalCompleted, 2); assert.equal(donut["Eval Complete"], 2);
  assert.equal(dash.clientWon, 3); assert.equal(dash.trueConversions, 3); assert.equal(donut["Became a Client"], 3); assert.equal(funnel.clients, 3);
  assert.equal(dash.lostLeads, 10); assert.equal(donut.Lost, 10); assert.equal(funnel.lost, 10);
  assert.equal(dash.lostNoResponse, 1);
  assert.equal(donut.Archived, 2); assert.equal(funnel.archived, 2);
  assert.equal(dash.newTrainerApplications, 9); assert.equal(donut["New Trainer Applications"], 9);
  assert.equal(metrics.leadSummary(submitted, apps).total, Object.values(donut).reduce((a, b) => a + b, 0));
  // The funnel never lets a lead leave a stage it reached (rank order).
  assert.equal(funnel.leads, 28); assert.equal(funnel.scheduled, 4 + 1 + 2 + 3, "scheduled + cancelled + complete + client");
  assert.equal(funnel.completed, 2 + 3); assert.ok(funnel.leads >= funnel.scheduled && funnel.scheduled >= funnel.completed && funnel.completed >= funnel.clients);
  // A lifecycle event counts a lead as reached even if its status is behind.
  const idx = metrics.lifecycleIndex([{ entity_type: "lead", entity_id: "lead-1", event_type: "evaluation_scheduled" }]);
  assert.equal(metrics.companyConversionCounts(submitted, idx).scheduled, funnel.scheduled + 1);

  // Paid-ad classifier splits the same rows: contact + paid = forms, ebook ⊂ paid.
  const isPaidAd = lead => Boolean(lead.rawPayload.ad_market);
  const withAds = metrics.dashboardMetrics({ leadRows: submitted, appRows: apps, isPaidAd, isEbook: () => true });
  assert.equal(withAds.contactForms + withAds.paidAdSubmittedInquiries, 28);
  assert.equal(withAds.ebookRequests, withAds.paidAdSubmittedInquiries);

  // Conversion by market: tfoot totals equal the dashboard.
  const market = metrics.marketConversionTable(submitted, {
    adMarkets: [{ key: "cleveland", label: "Cleveland / Akron, OH" }, { key: "columbus", label: "Columbus, OH" }],
    marketKeyOf: lead => (lead.rawPayload.ad_market ? "cleveland" : "elsewhere")
  });
  assert.equal(market.totals.leads, 28); assert.equal(market.totals.clients, 3); assert.equal(market.totals.lost, 10);
  assert.equal(market.totals.scheduled, funnel.scheduled); assert.equal(market.totals.completed, funnel.completed);
  assert.equal(market.rows.length, 2, "every ad market has a row, even on zero");
  assert.equal(market.rows[1].leads, 0); assert.equal(market.other.leads + market.rows[0].leads, 28);
  assert.equal(metrics.rate(3, 28), "11%"); assert.equal(metrics.rate(0, 0), "—");

  // Nav badge = New Inquiry column.
  assert.equal(metrics.navBadgeCounts({ leads: rows }).newLeads, byStatus["New Inquiry"]);
  assert.equal(metrics.navBadgeCounts({ leads: rows }).newLeads, Object.fromEntries(columns)["New Inquiry"]);

  // CSV: one line per row the screen shows; QA rows never reach the sheet.
  const csv = metrics.csvDocument([{ key: "id", label: "Id" }, { key: "status", label: "Status" }], rows, (row, field) => row[field.key]);
  assert.equal(csv.rows, rows.length); assert.equal(metrics.csvRowCount(csv.csv), 29);
  assert.ok(!csv.csv.includes("lead-qa-"));
  assert.equal(csv.csv.split("\n")[0], '"Id","Status"');
  assert.equal(metrics.escapeCsv('say "hi"'), '"say ""hi"""');
});

test("Sales tab = bot-handled leads + trainer deals only (never re-bucketed)", () => {
  const { leads, deals } = normalized();
  const pipeline = metrics.salesPipelineRows(leads);
  assert.deepEqual(pipeline.map(l => l.id), ["lead-bot"], "28 ordinary leads stay on the Leads tab");
  const totals = metrics.salesTotals(pipeline, deals);
  assert.equal(totals.inPipeline, 1); assert.equal(totals.deals, 2, "the cancelled deal is out");
  assert.equal(totals.won, 2, "no won bot lead; both live deals count as won");
  assert.equal(totals.booked, 1); assert.equal(totals.decided, 2); assert.equal(totals.closeRate, 100);
  assert.equal(totals.soldTotal, 3600); assert.equal(totals.collectedTotal, 2000);
  const columns = Object.fromEntries(metrics.salesColumnCounts(pipeline, deals));
  assert.equal(columns.won, totals.won); assert.equal(columns.booked, 1);
  assert.equal(Object.values(columns).reduce((a, b) => a + b, 0), totals.inPipeline + totals.deals);
  // A deal on a won bot lead is one card, not two.
  const wonBot = { ...pipeline[0], id: "lead-12", remoteId: "lead-12", dbStatus: "became_client", status: "Became a Client" };
  assert.equal(metrics.salesTotals([wonBot], deals).won, 2, "1 won lead + 1 deal without a lead (deal-1 belongs to lead-12)");
  assert.equal(metrics.dealsWithoutLead(metrics.activeDeals(deals), [wonBot]).map(d => d.id).join(), "deal-2");
  assert.deepEqual(metrics.salesSourceRows(pipeline)[0], ["Google Ads", { total: 1, won: 0, sample: pipeline[0], rate: 0 }]);
  assert.equal(metrics.salesStageFor({ dbStatus: "lost_no_response" }), "winback");
  assert.equal(metrics.salesStageFor({ dbStatus: "" }), "captured");
  // Empty by default (DO-NOT-BREAK rule 2).
  assert.equal(metrics.salesTotals(metrics.salesPipelineRows(leads.filter(l => l.id !== "lead-bot")), []).inPipeline, 0);
});

test("applications: tiles == board columns == badge == CSV, QA held out; clients; trainer figures", () => {
  const { applications, leads, deals } = normalized();
  const apps = metrics.applicationRows(applications);
  const tiles = metrics.applicationTiles(apps);
  assert.deepEqual(tiles, { total: 9, needsAction: 3, discovery: 2, movedForward: 1 });
  const columns = Object.fromEntries(metrics.applicationColumnCounts(apps));
  assert.equal(Object.values(columns).reduce((a, b) => a + b, 0), tiles.total);
  assert.equal(columns["New Application"], tiles.needsAction);
  assert.equal(columns["Discovery Call Inquiry"], tiles.discovery); assert.equal(columns["Moved Forward"], tiles.movedForward);
  assert.equal(metrics.navBadgeCounts({ applications: apps }).applicationsNeedAction, tiles.needsAction);
  assert.equal(apps[0].id, "app-9", "newest first");
  const csv = metrics.csvDocument([{ key: "id", label: "Id" }], apps, row => row.id);
  assert.equal(csv.rows, 9); assert.ok(!csv.csv.includes("app-qa"));

  const clients = metrics.clientCounts(CLIENTS, CLIENTS.filter(c => c.status === "Active"), 7285);
  assert.deepEqual(clients, { loaded: 4, shown: 2, total: 7285, moreOnServer: true });
  assert.equal(metrics.clientCounts(CLIENTS, CLIENTS, 0).moreOnServer, false);

  const mine = metrics.leadRows(leads).filter(l => l.trainerRemoteId === "t-1");
  const dash = metrics.trainerDashboard(mine, [{ status: "Pending" }, { status: "Approved" }]);
  assert.equal(dash.assigned, mine.length); assert.equal(dash.won, mine.filter(l => l.status === "Became a Client").length); assert.equal(dash.pendingSubmissions, 1);
  const perf = metrics.trainerPerformance(mine, 12);
  assert.equal(perf.inRange, mine.length); assert.equal(perf.won, dash.won); assert.equal(perf.pageForms, 12);
  assert.equal(metrics.trainerStats([{ event_type: "trainer_page_view" }, { event_type: "cta_click" }], mine).clicks, 1);
  assert.equal(metrics.trainerStats([], mine).conversions, dash.won);
  const td = metrics.trainerDeals(deals.filter(d => d.trainer_id === "t-1"), PAYMENTS, "2026-09-05");
  assert.equal(td.count, 1); assert.equal(td.sold, 2400); assert.equal(td.collected, 800); assert.equal(td.collectedPercent, 33);
  assert.equal(td.dueNow.length, 1, "the cancelled deal's payment is not due"); assert.equal(td.upcoming[0].due_on, "2026-09-20");
  assert.equal(metrics.navBadgeCounts({ payments: PAYMENTS, today: "2026-09-05" }).paymentsDue, 2);
  assert.equal(metrics.navBadgeCounts({ trainerLeads: mine }).myLeads, mine.filter(l => !["Archived", "Became a Client"].includes(l.status)).length);
});

// ---------------------------------------------------------------------------
// The nightly cross-check.
// ---------------------------------------------------------------------------
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
function fakeSupabase(tables) {
  const calls = [];
  const supabaseFetch = async path => {
    calls.push(path);
    const u = new URL(`https://supabase.test${path}`);
    const table = u.pathname.replace("/rest/v1/", "");
    if (!tables[table]) throw new Error(`Could not find the table 'public.${table}'`);
    const offset = Number(u.searchParams.get("offset") || 0); const limit = Number(u.searchParams.get("limit") || 1000);
    return tables[table].slice(offset, offset + limit);
  };
  return { supabaseFetch, calls };
}

test("cross-check: metrics.js and the plain counts agree on the fixture; a fetch failure is reported, not raised", async () => {
  const { supabaseFetch, calls } = fakeSupabase({ leads: rawLeads(), deals: rawDeals(), trainer_applications: rawApplications() });
  const result = await crosscheck.runNumbersCrossCheck({ supabaseFetch, ranAt: "2026-09-05T08:30:00Z" });
  assert.equal(result.ok, true, JSON.stringify(result.mismatches));
  assert.equal(result.mismatches.length, 0); assert.equal(result.approvals.length, 0);
  assert.deepEqual(result.rows, { leads: 31, deals: 3, applications: 10 });
  const fig = Object.fromEntries(result.figures.map(f => [f.figure, f.portal]));
  assert.equal(fig["leads: total"], 29); assert.equal(fig["leads: Became a Client"], 3); assert.equal(fig["leads: Lost (board column)"], 10);
  assert.equal(fig["dashboard: form submissions"], 28); assert.equal(fig["sales: in pipeline"], 1); assert.equal(fig["sales: won"], 2);
  assert.equal(fig["sales: sold total"], 3600); assert.equal(fig["applications: total"], 9); assert.equal(fig["applications: needs action"], 3);
  assert.ok(result.figures.length >= 25);
  assert.ok(calls.every(c => /limit=1000&offset=\d+/.test(c)), "pages through the tables");
  // Paging: 1,500 rows arrive in two pages.
  const many = Array.from({ length: 1500 }, (_, i) => ({ id: `l${i}`, status: "new_inquiry", raw_payload: {} }));
  const paged = fakeSupabase({ leads: many, deals: [], trainer_applications: [] });
  assert.equal((await crosscheck.runNumbersCrossCheck({ supabaseFetch: paged.supabaseFetch })).rows.leads, 1500);
  assert.equal(paged.calls.filter(c => c.includes("/leads")).length, 2);
  const missing = await crosscheck.runNumbersCrossCheck({ supabaseFetch: fakeSupabase({}).supabaseFetch });
  assert.equal(missing.ok, null); assert.match(missing.error, /Could not find the table/); assert.equal(missing.approvals.length, 0);
});

test("cross-check: a disagreement makes one approval per figure, titled exactly, capped at 5", () => {
  const portal = { "leads: total": 152, "leads: Became a Client": 40, "sales: won": 2, "a": 1, "b": 1, "c": 1, "d": 1 };
  const independent = { "leads: total": 153, "leads: Became a Client": 40, "sales: won": 3, "a": 0, "b": 0, "c": 0, "d": 0 };
  const { figures, mismatches } = crosscheck.compareFigures(portal, independent);
  assert.equal(figures.length, 7); assert.equal(mismatches.length, 6);
  const payload = crosscheck.numbersApprovalPayload(mismatches[0], { ranAt: "2026-09-05T08:30:00Z" });
  assert.equal(payload.title, "LDTT: numbers disagree: leads: total");
  assert.equal(payload.type, "other"); assert.equal(payload.product_id, "bb51502e-eb05-4919-82ce-ed5a39a8d609"); assert.equal(payload.cost_cents, 0);
  assert.match(payload.body, /portal \(trainer-backoffice\/metrics\.js\): 152/); assert.match(payload.body, /plain count of the table: 153/); assert.match(payload.body, /No data was changed/);
  assert.equal(mismatches.slice(0, crosscheck.MAX_NUMBER_APPROVALS).length, 5);
});

// A world with the three tables + what the page half of the cron needs.
function cronWorld({ tables, dsn }) {
  const db = { ad_pages: [], site_settings: [], audit_events: [], ...tables };
  const fetchImpl = async (url, options = {}) => {
    const u = new URL(url); const method = (options.method || "GET").toUpperCase();
    if (u.hostname === "dsn-command.vercel.app") { dsn.push(JSON.parse(options.body)); return json(200, { ok: true }); }
    if (u.origin !== "https://supabase.test") return new Response("<html>", { status: 200 });
    const table = u.pathname.replace("/rest/v1/", "");
    if (!db[table]) return json(404, { message: `Could not find the table 'public.${table}'` });
    if (method === "GET") { const offset = Number(u.searchParams.get("offset") || 0); const limit = Number(u.searchParams.get("limit") || 1000); return json(200, db[table].slice(offset, offset + limit)); }
    const body = JSON.parse(options.body);
    if (table === "site_settings") { const hit = db.site_settings.find(r => r.key === body.key); if (hit) Object.assign(hit, body); else db.site_settings.push(body); return json(200, [body]); }
    db[table].push(body); return json(201, [body]);
  };
  return { db, fetchImpl };
}
const res = () => { const r = { statusCode: 200, headers: {}, body: null }; r.setHeader = () => {}; r.status = c => { r.statusCode = c; return r; }; r.json = b => { r.body = JSON.stringify(b); return r; }; return r; };

test("health cron: agree ⇒ no numbers approval; disagree ⇒ 'LDTT: numbers disagree: <figure>' posted and stored under site_health.numbers; dry ⇒ nothing", async () => {
  process.env.CRON_SECRET = "s3"; process.env.DSN_AGENT_TOKEN = "t";
  const originalIndependent = crosscheck.deps.independentCounts;
  try {
    // Agree.
    let dsn = []; let w = cronWorld({ tables: { leads: rawLeads(), deals: rawDeals(), trainer_applications: rawApplications() }, dsn });
    healthCron.deps.fetch = w.fetchImpl;
    let r = res(); await healthCron({ headers: { "x-vercel-cron": "1" }, query: { base: "https://site.test" } }, r);
    let body = JSON.parse(r.body);
    assert.equal(r.statusCode, 200); assert.equal(body.numbers.ok, true); assert.equal(body.numbers.mismatches.length, 0); assert.equal(dsn.length, 0);
    assert.equal(w.db.site_settings.find(s => s.key === "site_health").value.numbers.ok, true);
    assert.equal(w.db.site_settings.find(s => s.key === "site_health").value.numbers.rows.leads, 31);

    // Disagree: the independent side says one more client and a different total.
    crosscheck.deps.independentCounts = tables => ({ ...originalIndependent(tables), "leads: Became a Client": 99, "leads: total": 1 });
    dsn = []; w = cronWorld({ tables: { leads: rawLeads(), deals: rawDeals(), trainer_applications: rawApplications() }, dsn });
    healthCron.deps.fetch = w.fetchImpl;
    // Dry run first: payloads returned, nothing written, nothing posted.
    r = res(); await healthCron({ headers: { authorization: "Bearer s3" }, query: { dry: "1", base: "https://site.test" } }, r);
    body = JSON.parse(r.body);
    assert.equal(body.dryRun, true); assert.equal(body.numbers.ok, false); assert.equal(body.numbers.mismatches.length, 2);
    assert.deepEqual(body.dsn_payloads.map(p => p.title).sort(), ["LDTT: numbers disagree: leads: Became a Client", "LDTT: numbers disagree: leads: total"]);
    assert.equal(dsn.length, 0); assert.equal(w.db.site_settings.length, 0);
    // Real run: one approval per differing figure, result stored.
    r = res(); await healthCron({ headers: { "x-vercel-cron": "1" }, query: { base: "https://site.test" } }, r);
    body = JSON.parse(r.body);
    assert.equal(dsn.length, 2);
    assert.deepEqual(dsn.map(p => p.title).sort(), ["LDTT: numbers disagree: leads: Became a Client", "LDTT: numbers disagree: leads: total"]);
    assert.ok(dsn.every(p => p.type === "other" && p.product_id === "bb51502e-eb05-4919-82ce-ed5a39a8d609"));
    assert.equal(body.dsn_results.length, 2); assert.ok(body.dsn_results.every(x => x.posted));
    const stored = w.db.site_settings.find(s => s.key === "site_health").value.numbers;
    assert.equal(stored.ok, false); assert.equal(stored.mismatches[0].figure, "leads: total"); assert.equal(stored.mismatches[0].portal, 29); assert.equal(stored.mismatches[0].independent, 1);
    assert.equal(body.ok, true, "page health is its own verdict; numbers live under .numbers");

    // Cap: six wrong figures → five approvals.
    crosscheck.deps.independentCounts = tables => ({ ...originalIndependent(tables), a: 1, b: 1, c: 1, d: 1, e: 1, f: 1 });
    dsn = []; w = cronWorld({ tables: { leads: rawLeads(), deals: rawDeals(), trainer_applications: rawApplications() }, dsn });
    healthCron.deps.fetch = w.fetchImpl;
    r = res(); await healthCron({ headers: { "x-vercel-cron": "1" }, query: { base: "https://site.test" } }, r);
    assert.equal(JSON.parse(r.body).numbers.mismatches.length, 6); assert.equal(dsn.length, 5);

    // Practice copy: never posts.
    process.env.LDTT_SANDBOX = "1";
    dsn = []; w = cronWorld({ tables: { leads: rawLeads(), deals: rawDeals(), trainer_applications: rawApplications() }, dsn });
    healthCron.deps.fetch = w.fetchImpl;
    r = res(); await healthCron({ headers: { "x-vercel-cron": "1" }, query: { base: "https://site.test" } }, r);
    assert.equal(JSON.parse(r.body).numbers.ok, false); assert.equal(dsn.length, 0);
  } finally {
    crosscheck.deps.independentCounts = originalIndependent;
    process.env.LDTT_SANDBOX = ""; delete process.env.DSN_AGENT_TOKEN;
  }
});

test("the exact office stage survives the round trip through raw_payload.ui_status", () => {
  const row = { id: "a1", status: "reviewing", raw_payload: { ui_status: "Interview Scheduled" } };
  assert.equal(metrics.normalizeApplicationRow(row).status, "Interview Scheduled");
  // "Discovery Follow-up" is not a board column: honouring it hid the card and
  // made the nightly cross-check disagree, so it is ignored.
  const followUp = { id: "a2", status: "discovery_follow_up", raw_payload: { ui_status: "Discovery Follow-up" } };
  assert.equal(metrics.normalizeApplicationRow(followUp).status, "Discovery Call Inquiry");
  assert.ok(metrics.APPLICATION_COLUMNS.includes(metrics.normalizeApplicationRow(followUp).status), "a stamped application always lands in a board column");
  // A stale stamp never overrides a real status change made elsewhere.
  const stale = { id: "a3", status: "archived", raw_payload: { ui_status: "Interview Scheduled" } };
  assert.equal(metrics.normalizeApplicationRow(stale).status, "Archived");
  const plain = { id: "a4", status: "reviewing", raw_payload: {} };
  assert.equal(metrics.normalizeApplicationRow(plain).status, "Under Review");
});
