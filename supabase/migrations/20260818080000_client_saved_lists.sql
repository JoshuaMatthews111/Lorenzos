-- Office request: build a named list of clients once (in the Clients tab or while
-- picking people), save it, and then choose it by name when sending a message.
create table if not exists public.client_saved_lists (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 120),
  description text,
  client_ids jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists uq_client_saved_lists_name on public.client_saved_lists (lower(trim(name)));
alter table public.client_saved_lists enable row level security;
drop policy if exists client_saved_lists_deny_browser on public.client_saved_lists;
create policy client_saved_lists_deny_browser on public.client_saved_lists
  as restrictive for all to anon, authenticated using (false) with check (false);
