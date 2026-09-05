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
const { isSandbox, supabaseRequest } = require("../lib/sandbox");

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

async function verifySuperAdmin(accessToken) {
  if (!accessToken) return null;
  const userResponse = await deps.fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${accessToken}` } });
  if (!userResponse.ok) return null;
  const user = await userResponse.json();
  if (!user?.id) return null;
  const rows = await supabaseFetch(`/rest/v1/portal_users?select=user_id,email&user_id=eq.${encodeURIComponent(user.id)}&role=eq.admin&permission_level=eq.super_admin&active=eq.true&limit=1`).catch(() => []);
  return rows?.[0] ? user : null;
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
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const user = await verifySuperAdmin(token);
  if (!user) return res.status(403).json({ ok: false, message: "Super Admin access required." });
  try {
    // rpc/reset_from_live resolves in the practice schema (Content-Profile: practice).
    const result = await supabaseFetch("/rest/v1/rpc/reset_from_live", { method: "POST", body: "{}" });
    const emptied = await emptyPracticeBuckets();
    return res.status(200).json({
      ok: true,
      reset_at: result?.reset_at || new Date().toISOString(),
      rows: result?.rows || {},
      buckets: emptied,
      message: "Practice copy reset. Every practice table and every practice upload now matches live exactly."
    });
  } catch (error) {
    console.error("Practice reset failed", error);
    return res.status(error.status && error.status >= 400 && error.status < 600 ? error.status : 500).json({ ok: false, message: error.message || "The practice copy could not be reset." });
  }
};
module.exports.deps = deps;
