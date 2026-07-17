create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

alter table public.trainers
  add column if not exists access_status text not null default 'active'
    check (access_status in ('active', 'disabled')),
  add column if not exists auth_user_id uuid unique references auth.users(id) on delete set null,
  add column if not exists credentials jsonb not null default '[]'::jsonb,
  add column if not exists specialties jsonb not null default '[]'::jsonb,
  add column if not exists social_links jsonb not null default '{}'::jsonb;

alter table public.trainer_pages
  add column if not exists slug text unique,
  add column if not exists logo_url text,
  add column if not exists hero_image_url text,
  add column if not exists draft_content jsonb not null default '{}'::jsonb,
  add column if not exists published_content jsonb not null default '{}'::jsonb,
  add column if not exists style_settings jsonb not null default '{"font_family":"Inter","font_scale":1,"brand_primary":"#071f44","brand_accent":"#d80f35"}'::jsonb,
  add column if not exists section_order text[] not null default array['hero','stats','services','trainer','reviews','consultation'],
  add column if not exists revision integer not null default 1,
  add column if not exists published_revision integer;

update public.trainer_pages p
set slug = coalesce(p.slug, t.slug)
from public.trainers t
where p.trainer_id = t.id and p.slug is null;

create table if not exists public.portal_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'trainer')),
  trainer_id uuid references public.trainers(id) on delete set null,
  display_name text,
  active boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((role = 'admin' and trainer_id is null) or (role = 'trainer' and trainer_id is not null))
);

create table if not exists public.trainer_page_versions (
  id uuid primary key default gen_random_uuid(),
  trainer_page_id uuid not null references public.trainer_pages(id) on delete cascade,
  revision integer not null,
  content jsonb not null,
  style_settings jsonb not null default '{}'::jsonb,
  section_order text[] not null default '{}',
  published_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (trainer_page_id, revision)
);

create table if not exists public.office_notes (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('lead','application','client','trainer','submission')),
  entity_id uuid not null,
  note text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_portal_users_trainer on public.portal_users (trainer_id);
create index if not exists idx_trainer_pages_status on public.trainer_pages (page_status, published_at desc);
create index if not exists idx_trainer_page_versions_page on public.trainer_page_versions (trainer_page_id, revision desc);
create index if not exists idx_office_notes_entity on public.office_notes (entity_type, entity_id, created_at desc);
create index if not exists idx_site_events_location on public.site_events (trainer_state, trainer_city, created_at desc);

drop trigger if exists set_portal_users_updated_at on public.portal_users;
create trigger set_portal_users_updated_at before update on public.portal_users
for each row execute function public.set_updated_at();

create or replace function private.is_active_portal_user()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.portal_users pu
    left join public.trainers t on t.id = pu.trainer_id
    where pu.user_id = (select auth.uid())
      and pu.active
      and (pu.role = 'admin' or coalesce(t.access_status, 'disabled') = 'active')
  );
$$;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.portal_users
    where user_id = (select auth.uid())
      and role = 'admin'
      and active
  );
$$;

create or replace function private.current_trainer_id()
returns uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select trainer_id
  from public.portal_users
  where user_id = (select auth.uid())
    and role = 'trainer'
    and active
  limit 1;
$$;

revoke all on function private.is_active_portal_user() from public, anon;
revoke all on function private.is_admin() from public, anon;
revoke all on function private.current_trainer_id() from public, anon;
grant execute on function private.is_active_portal_user() to authenticated, service_role;
grant execute on function private.is_admin() to authenticated, service_role;
grant execute on function private.current_trainer_id() to authenticated, service_role;

create or replace function private.publish_trainer_page(target_page_id uuid)
returns public.trainer_pages
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  result public.trainer_pages;
begin
  if not private.is_admin() then
    raise exception 'Admin access required';
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
$$;

revoke all on function private.publish_trainer_page(uuid) from public, anon;
grant execute on function private.publish_trainer_page(uuid) to authenticated, service_role;

create or replace function private.sync_client_from_converted_lead()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status in ('first_session_payment', 'became_client')
     and old.status is distinct from new.status then
    insert into public.clients (
      lead_id, trainer_id, client_name, phone, email, service_area, zip,
      lead_source, status, sms_consent, email_consent, date_started,
      last_contacted, notes
    ) values (
      new.id,
      new.trainer_id,
      trim(new.first_name || ' ' || new.last_name),
      new.phone,
      new.email,
      concat_ws(', ', new.city, new.state),
      new.zip,
      new.lead_source,
      'active',
      new.sms_consent,
      new.email_consent,
      current_date,
      current_date,
      new.office_notes
    )
    on conflict (lead_id) do update
      set trainer_id = excluded.trainer_id,
          client_name = excluded.client_name,
          phone = excluded.phone,
          email = excluded.email,
          status = 'active',
          last_contacted = current_date,
          notes = excluded.notes;
  end if;
  return new;
end;
$$;

create unique index if not exists idx_clients_lead_unique
  on public.clients (lead_id) where lead_id is not null;

drop trigger if exists sync_client_after_lead_conversion on public.leads;
create trigger sync_client_after_lead_conversion
after update of status on public.leads
for each row execute function private.sync_client_from_converted_lead();

alter table public.portal_users enable row level security;
alter table public.trainer_page_versions enable row level security;
alter table public.office_notes enable row level security;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'trainers','trainer_pages','leads','lead_events','clients','dogs',
    'trainer_applications','content_submissions','client_import_batches',
    'client_import_rows','site_events','portal_users','trainer_page_versions','office_notes'
  ]
  loop
    execute format('drop policy if exists "admin_all" on public.%I', table_name);
    execute format(
      'create policy "admin_all" on public.%I for all to authenticated using (private.is_admin()) with check (private.is_admin())',
      table_name
    );
  end loop;
end $$;

drop policy if exists "public_active_trainers" on public.trainers;
create policy "public_active_trainers"
on public.trainers for select to anon, authenticated
using (status = 'active' and access_status = 'active');

drop policy if exists "public_published_trainer_pages" on public.trainer_pages;
create policy "public_published_trainer_pages"
on public.trainer_pages for select to anon, authenticated
using (page_status = 'published' and locked);

drop policy if exists "trainer_reads_own_profile" on public.trainers;
create policy "trainer_reads_own_profile"
on public.trainers for select to authenticated
using (private.is_active_portal_user() and id = private.current_trainer_id());

drop policy if exists "trainer_reads_own_page" on public.trainer_pages;
create policy "trainer_reads_own_page"
on public.trainer_pages for select to authenticated
using (private.is_active_portal_user() and trainer_id = private.current_trainer_id());

drop policy if exists "trainer_reads_own_leads" on public.leads;
create policy "trainer_reads_own_leads"
on public.leads for select to authenticated
using (private.is_active_portal_user() and trainer_id = private.current_trainer_id());

drop policy if exists "trainer_reads_own_submissions" on public.content_submissions;
create policy "trainer_reads_own_submissions"
on public.content_submissions for select to authenticated
using (private.is_active_portal_user() and trainer_id = private.current_trainer_id());

drop policy if exists "trainer_inserts_own_submissions" on public.content_submissions;
create policy "trainer_inserts_own_submissions"
on public.content_submissions for insert to authenticated
with check (private.is_active_portal_user() and trainer_id = private.current_trainer_id());

drop policy if exists "trainer_reads_own_events" on public.site_events;
create policy "trainer_reads_own_events"
on public.site_events for select to authenticated
using (private.is_active_portal_user() and trainer_id = private.current_trainer_id());

grant usage on schema public to anon, authenticated, service_role;
grant select on public.trainers, public.trainer_pages to anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'trainer-submissions',
  'trainer-submissions',
  false,
  52428800,
  array['image/jpeg','image/png','image/webp','video/mp4','video/quicktime','application/pdf']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "trainer_uploads_submission_media" on storage.objects;
create policy "trainer_uploads_submission_media"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'trainer-submissions'
  and private.is_active_portal_user()
  and (storage.foldername(name))[1] = private.current_trainer_id()::text
);

drop policy if exists "trainer_reads_submission_media" on storage.objects;
create policy "trainer_reads_submission_media"
on storage.objects for select to authenticated
using (
  bucket_id = 'trainer-submissions'
  and (
    private.is_admin()
    or (
      private.is_active_portal_user()
      and (storage.foldername(name))[1] = private.current_trainer_id()::text
    )
  )
);

drop policy if exists "admin_manages_submission_media" on storage.objects;
create policy "admin_manages_submission_media"
on storage.objects for all to authenticated
using (bucket_id = 'trainer-submissions' and private.is_admin())
with check (bucket_id = 'trainer-submissions' and private.is_admin());
