alter table public.portal_users
  add column if not exists email text,
  add column if not exists permission_level text,
  add column if not exists access_status text not null default 'active',
  add column if not exists disabled_at timestamptz,
  add column if not exists disabled_by uuid references auth.users(id) on delete set null;

update public.portal_users portal
set email = auth_user.email
from auth.users auth_user
where portal.user_id = auth_user.id
  and portal.email is null;

update public.portal_users
set permission_level = case when role = 'admin' then 'super_admin' else 'trainer' end
where permission_level is null;

alter table public.portal_users
  alter column permission_level set default 'trainer',
  alter column permission_level set not null;

alter table public.portal_users drop constraint if exists portal_users_permission_level_check;
alter table public.portal_users add constraint portal_users_permission_level_check
  check (permission_level in ('super_admin', 'office_admin', 'trainer'));

alter table public.portal_users drop constraint if exists portal_users_access_status_check;
alter table public.portal_users add constraint portal_users_access_status_check
  check (access_status in ('active', 'disabled', 'revoked', 'profile_only', 'not_created'));
