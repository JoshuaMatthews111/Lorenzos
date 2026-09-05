// One place decides who a portal bearer token belongs to and what they may do.
//
// Every API under api/ used to carry its own copy of this check (eleven of
// them), and the copies drifted: some skipped access_status, some let an admin
// row with NO permission_level through as a super admin, one read user.id off
// a failed auth answer. This module is the single verifier; the APIs only say
// which role they need and what to answer when refused.
//
// Rules (DO-NOT-BREAK 4, 7, 8, 33):
//   - the token must resolve at /auth/v1/user and carry an id
//   - portal_users must hold an ACTIVE row for that user_id (active = true),
//     read through lib/sandbox.js supabaseRequest() so the practice copy reads
//     practice.portal_users and live reads public.portal_users
//   - access_status disabled / revoked means no access at all
//   - role admin needs permission_level EXACTLY super_admin or office_admin.
//     NULL or anything else FAILS CLOSED (no admin powers; a console.warn names
//     the user id once per request). The old `permission_level || "super_admin"`
//     fallback quietly promoted such rows to super admin.
//   - role trainer needs a trainer_id
//   - any other role is refused
//
// The three sandbox testing logins are refused on LIVE by authorizeRequest()
// (lib/sandbox.js blockedOutsideSandbox), AFTER the role check, so the answer
// for them is the existing sandboxOnlyLogin 403.
//
// Supabase is reached through `fetchImpl` when given, otherwise the global
// fetch read AT CALL TIME (tests replace globalThis.fetch; api/pages.js,
// api/send-to-live.js and api/practice-reset.js hand in their deps.fetch).
const { supabaseRequest, blockedOutsideSandbox } = require("./sandbox");

const DEFAULT_SUPABASE_URL = "https://ptnzaeprvkgjgtupmcty.supabase.co";
const ADMIN_LEVELS = new Set(["super_admin", "office_admin"]);
const NO_ACCESS = new Set(["disabled", "revoked"]);
const REQUIREMENTS = new Set(["any", "admin", "super", "trainer"]);

function clean(value, maxLength = 500) {
  return String(value || "").trim().slice(0, maxLength);
}

function isMissingColumnError(error) {
  return /column .* does not exist|could not find the .* column|schema cache|42703/i.test(String(error?.message || error || ""));
}

function settings(options = {}) {
  return {
    fetchImpl: options.fetchImpl || ((...args) => globalThis.fetch(...args)),
    supabaseUrl: options.supabaseUrl || process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL,
    serviceRoleKey: options.serviceRoleKey || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || ""
  };
}

// Service-role read on the schema switch. Same shape as the supabaseFetch
// helpers in api/*.js so the fake Supabase in tests sees identical requests.
async function serviceRead({ fetchImpl, supabaseUrl, serviceRoleKey }, path) {
  const target = supabaseRequest(path);
  const response = await fetchImpl(`${supabaseUrl}${target.path}`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      ...target.headers
    }
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) {
    const message = data?.msg || data?.message || data?.error_description || data?.error || text || `Supabase request failed (${response.status})`;
    throw Object.assign(new Error(message), { status: response.status });
  }
  return data;
}

async function loadPortalUser(config, userId) {
  const encoded = encodeURIComponent(userId);
  let rows;
  try {
    rows = await serviceRead(config, `/rest/v1/portal_users?select=*&user_id=eq.${encoded}&active=eq.true&limit=1`);
  } catch (error) {
    // Older copies of the table without permission_level / access_status.
    if (!isMissingColumnError(error)) throw error;
    rows = await serviceRead(config, `/rest/v1/portal_users?select=user_id,role,trainer_id,active&user_id=eq.${encoded}&active=eq.true&limit=1`);
  }
  return Array.isArray(rows) ? rows[0] || null : null;
}

function actorFor(user, portalUser) {
  const fullName = [portalUser.first_name, portalUser.last_name].filter(Boolean).join(" ");
  return {
    id: user.id,
    email: clean(portalUser.email || user.email, 254),
    name: clean(portalUser.display_name || fullName || user.email, 180)
  };
}

// Resolves a bearer token to a portal user, or null when refused.
//
//   require: "any"     admin or trainer (default)
//            "admin"   super_admin or office_admin
//            "super"   super_admin only
//            "trainer" role trainer (always carries a trainer_id)
//
// Result: { user, portalUser, role, isAdmin, isSuperAdmin, trainerId, actor }
//   role is "super_admin" | "office_admin" | "trainer".
async function verifyPortalUser(accessToken, options = {}) {
  const require = options.require || "any";
  if (!REQUIREMENTS.has(require)) throw new Error(`portal-auth: unknown requirement "${require}"`);
  const token = clean(accessToken, 4096);
  if (!token) return null;
  const config = settings(options);

  const userResponse = await config.fetchImpl(`${config.supabaseUrl}/auth/v1/user`, {
    headers: { apikey: config.serviceRoleKey, Authorization: `Bearer ${token}` }
  });
  if (!userResponse?.ok) return null;
  let user = null;
  try { user = await userResponse.json(); } catch { user = null; }
  if (!user || typeof user !== "object" || !user.id) return null;

  const portalUser = await loadPortalUser(config, user.id);
  if (!portalUser) return null;
  if (NO_ACCESS.has(String(portalUser.access_status || "active").trim().toLowerCase())) return null;

  let role;
  if (portalUser.role === "admin") {
    const level = String(portalUser.permission_level ?? "").trim();
    if (!ADMIN_LEVELS.has(level)) {
      // Fail closed. An admin row without a recognised permission level gets
      // nothing, and the office can see why in the function logs.
      console.warn(`portal-auth: admin portal user ${user.id} has permission_level ${JSON.stringify(portalUser.permission_level ?? null)}; refusing (needs super_admin or office_admin)`);
      return null;
    }
    role = level;
  } else if (portalUser.role === "trainer") {
    if (!portalUser.trainer_id) return null;
    role = "trainer";
  } else {
    return null;
  }

  const isSuperAdmin = role === "super_admin";
  const isAdmin = isSuperAdmin || role === "office_admin";
  if (require === "admin" && !isAdmin) return null;
  if (require === "super" && !isSuperAdmin) return null;
  if (require === "trainer" && role !== "trainer") return null;

  return {
    user,
    portalUser,
    role,
    isAdmin,
    isSuperAdmin,
    trainerId: role === "trainer" ? portalUser.trainer_id : (portalUser.trainer_id || null),
    actor: actorFor(user, portalUser)
  };
}

function bearerToken(req) {
  return clean(req?.headers?.authorization || "", 4200).replace(/^Bearer\s+/i, "");
}

// Reads the bearer token off the request, verifies it, and answers the
// response itself when refused. Returns the verified result or null.
//
//   status / message   what a refused caller gets (each API keeps the status
//                      code and sentence its browser code already expects)
//   body               extra fields merged into the refusal JSON
//
// Order matters and is the fix for the old manage-portal-user ordering bug:
// the null check comes first, THEN the sandbox-only-login refusal, so a
// missing or wrong-role token never reaches blockedOutsideSandbox.
async function authorizeRequest(req, res, options = {}) {
  const { status = 403, message = "Active portal access required.", body = {}, ...verifyOptions } = options;
  const result = await verifyPortalUser(bearerToken(req), verifyOptions);
  if (!result) {
    res.status(status).json({ ok: false, message, ...body });
    return null;
  }
  if (refusedSandboxOnlyLogin(res, result)) return null;
  return result;
}

// DO-NOT-BREAK 33: the three practice-copy testing logins only work on the
// practice copy. Answers the request (403 sandboxOnlyLogin) and returns true
// when a verified result belongs to one of them on live. Checked on both the
// portal row email and the auth email.
function refusedSandboxOnlyLogin(res, result) {
  if (!result) return false;
  return blockedOutsideSandbox(res, result.actor?.email) || blockedOutsideSandbox(res, result.user?.email);
}

module.exports = {
  verifyPortalUser,
  authorizeRequest,
  refusedSandboxOnlyLogin,
  bearerToken,
  isMissingColumnError,
  ADMIN_LEVELS,
  NO_ACCESS
};
