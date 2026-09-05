// "Reset practice copy to match live."
//
// Practice deployment only (LDTT_SANDBOX=1); Super Admin only. On live this
// endpoint does not exist as far as callers can tell (404 before auth).
//
// Two steps, both against practice-only things:
//   1. practice.reset_from_live()  — the SECURITY DEFINER function from
//      supabase/migrations/20260905200000_practice_schema.sql: truncates every
//      practice.* table in one FK-safe statement and copies every row from
//      public.*. It refuses any caller that is not the service role.
//   2. empties every practice-* Storage bucket through the Storage API, so
//      practice uploads go too (their URLs would dangle otherwise).
// Nothing here can touch a public table or a live bucket: the RPC is
// hard-wired to practice.*, and the bucket list is filtered to practice-*.
//
// Who pressed it is recorded. The person types their FULL NAME (two words
// minimum) in the confirm box; a missing or one-word name is a 400 and nothing
// is wiped. The name and login go to practice_private.reset_log through
// practice.reset_from_live_by(name, email) (migration 20260905210000). The log
// lives in practice_private because the reset truncates every practice.* table,
// so a log inside practice would wipe its own history.
const { isSandbox, supabaseRequest } = require("../lib/sandbox");
const portalAuth = require("../lib/portal-auth");
const { fullNameOrEmpty } = require("./send-to-live");
const NAME_REQUIRED_MESSAGE = "Type your full name (first and last) to reset the practice copy. Nothing was wiped.";

const SUPABASE_URL = process.env.SUPABASE_URL || "https://ptnzaeprvkgjgtupmcty.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";

// Swappable for tests. Production never touches it.
const deps = { fetch: (...args) => fetch(...args) };

function headers(extra = {}) {
  return { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, "Content-Type": "application/json", ...extra };
}

async function supabaseFetch(path, options = {}) {
  // Practice copy: schema profile headers / practice-* bucket (lib/sandbox.js).
  const target = supabaseRequest(path, options.headers || {});
  const response = await deps.fetch(`${SUPABASE_URL}${target.path}`, { ...options, headers: headers(target.headers) });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) throw Object.assign(new Error(data?.message || data?.error || text || `Supabase ${response.status}`), { status: response.status });
  return data;
}

// Storage's list call is one folder deep, so walk it.
async function listObjects(bucket, prefix = "") {
  const out = [];
  let offset = 0;
  for (;;) {
    const page = await supabaseFetch(`/storage/v1/object/list/${encodeURIComponent(bucket)}`, {
      method: "POST", body: JSON.stringify({ prefix, limit: 1000, offset, sortBy: { column: "name", order: "asc" } })
    });
    const items = Array.isArray(page) ? page : [];
    for (const item of items) {
      const name = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id) out.push(name); else out.push(...(await listObjects(bucket, name)));
    }
    if (items.length < 1000) break;
    offset += items.length;
  }
  return out;
}

async function emptyPracticeBuckets() {
  const buckets = await supabaseFetch("/storage/v1/bucket");
  const practiceBuckets = (Array.isArray(buckets) ? buckets : []).map(b => b.id).filter(id => id.startsWith("practice-"));
  const emptied = {};
  for (const bucket of practiceBuckets) {
    const names = await listObjects(bucket);
    for (let i = 0; i < names.length; i += 100) {
      // The bucket name is already practice-*; supabaseRequest leaves it alone.
      await supabaseFetch(`/storage/v1/object/${encodeURIComponent(bucket)}`, { method: "DELETE", body: JSON.stringify({ prefixes: names.slice(i, i + 100) }) });
    }
    emptied[bucket] = names.length;
  }
  return emptied;
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  if (!isSandbox()) return res.status(404).json({ ok: false, message: "Not found." });
  if (req.method !== "POST") return res.status(405).json({ ok: false, message: "Method not allowed" });
  if (!SERVICE_ROLE_KEY) return res.status(500).json({ ok: false, message: "Supabase service role key is not configured." });
  // Super Admin only (lib/portal-auth.js, through deps.fetch), active and not
  // disabled/revoked (this endpoint used to skip access_status). The 404 above
  // already guarantees the practice schema, so this reads practice.portal_users.
  const auth = await portalAuth.authorizeRequest(req, res, { require: "super", message: "Super Admin access required.", fetchImpl: (...args) => deps.fetch(...args) });
  if (!auth) return;
  const user = auth.user;
  let body = {};
  try { body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {}; } catch { body = {}; }
  // Who is wiping it. Checked before anything is touched.
  const resetByName = fullNameOrEmpty(body.reset_by_name);
  if (!resetByName) return res.status(400).json({ ok: false, message: NAME_REQUIRED_MESSAGE });
  try {
    // rpc/reset_from_live_by resolves in the practice schema (Content-Profile: practice):
    // practice.reset_from_live() plus one practice_private.reset_log row, one transaction.
    const result = await supabaseFetch("/rest/v1/rpc/reset_from_live_by", { method: "POST", body: JSON.stringify({ reset_by_name: resetByName, reset_by_email: String(user.email || "").toLowerCase() || null }) });
    const emptied = await emptyPracticeBuckets();
    return res.status(200).json({
      ok: true,
      reset_at: result?.reset_at || new Date().toISOString(),
      reset_by_name: resetByName,
      rows: result?.rows || {},
      buckets: emptied,
      message: `Practice copy reset by ${resetByName}. Every practice table and every practice upload now matches live exactly.`
    });
  } catch (error) {
    console.error("Practice reset failed", error);
    return res.status(error.status && error.status >= 400 && error.status < 600 ? error.status : 500).json({ ok: false, message: error.message || "The practice copy could not be reset." });
  }
};
module.exports.deps = deps;
