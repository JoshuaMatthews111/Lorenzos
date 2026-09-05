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

## Trainer onboarding (added 2026-09-05, Claude, branch fix/trainer-onboarding)

21. **The trainer wizard and the page editor only ever write to the trainer the office picked.**
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
