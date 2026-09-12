-- Online booking (portal chain step 2, Joshua 2026-09-12, DO-NOT-BREAK rule 71).
-- PRACTICE COPY ONLY this round: every new route answers 404 on live, so nothing is
-- created in public. The practice pull ignores these objects (pull_table_order() only
-- lists tables that exist in public; site_settings is pull mode 'never').
--
-- 1. practice.booking_holds: a time a customer booked on /book/<trainer>. A held slot is
--    never offered again (one active hold per trainer + start time, enforced by the
--    partial unique index, so two customers racing for one slot cannot both win).
--    We NEVER book in Google; the trainer / TC reserves the time in Google themselves.
-- 2. practice.site_settings key 'booking_trainers': each trainer's Google appointment
--    schedule id, time zone, slot length, ZIP prefixes and location rule. The office can
--    change it without a deploy. lib/booking.js carries the same values as defaults, so a
--    practice Reset (which truncates practice.*) falls back to them instead of breaking.
-- Server-only: RLS on, no policies, no anon/authenticated grants (same as lead_journeys).
create table if not exists practice.booking_holds (
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
create unique index if not exists booking_holds_one_per_slot
  on practice.booking_holds (trainer_slug, slot_start) where status = 'held';
create index if not exists booking_holds_lead_idx on practice.booking_holds (lead_id);
alter table practice.booking_holds enable row level security;
revoke all on practice.booking_holds from anon, authenticated;
grant select, insert, update, delete on practice.booking_holds to service_role;

insert into practice.site_settings (key, value, updated_by)
values (
  'booking_trainers',
  '{"trainers": [
     {"slug": "lorenzo-miller", "trainer_id": "cbf54e9f-d68c-44ba-b6ad-d48549caca8e",
      "schedule_id": "AcZssZ3b031BaAFmox_APr99jWjnzvJcxoN24kB5MMdTY-Tn-trMtc7LnWzMJVfuHm15mSpr9fPLO__z",
      "time_zone": "America/New_York", "slot_minutes": 60, "zip_prefixes": ["440", "441"],
      "location_mode": "in_home_or_center", "training_center_address": "4815 Orchard Rd, Garfield Heights, OH 44128",
      "active": true},
     {"slug": "daniel-bainbridge", "trainer_id": "45875481-0bb3-420f-9add-6fdceb7efa51",
      "schedule_id": "AcZssZ0llw8VeT4lffXoEPfB9BPYO7jXo6GYg9yv6-BvCFlb8uGNHk9B06EhHums8qL5zwDDiKQSsbv3",
      "time_zone": "America/Chicago", "slot_minutes": 60, "zip_prefixes": ["325"],
      "location_mode": "in_home", "training_center_address": "",
      "active": true}
  ]}'::jsonb,
  'Claude (online booking, step 2)'
)
on conflict (key) do nothing;

notify pgrst, 'reload schema';
