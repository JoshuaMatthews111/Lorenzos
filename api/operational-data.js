const SUPABASE_URL = process.env.SUPABASE_URL || "https://ptnzaeprvkgjgtupmcty.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";
const crypto = require("node:crypto");
const { isSandbox, supabaseRequest } = require("../lib/sandbox");
const { authorizeRequest } = require("../lib/portal-auth");

function cors(response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, If-None-Match");
  return response;
}

async function supabaseFetch(path, options = {}) {
  // Practice copy: schema profile headers / practice-* bucket (lib/sandbox.js).
  const target = supabaseRequest(path, options.headers || {});
  const response = await fetch(`${SUPABASE_URL}${target.path}`, {
    ...options,
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      ...target.headers
    }
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!response.ok) {
    const message = data?.msg || data?.message || data?.error_description || data?.error || text || `Supabase request failed (${response.status})`;
    throw new Error(message);
  }
  return data;
}

async function optionalSupabaseFetch(path, capability, unavailable) {
  try {
    return await supabaseFetch(path);
  } catch (error) {
    if (!/relation .* does not exist|could not find the table|schema cache|42p01/i.test(String(error?.message || error || ""))) throw error;
    unavailable.push(capability);
    return [];
  }
}

// Columns the portal actually renders. raw_payload is the bulky part of a client
// row and is not needed for any screen, so it stays on the server.
const CLIENT_COLUMNS = [
  "id", "lead_id", "trainer_id", "client_name", "phone", "email", "service_area", "zip",
  "lead_source", "status", "sms_consent", "email_consent", "imported_source",
  "date_started", "last_contacted", "notes", "created_at", "updated_at", "archived_at", "version"
].join(",");
const CLIENT_PAGE_LIMIT = 500;

// site_events and lifecycle_events are ~13,500 rows each and every row carries a
// raw_payload with user agents, full URLs and form echoes the portal never shows.
// The dashboard reads only these keys (see siteEventRows / reportLifecycleRows),
// so everything else stays on the server. referrer and user_agent are never read.
const SITE_EVENT_BASE_COLUMNS = [
  "id", "trainer_id", "event_type", "page_path", "created_at", "trainer_slug", "assigned_trainer_name",
  "visitor_id", "session_id", "utm_source", "utm_medium", "utm_campaign",
  "trainer_market", "trainer_city", "trainer_state"
];
const SITE_EVENT_COLUMNS = [...SITE_EVENT_BASE_COLUMNS, "raw_payload"].join(",");
const SITE_EVENT_PAYLOAD_KEYS = ["qa", "page_url", "time_on_page_seconds", "landing_page_type", "ad_market", "timestamp"];
// perf/portal-speed: reportLifecycleRows / getMetrics read only these columns.
// market, source_page, visitor_id, session_id, utm_* and actor_user_id were
// shipped on every poll and never read.
const LIFECYCLE_BASE_COLUMNS = ["id", "event_key", "entity_type", "entity_id", "event_type", "occurred_at", "created_at"];
const LIFECYCLE_PAYLOAD_KEYS = ["qa", "page_url"];

function slimPayload(row, keys) {
  const raw = row && row.raw_payload && typeof row.raw_payload === "object" ? row.raw_payload : {};
  const kept = {};
  for (const key of keys) if (raw[key] !== undefined) kept[key] = raw[key];
  return { ...row, raw_payload: kept };
}
const slimSiteEvents = rows => (Array.isArray(rows) ? rows.map(row => slimPayload(row, SITE_EVENT_PAYLOAD_KEYS)) : rows);
const slimLifecycleEvents = rows => (Array.isArray(rows) ? rows.map(row => slimPayload(row, LIFECYCLE_PAYLOAD_KEYS)) : rows);

// perf/portal-speed: the six kept raw_payload keys used to arrive inside the full
// raw_payload (user agent, referrer, echoed form...) and be trimmed here — about
// 20 MB pulled from Supabase for site_events and 20 MB for lifecycle_events on
// EVERY poll, to keep 4 MB of it. PostgREST can pull just those keys out of the
// JSON column (`key:raw_payload->key`), so the trim now happens in the database
// and the rows arrive already in the shape the portal reads. If PostgREST ever
// refuses the JSON-path select, the caller falls back to the full column.
const PAYLOAD_KEY_PREFIX = "rp_";
function jsonPathSelect(baseColumns, payloadKeys) {
  return [...baseColumns, ...payloadKeys.map(key => `${PAYLOAD_KEY_PREFIX}${key}:raw_payload->${key}`)].join(",");
}
function rebuildPayload(rows, payloadKeys) {
  if (!Array.isArray(rows)) return rows;
  return rows.map(row => {
    const kept = {};
    const out = {};
    for (const [column, value] of Object.entries(row)) {
      if (column.startsWith(PAYLOAD_KEY_PREFIX)) {
        if (value !== null && value !== undefined) kept[column.slice(PAYLOAD_KEY_PREFIX.length)] = value;
      } else {
        out[column] = value;
      }
    }
    out.raw_payload = kept;
    return out;
  });
}
const SITE_EVENT_SELECT = jsonPathSelect(SITE_EVENT_BASE_COLUMNS, SITE_EVENT_PAYLOAD_KEYS);
const LIFECYCLE_SELECT = jsonPathSelect(LIFECYCLE_BASE_COLUMNS, LIFECYCLE_PAYLOAD_KEYS);

// perf/portal-speed: the Recent Activity table reads actor, action, summary and
// entity columns. before_data / after_data are full record snapshots (about 5 MB
// of the 5.3 MB table) and no screen shows them.
const AUDIT_COLUMNS = [
  "id", "actor_user_id", "actor_email", "actor_name", "action", "entity_type", "entity_id", "summary", "created_at"
].join(",");

// Exact row count without transferring the rows themselves.
async function countRows(table) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=id&limit=1`, {
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      Prefer: "count=exact",
      Range: "0-0"
    }
  });
  const range = response.headers.get("content-range") || "";
  const total = Number(String(range).split("/")[1]);
  return Number.isFinite(total) ? total : 0;
}

// Pages used to be fetched one after another: a 12,000-row table meant thirteen
// round trips in series before the portal could paint. Now the first page also
// returns the exact row count, and every remaining page is requested together.
const PAGE_CONCURRENCY = 6;

async function supabaseFetchPage(path, separator, pageSize, offset, withCount) {
  const target = supabaseRequest(`${path}${separator}limit=${pageSize}&offset=${offset}`, withCount ? { Prefer: "count=exact" } : {});
  const response = await fetch(`${SUPABASE_URL}${target.path}`, {
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      ...target.headers
    }
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) {
    const message = data?.message || data?.error || `Supabase request failed (${response.status})`;
    throw Object.assign(new Error(message), { status: response.status, detail: data });
  }
  const range = response.headers.get("content-range") || "";
  const total = Number(String(range).split("/")[1]);
  return { data, total: Number.isFinite(total) ? total : null };
}

async function supabaseFetchAll(path, pageSize = 1000, maxRows = 100000) {
  const separator = path.includes("?") ? "&" : "?";
  const first = await supabaseFetchPage(path, separator, pageSize, 0, true);
  if (!Array.isArray(first.data)) return first.data;
  const rows = [...first.data];
  if (first.data.length < pageSize) return rows;
  const total = Math.min(first.total ?? maxRows, maxRows);
  const offsets = [];
  for (let offset = pageSize; offset < total; offset += pageSize) offsets.push(offset);
  for (let i = 0; i < offsets.length; i += PAGE_CONCURRENCY) {
    const batch = offsets.slice(i, i + PAGE_CONCURRENCY);
    const pages = await Promise.all(batch.map(offset => supabaseFetchPage(path, separator, pageSize, offset, false)));
    for (const page of pages) if (Array.isArray(page.data)) rows.push(...page.data);
  }
  return rows;
}

async function fetchAuthUsersById(userIds = []) {
  const needed = new Set(userIds.map(value => String(value || "")).filter(Boolean));
  if (!needed.size) return new Map();
  const byId = new Map();
  try {
    for (let page = 1; page <= 20; page += 1) {
      const result = await supabaseFetch(`/auth/v1/admin/users?page=${page}&per_page=100`);
      const users = Array.isArray(result?.users) ? result.users : [];
      users.forEach(user => {
        if (!needed.has(String(user.id || ""))) return;
        byId.set(String(user.id), {
          id: user.id,
          email: user.email || "",
          created_at: user.created_at || "",
          updated_at: user.updated_at || "",
          confirmed_at: user.confirmed_at || "",
          email_confirmed_at: user.email_confirmed_at || "",
          phone_confirmed_at: user.phone_confirmed_at || "",
          last_sign_in_at: user.last_sign_in_at || ""
        });
      });
      if (byId.size >= needed.size || users.length < 100) break;
    }
  } catch (error) {
    console.warn("Portal auth status could not be enriched", error);
  }
  return byId;
}

async function enrichPortalUsersWithAuth(portalUsers = []) {
  const authById = await fetchAuthUsersById(portalUsers.map(user => user.user_id));
  return portalUsers.map(user => {
    const authUser = authById.get(String(user.user_id || ""));
    if (!authUser) return user;
    const confirmedAt = authUser.confirmed_at || authUser.email_confirmed_at || authUser.phone_confirmed_at || "";
    return {
      ...user,
      email: user.email || authUser.email || "",
      auth_email: authUser.email || "",
      auth_created_at: authUser.created_at || "",
      auth_updated_at: authUser.updated_at || "",
      auth_confirmed_at: confirmedAt,
      auth_last_sign_in_at: authUser.last_sign_in_at || "",
      auth_has_logged_in: Boolean(authUser.last_sign_in_at)
    };
  });
}

async function optionalSupabaseFetchAll(path, capability, unavailable) {
  try {
    return await supabaseFetchAll(path);
  } catch (error) {
    if (!/relation .* does not exist|could not find the table|schema cache|42p01/i.test(String(error?.message || error || ""))) throw error;
    unavailable.push(capability);
    return [];
  }
}

function isMissingColumnError(error) {
  return /column .* does not exist|could not find the .* column|schema cache|42703/i.test(String(error?.message || error || ""));
}

function inFilter(values = []) {
  const unique = [...new Set(values.filter(Boolean).map(value => String(value)))];
  if (!unique.length) return "";
  return `in.(${unique.map(encodeURIComponent).join(",")})`;
}

async function fetchByIn(pathPrefix, column, values, capability, unavailable) {
  const filter = inFilter(values);
  if (!filter) return [];
  return optionalSupabaseFetchAll(`${pathPrefix}${pathPrefix.includes("?") ? "&" : "?"}${encodeURIComponent(column)}=${filter}`, capability, unavailable);
}

// perf/portal-speed: site_events and lifecycle_events are append-only (rows are
// inserted, never edited or deleted; a correction is a new row). So a warm
// function instance keeps the last copy it built and, on the next poll, asks
// the database for one row — the newest id plus the exact count. If both match,
// the copy is reused without moving 30 MB again. If only new rows were added,
// just those rows are fetched and put in front. Anything else (a count that
// does not add up, a deleted row, a fresh instance) falls back to the full
// fetch, so the result is always what a full fetch would have returned.
const appendOnlyCache = new Map();

function sortRowsDesc(rows, column) {
  return rows.sort((a, b) => String(b[column] || "").localeCompare(String(a[column] || "")));
}

async function fetchAppendOnlyTable({ key, path, fallbackPath, orderColumn, shape }) {
  const separator = path.includes("?") ? "&" : "?";
  const fetchFull = async () => {
    let rows;
    try {
      rows = shape(await supabaseFetchAll(`${path}${separator}order=${orderColumn}.desc`));
    } catch (error) {
      if (!fallbackPath || isMissingColumnError(error) || /relation .* does not exist|could not find the table|42p01/i.test(String(error?.message || error || ""))) throw error;
      console.warn(`perf/portal-speed: JSON-path select refused for ${key}, using the full column`, error?.message || error);
      rows = fallbackPath.shape(await supabaseFetchAll(`${fallbackPath.path}${separator}order=${orderColumn}.desc`));
    }
    sortRowsDesc(rows, orderColumn);
    return rows;
  };
  const remember = rows => {
    appendOnlyCache.set(key, { rows, total: rows.length, newestId: rows[0] ? String(rows[0].id) : "", newestAt: rows[0] ? String(rows[0][orderColumn] || "") : "" });
    return rows;
  };
  const cached = appendOnlyCache.get(key);
  if (!cached) return remember(await fetchFull());
  let probe;
  try {
    probe = await supabaseFetchPage(`${path}${separator}order=${orderColumn}.desc`, "&", 1, 0, true);
  } catch {
    return remember(await fetchFull());
  }
  const total = probe.total;
  const newest = Array.isArray(probe.data) ? probe.data[0] : null;
  if (!Number.isFinite(total) || (total > 0 && !newest)) return remember(await fetchFull());
  if (total === cached.total && (total === 0 || String(newest.id) === cached.newestId)) return cached.rows;
  if (total > cached.total && cached.newestAt) {
    try {
      const fresh = shape(await supabaseFetchAll(`${path}${separator}${orderColumn}=gte.${encodeURIComponent(cached.newestAt)}&order=${orderColumn}.desc`));
      const known = new Set(cached.rows.map(row => String(row.id)));
      const added = fresh.filter(row => !known.has(String(row.id)));
      if (cached.total + added.length === total) {
        return remember(sortRowsDesc([...added, ...cached.rows], orderColumn));
      }
    } catch (error) {
      console.warn(`perf/portal-speed: incremental fetch for ${key} failed, refetching`, error?.message || error);
    }
  }
  return remember(await fetchFull());
}

// perf/portal-speed: the clients sheet holds 7,285 rows (3.9 MB) but only the
// 500 clients the portal shows are ever merged with it, so ask for just those.
const IN_FILTER_BATCH = 100;
async function fetchByInBatched(pathPrefix, column, values, capability, unavailable) {
  const unique = [...new Set((values || []).filter(Boolean).map(value => String(value)))];
  if (!unique.length) return [];
  const batches = [];
  for (let i = 0; i < unique.length; i += IN_FILTER_BATCH) batches.push(unique.slice(i, i + IN_FILTER_BATCH));
  const pages = await Promise.all(batches.map(batch => fetchByIn(pathPrefix, column, batch, capability, unavailable)));
  return pages.flat();
}

// perf/portal-login-first-paint: `omit` names whole blocks of the response the
// caller does not need yet. Nothing on the dashboard reads them, so skipping the
// queries is what makes signing in fast.
//   sheets  - office_leads_sheet / office_applications_sheet / office_clients_sheet
//             AND the second copy of every lead, application and client that gets
//             merged into them. Only the Download button ever reads it.
//   history - audit_events, office_note_revisions, form_delivery_attempts. Read
//             only inside an open record and on the Communications screen.
//   events  - the 15,000-row site_events table. Read only by the Reports,
//             Communications and Ad Landing Pages screens, never the dashboard.
//             The dashboard's "visits" figure comes from visitStamps below.
const OMITTABLE = new Set(["sheets", "history", "events"]);

// The dashboard's "Site Visits/Clicks" tile is a COUNT of site_visit and
// cta_click lifecycle rows inside the report window. Those rows are one per page
// view - 15,000 of them, 6.6 MB - for a single number. Send the timestamps as a
// list of integers instead (~120 KB) and let the browser count inside its window
// exactly as before. The QA hold-out below is the browser's rule, character for
// character (reportLifecycleRows): boolean true only, so the count cannot shift.
const VISIT_TYPES = ["site_visit", "cta_click"];
function isHeldOutLifecycleRow(row) {
  const raw = row?.raw_payload || {};
  return row?.event_type === "qa_release_check"
    || raw.qa === true
    || /^qa[_-]/i.test(String(row?.event_key || ""))
    || /(?:localhost|127\.0\.0\.1|\.vercel\.app)(?::\d+)?(?:\/|$)/i.test(String(raw.page_url || ""));
}
function splitLifecycle(rows) {
  const stamps = { site_visit: [], cta_click: [] };
  const kept = [];
  for (const row of rows || []) {
    if (row?.entity_type === "site_event" && VISIT_TYPES.includes(row.event_type)) {
      if (isHeldOutLifecycleRow(row)) continue;
      const t = Date.parse(row.occurred_at || row.created_at || "");
      if (Number.isFinite(t)) stamps[row.event_type].push(Math.floor(t / 1000));
    } else {
      kept.push(row);
    }
  }
  return { rows: kept, stamps };
}


function parseOmit(value) {
  return new Set(String(value || "").split(",").map(part => part.trim().toLowerCase()).filter(part => OMITTABLE.has(part)));
}

async function loadAdminOperationalData(unavailableCapabilities, omit = new Set()) {
  const [
    trainers,
    pages,
    leads,
    leadEvents,
    clients,
    dogs,
    applications,
    submissions,
    events,
    portalUsers,
    officeNotes,
    auditEvents,
    noteRevisions,
    deliveryAttempts,
    reviewPublications,
    lifecycleEvents,
    leadsSheet,
    applicationsSheet,
    clientsSheet,
    deals,
    dealPayments
  ] = await Promise.all([
    supabaseFetchAll("/rest/v1/trainers?select=*&order=full_name.asc"),
    supabaseFetchAll("/rest/v1/trainer_pages?select=*&order=updated_at.desc"),
    supabaseFetchAll("/rest/v1/leads?select=*&order=created_at.desc"),
    // perf/portal-speed: lead_events (0.5 MB) was shipped on every poll and the
    // portal never reads `leadEvents`; the key stays in the response, empty.
    Promise.resolve([]),
    // The client database is now many thousands of rows. Sending all of them to the
    // browser pushed this response past the platform's size limit, which made the
    // whole portal fall back to offline mode — notes stopped saving and dragged
    // cards stopped sticking. The office works with the most recent records and
    // searches the server for anyone older.
    supabaseFetchAll(`/rest/v1/clients?select=${CLIENT_COLUMNS}&order=created_at.desc`, CLIENT_PAGE_LIMIT, CLIENT_PAGE_LIMIT),
    supabaseFetchAll("/rest/v1/dogs?select=*&order=created_at.desc"),
    supabaseFetchAll("/rest/v1/trainer_applications?select=*&order=created_at.desc"),
    supabaseFetchAll("/rest/v1/content_submissions?select=*&order=created_at.desc"),
    omit.has("events") ? Promise.resolve([]) : fetchAppendOnlyTable({
      key: "site_events",
      path: `/rest/v1/site_events?select=${SITE_EVENT_SELECT}`,
      fallbackPath: { path: `/rest/v1/site_events?select=${SITE_EVENT_COLUMNS}`, shape: slimSiteEvents },
      orderColumn: "created_at",
      shape: rows => rebuildPayload(rows, SITE_EVENT_PAYLOAD_KEYS)
    }),
    supabaseFetchAll("/rest/v1/portal_users?select=*&order=created_at.desc"),
    supabaseFetchAll("/rest/v1/office_notes?select=*&order=created_at.desc"),
    omit.has("history") ? Promise.resolve([]) : optionalSupabaseFetchAll(`/rest/v1/audit_events?select=${AUDIT_COLUMNS}&order=created_at.desc`, "audit_events", unavailableCapabilities),
    omit.has("history") ? Promise.resolve([]) : optionalSupabaseFetchAll("/rest/v1/office_note_revisions?select=*&order=created_at.desc", "office_note_revisions", unavailableCapabilities),
    omit.has("history") ? Promise.resolve([]) : optionalSupabaseFetchAll("/rest/v1/form_delivery_attempts?select=*&order=created_at.desc", "form_delivery_attempts", unavailableCapabilities),
    optionalSupabaseFetchAll("/rest/v1/review_publications?select=*&order=updated_at.desc", "review_publications", unavailableCapabilities),
    fetchAppendOnlyTable({
      key: "lifecycle_events",
      path: `/rest/v1/lifecycle_events?select=${LIFECYCLE_SELECT}`,
      fallbackPath: { path: "/rest/v1/lifecycle_events?select=*", shape: slimLifecycleEvents },
      orderColumn: "occurred_at",
      shape: rows => rebuildPayload(rows, LIFECYCLE_PAYLOAD_KEYS)
    }).catch(error => {
      if (!/relation .* does not exist|could not find the table|schema cache|42p01/i.test(String(error?.message || error || ""))) throw error;
      unavailableCapabilities.push("lifecycle_events");
      return [];
    }),
    omit.has("sheets") ? Promise.resolve([]) : optionalSupabaseFetchAll("/rest/v1/office_leads_sheet?select=*&order=received_at.desc", "office_leads_sheet", unavailableCapabilities),
    omit.has("sheets") ? Promise.resolve([]) : optionalSupabaseFetchAll("/rest/v1/office_applications_sheet?select=*&order=received_at.desc", "office_applications_sheet", unavailableCapabilities),
    Promise.resolve(null),
    optionalSupabaseFetchAll("/rest/v1/deals?select=*&order=sold_on.desc,created_at.desc", "deals", unavailableCapabilities),
    optionalSupabaseFetchAll("/rest/v1/deal_payments?select=*&order=due_on.asc,sequence.asc", "deal_payments", unavailableCapabilities)
  ]);
  // clientsTotal still runs: the dashboard prints it. The clients sheet does not.
  const [clientsTotal, clientsSheetRows] = await Promise.all([
    countRows("clients").catch(() => clients.length),
    omit.has("sheets")
      ? Promise.resolve([])
      : fetchByInBatched("/rest/v1/office_clients_sheet?select=*", "id", clients.map(row => row.id), "office_clients_sheet", unavailableCapabilities)
  ]);
  return {
    clientsTotal,
    clientsTruncated: clients.length >= CLIENT_PAGE_LIMIT,
    trainers,
    pages,
    leads,
    leadEvents,
    clients,
    dogs,
    applications,
    submissions,
    events,
    portalUsers,
    officeNotes,
    auditEvents,
    noteRevisions,
    deliveryAttempts,
    reviewPublications,
    lifecycleEvents,
    leadsSheet,
    applicationsSheet,
    clientsSheet: clientsSheet || clientsSheetRows,
    deals,
    dealPayments
  };
}

async function loadTrainerOperationalData(portalUser, unavailableCapabilities, omit = new Set()) {
  const trainerId = portalUser.trainer_id;
  const [trainers, pages, leads, submissions, events] = await Promise.all([
    supabaseFetchAll(`/rest/v1/trainers?select=*&id=eq.${encodeURIComponent(trainerId)}&limit=1`),
    supabaseFetchAll(`/rest/v1/trainer_pages?select=*&trainer_id=eq.${encodeURIComponent(trainerId)}&order=updated_at.desc`),
    supabaseFetchAll(`/rest/v1/leads?select=*&trainer_id=eq.${encodeURIComponent(trainerId)}&order=created_at.desc`),
    supabaseFetchAll(`/rest/v1/content_submissions?select=*&trainer_id=eq.${encodeURIComponent(trainerId)}&order=created_at.desc`),
    optionalSupabaseFetchAll(`/rest/v1/site_events?select=${SITE_EVENT_SELECT}&trainer_id=eq.${encodeURIComponent(trainerId)}&order=created_at.desc`, "site_events", unavailableCapabilities)
      .then(rows => rebuildPayload(rows, SITE_EVENT_PAYLOAD_KEYS))
      .catch(() => optionalSupabaseFetchAll(`/rest/v1/site_events?select=${SITE_EVENT_COLUMNS}&trainer_id=eq.${encodeURIComponent(trainerId)}&order=created_at.desc`, "site_events", unavailableCapabilities).then(slimSiteEvents))
  ]);
  if (!trainers[0]) throw new Error("Trainer profile was not found for this portal account.");
  const leadIds = leads.map(row => row.id);
  const submissionIds = submissions.map(row => row.id);
  const noteEntityIds = [trainerId, ...leadIds, ...submissionIds];
  const [leadEvents, officeNotes] = await Promise.all([
    fetchByIn("/rest/v1/lead_events?select=*&order=created_at.desc", "lead_id", leadIds, "lead_events", unavailableCapabilities),
    fetchByIn("/rest/v1/office_notes?select=*&order=created_at.desc", "entity_id", noteEntityIds, "office_notes", unavailableCapabilities)
  ]);
  const deals = await optionalSupabaseFetchAll(`/rest/v1/deals?select=*&trainer_id=eq.${encodeURIComponent(trainerId)}&order=sold_on.desc,created_at.desc`, "deals", unavailableCapabilities);
  const dealPayments = await fetchByIn("/rest/v1/deal_payments?select=*&order=due_on.asc,sequence.asc", "deal_id", deals.map(row => row.id), "deal_payments", unavailableCapabilities);
  // A trainer's note revisions are fetched one round trip after the notes, so
  // skipping them on sign-in removes a whole serial hop from their login.
  const noteRevisions = omit.has("history") ? [] : await fetchByIn(
    "/rest/v1/office_note_revisions?select=*&order=created_at.desc",
    "office_note_id",
    officeNotes.map(row => row.id),
    "office_note_revisions",
    unavailableCapabilities
  );
  const reviewPublications = await fetchByIn(
    "/rest/v1/review_publications?select=*&order=updated_at.desc",
    "submission_id",
    submissionIds,
    "review_publications",
    unavailableCapabilities
  );
  return {
    trainers,
    pages,
    leads,
    leadEvents,
    clients: [],
    dogs: [],
    applications: [],
    submissions,
    events,
    portalUsers: [portalUser],
    officeNotes,
    auditEvents: [],
    noteRevisions,
    deliveryAttempts: [],
    reviewPublications,
    lifecycleEvents: [],
    leadsSheet: [],
    applicationsSheet: [],
    clientsSheet: [],
    deals,
    dealPayments
  };
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ ok: false, message: "Method not allowed" });
  if (!SERVICE_ROLE_KEY) return res.status(500).json({ ok: false, message: "Supabase service role key is not configured on Vercel." });

  try {
    // Any active portal user (lib/portal-auth.js). Trainers get only their own rows below.
    const access = await authorizeRequest(req, res, { require: "any", message: "Active portal access required." });
    if (!access) return;

    const unavailableCapabilities = [];
    const omit = parseOmit(req.query?.omit);
    const data = access.role === "trainer"
      ? await loadTrainerOperationalData(access.portalUser, unavailableCapabilities, omit)
      : await loadAdminOperationalData(unavailableCapabilities, omit);
    // Practice copy: every row above already came from the practice schema.
    // The only extra is the "Sent to live ✓" stamp per trainer page, kept in
    // practice.send_to_live_log by api/send-to-live.js.
    let sendToLiveLog = [];
    if (isSandbox()) {
      try {
        sendToLiveLog = await supabaseFetch("/rest/v1/send_to_live_log?select=entity_id,slug,sent_at,sent_by,sent_by_name&entity_type=eq.trainer_page&order=sent_at.desc&limit=500") || [];
        const stamps = new Map();
        sendToLiveLog.forEach(row => [row.entity_id, row.slug].filter(Boolean).forEach(key => { if (!stamps.has(key)) stamps.set(key, row); }));
        (data.pages || []).forEach(page => {
          const hit = stamps.get(String(page.id)) || stamps.get(String(page.slug));
          if (hit) { page.sent_to_live_at = hit.sent_at; page.sent_to_live_by = hit.sent_by || null; page.sent_to_live_by_name = hit.sent_by_name || null; }
        });
      } catch (error) {
        console.error("Practice send-to-live stamps could not be read", error);
      }
    }
    // Page-view lifecycle rows become timestamps; only lead/application rows travel.
    const lifecycleSplit = splitLifecycle(data.lifecycleEvents || []);
    data.lifecycleEvents = lifecycleSplit.rows;
    const visitStamps = lifecycleSplit.stamps;
    let {
      trainers,
      pages,
      leads,
      leadEvents,
      clients,
      dogs,
      applications,
      submissions,
      events,
      portalUsers,
      officeNotes,
      auditEvents,
      noteRevisions,
      deliveryAttempts,
      reviewPublications,
      lifecycleEvents,
      leadsSheet,
      applicationsSheet,
      clientsSheet
    } = data;
    portalUsers = await enrichPortalUsersWithAuth(portalUsers);

    const syncedAt = new Date().toISOString();
    // perf/portal-speed: the revision now covers every collection the portal
    // draws (it used to skip events, delivery attempts, note revisions, deals
    // and the sandbox practice layer). The portal sends it back as
    // If-None-Match on each 30-second poll; when nothing changed the answer is
    // an empty 304 instead of a ~20 MB body the browser would parse and throw away.
    const rowStamp = row => `${row.id || row.user_id || ""}:${row.version || row.revision || row.updated_at || row.auth_last_sign_in_at || row.created_at || ""}`;
    const revisionInput = [
      [trainers, pages, leads, clients, applications, submissions, officeNotes, auditEvents, portalUsers, dogs, noteRevisions, deliveryAttempts, reviewPublications, data.deals || [], data.dealPayments || []]
        .flat().map(rowStamp).sort().join("|"),
      `events:${events.length}:${events[0]?.id || ""}`,
      `lifecycle:${lifecycleEvents.length}:${lifecycleEvents[0]?.id || ""}`,
      // The visits tile must stay fresh, so its inputs are in the revision. The
      // trimmed body is now small enough that a 200 per new visitor is cheap.
      `visits:${visitStamps.site_visit.length}:${visitStamps.cta_click.length}`,
      `sent:${sendToLiveLog.length}:${sendToLiveLog[0]?.sent_at || ""}`,
      `clientsTotal:${data.clientsTotal ?? ""}`,
      // A trimmed answer and a full one are different documents. Without this a
      // browser holding the full set would be told 304 by a trimmed request.
      `omit:${[...omit].sort().join(",")}`
    ].join("||");
    const serverRevision = crypto.createHash("sha256").update(revisionInput).digest("hex").slice(0, 20);
    const etag = `"${serverRevision}"`;
    res.setHeader("ETag", etag);
    res.setHeader("Cache-Control", "private, no-store");
    const ifNoneMatch = String(req.headers["if-none-match"] || "").split(",").map(value => value.trim().replace(/^W\//, ""));
    if (ifNoneMatch.includes(etag)) return res.status(304).end();
    const completeSheetRows = (records, projection) => {
      const projectedById = new Map((projection || []).map(row => [String(row.id), row]));
      return (records || []).map(record => ({
        ...record,
        ...(projectedById.get(String(record.id)) || {}),
        raw_payload: record.raw_payload || {}
      }));
    };
    const trainersById = new Map((trainers || []).map(trainer => [String(trainer.id), trainer]));
    const dogsByClientId = (dogs || []).reduce((grouped, dog) => {
      const key = String(dog.client_id || "");
      if (!key) return grouped;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(dog);
      return grouped;
    }, new Map());
    const completeClientSheetRows = (records, projection) => {
      const projectedById = new Map((projection || []).map(row => [String(row.id), row]));
      return (records || []).map(record => {
        const clientDogs = dogsByClientId.get(String(record.id)) || [];
        const trainer = trainersById.get(String(record.trainer_id || ""));
        return {
          ...record,
          ...(projectedById.get(String(record.id)) || {}),
          client_name: record.client_name || projectedById.get(String(record.id))?.client_name || "",
          dog_names: clientDogs.map(dog => dog.name).filter(Boolean).join(", "),
          dog_breeds: clientDogs.map(dog => dog.breed).filter(Boolean).join(", "),
          assigned_trainer_name: trainer?.full_name || "",
          raw_payload: record.raw_payload || {}
        };
      });
    };

    return res.status(200).json({
      ok: true,
      canonical: true,
      syncedAt,
      serverRevision,
      unavailableCapabilities,
      trainers,
      pages,
      leads,
      leadEvents,
      clients,
      dogs,
      applications,
      submissions,
      events,
      portalUsers,
      officeNotes,
      auditEvents,
      noteRevisions,
      deliveryAttempts,
      reviewPublications,
      lifecycleEvents,
      visitStamps,
      // The caller merges only the blocks it actually received; `omitted` is how
      // it tells "not asked for" apart from "now empty".
      omitted: [...omit].sort(),
      sheets: omit.has("sheets") ? { leads: [], applications: [], clients: [] } : {
        leads: completeSheetRows(leads, leadsSheet),
        applications: completeSheetRows(applications, applicationsSheet),
        clients: completeClientSheetRows(clients, clientsSheet)
      }
    });
  } catch (error) {
    console.error("Operational data API error", error);
    return res.status(500).json({ ok: false, message: error.message || "Operational data could not be loaded." });
  }
};
