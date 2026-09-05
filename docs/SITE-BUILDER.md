# Site Builder — maintainer's guide

For a developer who has never seen this repo. Plain English, one screen at a time.
Written 2026-09-05 (branch `feat/site-durability`). If something here is wrong, the code wins —
fix this file in the same commit.

The site is a static Vercel site (`*.html` at the repo root) plus a handful of serverless
functions under `api/`. The **Site Builder** (staff portal → Page Studio → Open the Site Builder)
lets the office build pages from blocks without a developer. Those pages live in the database,
are served by one function, and are also written back into this repo as files so nothing is
ever only in the database.

## 1. How a page flows

```
studio (browser)  →  database  →  page route  →  clean path  →  export file (git)
trainer-backoffice/  ad_pages     api/ad-page.js   middleware.js   site/pages/<slug>.html
site-builder.js                   /p/<slug>        /<slug>         site/pages/<slug>.json
```

1. **Studio.** `trainer-backoffice/site-builder.js` (block pages) and `page-studio.js` (paid-ad
   pages). Every edit autosaves through `POST /api/pages` `{operation:"save_draft"}` into
   `ad_pages.draft_content`. The canvas renders with the same template the server uses
   (`lib/site-page-template.js` is loaded in the browser too), so what you see is what ships.
2. **Publish.** `POST /api/pages` `{operation:"publish"}` in `api/pages.js`:
   - runs the checklist (`sitePublishChecklist`) — plain sentences, refuses empty pages;
   - **checks every photo** (`lib/page-durability.js prepareMedia`): a photo still pointing at a
     practice bucket, a signed (temporary) link or an inline `data:` image is copied into this
     deployment's own bucket under `pages/<slug>/…` and the URL rewritten; a `blob:` URL (never
     uploaded) or a link that does not answer 200 refuses the publish before anything is written;
   - writes `published_content`, `published_revision + 1`, `status = published`, `published_at`,
     and one `ad_page_revisions` row (`kind = published`);
   - **verifies** (`verifyPublished`): the row reads back with content at the new revision; the
     real page route answers 200 for the slug (that is what `/p/<slug>` and the clean path run);
     `/api/pages-manifest` lists it (that is what middleware reads); `sitemap.xml` carries it.
     If any check fails the publish is **rolled back** to the previous revision (row restored,
     the attempt's revision row deleted) and the office sees
     `Not published — the check "<name>" failed (<detail>). The previous version (revision N) is still live.`
3. **Page route.** `api/ad-page.js` reads `ad_pages` by slug and renders `published_content`
   through `lib/site-page-template.js` (`renderSitePage`) or `lib/ad-page-template.js` for ads.
   Entrances: `/p/<slug>` (vercel.json rewrite, site + landing only), `/ads/<slug>` (ad only),
   and the clean path below. Not published → 404 page. Database error → the exported copy
   (`site/pages/<slug>.html`) is served with `X-LDTT-Served-From: export revision N`; only if that
   is missing too → 503.
4. **Clean path.** `middleware.js` (Vercel Edge Middleware) runs before the filesystem. For a
   one-segment path like `/about` it asks `/api/pages-manifest` (published site/landing slugs,
   edge-cached 60 s). Order: manifest says published → rewrite to the page route; manifest down or
   `ok:false` → read `/site/pages/index.json` (the export shipped with the deploy) and rewrite to
   `/site/pages/<slug>`; nothing knows the slug → the request continues to the static site
   (fail open). It never touches `/api`, `/trainer-backoffice`, `/assets`, `/lib`, `/ads`, `/p`,
   `/site`, anything with a dot, or the reserved paths.
5. **Export file.** `scripts/export-pages.mjs` writes every published page to
   `site/pages/<slug>.html` (the exact bytes the route serves — it runs the route in-process) and
   `site/pages/<slug>.json` (block content, theme snapshot, menus, title, type, path, who published,
   when, revision, image list with buckets), plus `site/pages/index.json`, `site/pages/INDEX.md`,
   `site/theme.json`, `site/menus.json`. `scripts/build-release.mjs` runs it before every build and
   only notes "SKIPPED" if the database is unreachable. Commit the result; git always has a copy.

## 2. Where things are stored

| Thing | Live | Practice copy |
| --- | --- | --- |
| Pages (draft + published) | `public.ad_pages` | `practice.ad_pages` |
| Versions | `public.ad_page_revisions` | `practice.ad_page_revisions` |
| Theme + menus + last health run | `public.site_settings` (keys `theme`, `navigation`, `site_health`) | `practice.site_settings` |
| Photos, logos, MP4 | bucket `trainer-page-assets`, keys `site/<time>-<name>.<ext>` (uploads) and `pages/<slug>/<hash>-<name>` (copied at publish) | bucket `practice-trainer-page-assets`, same keys |
| Static pages | `*.html` in the repo root (about.html, contact.html …) | same files |
| Exported copies | `site/pages/*.html`, `*.json` | `scripts/export-pages.mjs --schema practice --out <dir>` |

One switch decides the schema and bucket: `lib/sandbox.js` (`dbSchema()`, `bucketName()`,
`supabaseRequest()`). `LDTT_SANDBOX=1` (set on Vercel Preview) = practice copy. Every server file
that talks to a table or a bucket goes through it; the audit fails otherwise.

Public photo URL shape: `https://ptnzaeprvkgjgtupmcty.supabase.co/storage/v1/object/public/<bucket>/<key>`.
The studio's **Where this page lives** panel (Page tab) lists every photo's bucket.

## 3. The practice copy

A full copy of live in the same Supabase project: schema `practice` + buckets `practice-*`,
same logins. The office can build, upload and publish there and see the page on the preview
deployment at `/<slug>`, `/p/<slug>` or `/ads/<slug>`. Nothing done there reaches the website
or real people. **Reset practice copy to match live** (Portal Access, Super Admin, typed full
name) wipes it and refills it from live. Details: `DO-NOT-BREAK.md` rules 5, 18–20.

## 4. Send to live

On the practice copy every page has **Send to live** (`api/send-to-live.js`). It copies the page
from `practice.ad_pages` into `public.ad_pages` as a **draft** (never `published_content`), copies
its photos from `practice-trainer-page-assets` to `trainer-page-assets` (same key, never moved),
re-points the URLs, and writes one revision note. Someone then opens the live portal and presses
Publish there — which runs the photo check and the verification above, so a photo that somehow
still points at the practice bucket is copied again at that moment.

**The typed name.** The office shares logins, so the button stays disabled until the sender types
their full name (two words). The name is kept in `practice.send_to_live_log.sent_by_name`, in
the live revision note ("Sent from practice copy by <Name> (<login>) on <date> ET"), in
`ad_pages.updated_by` on the live draft, and in the practice stamp "Sent to live ✓ by <Name>".
That is who to ask when a page arrives unexpectedly.

## 5. Everyday operations

**Restore a version.** Studio → Page tab → History → **Restore** on any "Published vN" or "Draft vN"
row. It puts that version back into the draft (`{operation:"restore", revision_id}`); press
Publish to make it live. The list is `ad_page_revisions` for that page. From SQL:
`select id, revision, kind, created_by, created_at from public.ad_page_revisions where page_id = '<id>' order by revision desc`.
The exported `site/pages/<slug>.json` `content` object can also be pasted back as a draft through
`{operation:"save_draft", id, content}` if the database row is ever lost.

**Unpublish back to static.** Studio → Page tab → **Take this page offline** (`{operation:"unpublish"}`).
`status` becomes `draft`, `published_content` is cleared, the slug leaves the manifest within a
minute, and the static file (`about.html` etc.) serves again. The draft and the versions are kept.
The next export removes `site/pages/<slug>.*`. Remove a page completely: **Remove this page**
(Super Admin, `status = archived`).

**Re-run the export.** From the repo root with `SUPABASE_SERVICE_ROLE_KEY` in the environment:

```
node scripts/export-pages.mjs                      # live pages → site/pages/, site/theme.json, site/menus.json
node scripts/export-pages.mjs --check              # exit 1 if the files differ from the database
node scripts/export-pages.mjs --schema practice --out /tmp/practice-export
node scripts/export-pages.mjs --rows dump.json     # no key: a JSON dump {ad_pages, ad_page_revisions, site_settings}
```

Then commit `site/` and deploy. `scripts/build-release.mjs` does the first line for you.

**Run the health check by hand.**

```
node scripts/site-health.mjs --base https://www.lorenzosdogtrainingteam.com            # needs the key
node scripts/site-health.mjs --base https://<preview>.vercel.app --from-export          # no key: uses the deploy's own export files
curl -H "Authorization: Bearer $CRON_SECRET" "https://www.lorenzosdogtrainingteam.com/api/cron/site-health?dry=1"
```

Exit code 1 and `broken: […]` mean a page or a photo is not answering 200. `stale: […]` only
means the export in git is behind the database — re-run the export and deploy.

## 6. Adding a block type

One file: `lib/site-page-template.js`.

1. Add the block to `BLOCK_TYPES` (type, label, group, description).
2. Add its blank in `blankBlock()` (every field with a default).
3. Add its normaliser in `normalizeBlock()` — keep only the fields you render, run every string
   through `text()`, every URL through `safeSrc()`/`safeUrl()`, every colour through `safeColor()`.
   Rich HTML must go through `sanitizeRichText()`. Never store raw HTML the office typed.
4. Render it in `renderBlock()`; add its checklist line in `sitePublishChecklist()`.
5. The studio's field panel lives in `trainer-backoffice/site-builder.js` `blockFields()` —
   add the inputs there (the `F()` helper takes label, path, value, options).
6. Media fields: name them `image`, `bgImage`, `video`, `poster`, `logo`, `favicon` or `src` so
   `lib/page-durability.js` finds them for the photo check (`MEDIA_KEYS`).
7. Add a case to `tests/site-builder.test.mjs` "every block type renders from its blank" (it loops
   over `BLOCK_TYPES`, so usually nothing to write) and run `node --test tests/*.test.mjs`.

## 7. Moving to another host

The pages do not depend on Vercel except for three glue points:

- **Middleware** (`middleware.js`) — the clean-path takeover. On another host, either serve
  `/<slug>` through the page route for slugs in `/api/pages-manifest`, or simply deploy
  `site/pages/*.html` as static files at `/<slug>` (they are complete pages) and drop the
  middleware. The `site/pages/index.json` lists which slugs are published.
- **Rewrites** (`vercel.json`): `/p/:slug` and `/ads/:slug` → `api/ad-page.js`; `/sitemap.xml` →
  `api/sitemap.js`. Any host with a rewrite rule or a small Node server can do the same
  (`scripts/page-studio-local.mjs` shows all the routes mounted on plain `node:http`).
- **Cron**: `/api/cron/site-health` daily with the `CRON_SECRET` bearer.

The functions are plain Node (CommonJS, no dependencies) and read/write Supabase over REST with
the service key. The database and buckets stay where they are.

## 8. Environment variables and crons

| Name | Where | What |
| --- | --- | --- |
| `SUPABASE_URL` | Vercel (all) | project URL (defaults to the LDTT project) |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel (all), your shell for the scripts | server key; never in the browser, never printed |
| `LDTT_SANDBOX` | Vercel Preview only (`1`) | makes this deployment the practice copy (`practice` schema, `practice-*` buckets) |
| `CRON_SECRET` | Vercel | bearer for manual runs of `/api/cron/*` (Vercel's own cron sends `x-vercel-cron`) |
| `DSN_AGENT_TOKEN` | Vercel Production | lets the health check file an approval in DSN Command when a page is broken; unset = no approval, everything else still runs |
| `DSN_COMMAND_APPROVAL_URL` | optional | defaults to `https://dsn-command.vercel.app/api/agent/approval` |
| `SITE_HEALTH_BASE_URL` | optional | which site the health check probes (default: the live site on production, the deployment URL on previews) |
| `ARCHIVE_AFTER_DAYS` | optional | for the lead-archiving cron, unrelated to pages |

Crons (`vercel.json`): `/api/cron/archive-leads` 08:00 UTC; `/api/cron/site-health` 08:30 UTC.
Vercel does not run crons on preview deployments.

## 9. DO-NOT-BREAK rules that apply

Read `DO-NOT-BREAK.md` before changing anything. The ones this guide touches:

- **5** the practice copy is a separate schema; every server Supabase call goes through
  `supabaseRequest()`.
- **18–19** Send to live writes a draft only, copies photos, carries the typed name.
- **21** one table (`ad_pages` + `page_type`), settings in `site_settings`.
- **22** block pages never store HTML the office typed; the sanitiser allow-list.
- **23** a published page wins over a static file only through `middleware.js`, which fails open.
- **24** the ten `trainer-opportunity-*` recruiting pages are untouchable.
- **25** entrances are strict (`/ads` = ad only, `/p` + clean = site/landing only, 404 otherwise).
- **26** every served page carries the shared head (pixel, Google tag, canonical, OG, footer).
- **27–30** (this branch) publish verification + rollback, export files in git, fallback order
  manifest → export → static, nightly health with DSN approval only for a broken page.

Verification before calling any change done: `node --check` on every touched file,
`node --test tests/*.test.mjs`, `node scripts/audit-office-requirements.mjs`, regenerate the ten
recruiting pages with zero diff, and on a preview: publish a page with a photo, open `/p/<slug>`
and `/<slug>`, run `scripts/site-health.mjs --from-export`, run `export-pages.mjs --check`.
