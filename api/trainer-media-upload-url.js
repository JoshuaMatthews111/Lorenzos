const { bucketName, supabaseRequest } = require("../lib/sandbox");
const { authorizeRequest } = require("../lib/portal-auth");
const SUPABASE_URL = process.env.SUPABASE_URL || "https://ptnzaeprvkgjgtupmcty.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";

const ALLOWED_BUCKETS = new Set(["trainer-page-assets", "trainer-page-videos"]);
const ALLOWED_VIDEO_TYPES = new Set(["video/mp4", "video/webm"]);
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function cors(response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return response;
}

function clean(value, maxLength = 500) {
  return String(value || "").trim().slice(0, maxLength);
}

function safeStoragePath(value) {
  return clean(value, 700)
    .split("/")
    .filter(Boolean)
    .map(part => part.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, ""))
    .filter(Boolean)
    .join("/");
}

async function supabaseFetch(path, options = {}) {
  // Practice copy: schema profile headers / practice-* bucket (lib/sandbox.js).
  const target = supabaseRequest(path, options.headers || {});
  const response = await fetch(`${SUPABASE_URL}${target.path}`, {
    ...options,
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      ...target.headers
    }
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!response.ok) {
    const message = data?.msg || data?.message || data?.error_description || data?.error || text || `Supabase request failed (${response.status})`;
    throw new Error(message);
  }
  return data;
}

function publicStorageUrl(bucket, path) {
  // Practice copy: the file lives in practice-<bucket>, so the URL must say so.
  return `${SUPABASE_URL}/storage/v1/object/public/${encodeURIComponent(bucketName(bucket))}/${path.split("/").map(encodeURIComponent).join("/")}`;
}

module.exports = async function handler(req, res) {
  // Practice copy: uploads go to the practice-* twin of the bucket (supabaseRequest).
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, message: "Method not allowed" });
  if (!SERVICE_ROLE_KEY) return res.status(500).json({ ok: false, message: "Supabase service role key is not configured on Vercel." });

  try {
    // Office staff only (lib/portal-auth.js): super_admin or office_admin,
    // active, access_status not disabled/revoked (this endpoint used to skip that).
    const admin = await authorizeRequest(req, res, { require: "admin", message: "Active Admin or Office Admin access required." });
    if (!admin) return;

    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const bucket = clean(body.bucket, 120);
    const path = safeStoragePath(body.path);
    const contentType = clean(body.content_type || body.contentType || "application/octet-stream", 160);
    const size = Number(body.size || 0);

    if (!ALLOWED_BUCKETS.has(bucket)) return res.status(400).json({ ok: false, message: "Unsupported media bucket." });
    if (!path || !path.includes("/")) return res.status(400).json({ ok: false, message: "A trainer folder and file name are required." });
    if (bucket === "trainer-page-videos" && !ALLOWED_VIDEO_TYPES.has(contentType)) {
      return res.status(400).json({ ok: false, message: "Trainer videos must be MP4 or WebM." });
    }
    if (bucket === "trainer-page-assets" && !ALLOWED_IMAGE_TYPES.has(contentType)) {
      return res.status(400).json({ ok: false, message: "Trainer images must be JPG, PNG, WebP, or GIF." });
    }
    if (bucket === "trainer-page-videos" && size > 50 * 1024 * 1024) {
      return res.status(400).json({ ok: false, message: "Trainer video uploads must be under 50 MB after compression." });
    }
    if (bucket === "trainer-page-assets" && size > 12 * 1024 * 1024) {
      return res.status(400).json({ ok: false, message: "Trainer image uploads must be under 12 MB after compression." });
    }

    const encodedPath = path.split("/").map(encodeURIComponent).join("/");
    const signed = await supabaseFetch(`/storage/v1/object/upload/sign/${encodeURIComponent(bucket)}/${encodedPath}`, {
      method: "POST",
      body: JSON.stringify({ upsert: false })
    });
    const signedUrl = signed?.signedURL || signed?.signedUrl || signed?.url || "";
    const signedToken = signed?.token || "";
    if (!signedUrl && !signedToken) throw new Error("Supabase did not return a signed upload URL.");

    return res.status(200).json({
      ok: true,
      bucket,
      path,
      signedUrl: signedUrl.startsWith("http") ? signedUrl : `${SUPABASE_URL}/storage/v1${signedUrl}`,
      token: signedToken,
      publicUrl: publicStorageUrl(bucket, path)
    });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || "Trainer media upload URL could not be created." });
  }
};
