# Lorenzo's Dog Training Team Supabase Readiness

Project ref: `ptnzaeprvkgjgtupmcty`

This folder prepares the LDTT website, admin portal, trainer portal, lead tracking, trainer applications, and future client import work for Supabase.

## Current Live Form Routing

- Contact Us form:
  - Sends to the Google Form / response sheet currently provided by the LDTT team.
  - Sends email relay to `production@lorenzosdogtrainingteam.com`.
  - Stores an immediate browser receipt for resilient user feedback.
  - Stores the shared office lead in Supabase through `submit-contact`.

- Trainer Application form:
  - Sends email relay to `recruiting@lorenzosdogtrainingteam.com`.
  - Stores an immediate browser receipt for resilient user feedback.
  - Stores the shared recruiting record in Supabase through `submit-trainer-application`.

## Supabase Form Posting

The frontend includes `supabase-config.js`, and Supabase posting is enabled.

Do not put service-role keys in frontend files. The public website posts to Supabase Edge Functions, and the Edge Functions use Supabase secrets server-side.

## Required Supabase Secrets

Set these in Supabase project secrets before deploying functions:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

FormSubmit and the established Google Forms response sheets remain independent
delivery channels so a Supabase failure does not prevent either office backup.

## Apply Database

Once the account has database permissions:

1. Apply `supabase/migrations/20260708000000_ldtt_backoffice_schema.sql`.
2. Deploy functions:
   - `submit-contact`
   - `submit-trainer-application`
3. Turn on `window.LDTT_SUPABASE.enabled`.
4. Submit one contact form and one trainer application.
5. Confirm rows appear in:
   - `public.leads`
   - `public.lead_events`
   - `public.trainer_applications`

## Admin / Trainer Portal Direction

The trainer portal remains limited:

- Dashboard
- My Leads
- My Trainer Page
- Performance
- Submit Photos/Videos
- Submit Reviews
- Settings

Trainer pages are controlled by the office/marketing team. Trainers can submit content for approval, but they cannot publish pages, manage DNS, choose random themes, or mass message clients.

The admin portal controls:

- Trainer profiles
- Trainer page publishing and locking
- Leads and lead statuses
- Applications
- Client database/import foundation
- Media/review approvals
- Conversion reporting

Conversion should mean `First Session / Payment` or `Became a Client`, not clicks or form submissions.
