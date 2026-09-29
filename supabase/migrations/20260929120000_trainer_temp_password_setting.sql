-- Joshua 2026-09-29: the office sets (and can change any time) the ONE temporary password that new trainer logins get.
-- A Super Admin types it in Portal Access; api/ensure-trainer-user.js saves it here. It is kept encrypted in the
-- Supabase vault, never in code, never shown back. Shape: capital first, "!" last, no spaces, 8+ characters.
-- Only the server (service_role) can call these functions. See DO-NOT-BREAK rule 136.
create table if not exists private.trainer_temp_password_setting (
  id smallint primary key default 1 check (id = 1),
  secret_id uuid not null,
  set_by uuid references auth.users(id) on delete set null,
  set_by_name text,
  updated_at timestamptz not null default now()
);
revoke all on private.trainer_temp_password_setting from public, anon, authenticated;

create or replace function public.ldtt_store_trainer_temp_password(p_password text, p_actor uuid default null, p_actor_name text default null)
returns jsonb language plpgsql security definer set search_path = public, vault, pg_catalog as $$
declare
  existing private.trainer_temp_password_setting;
  next_secret uuid;
  result private.trainer_temp_password_setting;
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
  if p_password is null or p_password !~ '^[A-Z][^[:space:]]{6,}!$' then
    raise exception 'The temporary password must start with a capital letter, end with !, have no spaces and be at least 8 characters.';
  end if;
  select * into existing from private.trainer_temp_password_setting where id = 1;
  if existing.secret_id is null then
    next_secret := vault.create_secret(p_password, 'ldtt_trainer_temp_password', 'Temporary password for new trainer logins (set by the office)');
  else
    next_secret := existing.secret_id;
    perform vault.update_secret(existing.secret_id, p_password, 'ldtt_trainer_temp_password', 'Temporary password for new trainer logins (set by the office)');
  end if;
  insert into private.trainer_temp_password_setting (id, secret_id, set_by, set_by_name, updated_at)
  values (1, next_secret, p_actor, left(nullif(trim(coalesce(p_actor_name, '')), ''), 120), now())
  on conflict (id) do update set secret_id = excluded.secret_id, set_by = excluded.set_by, set_by_name = excluded.set_by_name, updated_at = now()
  returning * into result;
  return jsonb_build_object('is_set', true, 'updated_at', result.updated_at, 'set_by_name', result.set_by_name);
end; $$;

create or replace function public.ldtt_read_trainer_temp_password()
returns text language sql security definer set search_path = public, vault, pg_catalog as $$
  select ds.decrypted_secret
  from private.trainer_temp_password_setting s
  join vault.decrypted_secrets ds on ds.id = s.secret_id
  where s.id = 1 and auth.role() = 'service_role'
  limit 1;
$$;

-- Status only (never the password): is one set, when, and by whom.
create or replace function public.ldtt_trainer_temp_password_status()
returns jsonb language sql security definer set search_path = public, pg_catalog as $$
  select case when auth.role() <> 'service_role' then null else coalesce(
    (select jsonb_build_object('is_set', true, 'updated_at', s.updated_at, 'set_by_name', s.set_by_name)
       from private.trainer_temp_password_setting s where s.id = 1),
    jsonb_build_object('is_set', false)) end;
$$;

revoke all on function public.ldtt_store_trainer_temp_password(text, uuid, text) from public, anon, authenticated;
revoke all on function public.ldtt_read_trainer_temp_password() from public, anon, authenticated;
revoke all on function public.ldtt_trainer_temp_password_status() from public, anon, authenticated;
grant execute on function public.ldtt_store_trainer_temp_password(text, uuid, text) to service_role;
grant execute on function public.ldtt_read_trainer_temp_password() to service_role;
grant execute on function public.ldtt_trainer_temp_password_status() to service_role;
