const SUPABASE_URL = process.env.SUPABASE_URL || "https://ptnzaeprvkgjgtupmcty.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";
const crypto = require("node:crypto");

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

async function supabaseFetchAll(path, pageSize = 1000, maxRows = 100000) {
  const rows = [];
  const separator = path.includes("?") ? "&" : "?";
  for (let offset = 0; offset < maxRows; offset += pageSize) {
    const page = await supabaseFetch(`${path}${separator}limit=${pageSize}&offset=${offset}`);
    if (!Array.isArray(page)) return page;
    rows.push(...page);
    if (page.length < pageSize) break;
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
    clientsSheet
  ] = await Promise.all([
    supabaseFetchAll("/rest/v1/trainers?select=*&order=full_name.asc"),
    supabaseFetchAll("/rest/v1/trainer_pages?select=*&order=updated_at.desc"),
    supabaseFetchAll("/rest/v1/leads?select=*&order=created_at.desc"),
    supabaseFetchAll("/rest/v1/lead_events?select=*&order=created_at.desc"),
    supabaseFetchAll("/rest/v1/clients?select=*&order=created_at.desc"),
    supabaseFetchAll("/rest/v1/dogs?select=*&order=created_at.desc"),
    supabaseFetchAll("/rest/v1/trainer_applications?select=*&order=created_at.desc"),
    supabaseFetchAll("/rest/v1/content_submissions?select=*&order=created_at.desc"),
    supabaseFetchAll("/rest/v1/site_events?select=*&order=created_at.desc"),
    supabaseFetchAll("/rest/v1/portal_users?select=*&order=created_at.desc"),
    supabaseFetchAll("/rest/v1/office_notes?select=*&order=created_at.desc"),
    optionalSupabaseFetchAll("/rest/v1/audit_events?select=*&order=created_at.desc", "audit_events", unavailableCapabilities),
    optionalSupabaseFetchAll("/rest/v1/office_note_revisions?select=*&order=created_at.desc", "office_note_revisions", unavailableCapabilities),
    optionalSupabaseFetchAll("/rest/v1/form_delivery_attempts?select=*&order=created_at.desc", "form_delivery_attempts", unavailableCapabilities),
    optionalSupabaseFetchAll("/rest/v1/review_publications?select=*&order=updated_at.desc", "review_publications", unavailableCapabilities),
    optionalSupabaseFetchAll("/rest/v1/lifecycle_events?select=*&order=occurred_at.desc", "lifecycle_events", unavailableCapabilities),
    optionalSupabaseFetchAll("/rest/v1/office_leads_sheet?select=*&order=received_at.desc", "office_leads_sheet", unavailableCapabilities),
    optionalSupabaseFetchAll("/rest/v1/office_applications_sheet?select=*&order=received_at.desc", "office_applications_sheet", unavailableCapabilities),
    optionalSupabaseFetchAll("/rest/v1/office_clients_sheet?select=*&order=created_at.desc", "office_clients_sheet", unavailableCapabilities)
  ]);
  return {
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
  };
}

async function loadTrainerOperationalData(portalUser, unavailableCapabilities) {
  const trainerId = portalUser.trainer_id;
  const [trainers, pages, leads, submissions, events] = await Promise.all([
    supabaseFetchAll(`/rest/v1/trainers?select=*&id=eq.${encodeURIComponent(trainerId)}&limit=1`),
    supabaseFetchAll(`/rest/v1/trainer_pages?select=*&trainer_id=eq.${encodeURIComponent(trainerId)}&order=updated_at.desc`),
    supabaseFetchAll(`/rest/v1/leads?select=*&trainer_id=eq.${encodeURIComponent(trainerId)}&order=created_at.desc`),
    supabaseFetchAll(`/rest/v1/content_submissions?select=*&trainer_id=eq.${encodeURIComponent(trainerId)}&order=created_at.desc`),
    optionalSupabaseFetchAll(`/rest/v1/site_events?select=*&trainer_id=eq.${encodeURIComponent(trainerId)}&order=created_at.desc`, "site_events", unavailableCapabilities)
  ]);
  if (!trainers[0]) throw new Error("Trainer profile was not found for this portal account.");
  const leadIds = leads.map(row => row.id);
  const submissionIds = submissions.map(row => row.id);
  const noteEntityIds = [trainerId, ...leadIds, ...submissionIds];
  const [leadEvents, officeNotes] = await Promise.all([
    fetchByIn("/rest/v1/lead_events?select=*&order=created_at.desc", "lead_id", leadIds, "lead_events", unavailableCapabilities),
    fetchByIn("/rest/v1/office_notes?select=*&order=created_at.desc", "entity_id", noteEntityIds, "office_notes", unavailableCapabilities)
  ]);
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
    clientsSheet: []
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
