// Shared sandbox edits.
//
// The office wants every tester to see everyone else's practice changes, and
// the sandbox must still never write to the real tables. There is no SQL access
// to add a scratch table, but the service key can write Storage objects — so
// the practice layer is one JSON file of operations in the existing
// trainer-page-assets bucket. Mutations append to it; the data endpoint lays it
// over the live rows it just fetched. Deleting the file resets the sandbox.
const crypto = require("node:crypto");
const SUPABASE_URL = process.env.SUPABASE_URL || "https://ptnzaeprvkgjgtupmcty.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";
// The trainer buckets restrict uploads to images and video, so the log gets
// its own private bucket. Creating a bucket needs only the service key — no
// SQL — and creating one that already exists answers 409, which is fine.
const BUCKET = "sandbox-practice-layer";
const OBJECT_PATH = "ops-log.json";
let bucketReady = false;

async function ensureBucket() {
  if (bucketReady) return;
  const response = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
    method: "POST",
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: false })
  });
  if (!response.ok && response.status !== 409) {
    const detail = await response.text().catch(() => "");
    if (!/already exists|Duplicate/i.test(detail)) {
      throw new Error(`Sandbox bucket could not be created (${response.status}): ${detail.slice(0, 200)}`);
    }
  }
  bucketReady = true;
}
const MAX_OPS = 2000;

function storageUrl() {
  return `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${OBJECT_PATH}`;
}

function headers(extra = {}) {
  return {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    ...extra
  };
}

// perf/portal-speed: every poll and every save used to download the whole log
// (up to 2,000 ops) and every save uploaded it all again. Supabase Storage
// answers a GET that carries If-None-Match with an empty 304 when the object
// has not changed (verified 2026-09-05 against this project), so a warm
// function instance keeps the last log it saw together with its ETag and only
// downloads again when another instance has written. Deleting the file still
// resets the sandbox: the next read gets a 404 and the cache is dropped.
let cached = null; // { etag, ops }

async function readOps() {
  await ensureBucket();
  const conditional = cached?.etag ? { "If-None-Match": cached.etag } : {};
  const response = await fetch(`${storageUrl()}?nocache=${Date.now()}`, {
    headers: headers({ "Cache-Control": "no-cache", ...conditional }),
    cache: "no-store"
  });
  if (response.status === 304 && cached) return cached.ops.slice();
  if (response.status === 400 || response.status === 404) {
    cached = null;
    return [];
  }
  if (!response.ok) throw new Error(`Sandbox op log could not be read (${response.status})`);
  const text = await response.text();
  let data = null;
  try { data = JSON.parse(text); } catch { data = null; }
  const ops = Array.isArray(data?.ops) ? data.ops : [];
  const etag = response.headers.get("etag") || "";
  cached = etag ? { etag, ops: ops.slice() } : null;
  return ops;
}

async function writeOps(ops) {
  await ensureBucket();
  const kept = ops.slice(-MAX_OPS);
  const body = JSON.stringify({ version: 1, ops: kept });
  const response = await fetch(storageUrl(), {
    method: "POST",
    headers: headers({ "Content-Type": "application/json", "x-upsert": "true", "Cache-Control": "max-age=0" }),
    body
  });
  if (!response.ok) {
    cached = null;
    const detail = await response.text().catch(() => "");
    throw new Error(`Sandbox op log could not be written (${response.status}): ${detail.slice(0, 200)}`);
  }
  // The upload answer does not carry the new ETag. Supabase Storage uses the
  // S3 convention (ETag = md5 of the bytes, verified against this project), so
  // remember the log we just wrote under that tag. If the guess is ever wrong
  // the next read simply gets a 200 with the real log, exactly as before.
  cached = { etag: `"${crypto.createHash("md5").update(body).digest("hex")}"`, ops: kept.slice() };
}

async function appendOp(op) {
  // Two testers saving in the same second can race this read-modify-write and
  // one op can be lost. For a four-person practice copy that is acceptable;
  // the loser simply saves again.
  const ops = await readOps();
  ops.push({ ...op, at: new Date().toISOString() });
  await writeOps(ops);
  return op;
}

async function clearOps() {
  cached = null;
  const response = await fetch(storageUrl(), { method: "DELETE", headers: headers() });
  if (!response.ok && response.status !== 404 && response.status !== 400) {
    throw new Error(`Sandbox op log could not be cleared (${response.status})`);
  }
}

// Lay the shared practice edits over the live rows the data endpoint fetched.
// The payload is mutated in place.
const ENTITY_COLLECTIONS = {
  lead: "leads",
  application: "applications",
  client: "clients",
  trainer: "trainers",
  trainer_page: "pages",
  submission: "submissions",
  portal_user: "portalUsers",
  deal: "deals",
  deal_payment: "dealPayments",
  ad_page: "adPages"
};

function applyOps(payload, ops) {
  const rowsFor = entityType => payload[ENTITY_COLLECTIONS[entityType]] || null;
  ops.forEach(op => {
    try {
      if (op.operation === "update" || op.operation === "archive") {
        const rows = rowsFor(op.entity_type);
        const row = rows?.find(item => String(item.id) === String(op.id));
        if (row) Object.assign(row, op.changes || {});
      } else if (op.operation === "create") {
        const rows = rowsFor(op.entity_type);
        if (rows) rows.unshift(op.record);
      } else if (op.operation === "save_note") {
        if (op.note_id) {
          const note = payload.officeNotes.find(item => String(item.id) === String(op.note_id));
          if (note) { note.note = op.note; note.updated_at = op.at; }
        } else {
          payload.officeNotes.unshift(op.record);
        }
      } else if (op.operation === "delete_note") {
        payload.officeNotes = payload.officeNotes.filter(item => String(item.id) !== String(op.note_id));
      } else if (op.operation === "send_to_live") {
        // send-to-live: the sandbox shows "Sent to live at <time>" on the item.
        const rows = rowsFor(op.entity_type);
        const row = rows?.find(item => String(item.id) === String(op.id) || (op.slug && item.slug === op.slug));
        if (row) { row.sent_to_live_at = op.at; row.sent_to_live_by = op.actor || null; }
      }
    } catch {
      // A malformed op must never take the whole portal down; skip it.
    }
  });
  return payload;
}

module.exports = { readOps, appendOp, clearOps, applyOps };
