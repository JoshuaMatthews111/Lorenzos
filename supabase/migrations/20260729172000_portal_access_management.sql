alter table public.portal_users
  add column if not exists email text,
  add column if not exists permission_level text,
  add column if not exists profile_photo_url text,
  add column if not exists access_status text not null default 'active',
  add column if not exists disabled_at timestamptz,
  add column if not exists disabled_by uuid references auth.users(id);

alter table public.portal_users
  drop constraint if exists portal_users_permission_level_check;

alter table public.portal_users
  add constraint portal_users_permission_level_check
  check (permission_level is null or permission_level in ('super_admin','office_admin','trainer'));

alter table public.portal_users
  drop constraint if exists portal_users_access_status_check;

alter table public.portal_users
  add constraint portal_users_access_status_check
  check (access_status in ('active','disabled','revoked','not_created','profile_only'));

update public.portal_users
set permission_level = case
    when role = 'trainer' then 'trainer'
    when permission_level is null then 'super_admin'
    else permission_level
  end,
  access_status = case
    when active then coalesce(nullif(access_status, ''), 'active')
    else 'disabled'
  end
where permission_level is null
   or access_status is null
   or access_status = '';

create or replace function private.is_active_portal_user()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.portal_users pu
    left join public.trainers t on t.id = pu.trainer_id
    where pu.user_id = (select auth.uid())
      and pu.active
      and coalesce(pu.access_status, 'active') = 'active'
      and (pu.role = 'admin' or coalesce(t.access_status, 'disabled') = 'active')
  );
$$;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.portal_users
    where user_id = (select auth.uid())
      and role = 'admin'
      and active
      and coalesce(access_status, 'active') = 'active'
  );
$$;

create or replace function private.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.portal_users
    where user_id = (select auth.uid())
      and role = 'admin'
      and active
      and coalesce(access_status, 'active') = 'active'
      and coalesce(permission_level, 'super_admin') = 'super_admin'
  );
$$;

revoke all on function private.is_super_admin() from public, anon;
grant execute on function private.is_super_admin() to authenticated, service_role;

grant update (display_name, profile_photo_url, updated_at) on public.portal_users to authenticated;

drop policy if exists "portal_user_updates_own_profile" on public.portal_users;
create policy "portal_user_updates_own_profile"
on public.portal_users
for update to authenticated
using (
  user_id = (select auth.uid())
  and active
  and coalesce(access_status, 'active') = 'active'
)
with check (
  user_id = (select auth.uid())
  and active
  and coalesce(access_status, 'active') = 'active'
);

drop policy if exists "portal_users_upload_own_profile_photo" on storage.objects;
create policy "portal_users_upload_own_profile_photo"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'trainer-page-assets'
  and split_part(name, '/', 1) = 'portal-users'
  and split_part(name, '/', 2) = (select auth.uid())::text
  and private.is_active_portal_user()
);

drop policy if exists "portal_users_update_own_profile_photo" on storage.objects;
create policy "portal_users_update_own_profile_photo"
on storage.objects for update to authenticated
using (
  bucket_id = 'trainer-page-assets'
  and split_part(name, '/', 1) = 'portal-users'
  and split_part(name, '/', 2) = (select auth.uid())::text
  and private.is_active_portal_user()
)
with check (
  bucket_id = 'trainer-page-assets'
  and split_part(name, '/', 1) = 'portal-users'
  and split_part(name, '/', 2) = (select auth.uid())::text
  and private.is_active_portal_user()
);
