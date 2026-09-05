// onboarding: a trainer saves the social links shown in their locked landing-page
// footer (Settings → Landing Page Social Links). This is the ONE thing a trainer
// may change on their page, and it used to go through the admin-only
// operational-mutation API, so every trainer got "Active Admin or Office Admin
// access required". Trainers are pinned to their own trainer; admins may pass
// trainer_id. Writes trainer_pages.social_* and trainers.social_links for that one
// trainer, through the schema switch (practice copy → practice.*).
const { supabaseRequest } = require("../lib/sandbox");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://ptnzaeprvkgjgtupmcty.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";
const NETWORKS = ["facebook", "instagram", "tiktok"];

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return res;
}
function clean(v, max = 500) { return String(v ?? "").trim().slice(0, max); }

// A link must be a real web address; a blank clears the network.
function cleanLink(value) {
  const text = clean(value, 400);
  if (!text) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
    if (!/^https?:$/.test(url.protocol) || !url.hostname.includes(".")) return undefined;
    return url.href;
  } catch {
    return undefined;
  }
}

async function supabaseFetch(path, options = {}) {
  // Practice copy: schema profile headers / practice-* bucket (lib/sandbox.js).
  const target = supabaseRequest(path, options.headers || {});
  const response = await fetch(`${SUPABASE_URL}${target.path}`, {
    ...options,
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, "Content-Type": "application/json", ...target.headers }
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) throw Object.assign(new Error(data?.message || `Supabase ${response.status}`), { status: response.status });
  return data;
}

async function verifyPortalUser(token) {
  if (!token) return null;
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${token}` } });
  if (!r.ok) return null;
  const user = await r.json();
  if (!user?.id) return null;
  const rows = await supabaseFetch(`/rest/v1/portal_users?select=user_id,role,permission_level,trainer_id,active,access_status&user_id=eq.${encodeURIComponent(user.id)}&active=eq.true&limit=1`);
  const pu = rows?.[0];
  if (!pu || ["disabled", "revoked"].includes(String(pu.access_status || "active"))) return null;
  const isAdmin = pu.role === "admin" && ["super_admin", "office_admin"].includes(String(pu.permission_level || "super_admin"));
  return { user, portalUser: pu, isAdmin };
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, message: "Method not allowed" });
  if (!SERVICE_ROLE_KEY) return res.status(500).json({ ok: false, message: "Supabase service role key is not configured." });
  try {
    const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    const auth = await verifyPortalUser(token);
    if (!auth) return res.status(403).json({ ok: false, message: "Sign in to the portal to save your links." });
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const trainerId = auth.isAdmin ? (clean(body.trainer_id, 60) || auth.portalUser.trainer_id) : auth.portalUser.trainer_id;
    if (!trainerId) return res.status(400).json({ ok: false, message: "This portal account is not linked to a trainer." });

    const links = {};
    for (const network of NETWORKS) {
      const value = cleanLink(body[network]);
      if (value === undefined) return res.status(400).json({ ok: false, message: `The ${network} link is not a web address. Paste the full profile link, like https://${network}.com/yourname.` });
      links[network] = value;
    }

    const trainers = await supabaseFetch(`/rest/v1/trainers?select=id,social_links&id=eq.${encodeURIComponent(trainerId)}&status=neq.archived&limit=1`);
    if (!trainers?.[0]) return res.status(404).json({ ok: false, message: "Trainer record was not found." });

    await supabaseFetch(`/rest/v1/trainers?id=eq.${encodeURIComponent(trainerId)}`, {
      method: "PATCH", headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ social_links: { ...(trainers[0].social_links || {}), ...links } })
    });
    const pages = await supabaseFetch(`/rest/v1/trainer_pages?trainer_id=eq.${encodeURIComponent(trainerId)}`, {
      method: "PATCH", headers: { Prefer: "return=representation" },
      body: JSON.stringify({ social_facebook: links.facebook, social_instagram: links.instagram, social_tiktok: links.tiktok })
    });
    return res.status(200).json({ ok: true, trainer_id: trainerId, links, page_updated_at: pages?.[0]?.updated_at || null });
  } catch (error) {
    return res.status(error.status >= 400 && error.status < 500 ? error.status : 500).json({ ok: false, message: error.message || "The links could not be saved." });
  }
};
