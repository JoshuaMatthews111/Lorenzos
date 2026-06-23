# White-Label Platform Table Map

This is the first backend table list for Lorenzo's Dog Training Team trainer landing pages.

## Core Tables

| Table | What It Stores | Why It Matters |
| --- | --- | --- |
| `app_profiles` | Supabase user profile and role. | Separates admins, trainers, and staff. |
| `trainers` | Trainer name, business name, phone, email, headshot, city, state, service area, specialties. | Main record for each Lorenzo trainer. |
| `design_templates` | Reusable landing page design choices. | Lets trainers choose a professional page style quickly. |
| `trainer_sites` | Site name, slug, selected design, SEO fields, logo, theme, status. | Powers each trainer's white-labeled website. |
| `trainer_domains` | Custom domain, status, verification token, DNS target, primary domain flag. | Lets each trainer attach a domain safely. |
| `site_sections` | Editable content blocks for hero, services, proof, method, CTA, lead form. | Lets pages stay flexible without creating new code for every trainer. |
| `leads` | Lead name, email, phone, dog details, training goals, source URL, UTM data, status. | Converts the landing pages into measurable business. |
| `lead_events` | Page views, CTA clicks, form starts, submissions, phone clicks. | Tracks conversion and marketing performance. |
| `domain_verification_events` | DNS check history and verification results. | Helps troubleshoot custom domain setup. |

## Required Statuses

### Trainer Status

- `draft`
- `active`
- `paused`
- `archived`

### Site Status

- `draft`
- `published`
- `paused`
- `archived`

### Domain Status

- `pending`
- `verified`
- `active`
- `failed`
- `archived`

### Lead Status

- `new`
- `contacted`
- `qualified`
- `booked`
- `won`
- `lost`
- `spam`

## First Admin Screens To Build

1. Trainer directory.
2. Trainer detail page.
3. Trainer site editor.
4. Design template picker.
5. Domain setup screen.
6. Lead inbox.
7. Lead detail and status pipeline.
8. Admin reporting dashboard.

## First Public Screens To Build

1. Default trainer landing page at `/trainers/[slug]`.
2. Custom domain rendering by request host.
3. Lead form.
4. Thank-you state.
5. Trainer service area page SEO metadata.

