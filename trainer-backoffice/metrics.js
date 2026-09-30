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
    // Zoom 2026-09-24 (Lorenzo): two more HARD NO statuses. Added, never renamed (rule 10).
    "Lost: Doesn't Believe in Our Training Method": "lost_method_not_a_fit",
    "Lost: Dog Doesn't Qualify": "lost_dog_not_qualified",
    // Meeting 2026-09-16: two closed statuses for a sale that came apart. They count with Lost, never as sold.
    "Canceled / Refunded": "canceled_refunded",
    "Canceled / Write off": "canceled_write_off",
    "Bad Lead": "bad_lead",
    "Do Not Contact": "do_not_contact",
    "Archived": "archived"
  };
  // Lost vs Archive (Zoom 2026-09-24, Lorenzo: "Lost would be there's no need in us contacting them again").
  // LOST = a hard no, exactly four reasons: no trainer in their area, does not believe in our training method, the dog
  // does not qualify (health, age...), went with a competitor. EVERYTHING ELSE is ARCHIVE ("we may come back six months
  // or we may do TTRG for them"): not ready / money, talking it over with family, cannot reach them, other.
  // [key, plain words, database status]. The office Lost list and the trainer Lost action offer ONLY these.
  const HARD_NO_LOST_REASONS = [
    ["no_trainer_area", "No trainer in their area", "lost_no_trainer_area"],
    ["method_not_a_fit", "Doesn't believe in our training method", "lost_method_not_a_fit"],
    ["dog_not_qualified", "Dog doesn't qualify (health, age, etc.)", "lost_dog_not_qualified"],
    ["competitor", "Went with a competitor", "lost_chose_another_provider"]
  ];
  const HARD_NO_LOST_STATUSES = HARD_NO_LOST_REASONS.map(([, , status]) => status);
  // The older "soft" Lost statuses keep working on the rows that carry them (the office recategorizes the 84 by hand);
  // they are no longer OFFERED as a new choice.
  const SOFT_LOST_STATUSES = ["lost_no_response", "lost_price_concern", "lost_not_ready", "lost_client_complaint"];
  const ARCHIVE_REASONS = [
    ["not_ready_money", "Not ready / money"],
    ["family", "Talking it over with family"],
    ["unreachable", "Can't reach them"],
    ["other", "Other"]
  ];
  const LEAD_STATUS_FROM_DB = Object.fromEntries(Object.entries(LEAD_STATUS_TO_DB).map(([label, value]) => [value, label]));
  LEAD_STATUS_FROM_DB.follow_up_call_needed = "Office Contacted";

  // The database keeps fewer stage words than the office board ("Interview
  // Scheduled" and "Under Review" both store as reviewing). The exact office
  // stage is stamped into raw_payload.ui_status by the portal and wins on the
  // way back only while it still agrees with the stored status.
  const APPLICATION_STATUS_TO_DB = {
    "New Application": "new_application",
    "Under Review": "reviewing",
    "Discovery Call Inquiry": "discovery_follow_up",
    "Discovery Follow-up": "discovery_follow_up",
    "Interview Scheduled": "reviewing",
    "Moved Forward": "moved_forward",
    "Declined": "not_a_fit",
    "Archived": "archived"
  };
  const APPLICATION_STATUS_FROM_DB = {
    new_application: "New Application",
    reviewing: "Under Review",
    discovery_follow_up: "Discovery Call Inquiry",
    moved_forward: "Moved Forward",
    not_a_fit: "Declined",
    archived: "Archived"
  };

  // Display words only (Rachel 2026-09-24): the status VALUE "Office Contacted" / office_contacted never changes
  // (rule 10); every screen shows it as "Office/Trainer Contacted" because trainers now mark it too.
  const STATUS_DISPLAY_LABELS = { "Office Contacted": "Office/Trainer Contacted" };
  const statusLabel = status => STATUS_DISPLAY_LABELS[status] || status;

  const BOARD_COLUMNS = ["New Inquiry", "Office Contacted", "Engaged Lead: No Outcome", "Evaluation Scheduled", "Evaluation Cancelled", "Evaluation Complete", "Became a Client", "Lost"];
  const LEAD_STATUS_COUNT_ORDER = ["New Inquiry", "Office Contacted", "Engaged Lead: No Outcome", "Evaluation Scheduled", "Evaluation Cancelled", "Evaluation Complete", "Became a Client"];
  const APPLICATION_COLUMNS = ["New Application", "Under Review", "Discovery Call Inquiry", "Interview Scheduled", "Moved Forward", "Declined", "Archived"];
  const CONVERSION_STATUSES = ["Became a Client"];

  const SALES_STAGES = [
    ["captured",  "Captured & Responded",   "marketing", ["new_inquiry", "office_contacted", "engaged_no_outcome"]],
    ["booked",    "Booked",                 "marketing", ["evaluation_scheduled"]],
    // Label only (meeting 2026-09-12, Tim + Angela): a lead is fully confirmed only when it is booked, has a trainer
    // AND the client answered the pre-evaluation questions. Key and statuses unchanged (rule 10).
    ["confirmed", "Eval Questions Completed", "marketing", ["site_visit"]],
    // Label only (meeting 2026-09-11): renamed from the old trainer-hands wording. Key and statuses unchanged (rule 10).
    ["evaluated", "Eval Completed",         "sales",     ["evaluation_complete"]],
    ["won",       "Won",                    "won",       ["became_client"]],
    ["lost",      "Lost",                   "lost",      ["lost_price_concern", "lost_not_ready", "lost_chose_another_provider", "lost_client_complaint", "bad_lead", "canceled_refunded", "canceled_write_off", "lost_method_not_a_fit", "lost_dog_not_qualified"]],
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
      status: (raw.ui_status && APPLICATION_COLUMNS.includes(raw.ui_status) && APPLICATION_STATUS_TO_DB[raw.ui_status] === row.status) ? raw.ui_status : (APPLICATION_STATUS_FROM_DB[row.status] || "New Application"),
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
  const boardStatus = status => (/^(Lost|Canceled|Bad Lead|Do Not Contact|Archived)/.test(status) ? "Lost" : status);
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
    // Rule 81 (meeting 2026-09-12): a booked lead whose client answered the pre-evaluation questions is
    // "Eval Questions Completed". Its status stays evaluation_scheduled, so the Leads tab never moves (rule 1),
    // and Sales "booked" still counts it (salesTotals adds booked + confirmed + evaluated).
    if (db === "evaluation_scheduled" && rawOf(lead).booking?.pre_eval?.submitted_at && stages.some(([id]) => id === "confirmed")) return "confirmed";
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
    // Meeting 2026-09-12: the trainer's tiles read Clients / Revenue / Collected / Balance due / Contracted
    // revenue. A client is counted once even with two deals (same client record, else same lead, else same name).
    const clientKeys = new Set(deals.map(d => String(d.client_id || (d.lead_id ? `lead:${d.lead_id}` : `name:${String(d.client_name || "").trim().toLowerCase()}`))));
    const clients = clientKeys.size;
    const balanceDue = sumMoney(deals, "balance_due");
    return {
      deals, count: deals.length, sold, collected, collectedPercent: percent(collected, sold), dueNow, upcoming,
      clients, revenue: sold, balanceDue,
      clientGoal: TRACK500_CLIENT_GOAL, clientsToGo: Math.max(0, TRACK500_CLIENT_GOAL - clients),
      // Joshua 2026-09-14 (decision sheet): Contracted Revenue counts down by money COLLECTED, not sold.
      revenueGoal: TRACK500_REVENUE_GOAL, revenueToGo: Math.max(0, TRACK500_REVENUE_GOAL - collected)
    };
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

  // Track 500 (meeting 2026-09-12, Tim + Angela): every trainer signs for 500 clients at about $2,500
  // each = $1,250,000. The trainer portal counts both down.
  const TRACK500_CLIENT_GOAL = 500;
  const TRACK500_REVENUE_GOAL = 1250000;

  // The trainer's working board MIRRORS the office Leads board (Rachel 2026-09-25, Lorenzo agreed the same day,
  // replacing the six-column task board of 2026-09-24): the same eight columns, the same words, the same status in
  // each, so the office and the trainer read one board when they talk about a lead:
  //   New Inquiry | Office/Trainer Contacted | Engaged Lead: No Outcome | Evaluation Scheduled |
  //   Evaluation Cancelled | Evaluation Complete | Became a Client | Lost
  // "Office/Trainer Contacted" = called, no conversation (voicemail). "Engaged Lead: No Outcome" = spoke with them,
  // no booking (Chloe Williams since 9/10). Bucketed by the DATABASE status, like boardStatus() on the office board.
  // One difference, on purpose: Do Not Contact and Archived are never drawn for a trainer (rule 80).
  const TRAINER_PIPELINE_STAGES = [
    ["inquiry",   "New Inquiry",              ["new_inquiry"]],
    ["contacted", "Office/Trainer Contacted", ["office_contacted", "follow_up_call_needed"]],
    ["engaged",   "Engaged Lead: No Outcome", ["engaged_no_outcome"]],
    ["scheduled", "Evaluation Scheduled",     ["evaluation_scheduled"]],
    ["cancelled", "Evaluation Cancelled",     ["evaluation_cancelled"]],
    ["completed", "Evaluation Complete",      ["evaluation_complete"]],
    ["sold",      "Became a Client",          ["became_client"]],
    ["lost",      "Lost",                     ["lost_no_response", "lost_price_concern", "lost_not_ready", "lost_chose_another_provider",
                                               "lost_client_complaint", "lost_no_trainer_area", "bad_lead",
                                               "canceled_refunded", "canceled_write_off", "lost_method_not_a_fit", "lost_dog_not_qualified"]]
  ];
  const TRAINER_HIDDEN_DB_STATUSES = ["do_not_contact", "archived"];
  // The row's database status. A real row carries it (normalizeLeadRow -> dbStatus); a demo/offline row carries
  // only the screen word, which LEAD_STATUS_TO_DB turns back into the database value.
  function trainerDbStatus(lead) {
    if (lead && lead.dbStatus) return lead.dbStatus;
    const status = String((lead && lead.status) || "New Inquiry");
    if (LEAD_STATUS_TO_DB[status]) return LEAD_STATUS_TO_DB[status];
    if (/^Lost/.test(status)) return "lost_no_response";
    if (/^Canceled/.test(status)) return "canceled_refunded";
    return "";
  }
  function trainerStageFor(lead) {
    const db = trainerDbStatus(lead);
    if (TRAINER_HIDDEN_DB_STATUSES.includes(db)) return null;
    const found = TRAINER_PIPELINE_STAGES.find(([, , statuses]) => statuses.includes(db));
    return found ? found[0] : null;
  }
  const trainerBoardRows = leads => list(leads).filter(lead => trainerStageFor(lead) !== null);
  // Map stage id -> rows, in board order.
  function trainerPipeline(leads) {
    const buckets = new Map(TRAINER_PIPELINE_STAGES.map(([id]) => [id, []]));
    list(leads).forEach(lead => { const id = trainerStageFor(lead); if (id) buckets.get(id).push(lead); });
    return buckets;
  }
  // [label, rows, id] per column, in board order (new Map(...) of it is keyed by the column's words).
  const trainerLeadBoard = leads => {
    const buckets = trainerPipeline(leads);
    return TRAINER_PIPELINE_STAGES.map(([id, label]) => [label, buckets.get(id), id]);
  };

  function trainerDashboard(leads, submissions) {
    // Every figure is one column of the trainer's board (the office's eight columns since 2026-09-25):
    //   newInquiries = New Inquiry, contacted = Office/Trainer Contacted, engaged = Engaged Lead: No Outcome,
    //   evalScheduled / evalCancelled / evalCompleted, won = Became a Client, lost = Lost (lost_*, bad lead, canceled_*)
    // assigned = every lead assigned to the trainer (hidden ones included), as before.
    const board = trainerPipeline(leads);
    return {
      newInquiries: board.get("inquiry").length,
      contacted: board.get("contacted").length,
      engaged: board.get("engaged").length,
      assigned: count(leads),
      evalScheduled: board.get("scheduled").length,
      evalCancelled: board.get("cancelled").length,
      evalCompleted: board.get("completed").length,
      won: board.get("sold").length,
      lost: board.get("lost").length,
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
  // Recycled leads (Zoom 2026-09-24, Lorenzo + Angela): "how do we know if they were new inquiries or somebody
  // that came back?" A lead is RECYCLED when an OLDER lead exists for the same person: the same email
  // (case-insensitive) or the same 10-digit phone. DISPLAY ONLY: nothing about lead creation, logging or any count
  // changes. Two linear passes and one Map, so the whole board costs O(rows).
  // -------------------------------------------------------------------------
  function personMatchKeys(row) {
    const keys = [];
    const raw = rawOf(row);
    const email = String((row && row.email) || (raw.booking && raw.booking.client && raw.booking.client.email) || "").trim().toLowerCase();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) keys.push(`e:${email}`);
    const digits = String((row && row.phone) || "").replace(/\D/g, "");
    const ten = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
    // A real US number only: placeholders such as 0000000000 or 1111111111 never make two people one.
    if (/^[2-9]\d{2}[2-9]\d{6}$/.test(ten) && !/^(\d)\1{9}$/.test(ten)) keys.push(`p:${ten}`);
    return keys;
  }
  // Map lead id -> { firstAt, firstLeadId, count } for every lead that has an older twin. Rows that share an email
  // or a phone are one person, and so are the rows linked through them (a lead with the email of the first and the
  // phone of the second joins both), so "first came in" is that person's EARLIEST lead. Union-find over the keys.
  // 2026-09-28 (joined cards, rule 129): a card that carries raw_payload.merged_requests is ALSO Recycled, "first came
  // in" is the earliest of its own time and every joined request's time, and each joined request counts as one request
  // in "(N requests in all)". The joined requests are history on ONE card: they are never rows and never counted as leads.
  function recycledIndex(rows) {
    const items = list(rows);
    const parent = items.map((_, i) => i);
    const find = i => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
    const ownerOfKey = new Map();
    items.forEach((row, i) => {
      for (const key of personMatchKeys(row)) {
        if (ownerOfKey.has(key)) parent[find(i)] = find(ownerOfKey.get(key)); else ownerOfKey.set(key, i);
      }
    });
    const ownAt = row => (row && (row.createdAt || row.created_at)) || "";
    // The earliest moment this CARD knows about: its own request or any request joined into it.
    const firstOf = row => {
      let best = { t: timestampValue(ownAt(row)), s: ownAt(row) };
      for (const req of mergedRequestsOf(row)) {
        const t = timestampValue(req.created_at);
        if (t && (!best.t || t < best.t)) best = { t, s: req.created_at };
      }
      return best;
    };
    const older = (a, b) => firstOf(a).t < firstOf(b).t || (firstOf(a).t === firstOf(b).t && String(a.id) < String(b.id));
    const counted = row => personMatchKeys(row).length > 0 || mergedRequestsOf(row).length > 0;
    const earliest = new Map(); // root -> row
    const size = new Map();
    items.forEach((row, i) => {
      if (!counted(row)) return;
      const root = find(i);
      size.set(root, (size.get(root) || 0) + 1 + mergedRequestsOf(row).length);
      const best = earliest.get(root);
      if (!best || older(row, best)) earliest.set(root, row);
    });
    const out = new Map();
    items.forEach((row, i) => {
      if (!counted(row)) return;
      const root = find(i);
      const first = earliest.get(root);
      const joined = mergedRequestsOf(row).length > 0;
      if (first && ((first !== row && first.id !== row.id) || joined)) out.set(row.id, { firstAt: firstOf(first).s || "", firstLeadId: first.id, count: size.get(root) || 2 });
    });
    return out;
  }
  // Every loaded card of the same person as `id` (the same union as recycledIndex), oldest first. Used by the office's
  // Recycled history and "Join with older request"; display only.
  function personRows(rows, id) {
    const items = list(rows);
    const start = items.find(row => row && row.id === id);
    if (!start) return [];
    const seenKeys = new Set(personMatchKeys(start));
    const group = new Set([start]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const row of items) {
        if (group.has(row)) continue;
        const keys = personMatchKeys(row);
        if (keys.some(key => seenKeys.has(key))) { group.add(row); keys.forEach(key => seenKeys.add(key)); grew = true; }
      }
    }
    const at = row => timestampValue((row && (row.createdAt || row.created_at)) || "");
    return [...group].sort((a, b) => at(a) - at(b) || String(a.id).localeCompare(String(b.id)));
  }

  // -------------------------------------------------------------------------
  // Joining duplicate cards (Joshua + Missy, 2026-09-28): "join them, keep the recycled logo on them, they will still
  // count as one lead not two, and the history should be seen when someone clicks the Recycled badge". lib/lead-merge.js
  // does the join on the server; the words and the "which card stays" rule live HERE so the office's confirm dialog,
  // the badge history and the server all say the same thing (rule 34).
  // -------------------------------------------------------------------------
  // The card that stays = the most advanced status; a tie goes to the NEWEST card.
  const MERGE_STATUS_RANK = { became_client: 6, evaluation_complete: 5, evaluation_scheduled: 4, engaged_no_outcome: 3, office_contacted: 3, follow_up_call_needed: 3, new_inquiry: 2 };
  const leadDbStatus = row => {
    const value = String((row && (row.dbStatus || row.status)) || "");
    return LEAD_STATUS_TO_DB[value] || value;
  };
  const mergeRank = row => MERGE_STATUS_RANK[leadDbStatus(row)] || 1;
  function chooseMergeMain(rows) {
    const at = row => timestampValue((row && (row.createdAt || row.created_at)) || "");
    return [...list(rows)].filter(Boolean).sort((a, b) => mergeRank(b) - mergeRank(a) || at(b) - at(a) || String(b.id).localeCompare(String(a.id)))[0] || null;
  }
  function mergedRequestsOf(row) {
    const joined = rawOf(row).merged_requests;
    return Array.isArray(joined) ? joined.filter(item => item && typeof item === "object") : [];
  }
  const titleWords = text => String(text || "").split(/[\s-]+/).filter(Boolean).map(word => word[0].toUpperCase() + word.slice(1)).join(" ");
  const adCity = slug => titleWords(String(slug || "").toLowerCase().replace(/\.html?$/, "").replace(/^dog-training-/, "").replace(/-[a-z]{2}$/, ""));
  // Which page a request came in through, in plain words ("Contact Us page", "Cleveland ad page", "E-book download
  // (Cleveland ad page)", "Trainer page: Daniel Bainbridge", "Booking page").
  function requestPageName(row) {
    const raw = rawOf(row);
    const via = String((raw.booking && raw.booking.intake && raw.booking.intake.via) || (raw.pipeline && raw.pipeline.via) || "").toLowerCase();
    const page = String(raw.source_page || (row && (row.source_page || row.sourcePage)) || "").trim();
    let path = page;
    let host = "";
    try { const url = new URL(page); path = url.pathname; host = url.hostname.toLowerCase(); } catch (error) { /* not an address */ }
    path = path.replace(/^\/+|\/+$/g, "").toLowerCase();
    let place = "";
    if (/ads-v2/.test(host) || /^(?:ldtt-)?ads-v2\//.test(path)) place = `${adCity(path.replace(/^(?:ldtt-)?ads-v2\/?/, "")) || "2.0"} ad page 2.0`.replace(/^2\.0 ad page 2\.0$/, "Ad page 2.0");
    else if (/^ads\/[a-z0-9-]+/.test(path)) place = `${adCity(path.slice(4))} ad page 2.0`;
    else if (/^dog-training-[a-z0-9-]+/.test(path)) place = `${adCity(path)} ad page`;
    else {
      const titled = page.match(/^(.+?) Dog Training \| Lorenzo/i);
      if (titled) place = `${titled[1].trim()} ad page`;
    }
    if (String(raw.lead_type || "").toLowerCase() === "pdf_download") return `E-book download (${place || "website"})`;
    if (place) return place;
    if (/^book(\/|$)/.test(path) || via === "booking-callback") return "Booking page";
    if (/^trainer landing page:/i.test(page)) return `Trainer page: ${page.replace(/^trainer landing page:\s*/i, "").trim()}`;
    if (/\strainer page$/i.test(page)) return `Trainer page: ${page.replace(/\s+trainer page$/i, "").trim()}`;
    if (path === "contact.html" || path === "contact" || /^contact \|/i.test(page) || via === "contact-us") return "Contact Us page";
    if (/^get-started/.test(path)) return "Get Started page";
    return page ? `website (${page.slice(0, 60)})` : "website form";
  }
  const cleanWords = (value, max = 200) => String(value == null ? "" : value).replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
  // One request, in the fields the history shows. Works on a database row (the server's snapshot) and on a portal row.
  function requestEntryFromLead(row, { trainerName = "" } = {}) {
    const raw = rawOf(row);
    const booking = raw.booking && typeof raw.booking === "object" ? raw.booking : {};
    const db = leadDbStatus(row);
    const label = LEAD_STATUS_FROM_DB[db] || (row && row.status) || db;
    const trainer = cleanWords(trainerName || (row && row.assigned_trainer_name) || booking.trainer_name || "", 80);
    return {
      created_at: (row && (row.created_at || row.createdAt)) || "",
      first_name: cleanWords((row && row.first_name) || raw.first_name, 80),
      last_name: cleanWords((row && row.last_name) || raw.last_name, 80),
      email: cleanWords((row && row.email) || raw.email, 160),
      phone: cleanWords((row && row.phone) || raw.phone, 40),
      zip: cleanWords((row && row.zip) || raw.zip, 10),
      source_page: cleanWords(raw.source_page || (row && row.source_page), 300),
      page: requestPageName(row),
      heard_about_us: cleanWords(raw.heard_about_us || (row && (row.lead_source || row.rawSource)), 120),
      referral: cleanWords(raw.vet_or_previous_client || (row && row.referral_detail), 160),
      i_want_to: cleanWords(raw.i_want_to || (row && row.service_interest), 200),
      comments: cleanWords((row && row.comments) || raw.comments, 600),
      dog_name: cleanWords((row && row.dog_name) || raw.dog_name, 80),
      dog_breed: cleanWords((row && row.dog_breed) || raw.dog_breed, 80),
      status: db,
      status_label: statusLabel(label),
      trainer_name: trainer,
      utm_source: cleanWords(raw.utm_source, 80),
      utm_campaign: cleanWords(raw.utm_campaign, 120),
      lead_type: cleanWords(raw.lead_type, 40),
      booking: booking.slot_start
        ? { when: cleanWords(booking.when_label || booking.slot_start, 120), trainer: cleanWords(booking.trainer_name || trainer, 80), via: cleanWords(booking.via, 40) }
        : booking.requested === true ? { requested: true, trainer: cleanWords(booking.trainer_name || trainer, 80) } : null
    };
  }
  // The request in one plain paragraph (the date is written by the screen, in the viewer's time zone).
  function requestSummary(entry, { current = false } = {}) {
    const e = entry || {};
    const bare = value => cleanWords(value).replace(/[.!?\s]+$/, "");
    const parts = [`came in through the ${bare(e.page) || "website form"}`];
    if (bare(e.heard_about_us)) parts.push(`Heard about us: ${bare(e.heard_about_us)}${bare(e.referral) ? ` (${cleanWords(e.referral)})` : ""}`);
    else if (bare(e.referral)) parts.push(`Referred by: ${bare(e.referral)}`);
    if (bare(e.i_want_to)) parts.push(`Asked for: ${bare(e.i_want_to)}`);
    const dog = [bare(e.dog_name), bare(e.dog_breed)].filter(Boolean).join(", ");
    if (dog) parts.push(`Dog: ${dog}`);
    if (e.booking && e.booking.when) parts.push(`Booked an evaluation${bare(e.booking.trainer) ? ` with ${bare(e.booking.trainer)}` : ""} for ${bare(e.booking.when)}`);
    else if (e.booking && e.booking.requested) parts.push(`Asked for ${bare(e.booking.trainer) || "a trainer"} online (the office schedules)`);
    if (bare(e.comments)) parts.push(`Their note: "${bare(e.comments).slice(0, 240)}"`);
    const messages = list(e.messages).map(bare).filter(Boolean);
    if (messages.length) parts.push(`We sent: ${messages.join(", ")}`);
    const who = bare(e.trainer_name) && !(e.booking && e.booking.trainer) ? ` (trainer: ${bare(e.trainer_name)})` : "";
    if (bare(e.status_label)) parts.push(`${current ? "Status now" : "Status then"}: ${bare(e.status_label)}${who}`);
    return `${parts.join(". ")}.`;
  }

  // -------------------------------------------------------------------------
  // Lead history + pipeline "Kind" filter (Joshua 2026-09-29): "when they were first received, what date they were
  // recycled, through what method, what changed, where they booked - did they follow the link through the text or the
  // email", and a filter that shows every lead of a kind with the numbers to match. Display only; no count changes.
  // -------------------------------------------------------------------------
  // Link tags: lib/booking.js taggedLink (utm_source text|email + utm_campaign = the message). A booking stamps
  // raw_payload.booking.link_from; a lead that CAME IN from a tagged link (an ad page, /book) carries utm_source.
  const LINK_MESSAGE_WORDS = {
    new_lead: "first booking-link", followup_first: "15-minute follow-up", followup_link: "30-minute follow-up",
    unfinished: "30-minute \"finish your request\" follow-up", care_call: "next-day follow-up", reengage: "re-engage invite", campaign: "email campaign"
  };
  const LINK_TRACKING_START = "2026-09-29T08:00:00Z"; // bookings before this could not say which link was used
  function linkFromOf(row) {
    const raw = rawOf(row);
    const booking = raw.booking && typeof raw.booking === "object" ? raw.booking : {};
    const stamped = booking.link_from || (booking.callback && booking.callback.link_from);
    if (stamped && (stamped.channel === "text" || stamped.channel === "email")) return { channel: stamped.channel, message: String(stamped.message || ""), at: stamped.at || "", on: "booking" };
    const utm = String(raw.utm_source || (row && (row.utm_source || row.utmSource)) || "").toLowerCase();
    if (utm === "text" || utm === "email") return { channel: utm, message: String(raw.utm_campaign || (row && row.utm_campaign) || "").toLowerCase(), at: "", on: "lead" };
    return null;
  }
  function linkFromWords(link) {
    if (!link) return "";
    const what = LINK_MESSAGE_WORDS[link.message] || "";
    return `the link in ${what ? `the ${what} ` : "our "}${link.channel === "text" ? "text" : "email"}`;
  }
  // What changed from one request to the next (both from requestEntryFromLead / a merged snapshot).
  const CHANGE_FIELDS = [["page", "Came in through"], ["heard_about_us", "How they heard about us"], ["referral", "Referred by"], ["phone", "Phone"], ["email", "Email"], ["zip", "ZIP"], ["i_want_to", "Asked for"], ["dog_name", "Dog"], ["trainer_name", "Trainer"]];
  function requestChanges(before, after) {
    const a = before || {}; const b = after || {};
    const norm = value => cleanWords(value).toLowerCase().replace(/[.!?\s]+$/, "");
    const same = (key, x, y) => key === "phone" ? String(x || "").replace(/\D/g, "").slice(-10) === String(y || "").replace(/\D/g, "").slice(-10) : norm(x) === norm(y);
    const out = [];
    for (const [key, label] of CHANGE_FIELDS) {
      const x = cleanWords(a[key], 120); const y = cleanWords(b[key], 120);
      if (!y || same(key, x, y)) continue;
      out.push(x ? `${label}: ${x} → ${y}` : `${label}: ${y} (new)`);
    }
    return out;
  }
  // The "Kind" filter on the Leads pipeline. `ctx` carries what only the screen knows (recycled, office's turn).
  const LEAD_KIND_FILTERS = [
    ["recycled", "Recycled (came back)"],
    ["booked_online", "Booked online"],
    ["booked_from_text", "Booked from a text link"],
    ["booked_from_email", "Booked from an email link"],
    ["from_text", "Came from a text link"],
    ["from_email", "Came from an email link"],
    ["asked_trainer", "Asked for a trainer (office schedules)"],
    ["asked_call", "Asked for a call (no trainer nearby)"],
    ["needs_call", "Needs a call"],
    ["office_turn", "Office's turn"],
    ["unfinished", "Did not finish the booking form"],
    ["ebook", "E-book downloads"],
    // Zoom 2026-09-29 lead score (leadScore below).
    ["hot", "Hot leads"],
    ["warm", "Warm leads"],
    ["cold", "Cold leads"],
    ["top_paying", "Top-paying potential"]
  ];

  // -------------------------------------------------------------------------
  // Lead score (Zoom 2026-09-29). Lorenzo: "If the dog has bitten someone and the authorities are involved, that's
  // major. If there's a baby on the way ... if the person's elderly ... someone just purchased the dog, paid a lot of
  // money for it ... client referrals and vet referrals tend to be really strong for us." Angela: "it's a scoring
  // thing ... if they complete the evaluation questions, that's a plus two." Points come ONLY from what the lead
  // itself says or did (the form, the booking, the pre-evaluation answers). Hot = 6+, Warm = 3-5, Cold = under 3 (Joshua 2026-09-30: "Cold", not "Nurture").
  // "Top-paying potential" = any of Lorenzo's high-value signs. Display only: no count, status or text changes.
  // -------------------------------------------------------------------------
  const SCORE_HOT = 6;
  const SCORE_WARM = 3;
  const TOP_PAYING = new Set(["bite_authorities", "baby", "elderly", "expensive", "referral"]);
  function leadScore(lead) {
    if (!lead) return { score: 0, tier: "cold", topPaying: false, safety: false, reasons: [] };
    const raw = rawOf(lead);
    const booking = raw.booking && typeof raw.booking === "object" ? raw.booking : {};
    const pre = booking.pre_eval && typeof booking.pre_eval === "object" ? booking.pre_eval : {};
    const answers = pre.answers && typeof pre.answers === "object" ? pre.answers : {};
    const dogs = Array.isArray(booking.dogs) ? booking.dogs : [];
    const text = [raw.problem, raw.comments, lead.comments, raw.additional_interest, raw.service_interest,
      ...dogs.map(d => d && d.behavior), ...Object.values(answers).map(v => (Array.isArray(v) ? v.join(" ") : typeof v === "object" ? "" : v))]
      .filter(v => typeof v === "string" && v).join(" \n ").toLowerCase();
    const source = [lead.leadSource, lead.lead_source, raw.lead_source, raw.heard_about_us, raw.vet_or_previous_client, lead.source]
      .filter(v => typeof v === "string").join(" ").toLowerCase();
    const reasons = [];
    const add = (key, points, words) => reasons.push({ key, points, words });
    const bite = /\b(bit|bite|bites|biting|bitten|nipp|attack)/.test(text) || (answers.bite_history && answers.bite_history !== "No");
    const authorities = /(police|animal control|authorit|court|quarantine|lawsuit|sued|citation|dangerous dog|reported)/.test(text);
    if (bite && authorities) add("bite_authorities", 5, "Bite with the authorities involved");
    else if (bite || /(aggress|lung|growl|snap|reactiv)/.test(text) || answers.injured_animal === "Yes") add("aggression", 3, "Bite or aggression");
    if (/(baby|pregnan|expecting|newborn|infant|due date)/.test(text)) add("baby", 3, "Baby on the way or a new baby");
    if (/(vet|veterinar)/.test(source) || /(referred by a past client|client referral|friend referred|referral)/.test(source)) add("referral", 3, "Vet or client referral");
    else if (/(is a past client|past client|former client|returning)/.test(source)) add("past_client", 2, "Past client");
    if (/(elderly|senior citizen|my (elderly|older|aging)|grandm|grandpa|grandparent|knock(s|ed)? (me|her|him|them) (down|over)|\b[7-9]\d[ -]?(years?|yrs?)[ -]old\b)/.test(text)) add("elderly", 2, "Elderly owner");
    if (/(\$\s?\d{1,3}(,\d{3})+|\$\s?\d{4,}|\b\d{2,3}k\b|expensive|paid (a lot|thousands)|imported|protection dog|european (line|import))/.test(text)) add("expensive", 2, "Paid a lot for the dog");
    if (booking.slot_start) add("booked", 3, "Booked a time");
    if (pre.first_submitted_at || pre.submitted_at) add("pre_eval", 2, "Answered the pre-evaluation questions");
    if (Number(answers.disruption) >= 4 || answers.how_often === "Multiple times a day") add("impact", 1, "Big impact at home");
    if (mergedRequestsOf(lead).length || lead.recycled_count >= 2 || lead.recycledCount >= 2) add("returned", 1, "Came back again");
    if (!booking.slot_start && (dogs.length || booking.intake)) add("started", 1, "Started the booking form");
    const score = reasons.reduce((sum, r) => sum + r.points, 0);
    const tier = score >= SCORE_HOT ? "hot" : score >= SCORE_WARM ? "warm" : "cold";
    return { score, tier, topPaying: reasons.some(r => TOP_PAYING.has(r.key)), safety: reasons.some(r => r.key === "bite_authorities" || r.key === "aggression"), reasons };
  }
  function leadKinds(lead, ctx = {}) {
    const raw = rawOf(lead);
    const booking = raw.booking && typeof raw.booking === "object" ? raw.booking : {};
    const link = linkFromOf(lead);
    const booked = Boolean(booking.slot_start);
    const kinds = new Set();
    if (ctx.recycled) kinds.add("recycled");
    if (booked) kinds.add("booked_online");
    if (booked && link && link.on === "booking" && link.channel === "text") kinds.add("booked_from_text");
    if (booked && link && link.on === "booking" && link.channel === "email") kinds.add("booked_from_email");
    if (link && link.channel === "text") kinds.add("from_text");
    if (link && link.channel === "email") kinds.add("from_email");
    if (booking.requested === true && !booked) kinds.add("asked_trainer");
    if (booking.callback) kinds.add("asked_call");
    if (raw.needs_office_call === true) kinds.add("needs_call");
    if (ctx.officeTurn) kinds.add("office_turn");
    const pipeline = raw.pipeline && typeof raw.pipeline === "object" ? raw.pipeline : null;
    const dogs = Array.isArray(booking.dogs) ? booking.dogs : [];
    const answered = dogs.some(dog => dog && (dog.name || dog.breed || dog.behavior));
    if (pipeline && pipeline.entered_at && !booked && !booking.requested && !booking.callback && !answered && String(raw.lead_type || "").toLowerCase() !== "pdf_download") kinds.add("unfinished");
    if (String(raw.lead_type || "").toLowerCase() === "pdf_download") kinds.add("ebook");
    const score = leadScore(lead);
    kinds.add(score.tier);
    if (score.topPaying) kinds.add("top_paying");
    return kinds;
  }

  // -------------------------------------------------------------------------
  // "Office's turn" (Zoom 2026-09-24, Lorenzo: "after the 24 hours ... the office needs to be notified that the time is
  // up. So this has been bot touched three times and now it's time for the office."). A PIPELINE lead (it has
  // raw_payload.pipeline.entered_at) that has not booked, not asked for a callback and is still New Inquiry / Office
  // Contacted / Engaged Lead: No Outcome becomes the office's turn when its automatic follow-up chain has finished (the
  // last step, "care", is recorded) OR 24 hours after it entered the pipeline (which is also when the chain would end,
  // and the only clock while automatic follow-ups are switched off). Display only; no count moves. nowMs is passed in.
  // -------------------------------------------------------------------------
  const OFFICE_TURN_DB_STATUSES = ["new_inquiry", "office_contacted", "follow_up_call_needed", "engaged_no_outcome"];
  const OFFICE_TURN_AFTER_MS = 24 * 60 * 60 * 1000;
  function officeTurn(lead, nowMs) {
    if (!lead || isQaLead(lead)) return null;
    const db = (lead.dbStatus || LEAD_STATUS_TO_DB[lead.status] || lead.status || "").toString();
    if (!OFFICE_TURN_DB_STATUSES.includes(db)) return null;
    const raw = rawOf(lead);
    const pipeline = raw.pipeline && typeof raw.pipeline === "object" ? raw.pipeline : null;
    const entered = pipeline ? timestampValue(pipeline.entered_at) : 0;
    if (!entered) return null;
    const booking = raw.booking && typeof raw.booking === "object" ? raw.booking : {};
    if (booking.slot_start || booking.requested_at || booking.callback) return null;
    const care = (Array.isArray(pipeline.followups) ? pipeline.followups : []).find(step => step && step.step === "care" && step.status && step.status !== "sending");
    if (care) return { since: care.at || new Date(entered + OFFICE_TURN_AFTER_MS).toISOString(), why: "chain_done" };
    const now = Number(nowMs);
    if (Number.isFinite(now) && now - entered >= OFFICE_TURN_AFTER_MS) return { since: new Date(entered + OFFICE_TURN_AFTER_MS).toISOString(), why: "24h" };
    return null;
  }
  const officeTurnRows = (rows, nowMs) => list(rows).filter(lead => officeTurn(lead, nowMs));

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
    LEAD_STATUS_TO_DB, LEAD_STATUS_FROM_DB, APPLICATION_STATUS_FROM_DB, HARD_NO_LOST_REASONS, HARD_NO_LOST_STATUSES, SOFT_LOST_STATUSES, ARCHIVE_REASONS, BOARD_COLUMNS, LEAD_STATUS_COUNT_ORDER, APPLICATION_COLUMNS,
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
    TRACK500_CLIENT_GOAL, TRACK500_REVENUE_GOAL, TRAINER_PIPELINE_STAGES, TRAINER_HIDDEN_DB_STATUSES, trainerDbStatus, trainerStageFor,
    trainerPipeline, trainerBoardRows, trainerLeadBoard,
    STATUS_DISPLAY_LABELS, statusLabel, personMatchKeys, recycledIndex, personRows, MERGE_STATUS_RANK, chooseMergeMain, mergedRequestsOf,
    requestPageName, requestEntryFromLead, requestSummary, LINK_MESSAGE_WORDS, LINK_TRACKING_START, linkFromOf, linkFromWords, requestChanges, LEAD_KIND_FILTERS, leadKinds, leadScore, SCORE_HOT, SCORE_WARM,
    OFFICE_TURN_DB_STATUSES, OFFICE_TURN_AFTER_MS, officeTurn, officeTurnRows,
    escapeCsv, csvDocument, csvRowCount
  };
});
