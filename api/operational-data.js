const SUPABASE_URL = process.env.SUPABASE_URL || "https://ptnzaeprvkgjgtupmcty.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";
const crypto = require("node:crypto");
const { isSandbox } = require("../lib/sandbox");
const sandboxStore = require("../lib/sandbox-store");

function cors(response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return response;
}

async function supabaseFetch(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
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

// site_events and lifecycle_events are ~12,000 rows each and every row carries a
// raw_payload with user agents, full URLs and form echoes the portal never shows.
// The dashboard reads only these keys (see siteEventRows / reportLifecycleRows),
// so everything else stays on the server. referrer and user_agent are never read.
const SITE_EVENT_COLUMNS = [
  "id", "trainer_id", "event_type", "page_path", "created_at", "trainer_slug", "assigned_trainer_name",
  "visitor_id", "session_id", "utm_source", "utm_medium", "utm_campaign",
  "trainer_market", "trainer_city", "trainer_state", "raw_payload"
].join(",");
const SITE_EVENT_PAYLOAD_KEYS = ["qa", "page_url", "time_on_page_seconds", "landing_page_type", "ad_market", "timestamp"];
const LIFECYCLE_PAYLOAD_KEYS = ["qa", "page_url"];

function slimPayload(row, keys) {
  const raw = row && row.raw_payload && typeof row.raw_payload === "object" ? row.raw_payload : {};
  const kept = {};
  for (const key of keys) if (raw[key] !== undefined) kept[key] = raw[key];
  return { ...row, raw_payload: kept };
}
const slimSiteEvents = rows => (Array.isArray(rows) ? rows.map(row => slimPayload(row, SITE_EVENT_PAYLOAD_KEYS)) : rows);
const slimLifecycleEvents = rows => (Array.isArray(rows) ? rows.map(row => slimPayload(row, LIFECYCLE_PAYLOAD_KEYS)) : rows);

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
  const response = await fetch(`${SUPABASE_URL}${path}${separator}limit=${pageSize}&offset=${offset}`, {
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      ...(withCount ? { Prefer: "count=exact" } : {})
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

async function verifyPortalAccess(accessToken) {
  if (!accessToken) return null;
  const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${accessToken}`
    }
  });
  if (!userResponse.ok) return null;
  const user = await userResponse.json();
  if (!user?.id) return null;
  let rows;
  try {
    rows = await supabaseFetch(
      `/rest/v1/portal_users?select=*&user_id=eq.${encodeURIComponent(user.id)}&active=eq.true&limit=1`
    );
  } catch (error) {
    if (!isMissingColumnError(error)) throw error;
    rows = await supabaseFetch(
      `/rest/v1/portal_users?select=user_id,role,trainer_id,active&user_id=eq.${encodeURIComponent(user.id)}&active=eq.true&limit=1`
    );
  }
  const portalUser = rows?.[0];
  if (!portalUser) return null;
  const accessStatus = String(portalUser.access_status || "active").toLowerCase();
  if (["disabled", "revoked"].includes(accessStatus)) return null;
  if (portalUser.role === "admin" && !["super_admin", "office_admin"].includes(String(portalUser.permission_level || "super_admin"))) return null;
  if (portalUser.role === "trainer" && !portalUser.trainer_id) return null;
  if (!["admin", "trainer"].includes(portalUser.role)) return null;
  return { user, portalUser };
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

async function loadAdminOperationalData(unavailableCapabilities) {
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
    supabaseFetchAll("/rest/v1/lead_events?select=*&order=created_at.desc"),
    // The client database is now many thousands of rows. Sending all of them to the
    // browser pushed this response past the platform's size limit, which made the
    // whole portal fall back to offline mode — notes stopped saving and dragged
    // cards stopped sticking. The office works with the most recent records and
    // searches the server for anyone older.
    supabaseFetchAll(`/rest/v1/clients?select=${CLIENT_COLUMNS}&order=created_at.desc`, CLIENT_PAGE_LIMIT, CLIENT_PAGE_LIMIT),
    supabaseFetchAll("/rest/v1/dogs?select=*&order=created_at.desc"),
    supabaseFetchAll("/rest/v1/trainer_applications?select=*&order=created_at.desc"),
    supabaseFetchAll("/rest/v1/content_submissions?select=*&order=created_at.desc"),
    supabaseFetchAll(`/rest/v1/site_events?select=${SITE_EVENT_COLUMNS}&order=created_at.desc`).then(slimSiteEvents),
    supabaseFetchAll("/rest/v1/portal_users?select=*&order=created_at.desc"),
    supabaseFetchAll("/rest/v1/office_notes?select=*&order=created_at.desc"),
    optionalSupabaseFetchAll("/rest/v1/audit_events?select=*&order=created_at.desc", "audit_events", unavailableCapabilities),
    optionalSupabaseFetchAll("/rest/v1/office_note_revisions?select=*&order=created_at.desc", "office_note_revisions", unavailableCapabilities),
    optionalSupabaseFetchAll("/rest/v1/form_delivery_attempts?select=*&order=created_at.desc", "form_delivery_attempts", unavailableCapabilities),
    optionalSupabaseFetchAll("/rest/v1/review_publications?select=*&order=updated_at.desc", "review_publications", unavailableCapabilities),
    optionalSupabaseFetchAll("/rest/v1/lifecycle_events?select=*&order=occurred_at.desc", "lifecycle_events", unavailableCapabilities).then(slimLifecycleEvents),
    optionalSupabaseFetchAll("/rest/v1/office_leads_sheet?select=*&order=received_at.desc", "office_leads_sheet", unavailableCapabilities),
    optionalSupabaseFetchAll("/rest/v1/office_applications_sheet?select=*&order=received_at.desc", "office_applications_sheet", unavailableCapabilities),
    optionalSupabaseFetchAll("/rest/v1/office_clients_sheet?select=*&order=created_at.desc", "office_clients_sheet", unavailableCapabilities),
    optionalSupabaseFetchAll("/rest/v1/deals?select=*&order=sold_on.desc,created_at.desc", "deals", unavailableCapabilities),
    optionalSupabaseFetchAll("/rest/v1/deal_payments?select=*&order=due_on.asc,sequence.asc", "deal_payments", unavailableCapabilities)
  ]);
  const clientsTotal = await countRows("clients").catch(() => clients.length);
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
    clientsSheet,
    deals,
    dealPayments
  };
}

async function loadTrainerOperationalData(portalUser, unavailableCapabilities) {
  const trainerId = portalUser.trainer_id;
  const [trainers, pages, leads, submissions, events] = await Promise.all([
    supabaseFetchAll(`/rest/v1/trainers?select=*&id=eq.${encodeURIComponent(trainerId)}&limit=1`),
    supabaseFetchAll(`/rest/v1/trainer_pages?select=*&trainer_id=eq.${encodeURIComponent(trainerId)}&order=updated_at.desc`),
    supabaseFetchAll(`/rest/v1/leads?select=*&trainer_id=eq.${encodeURIComponent(trainerId)}&order=created_at.desc`),
    supabaseFetchAll(`/rest/v1/content_submissions?select=*&trainer_id=eq.${encodeURIComponent(trainerId)}&order=created_at.desc`),
    optionalSupabaseFetchAll(`/rest/v1/site_events?select=${SITE_EVENT_COLUMNS}&trainer_id=eq.${encodeURIComponent(trainerId)}&order=created_at.desc`, "site_events", unavailableCapabilities).then(slimSiteEvents)
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
  const noteRevisions = await fetchByIn(
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
    const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    const access = await verifyPortalAccess(token);
    if (!access) return res.status(403).json({ ok: false, message: "Active portal access required." });

    const unavailableCapabilities = [];
    const data = access.portalUser.role === "trainer"
      ? await loadTrainerOperationalData(access.portalUser, unavailableCapabilities)
      : await loadAdminOperationalData(unavailableCapabilities);
    // The sandbox lays every tester's practice edits over the live rows, so the
    // whole team sees the same picture without a single real record changing.
    if (isSandbox()) {
      try {
        sandboxStore.applyOps(data, await sandboxStore.readOps());
        // Practice deals belong to whoever submitted them. A trainer sees only
        // their own, exactly as on live.
        if (access.portalUser.role === "trainer" && Array.isArray(data.deals)) {
          const mine = String(access.portalUser.trainer_id || "");
          data.deals = data.deals.filter(deal => String(deal.trainer_id || "") === mine);
          const ids = new Set(data.deals.map(deal => String(deal.id)));
          data.dealPayments = (data.dealPayments || []).filter(payment => ids.has(String(payment.deal_id)));
        }
      } catch (error) {
        console.error("Sandbox practice layer could not be applied", error);
      }
    }
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
    const revisionInput = [trainers, pages, leads, clients, applications, submissions, officeNotes, auditEvents]
      .flat()
      .map(row => `${row.id || row.user_id || ""}:${row.version || row.revision || row.updated_at || row.auth_last_sign_in_at || row.created_at || ""}`)
      .sort()
      .join("|");
    const serverRevision = crypto.createHash("sha256").update(revisionInput).digest("hex").slice(0, 20);
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
      sheets: {
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
