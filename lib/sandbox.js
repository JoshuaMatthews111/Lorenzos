// Practice copy switch.
//
// The practice deployment (LDTT_SANDBOX=1, Vercel Preview) runs the SAME code
// as live against the SAME Supabase project, so the office keeps their real
// logins. What changes is WHERE it reads and writes: schema `practice` instead
// of `public` (a full copy of every live table, function, trigger and policy —
// supabase/migrations/20260905200000_practice_schema.sql) and buckets named
// `practice-<bucket>` instead of the live buckets. Nothing done on the practice
// copy can reach a live row or a live file.
//
// One place decides the schema: dbSchema(). Every server Supabase call goes
// through supabaseRequest(), which adds the PostgREST profile headers for
// /rest/v1 paths and rewrites the bucket segment of /storage/v1 paths. The
// browser does the same in trainer-backoffice/supabase.js after asking
// /api/environment which schema it is on.
//
// Only three kinds of thing stay blocked on the practice copy, because they
// reach outside the database: sending email or texts to real people
// (api/communications.js sends, api/portal-password-reset.js), the provider
// webhooks and the form fan-out to the Google Sheet / FormSubmit
// (api/webhooks/*, api/form-delivery.js), and anything that would change a
// real login (auth admin calls, changePassword). Those still answer 423 with
// the plain message below. Everything else works, in the practice schema.
//
// The live deployment does not set LDTT_SANDBOX, so live behaviour is
// byte-for-byte unchanged: dbSchema() is "public", bucketName(x) is x, and
// supabaseRequest() returns the path and headers untouched.
function isSandbox() {
  return String(process.env.LDTT_SANDBOX || "").trim() === "1";
}

function dbSchema() {
  return isSandbox() ? "practice" : "public";
}

function bucketName(name) {
  const bucket = String(name || "");
  if (!isSandbox() || !bucket || bucket.startsWith("practice-")) return bucket;
  return `practice-${bucket}`;
}

// Storage object paths carry the bucket as a path segment. These are the
// prefixes the app uses before the bucket name.
const STORAGE_OBJECT_PREFIXES = ["upload/sign/", "public/", "sign/", "list/", "info/", "authenticated/"];
const STORAGE_BODY_BUCKET_OPS = new Set(["move", "copy"]);

function rewriteStoragePath(path) {
  const marker = "/storage/v1/object/";
  if (!path.startsWith(marker)) return path;
  const rest = path.slice(marker.length);
  const op = rest.split("/")[0].split("?")[0];
  if (STORAGE_BODY_BUCKET_OPS.has(op)) return path; // bucket is in the JSON body; callers use bucketName()
  const prefix = STORAGE_OBJECT_PREFIXES.find(candidate => rest.startsWith(candidate)) || "";
  const afterPrefix = rest.slice(prefix.length);
  const slash = afterPrefix.indexOf("/");
  const bucket = slash === -1 ? afterPrefix.split("?")[0] : afterPrefix.slice(0, slash);
  const tail = slash === -1 ? afterPrefix.slice(bucket.length) : afterPrefix.slice(slash);
  return `${marker}${prefix}${bucketName(decodeURIComponent(bucket))}${tail}`;
}

// Rewrites a Supabase REST / Storage path for the current schema and returns
// the headers to send with it. Auth paths pass straight through: logins are
// shared between live and the practice copy on purpose.
function supabaseRequest(path, headers = {}) {
  const schema = dbSchema();
  if (schema === "public") return { path, headers: { ...headers } };
  if (path.startsWith("/rest/v1/")) {
    return { path, headers: { "Accept-Profile": schema, "Content-Profile": schema, ...headers } };
  }
  if (path.startsWith("/storage/v1/object/")) {
    return { path: rewriteStoragePath(path), headers: { ...headers } };
  }
  return { path, headers: { ...headers } };
}

function sandboxMessage(action = "That action") {
  return `${action} is switched off on the practice copy, so nothing was sent. The practice copy is a full copy of live where everything else works, but it never reaches the website, real people or real logins. Do this one on the live portal.`;
}

// Returns true (and answers the request) when the call must not proceed on the
// practice copy. Only the outward-reaching handlers call this now.
function blockedInSandbox(res, action) {
  if (!isSandbox()) return false;
  // 423 Locked, not 200: the portal's own client only treats a non-2xx as a
  // failure, so a 200 here would look to the office like the send had happened.
  res.status(423).json({ ok: false, sandbox: true, message: sandboxMessage(action) });
  return true;
}

// The three testing logins. They sit in the same Supabase project as the real
// staff accounts (auth.users is shared with the practice copy), so they are
// refused on live instead: the portal turns them away at the login box, and
// this turns them away at the API, so a saved token or a direct call gets
// nowhere either.
const SANDBOX_ONLY_LOGINS = new Set([
  "superadmin@lorenzosdogtrainingteam.com",
  "officeadmin@lorenzosdogtrainingteam.com",
  "trainer@lorenzosdogtrainingteam.com"
]);

function isSandboxOnlyLogin(email) {
  return SANDBOX_ONLY_LOGINS.has(String(email || "").trim().toLowerCase());
}

// Returns true (and answers the request) when a sandbox-only login is being used
// against the live deployment.
function blockedOutsideSandbox(res, email) {
  if (isSandbox() || !isSandboxOnlyLogin(email)) return false;
  res.status(403).json({
    ok: false,
    sandboxOnlyLogin: true,
    message: "That is a practice-copy testing login. It only works on the practice copy. On the live portal, sign in with your own email and password."
  });
  return true;
}

module.exports = {
  isSandbox,
  dbSchema,
  bucketName,
  rewriteStoragePath,
  supabaseRequest,
  sandboxMessage,
  blockedInSandbox,
  isSandboxOnlyLogin,
  blockedOutsideSandbox
};
