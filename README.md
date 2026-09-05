# Lorenzo's Dog Training Team — website + staff portal

Static site (`*.html` at the root) + Vercel serverless functions (`api/`) + the staff portal
(`trainer-backoffice/`) on Supabase project LDTT `ptnzaeprvkgjgtupmcty`.

Start here:

- **`DO-NOT-BREAK.md`** — behaviour that is verified working and must not regress. Read it first.
- **`docs/SITE-BUILDER.md`** — the maintainer's guide to the Site Builder / Page Studio: how a page
  flows from the studio to the database to the route to the export file, where photos live, the
  practice copy, Send to live, restore / unpublish, adding a block, re-running the export, moving
  host, every env var and cron.
- **`site/pages/`** — the exported copy of every published Site Builder page (`README.md` there).
- `scripts/audit-office-requirements.mjs` — the requirements audit; `tests/` — `node --test tests/*.test.mjs`.
- `scripts/build-release.mjs` — the release build (generators → export → `vercel build` → checks).

Deploy is by hand (`npx vercel deploy --archive=tgz`, `--prod` for live) after the pipeline in
`DO-NOT-BREAK.md` passes. Migrations live in `supabase/migrations/` and are applied separately;
they never deploy with the site.
