-- Approved review photos never appeared on the public site.
--
-- A review photo is uploaded to the PRIVATE `trainer-submissions` bucket, which has
-- no anon read policy, so a public page can never read it. Making that bucket public
-- was rejected: it also holds files belonging to ARCHIVED reviews, which must never
-- be reachable.
--
-- Instead, when the office APPROVES a review, the server copies just that review's
-- photo into the already-public `trainer-page-assets` bucket and records the new
-- object path here. The public page reads the public copy. Nothing archived is ever
-- copied, and the copy is deleted again when a review leaves the approved state.
--
-- Value is an object path INSIDE `trainer-page-assets`, e.g.
--   review-photos/<submission id>-<file name>
-- Null means "no public copy" (no file, a video, a pasted video link, or a file the
-- public bucket refuses); the API then falls back to a short-lived signed URL exactly
-- as it did before this change.

alter table public.content_submissions
  add column if not exists public_file_url text;

comment on column public.content_submissions.public_file_url is
  'Object path inside the public trainer-page-assets bucket holding the approved copy of this review''s photo. Written by api/operational-mutation.js on approval, cleared when the review is unpublished or archived. Null means the public page falls back to a signed URL.';
