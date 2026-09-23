// An office smoke test on the LIVE site is marked as a test row, so it never lands in the counts.
//
// Joshua 2026-09-23: "when we test on the LIVE site after the push, those leads WILL be real rows
// in public. Add a way to mark them so they never pollute the counts."
//
// THE RULE THE OFFICE FOLLOWS (write it on the smoke-test card):
//   Last name  :  LDTT TEST          <- the set phrase, on every smoke-test lead
//   or Email   :  anything+ldtt-test@... (a plus-address), or ldtt-test@<anything>
// Anything else is a real lead and is counted like a real lead.
//
// WHAT THE CODE DOES WITH IT: the two server doors that write a lead
// (lib/booking.js createLead, supabase/functions/submit-contact) stamp
// `raw_payload.qa = true` — a real JSON boolean — on a match. Nothing else changes: the
// hold-out that already exists (trainer-backoffice/metrics.js isQaLead / excludeQa, DO-NOT-BREAK
// rule 1) then drops that row from every tile, chart, table, report and CSV export.
//
// WHY IT IS THIS NARROW: it must be impossible for a real client to trip it by accident.
// Checked against live on 2026-09-23 (read-only SQL): 0 of 290 public.leads rows and 0
// trainer_applications match either pattern, so turning this on cannot move a single existing
// number. "Test", "testing", "qa" on their own are deliberately NOT matched — real people are
// called Tester and real people write "test" in a comment box.
//
// The same module is mirrored in TypeScript for the Edge Function:
// supabase/functions/_shared/office-test-lead.ts. Keep the two in step.
const OFFICE_TEST_LAST_NAME = "LDTT TEST";

// "LDTT TEST" with the punctuation and spacing taken out, so "LDTT-Test", "ldtt test" and
// first name "LDTT" + last name "TEST" all count, and nothing else does.
const NAME_KEY = /ldtttest/;
// A plus-address (gmail-style tag) or the whole local part.
const EMAIL_TAG = /\+ldtt-test(?:[^@]*)?@/i;
const EMAIL_LOCAL = /^ldtt-test@/i;

const letters = value => String(value ?? "").toLowerCase().replace(/[^a-z]/g, "");

function isOfficeTestLead(row = {}) {
  const name = letters([row.first_name, row.last_name].filter(Boolean).join(" ") || row.name || row.full_name || "");
  if (name && NAME_KEY.test(name)) return true;
  const email = String(row.email ?? "").trim().toLowerCase();
  return Boolean(email) && (EMAIL_TAG.test(email) || EMAIL_LOCAL.test(email));
}

module.exports = { OFFICE_TEST_LAST_NAME, isOfficeTestLead };
