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

function isMissingColumnError(error) {
  return /column .* does not exist|could not find the .* column|schema cache|42703/i.test(String(error?.message || error || ""));
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
  let rows;
  try {
    rows = await supabaseFetch(
      `/rest/v1/portal_users?select=user_id,role,permission_level,active,access_status,email,display_name,first_name,last_name&user_id=eq.${encodeURIComponent(user.id)}&role=eq.admin&permission_level=eq.super_admin&active=eq.true&access_status=eq.active&limit=1`
    );
  } catch (error) {
    if (!isMissingColumnError(error)) throw error;
    rows = await supabaseFetch(
      `/rest/v1/portal_users?select=user_id,role,active&user_id=eq.${encodeURIComponent(user.id)}&role=eq.admin&active=eq.true&limit=1`
    );
  }
  const portalUser = rows?.[0];
  if (!portalUser) return null;
  return {
    user,
    portalUser,
    actor: {
      id: user.id,
      email: clean(portalUser.email || user.email, 254),
      name: clean([portalUser.first_name, portalUser.last_name].filter(Boolean).join(" ") || portalUser.display_name || user.email, 180)
    }
  };
}

async function auditPortalChange(admin, action, target, updated, summary) {
  await supabaseFetch("/rest/v1/audit_events", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      actor_user_id: admin.actor.id,
      actor_email: admin.actor.email,
      actor_name: admin.actor.name,
      action,
      entity_type: "portal_user",
      entity_id: String(target.user_id),
      summary,
      before_data: target,
      after_data: updated
    })
  });
}

async function findAuthUserByEmail(email) {
  const normalized = String(email || "").toLowerCase();
  if (!normalized) return null;
  for (let page = 1; page <= 20; page += 1) {
    const result = await supabaseFetch(`/auth/v1/admin/users?page=${page}&per_page=100`);
    const users = result?.users || [];
    const match = users.find(user => String(user.email || "").toLowerCase() === normalized);
    if (match) return match;
    if (users.length < 100) break;
  }
  return null;
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, message: "Method not allowed" });
  if (!SERVICE_ROLE_KEY) return res.status(500).json({ ok: false, message: "Supabase service role key is not configured on Vercel." });

  try {
    const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    const admin = await verifySuperAdmin(token);
    if (!admin) return res.status(403).json({ ok: false, message: "Active Super Admin access required." });

    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};

    // Create a brand-new staff login. Supabase's admin API is used deliberately:
    // it builds the identity records a login needs, which writing the tables by
    // hand does not, and that is why hand-made accounts cannot sign in.
    if (clean(body.action, 40) === "create-account") {
      const newEmail = clean(body.email, 254).toLowerCase();
      const password = String(body.password || "");
      const permission = ["super_admin", "office_admin", "trainer"].includes(clean(body.permission_level, 40))
        ? clean(body.permission_level, 40) : "office_admin";
      const firstName = clean(body.first_name, 80);
      const lastName = clean(body.last_name, 80);
      if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(newEmail)) {
        return res.status(400).json({ ok: false, message: "Enter a valid email address for the new account." });
      }
      if (password.length < 10) {
        return res.status(400).json({ ok: false, message: "The password must be at least 10 characters." });
      }
      const existing = await findAuthUserByEmail(newEmail);
      if (existing?.id) {
        return res.status(409).json({ ok: false, message: "That email already has a login. Use Reset Password instead." });
      }
      const created = await supabaseFetch("/auth/v1/admin/users", {
        method: "POST",
        body: JSON.stringify({
          email: newEmail,
          password,
          email_confirm: true,
          user_metadata: { first_name: firstName, last_name: lastName }
        })
      });
      if (!created?.id) throw new Error("The login could not be created.");
      const profile = await supabaseFetch("/rest/v1/portal_users", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          user_id: created.id,
          email: newEmail,
          role: permission === "trainer" ? "trainer" : "admin",
          permission_level: permission,
          trainer_id: body.trainer_id || null,
          first_name: firstName || null,
          last_name: lastName || null,
          display_name: [firstName, lastName].filter(Boolean).join(" ") || newEmail,
          active: true,
          access_status: "active",
          must_change_password: body.must_change_password !== false
        })
      });
      await auditPortalChange(admin, "portal_account_created", { user_id: created.id }, profile?.[0] || null,
        `${admin.actor.name || admin.actor.email} created a ${permission.replace("_", " ")} login for ${newEmail}.`).catch(() => {});
      return res.status(200).json({ ok: true, created: true, user: profile?.[0] || null, email: newEmail });
    }

    let userId = clean(body.user_id, 120);
    const targetEmail = clean(body.email, 254).toLowerCase();
    const action = clean(body.action, 40);
    if (!userId || /^(staff-directory|trainer-record)-/.test(userId)) {
      const authUser = await findAuthUserByEmail(targetEmail);
      userId = authUser?.id || "";
    }
    if (!userId) return res.status(404).json({ ok: false, message: "No live login account was found for this email." });

    let rows = await supabaseFetch(`/rest/v1/portal_users?select=*&user_id=eq.${encodeURIComponent(userId)}&limit=1`);
    let target = rows?.[0];
    if (!target) {
      const permission = clean(body.permission_level, 40) || "office_admin";
      const role = permission === "trainer" ? "trainer" : "admin";
      const inserted = await supabaseFetch("/rest/v1/portal_users", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          user_id: userId,
          role,
          trainer_id: body.trainer_id || null,
          display_name: clean(body.display_name, 180) || targetEmail || "Staff profile incomplete",
          active: action === "restore"
        })
      });
      target = inserted?.[0];
    }
    if (!target) return res.status(404).json({ ok: false, message: "Portal user was not found." });

    let changes = {};
    if (["restore", "disable", "revoke"].includes(action)) {
      changes = action === "restore"
        ? { active: true, access_status: "active", disabled_at: null, disabled_by: null }
        : { active: false, access_status: action === "revoke" ? "revoked" : "disabled", disabled_at: new Date().toISOString(), disabled_by: admin.user.id };
    } else if (action === "set-role") {
      const permission = clean(body.permission_level, 40);
      if (!["super_admin", "office_admin", "trainer"].includes(permission)) {
        return res.status(400).json({ ok: false, message: "Invalid permission level." });
      }
      if (permission === "trainer" && !target.trainer_id) {
        return res.status(400).json({ ok: false, message: "Trainer access requires a linked trainer profile." });
      }
      changes = permission === "trainer"
        ? { role: "trainer", permission_level: "trainer" }
        : { role: "admin", permission_level: permission, trainer_id: null };
    } else if (action === "set-profile") {
      changes = {};
      if (body.display_name !== undefined) changes.display_name = clean(body.display_name, 180);
      if (body.profile_photo_url !== undefined) changes.profile_photo_url = clean(body.profile_photo_url, 2000);
      if (!Object.keys(changes).length) return res.status(400).json({ ok: false, message: "No profile changes supplied." });
    } else {
      return res.status(400).json({ ok: false, message: "Unsupported portal access action." });
    }

    let updated;
    try {
      updated = await supabaseFetch(`/rest/v1/portal_users?user_id=eq.${encodeURIComponent(userId)}`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(changes)
      });
    } catch (error) {
      if (!isMissingColumnError(error)) throw error;
      const legacyChanges = {};
      if (Object.prototype.hasOwnProperty.call(changes, "active")) legacyChanges.active = changes.active;
      if (Object.prototype.hasOwnProperty.call(changes, "role")) legacyChanges.role = changes.role;
      if (Object.prototype.hasOwnProperty.call(changes, "trainer_id")) legacyChanges.trainer_id = changes.trainer_id;
      if (Object.prototype.hasOwnProperty.call(changes, "display_name")) legacyChanges.display_name = changes.display_name;
      updated = await supabaseFetch(`/rest/v1/portal_users?user_id=eq.${encodeURIComponent(userId)}`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(legacyChanges)
      });
    }

    if (target.trainer_id && ["restore", "disable", "revoke"].includes(action)) {
      await supabaseFetch(`/rest/v1/trainers?id=eq.${encodeURIComponent(target.trainer_id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ access_status: action === "restore" ? "active" : "disabled" })
      });
    }

    const savedUser = updated?.[0] || { ...target, ...changes };
    const auditAction = action === "set-role"
      ? "portal_permission_updated"
      : action === "set-profile"
        ? "portal_profile_updated"
        : `portal_access_${action}d`;
    const targetLabel = clean(savedUser.display_name || savedUser.email || savedUser.user_id, 180);
    await auditPortalChange(admin, auditAction, target, savedUser, `${targetLabel} portal ${action.replaceAll("-", " ")} saved`);
    return res.status(200).json({ ok: true, user: savedUser });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || "Portal access could not be updated." });
  }
};
