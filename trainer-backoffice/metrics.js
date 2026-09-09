// LDTT staff portal — the ONE place a number is worked out (2026-09-05).
//
// The office's fear: "numbers and accuracy across each panel — one time the
// data was not up to date." Every dashboard tile, donut slice, funnel bar,
// board column, nav badge, report row, tfoot total and CSV row count in
// app.js now asks this file. The nightly cross-check (api/cron/site-health.js)
// loads the same file in Node, so what the browser shows and what the server
// checks is literally the same arithmetic.
//
// Rules of this file:
//   - pure functions over arrays of already-normalised rows;
//   - no DOM, no `state`, no fetch, no Date.now() unless passed in;
//   - isomorphic: `window.LDTT_METRICS` in the browser, `module.exports` in Node.
//
// DO-NOT-BREAK rule 1: a lead is held out ONLY when raw_payload.qa === true
// (the two old "QA release verification" rows). Nothing else about Leads-tab
// numbers moves. Rule 2: the Sales tab is bot-handled leads
// (raw_payload.sales_pipeline === true) plus trainer deals, never re-bucketed.
// Applications get the same QA hold-out (qa flag, or a qa-/qa_ name or email),
// which they never had before this file.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module && module.exports) module.exports = api;
  if (root) root.LDTT_METRICS = api;
})(typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : null, function () {
  "use strict";

  // -------------------------------------------------------------------------
  // Vocabulary (copied from app.js so Node sees the same labels).
  // -------------------------------------------------------------------------
  const LEAD_STATUS_TO_DB = {
    "New Inquiry": "new_inquiry",
    "Office Contacted": "office_contacted",
    "Engaged Lead: No Outcome": "engaged_no_outcome",
    "Evaluation Scheduled": "evaluation_scheduled",
    "Evaluation Cancelled": "evaluation_cancelled",
    "Evaluation Complete": "evaluation_complete",
    "Became a Client": "became_client",
    "Lost / No Response": "lost_no_response",
    "Lost / Price Concern": "lost_price_concern",
    "Lost / Not Ready": "lost_not_ready",
    "Lost / Chose Another Provider": "lost_chose_another_provider",
    "Lost: Client Complaint": "lost_client_complaint",
    "Lost: No Trainer in the Area": "lost_no_trainer_area",
    "Bad Lead": "bad_lead",
    "Do Not Contact": "do_not_contact",
    "Archived": "archived"
  };
  const LEAD_STATUS_FROM_DB = Object.fromEntries(Object.entries(LEAD_STATUS_TO_DB).map(([label, value]) => [value, label]));
  LEAD_STATUS_FROM_DB.follow_up_call_needed = "Office Contacted";

  const APPLICATION_STATUS_FROM_DB = {
    new_application: "New Application",
    reviewing: "Under Review",
    discovery_follow_up: "Discovery Call Inquiry",
    moved_forward: "Moved Forward",
    not_a_fit: "Declined",
    archived: "Archived"
  };

  const BOARD_COLUMNS = ["New Inquiry", "Office Contacted", "Engaged Lead: No Outcome", "Evaluation Scheduled", "Evaluation Cancelled", "Evaluation Complete", "Became a Client", "Lost"];
  const LEAD_STATUS_COUNT_ORDER = ["New Inquiry", "Office Contacted", "Engaged Lead: No Outcome", "Evaluation Scheduled", "Evaluation Cancelled", "Evaluation Complete", "Became a Client"];
  const APPLICATION_COLUMNS = ["New Application", "Under Review", "Discovery Call Inquiry", "Interview Scheduled", "Moved Forward", "Declined", "Archived"];
  const CONVERSION_STATUSES = ["Became a Client"];

  const SALES_STAGES = [
    ["captured",  "Captured & Responded",   "marketing", ["new_inquiry", "office_contacted", "engaged_no_outcome"]],
    ["booked",    "Booked",                 "marketing", ["evaluation_scheduled"]],
    ["confirmed", "Confirmed",              "marketing", ["site_visit"]],
    ["evaluated", "In the Trainer's Hands", "sales",     ["evaluation_complete"]],
    ["won",       "Won",                    "won",       ["became_client"]],
    ["lost",      "Lost",                   "lost",      ["lost_price_concern", "lost_not_ready", "lost_chose_another_provider", "lost_client_complaint", "bad_lead"]],
    ["winback",   "Win-back",               "winback",   ["lost_no_response", "follow_up_call_needed", "evaluation_cancelled", "lost_no_trainer_area"]]
  ];

  const CONVERSION_STAGE_RANK = {
    "New Inquiry": 1,
    "Office Contacted": 2,
    "Engaged Lead: No Outcome": 2,
    "Evaluation Scheduled": 3,
    "Evaluation Cancelled": 3,
    "Evaluation Complete": 4,
    "Became a Client": 5
  };

  const CONVERSION_STAGES = [
    { key: "leads", rank: 1, event: "form_received", label: "Leads came in", color: "#246bfe", help: "Everyone who filled in a form" },
    { key: "scheduled", rank: 3, event: "evaluation_scheduled", label: "Booked an eval", color: "#d80f35", help: "Of those, this many booked" },
    { key: "completed", rank: 4, event: "evaluation_completed", label: "Eval actually happened", color: "#4ac26b", help: "Of those, this many showed up" },
    { key: "clients", rank: 5, event: "became_client", label: "Paid and became a client", color: "#0c9b58", help: "Of those, this many paid" }
  ];

  const DASHBOARD_BUCKET_NAMES = ["Contact Us forms", "Paid Ad Submitted Inquiries", "Ebook requests", "Eval Scheduled", "Eval Complete", "Became a Client", "Lost", "Archived", "New Trainer Applications"];

  const QA_NAME = /^qa[_-]/i;

  // -------------------------------------------------------------------------
  // Small helpers.
  // -------------------------------------------------------------------------
  const list = rows => (Array.isArray(rows) ? rows : []);
  const count = rows => list(rows).length;
  const num = value => Number(value || 0) || 0;
  const rawOf = row => (row && (row.rawPayload || row.raw_payload)) || {};

  function parseTimestamp(value) {
    if (!value) return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    const text = String(value || "").trim();
    if (!text || /^(undefined|null)$/i.test(text) || /^https?:\/\//i.test(text)) return null;
    const normalized = /^\d{4}-\d{2}-\d{2}$/.test(text) ? `${text}T12:00:00` : text;
    const date = new Date(normalized);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const timestampValue = value => (parseTimestamp(value) ? parseTimestamp(value).getTime() : 0);
  const newestFirst = (rows, at) => [...list(rows)].sort((a, b) => timestampValue(at(b)) - timestampValue(at(a)));

  // -------------------------------------------------------------------------
  // QA hold-out.
  // -------------------------------------------------------------------------
  // Leads: the flag only (rule 1).
  function isQaLead(row) {
    if (!row) return false;
    if (row.isTest === true) return true;
    return rawOf(row).qa === true;
  }
  // Applications: the flag, or an obviously-QA name / email.
  function isQaApplication(row) {
    if (!row) return false;
    if (row.isTest === true || rawOf(row).qa === true) return true;
    const names = [row.first_name, row.last_name, row.full_name, row.name, row.email, rawOf(row).full_name, rawOf(row).name, rawOf(row).email]
      .map(value => String(value || "").trim()).filter(Boolean);
    return names.some(value => QA_NAME.test(value));
  }
  const excludeQa = (rows, isQa = isQaLead) => list(rows).filter(row => !isQa(row));

  // -------------------------------------------------------------------------
  // Normalisers: the parts of app.js's remote*ToUi that decide a number.
  // app.js spreads these into its richer UI rows; the cron uses them as-is.
  // -------------------------------------------------------------------------
  function normalizeLeadRow(row, options = {}) {
    const raw = row.raw_payload || {};
    const fallback = typeof options.statusFallback === "function" ? options.statusFallback : status => status || "New Inquiry";
    return {
      id: row.id,
      remoteId: row.id,
      isTest: raw.qa === true,
      rawSource: row.lead_source || "",
      inSalesPipeline: raw.sales_pipeline === true,
      first_name: row.first_name || raw.first_name || "",
      last_name: row.last_name || raw.last_name || "",
      email: row.email || "",
      dbStatus: row.status || "",
      status: LEAD_STATUS_FROM_DB[row.status] || fallback(row.status),
      createdAt: row.created_at || "",
      trainerRemoteId: row.trainer_id || "",
      rawPayload: raw,
      submitted: row.status !== "site_visit"
    };
  }

  function normalizeApplicationRow(row) {
    const raw = row.raw_payload || {};
    return {
      id: row.id,
      remoteId: row.id,
      isTest: raw.qa === true,
      first_name: row.first_name,
      last_name: row.last_name,
      email: row.email,
      createdAt: row.created_at,
      receivedAt: row.received_at || row.created_at,
      status: APPLICATION_STATUS_FROM_DB[row.status] || "New Application",
      rawPayload: raw
    };
  }

  function normalizeDealRow(row) {
    return {
      ...row,
      sold_amount: num(row.sold_amount),
      collected_amount: num(row.collected_amount),
      balance_due: num(row.balance_due)
    };
  }

  // -------------------------------------------------------------------------
  // Leads.
  // -------------------------------------------------------------------------
  const leadRows = rows => excludeQa(rows, isQaLead);
  const submittedLeadRows = rows => list(rows).filter(lead => lead.submitted !== false);
  const countByStatus = (rows, status) => list(rows).filter(row => row.status === status).length;
  const leadStatusCounts = (rows, statuses = LEAD_STATUS_COUNT_ORDER) => statuses.map(status => [status, countByStatus(rows, status)]);
  const boardStatus = status => (/^(Lost|Bad Lead|Do Not Contact|Archived)/.test(status) ? "Lost" : status);
  const lostLeadRows = rows => list(rows).filter(lead => boardStatus(lead.status) === "Lost");
  const newInquiryCount = rows => list(rows).filter(lead => (lead.status || "New Inquiry") === "New Inquiry").length;

  function leadBoardColumns(rows, columns = BOARD_COLUMNS, statusFn = boardStatus) {
    return columns.map(column => [column, list(rows).filter(lead => statusFn(lead.status) === column)]);
  }
  const leadBoardColumnCounts = (rows, columns = BOARD_COLUMNS, statusFn = boardStatus) => leadBoardColumns(rows, columns, statusFn).map(([column, cards]) => [column, cards.length]);

  // Dashboard buckets: a lead sits in exactly ONE status bucket, but the three
  // submission buckets (contact / paid ad / ebook) split the same rows by
  // origin. `isPaidAd` and `isEbook` are the app's classifiers (they need the
  // ad-page list); default to "nothing is a paid ad".
  function dashboardBuckets(leadRowsIn, appRowsIn, options = {}) {
    const rows = list(leadRowsIn);
    const isPaidAd = typeof options.isPaidAd === "function" ? options.isPaidAd : () => false;
    const isEbook = typeof options.isEbook === "function" ? options.isEbook : () => false;
    const paid = rows.filter(isPaidAd);
    return [
      ["Contact Us forms", rows.filter(lead => !isPaidAd(lead)).length],
      ["Paid Ad Submitted Inquiries", paid.length],
      ["Ebook requests", paid.filter(isEbook).length],
      ["Eval Scheduled", countByStatus(rows, "Evaluation Scheduled")],
      ["Eval Complete", countByStatus(rows, "Evaluation Complete")],
      ["Became a Client", countByStatus(rows, "Became a Client")],
      ["Lost", lostLeadRows(rows).length],
      ["Archived", countByStatus(rows, "Archived")],
      ["New Trainer Applications", count(appRowsIn)]
    ];
  }
  // The donut: only the stages that hold something, plus the ring total.
  function leadSummary(leadRowsIn, appRowsIn, options = {}) {
    const buckets = dashboardBuckets(leadRowsIn, appRowsIn, options).filter(([, value]) => value > 0);
    return { buckets, total: buckets.reduce((sum, [, value]) => sum + value, 0) };
  }

  // Lifecycle events keyed "<entity_type>:<entity_id>" → Set(event_type).
  function lifecycleIndex(events) {
    const index = new Map();
    list(events).forEach(event => {
      const key = `${event.entity_type || "lead"}:${event.entity_id || ""}`;
      if (!index.has(key)) index.set(key, new Set());
      index.get(key).add(event.event_type);
    });
    return index;
  }
  function leadReachedStage(lead, stageKey, index) {
    const stage = CONVERSION_STAGES.find(item => item.key === stageKey);
    if (!stage) return true;
    const events = (index && index.get(`lead:${lead.remoteId || lead.id}`)) || new Set();
    const rank = CONVERSION_STAGE_RANK[lead.status] || 1;
    return events.has(stage.event) || rank >= stage.rank;
  }
  // The funnel: a lead that reached a stage keeps counting there.
  function companyConversionCounts(leadRowsIn, index = new Map()) {
    const rows = list(leadRowsIn);
    const counts = Object.fromEntries(CONVERSION_STAGES.map(stage => [stage.key, 0]));
    rows.forEach(lead => CONVERSION_STAGES.forEach(stage => { if (leadReachedStage(lead, stage.key, index)) counts[stage.key] += 1; }));
    return { ...counts, lost: lostLeadRows(rows).length, archived: countByStatus(rows, "Archived") };
  }

  // Lifecycle-event counts (site visits, CTA clicks): one per entity.
  function lifecycleCount(events, type) {
    return new Set(list(events).filter(event => event.event_type === type)
      .map(event => `${event.entity_type || "event"}:${event.entity_id || event.event_key || event.id}`)).size;
  }

  // What the Dashboard and Reports tiles show (app.js getMetrics()).
  // visitStamps: { site_visit: [epochSeconds...], cta_click: [...] } from the
  // server - one integer per page view instead of one 450-byte row. Counted
  // inside [windowStart, windowEnd] exactly as isWithinWindow counted the rows.
  function countStampsInWindow(stamps, windowStart, windowEnd) {
    const start = windowStart instanceof Date ? windowStart.getTime() / 1000 : -Infinity;
    const end = windowEnd instanceof Date ? windowEnd.getTime() / 1000 : Infinity;
    let n = 0;
    for (const t of list(stamps)) if (t >= start && t <= end) n += 1;
    return n;
  }
  function dashboardMetrics({ leadRows: leadRowsIn = [], appRows = [], lifecycle = [], officeNotes = [], isPaidAd, isEbook, visitStamps = null, windowStart = null, windowEnd = null } = {}) {
    const rows = list(leadRowsIn);
    const buckets = Object.fromEntries(dashboardBuckets(rows, appRows, { isPaidAd, isEbook }));
    const stampVisits = visitStamps
      ? countStampsInWindow(visitStamps.site_visit, windowStart, windowEnd) + countStampsInWindow(visitStamps.cta_click, windowStart, windowEnd)
      : 0;
    return {
      visits: lifecycleCount(lifecycle, "site_visit") + lifecycleCount(lifecycle, "cta_click") + stampVisits,
      forms: rows.length,
      contactForms: buckets["Contact Us forms"] || 0,
      paidAdSubmittedInquiries: buckets["Paid Ad Submitted Inquiries"] || 0,
      ebookRequests: buckets["Ebook requests"] || 0,
      evalScheduled: countByStatus(rows, "Evaluation Scheduled"),
      evalCompleted: countByStatus(rows, "Evaluation Complete"),
      clientWon: countByStatus(rows, "Became a Client"),
      trueConversions: countByStatus(rows, "Became a Client"),
      lostNoResponse: countByStatus(rows, "Lost / No Response"),
      lostLeads: lostLeadRows(rows).length,
      newTrainerApplications: count(appRows),
      officeNotes: count(officeNotes)
    };
  }

  // Conversion by market: one row per ad market (even on zero), everything
  // else rolled into `other`, and the tfoot totals.
  function marketConversionTable(leadRowsIn, { adMarkets = [], marketKeyOf = () => "", lifecycle = new Map() } = {}) {
    const blank = () => ({ leads: 0, scheduled: 0, completed: 0, clients: 0, lost: 0 });
    const markets = new Map(list(adMarkets).map(market => [market.key, { ...market, ...blank() }]));
    const other = { key: "", label: "Everywhere else (no ad running)", ...blank() };
    const otherPlaces = new Map();
    list(leadRowsIn).forEach(lead => {
      const key = marketKeyOf(lead);
      const row = markets.get(key) || other;
      row.leads += 1;
      if (leadReachedStage(lead, "scheduled", lifecycle)) row.scheduled += 1;
      if (leadReachedStage(lead, "completed", lifecycle)) row.completed += 1;
      if (leadReachedStage(lead, "clients", lifecycle)) row.clients += 1;
      if (boardStatus(lead.status) === "Lost") row.lost += 1;
      if (row === other) otherPlaces.set(key, (otherPlaces.get(key) || 0) + 1);
    });
    const rows = [...markets.values()].sort((a, b) => b.leads - a.leads || a.label.localeCompare(b.label));
    const totals = [...rows, other].reduce((sum, value) => ({
      leads: sum.leads + value.leads, scheduled: sum.scheduled + value.scheduled, completed: sum.completed + value.completed, clients: sum.clients + value.clients, lost: sum.lost + value.lost
    }), blank());
    return { rows, other, otherPlaces, totals };
  }
  const rate = (part, whole) => (whole ? `${Math.round((part / whole) * 100)}%` : "—");
  const percent = (part, whole) => (whole ? Math.round((part / whole) * 100) : 0);

  // -------------------------------------------------------------------------
  // Sales (rule 2): bot-handled leads + trainer deals only.
  // -------------------------------------------------------------------------
  // `keepQa` is the office's "show test leads" toggle; the default holds QA out.
  const salesPipelineRows = (leads, { keepQa = false } = {}) => (keepQa ? list(leads) : leadRows(leads)).filter(lead => lead.inSalesPipeline === true);
  const activeDeals = deals => list(deals).filter(deal => deal.status !== "cancelled");
  function salesStageFor(lead, stages = SALES_STAGES) {
    const db = String((lead && lead.dbStatus) || "").trim();
    const found = stages.find(([, , , statuses]) => statuses.includes(db));
    return found ? found[0] : "captured";
  }
  function salesBuckets(rows, stages = SALES_STAGES) {
    const buckets = new Map(stages.map(([id]) => [id, []]));
    list(rows).forEach(lead => { const bucket = buckets.get(salesStageFor(lead, stages)); if (bucket) bucket.push(lead); });
    return buckets;
  }
  // Deals that are not already represented by a won lead card.
  const dealsWithoutLead = (deals, wonLeads) => list(deals).filter(deal => !list(wonLeads).some(lead => lead.remoteId && lead.remoteId === deal.lead_id));
  const sumMoney = (deals, field) => list(deals).reduce((sum, deal) => sum + num(deal[field]), 0);
  function salesTotals(rows, dealsIn, stages = SALES_STAGES) {
    const deals = activeDeals(dealsIn);
    const buckets = salesBuckets(rows, stages);
    const wonLeads = buckets.get("won") || [];
    const lost = buckets.get("lost") || [];
    const winback = buckets.get("winback") || [];
    const won = wonLeads.length + dealsWithoutLead(deals, wonLeads).length;
    const decided = won + lost.length;
    const booked = (buckets.get("booked") || []).length + (buckets.get("confirmed") || []).length + (buckets.get("evaluated") || []).length;
    return {
      inPipeline: count(rows), deals: deals.length, won, decided, closeRate: percent(won, decided), booked,
      lost: lost.length, winback: winback.length,
      soldTotal: sumMoney(deals, "sold_amount"), collectedTotal: sumMoney(deals, "collected_amount")
    };
  }
  function salesColumnCounts(rows, dealsIn, stages = SALES_STAGES) {
    const totals = salesTotals(rows, dealsIn, stages);
    const buckets = salesBuckets(rows, stages);
    return stages.map(([id]) => [id, id === "won" ? totals.won : (buckets.get(id) || []).length]);
  }
  function salesSourceRows(rows, stages = SALES_STAGES) {
    return Object.entries(list(rows).reduce((acc, lead) => {
      const key = lead.rawSource || lead.source || "Other";
      acc[key] = acc[key] || { total: 0, won: 0, sample: lead };
      acc[key].total += 1;
      if (salesStageFor(lead, stages) === "won") acc[key].won += 1;
      return acc;
    }, {})).sort((a, b) => b[1].total - a[1].total).map(([source, stat]) => [source, { ...stat, rate: percent(stat.won, stat.total) }]);
  }

  // Trainer: My Deals.
  function trainerDeals(dealsIn, paymentsIn, today) {
    const deals = activeDeals(dealsIn);
    const pays = list(paymentsIn).filter(p => deals.some(d => d.id === p.deal_id));
    const sold = sumMoney(deals, "sold_amount");
    const collected = sumMoney(deals, "collected_amount");
    const dueNow = pays.filter(p => p.status === "scheduled" && p.due_on <= today);
    const upcoming = pays.filter(p => p.status === "scheduled" && p.due_on > today).sort((a, b) => a.due_on.localeCompare(b.due_on));
    return { deals, count: deals.length, sold, collected, collectedPercent: percent(collected, sold), dueNow, upcoming };
  }
  const paymentsDueNow = (payments, today) => list(payments).filter(p => p.status === "scheduled" && p.due_on <= today).length;

  // -------------------------------------------------------------------------
  // Applications (QA held out, newest first).
  // -------------------------------------------------------------------------
  const applicationRows = rows => newestFirst(excludeQa(rows, isQaApplication), app => app.receivedAt || app.createdAt);
  const applicationNeedsAction = app => ((app && app.status) || "New Application") === "New Application";
  function applicationTiles(rows) {
    const apps = list(rows);
    return {
      total: apps.length,
      needsAction: apps.filter(applicationNeedsAction).length,
      discovery: countByStatus(apps, "Discovery Call Inquiry"),
      movedForward: countByStatus(apps, "Moved Forward")
    };
  }
  function applicationColumns(rows, columns = APPLICATION_COLUMNS) {
    return columns.map(column => [column, list(rows).filter(app => (app.status || "New Application") === column)]);
  }
  const applicationColumnCounts = (rows, columns = APPLICATION_COLUMNS) => applicationColumns(rows, columns).map(([column, cards]) => [column, cards.length]);

  // -------------------------------------------------------------------------
  // Clients.
  // -------------------------------------------------------------------------
  function clientCounts(loaded, shown, remoteTotal) {
    const loadedCount = count(loaded);
    const total = Math.max(num(remoteTotal), loadedCount);
    return { loaded: loadedCount, shown: count(shown), total, moreOnServer: num(remoteTotal) > loadedCount };
  }

  // -------------------------------------------------------------------------
  // Trainer role.
  // -------------------------------------------------------------------------
  const wonCount = rows => list(rows).filter(lead => CONVERSION_STATUSES.includes(lead.status)).length;
  function trainerDashboard(leads, submissions) {
    return {
      assigned: count(leads),
      evalScheduled: countByStatus(leads, "Evaluation Scheduled"),
      won: wonCount(leads),
      pendingSubmissions: list(submissions).filter(s => s.status === "Pending").length
    };
  }
  function trainerPerformance(leads, pageForms) {
    return { inRange: count(leads), evalComplete: countByStatus(leads, "Evaluation Complete"), won: wonCount(leads), pageForms: num(pageForms) };
  }
  // Trainer page cards / Reports "Conversion by trainer".
  function trainerStats(events, leads) {
    return {
      clicks: list(events).filter(event => event.event_type === "trainer_page_view").length,
      forms: list(leads).filter(lead => lead.submitted).length,
      conversions: wonCount(leads),
      leads: list(leads)
    };
  }

  // -------------------------------------------------------------------------
  // Nav badges.
  // -------------------------------------------------------------------------
  function navBadgeCounts({ leads = [], applications = [], pendingReviews = [], trainerLeads = [], payments = [], mediaSubmissions = [], reviewSubmissions = [], today = "" } = {}) {
    return {
      newLeads: newInquiryCount(leads),
      applicationsNeedAction: list(applications).filter(applicationNeedsAction).length,
      pendingReviews: count(pendingReviews),
      myLeads: list(trainerLeads).filter(l => !["Archived", "Became a Client"].includes(l.status)).length,
      paymentsDue: paymentsDueNow(payments, today),
      mediaPending: list(mediaSubmissions).filter(s => s.status === "Pending").length,
      reviewsPending: list(reviewSubmissions).filter(s => s.status === "Pending").length
    };
  }

  // -------------------------------------------------------------------------
  // CSV: the same rows the screen shows, one line each.
  // -------------------------------------------------------------------------
  const escapeCsv = value => `"${String(value ?? "").replace(/"/g, '""')}"`;
  function csvDocument(fields, rows, valueOf) {
    const header = list(fields).map(field => escapeCsv(field.label ?? field)).join(",");
    const lines = list(rows).map(row => list(fields).map(field => escapeCsv(valueOf(row, field))).join(","));
    return { csv: [header, ...lines].join("\n"), rows: lines.length };
  }
  const csvRowCount = csv => Math.max(0, String(csv || "").split("\n").length - 1);

  return {
    LEAD_STATUS_TO_DB, LEAD_STATUS_FROM_DB, APPLICATION_STATUS_FROM_DB, BOARD_COLUMNS, LEAD_STATUS_COUNT_ORDER, APPLICATION_COLUMNS,
    CONVERSION_STATUSES, SALES_STAGES, CONVERSION_STAGE_RANK, CONVERSION_STAGES, DASHBOARD_BUCKET_NAMES,
    count, parseTimestamp, timestampValue, newestFirst,
    isQaLead, isQaApplication, excludeQa,
    normalizeLeadRow, normalizeApplicationRow, normalizeDealRow,
    leadRows, submittedLeadRows, countByStatus, leadStatusCounts, boardStatus, lostLeadRows, newInquiryCount,
    leadBoardColumns, leadBoardColumnCounts, dashboardBuckets, leadSummary, lifecycleIndex, leadReachedStage,
    companyConversionCounts, lifecycleCount, countStampsInWindow, dashboardMetrics, marketConversionTable, rate, percent,
    salesPipelineRows, activeDeals, salesStageFor, salesBuckets, dealsWithoutLead, salesTotals, salesColumnCounts, salesSourceRows,
    trainerDeals, paymentsDueNow,
    applicationRows, applicationNeedsAction, applicationTiles, applicationColumns, applicationColumnCounts,
    clientCounts, wonCount, trainerDashboard, trainerPerformance, trainerStats, navBadgeCounts,
    escapeCsv, csvDocument, csvRowCount
  };
});
