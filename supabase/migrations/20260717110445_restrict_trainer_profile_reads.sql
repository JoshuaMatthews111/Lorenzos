drop policy if exists "public_active_trainers" on public.trainers;
create policy "public_active_trainers"
on public.trainers for select to anon
using (status = 'active' and access_status = 'active');

drop policy if exists "public_published_trainer_pages" on public.trainer_pages;
create policy "public_published_trainer_pages"
on public.trainer_pages for select to anon
using (page_status = 'published' and locked);
