-- Applied to live 2026-09-25 as ldtt_set_new_trainer_temp_password_2026_09_25. See DO-NOT-BREAK rule 118.
create or replace function public.ldtt_set_new_trainer_temp_password(p_user_id uuid, p_password text)
returns boolean language plpgsql security definer set search_path = public, extensions, pg_catalog as $$
begin
  if p_user_id is null or p_password is null or length(p_password) < 8 or p_password ~ '\s' then return false; end if;
  if not exists (select 1 from public.portal_users where user_id = p_user_id and role = 'trainer' and active and must_change_password = true) then return false; end if;
  if exists (select 1 from auth.users where id = p_user_id and last_sign_in_at is not null) then return false; end if;
  update auth.users set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')), updated_at = now() where id = p_user_id;
  return found;
end; $$;
revoke all on function public.ldtt_set_new_trainer_temp_password(uuid, text) from public, anon, authenticated;
grant execute on function public.ldtt_set_new_trainer_temp_password(uuid, text) to service_role;
