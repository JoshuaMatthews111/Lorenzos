// Daily lead archiving (office request, 2026-08-17).
//
// Old inbound enquiries were piling up in the live pipeline and skewing the board.
// This moves inactive ones to Archived so the working queues stay current. Nothing
// is deleted: archived leads keep every field and can be restored by the office.
//
// Deliberately conservative — a lead is left alone if anyone is working it.

const SUPABASE_URL = process.env.SUPABASE_URL || "https://ptnzaeprvkgjgtupmcty.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";
const CRON_SECRET = process.env.CRON_SECRET || "";
const ARCHIVE_AFTER_DAYS = Math.max(1, Number(process.env.ARCHIVE_AFTER_DAYS || 30));

// Never auto-archive an outcome the office has already recorded, and never touch a
// lead that became a client — those belong in reporting and the client database.
const PROTECTED_STATUSES = [
  "archived",
  "became_client",
  "first_session_payment"
];

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
  const raw = await response.text();
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
  if (!response.ok) throw new Error(data?.message || data?.error || raw || `Supabase error ${response.status}`);
  return data;
}

function authorized(req) {
  // Vercel stamps its own scheduled calls; a shared secret covers manual runs.
  if (req.headers["x-vercel-cron"]) return true;
  const bearer = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  return Boolean(CRON_SECRET) && bearer === CRON_SECRET;
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!SERVICE_ROLE_KEY) return res.status(500).json({ ok: false, message: "Server is not configured." });
  if (!authorized(req)) return res.status(403).json({ ok: false, message: "Forbidden." });

  // ?dry=1 reports what WOULD be archived and changes nothing.
  const dryRun = String(req.query?.dry || "") === "1";
  const cutoff = new Date(Date.now() - ARCHIVE_AFTER_DAYS * 86400000).toISOString();

  try {
    const protectedList = PROTECTED_STATUSES.map(status => `"${status}"`).join(",");
    const candidates = await supabaseFetch(
      `/rest/v1/leads?select=id,client_name,status,updated_at,created_at,claimed_by,assigned_user_id,communications_code`
      + `&status=not.in.(${protectedList})`
      + `&updated_at=lt.${encodeURIComponent(cutoff)}`
      // Someone is working it — leave it in the live pipeline.
      + `&claimed_by=is.null&assigned_user_id=is.null`
      + `&archived_at=is.null`
      + `&order=updated_at.asc&limit=500`
    );

    const summary = {
      ok: true,
      dryRun,
      thresholdDays: ARCHIVE_AFTER_DAYS,
      inactiveSince: cutoff,
      eligible: candidates.length,
      archived: 0,
      leads: candidates.slice(0, 50).map(lead => ({
        id: lead.id,
        code: lead.communications_code,
        name: lead.client_name,
        status: lead.status,
        lastActivity: lead.updated_at
      }))
    };
    if (dryRun || !candidates.length) return res.status(200).json(summary);

    const stamp = new Date().toISOString();
    for (let index = 0; index < candidates.length; index += 100) {
      const chunk = candidates.slice(index, index + 100);
      await supabaseFetch(`/rest/v1/leads?id=in.(${chunk.map(lead => lead.id).join(",")})`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ status: "archived", archived_at: stamp })
      });
      // Every archive is logged against the lead so the history stays readable.
      await supabaseFetch("/rest/v1/lead_events", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify(chunk.map(lead => ({
          lead_id: lead.id,
          event_type: "lead_archived",
          note: `Archived automatically after ${ARCHIVE_AFTER_DAYS} days with no activity (was ${lead.status}).`,
          event_key: `auto-archive:${lead.id}:${stamp}`,
          occurred_at: stamp,
          raw_payload: { source: "auto_archive", previous_status: lead.status, threshold_days: ARCHIVE_AFTER_DAYS }
        })))
      }).catch(() => {});
      summary.archived += chunk.length;
    }

    await supabaseFetch("/rest/v1/audit_events", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        actor_name: "Automatic archiving",
        action: "leads_auto_archived",
        entity_type: "leads",
        entity_id: "scheduled",
        summary: `${summary.archived} lead(s) archived after ${ARCHIVE_AFTER_DAYS} days without activity.`,
        after_data: { threshold_days: ARCHIVE_AFTER_DAYS, inactive_since: cutoff, archived: summary.archived }
      })
    }).catch(() => {});

    return res.status(200).json(summary);
  } catch (error) {
    console.error("Auto-archive failed", error);
    return res.status(500).json({ ok: false, message: error.message || "Archiving failed." });
  }
};
