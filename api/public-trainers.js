// Joshua 2026-10-09: which trainer profiles are archived (off the website). Find a Trainer and the bio pages are
// built files, so they ask this and hide the archived slugs. Public, read-only, slugs only; cached 60 s at the edge.
const { supabaseRequest, isSandbox } = require("../lib/sandbox");
const SUPABASE_URL = process.env.SUPABASE_URL || "https://ptnzaeprvkgjgtupmcty.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") { res.setHeader("Allow", "GET, OPTIONS"); return res.status(405).json({ ok: false, message: "Use GET." }); }
  try {
    const target = supabaseRequest("/rest/v1/trainers?select=slug&status=eq.archived&limit=500", {});
    const response = await fetch(`${SUPABASE_URL}${target.path}`, { headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, ...target.headers } });
    const rows = response.ok ? await response.json() : [];
    const archived = (Array.isArray(rows) ? rows : []).map(r => String(r?.slug || "").toLowerCase()).filter(s => /^[a-z0-9-]{2,80}$/.test(s));
    res.setHeader("Cache-Control", isSandbox() ? "no-store, max-age=0" : "public, max-age=0, s-maxage=60, stale-while-revalidate=600");
    return res.status(200).json({ ok: true, archived });
  } catch (error) {
    return res.status(200).json({ ok: false, archived: [] }); // the page shows everyone rather than nobody
  }
};
