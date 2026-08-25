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
  return `${action} was not saved. This is the sandbox — it shows the real live records so you can judge the layout and the numbers, but it is not allowed to change anything. Do it on the live portal when you are happy.`;
}

// Returns true (and answers the request) when the call must not proceed.
function blockedInSandbox(res, action) {
  if (!isSandbox()) return false;
  // 423 Locked, not 200: the portal's own client only treats a non-2xx as a
  // failure, so a 200 here would look to the office like the change had saved.
  res.status(423).json({ ok: false, sandbox: true, message: sandboxMessage(action) });
  return true;
}

module.exports = { isSandbox, sandboxMessage, blockedInSandbox };
