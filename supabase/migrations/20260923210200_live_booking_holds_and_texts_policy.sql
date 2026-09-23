-- GO-LIVE 2026-09-23: the two pieces of live structure the booking + pipeline release needs.
-- 1. public.booking_holds, mirroring practice's table WITHOUT the one-hold-per-slot unique index
--    (dropped on practice 2026-09-14: picks are recorded, not exclusive - rule 71 note).
-- 2. The RESTRICTIVE pipeline_texts_server_only policy on public.site_settings, created BEFORE any
--    pipeline_texts row exists there, so the row is never browser-readable even for a moment (rule 84).
-- Undo: drop table public.booking_holds; drop policy "pipeline_texts_server_only" on public.site_settings;
create table if not exists public.booking_holds (
  id uuid primary key default gen_random_uuid(),
  trainer_slug text not null,
  slot_start timestamptz not null,
  slot_minutes integer not null default 60,
  lead_id uuid,
  location text,
  status text not null default 'held' check (status in ('held', 'released')),
  created_at timestamptz not null default now(),
  released_at timestamptz
);
create index if not exists booking_holds_lead_idx on public.booking_holds (lead_id);
alter table public.booking_holds enable row level security;
revoke all on public.booking_holds from anon, authenticated;
grant select, insert, update, delete on public.booking_holds to service_role;

drop policy if exists "pipeline_texts_server_only" on public.site_settings;
create policy "pipeline_texts_server_only" on public.site_settings
  as restrictive for all to authenticated, anon
  using (key <> 'pipeline_texts')
  with check (key <> 'pipeline_texts');
