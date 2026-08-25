// Tells the portal in the browser which deployment it is running on, so the
// sandbox can put a banner up and refuse writes before they are even attempted.
// Read-only and public: it reveals nothing but a boolean.
const { isSandbox } = require("../lib/sandbox");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  return res.status(200).json({
    ok: true,
    sandbox: isSandbox(),
    label: isSandbox() ? "SANDBOX" : "LIVE"
  });
};
