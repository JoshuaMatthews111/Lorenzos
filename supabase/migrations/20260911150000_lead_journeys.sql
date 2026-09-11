-- Revenue pathway TEST flow (Joshua 2026-09-11; wording: docs/revenue-pathway, Tim + Angela).
-- PRACTICE COPY ONLY. Nothing is created in public, so live is untouched, and the practice
-- pull ignores these tables (pull_table_order() only lists tables that exist in public).
-- api/lead-journey.js answers 404 on live. Server-only: RLS on, no policies, no
-- anon/authenticated grants.
create table if not exists practice.lead_journeys (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text,
  zip text,
  market_key text,
  market_name text,
  problem text,
  dog_name text,
  bite boolean not null default false,
  speed text not null default 'fast' check (speed in ('fast', 'real')),
  customer_phone text,
  trainer_phone text,
  leader_phone text,
  operations_phone text,
  primary_trainer text,
  backup_trainer text,
  leader_name text,
  assigned_trainer text,
  state text not null,
  appointment_at timestamptz,
  created_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists practice.journey_messages (
  id uuid primary key default gen_random_uuid(),
  journey_id uuid not null references practice.lead_journeys (id) on delete cascade,
  template_key text not null,
  to_role text not null,
  to_phone text,
  body text not null,
  due_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'sending', 'sent', 'failed', 'cancelled', 'skipped')),
  sent_at timestamptz,
  provider_sid text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists journey_messages_due_idx on practice.journey_messages (status, due_at);
create index if not exists journey_messages_journey_idx on practice.journey_messages (journey_id);
alter table practice.lead_journeys enable row level security;
alter table practice.journey_messages enable row level security;
revoke all on practice.lead_journeys, practice.journey_messages from anon, authenticated;
grant select, insert, update, delete on practice.lead_journeys, practice.journey_messages to service_role;
