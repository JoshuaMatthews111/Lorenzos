# Lorenzo's Dog Training Team — DO-NOT-BREAK

Written 2026-09-02 (Claude) from verified live state, before the trainer-deals build.
Copy also lives at the repo root. Update both.

**Live:** lorenzosdogtrainingteam.com · Vercel `ldtt-site` · deployed by hand with
`npx vercel deploy --prod` from `~/Desktop/codex-playground/lorenzo_concept1_site`.
Production runs branch `fix/trainer-pages-metrics` as of 2026-09-10 (see rule 48); the
practice copy is a preview alias (rule 50), never `--prod`.
**Database:** Supabase **LDTT** `ptnzaeprvkgjgtupmcty` (its own org). Never confuse
with `kudsexewnvprhsdcxzhy` (brighter day / DSN Command). Always pass the ref.

## Protected behaviours (verified working before this build)

1. **The office lead pipeline and its counts.** 152 leads across 13 real sources;
   dashboard donut, Leads table, reports and CSV export all read `allLeadRows()`.
   The only intentional change is that rows stamped `raw_payload.qa = true` are
   held out of every count (2 old "QA release verification" rows). Nothing else
   about Leads-tab numbers may move.
2. **The Sales tab starts EMPTY.** It shows only leads with
   `raw_payload.sales_pipeline = true` (bot-handled) plus trainer-submitted deals.
   It must never re-bucket existing leads by status — that would double-count
   against the Leads tab.
3. **Lead → client conversion trigger** `private.sync_client_from_converted_lead`
   fires on `became_client` and upserts `clients` on `lead_id`. 7,285 client rows.
4. **RLS on every table.** Admin policy uses `private.is_admin()`; trainer own-row
   policies use `private.is_active_portal_user()` + `private.current_trainer_id()`.
   New tables must follow the same pattern.
5. **The practice copy is a separate schema, not a read-only view** (rewritten
   2026-09-05, branch feat/practice-copy; the old "every write returns 423" model is
   retired). `LDTT_SANDBOX=1` (Vercel Preview) makes `lib/sandbox.js` `dbSchema()`
   answer `practice` instead of `public` and `bucketName(x)` answer `practice-x`.
   Schema `practice` (+ helper schema `practice_private`) is a full copy of live —
   every table, column, default, constraint, index, FK, function, trigger, RLS
   policy, view, grant, storage policy and realtime membership — built from the
   live catalog by `practice.sync_structure_from_live()` in
   `supabase/migrations/20260905200000_practice_schema.sql`. Logins (`auth.users`)
   are shared on purpose; everything else is separate. Exact rules:
   - Every server Supabase call goes through `supabaseRequest()` (adds
     `Accept-Profile`/`Content-Profile: practice` on `/rest/v1`, rewrites the bucket
     segment on `/storage/v1/object`). A new API file that talks to a table or a
     bucket MUST use it; `scripts/audit-office-requirements.mjs` fails otherwise.
     The browser client (`trainer-backoffice/supabase.js`) asks `/api/environment`
     and does the same; realtime subscribes to the practice schema.
   - On the practice copy these WORK and land in `practice.*` / `practice-*`:
     lead moves, notes, deals, uploads, trainer records, trainer publish (RPC
     `publish_trainer_page` resolves in `practice`), Page Studio create/save/
     publish/restore/archive, portal-user role/disable/restore, reviews.
   - These stay blocked with the plain 423 message and must stay blocked:
     Communications `send_test` / `send_campaign_batch`, `api/portal-password-reset.js`,
     `api/reset-portal-password.js`, `api/webhooks/*`, `api/form-delivery.js`
     (Google Sheet / FormSubmit fan-out), `manage-portal-user` `create-account`,
     and `changePassword` in the browser. `api/ensure-trainer-user.js` never calls
     `/auth/v1/admin` on the practice copy (it links an existing login by email or
     enables the trainer with no login). Nothing on the practice copy may create,
     change or delete an auth user.
   - `practice.reset_from_live()` (service role only) truncates `practice.*` in one
     FK-safe statement and copies every row from `public.*`; `api/practice-reset.js`
     (sandbox only, Super Admin only) calls it and empties the `practice-*` buckets.
     It must never be pointed at `public`.
   - Live is byte-for-byte unchanged: `LDTT_SANDBOX` unset ⇒ `dbSchema()` is
     `public`, `bucketName(x)` is `x`, `supabaseRequest()` returns path and headers
     untouched. The migration creates nothing in `public` and drops nothing.
   - PostgREST exposes the schema through `alter role authenticator set
     pgrst.db_schemas = 'public, graphql_public, practice'`
     (`20260905200100_practice_schema_exposed.sql`). `public` stays first.
6. **Communications hub**: claim/release/mark-contacted, closed-status list in
   `api/communications.js`, Resend sends (capped 100/day on free plan), Twilio
   webhooks in `api/webhooks/`. Do not touch template merge logic
   (`normalizeMergePlaceholders` / `mergeTemplate`) — it broke a live send on 2026-08-19.
7. **Trainer portal**: trainers see only their own leads/pages/submissions; they
   cannot reach `api/operational-mutation.js` (admin-only). Trainer writes go
   through their own endpoints (`submit-content-review.js`, now `submit-deal.js`).
8. **Portal auth**: `window.LDTT_PORTAL.accessToken()` for bearer tokens; demo
   login `admin` / `doglovers26` works offline when the API is unreachable.
9. **`.vercelignore` excludes `supabase/`** — migrations never deploy with the
   site. Apply them to LDTT via Supabase MCP / CLI, then deploy the code.
10. **Lead status vocabulary** is a DB CHECK constraint. `first_session_payment`
    was retired 2026-09-02 (0 live rows). Money detail lives on `deals`, not leads.

## Verification recipe (run before calling any change "done")

- `node --check trainer-backoffice/app.js api/*.js api/cron/*.js` all pass.
- Leads tab total = live `select count(*) from leads where coalesce((raw_payload->>'qa')::boolean,false) = false`.
- Sales tab shows 0 leads and 0 deals until a bot/test lead or deal exists.
- A trainer login sees no admin views (`canAccessAdminView('sales')` false for office_admin).
- `curl -s https://lorenzosdogtrainingteam.com/trainer-backoffice/app.js | grep -c SALES_STAGES` > 0 after deploy.
- Submit-deal rejects collected > sold with HTTP 400 and never writes.

## Meta pixel + Conversions API (added 2026-09-04, Claude)

11. **The Meta pixel is emitted by the generators, never pasted into HTML.**
    `build.py` (`META_PIXEL_HEAD`), `scripts/generate-market-pages.mjs` and
    `scripts/generate-trainer-opportunity-pages.mjs` all emit the same snippet.
    Every page with a `contact-intake` form carries it (97/97 on 2026-09-04).
12. **One event ID per lead, browser and server.** The head snippet stamps hidden
    `meta_event_id`, `fbp`, `fbc` into the form on submit and passes `eventID` to
    `fbq('track','Lead')`. `supabase/functions/submit-contact` sends the same
    event_id to `graph.facebook.com/v21.0/<pixel>/events` (`sendMetaConversion`).
    Meta de-duplicates on event_id, so a lead is never counted twice. The CAPI
    call is best-effort: it runs after the lead row is saved and can never fail
    the form response. It is a no-op until `META_CAPI_ACCESS_TOKEN` is set.
13. **QA rows never reach Meta.** `isQaSubmission` short-circuits the CAPI send.

Verification additions:
- `grep -c "eventID: id" dog-training-san-diego-ca.html` = 2 and
  `grep -l "fbq('track', 'Lead', { value: 250, currency: 'USD' });" *.html` = none.
- `node scripts/audit-office-requirements.mjs` passes (pixel checks included).
- `deno check supabase/functions/submit-contact/index.ts` passes.
- After deploying the function: `./scripts/deploy-meta-capi.sh --smoke` writes one
  qa-flagged lead and the function log shows `meta_capi_ok`.

## Staff portal typing safety net (added 2026-09-05, Claude, branch fix/missy-typing-wipe)

14. **Every box someone types into must be on the `typedFieldKey()` whitelist** in
    `trainer-backoffice/app.js` (`data-new-office-note`, `data-office-note-edit`,
    `data-client-note`, `data-submission-note`, `data-lead-search`,
    `data-application-search`, `data-client-search`, plus the design/flow fields).
    A box with an empty key is wiped by any `render()`. New typing fields must be added
    to that regex or they will regress Melissa's 2026-09-04 bug.
    Since 2026-09-11 (the password box that emptied while typing) there is a second net:
    a box with none of those attributes gets an automatic key from its other stable
    attributes (id, type, placeholder, aria-label, autocomplete, data-*), twins get
    "#1, #2…" ordinals, `enhancePasswordFields()` puts focus, caret and the Show state
    back after wrapping a password box, and a background redraw waits while someone types
    in an open `<dialog>` (delete page, restore, reset, publish names). Keep all four.
15. **"Add Office Note" empties its box before `render()`.** The safety net refills any
    typed box a redraw left empty, so a box still holding the saved wording would look
    unsaved. Keep the `textarea.value = ""` line before the repaint.
16. **The Applications screen draws `applicationDetailPanel()` exactly once**, at the
    `applications()` screen level. Drawing it inside the board or the table again makes
    the Add Recruiting Note button read a hidden duplicate textarea.
17. **Search focus comes back synchronously** (`restorePortalInputFocus()` calls `apply()`
    before the `requestAnimationFrame`). Moving it back to frame-only restore drops keys
    typed during the ~300 ms redraw.

Verification additions:
- `node scripts/audit-office-requirements.mjs` now carries four checks for the above (93 total).
- In the browser, with text in an office-note box: `render()` then `refreshOperationalData("poll"); flushPendingBackgroundRender()` must leave the text and focus in place.

## Send to live (added 2026-09-05, Claude, branch feat/send-to-live; rewritten for the practice schema on feat/practice-copy)

18. **Send to live is the ONLY practice-copy action that writes to a live table.**
    `api/send-to-live.js` copies one trainer page or one Page Studio ad page from the
    `practice` schema into the live `public.trainer_pages` / `public.ad_pages` row as a
    DRAFT. Exact limits:
    - it reads with `Accept-Profile: practice` and writes with `Content-Profile: public`
      EXPLICITLY (`schemaFetch(schema, …)`); it never uses the `supabaseRequest()` switch,
      because it is the one file that must talk to both schemas;
    - it writes `draft_content` (plus the draft-side columns: headline, slug, style,
      section order, `draft_revision` / `revision`, `updated_by`) and one revision entry
      "Sent from practice copy by <email> at <time>" (`ad_page_revisions` kind `draft`;
      `trainer_page_versions` with the note inside `content._note`);
    - it NEVER writes `published_content`, `published_revision`, `published_at`, never sets
      `status`/`page_status` to published, never sets `locked = true`, never touches
      `auth_user_id`. `assertDraftOnly()` runs on every body bound for `public` before it
      leaves the function. A page that is PUBLISHED on the practice copy arrives on live
      as a draft;
    - photos uploaded on the practice copy are COPIED (`/storage/v1/object/copy`, never
      move) from `practice-<bucket>` to the live bucket with the same key, and every URL
      in the row is re-pointed, so no live row ever references a practice file;
    - it never creates auth users, never sends email or SMS;
    - a trainer that only exists on the practice copy is created on live as a plain
      `enrolled` trainer with no login; an existing live trainer row is not modified;
    - it is idempotent: a second send matches the same live row (by id, then slug, then the
      trainer's page) and updates that draft; it never makes a second row;
    - it answers **404 outside the practice copy** (`if (!isSandbox()) return res.status(404)`,
      before auth), and 403 for any login that is not an active super_admin / office_admin;
    - every send is appended to `practice.send_to_live_log` so the practice copy shows
      "Sent to live ✓ at <time>" on that item. It never writes any other practice table.
    - the confirm dialog carries the bold red warning box: "You are copying this to the
      LIVE portal. It arrives as a DRAFT and is not public until someone presses Publish
      on the live portal. One page per click."
    Publishing on the real site stays on the live portal only.

Verification additions:
- `node --test tests/*.test.mjs` (9 tests, fake two-schema Supabase + fake Storage copy) passes.
- `node scripts/audit-office-requirements.mjs` carries the practice-copy checks (117 total):
  every server client on the schema switch, the blocked list above, send-to-live never
  writes published_content, reset is sandbox + super-admin only, the migration is additive.
- `LDTT_SANDBOX` unset: `POST /api/send-to-live` and `POST /api/practice-reset` → 404.
- Read-only SQL before/after a practice session: `select count(*) from public.<table>` for
  every table must be unchanged except by live traffic (site_events, lifecycle_events).
- On the practice copy: create a trainer, upload a photo (lands in
  `practice-trainer-page-assets`), publish, open `/<slug>` on the preview; publish a Page
  Studio page, open `/ads/<slug>` on the preview; move a lead, add a note, submit a deal;
  Reset → `practice.*` counts equal `public.*` again.

## Typed names + practice-copy public forms (added 2026-09-05, Claude, branch feat/practice-copy)

19. **Every action that leaves the practice copy or wipes it carries a typed full name.**
    Joshua: "ask them to enter the name of who is pushing those changes so it's not a
    surprise". Logins are shared in the office, so the login email is NOT enough.
    - Both Send-to-live dialogs (trainer page in `app.js`, Page Studio in `page-studio.js`)
      and the Reset dialog carry "Your full name" and keep the red button disabled until
      the box holds at least two words (`fullNameOrEmpty`). The Reset dialog says exactly
      "This wipes every practice change for everyone. Type your full name to continue."
    - `api/send-to-live.js` and `api/practice-reset.js` refuse a missing or one-word name
      with 400 BEFORE anything is read, written or wiped. Never move that check later.
    - The name is kept in four places and all four must stay: `practice.send_to_live_log.sent_by_name`;
      the live revision note "Sent from practice copy by <Full Name> (<login>) on <date time> ET"
      (`trainer_page_versions.content._note` / `ad_page_revisions.created_by`); the live draft's
      `draft_content._sent_from_practice.name` (trainer pages) or `ad_pages.updated_by =
      "<Full Name> <login> (from practice copy)"` (Page Studio reads the name back out of it);
      and the practice stamp "Sent to live ✓ by <Full Name> at <time>". The live tag reads
      "From practice copy — Sent by <Full Name> on <date>".
    - Resets go through `practice.reset_from_live_by(name, email)` which calls
      `reset_from_live()` and writes `practice_private.reset_log`. The log lives in
      `practice_private` ON PURPOSE: the reset truncates every `practice.*` table, so a log
      inside `practice` would wipe its own history. Never move it.
20. **A public form on the practice copy must never create a real lead, application, review
    or tracking row.** The four public Edge Functions (`submit-contact`,
    `submit-trainer-application`, `track-site-event`, `submit-content-review`) honour
    `x-ldtt-practice: 1` (`supabase/functions/_shared/practice.ts`): with it every table call
    carries `Accept-Profile`/`Content-Profile: practice` and uploads go to `practice-trainer-submissions`;
    WITHOUT it nothing is added and the request is byte-for-byte what it was. Live pages never
    send the header. The practice copy's public pages (`script.js`, `trainer-backoffice/app.js`
    trainer landing pages, `market-landing.js`, `ad-funnel.js`) send it.
    - Until the functions are DEPLOYED with the flag, `LDTT_EDGE_PRACTICE_FLAG_DEPLOYED` is
      `false` in `script.js` and `app.js`: the practice copy shows "PRACTICE COPY — this form is
      switched off here…" on every public form, disables submit, swallows submit at the document
      (capture) level and drops tracking. Flip it to `true` ONLY in the same commit that deploys
      the functions (DSN Command approval 1908fe77-39a6-4820-80d5-ed5dd42e62cc).
    - `api/form-delivery.js` stays 423 on the practice copy (fan-out to real inboxes).
    - 2026-09-12 (rule 72): `submit-contact` IS deployed with the flag (v9), so the practice copy's LEAD
      forms (`.contact-intake`, `.market-guide-form`, `.ad-exit-form`, `.office-lead-form`) are ON there and
      save practice leads. The global flag stays `false` because the other three functions are not deployed
      with it; their forms and tracking stay off.

Verification additions:
- `node --test tests/*.test.mjs` (12 tests: name refused 400 + accepted, name in log / live note / live stamp, reset name 400 + recorded).
- `deno test --allow-net --allow-env --allow-read supabase/functions/practice-flag.test.ts` (11 tests: with the header every call is practice; without it no profile header and no practice path).
- `node scripts/audit-office-requirements.mjs` = 122 checks (name gates server + UI, four places the name is kept, Edge flag, browser switch-off).
- On the preview with the practice testing login: `scripts/practice-names-proof.mjs dialogs send livetag reset`.
- Read-only SQL after a practice-site form submit: `select count(*) from public.leads` / `public.trainer_applications` unchanged and no row with the test email.

## Site Builder (added 2026-09-05, Claude, branch feat/site-builder)

21. **One table, three page types** (a fourth, `ad2`, on the practice copy only: rule 85). `ad_pages` keeps its name and gains `page_type`
    (`ad` | `site` | `landing`, default `ad`) + `title`; `site_settings` (key `theme`,
    key `navigation`) holds the site-wide look and menus. Both schemas (`public`,
    `practice`) carry the same structure (`20260905230000_site_builder.sql`, additive).
    `api/pages.js` is the one staff API for every type; `api/ad-pages.js` stays as a
    3-line alias so nothing that calls the old route breaks.
22. **Block pages never store HTML the office typed.** `lib/site-page-template.js`
    `normalizeSitePage()` keeps only the fields each block renders and escapes every
    string; the one rich-text field goes through `lib/html-sanitize.js`
    `sanitizeRichText()`, which rebuilds the fragment from an allow-list (p, br, strong,
    em, u, s, a[href], ul, ol, li, h2–h4, blockquote, img[src,alt]) and drops script /
    style / iframe / svg / math / form with their content. `tests/site-builder.test.mjs`
    runs 14 XSS payloads through it; the audit runs six live. Never add `dangerouslyHtml`
    or a raw-HTML block.
23. **A published Site Builder page wins over a static file ONLY through
    `middleware.js`.** Rewrites in vercel.json run after the filesystem, so the clean-path
    takeover (`/about`, `/contact`, `/services`…) is Edge Middleware that asks
    `/api/pages-manifest` (published `site`/`landing` slugs, edge-cached 60 s) and rewrites
    only those to `/api/ad-page?slug=…&via=site`. It fails OPEN (any error or > 900 ms →
    the request continues to the static site). It never touches `/api`, `/trainer-backoffice`,
    `/assets`, `/lib`, `/ads`, `/p`, anything with a dot, or the reserved paths. Unpublish
    removes the slug from the manifest and the static file serves again within a minute.
    The static files are never deleted or rewritten by the importer (`lib/static-page-importer.js`
    only reads).
24. **The ten `trainer-opportunity-*` recruiting pages are untouchable**: not importable,
    not in any starter, never mentioned by the builder, middleware or the manifest. The
    audit checks the generator still lists 10 and regenerates with zero diff.
25. **Entrances are strict**: `/ads/<slug>` serves only `page_type = ad` (and `ad2`, rule 85); `/p/<slug>` and
    clean paths serve only `site`/`landing`; anything not `status = published` with
    `published_content` answers 404; draft preview needs a staff bearer token.
26. **Every served block page carries the shared head**: Meta pixel + Google Ads tag from
    `lib/ad-page-template.js` (`metaPixelHead`, `googleAdsHead`), canonical, OG, the site
    `styles.css`, the site header/footer (saved menus, static menus when nothing is saved)
    and the `contact-intake` form markup identical to contact.html (so `script.js`, the
    Lead event and the practice-copy switch-off apply unchanged).

Verification additions:
- `node --test tests/*.test.mjs` (22 tests: 12 send-to-live + 10 site builder).
- `node scripts/audit-office-requirements.mjs` = 133 checks (11 new: sanitiser live, /p 404 rules,
  middleware fail-open + manifest filter, recruiting pages untouched, importer read-only,
  shared head, 17 blocks / 20+ fonts / contrast warnings / nav fallback, full-screen studio,
  migration additive + alias + includeFiles, sitemap fallback).
- `node scripts/page-studio-local.mjs` then `node scripts/site-builder-proof.mjs <dir>` (Playwright,
  in-memory stand-in): 30 PASS lines, 22 screenshots.
- On a deployment: `/api/pages` → 403 without a login; `/p/<unpublished>` → 404; `/about` still
  the static file while its Site Builder twin is a draft; `/ericbeck` and
  `/trainer-opportunity-cleveland-oh` unchanged; `/sitemap.xml` → 200 XML.

## Site durability (added 2026-09-05, Claude, branch feat/site-durability)

Joshua: "make sure when they make pages it pushes live and actually comes into the storage, so
things are not broken when they make a new page without me, or unfamiliar to us when we work on
it for maintenance in the future." Maintainer's guide: `docs/SITE-BUILDER.md`.

27. **A publish only counts when it really landed.** `api/pages.js` `publish`:
    - BEFORE the write, `lib/page-durability.js prepareMedia()` checks every photo / video /
      logo URL in the page. A URL that points at a practice bucket, a signed (temporary) link
      or an inline `data:` image is COPIED into this deployment's own bucket under
      `pages/<slug>/<hash>-<name>` (new object, never a move or a delete) and the URL rewritten;
      a `blob:` URL or a link that does not answer 200 refuses the publish in plain words and
      nothing is written.
    - AFTER the write, `verifyPublished()` reads the row back (published, new revision, content),
      runs the real page route in-process (what `/p/<slug>`, `/ads/<slug>` and the clean path
      execute) and requires 200, requires the slug in `/api/pages-manifest` (site/landing) and
      the page in `sitemap.xml`. Any failure → `rollbackPublish()` restores the previous
      `status / published_content / published_revision / published_at / slug / title` and deletes
      the attempt's `ad_page_revisions` row; the office sees
      `Not published — the check "<name>" failed (<detail>). The previous version (revision N) is still live.`
      Never move the media check after the write; never let a failed verification return 200.
28. **Git always has a copy.** `scripts/export-pages.mjs` writes every PUBLISHED page to
    `site/pages/<slug>.html` (byte-for-byte the route's output — it runs `api/ad-page.js`
    in-process) and `site/pages/<slug>.json` (content + theme + menus + title/type/path/
    published_by/published_at/revision/images), plus `site/pages/index.json`, `INDEX.md`,
    `site/theme.json`, `site/menus.json`. `scripts/build-release.mjs` runs it before `vercel build`
    and SKIPS with a note if the database is unreachable — the export must never fail a build.
    `--check` exits 1 on drift; `--rows dump.json` works with no key; `--schema practice --out <dir>`
    exports the practice copy anywhere. The files deploy with the site (`vercel.json`
    `includeFiles: site/pages/**` on `api/ad-page.js`, `api/pages.js`, `api/cron/site-health.js`).
    Never hand-edit `site/pages/*`; never add `site/` to `.vercelignore`.
29. **Fallback order is manifest → exported copy → static file, and it still fails OPEN.**
    `middleware.js`: manifest says published → page route; manifest down / slow / `ok:false` →
    `/site/pages/index.json` → rewrite to `/site/pages/<slug>`; otherwise the request continues
    to the static site. The matcher excludes `site/` so the export folder is never rewritten.
    `api/ad-page.js`: a database ERROR (not "not published") serves `site/pages/<slug>.html`
    with `X-LDTT-Served-From: export revision N` before answering 503; the `/ads` vs `/p`
    entrance rule (#25) applies to the exported copy too. A plain "not published" is still 404.
30. **Nightly health, Joshua only.** `api/cron/site-health.js` (vercel.json cron 08:30 UTC;
    manual with `Authorization: Bearer $CRON_SECRET`; `?dry=1` checks everything and writes /
    posts nothing) probes every published page's clean path and `/p/` for 200 from the page
    route, every image for 200, and compares `site/pages/index.json` (revision + html sha256)
    with a fresh render. Result → `site_settings.site_health` (the studio's "Where this page
    lives" panel shows it) and, when a page is BROKEN, one `audit_events` row
    (`site_page_broken`) plus ONE DSN Command approval per broken page, `type: "other"`,
    title exactly `LDTT: page <slug> is not serving`, product `bb51502e-eb05-4919-82ce-ed5a39a8d609`,
    bearer `DSN_AGENT_TOKEN`. A stale export is a warning, never an approval. Never on the
    practice copy (`isSandbox()`), never to the office, never a test/probe approval (they cannot
    be withdrawn). `scripts/site-health.mjs --base <url> --from-export` runs the same check from
    any machine without the key.

Verification additions:
- `node --test tests/*.test.mjs` (36 tests: 14 new in `tests/site-durability.test.mjs` — media
  classification, copy-in + rewrite, dead/blob refusal before any write, happy publish with the
  four checks, rollback for each failing check with the revision row removed, export bytes =
  route bytes + `--check` drift, route fallback to the export, middleware order, health
  broken/stale/dry-run + cron writes, the studio's durability data).
- `node scripts/audit-office-requirements.mjs` = 139 checks (6 new: publish verification +
  rollback, media copy-in, export files present for every published page at build, health cron
  exists, middleware fallback order, studio panel + guide).
- `node scripts/export-pages.mjs --check` after any publish on live (exit 0 = git matches).
- On a deployment: `node scripts/site-health.mjs --base <url> --from-export` → `ok: true`;
  `GET /site/pages/index.json` 200; `/p/<slug>` and `/<slug>` 200 with `x-ldtt-page-type`.

## Trainer onboarding (added 2026-09-05, Claude, branch fix/trainer-onboarding)

31. **The trainer wizard and the page editor only ever write to the trainer the office picked.**
    `mergeRemoteOperationalData` keeps a draft that is still being created (and the trainer being
    edited) in `state.trainers` when a poll answers without it, and never jumps
    `state.selectedTrainerId` to another trainer while `state.activeView` is `trainers` or
    `pageEditor`; `trainerById()` returns null there instead of falling back to `trainers[0]`.
    On 2026-09-05 the fallback wrote a new draft's name and email into Aryson Whorley's record.
    - Unnamed drafts keep their own `office-draft-<time>` slug (`trainers.slug` is unique).
    - One trainer object per trainer across reloads (`remoteTrainerToUi` mutates `existing`), and
      an edit stamped after the last save started (`_editedAt > _savedAt`) survives that save's reload.
    - Trainer saves are chained per trainer (`trainerSaveChains`); every `runRemoteMutation` that
      wraps `persistTrainerRecord` / `publishTrainerPageWorkflow` passes `reload: false`.
    - `publishTrainerPageWorkflow` checks the login (`ensure-trainer-user`) BEFORE the publish RPC;
      the API refuses a staff email (409 `staffLogin`) and hands back the trainers row version.
    - `api/operational-mutation.js`: duplicate slug/email answer 409 in plain words; one email per
      active trainer. Trainers save social links through `api/trainer-social-links.js` only.
    - `typedFieldKey()` carries the trainer editor boxes (`data-editor-field`, `data-profile-field`,
      `data-trainer-social-link`, …); a chosen file and a contenteditable inside `#pageEditorPreview`
      hold background redraws; the view handler's post-reload redraw goes through `backgroundRender()`.
    - `script.js`: `const publicEnvironment` is declared above the Find a Trainer roster code (TDZ).

Verification additions:
- `node --test tests/*.test.mjs` (18 tests: plain 409s, one email per trainer, staff-login guard, live
  creates the login with the temp password, practice never touches auth, trainer social links own-row).
- `node scripts/audit-office-requirements.mjs` = 132 checks.
- On the practice copy: `+ Add New Trainer` twice without naming the first → both save; a second trainer
  with the same email → plain 409 and the wizard stays on step 1; publish with a staff email → refused,
  page stays draft; Find a Trainer lists the newly published trainer; Delete Draft removes it everywhere.

## Publish guard (added 2026-09-05, Claude, branch fix/publish-guard; merged on release/2026-09-05)

32. **A trainer page can only be marked `published` when a real public page exists.**
    `api/operational-mutation.js` `publishGuardViolation()` refuses `page_status = published`
    on create and update (400, `publishGuard: true`, message exactly "This trainer has no
    published page yet. Publish the page from Trainer Network → Edit Page first.") unless the
    `trainer_pages` row carries `published_content` and `published_revision >= 1` — the two
    things only the `publish_trainer_page` RPC writes. The row is read through
    `supabaseFetch()` → `supabaseRequest()`, so on the practice copy the same two call sites
    read and write `practice.trainer_pages`. The portal mirrors the rule
    (`trainerHasPublishedPage`, first publish goes draft → RPC → published) and public reads
    plus Find a Trainer (`script.js`) only resolve rows with
    `published_content=not.is.null&published_revision=gte.1`.

## Release 2026-09-05 (branch release/2026-09-05 = feat/site-durability ← fix/trainer-onboarding ← fix/publish-guard)

33. **Real staff logins work on the practice copy, same permissions.** `auth.users` is shared;
    `practice.portal_users` is a row-for-row copy of `public.portal_users` after a reset. The only
    logins refused anywhere are the three sandbox testing emails, and only on LIVE
    (`lib/sandbox.js` `blockedOutsideSandbox`, `app.js` `isSandboxOnlyLogin` gated on
    `!window.LDTT_IS_SANDBOX`). On the practice copy the ONLY gates skipped are
    must-change-password and complete-your-profile (every forced jump to Settings — boot, view
    click AND `renderView()` — is behind `!window.LDTT_IS_SANDBOX`; 24 active live accounts still
    carry `must_change_password`, so an unconditional jump pins them to Settings with no way out).
    `changePassword` throws on the practice copy; `reset-portal-password` / `portal-password-reset`
    stay 423. Never add a login condition that reads the schema.

Verification (release 2026-09-05):
- `node --test tests/*.test.mjs` = 53 tests (36 durability/site/send-to-live + 6 onboarding + 6 publish guard + 5 login gate).
- `node scripts/audit-office-requirements.mjs` = 152 checks.
- Read-only SQL: `select * from public.portal_users except select * from practice.portal_users` (and the reverse) → 0 rows right after a reset, EXCEPT the three practice-only testing logins (superadmin@, officeadmin@, trainer@), which are inactive on live and active on practice by design (rule 46); `auth.users` = 45 = both portal_users tables; every practice portal user maps to an auth user.
- `trainer-backoffice/index.html` script tags all on `?v=20260905release`.

## QA pass 2026-09-05 (branch qa/2026-09-05, merged into release/2026-09-05) — the three office fears

34. **Every number comes from `trainer-backoffice/metrics.js`, and only from there.** Dashboard tiles,
    Leads board columns, donut, funnel, Sales totals and columns, Applications tiles / board / CSV,
    Clients counts, Reports tables and tfoot totals, trainer Dashboard / Performance, nav badges and
    every CSV call the same named functions over the same rows (`window.LDTT_METRICS` in the browser,
    `require("trainer-backoffice/metrics.js")` in Node — no DOM, no `state`). The QA hold-out
    (`raw_payload.qa = true` or a `^qa[_-]` name) applies to applications as well as leads now.
    Rules 1 and 2 (Leads-tab numbers unchanged; Sales = bot-handled leads + deals only) still hold.
    `tests/metrics.test.mjs` asserts dashboard == board == report == CSV for every figure on a fixture;
    the audit fails on any inline `.filter(...).length` for a listed figure in app.js.
    `api/cron/site-health.js` recomputes the key figures nightly from `public.*` with the same module,
    compares them with plain counts, and files ONE DSN approval `LDTT: numbers disagree: <figure>`
    per mismatch (cap 5); dry-run posts nothing; never on the practice copy.
35. **The top bar always says how fresh the screen is.** "Loading…" before the first payload,
    green "Live · updated hh:mm:ss" (server time: the API's `syncedAt` on 200, the `Date` header on 304 —
    never the client clock), red "Not updating since hh:mm — reload" the moment any poll fails
    (click reloads). Every `panel()` header carries "as of hh:mm". A login whose first payload fails
    is BLOCKED with "Live data did not load" + Retry / Sign out — there is no silent local-only mode
    for a real login. Demo login `admin` / `doglovers26` keeps working offline (rule 8) behind an
    explicit "Continue offline (demo data)" button.
36. **One address per copy, and the shells never cache.** `/api/environment` answers `canonicalHosts`
    (practice: `LDTT_PRACTICE_HOST`, default `practice.lorenzosdogtrainingteam.com`; live: the domain
    + www). `trainer-backoffice/old-copy-bar.js` (loaded by `trainer-backoffice/index.html` AND
    `staff.html`, before the portal boots, login page included) paints a red bar that cannot be
    closed on any other address: "This is an old copy of the practice portal. Bookmark
    practice.lorenzosdogtrainingteam.com instead." / "…of the staff portal. Bookmark
    lorenzosdogtrainingteam.com instead.", linking to the same path on the right host. `vercel.json`
    serves `/staff`, `/trainer-backoffice`, `/trainer-backoffice/` and every `/trainer-backoffice/*.html`
    with `Cache-Control: no-store`; every portal script tag on both shells sits on ONE `?v=` tag
    (the audit checks it). `staff.html` is the advertised office address and loads the full portal
    (app + page-studio + site-builder) on the release tag. DNS/domain for the practice address is
    DSN approval 865d99b4-7514-4c20-8ccb-a1c90709b7a6 (Bluehost `CNAME practice → cname.vercel-dns.com`).
37. **One auth helper, fail closed.** Every API verifies the bearer through `lib/portal-auth.js`
    `verifyPortalUser(token, { require: "any" | "admin" | "super" | "trainer" })`: `active`,
    `access_status` not disabled/revoked, admin ⇒ `permission_level` exactly `super_admin` or
    `office_admin` (NULL / unknown ⇒ refused and logged — never defaulted to super), trainer ⇒
    `trainer_id`. Per-op gates: `permanent_delete`, Page Studio `archive`, `manage-portal-user`,
    `reset-portal-password`, `practice-reset` are super only; communications claim / release /
    mark-contacted are own-lead only for a trainer. The browser mirrors it: an unknown
    `permission_level` is treated as office admin; `officeAdminViews` is the office menu.
    `/Users/presdinetaloffice/Desktop/LDTT Release 2026-09-05/ROLES.md` is the matrix; the audit
    requires no `/auth/v1/user` fetch outside the helper and one refusal test per role
    (`tests/portal-auth.test.mjs`). `api/form-delivery.js` only accepts the known hosts as Origin.

Verification (QA pass 2026-09-05):
- `node --test tests/*.test.mjs` = 88 tests (53 + 21 portal-auth + 8 metrics + 6 old-copy bar).
- `node scripts/audit-office-requirements.mjs` = 168 checks.
- Preview: `/api/environment` carries `canonicalHosts`; the red old-copy bar shows on the `*.vercel.app` address
  and the login page; each of the 3 sandbox logins lands on its own menu; office/trainer tokens get 403 from
  `manage-portal-user`, `practice-reset`, `permanent_delete`, `pages archive`; trainer 403 on another trainer's
  lead in communications; dashboard tiles = board columns = report = CSV (`window.LDTT_METRICS`).
- Nightly: `curl "$BASE/api/cron/site-health?dry=1" -H "Authorization: Bearer $CRON_SECRET"` → `numbers.ok: true`.

## Vercel Web Analytics (added 2026-09-06, Claude)

49. **Every public page carries `<script defer src="/_vercel/insights/script.js"></script>` right before `</head>`.** _(renumbered from 36 on 2026-09-10; the number was used twice)_
    Web Analytics was enabled on the Vercel project `ldtt-site` on 2026-09-06 (plan-included tier, $0) and
    production was redeployed from an exact copy of the live files plus this one line (98 pages; portal `app.js`
    untouched, md5 `035eb600`). `build.py`, `scripts/generate-market-pages.mjs` and
    `scripts/generate-trainer-opportunity-pages.mjs` emit the tag, so a rebuild keeps it. `generate-lp-test.mjs`
    copies its `<head>` from a tagged page and needs nothing. **Any release branch (e.g. `release/2026-09-05`) must
    carry the same line before it is deployed, or analytics goes dark again.**
    Check: `curl -sI https://www.lorenzosdogtrainingteam.com/_vercel/insights/script.js` is 200 and
    `grep -L _vercel/insights *.html` prints nothing. Rollback target if ever needed:
    `ldtt-site-9sixfsmxa` (prod before this change).

    **Speed Insights (same day):** every public page also carries
    `<script defer src="/_vercel/speed-insights/script.js"></script>` directly after the insights tag. Speed Insights
    was already enabled on the project (included tier; the "Plus" upgrade was NOT bought). Same generators emit it.
    Check: `curl -sI https://www.lorenzosdogtrainingteam.com/_vercel/speed-insights/script.js` is 200.
    Neither script touches the portal, the leads table, or the dashboard numbers (rule 1).

50. **The practice copy is an ALIAS, not a project.** `ldtt-sandbox.vercel.app` is an alias on the `ldtt-site` Vercel project pointing at a PREVIEW deployment; `LDTT_SANDBOX=1` is set on the preview target only. To update the practice copy: deploy a preview from the branch, verify `/api/environment` on the preview says `sandbox:true` and `schema:practice` (the old "write API returns 423" model is retired, rule 5), then `vercel alias set <preview-url> ldtt-sandbox.vercel.app`. Never use `--prod` for this. Production is a separate deployment and is not affected. _(renumbered from 36 on 2026-09-10; the number was used twice)_

51. **`LDTT_PRACTICE_HOST` must match the address the office actually uses.** `old-copy-bar.js` shows a red, uncloseable "This is an old copy" bar whenever the browser host is not the `canonicalHost` from `/api/environment`. On the preview target that value comes from `LDTT_PRACTICE_HOST` (currently `ldtt-sandbox.vercel.app`); with it unset the code falls back to `practice.lorenzosdogtrainingteam.com`, which does not resolve, so every visitor to the practice copy sees a false warning pointing at a dead address. Change this env var at the same time as any change to the practice address. _(renumbered from 37 on 2026-09-10; the number was used twice)_

## Sign-in session rules (added 2026-09-09, Claude)

41. **A page refresh never lands a signed-in user on the login box.** A stale
    token is renewed before the data request (`loadOperationalData` in
    `trainer-backoffice/supabase.js`), a 401 retries once after a renew, the
    who-am-I lookup retries once, and a failed data download after a valid
    sign-in check keeps the session and re-fetches (bootstrap in `app.js`)
    instead of showing login. The saved screen (UI_STORE_KEY) comes back.
42. **"Keep me signed in" is the user's choice, everywhere.** Unticked: the
    session lives in sessionStorage (this tab only) and must NEVER be written
    to localStorage — the old quota fallback did, and the office read it as
    "signs me in without asking". Ticked: localStorage. The practice copy no
    longer force-ticks the box.

## Public trainer pages (added 2026-09-10, Claude)

43. **A public page never depends on a portal-only script.** On 2026-09-09 the release
    shipped an `app.js` that throws when `window.LDTT_METRICS` is missing (rule 34). The
    28 static trainer pages (`/<slug>.html`, `body.public-site`) plus `trainer-profile.html`
    loaded `supabase.js` + `app.js` and never `metrics.js`, so every "Schedule this trainer"
    click on the website opened a blank page, and the nightly health check (HTTP 200 only)
    never noticed. Now: every root `*.html` that loads `trainer-backoffice/app.js` loads
    `trainer-backoffice/metrics.js` before it, on the same `?v=` stamp as the portal, and
    `app.js` only refuses to start without metrics when the page is NOT `body.public-site`
    (`IS_PUBLIC_PAGE`). `scripts/audit-office-requirements.mjs` enforces both.
    Before any deploy that touches `app.js` or the shells: open `/fredharris` in a real
    browser and confirm `#publicSite` has content and the console is clean. A 200 with an
    empty `<main>` is a broken page. Record of the incident:
    `~/Desktop/LDTT Trainer Pages Blank 2026-09-10/BEFORE.md`.

47. **SMS consent wording is ONE use case only (2026-09-10).** Twilio rejected the toll-free _(renumbered from 14 on 2026-09-10; the number was used twice)_
    verification twice: 30496 (use case did not match the summary) and 30504 (one opt-in box
    cannot cover several message types). The fix removed "promotional" and "offers" from the
    consent text everywhere. The box now describes customer care only: follow-up on the
    inquiry, scheduling/confirming the free evaluation, appointment reminders.
    The same single-use-case wording must stay identical in ALL of:
      build.py, ad-funnel.js, market-landing.js, scripts/generate-lp-test.mjs,
      trainer-backoffice/app.js, lib/ad-page-template.js, lib/site-page-template.js,
      every shipped *.html with sms_consent, plus terms.html and privacy-policy.html.
    Twilio reviewers read /contact, /terms and /privacy-policy — if any one of them says
    "promotional" again the verification fails. Do not re-add marketing wording to this
    number. Promotional texts need a SECOND number with its own separate opt-in box.
    The 10 trainer-opportunity recruiting pages (and scripts/generate-trainer-opportunity-pages.mjs)
    must not label their recruiting box "Promotional" either (fixed 2026-09-10), and the
    terms.html sample message must not mention offers.
48. **The live branch is `fix/trainer-pages-metrics`, not `sandbox`.** Verified 2026-09-10 by _(renumbered from 15 on 2026-09-10; the number was used twice)_
    byte-comparing live trainer-backoffice/app.js (822,687 bytes) against both branches.
    Rule 0 above (sandbox = production) is out of date. Always verify before deploying.

## Office fixes from the sandbox notes (added 2026-09-10, Claude)

44. **Every portal write goes through the server mutation, never a direct table PATCH.**
    "Update frontend" used `LDTT_PORTAL.update("trainers", …)` — row security silently
    refused it (PostgREST updates zero rows without an error), the toast said "Saved",
    and the badge flipped back to "Needs public profile update" after reload. That is
    the whole Missy bio mystery. `persistPublicTrainerField` now uses
    `operationalMutation`; the audit refuses any `LDTT_PORTAL.update("trainers"` call.
    A toast may only claim "Saved" for a write path that can actually fail loudly.

45. **The office board stage survives the round trip.** The database keeps fewer
    stage words than the board ("Interview Scheduled" and "Under Review" both store
    as `reviewing`; both Discovery stages store as `discovery_follow_up`). The exact
    stage rides `raw_payload.ui_status`, stamped by `persistApplicationRecord`, and
    metrics.js honors it only while `APPLICATION_STATUS_TO_DB[ui_status]` still equals
    the stored status — a stale stamp never overrides a real change. Tests cover both.
    Related fixes verified the same night: the application board renders
    `filteredApplicationRows({ filter: "All" })` so the search box works on it; lead
    cards carry no "pending" fillers and the source logos sit at the card foot;
    Page Editor and Page Studio carry two-door tabs (`pageWorkTabs`); specialty-advanced
    and become-a-trainer stay static-only for now: the importer drops their local
    videos, second button and stats band (review 2026-09-10). Terms, privacy-policy
    and onboarding do not slice into blocks and stay static-only too. The Trainer
    Bio reaches the public bio only after Publish succeeds (never before the RPC).

## Practice copy pulls from live on read (added 2026-09-10, Claude)

46. **The practice copy is live plus the team's practice work, never a stale photo.**
    Before `api/operational-data.js` reads on the PRACTICE deployment (`isSandbox()`),
    it calls `practice.pull_from_live()` once (bounded by 1.5 s, never throws). That
    function exists only in schema `practice`, is owned by the read-only role
    `practice_puller` where the platform allows it, and writes only `practice.*` and
    `practice_private.*`. Every statement that names `public.*` is a SELECT; the
    audit refuses the migration text otherwise, and refuses a cron for it. Rules:
    office tables (leads, applications, clients, notes, ...) — a row live changed
    since the last pull replaces the practice row, and the old practice row is kept
    in `practice_private.pull_log`; a practice edit on a row live has not touched
    stays. Page-work tables (trainers, trainer_pages, versions, submissions,
    reviews) — new live rows come in, a team-edited practice row is never
    overwritten. Team-created practice rows are never touched or deleted. Live
    deletes are mirrored for rows that came from live. `ad_pages`,
    `send_to_live_log`, `reset_log` and the buckets are never pulled;
    `site_settings` only for `portal_visit_stamps`. Every practice user trigger
    carries `WHEN (coalesce(current_setting('ldtt.practice_pull', true), '') <> 'on')`
    so a copied row is byte-for-byte live's (same version, no extra revision,
    client, code or audit row); `apply_pull_guards()` re-adds the guard after a
    Reset, and the pull refuses to run while any guard is missing. Kill switches:
    `practice_private.pull_settings.enabled` (no deploy) and `LDTT_PRACTICE_PULL=0`
    on the preview target. The three practice-only logins (superadmin@,
    officeadmin@, trainer@) are OFF on live and ON on the practice copy: the pull
    never touches their `portal_users` rows and a Reset switches them back on.
    The top bar says "Same as live" or "Last matched live at hh:mm". Live's
    `/api/operational-data` JSON and ETag are unchanged (no `practiceSync`, no
    `pull:` piece). Proof: `/tmp/pull-tests.sql` on a throwaway Postgres (13
    checks incl. live checksums unchanged across every pull), the audit, and the
    parity SQL in `scripts/practice-pull-proof.sql`.


## Full practice-copy test, second pass (added 2026-09-10, Claude)

A five-tester run with skeptics (15 agents) found 16 confirmed problems. All are fixed on
branch `fix/trainer-pages-metrics`, proven by `tests/practice-pull.sql` (25 checks, twice,
live byte-identical after every pull), `node --test tests/*.test.mjs` and the office audit.

52. **The practice pull never lets one row block a table** (hardening of rule 46,
    `supabase/migrations/20260910130000_practice_pull_hardening.sql`). Every live row is
    applied on its own. A clash on another unique key: a practice row's text key gets a
    `-practice-xxxx` suffix (logged `renamed_practice_row_for_live`); on office tables a
    non-text clash is live-wins with the practice row logged; otherwise the live row is
    held back in `practice_private.pull_skips` and the chip says "Same as live except N
    records". A child whose parent the team deleted is held back and retried on the next
    reconcile. Each table copies at most `max_rows_per_table` (1000) per pull, so a catch-up
    always commits progress. Row hashes use only the shared columns
    (`pull_hash`, `pull_state.hash_cols`); a column change re-hashes untouched rows.
    Tables without `updated_at` get live edits on reconcile through `live_hash`.
    A live delete never takes team rows with it (parent kept, logged); every deleted
    practice row is logged first. Page work the team deleted is not brought back.
    Missing trigger guards or grants are re-applied by the pull itself (no Reset).
    A Reset only flags `needs_seed`; the next pull seeds (the Reset stays under 8 s).
    `fresh`/`busy` answers report the real state; `last_ok_at` on failure is when the
    failing table last matched. The endpoint's timeout path reads `practice.pull_last_ok()`
    (no row scans) with its own 300 ms deadline. The pull functions are owned by
    `practice_puller` (`20260910131000_practice_pull_owner.sql`, fails loudly), which has
    no write right on any live table. Caller checks use `session_user` / the JWT role.

53. **The API sends what the screens count.** `api/operational-data.js` now includes
    `deals`, `dealPayments`, `clientsTotal`, `clientsTruncated` and `trainer-backoffice/
    supabase.js` keeps them. Before, the Clients total read 500 instead of the real count,
    Sales never showed a trainer deal, and a trainer's My Deals was empty (live too).

54. **The visits tile counts late visits.** The stamps-cache delta uses `created_at`
    (insert time), stored as `newest_created_at`; an old-format cache is rebuilt once on
    live (never on the practice copy, which pulls live's cache).

55. **Application stage stamps are merged, never replaced.** The browser sends only
    `raw_payload.ui_status`; `api/operational-mutation.js` merges it into the stored
    `raw_payload`. A stamp is honoured only when it is one of `APPLICATION_COLUMNS`.
    `ui_status` and the `delivery_*` bookkeeping never show as application fields.

56. **A draft save never takes a live trainer page offline (FIXED 2026-09-10, Joshua).**
    `api/operational-mutation.js` `keepLivePageLive()`: on a page that is published +
    locked + has a published copy, every update except action `trainer_page_published`
    keeps `page_status: published` + `locked: true`, never writes `published_*`, and parks
    the row settings the public page reads (`TRAINER_PAGE_PUBLIC_ROW_FIELDS`: slug,
    template_key, headline, subheadline, approved_bio, photos, socials, logo, hero,
    style_settings, section_order, public_url) in `draft_content._row` until Publish.
    Server-side on purpose: an old open tab cannot take a page down either. The editor
    overlays `_row` (`remoteTrainerToUi`); the public page passes `draft_content: {}`
    (`mergePublishedTrainer`) so drafts never show. "Return To Draft" on a live page now
    says "Edit Live Page" and opens the Page Editor. Karemela Sefferin's page (offline
    2026-08-05) was restored to revision 61 on 2026-09-10 with an audit row.

57. **No background redraw during a card drag** (`dragInProgress`); an audit drag of one
    applicant saved another. Lost Reasons uses `METRICS.lostLeadRows` over the report date
    range. Top-level `METRICS` reads in `app.js` use `?.` so a missing `metrics.js` can no
    longer blank a public page (rule 43 now actually holds).

58. **Reset practice copy is hard to reach on purpose (Joshua 2026-09-10).** It sits ONLY at
    the very bottom of Settings (practice copy, Super Admin), folded shut under "Advanced:
    practice copy tools". Its red button stays disabled until the full name AND the word
    RESET are typed. Never put it back at the top of Portal Access or any busy screen:
    the office will press it and blame someone else. Every reset is logged (name typed,
    login, time) in practice_private.reset_log.

59. **Deleting a trainer page needs a full name + the deleter's password, and is undoable
    (Joshua 2026-09-10).** Page Editor → bottom → "Delete this trainer page" (folded).
    Dialog: full name, the password they sign in with, and a tick; the red button stays
    disabled until all three. Server `delete_trainer_page` checks the password against
    Supabase Auth (never stored, logged or echoed), sets `page_status: archived`,
    `locked: false`, `archived_at/by`, keeps both content copies, and writes audit action
    `trainer_page_deleted` whose actor_name is "<typed name> (login: <portal user>)".
    `restore_trainer_page` (full name) puts the last published version back live and logs
    `trainer_page_restored`. Both show in Recent Activity. Tests:
    tests/trainer-page-draft-delete.test.mjs.
    Database backstop (migration 20260910140000_publish_refuses_deleted_pages): all four
    publish_trainer_page copies (public, private, practice, practice_private) raise "This
    trainer page is deleted..." on a page_status 'archived' row, so no tab (old build, stale
    state, direct RPC) can publish a deleted page back online. The portal also refreshes
    pageDeleted mid-edit and never calls the publish RPC after a save that comes back deleted.

60. **Public wording never says "office-approved" (Rachel + Missy, 2026-09-11).** To the
    public it reads as sketchy. The review sections say "Client + Google Reviews" / "Client
    feedback", recruiting pages say "Real stories", trainer loading screens say "the trainer
    profile". The builders (build.py, scripts/generate-trainer-opportunity-pages.mjs) carry the
    same wording so a rebuild cannot bring it back. Old setup forms saved "Office-approved
    client testimonial." as placeholder reviews (Brady DeRemer, Tabatha Shelley, slug "s");
    `placeholderReviewCopy()` treats that text as an empty slot, so it never renders.
    Staff-only portal labels may still say it.

61. **Website text spots: the office edits words, the code owns everything else (Joshua
    2026-09-11).** `site_text_marker.py` tags the plain-text headlines, paragraphs, labels and
    button words of the 8 main pages with `data-edit="<key>"` (never inside header, footer,
    nav, forms, the texting consent wording, phone numbers, emails or tel:/mailto: links)
    and writes `site-text-manifest.json`. `build.py` runs it after every build.
    Keys are reused ONLY on an exact match (same tag, same place on the page = classes of the
    element and its 3 nearest ancestors, same words); a spot that only moved keeps its key
    when unique; identical spots pair only if their count is unchanged; a reworded or unsure
    spot gets a NEW key; retired keys are never reused. Each build prints moved / new /
    removed spots. Every spot's match also includes its section heading (the nearest heading
    before it; for a heading, its parent heading), so a class such as "featured" moving to
    another card can never carry office text to that card. Look-alike spots that still cannot
    be told apart are not tagged. A missing page keeps its
    manifest entry. Nothing is cached in the browser. Office text lives in `site_text` (draft_value, live_value, base_default =
    the code words it was published against). SAFETY NET: `api/site-text.js` serves live
    office text only while base_default equals the spot's current code words, so office text
    can never show on a spot it was not written for; after a code change the editor shows
    "Your text is saved but hidden… Keep my text" (operation confirm, full name, logged
    `site_text_confirmed`). Page Editor > Main Website: click a spot to edit (draft), "Publish
    this page's text" and "Reset to code text" need a full name and are logged. The public
    swap (`script.js`) is textContent only and fails open. On the practice copy live wins
    per spot (pull mode office). Anything not tagged stays code-owned: changes go through Joshua.
62. **Review photos: one 4:3 whole-photo frame everywhere, signed links on trainer pages
    (Joshua 2026-09-11).** The homepage (`styles.css .homepage-approved-review-media`),
    the trainer pages (`trainer-backoffice/styles.css .trainer-review-media`) and the Page
    Editor preview (`.review-frame-preview`) all use `aspect-ratio: 4/3` with
    `object-fit: contain`, so the whole photo always shows and the office's "how this photo
    sits" choice (`content_submissions.photo_position`) is the same on every page. The
    `trainer-submissions` bucket is PRIVATE: a plain public link answers 400 and the
    broken-image guard hides the photo. Trainer pages therefore call
    `refreshPublicReviewMedia()` (app.js) → `/api/approved-homepage-reviews?destination_type=trainer_page`
    for signed links + positions after every public render; the photo choice is also saved
    with the page at publish time. `signedMediaUrl()` returns "" for a file it cannot sign
    (the practice bucket has no copy of live uploads) instead of failing the whole list.
    Trainer pages take `SITE_ASSET_VERSION` for the portal stylesheet — never a fixed stamp.
63. **Lead Journey Test is PRACTICE ONLY and texts testers only (Joshua 2026-09-11).**
    `api/lead-journey.js` answers 404 unless `isSandbox()`; admin login required. Tables
    `practice.lead_journeys` / `practice.journey_messages` exist ONLY in the practice
    schema (nothing in `public`, so the pull ignores them). Every text is claimed
    (scheduled → sending) before it is sent, goes only to a phone that is an ACTIVE row in
    `communications_testers` (checked again at send time; anything else is `skipped`),
    is prefixed `[LDTT TEST]`, and is capped at 60 an hour. Wording is Tim + Angela's
    (`lib/lead-journey.js`, from `docs/revenue-pathway/`); templates marked `office: true`
    fill gaps the documents left. Marketing messages (`HELD_MARKETING`) are not sendable:
    the toll-free number is approved for CUSTOMER_CARE only. Routing is the Cleveland test
    map only (`MARKETS`); other ZIPs go to a person. "fast" speed = 1 plan hour per minute;
    "real" speed holds customer texts 9 PM–8 AM Eastern. The portal screen (`pathwayTest`)
    is in the nav only when `window.LDTT_IS_SANDBOX` is set.
    **UPDATED 2026-09-12 (portal chain step 5): the screen is OFF the menu.** Joshua: "not needed
    since it's supplied and functional now" — the real pipeline (rules 71-75) replaces it.
    `leadJourneyTestEnabled()` in `app.js` returns `LEAD_JOURNEY_TEST_IN_MENU && window.LDTT_IS_SANDBOX`,
    and `LEAD_JOURNEY_TEST_IN_MENU` is `false`, so neither the menu nor `canAccessAdminView("pathwayTest")`
    offers it (a saved screen pointing at it falls back to the Dashboard). Everything else is KEPT and
    still obeys the rules above: `pathwayTestScreen()`, `api/lead-journey.js` (404 on live), the practice
    tables, the tester-only texting and the sandbox clock (Make 6239634, inactive). To bring it back, set
    the constant to `true` (practice copy only, as before) and bump the cache stamp. Do not delete the code
    without Joshua. Checked by `tests/media-layout.test.mjs` and the rule 76 audit check.

64. **Get Started has no "I'm also interested in" boxes** (added 2026-09-11, Claude). The
    Investor network / Donor or project support / Specialty training checkboxes were removed
    from both forms on `get-started.html` (commit d42139c) and deployed to live and the practice
    copy. Do not re-add them. Its form must match the ad landing pages: same fields, same
    SMS consent wording. Check: `curl -sL https://lorenzosdogtrainingteam.com/get-started | grep -ci "investor network"` → 0.

## Lead Journey roles + hover effects (added 2026-09-11, Claude, second pass)

65. **The Style tab's "Button hover effect" is per page and survives the round trip.**
    `content.hoverFx` (one of lift/grow/glow/pulse/none, or "" = design default) is
    sanitized in `normalizeContent`, rendered only from `hoverFxCss()` in
    `lib/ad-page-template.js` (hover:hover media guard + prefers-reduced-motion off
    switch), and travels with the page through Send to live like any other content
    field. "" must emit NO css so existing pages render byte-identical.

66. **The sandbox clock rings only the tick.** `api/lead-journey.js` accepts
    `operation:"tick"` without a login ONLY when the `x-journey-key` header equals
    `LDTT_JOURNEY_TICK_KEY` (set on the Vercel PREVIEW target only; key also in
    Env Vault/make/.env.local). Any other operation with that key answers 403; live
    still answers 404 (rule 63). The outside clock is Make scenario 6239634
    ("LDTT sandbox clock"), kept INACTIVE except while testing — at 5 minutes it
    costs 288 Make operations a day of the plan's 10,000 a month.

67. **Starting a test lead says who plays each part.** The start notice lists
    Customer/Trainer/Leader/Operations by tester name and warns when one phone
    plays several parts. Keep that warning: "every text came to me" must never be
    a mystery again.

68. **Page Editor layout fields are whitelists, and empty means the design's own.**
    `content.cover` (card thumbnail; falls back to the hero photo), per-section
    `width` ("", wide, full) and `size` ("", small, medium, large, full), and the
    "image" section type (photo/alt/caption/link, empty photo renders nothing) are
    all sanitized in `normalizeContent` — never render an office-typed value into
    a class name. The pages LIST endpoint selects cover + hero photo as JSON-path
    columns (`cover_pick`, `hero_pick`); it must never haul full `draft_content`
    for every page. (2026-09-11, Claude)

69. **A manual testimonial shows only when the office ticks "Show on page" (Joshua 2026-09-12).**
    The three "Optional Manual Testimonial" boxes carry `review<n>_show`. `trainerReviewsMarkup()`
    draws a manual testimonial only when that is `true` and the text is not empty. Keys stay
    PRESENT with "" when blank — a missing key makes the portal fall back to `trainer-roster.js`.
    The seeded fakes ("Local Client", "Dog Owner", "Verified Client", "Client Name" and their
    stock lines) were blanked on live and practice data and in `trainer-roster.js`; never re-seed
    them. Named testimonials (Shavon, Daniel, Deuce) were kept with `_show = true` until the
    office decides. A page with no reviews shows NO review section (Aryson verified live).
    Check: live `/fredharris` shows only the Bruno review; `grep -c '"review1Author": "Local Client"'
    trainer-roster.js` → 0.
    Live status 2026-09-12 07:57 ET: DATA fixed on live AND the checkbox CODE is LIVE. Production =
    dpl_8L3eDtFZ4Si3whyyWnGXGMDjmt8B (ldtt-site-r7gg9qns2), stamp ?v=20260912livefix1, built as:
    d42139c base (26 landing pages, get-started, api+lib/lead-journey) + trainer-backoffice/app.js and
    styles.css from 084bd11 + b7b9f8e's app.js/trainer-roster.js hunks. /.nexora/ is no longer served
    (54 files now 404; .nexora/ is in .vercelignore + .gitignore). ROLLBACK: `vercel promote
    dpl_H67c7WDariMAq83BbhoWZWLVeiKQ` (ldtt-site-lopmujumb, the 2026-09-11 build). Live is still a
    hand-mixed build, so a live release must be assembled per file from d42139c — never promote this
    branch whole, and never deploy live from the SSD folder again (that is how .nexora/ leaked).

## Lead cards (added 2026-09-12, Claude, meeting 2026-09-11)

70. **Lead cards: eval time, Added to Alpha, bold market, name-only note bylines, Eval Completed.**
    - Two REAL columns on `leads` in BOTH schemas (`supabase/migrations/20260912120000_lead_eval_time_and_alpha.sql`,
      applied as version 20260912073552): `eval_scheduled_at timestamptz` and
      `added_to_alpha boolean not null default false`. Additive only: no status change (rule 10),
      no count change (rule 1). Both are on the lead whitelist in `api/operational-mutation.js`;
      the server stores `added_to_alpha` as `=== true` and `eval_scheduled_at` as ISO (or null),
      and answers 400 "The eval date and time could not be read. Pick it again." without writing.
    - The browser saves each through `persistLeadFields()` with ONLY its own key, so an Alpha tick
      can never resend a stale status or eval time and vice versa. Never fold them back into
      `persistLeadRecord()`.
    - Eval Scheduled cards show "EVAL <day, date, time, zone>" (viewer's time zone) or the amber
      "Eval date + time not set" line. The lead panel carries the `datetime-local` box
      (`data-lead-eval-at`, on the `typedFieldKey()` whitelist, rule 14) and the Added to Alpha tick.
    - Every card carries the "Added to Alpha?" pill (`data-lead-alpha`); its click handler runs
      BEFORE `[data-open-lead]` and stops the card from opening. Yes = red ✓.
    - The market name on the card is `<strong class="lead-card-market">`.
    - Office note bylines (note heading, edit history, Latest Office Note column, Recent Activity)
      use `portalActorName()` = the staff NAME, or "Office staff" when no real name is on file.
      NEVER `portalActorLabel()` there: it appends the login email (the meeting's "it came back
      after an update"). The audit checks it.
    - Sales stage `evaluated` is labelled "Eval Completed" (was "In the Trainer's Hands"). Label
      only: key `evaluated` and status `evaluation_complete` unchanged.
    - Shantelle Tuck (Atlanta): practice slug is `shantelle-tuck` (`20260912120100_practice_shantelle_slug.sql`),
      static page `shantelletuck.html`, and `vercel.json` sends `/s` → `/shantelletuck` and
      `/trainer-bio-s` → `/trainer-bio-shantelle-tuck` (308). LIVE still has slug `s`: the live SQL is
      `scripts/sql/2026-09-12-live-shantelle-slug.sql`, NOT run. Run it ONLY in the same live
      release that ships `shantelletuck.html` + those two redirects; run first, live `/s` would
      hang on "Loading trainer page...". Ship the redirects without the SQL and live `/s`
      would 308 to a page that cannot find slug `shantelle-tuck`. Both go together.
    Tests: `tests/lead-cards.test.mjs`. Check on the practice copy: an Eval Scheduled card shows the
    time; the Alpha pill toggles without opening the card and survives a reload.

## Online booking (added 2026-09-12, Claude, portal chain step 2)

71. **Booking reads Google, books only in OUR database, and is practice-only this round.**
    - `api/booking-lead.js` (the one door for every lead source), `api/booking.js` (GET free times /
      POST book) and `api/booking-page.js` (`/book/<trainer_slug>?lead=<id>`, vercel.json rewrite)
      answer **404 on live before anything else** (`if (!isSandbox()) return res.status(404)`). On the
      practice copy every table call goes through `lib/booking.js` `sb()` → `supabaseRequest()`, so
      leads land in `practice.leads` (rule 20). Never add a live path without a separate live release.
    - **Never book in Google.** The only Google call is
      `AppointmentBookingService/ListAvailableSlots` (read-only). `assertReadOnlyGoogleCall()` throws
      for any other calendar-pa URL, the audit refuses any other method name or `/calendar/v3/`, and
      `tests/booking.test.mjs` greps the files. The public web key is scraped from the schedule page at
      runtime and cached in memory (6 h, refetched on a 400/401/403); it is never committed and never
      sent to the browser. Slots are cached 60 s per trainer; a booking re-asks Google with no cache.
    - A booked time is HELD in `practice.booking_holds` (partial unique index: one `held` row per
      trainer + start time, so a second booking of the same time answers 409 "That time was just
      taken"). Held times and anything starting within the hour are never offered. A rebook of the
      same lead releases its earlier hold; a failed lead update releases the new hold. The trainer /
      TC reserves the time in Google themselves (the lead panel says so).
    - A booking moves the lead to `evaluation_scheduled` with `eval_scheduled_at` = the slot (Leads
      board "Evaluation Scheduled" + the rule-70 card line) and `raw_payload.sales_pipeline = true`
      (Sales "Booked", rule 2), updates name / phone / email / address / dog names + breeds from the
      form, and keeps every answer in `raw_payload.booking` (client, dogs[], location, when, trainer,
      hold id; the `intake` record from booking-lead is kept). The PATCH is guarded by `version=eq.<v>`
      and re-merged once on a clash. It writes `lead_events` status_changed and the
      `lifecycle_events` `evaluation_scheduled` row (funnel), like a portal status change.
    - Eval form = Rachel's 11 Alpha fields (first + last name, phone, email, physical address; per dog:
      name, sex, spayed/neutered, vaccinations up to date, age, breed, behavioral challenges), up to 6
      dogs, all required server-side (400, nothing written). Location: `location_mode`
      `in_home_or_center` (Cleveland / Lorenzo: in-home OR training center 4815 Orchard Rd, Garfield
      Heights, OH 44128), `in_home` (every other market), `center_only` (available for the office).
    - Trainer settings (Google schedule id, time zone, slot minutes, ZIP prefixes, location rule) live in
      `practice.site_settings` key `booking_trainers`, editable without a deploy; `lib/booking.js`
      `DEFAULT_TRAINERS` carries the same values so a practice Reset (which truncates practice.*) falls
      back instead of breaking. ZIP routing = longest matching prefix: 440/441 → lorenzo-miller,
      325 → daniel-bainbridge, anything else → `trainer_slug: null`, no booking link, office follow-up.
    - `/api/booking-lead` contract: POST `{first_name,last_name,phone,email,zip,problem,dog_name,
      sms_consent:boolean,source_page}` → `{ok:true, lead_id, trainer_slug, book_url}`. CORS allows
      `https://ldtt-ads-v2-sandbox.vercel.app` and the practice host (POST + OPTIONS). A double submit
      (same email, else phone, through this door within 30 min) returns the same lead. New leads carry
      `sales_pipeline: true`, `raw_payload.trainer_market` (the card's market label, `leadMarketLabel()`,
      reads raw_payload, not the column) and the lead_events / lifecycle_events rows submit-contact writes.
    - The lead panel draws `leadBookingBlock()` (booked time, trainer, location, every answer, or the
      booking link / "No trainer serves this ZIP yet"); `booking` is in `LEAD_INTERNAL_RAW_FIELD_KEYS`
      so it never becomes a sheet column. Sales cards carry `leadCardEvalLine()`.
    - Migration `20260912140000_online_booking_practice.sql` creates nothing in `public` (audit checks it).
      The live release needs `public.booking_holds`, the settings row in `public.site_settings`, and the
      routes switched on together — plan it as its own step.
    Tests: `tests/booking.test.mjs` (10). Proof on the practice copy: `/api/booking?trainer=lorenzo-miller`
    and `daniel-bainbridge` list real times; a POSTed booking moves the practice lead and the time drops
    out of the list; live `/api/booking-lead`, `/api/booking`, `/book/lorenzo-miller` answer 404.

## One pipeline + texts (added 2026-09-12, Claude, portal chain step 3)

    - **Changed 2026-09-14 (office, during the presentation): the calendar shows the trainer's Google free times
      EXACTLY** (only the next hour is left out). A pick no longer hides a time and is not exclusive: it is recorded
      in booking_holds, moves the lead to Eval Scheduled, and is SENT (texts + office email) so the office or the
      trainer books it in Google / Alpha. `openSlots()` ignores holds; `practice.booking_holds_one_per_slot` dropped
      (`20260914190000_practice_booking_picks_not_exclusive.sql`); the done screen says "Your time is sent to <trainer>".
      Still never writes to Google.
72. **Every lead source enters ONE pipeline; texts only with SMS consent and only to tester phones;
    FormSubmit is never touched.** Joshua's hard rule: "Do not break the form submit. FormSubmit is for the
    current Contact page. Resend is for the sales pipeline."
    - **The office's current new-lead email is sacred.** Baseline recorded 2026-09-12 before this step:
      every website lead form is intercepted by `script.js` (`wireAsyncForm`), saved by the Edge Function
      `submit-contact`, then `relayFormDeliveries()` POSTs `/api/form-delivery`, which sends the Google
      Sheet row and the FormSubmit email to `production@lorenzosdogtrainingteam.com` (subject "New Lorenzo's
      Dog Training Team Contact Form Submission"); a failed server send is retried from the browser
      (`submitEmailRelay`). Trainer pages (`app.js` `office-lead-form`) do the same. Live
      `form_delivery_attempts`, 14 days to 2026-09-12: formsubmit_email 91 accepted / 95 failed (then browser
      retry), latest 04:54 UTC. `relayFormDeliveries`, `api/form-delivery.js`, every form `action` and every
      page's FormSubmit markup are unchanged by this step (the HTML diff is the `?v=` stamp only). Never
      reroute FormSubmit through anything else; never add a FormSubmit fallback; never re-send it. The stash
      `portal3-attempt1-REROUTED-FORMSUBMIT-do-not-apply-2026-09-12` did that and was stopped: never apply it.
    - **`api/pipeline.js` serves LIVE as well as the practice copy** (go-live 2026-09-23; the "404 on live"
      round is over). Every table call still goes through the schema switch (rule 5), so the practice copy
      writes `practice.*` while live writes `public.*`.
      REVISED in step 3b (rule 73): the step-3 wrapper `deliverOrEnterPipeline()` is GONE. The Contact handler
      calls `relayFormDeliveries('contact',…)` directly again and `window.LDTT_FORM_DELIVERY` is
      `{submitCanonical, relay: relayFormDeliveries}`, byte-for-byte commit 1176038. The practice copy reaches the
      pipeline through a SEPARATE capture listener that only exists when `/api/environment` says sandbox (see rule 73).
      LIVE reaches it through the hand-off in rule 103, which runs only AFTER the delivery above has finished
      and never touches it. `app.js` trainer pages still branch on `window.LDTT_IS_SANDBOX === true` before
      their own relay (live skips it).
    - **Which forms are on on the practice copy:** only the LEAD forms that post to `submit-contact`
      (`.contact-intake`, `.market-guide-form`, `.ad-exit-form`, `.office-lead-form`), because only
      `submit-contact` is deployed with the practice flag (version 9; checked 2026-09-12 with
      get_edge_function: it carries `requestSchema`). `submit-trainer-application` (v8),
      `submit-content-review` and `track-site-event` are NOT deployed with the flag: their forms and tracking
      stay switched off on the practice copy and `LDTT_EDGE_PRACTICE_FLAG_DEPLOYED` stays `false` (rule 20).
    - **`lib/pipeline.js` `enterPipeline(leadId)`** (POST `/api/pipeline {op:"enter"}` from the practice
      page after `submit-contact` answers, and from `/api/booking-lead`): route -> decide the text -> CLAIM
      (version-guarded PATCH stamping `raw_payload.pipeline.entered_at`) -> send only if this call won ->
      record. Two calls at once text once. Only for a lead made in the last 30 minutes (409 otherwise).
      Routing: a trainer-page lead stays with ITS trainer (a link only if that trainer takes online
      bookings, else office follow-up; never handed to another trainer by ZIP); every other lead by ZIP
      (rule 71). It sets `raw_payload.sales_pipeline = true` (Sales tab, rule 2) and never changes the
      status. The free ebook opt-in (`lead_type: pdf_download`) is left alone.
    - **Texts (Make, never Twilio directly):** pathway 1 (scenario 6237328, env `LDTT_MAKE_HOOK_PATHWAY1`)
      = booking-link text, only when `sms_consent = true`, a booking link exists, and the phone is an ACTIVE
      `communications_testers` row. Pathway 2 (6237333, `LDTT_MAKE_HOOK_PATHWAY2`) after a booking
      (`api/booking.js` -> `afterBooking`) = customer confirmation (consent + tester) and the trainer alert,
      which on the practice copy goes to the tester phone in the settings box (default Joshua
      +14402142915), never to the real trainer; one notice per hold, so a hold never texts twice. The hook
      URLs live only in Vercel Preview env (never committed). Every Twilio module in both scenarios keeps
      its `text:equal` tester filter; never `text:contains`.
    - **Office email recipients box** (Settings, practice copy, office logins): `site_settings` key
      `pipeline_office_emails` (`{recipients:[{label,email}], practice_trainer_phone}`), defaults
      marketing@, melissazuk@, rachelleggett@ (lorenzosdogtrainingteam.com), tmillerk999@gmail.com and an
      empty Angela slot. Save needs an office login (`authorizeRequest require: "admin"`); bad addresses
      answer 400 and nothing is written. The boxes are on the `typedFieldKey()` whitelist (rule 14). This
      step only STORES the list: the office booking email is step 3b, on Resend only.
    - The lead panel shows what the pipeline did (`leadPipelineNotices()`: each text sent, or the plain
      reason it was not); `pipeline` is in `LEAD_INTERNAL_RAW_FIELD_KEYS`. `/staff?view=leads&lead=<id>`
      opens that lead (the trainer alert text links there).
    Tests: `tests/pipeline.test.mjs` (10). Audit: the rule 72 check.

## Office booking email through Resend + Contact Us lanes (added 2026-09-12, Claude, portal chain step 3b)

73. **Resend is for the SALES PIPELINE. FormSubmit is for the current Contact page. Never mix them.**
    Joshua, 2026-09-12: "Do not break the form submit. Resend is for the SALES PIPELINE. FormSubmit is for the
    current Contact page."
    - **The Contact page's FormSubmit submit is frozen at commit 1176038.** `tests/office-email.test.mjs` pins the
      sha256 (first 16) of: `relayFormDeliveries` dc94a4b4502033b1, the Contact handler (`const contactForm=…`)
      14ed922c20ecc4f3, `window.LDTT_FORM_DELIVERY={…}` 392ac4bd96f241db, `submitEmailRelay` 01e03717224c248b,
      `wireAsyncForm` e262f739d5c5fe3c, and the contact.html form markup is unchanged (hash 75cc2858a7cbe55c). The same
      test RUNS `relayFormDeliveries` and proves it posts `/api/form-delivery` and then FormSubmit
      `production@lorenzosdogtrainingteam.com` from the browser when the server email failed.
      `scripts/contact-formsubmit-proof.mjs` proves it in a real browser on the real contact.html (every outside call
      intercepted, nothing sent). Never wrap, reroute, replace or add to that path; never send a pipeline email with it.
    - **The practice copy's Contact Us capture is an ADDITIONAL listener** (`script.js`, block `const enterPracticePipeline=`
      … before `const updateStoredDelivery=`): registered only when `/api/environment` says `sandbox`, it is a document
      capture `submit` listener for `.contact-intake` forms that saves the practice lead through `submit-contact`
      (x-ldtt-practice) and posts `/api/pipeline {op:"enter"}`. It never calls FormSubmit, `/api/form-delivery` or
      `relayFormDeliveries` (on the practice copy form-delivery answers 423 by design, rule 5). On the practice copy only,
      `window.LDTT_FORM_DELIVERY.relay` is swapped for the pipeline call so the ad pages' ebook forms work there.
    - **The office booking email goes ONLY through Resend** (`lib/office-email.js`: one `fetch`, to
      `https://api.resend.com/emails`, key `RESEND_API_KEY`, sender `RESEND_FROM` (default
      "Lorenzo's Dog Training Team <no-reply@lorenzosdogtrainingteam.com>"), Idempotency-Key
      `ldtt-booking-email-<lead>-<hold>`). The key is Track 500's (lorenzosdogtrainingteam.com is verified there); it lives
      only in Vercel env (Preview, set by Joshua with `Env Vault/ldtt-sandbox/set-ldtt-resend.sh`). The vault key in
      `Env Vault/resend` is a DIFFERENT account (403 "domain is not verified"): never use it.
    - **No key = QUEUED, never another path.** `afterBooking()` records `booking_notices[].office_email =
      {status:"queued", reason:"Office email waiting for the Resend key"}` and `pipeline.office_email_pending = true`
      BEFORE any send, so the booking never waits on or fails because of the email. It is sent automatically once the key
      is present: after every booking (`sendLeadOfficeEmails` for this lead, then `sendQueuedOfficeEmails()` for all
      pending leads) and from "Send queued office emails now" (Settings box and lead panel, POST `/api/pipeline
      {op:"send_queued"}`, office login). Claim-before-send (version-guarded); a stale "sending" (> 5 min) is retried; a
      Resend failure is recorded with its reason and retried up to 5 times; a rebooked lead only emails its CURRENT booking
      (older one marked `superseded`). The lead panel shows the state in plain words.
    - **What the email carries:** the red instruction "Log this client into Alpha, then open the staff portal and mark this
      lead "Added to Alpha"." + a button to `/staff?view=leads&lead=<id>`, booked time, trainer, where, the 4 client
      fields, all 7 answers per dog, and the lead details (source, ZIP, I want to, lane, comments, SMS consent, received, id).
    - **Practice copy recipients:** `site_settings.pipeline_office_emails.practice_email_to` (default
      `mr.matthews2022@gmail.com`, a row saved before 3b keeps it) receives practice booking emails INSTEAD of the office list,
      like the trainer-alert tester phone; the email names the list it stood in for. Clear the box to send practice emails to
      the list. Subjects start "[PRACTICE COPY]".
    - **Contact Us = Option C** (`lib/pipeline.js` `CONTACT_US_LANES`, overridable by `site_settings` key `pipeline_lanes`
      `{lanes:[{answer,lane}]}`): in-person / virtual evaluation / training session → `booking` (pathway 1 booking-link text,
      then the booking flow); "Schedule a free phone consultation…" → `office_call` (customer-care text "Our office will call
      you shortly", no link, not on Sales); "Learn more about becoming a dog trainer" → `recruiting` (no client text); blank or
      unknown → `office_follow_up` (no text). Only the Contact Us page (source contact.html / contact, or page_url /contact)
      uses the table: ad pages, 2.0 pages, market pages and trainer pages always take `booking`. The lane is logged in
      `raw_payload.pipeline.lane` and shown in the lead panel. The FormSubmit office email goes out in EVERY case (live),
      untouched. Texts still need SMS consent and an active tester phone (rule 72).
      **Since 2026-09-24 (rule 103) these lanes run on LIVE too**, not only on the practice copy.
    - **The customer-care text uses its own Make route when `LDTT_MAKE_HOOK_CARE` is set, else the pathway 1 hook**
      (REVISED 2026-09-22, sandbox fix pass). The old "never pathway 1" reason is gone: since 2026-09-14 pathway 1's
      Twilio body is `{{1.message}}` (its only filter is the phone tester filter, no pathway filter; checked 2026-09-22) and
      `withTextMessages()` fills `message` with the `care_call` words for pathway `customer_care`, exactly like the
      office's care button. Payload: `pathway:"customer_care"`, `phone` = `customer_phone` = the lead's phone. Consent and
      the practice tester rules are unchanged (`clientPhoneFor`). `care_call` status is `in_use`.
    Tests: `tests/office-email.test.mjs` (12). Audit: the rule 73 check.

## Booking page redesign: ZIP first, pick a trainer (added 2026-09-12, Claude, portal chain step 3c)

74. **The booking page is Joshua's exact order: ZIP -> trainer cards -> Rachel's questions -> calendar (or request) ->
    congratulations. Distance comes from the bundled Census ZIP file and each trainer's office-editable Base ZIP.**
    - **Entry.** `/book` and `/book/<slug>?lead=<id>` (vercel.json rewrites; `/book` sits before the `/:slug`
      trainer catch-all) both land on step 1 "Enter your ZIP code". The ZIP is pre-filled from the lead (or `?zip=`)
      and the cards load at once. The slug in the address is only a hint; the client always picks. Ad pages, 2.0 pages
      and the Contact Us option-C booking texts all use this entry. Practice copy only: every route answers 404 on
      live first (rule 71 unchanged).
    - **Distance.** `lib/zip-centroids.json` = U.S. Census 2024 Gazetteer ZCTA national file (public domain),
      compacted to `{ZIP:[lat,lng]}` (33,791 ZIPs, 3 decimals). `lib/zip-distance.js` `milesBetween()` = haversine
      miles. No outside call. Never swap it for a paid or rate-limited geocoder without Joshua.
    - **Base ZIP.** `trainers.base_zip` (text, 5 digits or null, CHECK `trainers_base_zip_5_digits`) in BOTH schemas
      (`supabase/migrations/20260912160000_trainer_base_zip.sql`, applied as `trainer_base_zip`; additive). CORRECTION:
      trainers DOES carry BEFORE UPDATE triggers `increment_record_version` + `set_trainers_updated_at` in both schemas
      (`information_schema.triggers` hid them; always check `pg_trigger`). The fill therefore bumped `version` +1 and
      `updated_at` (09:59 UTC 2026-09-12) on all 29 live trainer rows; no other column changed, no audit row. A portal
      tab open on a trainer from before then got a plain 409 on its next save; a reload clears it. A future data fill on
      trainers should expect the same. Filled for all 29 live active trainers from their market
      city (the city's central ZIP; Lorenzo = 44128, the training center's ZIP). The file lists every choice.
      Practice-only test/draft rows (donal-duck, o-brien-test-*, office-draft-*) are left empty. Empty = the trainer
      is NOT on the booking page. The office edits it in Trainer Network -> Profile Editor -> "Base ZIP (booking page
      distance)" -> "Save Base ZIP" (`persistPublicTrainerField` -> operational-mutation). The server accepts only 5
      digits or empty (`cleanBaseZip`, on create AND update, plain 400 otherwise). A full trainer save sends `base_zip`
      only when the portal loaded it (`trainer.profileBaseZip !== undefined`), so an old tab never blanks it.
    - **Step 1 cards.** GET `/api/booking?zip=` -> every trainer with `status = active`, a 5-digit Base ZIP and not an
      `office-draft-*` slug, within `RADIUS_MILES` (50), nearest first: photo (`headshot_url`, only `https://` or a
      site path), name, market, "N mi away", and "Online calendar" or "Office schedules". Nobody within 50 miles ->
      "The office will match you with a trainer" + a callback form (POST `{op:"callback"}`: first name + 10-digit phone
      required) -> the office is told (queued Resend email, kind `no_trainer`).
    - **Step 2.** Rachel's 11 Alpha fields + more dogs (rule 71 validation). Location: a trainer's `booking_trainers`
      row decides; otherwise a trainer whose market names Cleveland offers in-home OR the training center (4815 Orchard
      Rd, Garfield Heights, OH 44128), everyone else in-home (`locationRule`).
    - **Step 3.** A trainer WITH a calendar: the mock calendar (read-only ListAvailableSlots, rule 71) and a confirm
      button; booking keeps every step-2/3/3b guarantee (hold, Eval Scheduled in Leads AND Sales with the time,
      pathway 2 texts only with consent + tester phones, the Resend office email). A trainer WITHOUT a calendar:
      "Request this trainer — the office will schedule you" (POST `{op:"request"}`): the lead gets the chosen trainer
      and every answer in `raw_payload.booking` (`requested: true`, no `slot_start`), `sales_pipeline: true`, and its
      STATUS IS NOT CHANGED. Only a real picked slot = Eval Scheduled. No hold, no Google call, no text. The office gets
      the Resend email (kind `trainer_request`, queued without the key). One notice per trainer / per callback ZIP, so
      a double tap never emails twice. A booked lead cannot be turned into a request (409); a later booking supersedes
      a pending request email.
    - **Step 4.** Congratulations: trainer photo + name, day/time (or "the office calls you to schedule"), the address
      (in-home: the client's address; training center: its address), what happens next, office phone 866.436.4959.
      Reopening the link shows it again (`outcome`).
    - **Text routing (rule 72) now uses the radius.** Non-trainer-page leads: the nearest trainer within 50 miles WITH a
      calendar is assigned (same as before for Cleveland / Crestview); if only no-calendar trainers are near, the link
      still goes out (`/book/<nearest>?lead=`) but no trainer is assigned until the client picks; nobody within 50 miles
      = no link, no text, office follow-up. Trainer-page leads still stay with their own trainer (rule 72 unchanged).
      `/api/booking-lead` answers the same contract (`trainer_slug` null only when nobody is within 50 miles).
    - The lead panel shows "Trainer requested online" (with every answer) and "Callback asked" (`leadBookingBlock`).
    Tests: `tests/booking-zip.test.mjs` (10). Audit: the rule 74 check. (2026-09-16, Joshua: only the trainers Missy gave calendar links (an active booking_trainers row) are cards on the booking page; no calendar = not listed; nobody with a calendar within 50 miles = office follow-up.)

## Lead form editor (added 2026-09-12, Claude, portal chain step 4)

75. **The office edits every lead form from Page Editor → Lead forms; a removal is warned, named, logged and
    undoable; the website's form submit path is never touched.** Maintainer's guide + 2.0 hand-off: `docs/FORM-EDITOR.md`.
    - **Forms covered** (`lib/lead-forms.js` `FORMS`): Contact Us, Get Started, Ad landing pages (built-in market pages +
      Page Studio `/ads/*`; the quiz `/lp-test-*` pages are NOT changed yet), Trainer page form, Free booklet form, 2.0 ad
      pages (served by the API; the 2.0 project still draws its own form until its hand-off), Booking page questions.
      Each form's ORIGINAL questions equal what the page has today (`tests/lead-forms.test.mjs` reads the HTML), and a form
      whose published questions equal the original is not touched at all (`changed:false`).
    - **Storage:** `site_settings` key `lead_forms` in this deployment's schema: `{draft, published, log, sent_from_practice}`.
      No new table. Writes are optimistic (`updated_at=eq.<read>`): two people editing at once → the second gets a plain 409.
    - **Edits:** add (short text, long text, email, phone, number, dropdown, checkboxes, yes/no, date), rename, required,
      reorder, dropdown/checkbox choices. Office text is data: `cleanLabel()` strips `< >` and control characters, the browser
      draws it with `textContent`, the booking page escapes it. The texting consent box's wording and "never required" are
      LOCKED (rule 47: Twilio approved one wording; consent is not a condition). The booking page's Sex / Spayed / Vaccinated
      answer lists are locked (Alpha needs those answers). An added question is submitted as `Extra: <question>`.
    - **Removal:** red warning with the exact effect (`effectFor`): Phone = TEXTS STOP; ZIP = TRAINER MATCHING STOPS; texting
      box = NO TEXTS AT ALL; Contact Us "I want to" = office follow-up, no text, nobody to Applications; booking questions = Alpha
      needs it. The signed-in person's name is filled in (editable, two words required, 400 otherwise). The log keeps who, login,
      when, which form, which question and the effect; `audit_events` gets `lead_form_removed` (entity_type `lead_form`). Undo =
      `restore_field`. ONLY remove/restore change the removed flag: a save can never un-remove, and a question missing from a
      save is kept, never dropped silently (`normalizeFields`).
    - **Degrades, never breaks:** a removed question is hidden AND disabled on the page. `submit-contact` (shared with live, NOT
      changed) refuses a lead without first name, last name, email and phone, so a removed one gets a hidden stand-in
      ("Website visitor", "Not given", "Not given", a unique `not-given-…@noemail.invalid`). No phone / no consent → the pipeline's
      own rules send no text; no ZIP → no trainer match → office follow-up. The booking page: `validateEvalForm(body, setting,
      formFields)` requires only published, required questions (null = the original 11, all required, exactly as before); a blank
      answer never overwrites what the lead already has (`answeredContact`); with neither phone nor email a new booking lead skips
      the duplicate lookup instead of matching someone else.
    - **Practice → live (rule 18 pattern):** the practice copy edits the draft, "Publish on the practice copy" makes practice pages
      use it, "Send to live" (`api/send-to-live.js` kind `lead_forms`, typed full name, rule-18 red warning) puts the practice
      DRAFT into the LIVE row's draft. `LF.assertPublishedUnchanged()` runs before the write: the live published forms, revision,
      date and publisher never change. `practice.send_to_live_log` (entity_type `lead_forms`, migration
      `20260912180000_lead_forms_send_to_live.sql`, practice only) and the live `sent_from_practice` stamp keep the name. Publishing
      stays on the live portal.
    - **Live is unchanged this round:** `api/lead-forms.js` answers 404 on live before anything else unless `LDTT_LEAD_FORMS_LIVE=1`;
      with it, live only allows public / editor / publish / discard (edits answer 409 "changed on the practice copy").
      `/api/environment` adds `leadForms: true` only on the practice copy or with that switch, so live's answer is byte-identical,
      and the `script.js` block (appended AFTER every pinned rule-73 block; it never names FormSubmit, form-delivery or
      relayFormDeliveries) only asks for forms when `env.sandbox || env.leadForms`.
    - **Answers:** website forms keep `Extra: <question>` on the lead (submit-contact stores the whole payload); the booklet
      scripts pass them on; the booking page keeps `booking.client_custom` and each dog's `custom`. The lead panel shows them
      (`leadExtraAnswersBlock`, drawn BEFORE `leadBookingBlock`), the Resend office emails carry an "Extra questions" section,
      and FormSubmit's table includes them automatically on live (the form's own fields).
    - **Portal:** `trainer-backoffice/form-editor.js` (both shells, same `?v=`), third Page Editor door "Lead forms"
      (`formEditor` view, office admins too). Every typing box carries `data-lf-*` and is on the `typedFieldKey()` whitelist (rule 14);
      the new-question box is emptied before `render()` (rule 15).
    Tests: `tests/lead-forms.test.mjs` (13) + 1 in `tests/send-to-live.test.mjs`. Audit: the rule 75 check.

## Photos + logo: change, move, resize; editors full screen (added 2026-09-12, Claude, portal chain step 5)

76. **The office changes, moves and resizes photos and the logo in Page Studio and the Page Editor. Only
    clamped integers ever reach CSS, "empty" means the design's own, and an unchanged page renders
    byte-for-byte as before.**
    - **Record before the change:** all 12 built-in market pages rendered with the old template and the new
      one gave identical public HTML (12/12 sha256 equal); the editor render was identical once the new
      editor-only hooks were removed (12/12). `tests/media-layout.test.mjs` keeps checking that an unchanged
      page renders the same and ships no new markup.
    - **Page Studio (ad pages, `lib/ad-page-template.js`), rule-68 pattern.** New content keys:
      `logo {photo, w, x, y}` (the header logo: own picture, width px, move px) and `photoW` / `photoX` /
      `photoY` on the hero and on every section that has a photo (width % of its frame, move px).
      `MEDIA_LIMITS` = photoW 20-100, photoX -400..400, photoY -300..300, logoW 60-360, logoX -200..200,
      logoY -40..40. `normalizeContent` clamps them to integers and LEAVES THEM OUT when empty, so stored
      JSON and exports of unchanged pages do not move. `logo.photo` goes through `safeUrl` (https or a site
      path; javascript:/data: refused). CSS comes only from `photoStyle()` / `logoStyle()` over those integers.
      Moves use the CSS `translate` property; the phone rule (`MEDIA_PHONE_CSS`, below 700px the move is
      dropped, the size stays) ships only on a page where something was moved. `data-ps-media` hooks exist only
      in the editor render.
    - **Page Studio editor (`page-studio.js`):** every photo picker and the Style tab's new Logo box have
      "Upload a new photo/logo" through the EXISTING `api/pages.js` operation `upload` (`UPLOAD_TYPES`, bucket
      `trainer-page-assets` / `practice-trainer-page-assets`). JPG/PNG/WebP over 3 MB are scaled down in the browser
      first (longest side 2400px) because Vercel refuses bodies over ~4.5 MB and the upload travels as base64;
      GIF/SVG over 3 MB are refused in plain words. Sliders (size, move left/right, move up/down) + "Put it back
      where the design puts it". In the preview: drag a photo or the logo to move it, drag the red corner handle
      to resize it (same keys, clamped); a press under 4px stays a click (photo opens its section, logo opens
      Style). Everything is draft until Publish. `setPath` builds a missing `logo` object on the way.
    - **Page Editor (trainer pages, `app.js`):** the Top Landing Photo, Bio Photo and Company Logo cards carry
      size + move sliders and a reset button (`mediaLayoutControls`, `data-editor-field`, so the existing
      handlers save them). Saved in `draft_content` (so in `published_content` after Publish) as
      `logo_width/x/y`, `hero_photo_width/x/y`, `bio_photo_width/x/y` by `trainerMediaToContent`; read back by
      `trainerMediaFromContent` FROM THE SAVED PAGE ONLY (never from browser state, so drafts never reach the
      public page, rule 56); drawn only through `trainerMediaStyle()` (logo 40-320px, move -150..150 / -30..30;
      photos 30-100%, move -300..300 / -200..200). All are function declarations, not top-level consts, because
      public trainer pages run app.js too (rule 43). On the preview, `wireTrainerMediaDrag()` gives the same
      drag-to-move + corner-handle resize (Browse and Edit Overlay); it stamps `_editedAt` (rule 31) and saves
      through `markBuilderDraftDirty()`. The existing crop drag on the card preview and the "Photo scale" slider
      are unchanged. `styles.css` drops a move on phones.
    - **Practice -> live:** uploads made on the practice copy land in `practice-trainer-page-assets`; Publish copies
      them into the deployment's own bucket (`collectMedia` sees `logo.photo` because `photo` is in `MEDIA_KEYS`,
      rule 27) and Send to live copies them to the live bucket and re-points every URL (`repointPracticeUploads`
      walks every key, rule 18). Send to live stays draft-only.
    - **Full screen:** Page Studio's ad editor and the Site Builder are fixed full-screen overlays. The Page Editor
      now OPENS full screen every time it is entered (`page-studio.js` observe(): shell absent -> present turns it
      on); "Exit Full Screen (Esc)" still works and a background redraw does not pull it back. It no longer depends
      on a remembered choice.
    - **Lead Journey Test** is off the menu behind `LEAD_JOURNEY_TEST_IN_MENU = false` (rule 63 updated).
    Not covered this round: the Site Builder's block photos keep their own upload and size controls (unchanged).
    Tests: `tests/media-layout.test.mjs` (7). Audit: the rule 76 check.

## Conflict hunt across the 2026-09-12 lanes (added 2026-09-12, Claude)

77. **A photo/logo drag on the Page Editor preview holds background redraws; the server libraries carry no
    raw control bytes.**
    - Every `render()` rebuilds `#pageEditorPreview` (srcdoc, line ~9041). The rule 76 drag (`wireTrainerMediaDrag`)
      did not set `dragInProgress`, so a 30 s poll or a realtime lead change (450 ms debounce) landing mid-drag
      rebuilt the iframe and threw the drag away unsaved. `begin()` now sets `dragInProgress = true` +
      `dragStartedAt`, and `onEnd()` clears it BEFORE its early return (a plain click lets go too). The
      rule 57 20 s cap in `userIsReadingRecord()` still frees a lost drag. Page Studio's drag is not affected: its
      overlay lives on `document.body`, outside `#workspaceView`, and only its own edits repaint it.
    - `lib/booking.js` (line ~309) and `lib/lead-forms.js` (line ~220) held raw NUL / 0x1F / DEL bytes inside
      regex character classes. `file` and `grep` treated both files as binary and printed nothing for them,
      which hides them from text audits. They now read ` -`; behaviour proven identical
      (cleanLabel, cleanChoices, normalizeFields, validateEvalForm on all 300 low code points). `api/lead-journey.js`
      line 23 has the same raw bytes: left alone on purpose (live runs its own d42139c copy; the route is 404 there).
    - Checked and fine on 2026-09-12 (keep them true): lead status CHECK in both schemas holds every status the
      pipeline writes; every practice `booking_holds` row equals its lead's `eval_scheduled_at` and no held slot is
      offered; Make pathways 1-6 keep `text:equal` tester filters on every Twilio module, and every `{{1.x}}` they map
      is in `lib/pipeline.js`'s payload; the sandbox clock 6239634 is inactive; the Contact Us `I want to` options
      equal `CONTACT_US_LANES`; the `booking_eval` form keys equal `CLIENT_FIELDS` + `DOG_FIELDS`; CORS allows only
      the 2.0 origin (an unknown origin gets no allow-origin); live answers 404 for booking-lead, booking,
      booking-page, /book/<slug>, pipeline, lead-forms, lead-journey, send-to-live, practice-reset; live
      `/contact`, `/get-started`, `script.js`, `styles.css` hash to their recorded baselines.
    - **KNOWN BROKEN, NOT FIXED (rule 46):** the practice copy's pull from live has not committed since
      2026-09-10 08:35 UTC. `/api/operational-data` answers `practiceSync {ok:false, reason:"timeout"}` (its 1.5 s
      budget), `pull_last_ok` returns null, `practice_private.pull_log` is silent since then, and on 2026-09-12
      18 live leads were missing from `practice.leads` with 10 practice rows older than live. The authenticator
      role has `statement_timeout=8s`; a pull that cannot finish inside it rolls back whole, so it never catches up.
      Fixing it is a database change to the pull (rules 46 + 52 + the 25-check `tests/practice-pull.sql` proof), so it
      needs its own step and Joshua's OK.
    Tests: 2 in `tests/media-layout.test.mjs`. Audit: the rule 77 check.

## Vetting pass on the practice-copy screenshots (added 2026-09-12, Claude)

78. **What a picky client saw in the 2026-09-12 proof screenshots stays fixed.**
    - The practice banner (`#sandboxBanner`, sticky, z-index 9400) sat on top of the lead panel (fixed, top 0), so
      the lead panel's × close button could not be clicked on the practice copy (`elementFromPoint` on the × answered
      `sandboxBanner`). `applyEnvironmentBadge()` now writes the banner's real height to `--ldtt-banner-h` (again on
      resize, it wraps on narrow screens) and `body.is-sandbox .lead-detail-panel` + the full-screen editor shell start
      below it. Live never has `is-sandbox`, so live keeps `top:0`.
    - Rule 76 made the Page Editor open full screen every time, and the full-screen shell (fixed, z-index 9000)
      covers the Page Editor / Page Studio / Lead forms tabs. Lead forms has no menu item, so the office could not
      reach the rule 75 form editor at all. `decorateBuilder()` (page-studio.js) now adds "Lead forms" and
      "Page Studio" buttons (`data-view`, `data-ps-builder-door`) to the full-screen top bar. Leaving the editor drops
      full screen because the shell is gone. A new full-screen screen must keep a way out to its sibling tabs.
    - Booking cards used whatever the trainer row said ("Cleveland, OH" next to "Streetsboro, Ohio",
      "Crestview, Florida"). `marketLabel()` shortens a trailing full US state name to its postal code. The distance
      ("Under 1 mi away") sits in a `nowrap` span so it never breaks onto two lines on a phone.
    - The Sales board's empty column said "Empty — ready for testing." (on LIVE too). It now says
      "No leads in this stage yet." (live gets it with the next live release).
    - Not changed, reported: the booking form pre-fills "Physical address" with the lead's street only (a Contact Us
      lead keeps city/state/ZIP in their own columns); an in-home trainer-alert text then carries the street only.
      Fixing it touches the Make payload (`service_address`), so it needs its own step.
    Tests: 5 in `tests/vetting-fixes.test.mjs`.

79. **Office booking emails use the Resend key already saved in the portal; Operations (Tim) gets two
    texts (Joshua 2026-09-12, practice copy).** `lib/office-email.js` `officeResendConfig()` uses Vercel
    `RESEND_API_KEY` when set, otherwise the Communications Settings key (`resend_api_key` secret +
    `resend_from_address` = marketing@lorenzosdogtrainingteam.com) read through `supabaseRequest` (the
    schema switch) and `rpc communications_read_setting_secret` — the same key password reset uses. Still
    Resend only, never FormSubmit (rule 73). Practice copy office emails go to marketing@ for now. 2026-09-14 (Joshua): the saved practice address is now
    production@lorenzosdogtrainingteam.com (Settings box). 2026-09-15 (Joshua): "change the marketing email to production, they will
    get all the details for the booking": the office list's Marketing line is now Production (code default + practice
    row), and the practice fallback is production@ too. The sender address is unchanged. 2026-09-15 later (Joshua): "production is not used for team emails ... production get the leads as well so they can log it into Alpha, not a part of my every day teams." So the team list is back to Marketing, Melissa, Rachel, Tim, Angela, and Production is its OWN Settings box `alpha_email` (default production@, `DEFAULT_ALPHA_EMAIL`): it gets a "Track 500 · New lead" email (`queueNewLeadEmail` in `enterPipeline`, notice hold_id "new_lead", Resend only, one per lead) for every pipeline lead EXCEPT Contact Us (the Contact page FormSubmit already emails production@; never doubled), plus a copy of every booking/request email (`emailRecipients(settings, practice, kind)`). Practice copy: all of it goes to `practice_email_to`. Tests: `tests/alpha-intake.test.mjs`.
    Operations alert: `sendOpsAlert()` texts the Settings "Operations phone" (default Tim +12168168026)
    when a lead starts its journey (`enterPipeline`) and when an evaluation is booked (`afterBooking`),
    through Make scenario 6254549 (env LDTT_MAKE_HOOK_OPS, Preview only; tester filter on every route),
    only to an active tester phone, practice copy only. Recorded on the lead as pipeline.ops_new_lead and
    booking_notices[].ops_alert. Online bookings move to Eval Scheduled by themselves (verified).

## Trainer portal from the 2026-09-12 meeting (added 2026-09-13, Claude, branch feat/meeting-2026-09-12)

80. **The trainer portal is one page, its numbers come from metrics.js, and nothing that worked was taken away.**
    Source: Zoom 2026-09-12 (Joshua, Tim, Angela); decisions + transcript in
    `/Volumes/mindfulssd/LDTT Meeting 2026-09-12 - Working Files/`. Practice copy only until a live release.
    - **Record before the change:** trainer menu was Dashboard, My Leads, My Deals, My Trainer Page, Performance,
      Submit Photos/Videos, Submit Reviews, Communications, Settings; dashboard tiles Assigned Leads / Evaluations
      Scheduled / Became Client-Paid / Pending Submissions; deal tiles Deals / Sold / Collected / Due Now; Sales column
      "Confirmed"; booking radius 50 miles; 208 tests + audit green at adefcd6. Video frames of the old screens:
      `~/Desktop/LDTT Meeting Changes 2026-09-13/before/`.
    - **Menu:** the view key `deals` is labelled "Clients"; `performance` is off the menu and a saved screen pointing at
      it opens the Dashboard (`TRAINER_RETIRED_VIEWS`); `communications` is off the menu but its screen is KEPT and
      opens from every New Inquiry card ("Log a call"), because it is still where a trainer claims a lead and logs
      contact (`communications_mark_contacted` only accepts the trainer who claimed the lead). Never delete that screen
      without a replacement. The Page Editor's portal preview list matches the menu.
    - **Dashboard = one page (tiles updated 2026-09-14, Joshua):** tiles New Inquiries / Assigned / Evaluations Scheduled /
      Evaluations Completed / Sold / Lost / Clients (Clients from `METRICS.trainerDeals`). The "Assigned Leads & Office
      Notes" table is NOT on the Dashboard any more (it broke the flow tiles -> pipeline -> clients); My Leads keeps it,
      and My Locked Trainer Page moved below the clients. Earlier tile list: (Assigned / Evaluations Scheduled / Evaluations Completed / Sold / Lost from
      `METRICS.trainerDashboard(trainerLeads(trainer.id), trainerSubmissions())` — the audit pins that exact call), then
      "My Pipeline" (`METRICS.trainerPipeline`: New Inquiry, Eval Scheduled, Eval Completed, Sold, Lost), then "My
      Clients". `wireTrainerScrollSpy()` only toggles the sidebar `.active` class; it never sets `state.activeView` and
      never calls `render()` (that would redraw while scrolling). It disconnects before every rewire.
    - **One page (2026-09-14, Joshua: "a one-page scroll, selecting each tab automatically as we progress down the
      page… no loading windows, just a smooth scroll… even on mobile").** For a trainer (no password/profile gate)
      `renderView()` draws `trainerOnePage()`: one `<section id="trainer-sec-<view>" data-spy-view="<view>">` per
      `trainerNav()` tab, in menu order, each screen drawn ONCE (Dashboard = the 7 tiles only; My Leads = My Pipeline +
      All My Leads & Office Notes; Clients; My Trainer Page + What Trainers Can Do; Photos/Videos; Reviews; Settings).
      A tab click on the one page only scrolls (`scrollToTrainerSection`, smooth) — it never calls `render()` or
      `reloadRemoteData()`. `wireTrainerScrollSpy()` lights the tab on screen (sidebar AND the phone strip) and never
      changes `state.activeView`; the last section is lit at the very bottom. Phones (<= 900px) hide the sidebar menu
      and show the sticky `.trainer-onepage-tabs` strip under the banner. Opening the page on a saved tab lands on its
      section. Communications (off the menu) still opens alone from "Log a call"; any tab brings the one page back.
    - **Both upload forms share field names on the one page.** The `submitDemoContent` handler reads ONLY its own
      `.panel` (`const scope = event.target.closest(".panel")`), never `document.querySelector('[name="submission-…`,
      so a Reviews submit can never send the Photos form. Keep it scoped.
    - **Opens on Dashboard (2026-09-14).** The one page always OPENS at the top with Dashboard lit (sign-in, reload,
      a saved tab); only a tab tap from another screen (`trainerOnePageJump`) lands on that tab. At `scrollY < 8` the
      lit tab is always Dashboard.
    - **Lead details for trainers (2026-09-14).** A tapped card (`.trainer-card[data-open-lead]`) or lead-table row
      opens `trainerLeadDetailPanel()` inside the one page: contact (Call / Email links), what they asked for, every
      booked dog, the evaluation, **the pre-evaluation questions (`leadPreEvalBlock`, answered or "not answered yet")**,
      office notes with NAME bylines (`portalActorName`, rule 70), plus "Log a call" and "Submit a deal for this
      client". READ ONLY: no status select, no note box, no mutation (rule 7). Only the trainer's own leads open.
    - **Deal form fills from the lead.** `dealPrefillFromLead()`: the booking's client name and EVERY dog, else the
      lead's name/dog; `dealLeadSummary()` shows phone, email, address, dogs, wanted, evaluation under the picker.
    - **Logged deals can be edited.** "Edit this deal" (View more) loads the deal into Submit a Deal (edit mode, "Save
      changes"); the lead link is shown, never changed. `api/submit-deal.js` `op:"update"`: only the trainer's OWN
      deal (403 otherwise; office any), not a cancelled one (409). Names / dog / program / notes always; money
      (sold, collected, date, plan) only when sent AND no installment is marked paid (409 "already marked paid");
      a money change rebuilds `deal_payments` (DELETE then INSERT because of `unique (deal_id, sequence)`; on a failed
      INSERT the old rows are put back). Never touches the lead. Every edit appends `raw_payload.edits` (who, when,
      before). The browser locks the money boxes when a payment is paid. Tests: `tests/trainer-leads-deals-2026-09-14.test.mjs`.
    - **The trainer's Lost column holds only "Lost…" statuses and Evaluation Cancelled.** Bad Lead, Do Not Contact and
      Archived are NOT drawn: a trainer must never be told to call them. Cards only claim what is recorded (the
      booking-link text); win-back texts are not recorded, so no card may say they were sent.
    - **Clients tiles:** Clients To Go (Track 500, counts DOWN from 500; a client with two deals counts once) /
      Revenue / Collected / Balance Due / Contracted Revenue ($1,250,000 minus revenue, never below 0), all from
      `METRICS.trainerDeals`. Rows open "View more" (`state.openDealRow`).
    - **Submit a Deal:** picking the lead fills Client name + Dog name (the lead's dog only, never the breed) and locks
      them; the boxes are set BEFORE the redraw so the rule-14 net cannot bring back an old typed name. Program is a
      dropdown (`DEAL_PROGRAM_CHOICES` = PLACEHOLDER until Rachel/Missy send the list) + "Other (type it)"; an older
      deal's program is kept as Other. The POST body to `api/submit-deal.js` is unchanged. "Today" is the trainer's
      local day (`localTodayIso`), not UTC.
    - **Sales column `confirmed`** is labelled "Eval Questions Completed" (label only; key + `site_visit` unchanged).
    - **Booking radius is 50 miles** (`RADIUS_MILES`, Joshua 2026-09-16; Tim's 2026-09-12 meeting had 30). The booking
      page and the office email read `RADIUS_MILES` instead of spelling a number. `scripts/zip-radius-check.mjs` prints
      the per-ZIP table (who is within 50 miles, who is auto-assigned, what the page shows).
    - Texts are NOT changed here: trainer "Track 500 - Schedule Eval", Tim's "Track 500" and "closed" texts live in Make
      (rule 73: needs Joshua's OK).
    Tests: `tests/trainer-portal-2026-09-12.test.mjs` (8). Audit rule 74 check pins 50 since 2026-09-16 (was 30).

## Pre-evaluation questions + saved follow-up texts (added 2026-09-14, Claude, branch feat/meeting-2026-09-12)

81. **The client answers the pre-evaluation questions after booking; the follow-up texts are SAVED and never sent.**
    Joshua 2026-09-14: "these are the evaluation questions attached, make it fit our design uniformed" and, for the
    follow-up text, "don't send to anybody now because we are building in sandbox, but save this."
    Source files: `/Volumes/mindfulssd/LDTT Meeting 2026-09-12 - Working Files/eval-questions/` (the .pages + text export).
    - **Record before the change:** the confirmation text's `pre_eval_link` was `/book/<trainer>?lead=<id>` and reopened
      the congratulations screen (Angela's bug, meeting [0:47:30]); 216 tests + audit green at c3bbc70.
    - **Questions** live in ONE list, `lib/pre-eval.js` `SECTIONS` (7 parts, Joshua's document). Part 1 only asks what
      booking did not (how long in the family, where from, per booked dog). Required: #1 behavior, bite history,
      children, other animals. `cleanAnswers()` keeps only listed questions and listed choices, caps text (300 / 2000),
      strips control bytes and drops a follow-up box whose trigger is not met (400 on a missing required answer).
    - **Page:** the booking page's `stepPre` + `stepThanks`, same cards, fonts and red as steps 1-4. It opens from
      `?lead=<id>&step=questions` (the text's link, `lib/pipeline.js` `pre_eval_link`; same Make key, so Make is
      unchanged) and from the button on the congratulations screen. Answered already = thank-you + "Change my answers".
      The thank-you lists: dog on a leash when the trainer arrives, everyone who cares for the dog and decides at the
      evaluation, questions ready.
    - **Save:** `POST /api/booking {op:"pre_eval"}` (404 on live like every booking route, rule 71). Only a lead that
      booked or requested (409 otherwise). Writes ONLY `raw_payload.booking.pre_eval` = {answers, rows [question,
      answer], flags, submitted_at, first_submitted_at, updates} through the version-guarded patch. It NEVER changes
      the status, the eval time or a hold.
    - **Sales:** `metrics.salesStageFor()` puts an `evaluation_scheduled` lead WITH answers in "Eval Questions
      Completed" (stage `confirmed`). The status is unchanged, so the Leads tab never moves (rule 1), and
      `salesTotals().booked` adds booked + confirmed + evaluated, so the nightly cross-check figures do not move.
    - **Who reads the answers:** the office lead panel (`leadPreEvalBlock`, safety flags first) and the trainer's Eval
      Scheduled card ("Pre-eval answers ✓ Read them"; trainers cannot open the office panel). The trainer TEXT does not
      carry them yet (Make; needs Joshua's OK, rule 73).
    - **Follow-up texts:** `lib/reengage.js`. Tim's wording (+ "Reply STOP to opt out."), steps 15 min, 40 min, 24 h,
      48 h after the lead came in, only while not booked; quiet hours 9 PM-8 AM Eastern push a text to 8 AM. Who: SMS
      consent, a phone, status new_inquiry / office_contacted / engaged_no_outcome, no booking or request, not the
      recruiting / office-call lane, not a booklet request, not QA. Older than 48 h = the backlog ("the 95"), one text
      when switched on. `SENDING_ENABLED = false` and the file has NO fetch / hook / Make / Twilio code: the test
      refuses it. Settings shows the plan read-only (`GET /api/pipeline?op=followup`, office login, practice only).
      Switching it on needs Joshua's go, its own Make route with the tester filter (rules 72-73) and a plan for "Reply YES".
    Tests: `tests/pre-eval-and-follow-up.test.mjs` (8). Cache stamp 20260914preeval1.

## Text lock: only Joshua's phone (added 2026-09-14, Claude)

82. **Every practice-copy text goes ONLY to +14402142915 (Joshua) until Joshua says otherwise.**
    Joshua 2026-09-14: "don't send any text until I tell you; for now send only to me 4402142915."
    - `lib/pipeline.js` `PRACTICE_TEXT_ONLY_TO = ["+14402142915"]`. `activeTesterPhones()` (the ONE place every text
      path asks: booking link, customer care, confirmation, trainer alert, Operations) returns only tester phones on
      that list, and an empty set on any error (fail closed). There is one tester lookup; never add a second.
    - The Operations and trainer-alert phones are forced to the locked number when the saved Settings phone is another
      one (the row saved 2026-09-12 names Tim for Operations). `DEFAULT_PRACTICE_OPS_PHONE` is Joshua (was Tim).
    - A phone that fails the lock reaches Make as "" (the Make tester filters stay too, rules 72-73).
    - Live sends no pipeline texts at all (rule 72); the follow-up texts have no send code (rule 81);
      `api/lead-journey.js` (off the menu, rule 63) keeps its own tester check and is not used.
    - Widening the lock (Tim, Angela, real customers) needs Joshua's words in the chat.
    - **WIDENED 2026-09-14 afternoon (Joshua, before the presentation): "test the full message flow from landing page
      2.0, me, Tim and Angela all different roles, and change or add numbers in the portal".** `PRACTICE_TEXT_ONLY_TO =
      null`: a practice text goes to a phone only when it is an ACTIVE tester (portal: Communications -> Testers) AND
      passes the Make tester filters (+14402142915 Joshua, +12168168026 Tim, +14408217077 Angela). Roles: Client = the
      phone typed on the form; Trainer + Operations = Settings -> "Booking emails to the office" boxes (saved: trainer =
      Angela, operations = Tim). `SEND_TEST_PHONE` keeps the Text messages Send test with Joshua. Real customers still
      never get a practice text (not testers); live sends no pipeline texts (rule 72). To lock again: set the list.
    Test: `tests/text-roles.test.mjs`.

## Trainers update their own leads (added 2026-09-14, Claude, option A)

83. **A trainer marks THEIR OWN lead Eval completed / Lost (with a reason) / Added to Alpha, and it is logged like an
    office change.** Joshua picked option A on 2026-09-14 (meeting 2026-09-12 [0:09:36], [0:12:06]).
    - One door: `api/trainer-lead-action.js` (rule 7: trainers write only through their own endpoints). Sign-in via
      `lib/portal-auth` `authorizeRequest` (rule 37); every table call through `supabaseRequest` (rule 5).
    - Only the trainer the lead is assigned to (`leads.trainer_id` = their `trainer_id`) or the office; 403 otherwise.
      `expected_version` mismatch = 409; the PATCH is guarded by `version=eq.<v>`.
    - `eval_completed`: ONLY from `evaluation_scheduled` -> `evaluation_complete`. `lost`: a reason is required
      (price / not_ready / other_provider / no_response / complaint -> the matching `lost_*` status, rule 10); refused
      on a closed lead (client, archived, do-not-contact, bad lead, already lost). `alpha`: `added_to_alpha` yes/no.
    - The PATCH writes ONLY `status` or ONLY `added_to_alpha`. Then the same three logs the office writes: `audit_events`
      (action `trainer_lead_<action>`, actor name + email, before/after, the note), `lifecycle_events` with the office's
      funnel words (`evaluation_completed`, `lost_no_response`) and `lead_events` `status_changed` (with the note).
    - The portal shows it in the lead details panel ("Update this lead"); the reason and note sit in `state.trainerLost`
      so a background redraw never loses them; Eval completed and Mark lost ask "Are you sure?" first.
    Tests: `tests/trainer-lead-action.test.mjs` (5).

## Decision sheet answers + Text messages editor (added 2026-09-14, Claude)

Joshua's saved answers (claude.ai artifact "LDTT Decision Sheet", 2026-09-14 05:55 UTC): Make texts = yes, but editable
in the portal by role with Send test and a "currently being used" label; two trainer texts; follow-up = Tim's text
then the booking link; booklet leads NO; no-consent email later; live after office tests; the ~95 leads not yet;
program list placeholder kept; questions page kept ("Tim made a better choice as CEO"); Contracted Revenue by
COLLECTED; service-dog gold tag YES; milestones later.

84. **The office edits every text in the portal; the finished words ride along with every Make send.**
    - One catalog: `lib/pipeline-texts.js` `TEXTS` (booking link, booking confirmation, trainer new evaluation,
      pre-evaluation answers, Ops new lead, Ops eval booked, Ops closed, follow-up 1 + 2-4). The STARTING words of the
      five texts Make sends today are Make's own words on 2026-09-14, copied exactly (`{{1.x}}` -> `{x}`); a test pins
      them, so switching Make to the portal changes no text. The meeting's "Track 500" wording is offered as a DRAFT.
    - Stored in `site_settings` key `pipeline_texts` (practice schema via `B.sbOrThrow`): per text `published`,
      `published_by` ("<Full Name> (<login>)"), `published_at`, `previous`, `draft`, plus a 200-entry `log`.
      `check()` refuses empty words, > 640 characters and any `{field}` the text does not offer; control bytes removed.
    - `api/pipeline.js`: GET `op=texts`, POST `text_save|text_publish|text_discard|text_reset` — office admin +
      super admin only (`authorizeRequest require:"admin"`); publish and reset need a two-word full name (rule 19
      pattern). Trainers never see the panel (`pipelineTextsPanel` returns "" unless admin + practice copy).
    - `lib/pipeline.js` `postHook()` calls `withTextMessages()`: pathway 1 gets `message`, pathway 2 gets
      `customer_message` + `trainer_message` (dog name falls back to "your dog" like Make), Ops gets `message`. If the
      editor cannot be read, the starting words are used: a send never fails on it. The customer-care text keeps its
      own `message`.
    - Make still uses its OWN words until Joshua OKs the switch (each Twilio body becomes
      `{{if(1.message; 1.message; <today's words>)}}` or the customer/trainer variant). Then set
      `LDTT_TEXTS_FROM_PORTAL=1` on the Preview target: the panel says "Make reads these texts" and Send test turns on.
      Send test (`sendTextTest`) goes ONLY to the locked phone (rule 82), prefixed "[TEST]", filled with example values.
    - Also on 2026-09-14: Contracted Revenue = $1,250,000 minus COLLECTED (`metrics.trainerDeals`); service-dog leads
      (`isServiceDogLead`: "service dog" in what they asked for) wear a gold "★ Service dog" tag on office, Sales and
      trainer cards and in the trainer's lead details (read-only); the follow-up plan is Tim's text at 15 min, then the
      booking link at 40 min, 24 h and 48 h (`lib/reengage.js` `STEPS[].kind`), still NOT sending; booklet leads stay out.
    Tests: `tests/pipeline-texts.test.mjs` (6).
    - **2026-09-14 06:57 UTC — Make switched to the portal's words (Joshua: "A, make the switch, but make sure no texts
      are sent").** The Twilio body of 6237328 is now `{{1.message}}`, 6237333 customer `{{1.customer_message}}` + trainer
      `{{1.trainer_message}}`, 6254549 both routes `{{1.message}}`. Tester filters unchanged. The earlier words are
      recorded in `/Volumes/mindfulssd/LDTT Meeting 2026-09-12 - Working Files/baseline/MAKE-TEXTS-BEFORE-2026-09-14.md`
      (restore = put those bodies back). Proof nothing was sent: each scenario's history shows the "modify" entry at
      06:57 and no run after it. `LDTT_TEXTS_FROM_PORTAL=1` set on the Vercel Preview target. Because Make now sends
      exactly `message`, the pipeline must ALWAYS fill it: `withTextMessages()` renders the words in use, and the starting
      words when the editor cannot be read. Never remove that fallback while Make reads `{{1.message}}`.
    - **Super Admin only (2026-09-14).** GET `op=texts` answers 403 to office admins; every change
      (`text_template_save`, `text_template_delete`, `text_activate`) and `text_test` need `require:"super"`.
    - **Stages x roles, several templates.** `STAGES` (new lead, not booked, booked, answered, closed) x `ROLES` (client,
      trainer, operations). Each text: built-in "Starting words" + up to 10 templates; exactly ONE is in use
      (`active`, "starting" or a template id). Putting one in use needs a two-word full name; the template in use cannot
      be deleted; words saved by the first editor (published/draft) carry over as templates. Every change is logged.
    - **The texts row is SERVER ONLY (2026-09-14, found by the review agent).** Restrictive policy
      `pipeline_texts_server_only` on `practice.site_settings` hides key `pipeline_texts` from every browser login
      (office admins could otherwise read/write it through the `admin_all` policy and skip the Super Admin check).
      Migration `20260914120000_practice_pipeline_texts_server_only.sql`. Never drop it, and never read the texts
      from the browser: the page uses `/api/pipeline` only. `withTextMessages()` re-checks the saved words before
      every send and uses the starting words when they fail; `check()` refuses a text made only of `{fields}`.

## Ad landing pages 2.0 in Page Studio (added 2026-09-14, Claude; practice copy only)

85. **The 2.0 pages are Page Studio pages of type `ad2` — practice copy only UNTIL 2026-09-23, LIVE SINCE (see rule 100: `public.ad_pages` accepts `ad2`, /ads/<slug> serves them on live, the studio lists them on live, and Send to live carries them; the practice copy stays the editing rehearsal space).** Joshua 2026-09-14: "make them
    available in the sandbox, both in the drop down and in the page studio"; meeting 2026-09-11: "Add the 2.0 pages
    into Page Studio so Arrison can edit them herself." (My 12 Sep report said this was still pending; it was.)
    - `lib/ad2-page-template.js` is the 11 Sep build script (`~/Desktop/LDTT Ad Pages 2.0 2026-09-11/tools/build.py`)
      in JavaScript. The three starters draw the same HTML as the 11 Sep files (checked 2026-09-14 after removing the
      practice notes: identical except that apostrophes in two labels are now written safely as &#39;). Styles, photos and the page script are copied into `assets/v2/`; the map shapes into
      `lib/ad2-usmap.js`. Never hand-edit the layout numbers; change words, photos, video titles, reviews and states.
    - The office never stores HTML: `normalizeContent()` keeps only the fields the design draws, escapes every
      string, and `photoUrl()` accepts only our own `/assets/v2/` files or an https address with no quotes,
      brackets or spaces. Up to 12 states (the design has room for two columns of six).
    - Rule 11 holds: the Meta pixel and Google Ads tag come only from `lib/ad-page-template.js`. On the practice copy
      they are LEFT OUT so test leads never reach the ad accounts. The form posts to the same site's
      `/api/booking-lead` (rule 71). The editor's preview form has no endpoint and sends nothing.
    - `practice.ad_pages` accepts `page_type = 'ad2'` (`20260914140000_practice_ad2_page_type.sql`); `public.ad_pages`
      does NOT, and `api/send-to-live.js` refuses an `ad2` page with a plain 409. Going live needs the office tests,
      Joshua's OK, the same CHECK change on public, and a live form route.
    - Where the office finds them: Page Studio → "Ad landing pages 2.0" (Edit full screen, Duplicate, + New 2.0 page,
      "Add the three 2.0 pages"); the Site Builder page list ("Ad pages 2.0"); the Page Editor → Main Website Pages →
      "Website Page" dropdown (group "Ad landing pages 2.0"). 2026-09-15 (rule 89): a 2.0 page now opens IN the Site Builder (its old editor stays under the Site Builder's More menu), and the Page Editor button reads "Edit this page in the Site Builder".
    - Served at `/ads/<slug>` (`api/ad-page.js` `adFamily`), publish verification, export, sitemap and health treat
      `ad2` like `ad`. Tests: `tests/ad2-pages.test.mjs`.
    - **Site Builder "Landing page" dropdown (office, 2026-09-14).** The Site Builder top bar lists every landing page
      (Landing pages, Ad pages, Ad pages 2.0 on the practice copy); picking one saves the open page, then opens the
      pick in its own editor (block editor, ad editor or the 2.0 editor). `paintJump()` / `jumpTo()` in site-builder.js.
    - **2026-09-16 (Arrison's asks, chat + her email).** The founder "MEET THE FOUNDER," eyebrow sits INSIDE
      its section (it was drawn 10px above it and overlapped the hero) and the founder quote box clips
      (.quote overflow:hidden) so text never spills onto the next section. Every PHOTO_SLOTS entry carries a
      4th "best size" element the editors show. `videos2` (founder, ba1-4, st1-3) holds the office's OWN
      video per play button — https MP4/WebM or a YouTube link — stored only when set, so untouched pages
      keep their exact bytes. The Free Booklet modal carries a real download link
      (assets/calm-dog-blueprint-final.pdf; per-page override `b_url`). One 2.0 page exists per market
      (scripts/migrate-ad2-markets.mjs), wording and photos migrated from the original ad pages; the old
      pixel ad pages stay, and the three starter pages are Arrison's to edit.

## Local time zones and dog age units (added 2026-09-15, Claude; practice copy)

86. **Every eval time shows in the lead's local time zone, and every dog has Age units.** Office 2026-09-15: "time
    zones EST, CST, PST and more automatically when the eval is scheduled, based on the ZIP code, and they should also
    see that in the text"; meeting 2026-09-14 49:30-51:30 + Zoom chat "Fix the time zone on all submissions";
    52:00-56:00 + chat "Add age units, weeks, months or years"; Rachel's "Updated Sandbox Notes" (card order).
    - `lib/zip-timezone.js` (data only, server + browser): ZIP prefix -> state -> zone, with the split prefixes
      (Florida Panhandle 324/325 = Central: Panama City Beach and Miramar Beach are CENTRAL; west KY, east TN, NW/SW
      Indiana, El Paso, north Idaho...). Unknown ZIP -> the trainer's zone.
    - `lib/booking.js` `localTimeZone()`: in-home = client ZIP (or the ZIP ending the address); training center =
      the trainer's calendar zone. `api/booking.js` saves `booking.local_time_zone` and writes `when_label` in it;
      the trainer text and Tim's text (`lib/pipeline.js`) and the production@ email use it ("8:00 AM CDT").
    - Portal: `leadEvalLabel(value, leadTimeZone(lead))` on the lead card, lead details and trainer view; older
      leads fall back to the ZIP. The booking page itself still shows times in the trainer's zone (it says so).
    - Dogs: new required `age_unit` (Weeks / Months / Years) right after Age in the booking questions (a saved form
      gets it after Age, never at the end: `normalizeFields`). Card, trainer view and office email order: Sex |
      Spayed/Neutered · Age | Age units · Breed | Vaccinations · Behavioral challenges.
    Tests: `tests/zip-timezone-and-dogs.test.mjs`.

## The real lead timeline and Track 500 (added 2026-09-15, Claude; practice copy)

87. **"What happened with this person" shows what really happened, and Track 500 is on the internal messages.**
    Office 2026-09-15 (screenshot of "Wording not supplied yet"); meeting 2026-09-12 ("Track 500 - Schedule Eval",
    Tim: "the only thing it needs to say is Track 500"); meeting 2026-09-14 16:30 (Kathy takes $250 off every Track
    500 job; Joshua: "I can add it to every email and text and make it in the portal").
    - `leadJourneyTimeline()` reads `raw_payload.pipeline` (each text: sent + time + phone ending, or the reason) and
      `raw_payload.booking` (booked time, office email, pre-eval answers). Built-but-off texts say "not sending yet".
      Each step shows the words in use from GET `/api/pipeline?op=texts_in_use` (office login, READ-ONLY: words in
      use only, never templates or drafts; editing stays Super Admin, rule 84). Leads from before the pipeline say so.
    - Track 500 lead = any lead that entered the pipeline (`raw_payload.pipeline.entered_at` or `.lane`): a navy
      "Track 500" tag beside the service-dog tag (office card, Sales, trainer view, lead details) and in the timeline.
    - Office emails: subject "[PRACTICE COPY] Track 500 · ..." (`track500Subject` in lib/office-email.js).
    - Practice texts in use (practice.site_settings `pipeline_texts`, migration practice_track500_text_wording, by
      "Joshua Matthews (Track 500 wording from Tim & Angela)"): trainer "Track 500 - Schedule Eval ...", Tim "Track 500 -
      New lead: ..." and "Track 500 - Eval booked: ...". Client texts never say Track 500. Starting words unchanged.
    Tests: `tests/journey-track500.test.mjs`.

## Process audit 2026-09-15: client time zones, full address, eval time, Do Not Contact (Claude; practice copy)

88. **Times follow where the client is; the address is complete; the eval time stays; Do Not Contact undoes.**
    Office 2026-09-15: "it should show the proper time zone based on where the person is booking; audit this process
    for any gaps; make sure the mail list is complete; the Do Not Contact glitch Rachel found."
    - Booking calendar: GET /api/booking?trainer=…&zip=…&location=… answers `display_time_zone` (client ZIP zone
      in-home, trainer zone at the training center) and `display_is_client`; the page draws every time in it
      (`calZone()`) and says "your time zone". Booked time, texts and email already use the same zone (rule 86).
    - Typed eval time (lead details): read and shown in the LEAD's zone (`wallTimeToIso` / `wallTimeOf` in
      lib/zip-timezone.js); the box says which zone. It used to use the office computer's zone.
    - Full address: booking questions Street address + City + State (select) + ZIP code, all required (meeting
      12:00-13:00). `client.address` = the full line for everyone downstream; `client.street` keeps the street;
      the lead's city / state / zip columns are filled. The ZIP box fills from step 1.
    - Office email: "Time zone: Central Daylight Time", "Request received" in the lead's zone (never raw UTC),
      "Track 500: Yes" for pipeline leads, full address.
    - Lead card: the eval date + time shows at EVERY status once set (Rachel).
    - Do Not Contact: ticking saves `raw_payload.status_before_dnc`; unticking restores it (was always "Office
      Contacted").
    Tests: `tests/audit-2026-09-15.test.mjs`.

## Site Builder 2.0: one editor for every page (added 2026-09-15, Claude; practice copy)

89. **The Site Builder is the one editor: site, landing, 2.0 ad and trainer pages all open in it; a page that uses
    none of the new options renders byte-for-byte as before.** Joshua 2026-09-15 (option B): "complete and functional
    ... save changes, add block, change text, font, background, rearrange sections and elements, layout selections,
    colour schemes, upload video, duplicate ad landing pages and all pages, trainer bios page, full screen editor with
    instructions on how to use it."
    - **Record before the change:** 37 template renders (12 market ad pages, their editor renders, the three 2.0
      starters practice + live, 7 Site Builder starters) were hashed before any edit and are identical after
      (`baseline.cjs` in the session scratchpad). New keys are stored ONLY when used (2.0 pages: `blocks`, `logo`,
      `hidden`, `order`), the 2.0 CSS (`EXTRA_STYLE`) ships only on a page that uses a 2.0 look, and the editor hooks
      (`data-sb-edit`, `data-sb-richedit`, `data-sb-img`, `data-sb-sec`) exist only in the editor render.
    - **Block pages (`lib/site-page-template.js`):** per-block `layout` (whitelist `LAYOUTS`, first value = the old
      look), design extras (`gradFrom/gradTo/gradAngle`, `bgVideo`, `overlay`, `textColor`, `headSize`, `font`,
      `headFont`; "" = unused), theme `logoWidth` / `headScale`, one-click `COLOR_SCHEMES` (all pass `themeWarnings`),
      Video block `provider: "file"` (MP4/WebM; an iPhone MOV is refused in plain words: the bucket refuses MOV and most MOV files do not play in Chrome). Block pages store `layout` and the empty design keys on their next save (renders unchanged; the "stored only when used" rule is for 2.0 pages). A block background photo address is now written with `&quot;`
      (it used raw quotes inside `style="…"` before, which broke the attribute).
    - **Big uploads:** `api/pages.js` operation `upload_url` (office login) signs a one-time upload address: MP4/WebM videos up
      to 50 MB into `trainer-page-videos`, photos up to 10 MB into `trainer-page-assets` (practice-* on the practice
      copy). Photos of 3.5 MB or less still use the proven `upload` operation. `lib/page-durability.js` counts the video
      bucket as the deployment's own storage (checked, never copied into the photo bucket, which refuses video) and
      copies a practice video reaching live into the VIDEO bucket; `bgVideo` is a media key.
    - **Block kit (`renderKitBlocks`, `kitStyle`, `normalizeKitBlocks`):** Site Builder blocks on pages that are not
      block pages. Each sits in `<div class="ldtt-bk">` with base CSS scoped to `.ldtt-bk`; the lead-form block is
      refused there (`KIT_EXCLUDED`); a kit block never makes an H1.
    - **2.0 ad pages (`lib/ad2-page-template.js`, rule 85):** `renderPage` returns the 11 Sep bytes unless the page
      uses `blocks`/`logo`/`hidden`/`order` (or the editor asks); `arrange()` splits the page at its sections
      (`ANCHORS`), keeps the header and footer fixed, reorders, hides, places kit blocks after their section and swaps
      the logo in header + footer (function replacements: a pasted address may contain "$"). In the editor the design's own
      photos carry `data-sb-img="photos.<slot>"`, so a click on one opens the photo picker. `api/ad-page.js` and `api/pages.js` pass live review/trainer data to those blocks.
      Still practice copy only (Send to live still refuses `ad2`).
    - **Trainer pages (`app.js`):** `draft_content.custom_blocks` / `custom_order`, read back by `remoteTrainerToUi`
      (draft for the editor, published for the public page, rule 56). The public page runs
      `applyTrainerCustomOrder` (nothing moves when the order is empty) and `applyTrainerCustomBlocksPublic`, which
      loads `/lib/html-sanitize.js` + `/lib/site-page-template.js` ONLY when the page has blocks and fails open
      (rule 43). The Site Builder saves a trainer page with the Page Editor's own `persistTrainerRecord` (what
      `markBuilderDraftDirty` does) and publishes with `runRemoteMutation(… publishTrainerPageWorkflow(t, true))`; it
      only ever edits the trainer it opened (id/remoteId checked, rule 31) and writes back ONLY the fields changed on its
      screen since it opened or last saved (`applyChangedToTrainer`), so it never undoes a change made meanwhile in the
      Page Editor, Trainer Network or another tab. Photo size/place, the photo library and
      socials stay in the classic Page Editor (More → Open this page in the classic Page Editor).
    - **Site Builder (`site-builder.js`):** click words on the canvas to type (plain text; rich text through the
      same sanitiser; a click that changes nothing writes nothing), only the Delete key removes a selected block (never
      Backspace, which fixes typing), click a photo to change it, layout buttons, "? How to use" (shown once per browser) + a tour,
      "⧉ Copy" on every page row (site, landing, ad, 2.0; the copy is a draft), a Trainer pages group and trainer
      pages in the Landing page dropdown. The old 2.0 editor opens only from More (`open(id, { classic: true })`).
    - **Page Editor audit fixes:** its preview iframe is sandboxed without top navigation, so a link or redirect inside the preview can
      no longer take the portal away (allow-same-origin stays, so it is not a security boundary); its page dropdown redraws when the page list arrives (it stayed empty) and never lists Page Studio ad pages (their
      /ads/ preview would fire the Meta pixel from office browsers);
      on a main website page the "Replace selected image" control is gone (the photo was kept in the browser only and
      it turned the selected trainer's page into a draft); "✦ Edit in the Site Builder" sits in its top bar.
    Tests: `tests/site-builder-2.test.mjs` (9). Browser proofs (local in-memory server, no login): 13 Site Builder
    checks, 15 for a 2.0 page (open, fields, block under a section, type on it, move it, hide/move sections, logo,
    publish, public page), 13 for a trainer page (open, type headline, block under the bio, hide/move, save carries
    custom_blocks/custom_order, public page draws the block, a page without blocks is unchanged).

## 2026-09-16 lanes: sandbox trainer sign-in, same-state hand-off, pipeline settings, bio reviews (Claude; practice copy)

90. **Passwordless trainer sign-in exists ONLY on the practice copy.** `api/sandbox-trainer-login.js` answers
    404 `{ ok:false }` for GET and POST unless `lib/sandbox.js` `isSandbox()` is true (`LDTT_SANDBOX=1`, server
    side); the browser draws the `#sandboxTrainerLogin` box (ships `hidden`) only after `/api/environment` said
    sandbox (`window.LDTT_IS_SANDBOX === true`, `setupSandboxTrainerLogin`), and
    `trainer-backoffice/supabase.js` `verifyPracticeTokenHash` throws off the practice copy. Trainers only: active
    `portal_users` rows with role `trainer`, `access_status` active and a `trainer_id`; admin rows and the two admin
    testing logins are refused (403). The answer carries the magic-link `token_hash` only, never the `action_link`;
    no password is set, changed or removed (rule 33). After the token exchange the trainer goes through the SAME
    `finishPortalSignIn` as a password login. Tests: `tests/sandbox-trainer-login.test.mjs` (5).
91. **A same-state hand-off writes ONLY `trainer_id` (+ `assigned_trainer_name` when the row has it), guarded by
    `version`.** _(The same-state downline is SUPERSEDED by rule 105 on 2026-09-25: the downline is now the owner's
    hierarchy chart. The write rules below — only `trainer_id` + the name column, version guard, the two log rows, no
    `lifecycle_events` — still hold word for word.)_ `api/trainer-lead-action.js` GET `?team=1` = every ACTIVE trainer in the caller's state ("Ohio" ==
    "OH"; drafts, inactive rows and the caller left out; the office may pass `trainer_id`). POST action `handoff`:
    only the trainer the lead is assigned to (or the office) may hand it off, only to a trainer in that downline
    (403 otherwise, even for the office; cross-state moves stay with the office's own assign tools). No status, no
    eval time, no other lead field (rule 83); `audit_events` `trainer_lead_handoff` + `lead_events`
    `trainer_handoff`, no `lifecycle_events`. Tests: `tests/trainer-handoff.test.mjs` (6).
92. **The pipeline text wording, the who-gets-which-text roles, the follow-up plan and the booking-email list live
    under Sales Pipeline (`pipelineSettingsSection()`, below the board) for the Super Admin ONLY.** Office admins
    and trainers get nothing extra, not even a placeholder; Settings keeps the profile, password setup, help links,
    Log Out and the practice-copy tools, and tells the Super Admin where the wording went. Test: the pipeline
    settings test in `tests/trainer-portal-2026-09-12.test.mjs`.
93. **A trainer bio page shows "See my reviews" and the "What clients say about <first name>" block ONLY when there
    is a real review to show:** an approved review published to that trainer's page (`review_publications`, from
    the saved `approved_reviews` or `/api/approved-homepage-reviews?destination_type=trainer_page`) or a manual
    review box ticked "Show on page" (a real `true`; placeholder copy never counts). With none, the button and the
    `#reviews` section are absent. Text reviews only (a photo-only review is skipped); every value is escaped.
    Tests: `tests/trainer-bio-reviews.test.mjs` (6).

## Sandbox fix pass (added 2026-09-22, from CRITICAL-AUDIT-2026-09-22; practice copy + practice Make only)

94. **Make pathway 2 (6237333) is webhook -> Router -> two routes; a failed client filter never stops the trainer text.**
    - Route 1 "Client: tester phones only (text:equal)" -> the customer Twilio module (`{{1.customer_phone}}`,
      `{{1.customer_message}}`); route 2 "Trainer: tester phones only (text:equal)" -> the trainer Twilio module
      (`{{1.trainer_phone}}`, `{{1.trainer_message}}`). Same filters (the 3 tester phones, `text:equal`), same connection,
      same from-number as before; only the structure changed. Scenario stays active, scheduling "immediately".
      Backup of the old straight chain: `~/Desktop/LDTT Meeting Changes 2026-09-13/make-backup-pathway2-2026-09-22.json`
      (restore = `scenarios_update` with its `blueprint`). Trainer-only sends (new inquiry, pre-eval answers, log the
      deal, phone changed) should now show 2 operations in Make history, not 1.
    - Pathway 1 (6237328) unchanged: webhook -> one Twilio module, phone tester filter only.
    - The trainer one-page portal ignores `must_change_password` on the practice copy only (`trainerOnePageActive`,
      `!window.LDTT_IS_SANDBOX` gate, like the menu/topbar); live still sends a flagged trainer to Settings first.
    - The same-state hand-off list (`api/trainer-lead-action.js` `sameStateTeam`) also drops test rows (a whole-word
      "Test" in the name, a `-test-` slug) and office drafts (`office-draft-` slug), even while active.
    - Practice rows set `inactive` (not public): clark-patton, john-delbane, emilio-marotta, donal-duck,
      o-brien-test-mto7wcs1 and the two office-draft "New Trainer Draft" rows. A `practice.reset_from_live()` brings
      them back as active until live is cleaned too.
    - Eval dates on Sales/trainer cards are long: "Tuesday, September 15, 2026, 10:00 AM EDT" (`leadEvalLabel`).
    - A lead from `/ads/<market>` or the 2.0 ad site is labeled "Ad landing page 2.0" (`leadOriginLabel`), using the same
      `isAdPageAddress` rule as its Track 500 badge.
    Tests: `tests/sandbox-fixes-2026-09-22.test.mjs` (5), `tests/office-email.test.mjs` care test, `tests/trainer-handoff.test.mjs`.

## Real trainer numbers on the practice copy (added 2026-09-22; practice copy + practice Make only)

95. **`practice_real_numbers` is the one switch that lets the practice copy text REAL trainers. It is OFF by
    default, the client text is never freed by it, and live never reads it.**
    Joshua 2026-09-22: "Make it fully ready for testing everything real in the sandbox with real trainer numbers,
    and still allow me to edit roles if necessary or type a number."
    - Two new keys in `site_settings.pipeline_office_emails` (`lib/pipeline.js` `normalizeSettings` /
      `defaultSettings`): `practice_real_numbers` (boolean, default **false**; only a real `true` turns it on, so a
      row saved before today stays off) and `practice_trainer_override_phone` (10 digits or a plain error).
      Both save through the existing `save_settings` op; nothing else about the settings row changed.
    - **Switch OFF = today's behaviour, unchanged.** Trainer texts go to `practice_trainer_phone`, trainer and
      Operations email twins only to `practice_email_to`, Operations texts to `practice_operations_phone`, and
      `sendTextTwinEmail` still refuses any other address.
    - **Switch ON (practice copy only)**: trainer texts go to the assigned trainer's OWN `trainers.phone` and
      trainer emails to their ACTIVE `portal_users` login (else `trainers.email`) — the same resolution live uses,
      so trainers rehearse on their own handsets. Operations texts go to `operations_phone` when it is filled in,
      else `practice_operations_phone`; Operations emails to `operations_email` when it is filled in, else
      `practice_email_to` (a row that never touched that box still holds the starting address, so CLEAR the box to
      keep practice emails off it). Subjects still start "[PRACTICE COPY]" and every email twin still carries the
      "PRACTICE COPY" line.
    - **`practice_trainer_override_phone` beats everything**, switch on or off: every trainer text lands on that one
      handset. Live ignores it (`trainerOverridePhone` returns "" off the practice copy).
    - **The client text is NEVER freed.** `clientPhoneFor` is untouched: on the practice copy a client text still
      needs an ACTIVE `communications_testers` row, so the practice copy can never text a stranger. The portal box
      says so in plain words. Same for `newLeadTextPlan`, `careTextPlan` and `sendFollowUpText`.
    - **Every number the practice copy texts this way becomes an ACTIVE tester** (`registerTesterPhones`, the write
      half of the old `registerRolePhonesAsTesters`): on save, and again just before a send through
      `trainerTextPhone` / `sendOpsText` / `sendTextTest`. A failed registration never stops a text — the code gate
      is the resolved number itself, not the tester list.
    - `trainerWithPhone(lead, trainer, settings)` now loads the real trainer row on the practice copy too, but ONLY
      while the switch is on; with it off it still short-circuits exactly as before.
    - **Live is untouched**: `practiceRealNumbers()` and `trainerOverridePhone()` both answer false/"" when
      `LDTT_SANDBOX` is unset, whatever the saved row says. `trainerPhoneFor` keeps its `{ ok, phone, reason }`
      shape.
    - **Portal (Sales → "Text settings & test scenarios" → "Who gets the texts on the practice copy")**: the switch,
      a one-line "Right now:" summary of who gets what (`practiceRecipientSummary`, served on
      `GET /api/pipeline?op=settings` and on the save answer as `recipient_summary`), the new override box, and the
      role boxes — Client test phone, Trainer phone (used when the switch is off), Operations phone (practice),
      Operations phone on live, Operations email on live, Practice email inbox. Every box is on the rule-14
      `typedFieldKey` whitelist, so typing survives a redraw.
    - **Send test follows the same rules** (`sendTestPhoneFor`): a CLIENT test still goes only to the locked phone
      (rule 82/84); a TRAINER test goes to the override, else the trainer test phone — **a test can never reach a
      real trainer**, because a test has no lead behind it; an OPERATIONS test goes to the Operations phone in use.
      All three still have to be an ACTIVE tester, and Send test still waits for `LDTT_TEXTS_FROM_PORTAL=1`.
    - **Make (practice scenarios only).** So a real trainer number is never dropped by a tester list:
      pathway 2 (6237333) TRAINER route filter is now "Trainer: phone is not empty"
      (`{{1.trainer_phone}}` `text:notequal` ""), and the ops scenario (6254549) keeps its stage conditions with the
      phone condition changed to `{{1.operations_phone}}` `text:notequal` "". Pathway 2's CLIENT route and pathway 1
      (6237328) stay tester-filtered on the 3 tester phones. Both scenarios stay active, scheduling "immediately".
      Backups of the pre-change blueprints:
      `~/Desktop/LDTT Meeting Changes 2026-09-13/make-backup-{pathway1,pathway2,ops}-2026-09-22b.json`
      (restore = `scenarios_update` with the file's contents as `blueprint`).
    - **Practice data.** Missy's 2026-09-16 list has "Carolina Don (619) 213-7240" = Carolina Perez (Joshua
      confirmed); her `practice.trainers` row held the shared office placeholder and now holds that number
      (migration `practice_carolina_perez_real_phone`, practice schema only, guarded so it only writes over a blank
      or the placeholder). The only ACTIVE practice trainers still on the placeholder, and the only two with no
      active portal login, are `arion-goble` and `sean-urena`: with the switch on their trainer texts and emails are
      skipped with the plain "trainer has no phone on file" / "trainer has no portal email" reason.
    Tests: `tests/practice-real-numbers.test.mjs` (12). Check on the practice copy: with the switch OFF a booking
    still texts only the tester phone; with it ON the assigned trainer's own phone gets the alert, the lead's
    non-tester phone still gets nothing, and the number shows up as an active row under Communications → Testers.

## Plain-message mode on the practice copy (added 2026-09-22; practice copy only)

96. **The practice copy marks what people RECEIVE only while `practice_real_numbers` is OFF. With the switch
    ON the wording is plain, exactly like live.**
    Joshua 2026-09-22: "don't write rehearsal/practice wording for now; at this last stage it needs to work
    like it's live."
    - One helper decides it: `practiceMarking(settings)` in `lib/pipeline.js` = `isSandbox() && !practiceRealNumbers(settings)`.
      Three call sites and no others: `twinSubject()` (the "[PRACTICE COPY] " subject prefix),
      the `practiceLine` in `sendTextTwinEmail()` (the yellow notice in the text-twin email), and the
      `practice:` flag handed to `M.buildBookingEmail()` for the office emails.
    - `twinSubject(kind, clientName, settings)` takes a third argument now. Called with no settings it marks,
      so nothing that has not been updated goes quiet by surprise.
    - **`lib/office-email.js` did not change.** It stays a pure renderer of its `practice` flag (subject prefix
      + the yellow notice, both branches intact). Only the ONE caller decides the flag. Do not move the switch
      into office-email.js.
    - **Where an email GOES never changes with the switch.** `emailRecipients(settings, isSandbox(), kind)` and
      `opsEmailFor` / `trainerEmailFor` still send every practice email to `practice_email_to` only
      (rule 95, Joshua's option B). The switch changes the WORDS, never the address.
    - **The text messages themselves were never marked** and still are not — the marking only ever lived on the
      email side. `lib/pipeline-texts.js` carries no practice wording in any template.
    - **The machine-readable practice flag in the Make payload is untouched** (`practice: isSandbox()` on every
      `postHook`). Verified 2026-09-22: none of the three practice scenarios (6237328, 6237333, 6254549) filters
      on it, so it is informational — but keep sending it.
    - **Live is unaffected**: `practiceMarking()` is false when `LDTT_SANDBOX` is unset, whatever the saved row
      says, so live is plain either way exactly as before.
    - **Leave the two on-screen banners alone.** The booking page's PRACTICE COPY bar (`lib/booking-page.js`)
      and the portal banner (`api/environment.js` label, `app.js`) are the WEBSITE saying where you are, not a
      message someone receives. They stay marked at all times.
    Tests: `tests/practice-real-numbers.test.mjs` — "rule 96: the practice marking follows the real-numbers
    switch (marked when off, plain when on)" plus the twin-email test, which now pins PLAIN with the switch on.
    Every other marker test runs with the switch off and still pins the marker. Full suite 373, audit 199.

    **Settings in force on the practice copy from 2026-09-22** (migration
    `practice_real_numbers_on_and_ops_phone_lorenzo`, practice schema only):
    `practice_real_numbers` = true, `operations_phone` = Lorenzo Miller's own number from
    `practice.trainers` (slug lorenzo-miller), `practice_operations_phone` unchanged as the fallback,
    `practice_email_to` unchanged. NOTE: `practice_email_to` is
    `production@lorenzosdogtrainingteam.com` — a real company inbox, not a throwaway address. With rule 96
    ON, practice emails land there with no marker at all. If the office ever needs to tell a rehearsal
    email from a real one again, turn `practice_real_numbers` OFF or point `practice_email_to` at a
    separate test address.

## Trainer landing page leads: on the Leads screen, and on into booking (added 2026-09-22; practice copy only)

97. **No lead form stamps `qa` on the practice copy, and a trainer landing page carries on into the booking
    flow the way the ad pages 2.0 do.**
    Joshua 2026-09-22 (voice note): "Trainer landing page leads are missing from the office Leads screen" and
    "trainer landing page leads must follow the same flow as the ad pages 2.0."
    - **The cause of the missing leads.** The practice copy is a preview alias on `*.vercel.app` (rule 50), and
      every browser lead form read a `*.vercel.app` host as a RELEASE-QA host (`isReleaseQaHost`) and stamped
      `raw_payload.qa = true`. Rule 1 holds `qa` rows out of every count, so those real practice leads never
      reached the office Leads screen — while the trainer portal (`trainerLeads()` reads `state.leads` with no
      hold-out) and the server-driven Sales panels still showed them. Proof in the practice data: the two
      trainer-page leads `2565397d-…47e6b5` and `59f927b7-…95e1f538` carry `qa: "true"`; the ad-2.0 lead
      `9d871aca-…d9f2` (made server-side by `/api/booking-lead`, which never stamps `qa`) carries none, which
      is exactly why only the 2.0 lead showed. 21 rows in `practice.leads` carry `qa = true`; 14 of them were
      stamped by the practice host (submission ids `practice-*` and the 2026-09-12 / 2026-09-23 `qa-release-*`
      rows that entered the pipeline), and only the 6 from 2026-08-06 are genuine release-QA rows (rule 1).
    - **The fix is at the stamp, never at the hold-out.** `metrics.js` `isQaLead` and `allLeadRows()` are
      unchanged — a genuine `qa` row is still held out of every count, chart and export (rule 1). Instead:
      `trainer-backoffice/app.js` `isReleaseQaHost()` answers false when `window.LDTT_IS_SANDBOX === true`;
      `script.js`'s practice Contact Us capture uses `isReleaseQaHost && !onPracticeCopy()`; `ad-funnel.js` and
      `market-landing.js` build their LEAD payload with `isQaLeadSubmission()`. The site-event (`track-site-event`)
      stamps are deliberately left alone. **Live is byte-identical in behaviour**: its host is the domain, so
      `isReleaseQaHost` was already false there, and the frozen live serialiser `wireAsyncForm` (rule 73) still
      reads the plain flag.
    - **Rows stamped before this fix stay held out.** Nothing back-fills them. The office sees them through
      "Show test records" on the Leads screen; clearing `raw_payload.qa` on a practice row is a data decision
      for Joshua, not something the code does.
    - **Trainer page -> booking.** `trainerPageBookingUrl(entries, canonical, pipeline)` in `app.js`, called
      from the `office-lead-form` handler INSIDE `if (window.LDTT_IS_SANDBOX === true)`, AFTER
      `/api/pipeline {op:"enter"}` answered (so every text and email has already gone out). It uses the link the
      pipeline already returns — `/book/<that trainer>?lead=<id>`, because a trainer-page lead stays with ITS
      trainer (rule 72) — and never builds a `/book/<slug>` address of its own. `book_url` null (that trainer
      takes no online bookings) falls back to the ZIP flow `/book?lead=&zip=`, so the office is not the only
      path. It refuses outside the practice copy, without a saved lead, for the free-ebook skip, for a
      non-booking lane and for an `ok:false` answer. Rule 74 still holds on the booking page itself: the slug in
      the address is a hint and the client always picks.
    - **Every existing delivery is untouched.** The practice branch never calls FormSubmit, `/api/form-delivery`,
      `submitLandingEmail` or `recordClientFormDelivery`; the live branch below it (form-delivery, then the
      browser FormSubmit retry to production@) is unchanged, and `tests/office-email.test.mjs`'s byte hashes
      still pass.
    - **Confirmed against the real practice rows** (read-only SQL): a trainer-page lead already gets the client
      booking-link text (pathway 1), the trainer's **New inquiry** text (`sendNewInquiryText`, pathway
      `new_inquiry`, kind `trainer_new_inquiry`) plus its email twin, Tim/Operations' new-lead text and email,
      and the office Resend email. All four were `sent` on both rows. Only the browser redirect was missing.
    Tests: `tests/trainer-page-leads-2026-09-22.test.mjs` (11). Full suite 396, audit 200.

## A repeat submit, and office smoke tests on the live site (added 2026-09-23)

98. **A second submit is a DOUBLE SUBMIT only when nothing about the request changed; and an office
    smoke test on the LIVE site is marked so it never reaches the counts.**
    Joshua 2026-09-23: "'Pensacola makes a new lead' must hold for EVERY ad 2.0 page and every other
    door" and "test leads must never mix with the live site's leads or counts".
    - **The reuse rule lives in ONE place**, `sameRequest()` in `lib/booking.js`, and it is used by the
      one server door that creates leads from a form (`createLead`, behind `/api/booking-lead`,
      `/book`'s own form and the no-trainer callback). A lead is reused only when ALL of these hold:
      same door (`via`), same typed ZIP, same `source_page`, same trainer pick, first lead still
      `new_inquiry`, nothing booked / requested / called back, inside 30 minutes. Anything else is a
      NEW request with its own lead and its own routing. Never widen this.
    - **The visitor's pick is kept as `raw_payload.booking.intake.picked_slug`**, separate from
      `trainer_slug` (where the lead was ROUTED). They differ when the picked trainer has no calendar,
      so comparing `trainer_slug` would have broken the genuine double submit. A row saved before
      `picked_slug` existed has none, and is treated exactly as it was.
    - **Every 2.0 page sends its own address** (`source_page: location.origin + location.pathname` in
      `assets/v2/v2.js`), so two markets are never "the same page" even on the same ZIP.
    - **The other doors have no reuse path at all.** The Contact page, the trainer landing pages, the
      market guide / ebook forms and the office lead form all go through `submit-contact`, which only
      ever upserts on the browser's per-submit `submission_id` (fresh `Date.now()` + random on every
      submit). Its only email lookup is the 4-in-10-minutes rate limit.
    - **Office smoke tests on live.** A smoke test after a push is a REAL row in `public.leads`. The
      office uses the set phrase — **last name `LDTT TEST`**, or an email tagged `+ldtt-test@` (or a
      whole address starting `ldtt-test@`). `lib/office-test-lead.js` and its mirror
      `supabase/functions/_shared/office-test-lead.ts` decide it; `lib/booking.js` `createLead` and
      `supabase/functions/submit-contact` stamp `raw_payload.qa = true` — a real JSON **boolean** —
      on a match, and the hold-out that already exists (rule 1, `metrics.js` `isQaLead` / `excludeQa`)
      drops the row from every tile, chart, table, report and CSV. Rule 13 also keeps it out of Meta.
    - **Keep the pattern narrow, and keep the two copies in step.** "test", "qa", "tester" on their own
      are deliberately NOT matched: real people are called Tester. Checked read-only against live on
      2026-09-23: 0 of 290 `public.leads` rows and 0 `trainer_applications` match either pattern, so
      turning this on could not move a single existing number.
    - **The hold-out itself is unchanged** (rule 1). `isQaLead` still reads the flag only, never a name
      or an email — the NAME only decides what the two write doors stamp.
    - **Rule 97 is untouched**: the practice host still stamps nothing. Only the set phrase adds a
      stamp, and the `*.vercel.app` host test still only picks the lifecycle event type.
    - **OPEN (Joshua's call, 2026-09-23): boolean vs string.** `isQaLead` compares `=== true`, but 3
      live rows (all 2026-08-06 release checks, all archived / do-not-contact) carry the STRING
      `"true"`. Rule 1's own SQL verification casts, so the SQL answers 283 of 290 while the screens
      answer 286. Rule 98 never creates that shape. `tests/lead-integrity-2026-09-23.test.mjs` pins the
      gap so nobody closes it by accident — closing it would move a live number.
    Tests: `tests/lead-integrity-2026-09-23.test.mjs` (21). Full suite 417, audit 202.

## GO-LIVE 2026-09-23 (branch feat/meeting-2026-09-12, stamp 20260923live9)

99. **Production now runs the sandbox feature set.** Branch `feat/meeting-2026-09-12`, deployment
    `dpl_4QC4MWjcTeS9jRTAAi5RLzGHNpCe` (`ldtt-site-9gok81slp`), stamp `20260923live9`. The header's
    old branch names and every earlier "the live branch is X" note are out of date. Rollback to the
    pre-push site: `npx vercel rollback dpl_BkjCcaixk6hDfNvokYKBBiQp8N8m --yes` (livefix4).
    - **Booking + pipeline serve LIVE.** The blanket `if (!isSandbox()) return 404` gates are GONE from
      `api/booking.js`, `api/booking-lead.js`, `api/booking-page.js` and `api/pipeline.js`; the office
      Resend emails send on live too. Everywhere rules 71-74 say "404 on live" for those four routes is
      superseded. STILL 404 on live and must stay: `api/sandbox-trainer-login.js`, `api/lead-journey.js`,
      `api/send-to-live.js`, `api/practice-reset.js`, and `api/lead-forms.js` (unless LDTT_LEAD_FORMS_LIVE=1).
    - **public got the live twins**: leads status CHECK with the two canceled_* values; `added_to_alpha`
      nullable/no-default (blank = not answered; every stored false became NULL on 2026-09-23);
      `public.booking_holds` (no one-per-slot index); `site_settings` rows `booking_trainers`,
      `pipeline_texts` (behind its own restrictive `pipeline_texts_server_only` policy, rule 84 pattern)
      and `pipeline_office_emails`.
    - **No-text-night holds, still ON until Joshua says otherwise:** every Twilio route in Make scenarios
      6237328 / 6237333 / 6254549 is tester-phones-only (text:equal, 3 phones); `operations_phone` in the
      public settings row is EMPTY; `trainer_emails_hold` is TRUE (live trainer email twins skipped);
      `lib/pipeline.js` `trainerPhoneFor` refuses the shared office line (866) 436-4959 on live, so a
      trainer still on the placeholder number is skipped with a plain reason, never texted at the office
      line. Trainer REAL phones were NOT copied to public.trainers (the ready SQL is in
      `~/Desktop/LDTT Meeting Changes 2026-09-13/GO-LIVE-2026-09-23.md`).
    - **auto_followups is OFF in the public settings row.** The cron endpoint answers 403 to outsiders.
    - **Credentials never ride the address bar.** Both portal shells' login forms POST, and a first-in-head
      scrubber strips password/username params with history.replaceState before any other script runs.
      Never remove either half (stamp 20260923live7 incident: /staff?username=...&password=...).
    - The Alpha question: cards wear the compact red toggle button; the worded three-state select lives
      ONLY in the opened lead panel (office + trainer). Never put a select back on the cards (live6 incident).
    - **Clients get TRANSACTIONAL email twins (owner decision, Joshua + Lorenzo, 2026-09-23).** Every
      client text (booking link, office-will-call, follow-ups, booking confirmation - and the re-engage
      invite if the office ever sends it) also goes to the LEAD'S OWN email with the same words, via
      Resend only (`lib/pipeline.js` `clientTwinEmail`), regardless of SMS consent, one idempotency key
      per lead + kind (+ step / hold), always carrying the opt-out line. On the practice copy every
      client email is redirected to Settings -> practice_email_to. STILL BANNED, forever: any signup /
      activation / verification email on a submit door (the lead-integrity test pins it).
    - The practice copy is `20260923sb42` (same code, stamp only) on the same alias flow (rule 50).

## Old ad pages get the 2.0 flow, ad 2.0 pages go LIVE, and the 9:30 re-engage sender (added 2026-09-23 night, the post-go-live brief from Joshua)

100. **The old ad pages carry the 2.0 evaluation form and its whole flow, and the ad 2.0 pages serve LIVE.**
    Joshua: "even the old ad pages have the same flow as the 2.0 pages when booking is made and the forms
    filled are the new one we made with the asterisks and same stage by stage and same processes"; decision
    sheet: Arrison's 2.0 landing page updates "should be pushed and go live too".
    - **One form, one door.** The 12 built-in market pages (`dog-training-<city>.html`, regenerated from
      `lib/ad-page-template.js`) and every Page Studio `ad` page carry the SAME evaluation form the 2.0 pages
      carry: class `ad-form-card ad-form-card-v2 lead booking-intake`, `data-kind="evaluation"`,
      `data-endpoint="/api/booking-lead"`, red `required-mark` asterisks server-rendered, `(optional)` on the
      rest, tel keyboard, required street address/city/state/ZIP, the trainers-near-you picker
      (`data-trainer-pick` -> GET /api/booking?zip=), the single-use-case SMS consent wording (rule 47), driven
      by `assets/v2/v2.js` (which now also carries the click's utm_source/medium/campaign and prefills ZIP from
      `?zip=`). Submits go through `createLead` (rule 98 sameRequest, needs-a-call stamping, rule 74 ZIP
      routing, rule 72 texts + rule 99 email twins) and carry on into the answered `book_url`. The old
      FormSubmit/Google-Sheet market form is GONE from these pages — the CONTACT page's frozen FormSubmit flow
      (rule 73 byte pins) is untouched, and the booklet/ebook forms are untouched. The Meta pixel head and the
      Google conversion snippet fire for `booking-intake` exactly as they did for `contact-intake`
      (`eventID: id` x2 unchanged, rule 12) — but note honestly: the server-side Meta CAPI event (which rode
      `submit-contact`) does not fire for `booking-lead` leads; the browser Lead event still does.
      `script.js` `PRACTICE_LEAD_FORM_SELECTOR` includes `.booking-intake` so the practice copy never switches
      the form off. The quiz test pages `lp-test-*.html` keep their old form on purpose (not advertised, own
      plumbing); `dog-training.html`, `get-started.html` and `contact.html` are NOT ad landing pages and keep
      their forms. The Lead-forms editor's `ad_landing` definition no longer matches any form and can never
      touch one (tests/lead-forms pins it).
    - **Ad 2.0 pages LIVE (rule 85 amended).** `public.ad_pages` accepts `page_type = 'ad2'`
      (`supabase/migrations/20260923220000_public_ad2_page_type.sql`, additive twin of the practice migration).
      The 12 practice ad2 pages were copied to `public` (published_content + draft_content, storage files
      copied practice-bucket -> live bucket, URLs re-pointed; before-state: public.ad_pages held exactly ONE
      row, Arrison's `about` site draft, untouched). `/ads/<slug>` serves them on live with the pixel + Google
      tag (practice still leaves the tags out, rule 85). Page Studio's "Ad landing pages 2.0" section, the Site
      Builder groups and the Page Editor dropdown list them on live too. `api/send-to-live.js` now carries an
      `ad2` page (its own cleaner, still DRAFT-only, never flips an existing live page's type). The Español
      toggle stays exactly the Pensacola page's own content.
    - Pins: `tests/old-ad-pages-2026-09-23.test.mjs`, `tests/ad2-pages.test.mjs` (amended), the audit's ad-page
      checks (booking-intake accepted).

101. **The 9:30 AM re-engage sender exists, ARMED BUT UNAIMED — and Joshua said "we don't send yet".**
    - **The office door**: POST `/api/pipeline {op:"reengage_send", lead_id}` — SUPER ADMIN ONLY. Renders the
      `reengage_invite` words (rule 84 editor, key 6) with `{booking_link}` = the LIVE ad 2.0 page for the
      lead's local area, `/ads/<slug>?zip=<lead zip>` when a published ad2 page's own ZIP is within 50 miles
      (Census centroids, rule 74), else `/book?zip=<lead zip>`; sends the client TEXT via pathway 1 (SMS
      consent only; practice copy = active tester phones only, rule 82) AND the client EMAIL twin (rule 99:
      regardless of consent, opt-out line, one idempotency key `client:<lead>:reengage_invite`; the practice
      copy redirects every client email to Settings -> practice_email_to).
    - **IDEMPOTENT PER LEAD, forever.** The send claims `raw_payload.pipeline.reengage` first (version-guarded
      mergePipelineRecord); ANY existing record — sent, sending, a lost claim — refuses a second send. A lead
      can never get the blast twice, whatever mix of button and batch runs.
    - **The batch runner** (`runReengageBatch`, checked by the existing `api/cron/auto-followups.js` cadence,
      */15): reads `site_settings` key `reengage_batch` `{"send_at","column","armed"}`. Only when `armed` AND
      now >= send_at does it DISARM ITSELF FIRST (version-guarded PATCH on the row — the claim is the kill
      switch; a crash mid-run leaves it disarmed), walk the leads in that status column (qa/test rows held
      out), send each once through the same per-lead door, then write `last_run` (walked / texts_sent /
      emails_sent / skipped, per-lead details) into the same key. KILL SWITCH: `armed:false` or deleting the
      key stops everything. `op:"reengage_batch_save"` (SUPER ADMIN, arming needs column + send_at) and GET
      `op=reengage` manage it from the office.
    - **SHIPPED DISARMED**: the key is preset `{"armed": false, "column": "engaged_no_outcome", "send_at": ""}`
      on live and practice (Joshua picked column A, "Engaged Lead: No Outcome", and said "we don't send yet").
    - **ARMING IS NOW ENOUGH TO TEXT REAL PEOPLE — the old second net is GONE (corrected 2026-09-24).** This
      rule used to say a live send to a non-tester was dropped by Make's filter, so real texts needed "the
      morning switch" as well as the armed key. That stopped being true on the night of 2026-09-23: every
      Twilio module in Make scenarios 6237328 / 6237333 / 6254549 was re-filtered to
      `phone != "" AND practice == "false"`, which passes ANY real phone on live traffic, and all three
      scenarios are active. **Flipping `armed` to true with a `send_at` in the past is, by itself, enough to
      text and email real members of the public.** Treat this key as live ordnance. The only stops left are
      `armed:false`, an empty `send_at`, and deleting the key.

    ### The 2026-09-24 blast changes (Joshua, the night before the 7:00 AM send)

    - **The words.** `reengage_invite` no longer says "We spoke about training for {dog_name}". Not one lead
      in either column has a dog name, and most were only *Office Contacted*, so the old words were both
      awkward and an assertion nobody could stand behind. The words now are: *"Hi {first_name}, it's
      Lorenzo's Dog Training Team. You reached out about training for your dog and we'd still love to help.
      Pick a free evaluation time here: {booking_link}. Or call us at (866) 436-4959."* plus the
      `Reply STOP to opt out.` line, carried in the words exactly as `booking_link` / `followup_link` /
      `care_call` carry it. `{dog_name}` is no longer a declared field of this text, so a saved template
      using it is refused by the editor and the starting words go instead.
    - **Client greetings are tidied at render time** (`lib/pipeline-texts.js` `clientGreetingName`, used by
      all six CLIENT-facing first-name sites in `lib/pipeline.js`). ALL CAPS becomes proper case
      ("TIMOTHY" -> "Timothy"); a name typed entirely in lower case gets its first letter back; and a field
      that is not a usable greeting — two names ("Larry or Laura", "Bob and Sue"), a slash or ampersand
      pair, a digit, or blank — is DROPPED so the message opens "Hi there,". **Trainer and Operations texts
      are deliberately NOT tidied**: there the name identifies a person to call, it does not greet them.
    - **No ZIP = Contact Us, never a bare `/book`.** `reengageBookingLink(lead, {noZip:"contact"})` sends
      someone we cannot place to the live `/contact` (200, no redirect). The default `noZip:"book"` is
      unchanged and is still what the unfinished-form timer uses. Everyone with a ZIP is unaffected: the
      nearest market's LIVE static ad page with their ZIP prefilled, else `/book?zip=`. Never a 2.0 page.
    - **The runner walks a LIST of columns.** `reengage_batch` accepts `columns: [...]`; the old single
      `column` string still means exactly what it always meant, and `column` in the stored value and in the
      summary stays the FIRST column so every older reader keeps working. One query per column, each
      carrying its own 60-day window.
    - **ONE PERSON, ONE MESSAGE across the whole batch.** `dedupeByPerson` groups the walked rows by email
      address and by 10-digit phone and sends to ONE row per person. The row it keeps is the RICHEST one
      (consent + a textable phone, then a ZIP, then an email), not merely the first one walked. A passed-over
      row is never claimed — nothing is written to it, so the office can still reach that person by hand.
      The per-lead once-ever record is unchanged and still the primary guard.
    - **The run summary no longer eats the key.** It now merges into the stored value instead of replacing
      it, so the office's own `note` and `max_age_days` survive a run.
    - Every other guard is unchanged and must stay: disarm-before-first-send, per-lead idempotency, the
      60-day window, SMS-consent gating for texts, the email twin to anyone with an address plus its opt-out
      line, qa rows held out, the kill switch, and recording "sent" ONLY on a 200 from the hook.
    - **"sent" still means "Make's webhook answered 200", NOT that Twilio delivered.** The only authoritative
      record of what reached a human phone is the Twilio message log. Check it after any send.
    - `lib/reengage.js` (the old follow-up planner) still has NO send code (`SENDING_ENABLED = false`, rule 81)
      and never reads `reengage_invite`. The only senders are the two doors above.
    - Pins: `tests/reengage-send.test.mjs` (idempotency, consent gating, kill switch, disarm-after-run,
      practice email redirect, hook-200-means-sent, the name tidy, the Contact Us fallback, dedupe-by-person,
      both columns in one run, and the 06:59/07:00 timing guard), `tests/pipeline-texts.test.mjs`
      (the exact words, the honest field list, mention count).

    ### The blast must finish, every lead once (added 2026-09-24 ~04:30 Eastern, stamp `20260924live20`)

    - **The cron function has an explicit time limit.** `vercel.json` gives `api/cron/auto-followups.js`
      `maxDuration: 800` (the project is Pro with Fluid compute on; its default was 300 s). Never remove it.
    - **A run that stops part-way is carried on, never lost.** `runReengageBatch` stops TAKING NEW LEADS after
      `REENGAGE_BUDGET_MS` (10 min) and writes `status:"incomplete"`; the next */15 tick claims it (the same
      version-guarded PATCH as the first run) and continues. A run KILLED outright stays `status:"running"`;
      once `run_started_at` is older than `REENGAGE_RUN_STALE_MS` (14 min, longer than maxDuration) the next tick
      carries it on. Continuations only ever send to leads with NO per-lead `reengage` record, skip any PERSON
      (email / 10-digit phone) already reached, stop after `REENGAGE_MAX_RESUMES` (8) and never more than 6 h
      after `send_at`. A lead whose record says `"sending"` (in flight when a run was killed) is NEVER re-sent;
      it is listed in `last_run.interrupted` for the office to check by hand. `runs[]` keeps each tick's counts.
    - **Stopping a part-way run:** `armed` is already false while a run is going, so the stop is
      `"resume": false`, `"status": "stopped"`, or deleting the key. The final write keeps a stop the office
      wrote during the run.
    - **Resend pacing + 429 retries, for the batch only.** The batch loads the Resend config once with
      `paceMs: 600` (under Resend's ~2 requests/second team limit) and `retry429: 4` (waits Retry-After, else
      1/2/4 s, each wait capped at 5 s; the same Idempotency-Key rides every attempt). `lib/office-email.js`
      `sendViaResend` does this ONLY when a caller opts in: every other caller (form submits, office emails,
      twins) still makes exactly one attempt and never waits. A failed email is recorded as `email_reason`.
    - **No undialable number is ever posted to Make by the blast.** `reengageDialable` (+1, area code and
      exchange starting 2-9) - five live leads carried area codes like 121 that Twilio refuses; their text is
      skipped with the reason and their email still goes.
    - **Make pathway 1 (6237328) has an Ignore error handler on its Twilio module** (added 2026-09-24 04:19
      Eastern; before-state in `~/Desktop/LDTT Meeting Changes 2026-09-13/make-backup-pre-blast-pathway1.json`),
      so one bad number is logged as a warning and can never count toward `maxErrors: 3` and switch the
      scenario off for everyone after it. The filter, mapper, from-number and hook are unchanged. It applies to
      every pathway 1 text (new-lead booking link, follow-ups, care, re-engage): a Twilio error no longer stops
      the scenario, so read the Make execution log / Twilio log for failures, not the scenario's on/off state.
    - Pins: `tests/reengage-blast-scale.test.mjs` - 115 synthetic leads with Resend 429s and slow answers, the
      budget stopping the first tick and the second finishing it, a hard kill mid-lead followed by a
      too-early tick, then two racing stale ticks (exactly one carries on), everyone exactly once, the
      in-flight lead never twice; the resume guards; the Resend helper (pacing, Retry-After, bounded, ordinary
      callers one attempt); the dialable guard; and the maxDuration + opt-in wiring.

## Trainer Lead Pipeline: one place, a six-column TASK board (added 2026-09-23, Rachel via Joshua; rewritten 2026-09-24 night, Lorenzo)

102. **A trainer's leads live in ONE place, My Leads, and its board is a six-column TASK board — NOT a mirror of the
     office board.** History: 2026-09-23 added a "Lead Pipeline" tab (office SALES board); 2026-09-24 commit 8e4433d
     removed the tab and made My Leads a full 8-column mirror of the office Leads board. The same night (Zoom,
     Joshua + Lorenzo) the owner OVERRULED the mirror: *"it should not mirror exactly like the admin. Admin is
     looking for holes and gaps and efficiency leaks. The trainers is looking for did I do this, this and this.
     This is more so task driven."* / *"Not a lot of clutter."* Joshua: "So only one that we're adding is contacted,
     is that right?" Lorenzo: "Correct." Engaged Lead: No Outcome gets NO trainer column ("we know it's no outcome
     if there's no sale") but must never sit under New Inquiry (Rachel's bug: Chloe Williams, engaged by the office
     9/10, showed as New Inquiry on Shavon Striggles's board). Never turn the trainer board back into the office
     board, and never lump contacted/engaged leads into New Inquiry again.
     - **The columns, in this order, by DATABASE status** (`METRICS.TRAINER_PIPELINE_STAGES`, `trainerStageFor`,
       `trainerPipeline`, `trainerLeadBoard` in metrics.js — rule 34; app.js never buckets):
       | Column | DB statuses |
       |---|---|
       | New Inquiry | `new_inquiry` ONLY |
       | Contacted | `office_contacted` (+ its old twin `follow_up_call_needed`), `engaged_no_outcome` |
       | Eval Scheduled | `evaluation_scheduled` |
       | Eval Completed | `evaluation_complete` |
       | Sold | `became_client` |
       | Lost | every `lost_*`, `bad_lead`, `evaluation_cancelled`, `canceled_refunded`, `canceled_write_off` |
       `do_not_contact` and `archived` are NEVER drawn (rule 80), nor is any status not listed. The trainer header is
       simply "Contacted" (Lorenzo: "just contacted"). Bad Lead sits in Lost but never gets a "call" prompt; a cancelled
       evaluation in Lost says "The evaluation was cancelled. Call to rebook it." (This supersedes rule 80's older
       "Bad Lead is NOT drawn".) No office legends on the trainer board (no clutter).
     - **Dashboard tiles = board columns** (`METRICS.trainerDashboard`): New Inquiries = New Inquiry (new_inquiry only),
       Evaluations Scheduled = Eval Scheduled, Evaluations Completed = Eval Completed, Sold = Sold, Lost = Lost,
       Clients = `METRICS.trainerDeals`. `contacted` is computed (= the Contacted column) but has no tile.
     - **The OFFICE Leads board is untouched:** 8 columns (`BOARD_COLUMNS` / `boardStatus`), Engaged Lead: No Outcome
       kept (the office asked on the call), "Office/Trainer Contacted" label kept. Its HTML is byte-for-byte what
       8e4433d drew (sha256 `69dae2df…d229` on the all-statuses fixture, pinned in the test).
     - **Kept from 8e4433d:** rule 7 scoping (`trainerLeads(currentTrainerId())` only); the CARD is the trainer's (no
       status dropdown, no drag/drop, no notes editing, no archive/delete, no assignment); a tap opens
       `trainerLeadDetailPanel()`; the "Lead Pipeline" tab stays GONE (`TRAINER_MOVED_VIEWS = { leadPipeline: "leads" }`,
       `applyUrlState()` reads `?view=leadPipeline` as `leads`; new links `/trainer-backoffice?view=leads&lead=<id>`);
       sideways-scroll memory (`.sales-board.trainer-board.trainer-leads-board`); phone stacking (<= 720px, scoped to
       `.trainer-leads-board`); the office Sales board is the only caller of `salesBoardColumnsHtml()`.
     - **"Office Contacted" is SHOWN as "Office/Trainer Contacted" everywhere EXCEPT the trainer board header
       ("Contacted") — label only (rule 10).** The value stays `office_contacted` / "Office Contacted"; ONE display
       function, `leadStatusLabel()` → `METRICS.statusLabel()`. Never rename the value.
     - **"Mark contacted" (trainer):** `POST /api/trainer-lead-action {action:"contacted"}` moves the trainer's OWN lead
       `new_inquiry` → `office_contacted` only (it lands in the trainer's Contacted column; an engaged lead is refused
       rather than moved backwards). Anything else → 409. Same auth, ownership (403), version guard (409),
       `audit_events` (`trainer_lead_contacted`) and `lead_events`; no `lifecycle_events` row. Sends no text, no email.
     Pins: `tests/trainer-lead-pipeline-2026-09-23.test.mjs` (six headers, Chloe in Contacted, office board sha256,
     scoping + hold-out, no office controls, sideways scroll, phone CSS, Sales renderer, Mark contacted),
     `tests/trainer-portal-2026-09-12.test.mjs` (columns + tiles), `tests/status-label-2026-09-24.test.mjs`,
     `tests/trainer-lead-action.test.mjs`. Proof on real data 2026-09-24: Shavon's 2 live leads → Chloe Williams in
     Contacted, Sharon Serrano Ahmed in Sold.

104. **Operations (Lorenzo) texts show the client's PHONE, not the ZIP; every "not sent" line says why (2026-09-24,
     Zoom).** Lorenzo showed his "New Track 500 lead … ZIP …" text: "why does it have the ZIP?"
     - `lib/pipeline-texts.js`: `ops_new_lead` = "New LDTT lead: {client_name}, {phone}, {problem}. From: {source}.
       {next_step} {link}" (Track 500 offered: "🚨🚨 New Track 500 lead 🚨🚨\n{client_name}, {phone}, …");
       `ops_eval_booked` = "Evaluation booked: {client_name}, {phone}, with {trainer_name}, …" (Track 500 offered the
       same). `{zip}` stays a declared field (and in the payload) only so an older saved wording never renders blank.
     - **The words IN USE on live and practice are SAVED templates** (site_settings `pipeline_texts`, activated
       2026-09-16, still holding the old ZIP words in the row). `RETIRED_WORDS` reads a saved template whose words are
       EXACTLY an old wording as its replacement (no data write); words typed differently are left alone; the next
       save of that template stores the new words.
     - `lib/pipeline.js`: both Operations payloads carry `phone: opsPhoneWords(...)` ("(770) 757-1331", or "no phone
       on file" — never "{phone}" or a blank). Eval booked uses the booking's client phone, else the lead's.
     - **"What happened with this person" (rule 87) and the office pipeline notices** show every not-sent line as
       "Not sent: <plain reason>" through ONE mapper, `journeyNotSentReason()` (e.g. "the client did not agree to
       texts", "no phone number on file", "the phone number cannot exist …", "no phone number is saved for Lorenzo
       (Operations) in Settings", "the trainer's own phone number is not loaded yet …"). It only rewords what the
       pipeline recorded; an unknown reason shows as recorded; none recorded says so. Never a bare "Not sent".
     Pins: `tests/pipeline-texts.test.mjs` (wording, saved-template upgrade, never "{phone}"/blank),
     `tests/journey-not-sent-2026-09-24.test.mjs`.

## Contact Us goes live: ZIP required, then the trainers, then the same pipeline (added 2026-09-24, Claude, on Joshua's order)

103. **On LIVE, Contact Us asks for a ZIP, hands the person to the preferred trainers, and enters the SAME
     pipeline every other lead enters — and the office's form submit and logging are untouched.**
     Joshua, 2026-09-24, in his words: "it should after filling that they should fill zip code mandatory and
     then it takes them to the preferred trainers then the same text flow starts and fires and the rest of the
     automation like the rest of the leads. don't break form submit."
     - **The order of operations is the whole rule.** A live Contact Us submit runs, in this order and no other:
       `submit-contact` (the lead row) → `relayFormDeliveries('contact',…)` → `/api/form-delivery` (Google Sheet
       row + the FormSubmit email to `production@`, subject "New Lorenzo's Dog Training Team Contact Form
       Submission") → the browser retry to FormSubmit when the server email failed → the delivery result logged
       back → **only then** `/api/pipeline {op:"enter", via:"contact-us"}` → **only then** the booking page.
       Nothing new may ever run before or inside that delivery. `tests/contact-us-live-pipeline.test.mjs` runs
       the real blocks out of `script.js` and pins that exact call order and those exact bodies.
     - **Nothing frozen was touched.** `relayFormDeliveries`, the `const contactForm=` handler,
       `window.LDTT_FORM_DELIVERY`, `submitEmailRelay`, `wireAsyncForm` and the `contact.html` form markup are
       byte-for-byte what rule 73 pins (commit 1176038); every hash in `tests/office-email.test.mjs` is still
       green, INCLUDING the assertion that the practice capture listener is still gated to `env.sandbox`.
       The new code lives in three places OUTSIDE those blocks and is pinned not to leak into them:
       `rememberContactLead` (records the lead id after `submit-contact`; no network),
       the last line of `showFormSuccessModal` (which `wireAsyncForm` reaches only after `await onSubmit(...)`
       has resolved — that is what guarantees the ordering above), and `window.LDTT_CONTACT_HANDOFF` +
       `wireContactZipRequired` just above the `const contactForm=` handler.
       **The gate on the practice listener was deliberately NOT removed.** Removing it would have put live
       submits through `submitPracticeContact`, which never calls FormSubmit — i.e. it would have broken the
       one thing Joshua said not to break. Live gets its own hand-off instead. Never "simplify" the two paths
       into one by deleting that gate.
     - **ZIP.** `required` and the red `required-mark` asterisk were already in the markup `build.py` writes,
       exactly like every other required field, and they are UNCHANGED (rule 73 pins that markup). What is added
       is `wireContactZipRequired`: `pattern="\d{5}"`, `inputmode="numeric"`, `maxlength="5"` and
       `setCustomValidity` — "Please enter your ZIP code so we can show you the trainers nearest you." when
       blank, "Please enter a valid 5-digit US ZIP code, for example 44128." when malformed — so the
       `form.reportValidity()` that `wireAsyncForm` already calls refuses the submit natively. It is wired only
       on a form whose hidden `source_page` is `contact.html`, and never twice.
     - **The trainer step.** The hand-off follows the pipeline's OWN `book_url`, which is
       `/book/<trainer_slug>?lead=<uuid>` (`lib/booking.js` `bookUrl`). That is rule 74's page: ZIP → the
       trainers within 50 miles who have a calendar, nearest first → Rachel's questions → the calendar, with
       what the person already typed carried over by the lead id. **NO name, phone, email or ZIP may ever go
       in that URL** — an earlier review flagged it as a PII leak into browser history, Referer headers and
       access logs. The opaque id is the only parameter and the test pins that.
     - **No booking link, no redirect.** When `enterPipeline` hands back `book_url: null` — the phone-consultation,
       becoming-a-trainer and blank lanes, or no trainer with a calendar within 50 miles of that ZIP — the person
       keeps today's thank-you and the office follows up exactly as it does now. Never send anyone to a booking
       page that has nothing to show them.
     - **Lane behaviour on live** (rule 73's `CONTACT_US_LANES` semantics are unchanged; they simply now run on
       live as well):
       | "I want to..." answer | lane | client text | client email twin | trainer | Operations | Sales tab | goes to trainers |
       |---|---|---|---|---|---|---|---|
       | in-person evaluation / virtual evaluation / training session | `booking` | booking-link text, SMS consent + textable phone only | yes, rule 99 twin, regardless of consent, when a link exists | new-inquiry text + email to the routed trainer | new-lead text + email | **yes** | **yes** |
       | free phone consultation | `office_call` | care text "our office will call you shortly", no link, consent only | yes ("office will call") | no | no | no | no |
       | becoming a dog trainer | `recruiting` | none | none | no | no | no | no |
       | blank / unknown | `office_follow_up` | none | none | no | no | no | no |
     - **Rule 2 side-effect, expected and intended:** a Contact Us lead in the `booking` lane now gets
       `raw_payload.sales_pipeline = true`, so it appears on the **Sales tab** as well as the Leads tab, exactly
       like every other pipeline lead. The office should expect Contact Us names on Sales from now on. The Leads
       tab counts and the real-lead count (284) are unchanged: nothing is re-bucketed and no row is added.
     - **The practice copy is unchanged** (rule 73): its own capture listener still takes practice Contact Us
       submits, still never calls FormSubmit or `/api/form-delivery`, and the live hand-off returns immediately
       when `window.LDTT_IS_SANDBOX === true`. Practice client texts still reach only tester phones and practice
       client emails still redirect to the practice inbox.
     Pins: `tests/contact-us-live-pipeline.test.mjs` (10) — the ZIP markup in `contact.html` AND in `build.py`,
     the 5-digit rule and both messages, the exact live call order with the delivery first and unchanged, the
     single `/api/form-delivery` call when the server email succeeds, the `{op:"enter",via:"contact-us"}` body,
     the opaque-id-only URL, the no-link-no-redirect lanes, the sandbox no-op, the stale-lead guard, and that
     none of the new names appear inside any frozen block.

## The trainer hierarchy: My Team, and leads only go DOWN (added 2026-09-25, Claude, on Joshua's order from the owner's chart)

105. **A trainer can send a lead ONLY to someone in their own downline on the owner's chart; the downline never sends
     up or sideways; Lorenzo (the owner) sees the whole team and can send to anyone on it; and nobody who is not an
     ACTIVE trainer on the site is ever listed or accepted.** Source: Lorenzo's official chart "Hierarchy - 9-23-26",
     relayed by Joshua 2026-09-25: "send a lead to someone in your downline", "the downline can never send up",
     "a nicely designed hierarchy tab … My Team", "Lorenzo is the owner … the only one who sees the full list".
     Supersedes the same-state downline of rule 91 (its write rules still hold).
     - **Record before the change (stamp 20260924live26, commit 62242c6):** `GET /api/trainer-lead-action?team=1`
       answered every ACTIVE trainer in the caller's STATE; the hand-off box read "Hand off to your downline", the
       dashboard carried a "Your team in <state>" panel ("Your downline for now is every Lorenzo's trainer in your
       state"); 0 `trainer_lead_handoff` audit rows on live; live leads 301 (290 not QA); 528 tests + audit green.
     - **The chart is DATA, server only.** `site_settings` key `trainer_hierarchy` in BOTH schemas
       (`supabase/migrations/20260925120000_trainer_hierarchy.sql`): `{ owner_slug: "lorenzo-miller", updated_from:
       "Hierarchy - 9-23-26", nodes: [{ slug, parent_slug, rank }] }` — 31 nodes (Lorenzo + the 30 on the chart;
       every slug verified in `public.trainers` AND `practice.trainers`, same ids). Restrictive policy
       `trainer_hierarchy_server_only` on both tables (the rule 84 / rule 101 pattern), created before the row: no
       browser login reads or writes the chart; the API reads it with the service role. The practice pull never
       copies `site_settings` (rule 46), so the practice row is only ever changed on purpose. To change the tree,
       write a new migration that replaces the value in both schemas; `validateTree()` must pass on it first.
     - **Ranks = the chart's ring colours** (`lib/hierarchy.js` `RANKS`; badges `.team-rank-<key>`, photo rings
       `.team-ring-<key>`): Owner (gold) lorenzo-miller; Senior Vice President (grey) john-delbane, emilio-marotta;
       Regional Director (red) shavon-striggles; Master Trainer (black) daniel-bainbridge; Team Coordinator (yellow)
       tristan-gray, jacob-perez, carolina-perez, michael-king, robert-wesling, eric-hardaway, eric-beck; Executive
       Team Trainer (green) victoria-bayleigh-morris, bailey-brown, clark-patton; Team Trainer (light blue) the other 16.
     - **ONE home for the tree logic: `lib/hierarchy.js`** (pure, no I/O): `validateTree` (owner present and
       parentless, every parent on the chart, no loops, every node reachable from the owner, known ranks, no
       duplicates), `readTree`, `uplineOf`, `downlineOf`, `isInDownline`, `canSendTo`, `nestedDownline`. An invalid
       or missing chart fails CLOSED: every hand-off 403, nobody listed.
     - **`GET /api/trainer-lead-action?team=1`** = `{ ok, me, rank, rank_label, is_owner, on_chart, chart_ok, upline,
       downline, count }`: the upline owner-first; the downline = ALL descendants, nested with depth, each entry only
       when that trainer row is ACTIVE on this site (an inactive person drops out and the people under them move up a
       level, so nobody below is lost; practice test rows / drafts never show). The owner's downline is the whole
       tree. Entries carry id, slug, name, place ("Milton, FL"), headshot (only `/assets/trainer-headshots|
       trainer-bio-photos/…` cleaned like `safeTrainerAssetUrl`, or this project's public Storage), rank. NO lead
       counts (rule 34: numbers come from metrics.js; rule 7: no trainer sees another trainer's leads). The office may
       pass `trainer_id`; a trainer never can.
     - **`POST {action:"handoff"}`**: the target must be ACTIVE and `canSendTo(chart, sender, target)` — below the
       sender (the owner: anyone on the chart). Up, sideways, inactive, off the chart, a test row, unknown → **403
       "You can only send a lead to someone in your downline."** and NOTHING is written. The office keeps its powers:
       its own assign tools are untouched; through this door it hands off from the ASSIGNEE's downline, never up.
       The write is rule 91's exactly: PATCH `leads.trainer_id` (+ the trainer-name column when present), version
       guarded; `audit_events` `trainer_lead_handoff` ("Sent to {name} (downline)", with from/to slugs) +
       `lead_events` `trainer_handoff`; no `lifecycle_events`; no text, no email. The lead then shows in the
       receiver's My Leads because My Leads is `trainerLeads(currentTrainerId())` by `trainer_id` (rule 7).
     - **Portal:** trainer tab **"My Team"** right after My Leads (menu, phone strip, one-page section, Page Editor
       preview list). "Your upline" chips (owner first), the "You" card (photo, name, place, rank badge, how many
       people below), then the downline as an expandable org tree (`<details>`; the first three levels open; opened /
       closed branches survive redraws via `trainerTeamOpen`; "Open all" / "Close all"); phones (<= 640px) tighten the
       indent. Owner: "The whole team", from John DelBane down. Leaf: "No one reports to you yet." The hand-off box
       ("Send to someone in your downline", names indented by level with the city, button "Send") lists ONLY the
       caller's downline; a trainer with no one below them gets NOTHING on the card and one line in the lead panel
       ("No one reports to you yet, so there is no one to send this lead to."). Confirm names the person; toast
       "Sent to {name}"; the lead leaves the sender's board. The dashboard's same-state "Your team" panel is GONE.
     Pins: `tests/trainer-hierarchy.test.mjs` (helpers: cycles, missing parents, unknown slugs, up/sideways/self,
     inactive drop-out, the stored chart = 31 nodes and its ranks, the server-only policies),
     `tests/trainer-handoff.test.mjs` (API: down allowed incl. past an inactive middle person; up / owner / sideways /
     inactive / stranger / test row / unknown 403 with no writes; owner to anyone; office from the assignee; fail
     closed; portal: My Team after My Leads, leaf gets no box, wording, rank colours), `tests/trainer-calendar.test.mjs`.
     Verification 2026-09-25 (practice copy, signed in through `sandbox-trainer-login` from the saved super-admin
     session in a separate context; the admin was never signed out; no password typed):
     - 542 tests + audit green at 4faed6a. Practice preview `dpl_9tN6LdN6pdaJg1kXbdYfMsZyYVVW` aliased to
       ldtt-sandbox.vercel.app (previous practice target `dpl_mZwzPiQob3LmESYgyhngNJtCjWJC`).
     - My Team: Lorenzo = owner view; Daniel Bainbridge = 16 below, upline Lorenzo > Shavon; Karemela Sefferin = leaf
       ("No one reports to you yet.", upline of 7). On PRACTICE john-delbane, emilio-marotta and clark-patton are
       `inactive` in `practice.trainers`, so the practice owner view starts at Shavon (27 people) and Clark is not
       listed — the not-on-the-site rule working; on LIVE all 31 are active. Chloe Chisolm (leaf, 3 leads): 0 hand-off
       boxes on cards, the one plain line in the panel. No horizontal scroll at 375px.
     - Upward refused: Daniel -> Shavon (`2565397d…`, a qa test lead) = 403 "You can only send a lead to someone in
       your downline."; the lead stayed at version 9, no log rows.
     - One real practice hand-off: test lead TEST TEST (`59f927b7…`, raw_payload.qa true) Daniel -> Tristan Gray
       through the card: confirm named Tristan, toast "Sent to Tristan Gray", gone from Daniel's board, on Tristan's
       New Inquiry column; `trainer_id` + `assigned_trainer_name` changed, status untouched, one `trainer_lead_handoff`
       audit row + one `trainer_handoff` lead event, no lifecycle row. Handed back by the office (super admin,
       `operational-mutation` update of trainer_id + name) — now with Daniel again at version 11.
     - LIVE: production `dpl_3v1ZygUySneenZNBAJY2sk8d5Qav` (stamp 20260924live27), lorenzosdogtrainingteam.com
       `/api/environment` = LIVE / public; live app.js + styles.css sha256 = the commit's; `public.site_settings`
       `trainer_hierarchy` present (31 nodes, md5 11396f5b… = practice), anon REST read returns nothing. No hand-off
       was done on live; live leads 301 (290 not QA) and 0 `trainer_lead_handoff` rows before and after.
       Rollback: `npx vercel rollback dpl_AAQW4yiNZtNXzvMQzodT9UucAJB3 --yes` (live26). The data row is harmless to
       the older code (it never reads it); to remove it see the migration's Undo lines.

## The 2026-09-24 owner call, built 2026-09-25 (Lorenzo + Angela + Joshua; stamp 20260925live28)

Record before these changes (stamp 20260924live27, commit fd1c1e6): 542 tests + audit green; live leads 301 (290 not
QA); the office "Lost reason" box offered ten free-text reasons and changed no status; a drop on the office Lost column
filed "Lost / No Response"; the trainer Lost box offered price / not ready / other provider / no response / complaint;
the archive cron protected only archived / became_client / do_not_contact; the hand-off box was down-only for everyone;
`auto_followups` OFF on live (so the 15 min / 30 min / 24 h follow-up texts are NOT running on live); no recycled, no
office's-turn, no call reminder, no email campaign.

106. **A SUPER ADMIN can send any lead to ANY trainer who is active on the site AND has an active trainer portal login.**
     `api/trainer-lead-action.js`: `GET ?handoff_targets=1` (super admin only, else 403) lists every ACTIVE trainer
     (test rows / drafts never) with a `portal_users` row role trainer, active, access_status `active`; `POST
     {action:"handoff"}` from a super admin accepts exactly that list (assigned or unassigned lead; up, sideways, off the
     chart), else 403 "…not active on the site with an active portal login…" and nothing written. The write is rule
     91/105's exactly (version guard, `trainer_id` (+ name column) only, `audit_events` `trainer_lead_handoff` "Sent to
     {name} (super admin)", `lead_events` `trainer_handoff` by `super_admin`, no lifecycle, no text/email). OFFICE ADMINS
     and TRAINERS are unchanged (rule 105). Portal: the office lead panel shows "Send to a trainer" (search box filters
     the list in place, `data-super-handoff-search` on the rule 14 list) to a Super Admin only.
     Pins: `tests/trainer-handoff.test.mjs` (super admin any portal trainer; no-login / revoked / inactive / test refused;
     office admin unchanged; the box).

107. **Recycled = an OLDER lead exists for the same person (same email any case, or the same real 10-digit phone).
     DISPLAY ONLY.** `METRICS.recycledIndex` (union-find over email/phone keys, linear; placeholder phones like
     0000000000 never match; "first came in" = that person's earliest lead). Office: over every loaded non-QA lead
     (cached per loaded list). Trainers (rule 7: they load only their own leads): `api/operational-data.js
     stampRecycled` adds ONLY `recycled_first_at` + `recycled_count` to the trainer's own rows. A small BLUE recycle badge
     "Recycled" (tooltip "They first came in …") on office Leads + Sales cards, both lead panels (plus a line) and trainer
     cards. Lead creation, logging and every count are unchanged. Pins: `tests/recycled-2026-09-25.test.mjs`.

108. **Lost is a HARD NO; everything else is Archive (maybe later).** Lorenzo: "Lost would be there's no need in us
     contacting them again." `METRICS.HARD_NO_LOST_REASONS` = no trainer in their area (`lost_no_trainer_area`), doesn't
     believe in our training method (`lost_method_not_a_fit`, NEW), dog doesn't qualify (`lost_dog_not_qualified`, NEW),
     went with a competitor (`lost_chose_another_provider`). `METRICS.ARCHIVE_REASONS` = not ready / money, talking it
     over with family, can't reach them, other.
     - The two new statuses are in the CHECK of BOTH schemas (`supabase/migrations/20260925130000_lost_hard_no_statuses.sql`,
       applied 2026-09-25, additive) and in every status map: metrics.js (Leads board Lost, Sales Lost, trainer Lost),
       app.js (`leadStatuses`, `leadStatusToDb`, communications closed list), `api/communications.js`,
       `lib/metrics-crosscheck.js`, `lib/pipeline.js` CLOSED_STATUSES (which now also carries the real
       `lost_price_concern` / `lost_chose_another_provider` / `lost_client_complaint` names it was missing: fewer texts,
       never more). Every existing key and value unchanged (rule 10).
     - Office: the "Lost" list offers ONLY the four hard no's; a pick asks first, then moves the lead to that status and
       saves the plain words in `lost_reason`; an old free-text reason shows as "Earlier reason: …". The status dropdown no
       longer OFFERS the four soft Lost statuses (a lead already on one still shows it, "(earlier reason)"). A drop on the
       Lost column opens the lead instead of filing "Lost / No Response". The panel's Archive takes an optional reason:
       `operational-mutation` `archive` + `archive_reason` merges `raw_payload.archive_reason {reason,label,at,by,by_name}`;
       without one it writes exactly what it always wrote. Restore is unchanged.
     - Trainer: "Lost? Only a hard no" (the four) and "Archive (maybe later)" (the four) are two picks with one shared
       note. `trainer-lead-action` `lost` refuses the old soft reasons (400, "…means Archive (maybe later)") and writes
       `status` + `lost_reason`; `archive` writes `status archived`, `archived_at`, `raw_payload.archive_reason` (by trainer),
       from open statuses only.
     - The daily archive cron never archives the four hard-no statuses (`PROTECTED_STATUSES`). The soft Lost statuses
       archive after 30 days as before. No existing row was rewritten (the office recategorizes the Lost leads by hand).
     Pins: `tests/lost-archive-2026-09-25.test.mjs`, `tests/trainer-lead-action.test.mjs`, `tests/status-label-2026-09-24.test.mjs`.

109. **"I called the client" + ONE 30-minute reminder, behind `trainer_call_reminders` (default OFF, OFF on live).**
     Evaluation Scheduled trainer cards and the trainer panel show "I called the client" until it is checked off
     (`trainer-lead-action` `intro_called`: `raw_payload.pipeline.trainer_intro_called_at`, audit + a
     `trainer_intro_called` lead event, NO status change, a second tap writes nothing). `lib/pipeline.js
     runTrainerCallReminders` (the */15 cron): a lead in `evaluation_scheduled` whose `booking.booked_at` is 30 min..48 h
     old, the eval still ahead, not qa, not checked off and never claimed gets ONE text through the pathway 2 TRAINER
     route (`customer_phone` empty) with the `trainer_call_reminder` words (rule 84 editor). Claim-first on
     `pipeline.trainer_call_reminder`: never twice. Phone rules = every trainer text (`trainerTextPhone`). Pipeline
     settings saves now KEEP any switch the screen did not send (`KEPT_WHEN_ABSENT`: `trainer_emails_hold`,
     `trainer_call_reminders`, `office_turn_digest`) — before this a save from the office screen would have released
     `trainer_emails_hold`. Pins: `tests/trainer-call-reminder-2026-09-25.test.mjs`, `tests/pipeline.test.mjs` (five
     trainer links).

110. **"Office's turn": an orange badge, plus ONE optional daily email behind `office_turn_digest` (default OFF, OFF on
     live).** `METRICS.officeTurn`: a pipeline lead (`pipeline.entered_at`), not qa, no booking / request / callback,
     still new_inquiry / office_contacted / follow_up_call_needed / engaged_no_outcome, whose follow-up chain finished
     (a recorded `care` step) or that entered 24 h ago. Badge on office Leads + Sales cards and the office lead panel,
     never for trainers. `runOfficeTurnDigest` (the */15 cron): after 9 AM Eastern, once per day (claim-first on
     `site_settings` `office_turn_digest_log`, the claim moves `updated_at`), to the office TEAM list only (practice:
     practice_email_to), nothing sent when the list is empty. No per-lead email (Rachel asked for fewer).
     Pins: `tests/office-turn-2026-09-25.test.mjs`.

111. **Angela's lead email is READY BUT NOT SENT: `site_settings` `email_campaign` ships `armed:false`, no `send_at`, no
     pools, in both schemas, behind the restrictive `email_campaign_server_only` policy (created before the row;
     `supabase/migrations/20260925140000_email_campaign_server_only.sql`).** `lib/email-campaign.js`: her words exactly
     (only the signature brand, the tagline "Serious Training. Serious Results." and the email opt-out line added),
     subject "What would you change about your dog's behavior?", both buttons to `reengageBookingLink(lead, {noZip:
     "contact"})`. Runner on rule 101's pattern: disarm first (the claim moves `updated_at`), per-person once ever
     (`pipeline.email_campaigns[<id>]`), dedupe by email, optional `max_age_days`, qa held out, excluded DNC / archived /
     became_client / bad_lead / the hard-no Lost statuses / opted-out emails (`clients.email_consent=false`) / no email,
     and by default anyone whose evaluation is booked or done (`include_booked:true` lets them in; Joshua to confirm),
     Resend paced 600 ms + 429 retries, practice copy max 3 to the practice inbox. Super Admin only: `GET
     /api/pipeline?op=email_campaign` (read-only dry run), `op=email_campaign_preview&lead_id=`, `POST
     op:"email_campaign_save"` (arming needs pools + send_at). **Arming it with a past send_at emails real people.**
     Also fixed: the re-engage claim now moves `site_settings.updated_at` itself (the table has no trigger).
     Pins: `tests/email-campaign-2026-09-25.test.mjs`.
     Verification 2026-09-25 (rules 106-111; practice copy signed in from the saved super-admin session, trainers through
     `sandbox-trainer-login` in a separate context; the admin was never signed out; no password typed):
     - 583 tests + audit green at fe322c5. Practice preview `dpl_EiKmLbRzuL8XwSBrpTYUXt1GRMsX` aliased to
       ldtt-sandbox.vercel.app (PRACTICE / practice). LIVE production `dpl_V7KLE1YmSKGP46fsKF3X4KVhcTkj`
       (lorenzosdogtrainingteam.com = LIVE / public, stamp 20260925live28, app.js / metrics.js / styles.css sha256 = the
       commit's on both hosts). Rollback: `npx vercel rollback dpl_3v1ZygUySneenZNBAJY2sk8d5Qav --yes` (live27); both
       migrations are additive and harmless to the older code.
     - Practice: super admin list = 25 trainers with a portal login; a real practice send of qa lead TEST TEST Daniel ->
       Shavon (UP the chart) and back, two `trainer_lead_handoff` "(super admin)" rows, version 11 -> 13. Office Lost list =
       the four hard no's; status list offers no soft Lost; archive with "Can't reach them" wrote
       `raw_payload.archive_reason` and a Lost pick wrote `lost_dog_not_qualified` (the new CHECK value), both on qa rows,
       then put back to New Inquiry. Recycled + Office's turn on the office board (38 / 11 badges) and panel; Lorenzo's
       trainer card showed "I called the client", the tap stamped it and the card then read "You called the client ✓".
     - LIVE after deploy: 301 leads / 290 real (unchanged); `auto_followups` false, `trainer_call_reminders` and
       `office_turn_digest` absent (= OFF), `trainer_emails_hold` true, `email_campaign` armed false / no send_at / no
       pools, `reengage_batch` armed false; 0 reminder claims, 0 campaign claims, 0 digest rows, 0 live hand-offs; anon REST
       reads of the server-only keys return nothing; the 06:15 UTC cron tick on live28 answered 200.

112. **The follow-up timer has a START TIME and never texts the backlog; trainer emails go only for the chosen kinds
     (Joshua 2026-09-25, after the Lorenzo / Angela call).** Settings `pipeline_office_emails`:
     - `auto_followups_from` (ISO time). `runAutoFollowUps` does nothing before it (`waiting:true`, nothing written), and
       `autoFollowUpDue(lead, now, {fromMs})` skips any lead whose `pipeline.entered_at` is before it. Switching the timer
       on can therefore never text a lead from before the start (on 2026-09-25 that held out one real lead the office had
       already called, which would otherwise have got two texts at once, and one old live test row).
     - One follow-up text per lead per cron tick (`due.slice(0, 1)`): two steps due together go on two ticks, 15 minutes
       apart, never back to back.
     - `trainer_email_kinds` (list; absent/null = every kind, the old behavior). `trainerTwinEmail` skips a kind not on
       the list with a plain reason; the trainer TEXT is unchanged. Live list 2026-09-25: `trainer_new_inquiry`,
       `trainer_new_eval`, `pre_eval_answers` (new inquiry + evaluation booked with the questionnaire answers);
       `trainer_log_deal` stays text only.
     - Both keys are in `KEPT_WHEN_ABSENT`, so an office settings save that does not send them keeps the stored values.
     Pins: `tests/timer-start-and-trainer-emails-2026-09-25.test.mjs`.

113. **Angela's email is TWO emails, one button each (Joshua 2026-09-25, 4:50 AM, reading the preview).**
     `lib/email-campaign.js` `renderEmail({variant})` / `variantOf(lead)`:
     - `still_looking` (everyone who signed up earlier): subject "What would you change about your dog's behavior?",
       "Still looking for help with your dog?" through "Choose what works for you", ONE button SCHEDULE MY FREE
       EVALUATION, then the signature "Lorenzo's Dog Training Team" / "Serious Training. Serious Results." and the opt-out.
     - `finish_form` (started the booking form - `booking.intake` - but no dog answers and no booking / request /
       callback): subject "You've already taken the first step", her second-half words, ONE button BOOK MY FREE
       EVALUATION, the signature, her P.S. and the opt-out. Not the follow-up timer's 30-minute unfinished-form message
       (that one is unchanged).
     - Still once per person for the campaign (one of the two emails, never both). The send record and the run summary
       name the variant; the dry run counts both; preview takes `&variant=`. On 2026-09-25 the 124 were 123 + 1.
     Pins: `tests/email-campaign-2026-09-25.test.mjs`.

114. **A trainer (or any non-admin) can NOT change their own role, level, trainer link or access (2026-09-25).**
     Before: the policy `portal_user_clears_own_password_flag` let a signed-in user UPDATE every column of their own
     `portal_users` row, so a trainer could set `role='admin'` and pass `private.is_admin()`. Now the BEFORE UPDATE
     trigger `portal_users_self_update_guard` (public + practice) raises 42501 when a non-admin changes their OWN row's
     role, permission_level, trainer_id, active, access_status, disabled_at, disabled_by or user_id. Still allowed:
     their own display_name / first_name / last_name / profile_photo_url / must_change_password (the first-login
     "Save Permanent Password" RPC), and everything admins and server routes do. Proof on live (rolled back on
     purpose): as the trainer-demo user, role -> admin was blocked; a display_name update wrote 1 row.
     Migration file: `supabase/migrations/20260925160000_portal_users_self_update_guard.sql`.

115. **"Trainer Admin" = the office's view of the trainer portal, on its OWN empty record (2026-09-25).** Username
     `trainer admin` (also `trainer`, `traineradmin`, `trainer-admin`; `supabase.js` signIn aliases) signs in as
     `trainer-demo@lorenzosdogtrainingteam.com`. Its portal row now points at trainer `trainer-admin` ("Trainer Admin",
     status `inactive`: off every public trainer list, the super admin "Send to a trainer" list and the team tree; no
     ZIP, no calendar, no page, no leads). Before, that login was tied to Eric Beck's REAL record and saw his leads.
     Its password is set by Joshua himself (Portal Access -> Staff Access -> Reset Password); nothing here sets one.
     Migration file: `supabase/migrations/20260925161000_trainer_admin_view_login.sql`.

116. **The trainer's My Leads board MIRRORS the office Leads board (Rachel 2026-09-25; Lorenzo agreed the same day,
     replacing the six-column board of rule 80 / 2026-09-24).** `metrics.js TRAINER_PIPELINE_STAGES` = the office's
     eight columns with the office's words: New Inquiry | Office/Trainer Contacted | Engaged Lead: No Outcome |
     Evaluation Scheduled | Evaluation Cancelled | Evaluation Complete | Became a Client | Lost. "Office/Trainer
     Contacted" (office_contacted, follow_up_call_needed) = called, no conversation (voicemail); "Engaged Lead: No
     Outcome" (engaged_no_outcome) = spoke with them, no booking (Chloe Williams). Lost = lost_*, bad_lead, canceled_*.
     Do Not Contact and Archived are still never drawn for a trainer (rule 80). Card notes per column in
     `trainerCardNextStep` (engaged / cancelled added); `trainerDashboard` adds `engaged` and `evalCancelled`.
     The "Lead Pipeline" tab stays removed (2026-09-24). Pins: `tests/trainer-portal-2026-09-12.test.mjs`,
     `tests/trainer-lead-pipeline-2026-09-23.test.mjs`, `tests/status-label-2026-09-24.test.mjs`.

117. **A phone that autofills "+1 ..." keeps all 10 digits; the office can correct a lead's phone (Missy + Rachel
     2026-09-25).** Before: script.js's first formatter cut to 10 digits with the 1 still in front ("+1 (216) 555-1234"
     -> "(121) 655-5123", last digit lost), and the 2026-09-15 fix stripped a 1 only at EXACTLY 11 digits. 16 live
     leads were saved cut (5 named by the office, 2 after 09-15: Cherie K., Brandi P.); none can be recovered from
     stored data (raw_payload.phone holds the same cut value) - the office emails those clients. Now every copy
     strips leading 1s while more than 10 digits remain: script.js (both formatters, including the page-load one),
     market-landing.js, assets/v2/v2.js, lib/booking-page.js, lib/ad-page-template.js + the 12 dog-training-*.html
     pages (same line edited in place), trainer-backoffice/app.js formatPhoneWhileTyping. Form fields, FormSubmit and
     submit-contact are untouched (rule 72). Office lead panel: Phone is a box (`data-lead-phone`); on leaving it, a
     10-digit number with an area code not starting 0/1 saves through `persistLeadFields(lead, {phone})` (audit
     entry "phone corrected from ... to ..."); anything else is refused and the box resets. raw_payload.phone keeps
     what was submitted. Pins: `tests/phone-leading-one-2026-09-25.test.mjs`.

118. **One shared temporary password for trainers, and a welcome email for every NEW trainer (Joshua 2026-09-25).**
     Existing trainers: Joshua set the shared temporary password himself (SQL, 12:41 PM and 1:00 PM) on every trainer
     who had not signed in, plus the Trainer Admin login; his own tool `Second Brain/Env Vault/ldtt-live/
     verify-trainer-logins.mjs` then signed in as all 27 (+ Trainer Admin): 27 OK, 0 FAIL (17:02 UTC). Own passwords,
     never touched: Lorenzo Miller, Daniel Bainbridge, Shavon Striggles, Brady DeRemer, Eric Beck (Daniel's
     must_change_password cleared; Trainer Admin's cleared = permanent). New trainers: `api/ensure-trainer-user.js`
     creates the login with a random password (the login service refuses the shared one as "weak", 2026-09-18), then
     `rpc/ldtt_set_new_trainer_temp_password` (service_role only; changes a login ONLY when it is an active trainer
     row still marked temporary and has never signed in) sets the password from the Vercel setting
     LDTT_TRAINER_SHARED_TEMP_PASSWORD (Joshua's; capital first, "!" last, no spaces - otherwise unused), then emails
     the trainer (Resend, idempotency `trainer-welcome:<user id>`) the portal link, username and temporary password
     with the logo footer. The shared password is never returned to the screen. Setting missing / RPC refused = no
     email, the old one-time random password is shown, and the office is told why. Practice copy: no login, no
     email. The office's final onboarding screen shows a green "Welcome email SENT to ..." or an orange "NOT sent:
     <reason>" box. Claude never sets or tests a password. Pins: `tests/trainer-welcome-email-2026-09-25.test.mjs`.

## 2.0 icon circles, founder title, four new city pages, Ann Arbor off the campaign (added 2026-09-26, build 35)

119. **The red icon circles on the six 2.0 training cards are drawn WHOLE (office 2026-09-26: "half hidden/cut off
     where the photo meets the dark card").** Cause: the 09-16 frame clip `.ph,.cimg,.baimg,.simg{overflow:hidden}`
     (for pframe zoom) cut the lower half of `.cic`, which hangs `translate(-50%,50%)` below the photo. Fix is CSS
     ONLY, appended at the end of `assets/v2/v2.css`: `.svc .cimg{position:static}` (the frame still clips the
     photo) and `.svc .cic{top:calc(var(--u) * var(--h));bottom:auto;transform:translate(-50%,-50%)}` (the card,
     positioned on both layouts, is the circle's containing block; `--h` is the frame's own height, inherited),
     hover `scale(1.08)` kept, phone `top:130px` (the phone frame height). No page content changed. `lib/ad2-page-
     template.js` VERSION 20260923ad15 -> 20260926ad16 so browsers fetch the new stylesheet. Before: practice
     /ads/san-antonio screenshot `shots35/before-practice-san-antonio-desktop-svc.png` (circles cut); after:
     `shots35/practice-san-antonio-*`. Pins: `tests/meeting-2026-09-26.test.mjs` (1).
120. **The 2.0 founder / Lorenzo video block is titled "Start Your FREE Evaluation Today", and the office can edit
     its title and small line (office: "I'm unable to change the text on the Founder block").** Before, d2 drew
     fixed words "MEET THE FOUNDER," + "LORENZO MILLER"; d1 "LORENZO MILLER" under an editable eyebrow; d3 the
     `f_head` pair under "Meet the Founder, Lorenzo Miller". Now every design draws `f_title` (FIELDS, section
     "founder", all designs, max 40; default `FOUNDER_TITLE`) as a two-line `h2.f-title` in the old heading's spot
     (d1 fs23/lh22 y14 with the tag/paragraphs moved down 3-4 units, compact enough that the office's own element moves on /ads/cleveland (elbox founder:1 dy25) do not run the title into the paragraph; d2 fs21/lh21 y17, tag y61, paragraph y81; d3
     unchanged position) and `f_eyebrow` (now on d2 too; default "From Lorenzo Miller, our founder"). The Site
     Builder 2.0 founder panel and the classic 2.0 editor list both boxes (they read FIELDS). `f_head` is no longer
     drawn or kept. Spanish preview strings added. DATABASE: Arrison's rows were NOT regenerated or reset. Before any
     change every ad2 row of both schemas was copied byte-exact into `private.ad2_pages_backup_20260926`
     (row_json + md5; 14 practice + 13 public) and summarised in `shots35/ad2-backup-before.json`. The update is a
     targeted jsonb merge on `published_content` and `draft_content` ONLY: add `f_title` where the key is absent,
     and set `f_eyebrow` only where it was absent or still the old default ("Meet the Founder," / "Meet the Founder,
     Lorenzo Miller"). Before values: no row had an `f_title`; `f_eyebrow` was "Meet the Founder," (d1: cleveland,
     miramar-beach, san-diego, tallahassee), "Meet the Founder, Lorenzo Miller" (d3: ann-arbor, atlanta, chicago,
     lexington) or absent (d2). Pins: `tests/meeting-2026-09-26.test.mjs` (2, 2).
121. **Four NEW city ad pages for the Meta campaigns: /dog-training-navarre-fl, /dog-training-dallas-tx,
     /dog-training-durham-nh, /dog-training-flushing-ny.** They are records in `lib/ad-page-markets.js` built by the
     SAME `scripts/generate-market-pages.mjs` + `lib/ad-page-template.js renderAdPage` as every other city page, so the
     head (Meta pixel + Google tag, eventID x2), hero, evaluation form (`ad-form-card ad-form-card-v2 lead
     booking-intake`, `/api/booking-lead`, trainers-near-you picker), free-guide form, market-landing/ad-funnel/v2.js
     tracking and footer are the other pages' own code: the form differs from Cleveland's ONLY in the city placeholder
     and the preselected state (test-pinned). Leads therefore log exactly like today (rule 72/100). The 2.0 look comes
     from `lib/ad-page-v2-extras.js` (generator-only `options.v2`; styles scoped `.v2x`/`body.v2look`): the training
     cards with whole icon circles, the "Start Your FREE Evaluation Today" founder video block, a Google-reviews block
     (links to the real reviews; the 2.0 review quotes are not used because each names a trainer), service area, FAQ
     (+ FAQPage JSON-LD) and the 2.0 footer. **Joshua 2026-09-26: NO trainer names and NO trainer photos on these four
     pages** (no trainer card, no "with trainer X", not in alt text, meta or JSON-LD; `trainers` = "Lorenzo's certified
     trainers"; hero photos are generic training photos). The office's own report list (`adLandingPageConfigs`, portal
     only) still names each market's trainer. **SEO (Joshua 2026-09-26):** each page has its own `title` and
     `description` (market record; `marketToContent` passes `description` only when a market has one, so the older
     pages keep the template sentence byte for byte), a keyword H1 ("Dog Training in <City> ..."), a service intro
     paragraph under the cards, local card alt text, area H2/paragraph, FAQ questions with the local search terms, and
     the ProfessionalService JSON-LD `areaServed` (8 places). Brand words only (Serious Training. Serious Results.,
     FREE evaluation, Lorenzo's proven method, 40+ years, 12 states, real results, behavior solutions, calm, confident
     dog); no prices, stats or reviews invented. A page without `options.v2` renders byte-for-byte as before (the 11
     older city pages regenerate identical). `lib/ad-page-template.js cacheVersion` now equals the site stamp (it was
     stuck at 20260923live10 while the pages were stamped by sed), so regenerating never rolls a stamp back. Wired like
     the others: sitemap.xml, the office Ad landing page list, Page Studio's built-in list, `lib/pipeline.js`
     AREA_AD_PAGE (navarre, dallas, durham, flushing) and `reengageBookingLink`, which now also considers these pages'
     own area ZIP (`v2.areaKey` + first zipCodes) when no published 2.0 row has that area (an area WITH a 2.0 row keeps
     using the row's ZIP). The Flushing trainer's online booking stays paused: the Flushing page promises an office
     call, never online booking. None of the 2.0 rows Arrison edits was renamed or replaced (the public `flushing` 2.0
     DRAFT and practice `flushing`/`brooklyn` rows are separate /ads/ pages, untouched apart from rule 120's two keys).
     History: build 35's first production deploy (dpl_7zyttNi1hYnDQkmB8HeRFSC5Xw7c) still carried trainer cards and
     trainer photos; it was replaced the same evening by the no-names build. Pins: `tests/meeting-2026-09-26.test.mjs`
     (3, 3, 3); `tests/old-ad-pages-2026-09-23.test.mjs` and `tests/lead-integrity-2026-09-23.test.mjs` count 15.
122. **Ann Arbor is OFF the ad campaign: /dog-training-ann-arbor-mi (and .html) 308 to /contact** (`vercel.json`
     redirects, permanent) so links in emails already sent still land. The page file is deleted and the record moved
     to `retiredMarkets` in `lib/ad-page-markets.js`: no page generated, not in sitemap.xml, not in Page Studio's
     built-in list, not in AREA_AD_PAGE (an Ann Arbor lead's re-engage link is /book?zip=). Kept on purpose so no
     number moves (rule 1): `retiredMarkets` still labels old leads "Ad page: Ann Arbor, MI" (`lib/pipeline.js`) and
     keeps them in the paid-ad pool (`lib/email-campaign.js`); the office report row stays as "Ann Arbor (off the
     campaign)" with its history, its Open link now /contact. Dylan Atkinson's trainer page and bio page, the Ann
     Arbor recruiting page (trainer-opportunity-ann-arbor-mi) and the /ads/ann-arbor 2.0 row are untouched (the 2.0
     row is Arrison's; retiring it is the office's call). Pins: `tests/meeting-2026-09-26.test.mjs` (4).
     **Verified 2026-09-26/27 (build 35):** 608/608 tests, audit ok. Practice dpl_BVj29RifyXJv5Lw8VfcEAiP7vHDT
     (ldtt-sandbox), production dpl_4BtVGqDGQkfZwfTrQoMgR11kiGau (rollback target before build 35:
     dpl_3WrLn35qMNHT22aKjZ2ZWzNMje2u). Both hosts: stamp 20260926live35; /, /contact, /get-started and the four new
     pages 200 with their own titles, no trainer name, FAQPage JSON-LD; /dog-training-ann-arbor-mi 308 -> /contact.
     Live form typed (ZIP 32566, phone "+1 850 555 0142" -> "(850) 555-0142", trainer picker drew 2 cards) with every
     non-GET aborted and nothing submitted; public.leads 313 total / 302 non-QA before and after, 0 new rows. Row diff
     vs private.ad2_pages_backup_20260926: all 27 rows changed ONLY f_title + f_eyebrow inside the content columns (plus
     updated_at from the ad_pages_touch trigger); public flushing (a draft with an empty published_content) only in
     draft_content. Screenshots: session scratchpad shots35/.

123. **"Update landing page" really updates the LIVE landing page, and every publish is checked against the live page
     (Joshua 2026-09-26, after Missy's Eric Beck bio report; amends rule 56).** Before: on a live page with an
     unpublished draft, the profile editor's "Update landing page" saved a draft only, yet toasted "synced to landing
     page - Saved live" and showed "Matches landing page" (Eric Beck's new bio sat in draft rev 61, live rev 49).
     Now: when the page already has a published revision, "Update landing page" publishes through
     `publishTrainerPageWorkflow(trainer, true)` (this does publish any other saved draft changes on that page - Joshua's
     call); a page that was never published is saved as a draft with the message "...saved as a DRAFT: this page has
     never been published. Press Publish & Lock Trainer Page". After "Update landing page" and after BOTH "Publish & Lock
     Trainer Page" paths, `reportLiveLandingPage` reads the LIVE published row (`loadPublishedTrainer(..., {includeDraft:
     false})`) and compares bio, trainer video, title, service area, market, hero photo, headshot, search title and
     description with what was published; it says "Checked: the live landing page now shows everything you changed" or
     names what is missing. The pasted trainer video is now saved with the page (`trainer_video_url`) and read back
     (`trainerVideoUrl`), so it reaches the live landing page. Pins: `tests/landing-publish-check-2026-09-26.test.mjs`.

124. **The office Google Sheet copy fits the Google Form (office report 2026-09-28, "Google Form response Sheet returned
     400").** The Google Form (CONTACT_GOOGLE) refuses the whole row when a required answer is empty (Last Name, Address
     Line 1, City, State, Zip, Email, Phone, "I want to", "How did you hear about us") or a choice is not on its list
     (read from the form itself 2026-09-28). Every e-book download failed (no street/city/state/ZIP, "Paid ads market
     page", "Download the free 5-step calm dog blueprint"), and so did Contact Us "Referred by a past client" / "Is a
     past client" (~20 rows since 09-16). `api/form-delivery.js fitContactToGoogleForm` (Google copy ONLY; the portal
     lead and the FormSubmit email are unchanged, rule 72): past-client answers -> "A Former Client"; any other
     off-list "heard" -> "Other" + the real answer as the Other text; an off-list "I want to" -> the phone-consultation
     choice with "Website request: <real answer>" first in Comments; empty required text -> "Not given". Trainer
     applications untouched. Every lead was always saved in the portal (supabase: accepted). Pins:
     `tests/google-sheet-copy-2026-09-28.test.mjs`.

125. **The lead card shows the follow-up texts that really went out.** The journey line read "Follow-ups if not booked
     (15 min, 40 min, 24 h, 48 h) - Built. Not sending yet (waits for Joshua's go)" although the timer is ON since
     2026-09-25 9:00 AM ET and had sent (e.g. Tommy N. 09-27: 15-min 5:15 PM, 30-min 5:30 PM). Now "Follow-ups if not
     booked (15 min, 30 min, next day)" reads `pipeline.followups` (sent times, not-sent reasons, "Stopped: they
     booked", "came in before the follow-up texts started", the next one due). Pre-evaluation answers reads
     `pipeline.pre_eval_text`. Deal closed says "Not switched on" (that text is not wired). After the first texts it
     also names the next one due ("Next: the next-day text around ..."). Pins:
     `tests/office-fixes-2026-09-28.test.mjs`.

126. **A trainer video pasted or uploaded for a live page goes live and is checked** (Missy, Eric Beck, 2026-09-28):
     `saveTrainerVideoToLivePage` publishes through `publishTrainerPageWorkflow` when the page has a published revision
     and runs `reportLiveLandingPage`; a never-published page saves a draft and says so (rule 123).

127. **A trainer can save a note and change the eval date + time on their own open lead** (Missy, 2026-09-28).
     `api/trainer-lead-action.js` actions `note` (inserts into office_notes, entity lead, "Trainer note (<name>): ...",
     so the office sees it in the lead's Office Notes; audit row; no status change) and `eval_time` (leads.
     eval_scheduled_at, the same field as the office's "Eval date + time", typed in the lead's local time zone; closed
     leads refused; version-guarded like every trainer action). The trainer panel has "Save note" and an "Eval date +
     time" box with "Save eval date + time". Same trainer-only scoping as the other trainer actions.

128. **One-shot resend of leads that never reached the office Google Sheet (Joshua 2026-09-28, option A).**
     `lib/google-sheet-resend.js` runs from the */15 cron behind site_settings `google_sheet_resend` (server only,
     restrictive policy in both schemas, ships disarmed). Armed: it disarms itself first (version-guarded on
     updated_at). mode "dry" builds every row and sends nothing (summary in the key's last_run); mode "send" posts each
     never-accepted lead once through `deliverContactToGoogle` (rule 124 fitting), 1 per second, with "Resent
     2026-09-28: first received <date> ET" first in Comments, and records each result in form_delivery_attempts
     (payload_hash "resend-2026-09-28") so an accepted lead is never sent again. qa rows skipped; the practice copy
     never sends. Only the Google Sheet is touched: no lead, text, email or FormSubmit change. 76 real leads were
     pending (2026-08-06 .. 2026-09-28, 43 e-book downloads). Pins: `tests/google-sheet-resend-2026-09-28.test.mjs`.

## One person, one card: joining duplicate lead cards (added 2026-09-28, Joshua + Missy; stamp 20260928live40)

Record before this change (stamp 20260928live39, commit 6743ae7): 621 tests + audit green; live `public.leads` 326 rows /
315 non-qa (orchestrator baseline `shots40/baseline-before.json`); the Recycled badge was a `<span>` (rule 107) with a
tooltip only; 58 live leads sat in 42 duplicate pairs (same email or same 10-digit phone) and each counted as its own lead.

129. **A join keeps everything and loses nothing: backup FIRST, every child moved, the snapshot, and ONLY THEN the delete —
     in one database transaction per joined card.** `public.ldtt_merge_lead` / `practice.ldtt_merge_lead` (migration
     `supabase/migrations/20260928200000_lead_merge.sql`, applied as `lead_merge_2026_09_28`; one body created in both
     schemas, security definer, execute for `service_role` only): (a) the whole joined lead row + every child row it has go
     into `private.lead_merge_backup` (server only: RLS on, no policy, no browser grant, `private` is not exposed);
     (b) lead_events, communications_alert_deliveries, deals, clients, booking_holds, office_notes, office_note_revisions,
     lifecycle_events, form_delivery_attempts and audit_events move to the card that stays; (c) the plain-words snapshot is
     appended to `raw_payload.merged_requests[]` (earlier ones kept, and any the joined card carried come along), and a field
     the staying card is missing (email, phone, ZIP, street, city, state, dog name, the old `office_notes` text) is filled from
     the joined card — its own status, trainer, booking, phone and email never change; (d) `delete` of the joined card is the
     ONLY delete in the function. Both cards are version-guarded (a stale version raises, nothing is written). qa cards
     (boolean OR the string "true") are refused in the database too. Two cards that EACH have a client record are refused
     (clients_lead_id_unique; the office decides). `audit_events` "lead_merged" on the staying card. `ldtt_unmerge_lead(id)`
     (lib `unmergeFromBackup`, no button) puts a joined card back from the backup and moves its children back.
     Proven on the practice schema 2026-09-28: a stale version refused; notes, revisions, events, lifecycle, deliveries moved;
     backup written; unmerge restored all of it; then a real join of the practice test pair "Practice Walk790066".
130. **The card that stays = the most advanced status (became_client > evaluation_complete > evaluation_scheduled >
     engaged / office_contacted / follow_up_call_needed > new_inquiry > lost / archived / anything else); a tie goes to the
     NEWEST card.** ONE rule, `metrics.js chooseMergeMain` (`MERGE_STATUS_RANK`), used by the batch, the office confirm and
     the server op; `mergeLeadGroup` refuses a main that is not the most advanced, so a booked or client card is never joined
     into a less advanced one. The snapshot (`lib/lead-merge.js buildSnapshot` over `metrics.js requestEntryFromLead`) keeps,
     in plain words: when, the name / email / phone as entered, the page (`requestPageName`: "Contact Us page", "Cleveland ad
     page", "E-book download (Cleveland ad page)", "Trainer page: <name>", "Booking page", "<City> ad page 2.0"), how they
     heard about us + who referred them (Missy: it changes between requests), what they asked for, dog, their note, the booking,
     the status and trainer it had, utm, lane, the texts/emails the CLIENT got (only what the pipeline recorded as sent), extra
     answers, the old office-note text, and the moved counts. `merged_requests` is in `LEAD_INTERNAL_RAW_FIELD_KEYS`: never a
     sheet/CSV column, never a lead.
131. **Grouping for the one-time join: same normalized email = same person; a phone-only match joins ONLY when the first
     names match (first word, any case) AND the phone is not an ACTIVE `communications_testers` phone.** Every other
     phone-only match is LEFT FOR THE OFFICE; a person whose cards share an email or phone with a qa card is skipped whole;
     two client records are skipped (`lib/lead-merge.js groupDuplicates`). The batch runs from the */15 cron behind
     `site_settings` `lead_merge_batch` (both schemas, restrictive `lead_merge_batch_server_only` policy created before the
     row, SHIPS DISARMED): armed -> disarm first (version-guarded on updated_at); mode "dry" writes the full audit into
     `last_run` (before/after numbers, every group with each card, why that card stays, child counts, flags, left-over and
     skipped groups) and changes nothing else; mode "send" joins, 8-minute budget, "incomplete" is carried on by the next
     tick (max 8), a stop the office writes during a run is kept. **Arming "send" joins real cards on live: only after the
     dry-run list is reviewed.** Nothing in it texts or emails anyone.
132. **The Recycled badge stays on a joined card and CLICKING it opens the history.** A lead is Recycled when it carries
     `merged_requests` OR has an older unjoined match (rule 107 unchanged for those; `recycledIndex` now also counts joined
     requests: "first came in" = the earliest of them, "(N requests in all)" counts them). The badge is a `<button
     class="lead-tag-recycled" data-recycled-history>` on office Leads + Sales cards, the office panel, trainer cards and the
     trainer panel; its click runs before `[data-open-lead]` and never opens the card. `openRecycledHistory` draws a
     `<dialog>` on `document.body` (a redraw never closes it): "First came in: <date>", then one entry per request, newest
     first ("This card" / "Joined into this card" / "Still a separate card"). OFFICE: how many office notes came over from each
     joined request + that card's old note text + separate cards of the same person. TRAINER: the requests only — never office
     notes, never another card (rule 7); `api/operational-data.js stampRecycled` sends only the joined requests' TIMES.
     Readable at 375 px (no sideways scroll; screenshots `shots40/`).
133. **"Join with older request" is office admins only, and the server decides.** The office lead panel shows it
     (`joinOlderBox`) only when the lead has an OLDER separate card of the same person; the confirm names every card and
     which one stays. `api/operational-mutation.js` op `merge_leads` (inside the admin-only handler) re-reads the rows,
     refuses qa cards and cards that do not share an email/phone chain (`metrics.personRows`), checks the versions, picks
     the card that stays itself (`chooseMergeMain`) and calls `lib/lead-merge.js mergeLeadGroup`. No trainer door can join.
     **Counting:** a joined card is one row, so dashboards / Track 500 / lead totals count the person once; nothing counts
     `merged_requests` as leads (rule 1's hold-out and every count are otherwise unchanged).
     Pins: `tests/lead-merge-2026-09-28.test.mjs` (9), `tests/recycled-2026-09-25.test.mjs` (badge is a button now), the
     audit check "rules 129-133".
     Verification 2026-09-28/29 (rules 129-133): 630 tests + audit green at f8657d7. Practice preview
     `dpl_23sM6fCwQozUsSAWFKriP3V9T9cF` aliased to ldtt-sandbox.vercel.app (PRACTICE / practice); the saved super-admin
     session opened the joined practice card, the badge opened the history, no console errors (no sign-out, no password).
     LIVE production `dpl_3kh4pZuFGqfEtYjbWi9hJbsaKFt2` (stamp 20260928live40 on both hosts; /, /contact, /get-started 200;
     live metrics.js sha256 = the commit's; /fredharris draws). Rollback: `npx vercel rollback dpl_ALJWzQzpW2eAEUySPbz4VePB49mL
     --yes` (live39); the migration is additive and harmless to the older code. LIVE DRY RUN 2026-09-29 03:45 UTC (key disarmed
     itself, 326 rows before and after): 25 groups to join (21 email, 4 phone + same first name, 56 cards), 31 cards would be
     removed (326 -> 295 rows, 316 -> 285 on the screens), 1 skipped (Larry L., two client records), 0 left over / tester / qa;
     Recycled badges 32 -> 26. "send" NOT armed. Full list: session scratchpad `shots40/lead-merge-audit.md`.

134. **A join keeps the flags the office acts on (review of the 2026-09-28 dry run).** `ldtt_merge_lead` (public +
     practice, applied 2026-09-29) now also carries `raw_payload.needs_office_call = true` and `added_to_alpha = true`
     from the joined card onto the card that stays (Mark G.'s red "Needs a call" sat on the joined card). Proven on live
     inside a rolled-back test: joined ok, needs_office_call true, the office note moved, the joined card gone, then
     everything undone (326 rows, 0 backups). Review of the Do Not Contact flags: the office had used Do Not Contact to
     hide duplicates (notes "THIS IS A DUPILCATE", "DUPLICATE", "Test"), so those joins are what the office wanted;
     where a real Do Not Contact card is the newest/equal card it stays (Karen S., Paul C.).

135. **The new-trainer welcome email never carries the password (Joshua 2026-09-29; amends rule 118).** It says
     "Password: sign in with the temporary password the office provided." and still has the portal link, username,
     create-your-own-password step, office number and logo. It goes for every NEW live trainer login whether or not
     LDTT_TRAINER_SHARED_TEMP_PASSWORD is set: when it is set, the login gets the shared password first; when it is not
     (or the RPC refuses), the office sees the one-time random password on its screen and gives it to the trainer.
     Existing logins (anyone who already has a password) are never emailed. The office's final screen says "Welcome email
     SENT to ... Give them the temporary password yourself". Pins: `tests/trainer-welcome-email-2026-09-25.test.mjs`.

136. **The office sets the new-trainer temporary password itself (Joshua 2026-09-29).** Portal Access (Super Admin
     only) has "Temporary Password for New Trainers". The Super Admin types it once; the server
     (`api/ensure-trainer-user.js` op `save_temp_password`) checks the shape (capital first, "!" last, no spaces, 8+)
     and saves it ENCRYPTED in the Supabase vault (`private.trainer_temp_password_setting` +
     `ldtt_store_trainer_temp_password` / `ldtt_read_trainer_temp_password` / `ldtt_trainer_temp_password_status`, all
     service_role only; migration `20260929120000_trainer_temp_password_setting.sql`). It is never sent back to the
     screen; the box shows only "Set by <name> on <date>". It can be changed any time. A NEW live trainer login gets the
     saved password first; if none is saved, LDTT_TRAINER_SHARED_TEMP_PASSWORD; if neither, the one-time random password
     on the office screen (rule 135). Changing it never touches trainers who already have a login. Office Admins get
     403; the practice copy never saves it (it never creates logins). Pins:
     `tests/trainer-temp-password-office-2026-09-29.test.mjs`.
     Verified 2026-09-29: 634 tests pass, audit ok. LIVE production `dpl_3jFBrWQTxCtPyGZXEaNAVbvomseN` (stamp 20260929live42 on both hosts; /,
     /contact, /get-started, /staff 200; a status call with no login = 403). Practice copy: the box shows the practice
     message and is disabled; with a live-style answer a password with a space is refused on screen and no save call is
     made. The vault row is empty until the office saves one (nothing set by the build).

137. **The welcome email PRINTS the temporary password; Portal Access shows who got it (Joshua 2026-09-29; amends
     rules 118 and 135).** When a new live trainer login gets the office's saved temporary password (rule 136) the
     welcome email shows "Temporary password: <it>" with the portal link and username. If none is saved or it did not
     take, the email says "sign in with the temporary password the office provided" (the office screen shows the
     one-time password). Every send is recorded on `portal_users` (`welcome_email_status` sent_with_password / sent /
     failed, `welcome_email_at`, `welcome_email_to`; never the password; columns on public AND practice, migration
     `20260929130000_portal_users_welcome_email.sql`). Portal Access shows beside each TRAINER login: Logged in / No
     login yet, and the welcome email status. A trainer who has NEVER signed in has "Send welcome email" (Super Admin,
     confirm first): op `send_welcome` puts the saved password on the login first (only a never-signed-in trainer that
     must change its password), then emails it. A trainer who already signed in is refused (409) and never emailed.
     Pins: `tests/trainer-welcome-email-2026-09-25.test.mjs`, `tests/trainer-temp-password-office-2026-09-29.test.mjs`.

138. **Every link we text or email says where it came from (Joshua 2026-09-29).** `B.taggedLink(url, channel, message)`
     (lib/booking.js) adds `utm_source=text|email` and `utm_campaign=<new_lead|followup_link|unfinished|followup_first|
     care_call|reengage|campaign>` to OUR site's links in the new-lead text + email twin, the 15-min / 30-min / next-day
     follow-ups (text and email get different tags), the re-engage invite and the email campaign. The page answer to the
     website form (`book_url`) and the trainer's new-inquiry link stay PLAIN. Other sites' links are never touched.
     "text"/"email" never match the paid-network badges (ig/fb/google). Pins: tests/pipeline.test.mjs,
     tests/reengage-send.test.mjs, tests/meeting-2026-09-23.test.mjs.
     Verified 2026-09-29: LIVE `dpl_…` for live43 (stamp 20260929live43 both hosts; /, /contact, /get-started, /staff 200;
     send_welcome with no login = 403). Practice: 32 trainer rows show the welcome line, 0 page errors.

139. **Portal speed (Joshua 2026-09-29: "speed up 4x without breaking anything").** Same data, same counts, less work:
     (1) the office Leads board builds the detailed lead sheet ONLY while it is open (or in Table view) — opening it
     draws it; the trainer table is built only for trainers. (2) `siteEventRows()` and `filteredReportEventRows()` keep
     their answer until the loaded events, the trainer list, the report dates or the minute change. (3) The history and
     sheet loads leave out the website-visit events (`omitAllBut`); Reports / Communications / Ad Landing Pages still
     load them on open. (4) Focus + tab-switch + poll share ONE refresh and skip one within 2 s of the last; "nothing
     changed" moves only the top bar and "as of" stamps (rule 35), with a full redraw at least every 2 minutes; saves and
     change notices ("realtime", "manual", ...) always reload and redraw; every refresh redraw is still
     `backgroundRender()` (typing-safe, rule 17). (5) Signed submission photo links are kept 11 hours by path (they last
     12). Measured on the practice copy (headless, same session): Leads redraw ~200 ms -> ~60 ms, elements 18,058 ->
     3,222; Reports redraw 750-1,015 ms -> ~35 ms (15,736 events); the load after sign-in 11.3 MB -> 3.0 MB; sign-in to
     "Live" 8.4 s -> 5.6 s. LIVE `dpl_HFhJn8w4xSNw7QpCszzb2cYKkDYU` (stamp 20260929live44). Rollback:
     `npx vercel rollback` to the live43 deployment.

140. **A booking says which text or email link brought them (Joshua 2026-09-29).** The booking page reads
     `utm_source`/`utm_campaign` (rule 138 tags) and sends `link_from` with book, trainer request and call request.
     `api/booking.js` stamps `raw_payload.booking.link_from = {channel text|email, message, at}` (`B.linkFrom`; anything
     else -> nothing stamped) and a lead the booking page CREATES carries `utm_source`/`utm_campaign`. Nothing else in
     the booking changes (same checks, same holds, same texts). Pins: `tests/lead-history-kinds-2026-09-29.test.mjs`.

141. **Lead history + the pipeline "Kind" filter (Joshua 2026-09-29).** The OFFICE lead record (never the trainer's,
     rule 7) has "Lead history": First received (date, page, how they heard), every "Came back (recycled)" with its
     date, page, card tag and "What changed" (`METRICS.requestChanges`: page, how they heard, referral, phone by digits,
     email, ZIP, asked for, dog, trainer), and the outcome in date order: Booked online (when, trainer) + "They got there
     from the link in the <message> text|email" (`METRICS.linkFromOf/linkFromWords`), or "booked right on the website",
     or for bookings before 2026-09-29 08:00 UTC "not recorded then" + the last message we sent before it. The Leads
     pipeline has a "Kind" dropdown (`METRICS.LEAD_KIND_FILTERS` / `leadKinds`: Recycled, Booked online, Booked from a
     text/email link, Came from a text/email link, Asked for a trainer, Asked for a call, Needs a call, Office's turn, Did
     not finish the booking form, E-book downloads); each option shows its count, and the board columns, the other
     dropdown counts and "Showing N of M" all follow it (the same filteredLeadRows). Display only: no lead, status or
     dashboard number changes. Practice proof: Recycled (37) -> 37 cards, the 8 column counts add to 37, every card has
     the Recycled badge, 0 page errors. LIVE `dpl_AKxVXdMAGx75mJNBeRsJNiDQ8wYp` (stamp 20260929live45; /, /contact,
     /get-started, /staff, /book, /book/fredharris 200; the live booking page opened with tagged links, 0 errors).
