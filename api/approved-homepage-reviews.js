const { publicObjectUrl } = require("../lib/review-public-photo");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://ptnzaeprvkgjgtupmcty.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";

// `public_file_url` is added by supabase/migrations/20260908090000_review_public_photo_copy.sql.
// Until that migration is applied the column does not exist and PostgREST rejects the
// whole select, which would empty the homepage review rail. So ask for it, and if the
// database says it is not there yet, ask again without it and carry on with signed URLs.
const SUBMISSION_COLUMNS = "id,trainer_id,title,notes,office_notes,file_url,public_file_url,photo_position,created_at";
const SUBMISSION_COLUMNS_WITHOUT_PUBLIC_COPY = "id,trainer_id,title,notes,office_notes,file_url,photo_position,created_at";

function isMissingColumnError(error) {
  return /column .* does not exist|42703|does not exist.*schema cache/i.test(String(error?.message || error || ""));
}

function cors(response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  return response;
}

function clean(value, maxLength = 5000) {
  return String(value || "").trim().slice(0, maxLength);
}

function serviceHeaders(extra = {}) {
  return {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
    ...extra
  };
}

async function supabaseFetch(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: serviceHeaders(options.headers || {})
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!response.ok) {
    const message = data?.msg || data?.message || data?.error || text || `Supabase request failed (${response.status})`;
    throw new Error(message);
  }
  return data;
}

function reviewTextFromNotes(notes) {
  const marker = "\nReview: ";
  return notes.includes(marker) ? notes.slice(notes.indexOf(marker) + marker.length).trim() : notes.trim();
}

function reviewerFromRow(row) {
  const titleName = clean(row.title).replace(/^Website review from\s+/i, "").trim();
  const notesName = clean(row.notes).match(/Reviewer:\s*([^\n<]+?)(?:\s*<[^>]+>)?\./i)?.[1]?.trim();
  return titleName || notesName || "Verified Client";
}

function mediaTypeFromRow(row) {
  const notes = clean(row.notes);
  const attachedType = notes.match(/Attached file noted:\s*[^\n(]+?\(([^)]+)\)/i)?.[1]?.trim().toLowerCase() || "";
  if (attachedType && attachedType !== "unknown type") return attachedType;
  const sourceUrl = clean(row.file_url);
  if (/Attached video link:/i.test(notes) || /(?:youtube\.com|youtu\.be|vimeo\.com|drive\.google\.com|loom\.com|dropbox\.com)/i.test(sourceUrl)) return "video/embed";
  const fileName = sourceUrl.split("?")[0].split("/").pop().toLowerCase();
  if (/\.(mp4|mov|m4v|webm)$/.test(fileName)) return `video/${fileName.split(".").pop().replace("mov", "quicktime")}`;
  if (/\.(jpg|jpeg|png|gif|webp|heic)$/.test(fileName)) return `image/${fileName.split(".").pop().replace("jpg", "jpeg")}`;
  return "";
}

function isHomepageReviewRow(row) {
  const notes = clean(row.notes);
  const officeNotes = clean(row.office_notes);
  return !row.trainer_id
    || /homepage review form|Lorenzo's Dog Training Team homepage|lorenzo's dog training team homepage|lorenzos-team/i.test(notes)
    || /\[\[review_targets:[^\]]*lorenzos-team/i.test(officeNotes);
}

function isMissingRelationError(error) {
  return /relation .* does not exist|could not find the table|schema cache|42p01/i.test(String(error?.message || error || ""));
}

// When the office approved this review, its photo was copied into the public
// `trainer-page-assets` bucket (see lib/review-public-photo.js). That copy is a plain
// public URL: no key, no expiry, cacheable. Prefer it whenever the row has one.
function publicMediaUrl(row) {
  return publicObjectUrl(clean(row?.public_file_url, 2000));
}

async function signedMediaUrl(pathOrUrl) {
  const value = clean(pathOrUrl, 2000);
  if (!value) return "";
  if (/^(data:|blob:|https?:|\/)/i.test(value)) return value;
  const encodedPath = value.split("/").map(encodeURIComponent).join("/");
  const data = await supabaseFetch(`/storage/v1/object/sign/trainer-submissions/${encodedPath}`, {
    method: "POST",
    body: JSON.stringify({ expiresIn: 60 * 60 * 12 })
  });
  const signed = data?.signedURL || data?.signedUrl || "";
  return signed.startsWith("http") ? signed : `${SUPABASE_URL}/storage/v1${signed}`;
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ ok: false, message: "Method not allowed" });
  if (!SERVICE_ROLE_KEY) return res.status(500).json({ ok: false, message: "Supabase service role key is not configured." });

  try {
    const requestedType = clean(req.query?.destination_type, 40) || "homepage";
    const destinationType = ["homepage", "trainer_page", "city_page"].includes(requestedType) ? requestedType : "homepage";
    const destinationId = clean(req.query?.destination_id, 180) || (destinationType === "homepage" ? "lorenzos-team" : "");
    if (!destinationId) return res.status(400).json({ ok: false, message: "A review destination is required." });
    let publicationIds = [];
    const publicationPublishedAt = new Map();
    try {
      const publications = await supabaseFetch(
        `/rest/v1/review_publications?select=submission_id,published_at,updated_at&destination_type=eq.${encodeURIComponent(destinationType)}&destination_id=eq.${encodeURIComponent(destinationId)}&status=eq.published&order=published_at.desc&limit=50`
      );
      publicationIds = (Array.isArray(publications) ? publications : []).map(item => {
        if (item.submission_id) publicationPublishedAt.set(item.submission_id, item.published_at || item.updated_at || "");
        return item.submission_id;
      }).filter(Boolean);
    } catch (error) {
      if (!isMissingRelationError(error)) throw error;
    }
    const filter = publicationIds.length ? `&id=in.(${publicationIds.map(encodeURIComponent).join(",")})` : "";
    const submissionQuery = columns =>
      `/rest/v1/content_submissions?select=${columns}&submission_type=in.(review,testimonial)&status=eq.approved${filter}&order=created_at.desc&limit=50`;
    let rows;
    try {
      rows = await supabaseFetch(submissionQuery(SUBMISSION_COLUMNS));
    } catch (error) {
      if (!isMissingColumnError(error)) throw error;
      rows = await supabaseFetch(submissionQuery(SUBMISSION_COLUMNS_WITHOUT_PUBLIC_COPY));
    }
    const homepageRows = (Array.isArray(rows) ? rows : [])
      .filter(row => publicationIds.length
        ? publicationIds.includes(row.id)
        : destinationType === "homepage" && isHomepageReviewRow(row))
      .sort((a, b) => new Date(publicationPublishedAt.get(b.id) || b.created_at || 0) - new Date(publicationPublishedAt.get(a.id) || a.created_at || 0))
      .slice(0, 12);

    const reviews = await Promise.all(homepageRows.map(async row => {
      const notes = clean(row.notes);
      const location = notes.match(/Client location:\s*([^\n.]+)\.?/i)?.[1]?.trim() || "";
      const rating = notes.match(/Star rating:\s*([1-5])/i)?.[1] || "5";
      return {
        id: row.id,
        reviewer: reviewerFromRow(row),
        review_text: reviewTextFromNotes(notes),
        location,
        rating,
        media_url: publicMediaUrl(row) || await signedMediaUrl(row.file_url),
        photo_position: row.photo_position || null,
        media_type: mediaTypeFromRow(row),
        published_at: publicationPublishedAt.get(row.id) || row.created_at,
        created_at: row.created_at
      };
    }));

    res.setHeader("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=600");
    return res.status(200).json({ ok: true, destination_type: destinationType, destination_id: destinationId, reviews });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || "Approved reviews could not be loaded." });
  }
};
