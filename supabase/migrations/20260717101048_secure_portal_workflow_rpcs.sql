drop function if exists public.complete_portal_password_change();

create function public.complete_portal_password_change()
returns void
language sql
security invoker
set search_path = public, pg_catalog
as $$
  update public.portal_users
  set must_change_password = false,
      updated_at = now()
  where user_id = (select auth.uid())
    and active = true;
$$;

revoke all on function public.complete_portal_password_change() from public, anon;
grant execute on function public.complete_portal_password_change() to authenticated;
grant update (must_change_password, updated_at) on public.portal_users to authenticated;

drop policy if exists portal_user_clears_own_password_flag on public.portal_users;
create policy portal_user_clears_own_password_flag
on public.portal_users
for update
to authenticated
using (user_id = (select auth.uid()) and active = true)
with check (user_id = (select auth.uid()) and active = true);

create or replace function public.publish_trainer_page(target_page_id uuid)
returns public.trainer_pages
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
  next_page public.trainer_pages;
begin
  if not private.is_admin() then
    raise exception 'Admin access required';
  end if;

  update public.trainer_pages
  set published_content = draft_content,
      page_status = 'published',
      locked = true,
      revision = revision + 1,
      published_revision = revision + 1,
      published_at = now(),
      updated_at = now()
  where id = target_page_id
  returning * into next_page;

  if next_page.id is null then
    raise exception 'Trainer page not found';
  end if;

  insert into public.trainer_page_versions (
    trainer_page_id, revision, content, style_settings, section_order, published_by
  ) values (
    next_page.id,
    next_page.published_revision,
    next_page.published_content,
    next_page.style_settings,
    next_page.section_order,
    (select auth.uid())
  );

  return next_page;
end;
$$;

revoke all on function public.publish_trainer_page(uuid) from public, anon;
grant execute on function public.publish_trainer_page(uuid) to authenticated;

create index if not exists idx_office_notes_created_by
  on public.office_notes(created_by);
create index if not exists idx_trainer_page_versions_published_by
  on public.trainer_page_versions(published_by);
