insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'trainer-page-videos',
  'trainer-page-videos',
  true,
  52428800,
  array['video/mp4','video/webm','image/jpeg','image/png','image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "public_reads_trainer_page_videos" on storage.objects;
create policy "public_reads_trainer_page_videos"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'trainer-page-videos');

drop policy if exists "admins_manage_trainer_page_videos" on storage.objects;
create policy "admins_manage_trainer_page_videos"
on storage.objects for all
to authenticated
using (bucket_id = 'trainer-page-videos' and private.is_admin())
with check (bucket_id = 'trainer-page-videos' and private.is_admin());
