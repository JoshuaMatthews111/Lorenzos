// Approved review photos, made readable by the public site.
//
// The problem this solves: a review photo is uploaded to the PRIVATE
// `trainer-submissions` bucket. That bucket has no anon read policy, so the public
// homepage and city pages can never read the file directly. Turning the bucket
// public was rejected — the same bucket also holds files belonging to ARCHIVED
// reviews, and those must never be reachable.
//
// What happens instead: when the office APPROVES a review, the server copies just
// that one review's photo into the already-public `trainer-page-assets` bucket
// (created public in supabase/migrations/20260717102756_trainer_page_asset_storage.sql)
// and stores the new object path on the review row as `public_file_url`. The public
// page then reads a plain public URL. When the review leaves the approved state the
// copy is deleted again, so nothing archived stays public.
//
// Rules this module keeps:
//   * Approving must never fail because of a photo. Every function here returns a
//     result object and never throws — a missing file, a refused type or a storage
//     outage means "no public copy", and the read API falls back to the signed URL
//     it used before this change.
//   * Re-approving the same review must not pile up copies. The destination key is
//     derived from the submission id, so a second approval overwrites the same
//     object; there is only ever one public copy per review.
//   * Only what the public bucket actually accepts is copied. `trainer-page-assets`
//     is capped at 10 MB and limited to jpeg/png/webp/gif/svg — videos, pasted video
//     links and HEIC files are left alone and keep the signed-URL path.

const SUPABASE_URL = process.env.SUPABASE_URL || "https://ptnzaeprvkgjgtupmcty.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";

const PRIVATE_BUCKET = "trainer-submissions";
const PUBLIC_BUCKET = "trainer-page-assets";
const PUBLIC_PREFIX = "review-photos";

// Both limits mirror the bucket definition in
// supabase/migrations/20260717102756_trainer_page_asset_storage.sql. Sending
// anything outside them would just be rejected by storage.
const PUBLIC_BUCKET_MAX_BYTES = 10 * 1024 * 1024;
const PUBLIC_BUCKET_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml"
]);
const EXTENSION_MIME_TYPES = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  svg: "image/svg+xml"
};

function storageHeaders(extra = {}) {
  return {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    ...extra
  };
}

function encodePath(path) {
  return String(path || "").split("/").map(encodeURIComponent).join("/");
}

// `file_url` holds a storage path for an uploaded file, but it can also hold a
// pasted video link or an absolute URL. Only a plain storage path is ours to copy.
function isStoragePath(value) {
  const path = String(value || "").trim();
  if (!path) return false;
  if (/^(data:|blob:|https?:|\/)/i.test(path)) return false;
  return true;
}

function fileExtension(path) {
  const name = String(path || "").split("?")[0].split("/").pop() || "";
  return name.includes(".") ? name.split(".").pop().toLowerCase() : "";
}

// True only for the image types the public bucket will accept.
function isPubliclyCopyablePhoto(fileUrl) {
  if (!isStoragePath(fileUrl)) return false;
  return Boolean(EXTENSION_MIME_TYPES[fileExtension(fileUrl)]);
}

// One deterministic destination per review, so a re-approval overwrites its own
// object instead of creating a second one.
function publicObjectPath(submissionId, sourcePath) {
  const id = String(submissionId || "").trim();
  if (!id) return "";
  const rawName = String(sourcePath || "").split("?")[0].split("/").pop() || "review-photo";
  const safeName = rawName
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(-120) || "review-photo";
  return `${PUBLIC_PREFIX}/${id}-${safeName}`;
}

// The public URL a browser can fetch with no key and no expiry.
function publicObjectUrl(publicPath) {
  const path = String(publicPath || "").trim();
  if (!path) return "";
  if (/^(data:|blob:|https?:)/i.test(path)) return path;
  return `${SUPABASE_URL}/storage/v1/object/public/${PUBLIC_BUCKET}/${encodePath(path)}`;
}

async function publicObjectExists(publicPath) {
  try {
    const response = await fetch(`${SUPABASE_URL}/storage/v1/object/${PUBLIC_BUCKET}/${encodePath(publicPath)}`, {
      method: "HEAD",
      headers: storageHeaders()
    });
    return response.ok;
  } catch {
    return false;
  }
}

// Copy this review's photo into the public bucket, if there is one to copy.
//
// Returns { path, changed, skipped, error }:
//   path    — the public object path to store on the row, or "" for no public copy
//   changed — true when `path` differs from `existingPublicPath` and must be saved
//   skipped — why nothing was copied, for the caller's log
// Never throws.
async function ensurePublicReviewPhoto({ submissionId, fileUrl, existingPublicPath = "" } = {}) {
  const existing = String(existingPublicPath || "").trim();
  if (!SERVICE_ROLE_KEY) return { path: existing, changed: false, skipped: "no_service_role_key" };
  if (!submissionId) return { path: existing, changed: false, skipped: "no_submission_id" };

  // A video, a pasted link or a HEIC upload: leave whatever is already recorded
  // alone and let the read API fall back to a signed URL.
  if (!isPubliclyCopyablePhoto(fileUrl)) {
    return { path: existing, changed: false, skipped: "not_a_public_bucket_photo" };
  }

  const destination = publicObjectPath(submissionId, fileUrl);
  if (!destination) return { path: existing, changed: false, skipped: "no_destination_path" };

  // Already copied and still there — a re-approval does nothing.
  if (existing === destination && await publicObjectExists(destination)) {
    return { path: destination, changed: false, skipped: "already_copied" };
  }

  try {
    const source = await fetch(`${SUPABASE_URL}/storage/v1/object/${PRIVATE_BUCKET}/${encodePath(fileUrl)}`, {
      headers: storageHeaders()
    });
    // The commonest case by far: the row points at a file that is not in the bucket.
    // Approval still succeeds, the review just shows without a photo.
    if (!source.ok) return { path: "", changed: existing !== "", skipped: `source_missing_${source.status}` };

    const bytes = Buffer.from(await source.arrayBuffer());
    if (!bytes.length) return { path: "", changed: existing !== "", skipped: "source_empty" };
    if (bytes.length > PUBLIC_BUCKET_MAX_BYTES) {
      return { path: existing, changed: false, skipped: "larger_than_public_bucket_limit" };
    }

    const reportedType = String(source.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    const contentType = PUBLIC_BUCKET_MIME_TYPES.has(reportedType)
      ? reportedType
      : EXTENSION_MIME_TYPES[fileExtension(fileUrl)] || "";
    if (!PUBLIC_BUCKET_MIME_TYPES.has(contentType)) {
      return { path: existing, changed: false, skipped: "type_not_allowed_in_public_bucket" };
    }

    const upload = await fetch(`${SUPABASE_URL}/storage/v1/object/${PUBLIC_BUCKET}/${encodePath(destination)}`, {
      method: "POST",
      headers: storageHeaders({ "Content-Type": contentType, "x-upsert": "true" }),
      body: bytes
    });
    if (!upload.ok) {
      return { path: existing, changed: false, skipped: `upload_failed_${upload.status}` };
    }
    return { path: destination, changed: existing !== destination, skipped: "" };
  } catch (error) {
    return { path: existing, changed: false, skipped: "copy_error", error };
  }
}

// Take the public copy back down when a review is unpublished, declined or
// archived. Best effort: a failure here must not fail the office's save.
async function removePublicReviewPhoto(publicPath) {
  const path = String(publicPath || "").trim();
  if (!path || !SERVICE_ROLE_KEY) return { removed: false, skipped: "nothing_to_remove" };
  try {
    const response = await fetch(`${SUPABASE_URL}/storage/v1/object/${PUBLIC_BUCKET}/${encodePath(path)}`, {
      method: "DELETE",
      headers: storageHeaders()
    });
    return { removed: response.ok, skipped: response.ok ? "" : `delete_failed_${response.status}` };
  } catch (error) {
    return { removed: false, skipped: "delete_error", error };
  }
}

module.exports = {
  PRIVATE_BUCKET,
  PUBLIC_BUCKET,
  PUBLIC_PREFIX,
  ensurePublicReviewPhoto,
  removePublicReviewPhoto,
  publicObjectPath,
  publicObjectUrl,
  isPubliclyCopyablePhoto
};
