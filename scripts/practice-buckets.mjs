// Creates the practice-<bucket> twins of every Storage bucket the portal uses,
// with the same public/private flag, size limit and allowed MIME types as the
// live bucket. NOT deployed (scripts/ is in .vercelignore). Idempotent: a bucket
// that already exists is left alone.
//
//   SUPABASE_SERVICE_ROLE_KEY=… node scripts/practice-buckets.mjs
//
// The practice deployment (LDTT_SANDBOX=1) reads and writes only these buckets
// (lib/sandbox.js bucketName()). Never prints the key.
const SUPABASE_URL = process.env.SUPABASE_URL || "https://ptnzaeprvkgjgtupmcty.supabase.co";
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";
if (!KEY) { console.error("SUPABASE_SERVICE_ROLE_KEY is required"); process.exit(1); }
const headers = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
const SKIP = new Set(["sandbox-practice-layer"]);

const list = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, { headers }).then(r => r.json());
if (!Array.isArray(list)) { console.error("Could not list buckets", list); process.exit(1); }
const existing = new Set(list.map(b => b.id));
const out = [];
for (const bucket of list) {
  if (bucket.id.startsWith("practice-") || SKIP.has(bucket.id)) continue;
  const id = `practice-${bucket.id}`;
  if (existing.has(id)) { out.push({ id, status: "exists" }); continue; }
  const body = { id, name: id, public: Boolean(bucket.public), file_size_limit: bucket.file_size_limit ?? null, allowed_mime_types: bucket.allowed_mime_types ?? null };
  const r = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, { method: "POST", headers, body: JSON.stringify(body) });
  const text = await r.text();
  out.push({ id, status: r.ok ? "created" : `error ${r.status}: ${text.slice(0, 120)}` , public: body.public });
}
console.log(JSON.stringify(out, null, 2));
