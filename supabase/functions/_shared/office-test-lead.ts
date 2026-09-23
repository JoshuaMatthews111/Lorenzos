// Mirror of lib/office-test-lead.js for the public Edge Functions. Keep the two in step.
//
// An office smoke test on the LIVE site uses the set phrase — last name "LDTT TEST", or an
// email tagged +ldtt-test — and the row is stamped raw_payload.qa = true, so the hold-out that
// already exists (trainer-backoffice/metrics.js isQaLead, DO-NOT-BREAK rule 1) keeps it out of
// every count. Checked against live 2026-09-23: nothing already in the database matches, so
// this can never move an existing number.
export const OFFICE_TEST_LAST_NAME = "LDTT TEST";

const NAME_KEY = /ldtttest/;
const EMAIL_TAG = /\+ldtt-test(?:[^@]*)?@/i;
const EMAIL_LOCAL = /^ldtt-test@/i;

const letters = (value: unknown) => String(value ?? "").toLowerCase().replace(/[^a-z]/g, "");

export function isOfficeTestLead(row: { first_name?: unknown; last_name?: unknown; email?: unknown } = {}): boolean {
  const name = letters([row.first_name, row.last_name].filter(Boolean).join(" "));
  if (name && NAME_KEY.test(name)) return true;
  const email = String(row.email ?? "").trim().toLowerCase();
  return Boolean(email) && (EMAIL_TAG.test(email) || EMAIL_LOCAL.test(email));
}
