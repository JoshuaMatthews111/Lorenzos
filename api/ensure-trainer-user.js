const SUPABASE_URL = process.env.SUPABASE_URL || "https://ptnzaeprvkgjgtupmcty.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";
const TRAINER_TEMP_PASSWORD = process.env.LDTT_TRAINER_TEMP_PASSWORD || "doglovers26";

function cors(response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return response;
}

function clean(value, maxLength = 500) {
  return String(value || "").trim().slice(0, maxLength);
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
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

async function verifyAdmin(accessToken) {
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
  const rows = await supabaseFetch(`/rest/v1/portal_users?select=user_id,role,active&user_id=eq.${encodeURIComponent(user.id)}&role=eq.admin&active=eq.true&limit=1`);
  return rows?.[0] ? user : null;
}

async function findAuthUserByEmail(email) {
  const normalized = email.toLowerCase();
  let page = 1;
  while (page <= 20) {
    const data = await supabaseFetch(`/auth/v1/admin/users?page=${page}&per_page=100`);
    const users = data?.users || [];
    const match = users.find(user => String(user.email || "").toLowerCase() === normalized);
    if (match) return match;
    if (!users.length || users.length < 100) return null;
    page += 1;
  }
  return null;
}

async function createOrEnableAuthUser(email, displayName) {
  const existing = await findAuthUserByEmail(email);
  if (existing?.id) {
    if (!existing.email_confirmed_at) {
      await supabaseFetch(`/auth/v1/admin/users/${existing.id}`, {
        method: "PUT",
        body: JSON.stringify({
          email_confirm: true,
          user_metadata: { display_name: displayName, portal_role: "trainer" }
        })
      });
    }
    return { userId: existing.id, created: false };
  }
  const created = await supabaseFetch("/auth/v1/admin/users", {
    method: "POST",
    body: JSON.stringify({
      email,
      password: TRAINER_TEMP_PASSWORD,
      email_confirm: true,
      user_metadata: { display_name: displayName, portal_role: "trainer" }
    })
  });
  return { userId: created?.id, created: true };
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, message: "Method not allowed" });
  if (!SERVICE_ROLE_KEY) return res.status(500).json({ ok: false, message: "Supabase service role key is not configured on Vercel." });

  try {
    const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    const admin = await verifyAdmin(token);
    if (!admin) return res.status(403).json({ ok: false, message: "Active admin access required." });

    const payload = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const trainerId = clean(payload.trainer_id, 80);
    const email = clean(payload.email, 254).toLowerCase();
    const displayName = clean(payload.display_name, 180) || "Lorenzo Trainer";
    if (!trainerId) return res.status(400).json({ ok: false, message: "Trainer ID is required." });
    if (!validEmail(email)) return res.status(400).json({ ok: false, message: "A valid trainer email is required before portal access can be created." });

    const trainers = await supabaseFetch(`/rest/v1/trainers?select=id,auth_user_id&status=neq.deleted&id=eq.${encodeURIComponent(trainerId)}&limit=1`);
    if (!trainers?.[0]) return res.status(404).json({ ok: false, message: "Trainer record was not found." });

    const authResult = trainers[0].auth_user_id
      ? { userId: trainers[0].auth_user_id, created: false }
      : await createOrEnableAuthUser(email, displayName);
    if (!authResult.userId) throw new Error("Trainer auth user could not be created.");

    await supabaseFetch(`/rest/v1/trainers?id=eq.${encodeURIComponent(trainerId)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        auth_user_id: authResult.userId,
        email,
        access_status: "active",
        status: "active"
      })
    });

    await supabaseFetch("/rest/v1/portal_users?on_conflict=user_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({
        user_id: authResult.userId,
        role: "trainer",
        trainer_id: trainerId,
        display_name: displayName,
        active: true,
        must_change_password: authResult.created
      })
    });

    return res.status(200).json({
      ok: true,
      trainer_id: trainerId,
      email,
      user_id: authResult.userId,
      created: authResult.created,
      temporary_password: authResult.created ? TRAINER_TEMP_PASSWORD : ""
    });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || "Trainer portal access could not be prepared." });
  }
};
