// Sandbox guard.
//
// The sandbox deployment runs the SAME code against the SAME live Supabase
// project, because the office needs their real logins and their real leads in
// front of them to judge whether a change is right. What they must NOT be able
// to do from the sandbox is change anything: no saved records, no reset
// passwords, no sent email or texts, no new leads.
//
// So every handler that writes, sends, or charges anything calls
// blockedInSandbox(res) as its first line. Reading is untouched.
//
// Turned on by setting LDTT_SANDBOX=1 on the sandbox deployment only. The live
// deployment does not set it, so live behaviour is byte-for-byte unchanged.
function isSandbox() {
  return String(process.env.LDTT_SANDBOX || "").trim() === "1";
}

function sandboxMessage(action = "That change") {
  return `${action} is blocked here, so nothing was saved. This is the sandbox: it shows the real live records so you can judge the layout and the numbers, but it is not allowed to change any of them. Do it on the live portal once you are happy.`;
}

// Returns true (and answers the request) when the call must not proceed.
function blockedInSandbox(res, action) {
  if (!isSandbox()) return false;
  // 423 Locked, not 200: the portal's own client only treats a non-2xx as a
  // failure, so a 200 here would look to the office like the change had saved.
  res.status(423).json({ ok: false, sandbox: true, message: sandboxMessage(action) });
  return true;
}

// The three testing logins. They sit in the same Supabase project as the real
// staff accounts, so they cannot be kept out of the live database — the sandbox
// needs that database to show real records. They are refused on live instead:
// the portal turns them away at the login box, and this turns them away at the
// API, so a saved token or a direct call gets nowhere either.
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
    message: "That is a sandbox testing login. It only works on the practice copy. On the live portal, sign in with your own email and password."
  });
  return true;
}

module.exports = { isSandbox, sandboxMessage, blockedInSandbox, isSandboxOnlyLogin, blockedOutsideSandbox };
