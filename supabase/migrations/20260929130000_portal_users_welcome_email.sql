-- Joshua 2026-09-29: Portal Access shows, beside each trainer login, whether the new-trainer welcome email went out
-- (and when, and to which address). Written by api/ensure-trainer-user.js after each send. Same columns, same order,
-- on the practice copy. See DO-NOT-BREAK rule 137.
alter table public.portal_users add column if not exists welcome_email_status text, add column if not exists welcome_email_at timestamptz, add column if not exists welcome_email_to text;
alter table practice.portal_users add column if not exists welcome_email_status text, add column if not exists welcome_email_at timestamptz, add column if not exists welcome_email_to text;
