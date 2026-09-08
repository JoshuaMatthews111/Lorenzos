# Lorenzo's Dog Training Team — DO-NOT-BREAK

Written 2026-09-02 (Claude) from verified live state, before the trainer-deals build.
Copy also lives at the repo root. Update both.

**Live:** lorenzosdogtrainingteam.com · Vercel `ldtt-site` · deployed by hand with
`npx vercel deploy --prod` from `~/Desktop/codex-playground/lorenzo_concept1_site`,
branch `sandbox` (production IS the sandbox branch as of 2026-09-02 12:50).
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
- Read-only SQL: `select * from public.portal_users except select * from practice.portal_users` (and the reverse) → 0 rows right after a reset; `auth.users` = 45 = both portal_users tables; every practice portal user maps to an auth user.
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

38. **Signing in must not wait for the office sheets or the history.** `/api/operational-data?omit=sheets,history`
    is what the sign-in form and a restored session ask for; the server skips those queries entirely.
    `sheets` is a full SECOND copy of every lead, application and client (only the Download button reads it);
    `history` is `audit_events` + `office_note_revisions` + `form_delivery_attempts` (read only inside an open
    record and on the Communications screen). History is fetched straight after the first paint by
    `startBackgroundHistoryLoad()`; the sheets are fetched on the Download click by `ensureSheetsLoaded()`.
    Two rules hold this together and must not be removed:
    - The response carries `omitted: [...]`, and `mergeRemoteOperationalData()` skips any block named there.
      Without that guard the next 30-second poll blanks an open record's note history and the activity log.
    - The ETag input includes the omit list, so a trimmed answer can never satisfy a full request with a 304.
    Check: `node scripts/login-first-paint-proof.mjs` (9 checks) and `node scripts/audit-office-requirements.mjs`.
