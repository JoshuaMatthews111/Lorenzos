// Offline test for the approved-review photo copy.
//
//   node scripts/test-review-public-photo.mjs
//
// Nothing here touches Supabase, the live database or the network: global.fetch is
// replaced with a fake storage/PostgREST server held in memory. Run it before and
// after any change to lib/review-public-photo.js, api/operational-mutation.js or
// api/approved-homepage-reviews.js.
//
// What it proves:
//   * approving a review copies its photo into the PUBLIC trainer-page-assets bucket
//   * approving twice does not make a second copy
//   * a missing, oversized, video or HEIC file never fails the approval
//   * archiving takes the public copy down again
//   * the public page's API prefers the public copy and still falls back to a signed
//     URL, including on a database that has not had the migration applied yet

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
process.env.SUPABASE_URL = "https://example.supabase.co";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(repoRoot, "/"));

let failures = 0;
const check = (label, actual, expected) => {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  if (!pass) failures++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}${pass ? "" : `\n        got  ${JSON.stringify(actual)}\n        want ${JSON.stringify(expected)}`}`);
};

// ---------------------------------------------------------------- storage helper

const lib = require("./lib/review-public-photo.js");

const PRIVATE = new Map();
const PUBLIC = new Map();
let storageCalls = [];

const storageFetch = async (url, options = {}) => {
  const method = (options.method || "GET").toUpperCase();
  const u = new URL(url);
  storageCalls.push(`${method} ${u.pathname}`);
  const match = u.pathname.match(/^\/storage\/v1\/object\/(trainer-submissions|trainer-page-assets)\/(.+)$/);
  if (!match) throw new Error(`unexpected url ${url}`);
  const [, bucket, encoded] = match;
  const key = encoded.split("/").map(decodeURIComponent).join("/");
  const store = bucket === "trainer-submissions" ? PRIVATE : PUBLIC;
  if (method === "GET" || method === "HEAD") {
    const hit = store.get(key);
    if (!hit) return { ok: false, status: 404, headers: { get: () => null }, arrayBuffer: async () => new ArrayBuffer(0) };
    return {
      ok: true,
      status: 200,
      headers: { get: name => (name === "content-type" ? hit.type : null) },
      arrayBuffer: async () => hit.bytes.buffer.slice(hit.bytes.byteOffset, hit.bytes.byteOffset + hit.bytes.byteLength)
    };
  }
  if (method === "POST") {
    store.set(key, { bytes: Buffer.from(options.body), type: options.headers["Content-Type"] });
    return { ok: true, status: 200 };
  }
  if (method === "DELETE") {
    const existed = store.delete(key);
    return { ok: existed, status: existed ? 200 : 404 };
  }
  throw new Error(`unexpected method ${method}`);
};

console.log("lib/review-public-photo.js");
global.fetch = storageFetch;

const ID = "11111111-2222-3333-4444-555555555555";
const SOURCE = "trainer-a/1755600000000-happy-dog.jpg";
const EXPECTED_KEY = `review-photos/${ID}-1755600000000-happy-dog.jpg`;
PRIVATE.set(SOURCE, { bytes: Buffer.from("JPEGBYTES"), type: "image/jpeg" });

let first = await lib.ensurePublicReviewPhoto({ submissionId: ID, fileUrl: SOURCE, existingPublicPath: "" });
check("approving copies the photo into the public bucket",
  { path: first.path, changed: first.changed, skipped: first.skipped },
  { path: EXPECTED_KEY, changed: true, skipped: "" });
check("the object really is in the public bucket", PUBLIC.has(EXPECTED_KEY), true);
check("the stored path resolves to a plain public URL", lib.publicObjectUrl(first.path),
  `https://example.supabase.co/storage/v1/object/public/trainer-page-assets/${EXPECTED_KEY}`);

storageCalls = [];
const objectCount = PUBLIC.size;
const again = await lib.ensurePublicReviewPhoto({ submissionId: ID, fileUrl: SOURCE, existingPublicPath: first.path });
check("re-approving does not copy again",
  { path: again.path, changed: again.changed, skipped: again.skipped },
  { path: EXPECTED_KEY, changed: false, skipped: "already_copied" });
check("re-approving leaves exactly one object", PUBLIC.size, objectCount);
check("re-approving only checks, never uploads", storageCalls, [`HEAD /storage/v1/object/trainer-page-assets/${EXPECTED_KEY}`]);

PUBLIC.delete(EXPECTED_KEY);
const restored = await lib.ensurePublicReviewPhoto({ submissionId: ID, fileUrl: SOURCE, existingPublicPath: first.path });
check("a public copy deleted by hand is remade", { path: restored.path, present: PUBLIC.has(EXPECTED_KEY) }, { path: EXPECTED_KEY, present: true });

const missing = await lib.ensurePublicReviewPhoto({ submissionId: "missing-id", fileUrl: "trainer-a/gone.png", existingPublicPath: "" });
check("a missing file leaves the review with no photo instead of failing",
  { path: missing.path, skipped: missing.skipped }, { path: "", skipped: "source_missing_404" });
const vanished = await lib.ensurePublicReviewPhoto({ submissionId: "missing-id", fileUrl: "trainer-a/gone.png", existingPublicPath: "review-photos/missing-id-gone.png" });
check("a source that vanished clears the stored path", { path: vanished.path, changed: vanished.changed }, { path: "", changed: true });

for (const [label, value] of [
  ["a pasted video link", "https://youtu.be/abc123"],
  ["an uploaded video", "trainer-a/1755600000000-clip.mp4"],
  ["a HEIC photo the public bucket refuses", "trainer-a/1755600000000-photo.heic"],
  ["a review with no file at all", ""]
]) {
  const out = await lib.ensurePublicReviewPhoto({ submissionId: ID, fileUrl: value, existingPublicPath: "" });
  check(`${label} is left alone`, { path: out.path, changed: out.changed, skipped: out.skipped },
    { path: "", changed: false, skipped: "not_a_public_bucket_photo" });
}

PRIVATE.set("trainer-a/huge.png", { bytes: Buffer.alloc(11 * 1024 * 1024), type: "image/png" });
const oversized = await lib.ensurePublicReviewPhoto({ submissionId: "big-id", fileUrl: "trainer-a/huge.png", existingPublicPath: "" });
check("a photo over the public bucket's 10 MB limit is skipped, not thrown",
  { path: oversized.path, skipped: oversized.skipped }, { path: "", skipped: "larger_than_public_bucket_limit" });

check("archiving removes the public copy",
  { removed: (await lib.removePublicReviewPhoto(EXPECTED_KEY)).removed, present: PUBLIC.has(EXPECTED_KEY) },
  { removed: true, present: false });
check("removing a copy that is already gone is harmless", (await lib.removePublicReviewPhoto(EXPECTED_KEY)).removed, false);
check("removing nothing is harmless", (await lib.removePublicReviewPhoto("")).skipped, "nothing_to_remove");

const workingFetch = global.fetch;
global.fetch = async () => { throw new Error("network down"); };
check("a storage outage on copy is swallowed", (await lib.ensurePublicReviewPhoto({ submissionId: ID, fileUrl: SOURCE, existingPublicPath: "" })).skipped, "copy_error");
check("a storage outage on delete is swallowed", (await lib.removePublicReviewPhoto("review-photos/x.jpg")).skipped, "delete_error");
global.fetch = workingFetch;

check("no stray objects were left in the public bucket", [...PUBLIC.keys()].sort(), []);

// ------------------------------------------------------- the public page's API

console.log("\napi/approved-homepage-reviews.js");
const handler = require("./api/approved-homepage-reviews.js");

const ROWS = [
  { id: "r-public", trainer_id: null, title: "Website review from Dana", notes: "Client location: Cleveland, OH.\nStar rating: 5\nReview: Great work.", office_notes: "", file_url: "trainer-a/1-dog.jpg", public_file_url: "review-photos/r-public-1-dog.jpg", photo_position: null, created_at: "2026-09-01T00:00:00Z" },
  { id: "r-signed", trainer_id: null, title: "Website review from Ray", notes: "Star rating: 4\nReview: Good.", office_notes: "", file_url: "trainer-a/2-clip.mp4", public_file_url: null, photo_position: null, created_at: "2026-08-01T00:00:00Z" }
];

let migrationApplied = true;
let selects = [];
const reply = (ok, status, payload) => ({ ok, status, text: async () => JSON.stringify(payload) });

global.fetch = async url => {
  const u = new URL(url);
  if (u.pathname === "/rest/v1/review_publications") return reply(true, 200, []);
  if (u.pathname === "/rest/v1/content_submissions") {
    const select = u.searchParams.get("select") || "";
    selects.push(select);
    if (!migrationApplied && select.includes("public_file_url")) {
      return reply(false, 400, { message: "column content_submissions.public_file_url does not exist", code: "42703" });
    }
    return reply(true, 200, ROWS.map(row => {
      const copy = { ...row };
      if (!select.includes("public_file_url")) delete copy.public_file_url;
      return copy;
    }));
  }
  if (u.pathname.startsWith("/storage/v1/object/sign/")) {
    return reply(true, 200, { signedURL: `/object/sign/${u.pathname.split("/sign/")[1]}?token=fake` });
  }
  throw new Error(`unexpected url ${url}`);
};

async function callHandler() {
  let payload = null;
  const res = {
    setHeader() {},
    status(code) { this.code = code; return this; },
    json(body) { payload = body; return this; },
    end() { return this; }
  };
  await handler({ method: "GET", query: {} }, res);
  return { code: res.code, payload };
}

selects = [];
let response = await callHandler();
check("the reviews request succeeds", response.code, 200);
const byId = Object.fromEntries(response.payload.reviews.map(row => [row.id, row]));
check("an approved photo is served from the public bucket", byId["r-public"].media_url,
  "https://example.supabase.co/storage/v1/object/public/trainer-page-assets/review-photos/r-public-1-dog.jpg");
check("the public URL carries no expiring token", byId["r-public"].media_url.includes("token"), false);
check("a review with no public copy still gets its signed URL", byId["r-signed"].media_url.includes("token=fake"), true);
check("one select is enough once the column exists", selects.length, 1);

migrationApplied = false;
selects = [];
response = await callHandler();
check("the request still succeeds before the migration is applied", response.code, 200);
check("the review rail does not go empty", response.payload.reviews.length, 2);
check("it retries the select without the new column", selects.map(select => select.includes("public_file_url")), [true, false]);
check("and falls back to signed URLs", response.payload.reviews.every(row => row.media_url.includes("token=fake")), true);

console.log(failures ? `\n${failures} FAILURE(S)` : "\nAll offline checks passed.");
process.exit(failures ? 1 : 0);
