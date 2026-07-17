-- Preserve the trainer territory that received the traffic or lead. These fields
-- are separate from the prospect's own city and state on public.leads.
alter table public.leads add column if not exists trainer_market text;
alter table public.leads add column if not exists trainer_city text;
alter table public.leads add column if not exists trainer_state text;

alter table public.site_events add column if not exists trainer_market text;
alter table public.site_events add column if not exists trainer_city text;
alter table public.site_events add column if not exists trainer_state text;

create index if not exists idx_leads_trainer_location_created_at
  on public.leads (trainer_state, trainer_city, created_at desc);
create index if not exists idx_site_events_trainer_location_created_at
  on public.site_events (trainer_state, trainer_city, created_at desc);

comment on column public.leads.trainer_city is
  'City assigned to the trainer page that received this lead, not the prospect city.';
comment on column public.site_events.trainer_city is
  'City assigned to the trainer page that received this tracked event.';
