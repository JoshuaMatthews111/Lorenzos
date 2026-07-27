const SUPABASE_URL = process.env.SUPABASE_URL || "https://ptnzaeprvkgjgtupmcty.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";

function cors(response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  return response;
}

function clean(value, maxLength = 5000) {
  return String(value || "").trim().slice(0, maxLength);
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function decodeDataUrl(dataUrl) {
  const marker = ";base64,";
  if (!dataUrl || !String(dataUrl).startsWith("data:") || !String(dataUrl).includes(marker)) return null;
  return Buffer.from(String(dataUrl).split(marker)[1] || "", "base64");
}

async function uploadSubmissionFile(trainerId, file) {
  if (!file?.data_url) return "";
  const bytes = decodeDataUrl(file.data_url);
  if (!bytes?.length) return "";
  if (bytes.length > 25 * 1024 * 1024) throw new Error("Upload file exceeds the 25 MB review form limit.");
  const contentType = clean(file.type || "application/octet-stream", 120);
  const originalName = clean(file.name || "review-upload", 180);
  const safeName = originalName.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "review-upload";
  const folder = trainerId || "public";
  const path = `${folder}/${Date.now()}-${safeName}`;
  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/trainer-submissions/${path}`, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": contentType,
      "x-upsert": "false"
    },
    body: bytes
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Storage upload failed: ${response.status} ${text}`);
  return path;
}

async function findTrainerId(payload) {
  const slug = clean(payload.trainer_slug, 160);
  if (!slug) return null;
  const response = await fetch(`${SUPABASE_URL}/rest/v1/trainers?select=id&slug=eq.${encodeURIComponent(slug)}&limit=1`, {
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`
    }
  });
  if (!response.ok) return null;
  const rows = await response.json();
  return rows?.[0]?.id || null;
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, message: "Method not allowed" });
  if (!SERVICE_ROLE_KEY) {
    return res.status(500).json({ ok: false, message: "Supabase service role key is not configured on Vercel." });
  }

  try {
    const payload = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const reviewerName = clean(payload.reviewer_name, 120);
    const reviewerEmail = clean(payload.reviewer_email, 254).toLowerCase();
    const reviewText = clean(payload.review_text, 5000);
    const trainerName = clean(payload.trainer_name, 160);
    const trainerSlug = clean(payload.trainer_slug, 160);
    const permission = clean(payload.permission_to_share, 80);
    const reviewerLocation = clean(payload.client_location || payload.reviewer_location, 160);
    const starRating = clean(payload.star_rating || payload.rating || "5", 10);
    const sourcePage = clean(payload.source_page || payload.page_url || "trainer landing page", 500);
    const file = payload.file || null;

    if (!reviewerName || !reviewerEmail || !reviewText || !trainerSlug) {
      return res.status(400).json({ ok: false, message: "Missing required review fields." });
    }
    if (!validEmail(reviewerEmail)) {
      return res.status(400).json({ ok: false, message: "Invalid reviewer email." });
    }

    const trainerId = await findTrainerId({ trainer_slug: trainerSlug });
    const fileUrl = await uploadSubmissionFile(trainerId, file);
    const attachedLine = file?.name
      ? `Attached file noted: ${clean(file.name, 180)} (${clean(file.type || "unknown type", 80)}).`
      : "";

    const insertPayload = {
      trainer_id: trainerId,
      submission_type: "review",
      title: `Website review from ${reviewerName}`,
      file_url: fileUrl || null,
      notes: [
        `Public landing page review submission for ${trainerName || trainerSlug}.`,
        `Submitted from: ${sourcePage}.`,
        `Reviewer: ${reviewerName} <${reviewerEmail}>.`,
        `Star rating: ${/^[1-5]$/.test(starRating) ? starRating : "5"}.`,
        reviewerLocation ? `Client location: ${reviewerLocation}.` : "",
        `Permission to share: ${permission || "not confirmed"}.`,
        attachedLine,
        `Review: ${reviewText}`
      ].filter(Boolean).join("\n"),
      status: "pending",
      office_notes: null
    };

    const response = await fetch(`${SUPABASE_URL}/rest/v1/content_submissions?select=id`, {
      method: "POST",
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation"
      },
      body: JSON.stringify(insertPayload)
    });

    const text = await response.text();
    if (!response.ok) {
      return res.status(response.status).json({ ok: false, message: text || "Supabase insert failed" });
    }
    const rows = text ? JSON.parse(text) : [];
    return res.status(200).json({ ok: true, submission_id: rows?.[0]?.id || null });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || "Review submission failed" });
  }
};
