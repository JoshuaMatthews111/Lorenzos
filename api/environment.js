// Tells the portal in the browser which deployment it is running on, so the
// practice copy can put its banner up and point its direct Supabase calls at
// the practice schema and buckets. Read-only and public: it reveals nothing
// but the deployment kind, the schema name and the one address people should
// bookmark for this copy (so an old preview link can say "you are on an old
// copy" — trainer-backoffice/old-copy-bar.js).
const { isSandbox, dbSchema } = require("../lib/sandbox");

const LIVE_HOST = "lorenzosdogtrainingteam.com";

function practiceHost() {
  return String(process.env.LDTT_PRACTICE_HOST || "practice.lorenzosdogtrainingteam.com").trim().toLowerCase();
}

// The address this deployment should be reached at. Live: the real domain
// (www. is accepted too). Practice copy: the permanent practice host.
function canonicalHosts() {
  return isSandbox() ? [practiceHost()] : [LIVE_HOST, `www.${LIVE_HOST}`];
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  const hosts = canonicalHosts();
  return res.status(200).json({
    ok: true,
    sandbox: isSandbox(),
    schema: dbSchema(),
    bucketPrefix: isSandbox() ? "practice-" : "",
    label: isSandbox() ? "PRACTICE COPY" : "LIVE",
    canonicalHost: hosts[0],
    canonicalHosts: hosts,
    practiceHost: practiceHost(),
    liveHost: LIVE_HOST
  });
};
module.exports.practiceHost = practiceHost;
module.exports.canonicalHosts = canonicalHosts;
module.exports.LIVE_HOST = LIVE_HOST;
