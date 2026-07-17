insert into storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
)
values (
  'trainer-page-assets',
  'trainer-page-assets',
  true,
  10485760,
  array['image/jpeg','image/png','image/webp','image/gif','image/svg+xml']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "admins_manage_trainer_page_assets" on storage.objects;
create policy "admins_manage_trainer_page_assets"
on storage.objects for all to authenticated
using (bucket_id = 'trainer-page-assets' and private.is_admin())
with check (bucket_id = 'trainer-page-assets' and private.is_admin());

drop policy if exists "public_reads_trainer_page_assets" on storage.objects;
create policy "public_reads_trainer_page_assets"
on storage.objects for select to anon, authenticated
using (bucket_id = 'trainer-page-assets');
