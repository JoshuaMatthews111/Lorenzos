// Tells the portal in the browser which deployment it is running on, so the
// practice copy can put its banner up and point its direct Supabase calls at
// the practice schema and buckets. Read-only and public: it reveals nothing
// but the deployment kind and the schema name.
const { isSandbox, dbSchema } = require("../lib/sandbox");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  return res.status(200).json({
    ok: true,
    sandbox: isSandbox(),
    schema: dbSchema(),
    bucketPrefix: isSandbox() ? "practice-" : "",
    label: isSandbox() ? "PRACTICE COPY" : "LIVE"
  });
};
