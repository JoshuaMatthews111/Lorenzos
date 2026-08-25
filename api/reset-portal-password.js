const { blockedInSandbox } = require("../lib/sandbox");
const SUPABASE_URL = process.env.SUPABASE_URL || "https://ptnzaeprvkgjgtupmcty.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";

function cors(response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return response;
}

function clean(value, maxLength = 500) {
  return String(value || "").trim().slice(0, maxLength);
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

async function verifySuperAdmin(accessToken) {
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
  const rows = await supabaseFetch(
    `/rest/v1/portal_users?select=user_id,role,permission_level,active,email,display_name,first_name,last_name&user_id=eq.${encodeURIComponent(user.id)}&role=eq.admin&permission_level=eq.super_admin&active=eq.true&limit=1`
  );
  const portalUser = rows?.[0];
  if (!portalUser) return null;
  return {
    user,
    actor: {
      id: user.id,
      email: clean(portalUser.email || user.email, 254),
      name: clean([portalUser.first_name, portalUser.last_name].filter(Boolean).join(" ") || portalUser.display_name || user.email, 180)
    }
  };
}

module.exports = async function handler(req, res) {
  // The sandbox reads live records but is never allowed to change them.
  if (blockedInSandbox(res, "Resetting this password")) return;
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, message: "Method not allowed" });
  if (!SERVICE_ROLE_KEY) return res.status(500).json({ ok: false, message: "Supabase service role key is not configured on Vercel." });

  try {
    const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    const admin = await verifySuperAdmin(token);
    if (!admin) return res.status(403).json({ ok: false, message: "Super Admin access required." });

    const payload = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const userId = clean(payload.user_id, 120);
    const password = String(payload.password || "");
    if (!userId) return res.status(400).json({ ok: false, message: "User ID is required." });
    if (password.length < 8) return res.status(400).json({ ok: false, message: "Password must be at least 8 characters." });

    const targetRows = await supabaseFetch(`/rest/v1/portal_users?select=user_id,email,display_name,first_name,last_name&user_id=eq.${encodeURIComponent(userId)}&limit=1`);
    const target = targetRows?.[0];
    if (!target) return res.status(404).json({ ok: false, message: "Portal user was not found." });

    await supabaseFetch(`/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
      method: "PUT",
      body: JSON.stringify({ password })
    });

    await supabaseFetch(`/rest/v1/portal_users?user_id=eq.${encodeURIComponent(userId)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ must_change_password: false })
    });

    const targetName = clean([target.first_name, target.last_name].filter(Boolean).join(" ") || target.display_name || target.email || userId, 180);
    await supabaseFetch("/rest/v1/audit_events", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        actor_user_id: admin.actor.id,
        actor_email: admin.actor.email,
        actor_name: admin.actor.name,
        action: "portal_password_reset",
        entity_type: "portal_user",
        entity_id: userId,
        summary: `${targetName} portal password reset by ${admin.actor.name}`,
        before_data: { must_change_password: true },
        after_data: { must_change_password: false }
      })
    });

    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || "Password could not be reset." });
  }
};
