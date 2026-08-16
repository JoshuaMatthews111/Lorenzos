# Communications Portal Improvement Handoff

Claude: please audit and improve the LDTT Staff Portal Communications tab as a senior product
designer and engineer. The goal is a calm, obvious office workflow, not a complex automation
console.

## What is live

- Portal screen: `trainer-backoffice/app.js` and `trainer-backoffice/styles.css`.
- Server API: `api/communications.js`.
- Database migrations: `supabase/migrations/20260816015952_communications_hub.sql`,
  `20260816020109_harden_communications_access.sql`, and
  `20260816020158_index_communications_claim_owner.sql`.
- Secure provider settings are stored in Supabase Vault. No secret may enter a browser bundle.
- Existing public forms, the lead pipeline, trainer applications, reviews, marketing pages, and
  public company site must not be changed or broken.

## Confirmed usability problems

1. The initial render treated an administrator like a trainer before the API response arrived,
   hiding the alert-list setup behind Lead Status.
2. Existing leads were created before Communications, so they had no short lead codes.
3. Archived/lost leads appeared available to claim, which made the failed action confusing.
4. The language "Needs an owner" is not useful. Use "Available" and "Assign to me."

## Required workflow

1. **Lead Alerts:** one clear first action, `Create Alert List`.
2. Create list: name + market/service + optional quiet hours. Save.
3. Add people: choose a portal staff account, mobile number, consent. Save.
4. Lead Status: show active client leads only. An unassigned lead says `Available` and has
   `Assign to me`. Once assigned, show assignee with `Log Contact` and `Release`.
5. Closed, archived, lost, converted, and do-not-contact leads must never look assignable.
6. Keep advanced filtering/settings secondary. Do not make staff learn a multi-step dashboard
   before they can create a list or take a lead.

## Technical guardrails

- Claiming must remain a single conditional database update; never read then write.
- Keep `leads.status` as the business outcome. Claim/first-response state is supplemental.
- Communications tables use RLS with explicit browser-deny policies and server-only access.
- Preserve the secure server API authorization through `portal_users` and Super Admin settings.
- Verify desktop and mobile; no horizontal scrolling for primary tasks.
- Run syntax checks, `node scripts/audit-office-requirements.mjs`, `node scripts/build-release.mjs`,
  then deploy only after verification.
