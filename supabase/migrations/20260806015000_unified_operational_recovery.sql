create extension if not exists pgcrypto;

-- Shared identity and optimistic-concurrency metadata.
alter table public.portal_users
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists profile_photo_url text,
  add column if not exists email text,
  add column if not exists permission_level text,
  add column if not exists access_status text not null default 'active',
  add column if not exists disabled_at timestamptz,
  add column if not exists disabled_by uuid references auth.users(id) on delete set null;

update public.portal_users portal
set email = auth_user.email
from auth.users auth_user
where portal.user_id = auth_user.id
  and portal.email is null;

update public.portal_users
set permission_level = case when role = 'admin' then 'super_admin' else 'trainer' end
where permission_level is null;

alter table public.portal_users
  alter column permission_level set default 'trainer',
  alter column permission_level set not null;

alter table public.portal_users drop constraint if exists portal_users_permission_level_check;
alter table public.portal_users add constraint portal_users_permission_level_check
  check (permission_level in ('super_admin', 'office_admin', 'trainer'));

alter table public.portal_users drop constraint if exists portal_users_access_status_check;
alter table public.portal_users add constraint portal_users_access_status_check
  check (access_status in ('active', 'disabled', 'revoked', 'profile_only', 'not_created'));

update public.portal_users
set first_name = nullif(split_part(trim(display_name), ' ', 1), ''),
    last_name = nullif(trim(substr(trim(display_name), length(split_part(trim(display_name), ' ', 1)) + 1)), '')
where display_name is not null
  and trim(display_name) <> ''
  and (first_name is null or last_name is null);

alter table public.leads
  add column if not exists assigned_user_id uuid references auth.users(id) on delete set null,
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references auth.users(id) on delete set null,
  add column if not exists version integer not null default 1;

alter table public.clients
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references auth.users(id) on delete set null,
  add column if not exists raw_payload jsonb not null default '{}'::jsonb,
  add column if not exists version integer not null default 1;

alter table public.trainers
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references auth.users(id) on delete set null,
  add column if not exists version integer not null default 1;

alter table public.trainer_pages
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references auth.users(id) on delete set null,
  add column if not exists public_url text;

alter table public.trainer_applications
  add column if not exists inquiry_type text not null default 'full_application',
  add column if not exists source_form text,
  add column if not exists source_page text,
  add column if not exists market text,
  add column if not exists utm_source text,
  add column if not exists utm_medium text,
  add column if not exists utm_campaign text,
  add column if not exists utm_content text,
  add column if not exists utm_term text,
  add column if not exists assigned_user_id uuid references auth.users(id) on delete set null,
  add column if not exists linked_discovery_id uuid references public.trainer_applications(id) on delete set null,
  add column if not exists received_at timestamptz,
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references auth.users(id) on delete set null,
  add column if not exists version integer not null default 1;

alter table public.content_submissions
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references auth.users(id) on delete set null,
  add column if not exists version integer not null default 1;

alter table public.office_notes
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists version integer not null default 1,
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references auth.users(id) on delete set null;

alter table public.lead_events
  add column if not exists actor_user_id uuid references auth.users(id) on delete set null,
  add column if not exists occurred_at timestamptz not null default now(),
  add column if not exists event_key text,
  add column if not exists corrects_event_id uuid references public.lead_events(id) on delete set null;

update public.trainer_applications
set received_at = created_at
where received_at is null;

alter table public.trainer_applications
  alter column received_at set default now(),
  alter column received_at set not null;

-- Expand lead status coverage without removing historical values.
alter table public.leads drop constraint if exists leads_status_check;
alter table public.leads add constraint leads_status_check check (status in (
  'site_visit',
  'new_inquiry',
  'office_contacted',
  'engaged_no_outcome',
  'follow_up_call_needed',
  'evaluation_scheduled',
  'evaluation_complete',
  'first_session_payment',
  'became_client',
  'lost_no_response',
  'lost_price_concern',
  'lost_not_ready',
  'lost_chose_another_provider',
  'lost_client_complaint',
  'lost_no_trainer_area',
  'bad_lead',
  'do_not_contact',
  'archived'
));

alter table public.trainer_applications drop constraint if exists trainer_applications_inquiry_type_check;
alter table public.trainer_applications add constraint trainer_applications_inquiry_type_check
  check (inquiry_type in ('discovery_call', 'contact_form_interest', 'full_application'));

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_email text,
  actor_name text,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  summary text,
  before_data jsonb,
  after_data jsonb,
  request_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.office_note_revisions (
  id uuid primary key default gen_random_uuid(),
  office_note_id uuid not null references public.office_notes(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  note text not null,
  previous_note text,
  edited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.form_delivery_attempts (
  id uuid primary key default gen_random_uuid(),
  submission_id text not null,
  entity_type text not null,
  entity_id text,
  destination text not null,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'failed', 'retrying')),
  request_id text,
  error_summary text,
  payload_hash text,
  attempt_count integer not null default 1 check (attempt_count > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (submission_id, destination, attempt_count)
);

create table if not exists public.review_publications (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.content_submissions(id) on delete cascade,
  destination_type text not null
    check (destination_type in ('homepage', 'trainer_page', 'city_page')),
  destination_id text not null,
  status text not null default 'published'
    check (status in ('draft', 'published', 'unpublished', 'archived')),
  published_by uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (submission_id, destination_type, destination_id)
);

create table if not exists public.lifecycle_events (
  id uuid primary key default gen_random_uuid(),
  event_key text unique,
  entity_type text not null,
  entity_id text not null,
  event_type text not null check (event_type in (
    'site_visit',
    'cta_click',
    'form_received',
    'evaluation_scheduled',
    'evaluation_completed',
    'became_client',
    'lost_no_response',
    'recruiting_inquiry',
    'full_application',
    'status_correction',
    'baseline_adjustment',
    'qa_release_check'
  )),
  market text,
  source_page text,
  visitor_id text,
  session_id text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  actor_user_id uuid references auth.users(id) on delete set null,
  corrects_event_id uuid references public.lifecycle_events(id) on delete set null,
  raw_payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Link a later full application to the candidate's earlier discovery inquiry.
-- The discovery record is archived, never deleted, and keeps its notes/history.
create or replace function public.link_recruiting_discovery_record()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  discovery_id uuid;
begin
  if tg_op = 'BEFORE' then
    if new.inquiry_type = 'full_application' and new.linked_discovery_id is null then
      select candidate.id into discovery_id
      from public.trainer_applications candidate
      where candidate.id <> coalesce(new.id, gen_random_uuid())
        and candidate.inquiry_type in ('discovery_call', 'contact_form_interest')
        and candidate.archived_at is null
        and (
          (new.email is not null and lower(candidate.email) = lower(new.email))
          or (
            regexp_replace(coalesce(new.phone, ''), '\\D', '', 'g') <> ''
            and regexp_replace(coalesce(candidate.phone, ''), '\\D', '', 'g') = regexp_replace(new.phone, '\\D', '', 'g')
          )
        )
      order by candidate.received_at desc
      limit 1;
      new.linked_discovery_id = discovery_id;
    end if;
    return new;
  end if;

  if new.inquiry_type = 'full_application' and new.linked_discovery_id is not null then
    update public.trainer_applications
    set status = 'archived',
        archived_at = coalesce(archived_at, now()),
        raw_payload = coalesce(raw_payload, '{}'::jsonb)
          || jsonb_build_object('linked_full_application_id', new.id)
    where id = new.linked_discovery_id;

    insert into public.audit_events (
      action, entity_type, entity_id, summary, after_data
    ) values (
      'discovery_linked_to_full_application',
      'application',
      new.linked_discovery_id::text,
      'Discovery inquiry linked to a later full application and archived.',
      jsonb_build_object('full_application_id', new.id)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists link_recruiting_discovery_before_insert on public.trainer_applications;
create trigger link_recruiting_discovery_before_insert
before insert on public.trainer_applications
for each row execute function public.link_recruiting_discovery_record();

drop trigger if exists link_recruiting_discovery_after_insert on public.trainer_applications;
create trigger link_recruiting_discovery_after_insert
after insert on public.trainer_applications
for each row execute function public.link_recruiting_discovery_record();

revoke all on function public.link_recruiting_discovery_record() from public, anon, authenticated;

create index if not exists idx_audit_events_entity_created
  on public.audit_events (entity_type, entity_id, created_at desc);
create index if not exists idx_audit_events_actor_created
  on public.audit_events (actor_user_id, created_at desc);
create index if not exists idx_note_revisions_note_created
  on public.office_note_revisions (office_note_id, created_at desc);
create index if not exists idx_delivery_submission_created
  on public.form_delivery_attempts (submission_id, created_at desc);
create index if not exists idx_review_publications_destination
  on public.review_publications (destination_type, destination_id, status);
create index if not exists idx_lifecycle_events_type_occurred
  on public.lifecycle_events (event_type, occurred_at desc);
create index if not exists idx_lifecycle_events_market_occurred
  on public.lifecycle_events (market, occurred_at desc);
create index if not exists idx_applications_inquiry_received
  on public.trainer_applications (inquiry_type, received_at desc);
create index if not exists idx_applications_assignee_received
  on public.trainer_applications (assigned_user_id, received_at desc);
create index if not exists idx_leads_assignee_created
  on public.leads (assigned_user_id, created_at desc);

-- Establish a visible one-time baseline without changing any operational row.
insert into public.lifecycle_events (
  event_key, entity_type, entity_id, event_type, market, source_page,
  utm_source, utm_medium, utm_campaign, raw_payload, occurred_at
)
select
  'baseline:lead:' || l.id || ':form_received',
  'lead',
  l.id::text,
  'form_received',
  coalesce(l.trainer_market, concat_ws(', ', l.city, l.state)),
  l.source_page,
  l.raw_payload ->> 'utm_source',
  l.raw_payload ->> 'utm_medium',
  l.raw_payload ->> 'utm_campaign',
  jsonb_build_object('baseline', true, 'status_at_baseline', l.status),
  l.created_at
from public.leads l
where l.status <> 'site_visit'
on conflict (event_key) do nothing;

insert into public.lifecycle_events (
  event_key, entity_type, entity_id, event_type, market, source_page, raw_payload, occurred_at
)
select
  'baseline:lead:' || l.id || ':' || mapped.event_type,
  'lead',
  l.id::text,
  mapped.event_type,
  coalesce(l.trainer_market, concat_ws(', ', l.city, l.state)),
  l.source_page,
  jsonb_build_object('baseline', true, 'status_at_baseline', l.status),
  coalesce(l.updated_at, l.created_at)
from public.leads l
cross join lateral (
  select case l.status
    when 'evaluation_scheduled' then 'evaluation_scheduled'
    when 'evaluation_complete' then 'evaluation_completed'
    when 'first_session_payment' then 'became_client'
    when 'became_client' then 'became_client'
    when 'lost_no_response' then 'lost_no_response'
    else null
  end as event_type
) mapped
where mapped.event_type is not null
on conflict (event_key) do nothing;

insert into public.lifecycle_events (
  event_key, entity_type, entity_id, event_type, market, source_page,
  utm_source, utm_medium, utm_campaign, raw_payload, occurred_at
)
select
  'baseline:application:' || a.id || ':' || case when a.inquiry_type = 'full_application' then 'full_application' else 'recruiting_inquiry' end,
  'application',
  a.id::text,
  case when a.inquiry_type = 'full_application' then 'full_application' else 'recruiting_inquiry' end,
  a.market,
  a.source_page,
  a.utm_source,
  a.utm_medium,
  a.utm_campaign,
  jsonb_build_object('baseline', true, 'inquiry_type', a.inquiry_type),
  a.received_at
from public.trainer_applications a
on conflict (event_key) do nothing;

insert into public.lifecycle_events (
  event_key, entity_type, entity_id, event_type, market, source_page,
  visitor_id, session_id, utm_source, utm_medium, utm_campaign, raw_payload, occurred_at
)
select
  'baseline:site_event:' || e.id,
  'site_event',
  e.id::text,
  case when e.event_type ilike '%click%' then 'cta_click' else 'site_visit' end,
  e.trainer_market,
  e.page_path,
  e.visitor_id,
  e.session_id,
  e.utm_source,
  e.utm_medium,
  e.utm_campaign,
  e.raw_payload || jsonb_build_object('baseline', true, 'original_event_type', e.event_type),
  e.created_at
from public.site_events e
on conflict (event_key) do nothing;

drop trigger if exists set_delivery_attempts_updated_at on public.form_delivery_attempts;
create trigger set_delivery_attempts_updated_at before update on public.form_delivery_attempts
for each row execute function public.set_updated_at();

drop trigger if exists set_review_publications_updated_at on public.review_publications;
create trigger set_review_publications_updated_at before update on public.review_publications
for each row execute function public.set_updated_at();

drop trigger if exists set_office_notes_updated_at on public.office_notes;
create trigger set_office_notes_updated_at before update on public.office_notes
for each row execute function public.set_updated_at();

create or replace function public.increment_record_version()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.version = coalesce(old.version, 0) + 1;
  return new;
end;
$$;

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'trainers', 'leads', 'clients', 'trainer_applications',
    'content_submissions', 'office_notes'
  ]
  loop
    execute format('drop trigger if exists increment_record_version on public.%I', target_table);
    execute format(
      'create trigger increment_record_version before update on public.%I for each row execute function public.increment_record_version()',
      target_table
    );
  end loop;
end $$;

-- Preserve an immutable copy of each note revision, including the first version.
create or replace function public.capture_office_note_revision()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.office_note_revisions (
      office_note_id, entity_type, entity_id, note, previous_note, edited_by
    ) values (
      new.id, new.entity_type, new.entity_id, new.note, null, new.created_by
    );
  elsif old.note is distinct from new.note then
    insert into public.office_note_revisions (
      office_note_id, entity_type, entity_id, note, previous_note, edited_by
    ) values (
      new.id, new.entity_type, new.entity_id, new.note, old.note, coalesce((select auth.uid()), new.created_by)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists capture_office_note_revision on public.office_notes;
create trigger capture_office_note_revision
after insert or update of note on public.office_notes
for each row execute function public.capture_office_note_revision();

revoke all on function public.capture_office_note_revision() from public, anon, authenticated;

alter table public.audit_events enable row level security;
alter table public.office_note_revisions enable row level security;
alter table public.form_delivery_attempts enable row level security;
alter table public.review_publications enable row level security;
alter table public.lifecycle_events enable row level security;

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'audit_events', 'office_note_revisions', 'form_delivery_attempts',
    'review_publications', 'lifecycle_events'
  ]
  loop
    execute format('drop policy if exists "admin_all" on public.%I', target_table);
    execute format(
      'create policy "admin_all" on public.%I for all to authenticated using (private.is_admin()) with check (private.is_admin())',
      target_table
    );
  end loop;
end $$;

-- Audit, note revision, and lifecycle rows are append-only to portal users.
drop policy if exists "admin_all" on public.audit_events;
drop policy if exists "admin_reads_audit_events" on public.audit_events;
drop policy if exists "admin_inserts_audit_events" on public.audit_events;
create policy "admin_reads_audit_events"
on public.audit_events for select to authenticated
using (private.is_admin());
create policy "admin_inserts_audit_events"
on public.audit_events for insert to authenticated
with check (private.is_admin());

drop policy if exists "admin_all" on public.office_note_revisions;
drop policy if exists "admin_reads_office_note_revisions" on public.office_note_revisions;
create policy "admin_reads_office_note_revisions"
on public.office_note_revisions for select to authenticated
using (private.is_admin());

drop policy if exists "admin_all" on public.lifecycle_events;
drop policy if exists "admin_reads_lifecycle_events" on public.lifecycle_events;
drop policy if exists "admin_inserts_lifecycle_events" on public.lifecycle_events;
create policy "admin_reads_lifecycle_events"
on public.lifecycle_events for select to authenticated
using (private.is_admin());
create policy "admin_inserts_lifecycle_events"
on public.lifecycle_events for insert to authenticated
with check (private.is_admin());

drop policy if exists "trainer_reads_own_note_revisions" on public.office_note_revisions;
create policy "trainer_reads_own_note_revisions"
on public.office_note_revisions for select to authenticated
using (
  private.is_active_portal_user()
  and entity_type in ('trainer', 'submission')
  and entity_id = private.current_trainer_id()
);

revoke update, delete on public.audit_events from authenticated;
grant select, insert on public.audit_events to authenticated;
grant select on public.office_note_revisions to authenticated;
grant select, insert, update on public.form_delivery_attempts to authenticated;
grant select, insert, update on public.review_publications to authenticated;
revoke update, delete on public.lifecycle_events from authenticated;
grant select, insert on public.lifecycle_events to authenticated;
grant update (first_name, last_name, display_name, profile_photo_url, updated_at)
  on public.portal_users to authenticated;

-- Shared, Supabase-backed office spreadsheet projections.
create or replace view public.office_leads_sheet
with (security_invoker = true)
as
select
  l.id,
  l.created_at as received_at,
  l.updated_at,
  l.version,
  l.status,
  l.first_name,
  l.last_name,
  l.email,
  l.phone,
  l.city,
  l.state,
  l.zip,
  l.dog_name,
  l.dog_breed,
  l.service_interest,
  l.lead_source,
  l.source_page,
  l.trainer_market as market,
  l.assigned_trainer_name,
  pu.display_name as assigned_to,
  l.sms_consent,
  l.email_consent,
  l.raw_payload,
  l.archived_at
from public.leads l
left join public.portal_users pu on pu.user_id = l.assigned_user_id;

create or replace view public.office_applications_sheet
with (security_invoker = true)
as
select
  a.id,
  a.received_at,
  a.created_at,
  a.updated_at,
  a.version,
  a.status,
  a.inquiry_type,
  a.first_name,
  a.last_name,
  a.email,
  a.phone,
  a.city,
  a.state,
  a.zip,
  a.market,
  a.referral_source,
  a.source_form,
  a.source_page,
  pu.display_name as assigned_to,
  a.linked_discovery_id,
  a.raw_payload,
  a.archived_at
from public.trainer_applications a
left join public.portal_users pu on pu.user_id = a.assigned_user_id;

create or replace view public.office_clients_sheet
with (security_invoker = true)
as
select
  c.id,
  c.created_at,
  c.updated_at,
  c.version,
  c.status,
  c.client_name,
  c.email,
  c.phone,
  c.service_area,
  c.zip,
  c.lead_source,
  c.sms_consent,
  c.email_consent,
  c.date_started,
  c.last_contacted,
  c.notes,
  c.raw_payload,
  c.archived_at
from public.clients c;

grant select on public.office_leads_sheet to authenticated;
grant select on public.office_applications_sheet to authenticated;
grant select on public.office_clients_sheet to authenticated;

-- Include new canonical tables in Realtime where supported.
do $$
begin
  begin
    alter publication supabase_realtime add table public.leads;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.trainer_applications;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.clients;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.office_notes;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.audit_events;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.review_publications;
  exception when duplicate_object then null;
  end;
end $$;

comment on table public.audit_events is 'Append-only office audit history with actor snapshots and canonical before/after data.';
comment on table public.form_delivery_attempts is 'Delivery status for Supabase, Google Form response Sheet, and FormSubmit fan-out.';
comment on table public.review_publications is 'Durable approved-review destinations; review placement is never encoded in note text.';
comment on table public.lifecycle_events is 'Immutable reporting events used for conversion totals and market attribution.';
