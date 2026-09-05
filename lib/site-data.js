// Live data the Site Builder blocks can pull in: approved reviews (Reviews
// block, source "approved") and published trainers (Trainer strip). Read-only.
// Every read goes through lib/sandbox.js supabaseRequest(), so on the practice
// copy this reads practice.*. `deps.fetch` is swappable for tests and the local
// proof server (api/pages.js points it at its own).
const { supabaseRequest } = require("./sandbox");
const SUPABASE_URL = process.env.SUPABASE_URL || "https://ptnzaeprvkgjgtupmcty.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";
const deps = { fetch: (...args) => fetch(...args) };
async function fetchRows(path) {
  const target = supabaseRequest(path);
  const response = await deps.fetch(`${SUPABASE_URL}${target.path}`, { headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, ...target.headers } });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (!response.ok) throw new Error(data?.message || `Supabase ${response.status}`);
  return data;
}
const clean = (value, max = 5000) => String(value || "").trim().slice(0, max);
const reviewText = notes => { const marker = "\nReview: "; return notes.includes(marker) ? notes.slice(notes.indexOf(marker) + marker.length).trim() : notes.trim(); };
const reviewer = row => { const titleName = clean(row.title).replace(/^Website review from\s+/i, "").trim(); const notesName = clean(row.notes).match(/Reviewer:\s*([^\n<]+?)(?:\s*<[^>]+>)?\./i)?.[1]?.trim(); return titleName || notesName || "Verified Client"; };
const missingRelation = error => /relation .* does not exist|could not find the table|schema cache|42p01/i.test(String(error?.message || error || ""));

async function loadReviews(destinationId = "lorenzos-team", destinationType = "homepage") {
  try {
    let ids = [];
    try {
      const pubs = await fetchRows(`/rest/v1/review_publications?select=submission_id&destination_type=eq.${encodeURIComponent(destinationType)}&destination_id=eq.${encodeURIComponent(destinationId)}&status=eq.published&order=published_at.desc&limit=50`);
      ids = (Array.isArray(pubs) ? pubs : []).map(p => p.submission_id).filter(Boolean);
    } catch (error) { if (!missingRelation(error)) throw error; }
    const filter = ids.length ? `&id=in.(${ids.map(encodeURIComponent).join(",")})` : "";
    const rows = await fetchRows(`/rest/v1/content_submissions?select=id,trainer_id,title,notes,created_at&submission_type=in.(review,testimonial)&status=eq.approved${filter}&order=created_at.desc&limit=50`);
    return (Array.isArray(rows) ? rows : [])
      .filter(row => ids.length ? ids.includes(row.id) : (!row.trainer_id || /homepage review form|lorenzos-team/i.test(clean(row.notes))))
      .slice(0, 12)
      .map(row => { const notes = clean(row.notes); return { id: row.id, reviewer: reviewer(row), review_text: reviewText(notes), location: notes.match(/Client location:\s*([^\n.]+)\.?/i)?.[1]?.trim() || "", rating: notes.match(/Star rating:\s*([1-5])/i)?.[1] || "5" }; });
  } catch (error) {
    return [];
  }
}

// Published trainers only (a trainer strip must never show someone without a live page).
async function loadTrainers() {
  try {
    const [trainers, pages] = await Promise.all([
      fetchRows("/rest/v1/trainers?select=id,slug,full_name,market,state,service_area,headshot_url,status&status=eq.active&order=full_name.asc&limit=200"),
      fetchRows("/rest/v1/trainer_pages?select=trainer_id,slug,page_status,published_revision&page_status=eq.published&limit=300")
    ]);
    const live = new Map();
    (Array.isArray(pages) ? pages : []).forEach(p => { if (Number(p.published_revision || 0) >= 1) live.set(p.trainer_id, p.slug); });
    return (Array.isArray(trainers) ? trainers : []).filter(t => live.has(t.id)).map(t => ({ id: t.id, slug: t.slug, page_slug: live.get(t.id) || t.slug, full_name: t.full_name, market: t.market || "", state: t.state || "", service_area: t.service_area || "", headshot_url: /^https:\/\//.test(String(t.headshot_url || "")) ? t.headshot_url : "" }));
  } catch (error) {
    return [];
  }
}

module.exports = { loadReviews, loadTrainers, deps };
