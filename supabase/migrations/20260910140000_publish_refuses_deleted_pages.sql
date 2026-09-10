-- Rule 59 (Joshua 2026-09-10): a deleted trainer page (page_status 'archived') only comes
-- back through restore_trainer_page (typed name, audit row). Every publish_trainer_page copy
-- refuses a deleted page, so no browser tab (old build, stale state, direct RPC) can bring it
-- back by publishing. Bodies are otherwise unchanged; owner, security, search_path and grants
-- are kept by CREATE OR REPLACE.

CREATE OR REPLACE FUNCTION public.publish_trainer_page(target_page_id uuid)
 RETURNS trainer_pages
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_catalog'
AS $function$
declare
  next_page public.trainer_pages;
begin
  if not private.is_admin() then
    raise exception 'Admin access required';
  end if;

  if exists (select 1 from public.trainer_pages where id = target_page_id and page_status = 'archived') then
    raise exception 'This trainer page is deleted. Use Restore this page at the bottom of the Page Editor first.';
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
    next_page.id, next_page.published_revision, next_page.published_content,
    next_page.style_settings, next_page.section_order, (select auth.uid())
  );

  return next_page;
end;
$function$;

CREATE OR REPLACE FUNCTION private.publish_trainer_page(target_page_id uuid)
 RETURNS trainer_pages
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  result public.trainer_pages;
begin
  if not private.is_admin() then
    raise exception 'Admin access required';
  end if;

  if exists (select 1 from public.trainer_pages where id = target_page_id and page_status = 'archived') then
    raise exception 'This trainer page is deleted. Use Restore this page at the bottom of the Page Editor first.';
  end if;

  update public.trainer_pages
  set published_content = draft_content,
      page_status = 'published',
      locked = true,
      published_at = now(),
      published_revision = revision
  where id = target_page_id
  returning * into result;

  if result.id is null then
    raise exception 'Trainer page not found';
  end if;

  insert into public.trainer_page_versions (
    trainer_page_id, revision, content, style_settings, section_order, published_by
  ) values (
    result.id, result.revision, result.published_content, result.style_settings,
    result.section_order, (select auth.uid())
  )
  on conflict (trainer_page_id, revision) do update
    set content = excluded.content,
        style_settings = excluded.style_settings,
        section_order = excluded.section_order,
        published_by = excluded.published_by;

  return result;
end;
$function$;

CREATE OR REPLACE FUNCTION practice.publish_trainer_page(target_page_id uuid)
 RETURNS practice.trainer_pages
 LANGUAGE plpgsql
 SET search_path TO 'practice', 'practice_private', 'pg_catalog'
AS $function$
declare
  next_page practice.trainer_pages;
begin
  if not practice_private.is_admin() then
    raise exception 'Admin access required';
  end if;

  if exists (select 1 from practice.trainer_pages where id = target_page_id and page_status = 'archived') then
    raise exception 'This trainer page is deleted. Use Restore this page at the bottom of the Page Editor first.';
  end if;

  update practice.trainer_pages
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

  insert into practice.trainer_page_versions (
    trainer_page_id, revision, content, style_settings, section_order, published_by
  ) values (
    next_page.id, next_page.published_revision, next_page.published_content,
    next_page.style_settings, next_page.section_order, (select auth.uid())
  );

  return next_page;
end;
$function$;

CREATE OR REPLACE FUNCTION practice_private.publish_trainer_page(target_page_id uuid)
 RETURNS practice.trainer_pages
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'practice', 'practice_private', 'auth'
AS $function$
declare
  result practice.trainer_pages;
begin
  if not practice_private.is_admin() then
    raise exception 'Admin access required';
  end if;

  if exists (select 1 from practice.trainer_pages where id = target_page_id and page_status = 'archived') then
    raise exception 'This trainer page is deleted. Use Restore this page at the bottom of the Page Editor first.';
  end if;

  update practice.trainer_pages
  set published_content = draft_content,
      page_status = 'published',
      locked = true,
      published_at = now(),
      published_revision = revision
  where id = target_page_id
  returning * into result;

  if result.id is null then
    raise exception 'Trainer page not found';
  end if;

  insert into practice.trainer_page_versions (
    trainer_page_id, revision, content, style_settings, section_order, published_by
  ) values (
    result.id, result.revision, result.published_content, result.style_settings,
    result.section_order, (select auth.uid())
  )
  on conflict (trainer_page_id, revision) do update
    set content = excluded.content,
        style_settings = excluded.style_settings,
        section_order = excluded.section_order,
        published_by = excluded.published_by;

  return result;
end;
$function$;
