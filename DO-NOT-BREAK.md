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

21. **One table, three page types.** `ad_pages` keeps its name and gains `page_type`
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
25. **Entrances are strict**: `/ads/<slug>` serves only `page_type = ad`; `/p/<slug>` and
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
    - **Practice copy only this round.** `api/pipeline.js` answers 404 on live before anything else.
      REVISED in step 3b (rule 73): the step-3 wrapper `deliverOrEnterPipeline()` is GONE. The Contact handler
      calls `relayFormDeliveries('contact',…)` directly again and `window.LDTT_FORM_DELIVERY` is
      `{submitCanonical, relay: relayFormDeliveries}`, byte-for-byte commit 1176038. The practice copy reaches the
      pipeline through a SEPARATE capture listener that only exists when `/api/environment` says sandbox (see rule 73).
      `app.js` trainer pages still branch on `window.LDTT_IS_SANDBOX === true` before their own relay (live skips it).
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
    - **The customer-care text has its OWN Make route** (`LDTT_MAKE_HOOK_CARE`, never equal to pathway 1's hook: pathway 1's
      scenario has one Twilio module with the booking-link wording and no pathway filter). Until that route exists (needs
      Joshua's OK to create or change a Make scenario) the text is recorded as not sent with that reason.
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
    Tests: `tests/booking-zip.test.mjs` (10). Audit: the rule 74 check.

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
    Resend only, never FormSubmit (rule 73). Practice copy office emails go to marketing@ for now.
    Operations alert: `sendOpsAlert()` texts the Settings "Operations phone" (default Tim +12168168026)
    when a lead starts its journey (`enterPipeline`) and when an evaluation is booked (`afterBooking`),
    through Make scenario 6254549 (env LDTT_MAKE_HOOK_OPS, Preview only; tester filter on every route),
    only to an active tester phone, practice copy only. Recorded on the lead as pipeline.ops_new_lead and
    booking_notices[].ops_alert. Online bookings move to Eval Scheduled by themselves (verified).
