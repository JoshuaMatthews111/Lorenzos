-- Review photos are shown in a fixed-height frame, so a tall photo of a dog gets its
-- middle cropped and the dog's head can be cut off. The office can now nudge which
-- part of each photo stays in frame, stored per submission as a CSS object-position.
alter table public.content_submissions
  add column if not exists photo_position text;

alter table public.content_submissions
  drop constraint if exists content_submissions_photo_position_check;
alter table public.content_submissions
  add constraint content_submissions_photo_position_check
  check (photo_position is null or photo_position ~ '^[0-9]{1,3}% [0-9]{1,3}%$');

comment on column public.content_submissions.photo_position is
  'Which part of the photo stays visible in the review frame, e.g. "50% 25%". Null means centred.';
