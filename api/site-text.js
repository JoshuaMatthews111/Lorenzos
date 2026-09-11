// Website text spots (rule 61, Joshua 2026-09-11).
// The office edits the plain-text spots of the main website pages in the Page Editor.
// The code owns every other word; site-text-manifest.json (site_text_marker.py) lists
// the spots and their code text. Office text lives in site_text (draft + live).
//
//   GET  ?path=/dog-training            live text for that page (public, edge-cached 30 s)
//   GET  ?path=...&draft=1  (admin)     drafts over live, for the Page Editor preview
//   GET  ?all=1             (admin)     every row, for the Page Editor list
//   POST (admin) { operation: save_draft | discard_draft | publish | reset, page, key, value, name }
// Publish and reset need the full name (two words) and write audit_events.
// base_default = the code text the live office text was published against; a draft keeps it
// (so Undo never hides the "code changed" flag), only a publish moves it to the current code text.
// The public page only ever sets textContent, so no markup can be injected.
const { supabaseRequest } = require("../lib/sandbox");
const { authorizeRequest } = require("../lib/portal-auth");
const manifest = require("../site-text-manifest.json");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://ptnzaeprvkgjgtupmcty.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";
const MAX = 1000;

const clean = (value, max = 500) => String(value || "").trim().slice(0, max);
// Keeps line breaks (10) and printable characters (32 and up, except 127); drops other control characters.
const dropControls = text => Array.from(text).filter(ch => { const c = ch.charCodeAt(0); return c === 10 || (c >= 32 && c !== 127); }).join("");
const cleanText = value => dropControls(String(value ?? "").replace(/\r\n?/g, "\n")).replace(/[ \t]+/g, " ").trim();
const fullName = value => { const n = clean(value, 200).replace(/\s+/g, " "); return /^\S+(\s+\S+)+$/.test(n) ? n : ""; };
const rowId = (page, key) => `${page}:${key}`;

function spotFor(page, key) {
  return (manifest.pages?.[page]?.spots || []).find(spot => spot.key === key) || null;
}

function pageForPath(rawPath) {
  let path = String(rawPath || "/").split("?")[0].split("#")[0];
  try { path = decodeURIComponent(path); } catch { /* keep raw */ }
  path = path.toLowerCase().replace(/\.html$/, "").replace(/\/+$/, "");
  if (path === "" || path === "/index") path = "/";
  return Object.entries(manifest.pages || {}).find(([, page]) => page.path === path)?.[0] || null;
}

async function supabaseFetch(path, options = {}) {
  const target = supabaseRequest(path, options.headers || {});
  const response = await fetch(`${SUPABASE_URL}${target.path}`, {
    ...options,
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, "Content-Type": "application/json", ...target.headers }
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) {
    const error = new Error(data?.message || data?.error || `Supabase request failed (${response.status})`);
    error.status = response.status >= 500 ? 502 : 400;
    throw error;
  }
  return data;
}

async function audit(auth, typedName, action, page, summary, afterData) {
  await supabaseFetch("/rest/v1/audit_events", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      actor_user_id: auth.actor.id,
      actor_email: auth.actor.email,
      actor_name: clean(`${typedName} (login: ${auth.actor.name || auth.actor.email})`, 180),
      action,
      entity_type: "site_text",
      entity_id: page,
      summary: clean(summary, 1000),
      after_data: afterData || null
    })
  });
}

const liveTexts = (rows, page, draft) => {
  const texts = {};
  for (const row of rows || []) {
    if (!spotFor(page, row.key)) continue; // a spot the code removed is ignored publicly
    const value = draft ? (row.draft_value ?? row.live_value) : row.live_value;
    if (typeof value === "string" && value.trim()) texts[row.key] = value;
  }
  return texts;
};

async function handleGet(req, res, query) {
  if (query.all) {
    const auth = await authorizeRequest(req, res, { require: "admin", message: "Office access required." });
    if (!auth) return;
    const rows = await supabaseFetch("/rest/v1/site_text?select=*&order=page.asc,key.asc");
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ ok: true, rows: rows || [] });
  }
  const page = query.page ? (manifest.pages?.[query.page] ? query.page : null) : pageForPath(query.path);
  const draft = Boolean(query.draft);
  if (draft) {
    const auth = await authorizeRequest(req, res, { require: "admin", message: "Office access required to see drafts." });
    if (!auth) return;
  }
  if (!page) {
    res.setHeader("Cache-Control", "public, max-age=0, s-maxage=300");
    return res.status(200).json({ ok: true, page: null, texts: {} });
  }
  const rows = await supabaseFetch(`/rest/v1/site_text?select=key,live_value${draft ? ",draft_value" : ""}&page=eq.${encodeURIComponent(page)}`);
  res.setHeader("Cache-Control", draft ? "no-store" : "public, max-age=0, s-maxage=30, stale-while-revalidate=300");
  return res.status(200).json({ ok: true, page, texts: liveTexts(rows, page, draft) });
}

async function handlePost(req, res) {
  const auth = await authorizeRequest(req, res, { require: "admin", message: "Office access required." });
  if (!auth) return;
  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const operation = clean(body.operation, 40);
  const page = clean(body.page, 60);
  if (!manifest.pages?.[page]) return res.status(400).json({ ok: false, message: "That website page has no editable text." });
  const label = manifest.pages[page].label;
  const now = new Date().toISOString();

  if (operation === "save_draft") {
    const key = clean(body.key, 120);
    const spot = spotFor(page, key);
    if (!spot) return res.status(400).json({ ok: false, message: "That spot is set in the code and cannot be edited here." });
    const value = cleanText(body.value);
    if (!value) return res.status(400).json({ ok: false, message: "The text cannot be empty. Use Reset to code text to go back to the original words." });
    if (value.length > MAX) return res.status(400).json({ ok: false, message: `Keep it under ${MAX} characters.` });
    const [existing] = await supabaseFetch(`/rest/v1/site_text?select=*&id=eq.${encodeURIComponent(rowId(page, key))}`) || [];
    const currentLive = existing?.live_value ?? spot.text;
    const draftValue = value === currentLive ? null : value;
    if (!existing && draftValue === null) return res.status(200).json({ ok: true, unchanged: true });
    const [row] = await supabaseFetch("/rest/v1/site_text?on_conflict=id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({ id: rowId(page, key), page, key, draft_value: draftValue, base_default: existing?.base_default ?? spot.text, draft_by_name: auth.actor.name, draft_by_login: auth.actor.email, draft_at: now, updated_at: now })
    }) || [];
    return res.status(200).json({ ok: true, row });
  }

  if (operation === "discard_draft") {
    const key = clean(body.key, 120);
    const filter = key ? `id=eq.${encodeURIComponent(rowId(page, key))}` : `page=eq.${encodeURIComponent(page)}`;
    await supabaseFetch(`/rest/v1/site_text?${filter}&draft_value=not.is.null`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ draft_value: null, updated_at: now }) });
    return res.status(200).json({ ok: true });
  }

  if (operation === "publish" || operation === "reset") {
    const typed = fullName(body.name);
    if (!typed) return res.status(400).json({ ok: false, message: "Type your full name (first and last)." });
    if (operation === "reset") {
      const key = clean(body.key, 120);
      const [row] = await supabaseFetch(`/rest/v1/site_text?select=*&id=eq.${encodeURIComponent(rowId(page, key))}`) || [];
      if (!row) return res.status(200).json({ ok: true, unchanged: true });
      await supabaseFetch(`/rest/v1/site_text?id=eq.${encodeURIComponent(row.id)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ live_value: null, draft_value: null, published_by_name: typed, published_by_login: auth.actor.email, published_at: now, updated_at: now }) });
      const codeText = spotFor(page, key)?.text || row.base_default || "";
      await audit(auth, typed, "site_text_reset", page, `${typed} put a spot on the ${label} page back to the code text: "${codeText.slice(0, 80)}".`, { key, before: row.live_value, after: null });
      return res.status(200).json({ ok: true });
    }
    const rows = await supabaseFetch(`/rest/v1/site_text?select=*&page=eq.${encodeURIComponent(page)}&draft_value=not.is.null`) || [];
    const changes = [];
    for (const row of rows) {
      const spot = spotFor(page, row.key);
      if (!spot) continue; // a spot the code removed: keep the row, publish nothing to it
      const newLive = row.draft_value === spot.text ? null : row.draft_value;
      await supabaseFetch(`/rest/v1/site_text?id=eq.${encodeURIComponent(row.id)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ live_value: newLive, draft_value: null, base_default: spot.text, published_by_name: typed, published_by_login: auth.actor.email, published_at: now, updated_at: now }) });
      changes.push({ key: row.key, before: row.live_value ?? spot.text, after: newLive ?? spot.text });
    }
    if (!changes.length) return res.status(400).json({ ok: false, message: "There are no drafts on this page to publish." });
    await audit(auth, typed, "site_text_published", page, `${typed} published ${changes.length} text change${changes.length === 1 ? "" : "s"} on the ${label} page.`, { changes });
    return res.status(200).json({ ok: true, published: changes.length });
  }
  return res.status(400).json({ ok: false, message: "Unsupported website text operation." });
}

module.exports = async function handler(req, res) {
  try {
    if (!SERVICE_ROLE_KEY) return res.status(500).json({ ok: false, message: "Supabase service role key is not configured." });
    const query = req.query || Object.fromEntries(new URL(req.url || "/", "http://local").searchParams);
    if (req.method === "GET") return await handleGet(req, res, query);
    if (req.method === "POST") return await handlePost(req, res);
    return res.status(405).json({ ok: false, message: "Method not allowed" });
  } catch (error) {
    if (!error.status || error.status >= 500) console.error("site-text API error", error.message);
    return res.status(error.status || 500).json({ ok: false, message: error.message || "The website text could not be saved." });
  }
};
module.exports.pageForPath = pageForPath;
module.exports.cleanText = cleanText;
