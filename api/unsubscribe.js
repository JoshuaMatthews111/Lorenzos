const crypto = require("node:crypto");
const communications = require("./communications");

const { clean, getSetting, supabaseFetch } = communications.internal;

function page(res, status, title, message) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  return res.status(status).send(`<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>body{margin:0;background:#f5f8fc;color:#092852;font:18px Georgia,serif}.card{max-width:620px;margin:12vh auto;padding:44px;background:#fff;border:1px solid #d7e2ef;border-radius:20px;box-shadow:0 20px 60px #09285218}h1{margin-top:0;color:#c8102e}p{line-height:1.6}</style></head><body><main class="card"><h1>${title}</h1><p>${message}</p></main></body></html>`);
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") return page(res, 405, "Request not accepted", "This link only supports unsubscribe requests.");
  try {
    const email = clean(req.query?.email || req.body?.email, 254).toLowerCase();
    const signature = clean(req.query?.sig || req.body?.sig, 200);
    const { secret } = await getSetting("unsubscribe_secret", true);
    const expected = secret ? crypto.createHmac("sha256", secret).update(email).digest("hex") : "";
    if (!email || !expected || expected.length !== signature.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
      return page(res, 400, "This link is not valid", "Please contact Lorenzo's Dog Training Team if you need help with your email preferences.");
    }
    await supabaseFetch(`/rest/v1/clients?email=eq.${encodeURIComponent(email)}`, {
      method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ email_consent: false })
    });
    return page(res, 200, "You are unsubscribed", "You will no longer receive marketing email from Lorenzo's Dog Training Team at this address.");
  } catch (error) {
    console.error("Unsubscribe error", error);
    return page(res, 500, "We could not update your preferences", "Please contact Lorenzo's Dog Training Team for help.");
  }
};
