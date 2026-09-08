// Proof for the Meta tracking chain (DO-NOT-BREAK 11, 12, 13, 39).
//
// Meta was seeing 37 leads while the portal held 83. The browser pixel is
// blocked for roughly half of real visitors and there was no server-side event
// at all. This checks the whole chain end to end, offline:
//   every public page carries the pixel, the analytics scripts and the event-id
//   stamping; every generator emits the same snippet; and the Edge Function
//   sends the same event_id from the server, never for a QA row and never from
//   the practice copy.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = f => readFileSync(path.join(root, f), "utf8");
let passed = 0;
const ok = label => { console.log("PASS ", label); passed += 1; };

// The SSD is exFAT, so macOS drops "._name" resource forks beside every file.
// They are not pages and .vercelignore excludes them.
const pages = readdirSync(root).filter(f => f.endsWith(".html") && !f.startsWith("._"));

// 1. Every public page carries the pixel.
{
  const missing = pages.filter(f => !read(f).includes("fbq('init', '3790623554504010')"));
  assert.deepEqual(missing, [], `pages with no Meta pixel: ${missing.join(", ")}`);
  ok(`all ${pages.length} public pages carry the Meta pixel`);
}

// 2. Every public page stamps an event id and the fb cookies.
{
  const missing = pages.filter(f => {
    const s = read(f);
    return !(s.includes("stamp(f,'meta_event_id',id)") && s.includes("stamp(f,'fbp',cookie('_fbp'))") && s.includes("stamp(f,'fbc',fbc())"));
  });
  assert.deepEqual(missing, [], `pages that do not stamp the event id: ${missing.join(", ")}`);
  ok(`all ${pages.length} pages stamp meta_event_id, fbp and fbc into the form`);
}

// 3. The browser event carries that same id, so Meta can de-duplicate.
{
  const missing = pages.filter(f => {
    const s = read(f);
    return !(s.includes("fbq('track', 'Lead', { value: 250, currency: 'USD' }, { eventID: id })")
          && s.includes("fbq('track', 'CompleteRegistration', { value: 25, currency: 'USD' }, { eventID: id })"));
  });
  assert.deepEqual(missing, [], `pages whose fbq call has no eventID: ${missing.join(", ")}`);
  ok("every page passes eventID to fbq for both Lead and CompleteRegistration");
}

// 4. No page still carries the old, un-deduplicated call.
{
  const old = pages.filter(f => /fbq\('track', 'Lead', \{ value: 250, currency: 'USD' \}\);/.test(read(f)));
  assert.deepEqual(old, [], `pages still on the old pixel call: ${old.join(", ")}`);
  ok("no page is left on the old call that Meta could not de-duplicate");
}

// 5. Analytics stayed on every page (DO-NOT-BREAK 36).
{
  const missing = pages.filter(f => !read(f).includes("/_vercel/insights/script.js"));
  assert.deepEqual(missing, [], `pages with no analytics script: ${missing.join(", ")}`);
  ok(`all ${pages.length} pages still carry the Vercel analytics script`);
}

// 6. Every generator emits the same snippet, so a rebuild cannot undo this.
{
  for (const gen of ["build.py", "lib/ad-page-template.js", "scripts/generate-trainer-opportunity-pages.mjs"]) {
    const s = read(gen);
    assert.ok(s.includes("stamp(f,'meta_event_id',id)"), `${gen} does not stamp the event id`);
    assert.ok(s.includes("eventID: id"), `${gen} does not pass eventID to fbq`);
  }
  assert.ok(read("build.py").includes("META_PIXEL_HEAD"), "build.py lost the pixel constant");
  assert.ok(read("build.py").includes("{META_PIXEL_HEAD}<script defer src=\"/_vercel/insights/script.js\""),
    "the trainer page shell must carry the pixel AND the analytics scripts");
  ok("every generator emits the same snippet, so rebuilding cannot strip it again");
}

// 7. The server sends the same event.
{
  const fn = read("supabase/functions/submit-contact/index.ts");
  assert.ok(fn.includes("async function sendMetaConversion"), "no server-side Conversions API send");
  assert.ok(fn.includes("clean(payload.meta_event_id) || `lead-${leadId}`"), "server must reuse the browser's event id");
  assert.ok(fn.includes("graph.facebook.com/v21.0/${META_PIXEL_ID}/events"), "not posting to the Conversions API");
  assert.ok(fn.includes("await sendMetaConversion(req, payload, lead.id)"), "sendMetaConversion is never called");
  ok("the Edge Function sends the same event_id from the server, so Meta counts one lead");
}

// 8. It can never break the form, and never leaks test data to Meta.
{
  const fn = read("supabase/functions/submit-contact/index.ts");
  assert.ok(fn.includes('const metaAllowed = metaTestMode || (!isQaSubmission && schema !== "practice")'),
    "QA rows and practice-copy leads must never reach Meta");
  assert.ok(fn.includes('const metaTestMode = Boolean(Deno.env.get("META_TEST_EVENT_CODE"))'),
    "a test event code must be the only way a QA row reaches Meta, and only into Test events");
  assert.ok(fn.includes('catch (error) { console.error("meta_capi_unhandled"'), "the send must be wrapped so it cannot fail the form");
  assert.ok(fn.includes('if (!META_CAPI_ACCESS_TOKEN) return { skipped: "no_token" }'), "must be a no-op with no token");
  assert.ok(fn.indexOf("await sendMetaConversion") > fn.indexOf("const lead = Array.isArray(inserted)"),
    "the lead must be saved before Meta is told about it");
  ok("QA rows and practice leads never reach Meta, and a Meta outage cannot fail the form");
}

// 9. Personal data is hashed before it leaves, as Meta requires.
{
  const fn = read("supabase/functions/submit-contact/index.ts");
  for (const field of ["em: await hashed(payload.email)", "ph: await hashedPhone(payload.phone)", "fn: await hashed(payload.first_name)"]) {
    assert.ok(fn.includes(field), `not hashed: ${field}`);
  }
  assert.ok(fn.includes('if (!digits || /not provided/i.test(clean(value))) return undefined'),
    'the "Not provided - PDF opt-in" placeholder must never be sent as a phone number');
  ok("email, phone and name are hashed before they leave, and the phone placeholder is dropped");
}

// 10. An ebook opt-in is reported as a registration, not a Lead.
{
  const fn = read("supabase/functions/submit-contact/index.ts");
  assert.ok(fn.includes('event_name: ebook ? "CompleteRegistration" : "Lead"'), "ebook opt-ins must not be sent as Leads");
  assert.ok(fn.includes('value: ebook ? 25 : 250'), "an ebook opt-in is not worth the same as an evaluation request");
  ok("an ebook opt-in reports as CompleteRegistration at $25, an enquiry as Lead at $250");
}

console.log(`\nAll ${passed} Meta tracking checks passed across ${pages.length} pages.`);
