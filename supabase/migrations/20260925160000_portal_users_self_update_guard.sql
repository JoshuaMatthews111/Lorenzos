-- Applied to live 2026-09-25 as portal_users_self_update_guard_2026_09_25. See DO-NOT-BREAK rule 114.
-- A non-admin changing their OWN portal_users row may not change role, permission_level, trainer_id, active,
-- access_status, disabled_at, disabled_by or user_id. Admins and server routes (service role) are unchanged.
create or replace function private.portal_users_self_update_guard()
returns trigger language plpgsql security definer set search_path = public, pg_catalog as $$
declare caller uuid := (select auth.uid());
begin
  if caller is null or caller <> old.user_id or private.is_admin() then return new; end if;
  if new.role is distinct from old.role or new.permission_level is distinct from old.permission_level
     or new.trainer_id is distinct from old.trainer_id or new.active is distinct from old.active
     or new.access_status is distinct from old.access_status or new.disabled_at is distinct from old.disabled_at
     or new.disabled_by is distinct from old.disabled_by or new.user_id is distinct from old.user_id then
    raise exception 'Only an admin can change portal access, role or trainer link.' using errcode = '42501';
  end if;
  return new;
end; $$;
revoke all on function private.portal_users_self_update_guard() from public, anon, authenticated;
drop trigger if exists portal_users_self_update_guard on public.portal_users;
create trigger portal_users_self_update_guard before update on public.portal_users
  for each row execute function private.portal_users_self_update_guard();
-- (the practice schema gets the same guard with practice_private.is_admin(), skipped during a practice pull)
