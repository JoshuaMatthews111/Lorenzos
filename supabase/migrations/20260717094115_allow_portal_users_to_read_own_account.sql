drop policy if exists "portal_user_reads_self" on public.portal_users;
create policy "portal_user_reads_self"
on public.portal_users for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "portal_user_updates_own_password_flag" on public.portal_users;
create policy "portal_user_updates_own_password_flag"
on public.portal_users for update to authenticated
using (user_id = (select auth.uid()) and active)
with check (user_id = (select auth.uid()) and active);
