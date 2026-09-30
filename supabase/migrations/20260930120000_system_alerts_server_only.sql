-- Alert bell (Zoom 2026-09-29, Angela + Lorenzo): site_settings key "system_alerts" is SERVER ONLY, both schemas.
-- It names leads, and only the 15-minute cron (lib/system-alerts.js runSystemAlerts) may write it. The portal reads
-- it through GET /api/pipeline?op=system_alerts (office staff only). Same restrictive pattern as reengage_batch.
-- Undo: drop policy "system_alerts_server_only" on public.site_settings (and practice.site_settings).
drop policy if exists "system_alerts_server_only" on public.site_settings;
create policy "system_alerts_server_only" on public.site_settings
  as restrictive for all to authenticated, anon
  using (key <> 'system_alerts')
  with check (key <> 'system_alerts');
drop policy if exists "system_alerts_server_only" on practice.site_settings;
create policy "system_alerts_server_only" on practice.site_settings
  as restrictive for all to authenticated, anon
  using (key <> 'system_alerts')
  with check (key <> 'system_alerts');
