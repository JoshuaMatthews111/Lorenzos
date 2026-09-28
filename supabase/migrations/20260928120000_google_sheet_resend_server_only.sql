-- Applied to live 2026-09-28 as google_sheet_resend_server_only_2026_09_28. See DO-NOT-BREAK rule 128.
drop policy if exists "google_sheet_resend_server_only" on public.site_settings;
create policy "google_sheet_resend_server_only" on public.site_settings
  as restrictive for all to authenticated, anon
  using (key <> 'google_sheet_resend') with check (key <> 'google_sheet_resend');
drop policy if exists "google_sheet_resend_server_only" on practice.site_settings;
create policy "google_sheet_resend_server_only" on practice.site_settings
  as restrictive for all to authenticated, anon
  using (key <> 'google_sheet_resend') with check (key <> 'google_sheet_resend');
insert into public.site_settings (key, value)
values ('google_sheet_resend', '{"armed": false, "mode": "dry", "note": "Built 2026-09-28. Disarmed. Dry run first, then send."}'::jsonb)
on conflict (key) do nothing;
