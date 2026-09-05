-- Typed full name on every action that leaves the practice copy or wipes it.
--
-- Joshua (2026-09-05): "ask them to enter the name of who is pushing those
-- changes so it's not a surprise". The office shares logins, so the login email
-- is not enough: the person types their own full name and it is kept.
--
-- Additive only. Creates nothing in public, drops nothing. Safe to re-run.
--
--   practice.send_to_live_log.sent_by_name   who typed their name on Send to live
--   practice_private.reset_log               who reset the practice copy, and when
--   practice.reset_from_live_by(name, email) reset + one log row, in one call
--
-- The reset log lives in practice_private, NOT practice, on purpose:
-- practice.reset_from_live() truncates every table in the practice schema, so a
-- practice.reset_log would wipe its own history on every reset. practice_private
-- is the helper schema (functions only until now) and is never truncated.

alter table practice.send_to_live_log add column if not exists sent_by_name text;
comment on column practice.send_to_live_log.sent_by_name is 'Full name the sender typed in the Send to live dialog (logins are shared, so the email alone is not enough).';

create table if not exists practice_private.reset_log (
  id uuid primary key default gen_random_uuid(),
  reset_by_name text not null,
  reset_by_email text,
  reset_at timestamptz not null default now(),
  rows jsonb not null default '{}'::jsonb
);
alter table practice_private.reset_log enable row level security;
revoke all on practice_private.reset_log from public, anon, authenticated;
grant all on practice_private.reset_log to service_role;
comment on table practice_private.reset_log is 'PRACTICE COPY only. Who pressed "Reset practice copy to match live" and when. Survives the reset (practice_private is never truncated). Service role only.';

-- Reset + record who did it, in one transaction. Same guard as reset_from_live()
-- (which it calls, so the guard runs twice): service role only.
create or replace function practice.reset_from_live_by(reset_by_name text, reset_by_email text default null)
returns jsonb
language plpgsql
security definer
set search_path = practice, practice_private, pg_catalog, pg_temp
as $$
declare
  jwt_role text := coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'
  );
  who text := regexp_replace(coalesce(reset_by_name, ''), '\s+', ' ', 'g');
  result jsonb;
begin
  if not (current_user in ('postgres', 'supabase_admin') or jwt_role = 'service_role') then
    raise exception 'practice.reset_from_live_by() may only be run with the service role';
  end if;
  if array_length(string_to_array(trim(who), ' '), 1) < 2 then
    raise exception 'A full name (first and last) is required to reset the practice copy';
  end if;
  result := practice.reset_from_live();
  insert into practice_private.reset_log (reset_by_name, reset_by_email, rows)
  values (left(trim(who), 200), nullif(left(trim(coalesce(reset_by_email, '')), 254), ''), coalesce(result -> 'rows', '{}'::jsonb));
  return result || jsonb_build_object('reset_by_name', left(trim(who), 200));
end;
$$;

revoke all on function practice.reset_from_live_by(text, text) from public, anon, authenticated;
grant execute on function practice.reset_from_live_by(text, text) to service_role;
comment on function practice.reset_from_live_by(text, text) is 'Reset practice copy to match live and record who did it in practice_private.reset_log. Service role only. Never touches public.';

notify pgrst, 'reload schema';
