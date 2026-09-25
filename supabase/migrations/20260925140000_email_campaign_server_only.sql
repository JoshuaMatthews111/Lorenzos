-- Angela's lead email (2026-09-25): the campaign key is SERVER ONLY in both schemas (the rule 84 / rule 101 pattern),
-- created BEFORE the row, so no browser login can arm it; only api/pipeline.js (Super Admin) and the cron's service
-- role touch it. The row ships DISARMED: armed false, no send_at, no pools. Nothing sends until a Super Admin arms it.
-- The same pattern covers office_turn_digest_log (the office's-turn daily email's once-a-day record, written only by
-- the cron). Undo: delete the two rows and drop the two policies in each schema.
drop policy if exists "email_campaign_server_only" on public.site_settings;
create policy "email_campaign_server_only" on public.site_settings
  as restrictive for all to authenticated, anon
  using (key not in ('email_campaign', 'office_turn_digest_log'))
  with check (key not in ('email_campaign', 'office_turn_digest_log'));
drop policy if exists "email_campaign_server_only" on practice.site_settings;
create policy "email_campaign_server_only" on practice.site_settings
  as restrictive for all to authenticated, anon
  using (key not in ('email_campaign', 'office_turn_digest_log'))
  with check (key not in ('email_campaign', 'office_turn_digest_log'));

insert into public.site_settings (key, value)
values ('email_campaign', '{"armed": false, "send_at": "", "pools": [], "max_age_days": null, "campaign_id": "angela_2026_09", "note": "Angela''s email, built 2026-09-25. DISARMED on purpose: Joshua picks the pools and the window from the dry run first."}'::jsonb)
on conflict (key) do nothing;
insert into practice.site_settings (key, value)
values ('email_campaign', '{"armed": false, "send_at": "", "pools": [], "max_age_days": null, "campaign_id": "angela_2026_09", "note": "Angela''s email, built 2026-09-25. DISARMED on purpose."}'::jsonb)
on conflict (key) do nothing;
