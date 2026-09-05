// Nightly numbers cross-check (2026-09-05).
//
// The office's fear: "numbers and accuracy across each panel — one time the
// data was not up to date." The portal now takes every figure from
// trainer-backoffice/metrics.js. This file runs that SAME file in Node over
// the live tables and compares each key figure with a second, deliberately
// dumb computation written straight against the raw rows (what a SQL
// `count(*) ... group by status` would give). If the two disagree, the cron
// files ONE DSN Command approval per differing figure (capped) so Joshua is
// texted, and the result is stored under site_settings.site_health.numbers.
//
// Everything here is read-only. Nothing is written by this file.
const metrics = require("../trainer-backoffice/metrics.js");
const { supabaseRequest } = require("./sandbox");

const DSN_PRODUCT_ID = "bb51502e-eb05-4919-82ce-ed5a39a8d609";
const MAX_NUMBER_APPROVALS = 5;
const PAGE_SIZE = 1000;
const MAX_ROWS = 50000;

// Plain-SQL-style vocabulary, on purpose NOT taken from metrics.js.
const LOST_DB_STATUSES = ["lost_no_response", "lost_price_concern", "lost_not_ready", "lost_chose_another_provider", "lost_client_complaint", "lost_no_trainer_area", "bad_lead", "do_not_contact", "archived"];
const STATUS_FIGURES = [
  ["New Inquiry", ["new_inquiry"]],
  ["Office Contacted", ["office_contacted", "follow_up_call_needed"]],
  ["Engaged Lead: No Outcome", ["engaged_no_outcome"]],
  ["Evaluation Scheduled", ["evaluation_scheduled"]],
  ["Evaluation Cancelled", ["evaluation_cancelled"]],
  ["Evaluation Complete", ["evaluation_complete"]],
  ["Became a Client", ["became_client"]],
  ["Archived", ["archived"]]
];
// Funnel ranks by raw status (rank-only: lifecycle events are not part of the
// nightly check, so both sides count "reached a stage" from the status alone).
const RANK_BY_DB_STATUS = {
  new_inquiry: 1, office_contacted: 2, follow_up_call_needed: 2, engaged_no_outcome: 2,
  evaluation_scheduled: 3, evaluation_cancelled: 3, evaluation_complete: 4, became_client: 5
};

const deps = {};

// Page through a REST path with limit/offset. Every page goes through the
// schema switch (supabaseRequest → practice / public); the cron's supabaseFetch
// carries the key and applies the same switch again, which is harmless.
async function fetchAllRows(supabaseFetch, path, pageSize = PAGE_SIZE) {
  const separator = path.includes("?") ? "&" : "?";
  const rows = [];
  for (let offset = 0; offset < MAX_ROWS; offset += pageSize) {
    const target = supabaseRequest(`${path}${separator}limit=${pageSize}&offset=${offset}`);
    const page = await supabaseFetch(target.path, { headers: target.headers });
    if (!Array.isArray(page)) break;
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

async function fetchTables(supabaseFetch) {
  const [leads, deals, applications] = await Promise.all([
    fetchAllRows(supabaseFetch, "/rest/v1/leads?select=id,status,lead_source,trainer_id,first_name,last_name,email,created_at,raw_payload&order=created_at.desc"),
    fetchAllRows(supabaseFetch, "/rest/v1/deals?select=id,lead_id,client_id,trainer_id,status,sold_amount,collected_amount,balance_due&order=created_at.desc"),
    fetchAllRows(supabaseFetch, "/rest/v1/trainer_applications?select=id,status,first_name,last_name,email,created_at,received_at,raw_payload&order=created_at.desc")
  ]);
  return { leads, deals, applications };
}

// Side A: metrics.js, exactly as the browser runs it.
function metricsFigures({ leads, deals, applications }) {
  const leadRows = metrics.leadRows(leads.map(row => metrics.normalizeLeadRow(row)));
  const submitted = metrics.submittedLeadRows(leadRows);
  const apps = metrics.applicationRows(applications.map(metrics.normalizeApplicationRow));
  const dealRows = deals.map(metrics.normalizeDealRow);
  const summary = new Map(metrics.leadSummary(submitted, apps).buckets);
  const funnel = metrics.companyConversionCounts(submitted);
  const pipeline = metrics.salesPipelineRows(leadRows);
  const sales = metrics.salesTotals(pipeline, dealRows);
  const tiles = metrics.applicationTiles(apps);
  const figures = { "leads: total": leadRows.length };
  for (const [label] of STATUS_FIGURES) figures[`leads: ${label}`] = metrics.countByStatus(leadRows, label);
  figures["leads: Lost (board column)"] = metrics.lostLeadRows(leadRows).length;
  figures["dashboard: form submissions"] = submitted.length;
  figures["dashboard donut: Eval Scheduled"] = summary.get("Eval Scheduled") || 0;
  figures["dashboard donut: Eval Complete"] = summary.get("Eval Complete") || 0;
  figures["dashboard donut: Became a Client"] = summary.get("Became a Client") || 0;
  figures["dashboard donut: Lost"] = summary.get("Lost") || 0;
  figures["dashboard donut: Archived"] = summary.get("Archived") || 0;
  figures["dashboard donut: New Trainer Applications"] = summary.get("New Trainer Applications") || 0;
  figures["funnel: leads came in"] = funnel.leads;
  figures["funnel: booked an eval"] = funnel.scheduled;
  figures["funnel: eval happened"] = funnel.completed;
  figures["funnel: became a client"] = funnel.clients;
  figures["sales: in pipeline"] = sales.inPipeline;
  figures["sales: deals"] = sales.deals;
  figures["sales: won"] = sales.won;
  figures["sales: sold total"] = sales.soldTotal;
  figures["sales: collected total"] = sales.collectedTotal;
  figures["applications: total"] = tiles.total;
  figures["applications: needs action"] = tiles.needsAction;
  figures["applications: discovery call inquiry"] = tiles.discovery;
  figures["applications: moved forward"] = tiles.movedForward;
  return figures;
}

// Side B: dumb counts straight off the raw rows. No metrics.js in here.
function independentCounts({ leads, deals, applications }) {
  const qa = row => (row.raw_payload || {}).qa === true;
  const qaName = row => [row.first_name, row.last_name, row.email, (row.raw_payload || {}).full_name].some(value => /^qa[_-]/i.test(String(value || "").trim()));
  const realLeads = leads.filter(row => !qa(row));
  const submitted = realLeads.filter(row => row.status !== "site_visit");
  const realApps = applications.filter(row => !qa(row) && !qaName(row));
  const liveDeals = deals.filter(row => row.status !== "cancelled");
  const statusIn = (rows, set) => rows.filter(row => set.includes(String(row.status || ""))).length;
  const reached = (rows, rank) => rows.filter(row => (RANK_BY_DB_STATUS[row.status] || 1) >= rank).length;
  const money = field => liveDeals.reduce((sum, row) => sum + (Number(row[field] || 0) || 0), 0);
  const pipeline = realLeads.filter(row => (row.raw_payload || {}).sales_pipeline === true);
  const wonPipeline = pipeline.filter(row => row.status === "became_client");
  const figures = { "leads: total": realLeads.length };
  for (const [label, dbValues] of STATUS_FIGURES) figures[`leads: ${label}`] = statusIn(realLeads, dbValues);
  figures["leads: Lost (board column)"] = statusIn(realLeads, LOST_DB_STATUSES);
  figures["dashboard: form submissions"] = submitted.length;
  figures["dashboard donut: Eval Scheduled"] = statusIn(submitted, ["evaluation_scheduled"]);
  figures["dashboard donut: Eval Complete"] = statusIn(submitted, ["evaluation_complete"]);
  figures["dashboard donut: Became a Client"] = statusIn(submitted, ["became_client"]);
  figures["dashboard donut: Lost"] = statusIn(submitted, LOST_DB_STATUSES);
  figures["dashboard donut: Archived"] = statusIn(submitted, ["archived"]);
  figures["dashboard donut: New Trainer Applications"] = realApps.length;
  figures["funnel: leads came in"] = reached(submitted, 1);
  figures["funnel: booked an eval"] = reached(submitted, 3);
  figures["funnel: eval happened"] = reached(submitted, 4);
  figures["funnel: became a client"] = reached(submitted, 5);
  figures["sales: in pipeline"] = pipeline.length;
  figures["sales: deals"] = liveDeals.length;
  figures["sales: won"] = wonPipeline.length + liveDeals.filter(deal => !wonPipeline.some(lead => lead.id === deal.lead_id)).length;
  figures["sales: sold total"] = money("sold_amount");
  figures["sales: collected total"] = money("collected_amount");
  figures["applications: total"] = realApps.length;
  figures["applications: needs action"] = statusIn(realApps, ["new_application"]);
  figures["applications: discovery call inquiry"] = statusIn(realApps, ["discovery_follow_up"]);
  figures["applications: moved forward"] = statusIn(realApps, ["moved_forward"]);
  return figures;
}
deps.independentCounts = independentCounts;

function compareFigures(portal, independent) {
  const names = Array.from(new Set([...Object.keys(portal), ...Object.keys(independent)]));
  const figures = names.map(figure => {
    const a = portal[figure]; const b = independent[figure];
    const same = typeof a === "number" && typeof b === "number" ? Math.abs(a - b) < 0.005 : a === b;
    return { figure, portal: a, independent: b, ok: same };
  });
  return { figures, mismatches: figures.filter(f => !f.ok) };
}

function numbersApprovalPayload(mismatch, { ranAt } = {}) {
  return {
    product_id: DSN_PRODUCT_ID,
    type: "other",
    title: `LDTT: numbers disagree: ${mismatch.figure}`,
    body: `The nightly numbers cross-check (${ranAt || "now"}) found the staff portal's figure "${mismatch.figure}" does not match a plain count of the live rows:\n- portal (trainer-backoffice/metrics.js): ${mismatch.portal}\n- plain count of the table: ${mismatch.independent}\n\nWhat to do: open the Dashboard and the matching tab and see which one is right; the full list is in site_settings.site_health.numbers. No data was changed.`,
    risk: "medium",
    cost_cents: 0
  };
}

// The step the cron runs. Never throws: a fetch failure is reported, not raised.
async function runNumbersCrossCheck({ supabaseFetch, ranAt = new Date().toISOString() }) {
  try {
    const tables = await fetchTables(supabaseFetch);
    const { figures, mismatches } = compareFigures(metricsFigures(tables), deps.independentCounts(tables));
    return {
      ok: mismatches.length === 0,
      ran_at: ranAt,
      rows: { leads: tables.leads.length, deals: tables.deals.length, applications: tables.applications.length },
      figures,
      mismatches,
      approvals: mismatches.slice(0, MAX_NUMBER_APPROVALS).map(mismatch => numbersApprovalPayload(mismatch, { ranAt }))
    };
  } catch (error) {
    return { ok: null, ran_at: ranAt, error: error.message || String(error), figures: [], mismatches: [], approvals: [] };
  }
}

module.exports = { DSN_PRODUCT_ID, MAX_NUMBER_APPROVALS, deps, fetchAllRows, fetchTables, metricsFigures, independentCounts, compareFigures, numbersApprovalPayload, runNumbersCrossCheck };
