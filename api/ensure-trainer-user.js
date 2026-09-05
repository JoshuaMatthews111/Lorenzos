const { isSandbox, supabaseRequest } = require("../lib/sandbox");
const { authorizeRequest } = require("../lib/portal-auth");
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
  // Practice copy: schema profile headers / practice-* bucket (lib/sandbox.js).
  const target = supabaseRequest(path, options.headers || {});
  const response = await fetch(`${SUPABASE_URL}${target.path}`, {
    ...options,
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      ...target.headers
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
    // Office staff only (lib/portal-auth.js): super_admin or office_admin,
    // active, access_status not disabled/revoked. This endpoint used to accept
    // any role=admin row, whatever its permission_level or access_status.
    const admin = await authorizeRequest(req, res, { require: "admin", message: "Active admin access required." });
    if (!admin) return;

    const payload = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const trainerId = clean(payload.trainer_id, 80);
    const email = clean(payload.email, 254).toLowerCase();
    const displayName = clean(payload.display_name, 180) || "Lorenzo Trainer";
    if (!trainerId) return res.status(400).json({ ok: false, message: "Trainer ID is required." });
    if (!validEmail(email)) return res.status(400).json({ ok: false, message: "A valid trainer email is required before portal access can be created." });

    const trainers = await supabaseFetch(`/rest/v1/trainers?select=id,auth_user_id&status=neq.deleted&id=eq.${encodeURIComponent(trainerId)}&limit=1`);
    if (!trainers?.[0]) return res.status(404).json({ ok: false, message: "Trainer record was not found." });

    // Practice copy: the trainer row and the practice portal_users row are
    // written like on live, but NO auth user is ever created or changed here —
    // logins are shared with live, so a practice trainer login would be a real
    // login. If this email already has a login (the office testing one, or a
    // real trainer's), the practice portal row points at it and they can sign
    // in to the practice copy with the password they already have. Otherwise
    // the trainer is enabled without a login and the office is told so.
    const authResult = trainers[0].auth_user_id
      ? { userId: trainers[0].auth_user_id, created: false }
      : isSandbox()
        ? await findAuthUserByEmail(email).then(user => ({ userId: user?.id || null, created: false, practiceNoLogin: !user?.id }))
        : await createOrEnableAuthUser(email, displayName);
    if (!authResult.userId && !isSandbox()) throw new Error("Trainer auth user could not be created.");

    // onboarding: if that email already signs in as STAFF, stop. The upsert below
    // would have turned the staff member's portal row into a trainer row (role,
    // trainer_id) and locked them out of the office portal — on live too.
    if (authResult.userId && !trainers[0].auth_user_id) {
      const existingRows = await supabaseFetch(`/rest/v1/portal_users?select=user_id,role,trainer_id,display_name&user_id=eq.${encodeURIComponent(authResult.userId)}&limit=1`);
      const existing = existingRows?.[0];
      if (existing && existing.role === "admin") {
        return res.status(409).json({ ok: false, staffLogin: true, message: `${email} is a staff login (${existing.display_name || "office"}), not a trainer. Give the trainer their own email, then publish again.` });
      }
      if (existing && existing.role === "trainer" && existing.trainer_id && String(existing.trainer_id) !== String(trainerId)) {
        return res.status(409).json({ ok: false, message: `${email} already belongs to another trainer's login. Each trainer needs their own email.` });
      }
    }

    // onboarding: hand back the row's new version/updated_at so the portal's next
    // save (the publish itself) does not trip its own "updated by another staff
    // member" check.
    const updatedTrainers = await supabaseFetch(`/rest/v1/trainers?id=eq.${encodeURIComponent(trainerId)}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        ...(authResult.userId ? { auth_user_id: authResult.userId } : {}),
        email,
        access_status: "active",
        status: "active"
      })
    });
    const updatedTrainer = updatedTrainers?.[0] || null;

    if (authResult.userId) await supabaseFetch("/rest/v1/portal_users?on_conflict=user_id", {
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
      sandbox: isSandbox(),
      trainer_id: trainerId,
      email,
      user_id: authResult.userId,
      created: authResult.created,
      trainer: updatedTrainer ? { version: updatedTrainer.version || null, updated_at: updatedTrainer.updated_at || null } : null,
      temporary_password: authResult.created ? TRAINER_TEMP_PASSWORD : "",
      ...(isSandbox() ? { message: authResult.practiceNoLogin
        ? "Practice copy: the trainer is enabled and their page can be published here, but no login was created — logins are real and shared with live. Create the login on the live portal when the trainer is real."
        : "Practice copy: the trainer is enabled here and can sign in to the practice copy with the password that email already has. No login was created or changed." } : {})
    });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || "Trainer portal access could not be prepared." });
  }
};
