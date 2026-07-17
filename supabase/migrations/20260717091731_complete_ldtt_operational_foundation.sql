alter table public.leads
  add column if not exists source_submission_id text;

alter table public.trainer_applications
  add column if not exists source_submission_id text;

alter table public.portal_users
  add column if not exists must_change_password boolean not null default true;

create unique index if not exists idx_leads_source_submission_unique
  on public.leads (source_submission_id)
  where source_submission_id is not null;

create unique index if not exists idx_applications_source_submission_unique
  on public.trainer_applications (source_submission_id)
  where source_submission_id is not null;

create index if not exists idx_content_submissions_trainer_created
  on public.content_submissions (trainer_id, created_at desc);
create index if not exists idx_client_import_rows_batch
  on public.client_import_rows (batch_id);
create index if not exists idx_client_import_rows_client
  on public.client_import_rows (imported_client_id);
create index if not exists idx_clients_trainer_status
  on public.clients (trainer_id, status, created_at desc);
create index if not exists idx_dogs_client
  on public.dogs (client_id);
create index if not exists idx_lead_events_lead_created
  on public.lead_events (lead_id, created_at desc);
create index if not exists idx_leads_trainer_status_created
  on public.leads (trainer_id, status, created_at desc);

alter function public.set_updated_at() set search_path = public;
drop index if exists public.idx_site_events_location;

update public.trainers
set status = 'active', access_status = 'active'
where status = 'enrolled';

insert into public.trainer_pages (
  trainer_id, slug, template_key, page_status, locked, headline, subheadline,
  approved_bio, approved_photo_urls, draft_content, published_content,
  style_settings, section_order, revision, published_revision, published_at
)
select
  t.id,
  t.slug,
  case mod(row_number() over (order by t.full_name)::int - 1, 3)
    when 0 then 'mock_5'
    when 1 then 'mock_6'
    else 'mock_3'
  end,
  'published',
  true,
  case mod(row_number() over (order by t.full_name)::int - 1, 3)
    when 0 then 'The right trainer. The right results.'
    when 1 then 'Serious training. Serious results.'
    else 'Professional dog training for real-life results.'
  end,
  concat(
    'Professional dog training in ',
    coalesce(t.market, t.state, 'your area'),
    ' backed by Lorenzo''s proven system.'
  ),
  t.bio,
  case when t.headshot_url is null then '{}'::text[] else array[t.headshot_url] end,
  jsonb_build_object(
    'trainer_name', t.full_name,
    'market', t.market,
    'service_area', t.service_area,
    'bio', t.bio,
    'headshot_url', t.headshot_url,
    'title', 'Lorenzo''s Certified Dog Trainer'
  ),
  jsonb_build_object(
    'trainer_name', t.full_name,
    'market', t.market,
    'service_area', t.service_area,
    'bio', t.bio,
    'headshot_url', t.headshot_url,
    'title', 'Lorenzo''s Certified Dog Trainer'
  ),
  '{"font_family":"Inter","font_scale":1,"brand_primary":"#071f44","brand_accent":"#d80f35"}'::jsonb,
  array['hero','stats','services','trainer','reviews','consultation'],
  1,
  1,
  now()
from public.trainers t
on conflict (trainer_id) do update
set slug = excluded.slug,
    approved_bio = coalesce(public.trainer_pages.approved_bio, excluded.approved_bio),
    approved_photo_urls = case
      when cardinality(public.trainer_pages.approved_photo_urls) = 0
        then excluded.approved_photo_urls
      else public.trainer_pages.approved_photo_urls
    end,
    draft_content = public.trainer_pages.draft_content || excluded.draft_content,
    published_content = case
      when public.trainer_pages.published_content = '{}'::jsonb
        then excluded.published_content
      else public.trainer_pages.published_content
    end;

comment on column public.leads.source_submission_id is
  'Browser-generated idempotency key shared across Supabase, Google Sheet, and email delivery attempts.';
comment on column public.trainer_applications.source_submission_id is
  'Browser-generated idempotency key shared across Supabase, Google Sheet, and recruiting email delivery attempts.';
