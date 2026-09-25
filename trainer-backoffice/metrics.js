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

  // The trainer's working board: a TASK board, not the office board (Zoom 2026-09-24, Lorenzo overruling the
  // earlier "mirror the office" change: "it should not mirror exactly like the admin. Admin is looking for holes
  // and gaps and efficiency leaks. The trainers is looking for did I do this, this and this ... Not a lot of
  // clutter."). It is the trainer board from before 2026-09-24 plus exactly ONE column, "Contacted":
  //   New Inquiry | Contacted | Eval Scheduled | Eval Completed | Sold | Lost
  // Bucketed by the DATABASE status. "Contacted" = the office or the trainer already reached them
  // (office_contacted, its old twin follow_up_call_needed, engaged_no_outcome), so Chloe Williams
  // (engaged_no_outcome since 9/10) is NOT under New Inquiry any more (Rachel's complaint) and Engaged Lead: No
  // Outcome gets no column of its own ("we know it's no outcome if there's no sale"). Lost holds every lost_*
  // status, Bad Lead, a cancelled evaluation and the two canceled_* statuses, as the old board did.
  // Do Not Contact and Archived are never drawn (rule 80: never hand a trainer someone on that list); any status
  // not listed here is not drawn either. The OFFICE Leads board (BOARD_COLUMNS / boardStatus) is untouched.
  const TRAINER_PIPELINE_STAGES = [
    ["inquiry",   "New Inquiry",    ["new_inquiry"]],
    ["contacted", "Contacted",      ["office_contacted", "follow_up_call_needed", "engaged_no_outcome"]],
    ["scheduled", "Eval Scheduled", ["evaluation_scheduled"]],
    ["completed", "Eval Completed", ["evaluation_complete"]],
    ["sold",      "Sold",           ["became_client"]],
    ["lost",      "Lost",           ["lost_no_response", "lost_price_concern", "lost_not_ready", "lost_chose_another_provider",
                                     "lost_client_complaint", "lost_no_trainer_area", "bad_lead", "evaluation_cancelled",
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
    // Every tile is one column of the trainer's own board (2026-09-24, six-column task board), so tile == column:
    //   newInquiries = "New Inquiry" (new_inquiry only)      contacted     = "Contacted"
    //   evalScheduled = "Eval Scheduled"                     evalCompleted = "Eval Completed"
    //   won           = "Sold" (became_client)               lost          = "Lost" (lost_*, bad lead, cancelled)
    // assigned = every lead assigned to the trainer (hidden ones included), as before.
    const board = trainerPipeline(leads);
    return {
      newInquiries: board.get("inquiry").length,
      contacted: board.get("contacted").length,
      assigned: count(leads),
      evalScheduled: board.get("scheduled").length,
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
    const at = row => timestampValue((row && (row.createdAt || row.created_at)) || "");
    const older = (a, b) => at(a) < at(b) || (at(a) === at(b) && String(a.id) < String(b.id));
    const earliest = new Map(); // root -> row
    const size = new Map();
    items.forEach((row, i) => {
      if (!personMatchKeys(row).length) return;
      const root = find(i);
      size.set(root, (size.get(root) || 0) + 1);
      const best = earliest.get(root);
      if (!best || older(row, best)) earliest.set(root, row);
    });
    const out = new Map();
    items.forEach((row, i) => {
      if (!personMatchKeys(row).length) return;
      const root = find(i);
      const first = earliest.get(root);
      if (first && first !== row && first.id !== row.id) out.set(row.id, { firstAt: first.createdAt || first.created_at || "", firstLeadId: first.id, count: size.get(root) || 2 });
    });
    return out;
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
    STATUS_DISPLAY_LABELS, statusLabel, personMatchKeys, recycledIndex, OFFICE_TURN_DB_STATUSES, OFFICE_TURN_AFTER_MS, officeTurn, officeTurnRows,
    escapeCsv, csvDocument, csvRowCount
  };
});
