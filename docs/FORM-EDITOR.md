# Lead form editor: maintainer's guide and hand-off

Portal chain step 4, 2026-09-12. DO-NOT-BREAK rule 75.

## What the office does

1. Staff portal → Page Editor → **Lead forms** (third tab, next to Page Editor and Page Studio).
2. Pick a form on the left. Change a question: rename it, tick Required, move it with ↑ ↓, edit the dropdown
   choices (one per line), or add a question (9 answer types). Press **Save this form**.
3. To remove a question, press **Remove**. A red box says what stops working. The signed-in name is filled in.
   The removal is logged. **Undo: put it back** undoes it.
4. Press **Publish on the practice copy**, then **Open the page** to check it.
5. Press **Send to live** (typed full name). It lands on the live portal as a DRAFT. Someone publishes it there.

## Where things live

| Piece | File |
| --- | --- |
| Form list, rules, warnings, log | `lib/lead-forms.js` |
| API (public read, editor, changes) | `api/lead-forms.js` |
| Portal screen | `trainer-backoffice/form-editor.js` |
| Public pages apply the published form | `script.js`, block "LEAD FORM EDITOR" (at the end) |
| Booking page questions | `lib/booking-page.js` (`FORM`), `lib/booking.js` `validateEvalForm(body, setting, formFields)` |
| Send to live | `api/send-to-live.js` kind `lead_forms` |
| Storage | `site_settings` key `lead_forms` (practice and public) |

The stored row is `{ draft: {forms, revision, saved_by, saved_at}, published: {forms, revision, published_by, published_at}, log: [...], sent_from_practice }`.
A form missing from `forms` is the original form.

## Rules that must hold

- A form nobody changed is never touched on the page (`changed:false`). The original questions in `FORMS` must match
  the page HTML. `tests/lead-forms.test.mjs` checks it. If you change a form's HTML, change `FORMS` too.
- The page's submit path is never changed. No FormSubmit, form-delivery or relay code is involved (rule 73).
- The texting consent wording cannot be edited, and consent can never be required (rule 47).
- A removed field the lead saver needs gets a hidden stand-in. submit-contact needs first name, last name, email
  and phone.
- Only `remove_field` and `restore_field` change the removed flag. Both are logged.

## Going live (not done yet)

Live is a hand-mixed build (rule 69). Ship these together, file by file:

1. `lib/lead-forms.js`, `api/lead-forms.js`, `trainer-backoffice/form-editor.js`, the `script.js` block, the
   `market-landing.js` / `ad-funnel.js` extra-answer lines, the `app.js` pieces (tab, view, whitelist, lead panel
   block), both shells' script tag, `api/environment.js`, `lib/office-email.js`.
2. Set `LDTT_LEAD_FORMS_LIVE=1` on Production. Without it every live route answers 404, and live pages never ask for
   forms.
3. The live `site_settings` row appears the first time someone sends from the practice copy. Publish it on the live
   portal.
4. The booking page is still practice-only (rule 71). Its questions come along when booking goes live.

## Hand-off: the 2.0 pages (ldtt-ads-v2-sandbox)

The 2.0 project is a separate website, not in this repo. Its evaluation form is in `/assets/v2/v2.js`. It posts to
`https://ldtt-sandbox.vercel.app/api/booking-lead`. The form editor already stores and serves its form ("2.0 ad
pages"). What the 2.0 project must add:

1. On load, fetch
   `https://ldtt-sandbox.vercel.app/api/lead-forms?op=public&form=ads_v2` (CORS allows
   `https://ldtt-ads-v2-sandbox.vercel.app`). Answer: `{ ok, form: { changed, orderChanged, fields: [...] } }`.
   Each field has `key`, `name`, `label`, `type`, `required`, `removed`, `choices`, `placeholder`, and `diff`
   (`{label, required, choices}`).
2. If `changed` is false, do nothing. Otherwise, for each built-in field (`first_name`, `last_name`, `phone`,
   `email`, `zip`, `dog_name`, `problem`, `sms_consent`):
   - hide and disable it if `removed`;
   - set the label text if `diff.label`;
   - set `required` if `diff.required`;
   - rebuild the `<option>`s if `diff.choices`.

   Leave the consent wording alone.
3. Draw added questions (`builtin: false`) in order, named by `name` (`Extra: <question>`).
4. When posting to `/api/booking-lead`, send added answers as `answers: { "<question>": "<answer>" }`. Join
   checkboxes with ", ". booking-lead already keeps them on the lead as `Extra: <question>`, and the lead panel and
   office emails show them.
5. booking-lead needs a first name, and a phone or an email. If the office removes first name, send
   `"Website visitor"`. If it removes both phone and email, the form cannot be sent. The editor's warning says so.

`script.js` `applyLeadForm()` is a working example of steps 2 and 3 for a plain HTML form.
