import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { insertRows, selectRows } from "../_shared/rest.ts";

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeReviewVideoUrl(value: unknown) {
  let input = clean(value).slice(0, 1000);
  if (!input) return "";
  if (!/^https?:\/\//i.test(input)) input = `https://${input}`;
  try {
    const parsed = new URL(input);
    if (!["http:", "https:"].includes(parsed.protocol)) return "";
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (["youtube.com", "m.youtube.com"].includes(host)) {
      const id = parsed.searchParams.get("v") || (["shorts", "embed"].includes(parts[0]) ? parts[1] : "");
      return id ? `https://www.youtube.com/embed/${encodeURIComponent(id)}` : "";
    }
    if (host === "youtu.be" && parts[0]) return `https://www.youtube.com/embed/${encodeURIComponent(parts[0])}`;
    if (host === "vimeo.com") {
      const id = parts.find(part => /^\d+$/.test(part));
      return id ? `https://player.vimeo.com/video/${encodeURIComponent(id)}` : "";
    }
    if (host === "player.vimeo.com") return parsed.href;
    if (host === "drive.google.com") {
      const dIndex = parts.indexOf("d");
      const id = dIndex >= 0 ? parts[dIndex + 1] : parsed.searchParams.get("id");
      return id ? `https://drive.google.com/file/d/${encodeURIComponent(id)}/preview` : "";
    }
    if (host === "loom.com" || host.endsWith(".loom.com")) {
      const marker = parts.includes("share") ? "share" : "embed";
      const id = parts[parts.indexOf(marker) + 1] || "";
      return id ? `https://www.loom.com/embed/${encodeURIComponent(id)}` : "";
    }
    if (host === "dropbox.com" || host.endsWith(".dropbox.com")) {
      parsed.searchParams.delete("dl");
      parsed.searchParams.set("raw", "1");
      return parsed.href;
    }
    return /\.(mp4|webm|mov|m4v)(?:$|\?)/i.test(parsed.href) ? parsed.href : "";
  } catch {
    return "";
  }
}

function storageCredentials() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const secretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
  const serviceRoleKey = secretKeys ? JSON.parse(secretKeys).default : Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) throw new Error("Missing Supabase backend credentials");
  return { supabaseUrl, serviceRoleKey };
}

function serviceHeaders(serviceRoleKey: string, extra: Record<string, string> = {}) {
  const headers: Record<string, string> = {
    apikey: serviceRoleKey,
    ...extra
  };
  if (!serviceRoleKey.startsWith("sb_secret_")) headers.Authorization = `Bearer ${serviceRoleKey}`;
  return headers;
}

async function uploadSubmissionFile(trainerId: string, file: Record<string, unknown> | null) {
  if (!file) return "";
  const dataUrl = clean(file.data_url);
  const name = clean(file.name) || "review-upload";
  const type = clean(file.type) || "application/octet-stream";
  if (!dataUrl.startsWith("data:") || !dataUrl.includes(";base64,")) return "";

  const base64 = dataUrl.split(";base64,")[1];
  const bytes = Uint8Array.from(atob(base64), char => char.charCodeAt(0));
  const safeName = name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "review-upload";
  const path = `${trainerId || "public"}/${Date.now()}-${safeName}`;
  const { supabaseUrl, serviceRoleKey } = storageCredentials();
  const response = await fetch(`${supabaseUrl}/storage/v1/object/trainer-submissions/${path}`, {
    method: "POST",
    headers: serviceHeaders(serviceRoleKey, {
      "Content-Type": type,
      "x-upsert": "false"
    }),
    body: bytes
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`storage upload failed: ${response.status} ${text}`);
  return path;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const payload = await req.json();
    const reviewerName = clean(payload.reviewer_name);
    const reviewerEmail = clean(payload.reviewer_email).toLowerCase();
    const reviewText = clean(payload.review_text);
    const trainerSlug = clean(payload.trainer_slug);
    const requestedVideoUrl = clean(payload.review_video_url);
    const reviewVideoUrl = normalizeReviewVideoUrl(requestedVideoUrl);

    if (!reviewerName || !reviewerEmail || !reviewText || !trainerSlug) {
      return jsonResponse({ error: "Missing required review fields" }, 400);
    }
    if (requestedVideoUrl && !reviewVideoUrl) {
      return jsonResponse({ error: "Use a YouTube, Vimeo, Loom, Google Drive, Dropbox, or direct MP4/WebM video link" }, 400);
    }

    const trainerRows = await selectRows({
      table: "trainers",
      select: "id,slug,full_name",
      filters: { slug: `eq.${trainerSlug}` },
      limit: 1
    });
    const trainer = Array.isArray(trainerRows) ? trainerRows[0] : null;
    const trainerId = trainer?.id || clean(payload.trainer_id);
    const fileUrl = await uploadSubmissionFile(trainerId, payload.file || null);
    const mediaUrl = fileUrl || reviewVideoUrl;
    const notes = [
      `Public landing page submission for ${clean(payload.trainer_name) || trainer?.full_name || trainerSlug}.`,
      `Submitted from: ${clean(payload.source_page || payload.page_url || "trainer landing page")}.`,
      `Reviewer: ${reviewerName} <${reviewerEmail}>.`,
      `Permission to share: ${clean(payload.permission_to_share) || "not confirmed"}.`,
      reviewVideoUrl && !fileUrl ? `Attached video link: ${reviewVideoUrl} (video/embed).` : "",
      `Review: ${reviewText}`
    ].filter(Boolean).join("\n");

    const inserted = await insertRows({
      table: "content_submissions",
      body: {
        trainer_id: trainerId || null,
        submission_type: "review",
        title: `Website review from ${reviewerName}`,
        file_url: mediaUrl || null,
        notes,
        status: "pending",
        office_notes: null
      }
    });

    const submission = Array.isArray(inserted) ? inserted[0] : null;
    return jsonResponse({ ok: true, submission_id: submission?.id ?? null, file_url: mediaUrl || null });
  } catch (error) {
    console.error(error);
    return jsonResponse({ error: "Unable to save review submission" }, 500);
  }
});
