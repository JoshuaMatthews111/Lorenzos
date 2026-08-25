// Wipes the sandbox practice layer so testing starts fresh from the live
// records. Sandbox deployment only; Super Admin only. On live it does not exist
// as far as callers can tell.
const { isSandbox } = require("../lib/sandbox");
const sandboxStore = require("../lib/sandbox-store");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://ptnzaeprvkgjgtupmcty.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";

async function verifySuperAdmin(accessToken) {
  if (!accessToken) return null;
  const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${accessToken}` }
  });
  if (!userResponse.ok) return null;
  const user = await userResponse.json();
  if (!user?.id) return null;
  const rows = await fetch(
    `${SUPABASE_URL}/rest/v1/portal_users?select=user_id&user_id=eq.${encodeURIComponent(user.id)}&role=eq.admin&permission_level=eq.super_admin&active=eq.true&limit=1`,
    { headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` } }
  ).then(r => r.ok ? r.json() : []);
  return rows?.[0] ? user : null;
}

module.exports = async function handler(req, res) {
  if (!isSandbox()) return res.status(404).json({ ok: false, message: "Not found." });
  if (req.method !== "POST") return res.status(405).json({ ok: false, message: "Method not allowed" });
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const user = await verifySuperAdmin(token);
  if (!user) return res.status(403).json({ ok: false, message: "Super Admin access required." });
  await sandboxStore.clearOps();
  return res.status(200).json({ ok: true, message: "Practice layer wiped. The sandbox now matches the live records exactly." });
};
