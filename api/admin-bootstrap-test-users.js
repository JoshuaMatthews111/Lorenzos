// ONE-OFF ADMIN TASK — DELETE THIS FILE ONCE THE ACCOUNTS EXIST.
//
// Creates the three sandbox test logins Joshua asked for. It has to run here on
// Vercel rather than on a laptop, because SUPABASE_SERVICE_ROLE_KEY is marked
// Sensitive and `vercel env pull` returns an empty string for it.
//
// It deliberately does NOT honour the sandbox write block: these accounts live
// in the shared Supabase project and have to be real for anyone to sign in with
// them. That is the whole point of the task, and it is why this endpoint is
// guarded by its own secret and removed as soon as it has been run once.
const SUPABASE_URL = process.env.SUPABASE_URL || "https://ptnzaeprvkgjgtupmcty.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";
const BOOTSTRAP_SECRET = process.env.LDTT_BOOTSTRAP_SECRET || "";

async function sb(path, options = {}) {
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
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) throw new Error(`${response.status} ${JSON.stringify(data).slice(0, 300)}`);
  return data;
}

async function findAuthUserByEmail(email) {
  const page = await sb(`/auth/v1/admin/users?page=1&per_page=200`);
  const users = Array.isArray(page?.users) ? page.users : [];
  return users.find(user => String(user.email || "").toLowerCase() === email) || null;
}

async function upsertLogin({ email, password, role, permission, displayName, firstName, lastName, trainerId }) {
  let authUser = await findAuthUserByEmail(email);
  let created = false;
  if (authUser) {
    await sb(`/auth/v1/admin/users/${encodeURIComponent(authUser.id)}`, {
      method: "PUT",
      body: JSON.stringify({ password, email_confirm: true })
    });
  } else {
    authUser = await sb("/auth/v1/admin/users", {
      method: "POST",
      body: JSON.stringify({ email, password, email_confirm: true })
    });
    created = true;
  }

  const row = {
    user_id: authUser.id,
    email,
    display_name: displayName,
    first_name: firstName,
    last_name: lastName,
    role,
    permission_level: permission,
    active: true,
    access_status: "active",
    must_change_password: false,
    trainer_id: trainerId || null
  };
  const existing = await sb(`/rest/v1/portal_users?select=user_id&user_id=eq.${encodeURIComponent(authUser.id)}&limit=1`);
  if (existing?.length) {
    await sb(`/rest/v1/portal_users?user_id=eq.${encodeURIComponent(authUser.id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(row)
    });
  } else {
    await sb("/rest/v1/portal_users", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(row)
    });
  }
  return { email, user_id: authUser.id, created, role, permission, trainer_id: row.trainer_id };
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!BOOTSTRAP_SECRET) return res.status(404).json({ ok: false, message: "Not found." });
  if (String(req.headers["x-bootstrap-secret"] || "") !== BOOTSTRAP_SECRET) {
    return res.status(404).json({ ok: false, message: "Not found." });
  }
  if (!SERVICE_ROLE_KEY) return res.status(500).json({ ok: false, message: "Service role key missing." });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};

    if (body.action === "list_trainers") {
      const trainers = await sb("/rest/v1/trainers?select=id,full_name,slug,market,status,access_status&order=full_name.asc&limit=200");
      return res.status(200).json({ ok: true, trainers });
    }

    if (body.action !== "create") return res.status(400).json({ ok: false, message: "Unknown action." });

    const trainerId = String(body.trainer_id || "") || null;
    const results = [];
    results.push(await upsertLogin({
      email: "superadmin@lorenzosdogtrainingteam.com",
      password: body.passwords.superadmin,
      role: "admin", permission: "super_admin",
      displayName: "Sandbox Super Admin", firstName: "Sandbox", lastName: "Super Admin"
    }));
    results.push(await upsertLogin({
      email: "officeadmin@lorenzosdogtrainingteam.com",
      password: body.passwords.officeadmin,
      role: "admin", permission: "office_admin",
      displayName: "Sandbox Office Admin", firstName: "Sandbox", lastName: "Office Admin"
    }));
    results.push(await upsertLogin({
      email: "trainer@lorenzosdogtrainingteam.com",
      password: body.passwords.trainer,
      role: "trainer", permission: "trainer",
      displayName: "Sandbox Trainer", firstName: "Sandbox", lastName: "Trainer",
      trainerId
    }));
    return res.status(200).json({ ok: true, results });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
};
