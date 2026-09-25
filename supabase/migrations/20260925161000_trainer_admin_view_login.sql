-- Applied to live 2026-09-25 as trainer_admin_view_login_2026_09_25. See DO-NOT-BREAK rule 115.
insert into public.trainers (slug, full_name, status, access_status, market, state)
values ('trainer-admin', 'Trainer Admin', 'inactive', 'active', null, null)
on conflict (slug) do nothing;
update public.portal_users
set trainer_id = (select id from public.trainers where slug = 'trainer-admin'),
    display_name = 'Trainer Admin', first_name = 'Trainer', last_name = 'Admin', updated_at = now()
where email = 'trainer-demo@lorenzosdogtrainingteam.com' and role = 'trainer';
