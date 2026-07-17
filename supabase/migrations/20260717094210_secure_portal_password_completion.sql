drop policy if exists "portal_user_updates_own_password_flag" on public.portal_users;

create or replace function public.complete_portal_password_change()
returns void
language sql
security definer
set search_path = public, auth
as $$
  update public.portal_users
  set must_change_password = false,
      last_login_at = now()
  where user_id = (select auth.uid())
    and active;
$$;

revoke all on function public.complete_portal_password_change() from public, anon;
grant execute on function public.complete_portal_password_change() to authenticated;
