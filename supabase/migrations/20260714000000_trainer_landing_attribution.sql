alter table public.leads add column if not exists trainer_slug text;
alter table public.leads add column if not exists assigned_trainer_name text;

alter table public.site_events add column if not exists trainer_slug text;
alter table public.site_events add column if not exists assigned_trainer_name text;
alter table public.site_events add column if not exists visitor_id text;
alter table public.site_events add column if not exists session_id text;
alter table public.site_events add column if not exists utm_source text;
alter table public.site_events add column if not exists utm_medium text;
alter table public.site_events add column if not exists utm_campaign text;

create index if not exists idx_leads_trainer_slug_created_at on public.leads (trainer_slug, created_at desc);
create index if not exists idx_site_events_trainer_slug_created_at on public.site_events (trainer_slug, created_at desc);
create index if not exists idx_site_events_type_created_at on public.site_events (event_type, created_at desc);

comment on column public.leads.assigned_trainer_name is 'Trainer attribution snapshot included in email, sheet, and admin reporting.';
comment on column public.site_events.visitor_id is 'Anonymous browser identifier. A visitor becomes identifiable only after submitting a form.';
