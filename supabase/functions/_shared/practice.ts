// Practice copy flag for the public Edge Functions.
//
// The practice deployment (Vercel Preview, LDTT_SANDBOX=1) is a full copy of
// live in the `practice` schema. Its public pages send the header
// `x-ldtt-practice: 1` with every call to submit-contact,
// submit-trainer-application, submit-content-review and track-site-event.
// With the header, every table read and write in that request goes to the
// `practice` schema (PostgREST Accept-Profile / Content-Profile) and uploads go
// to the practice-* bucket, so a test lead on the practice site never becomes a
// real lead. WITHOUT the header nothing is added: the request to Supabase is
// byte-for-byte what it was before this file existed.
export const PRACTICE_HEADER = "x-ldtt-practice";
export type Schema = "public" | "practice";

export function requestSchema(req: Request): Schema {
  return req.headers.get(PRACTICE_HEADER) === "1" ? "practice" : "public";
}

// Extra REST headers for the schema. Empty for public on purpose.
export function schemaHeaders(schema?: Schema): Record<string, string> {
  return schema === "practice" ? { "Accept-Profile": "practice", "Content-Profile": "practice" } : {};
}

// Storage buckets are separate objects, not schemas: practice-<bucket>.
export function bucketFor(bucket: string, schema?: Schema): string {
  return schema === "practice" && !bucket.startsWith("practice-") ? `practice-${bucket}` : bucket;
}
