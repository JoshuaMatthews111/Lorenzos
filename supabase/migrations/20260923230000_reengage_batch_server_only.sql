-- Rule 101 (2026-09-23): the re-engage batch key is SERVER ONLY, both schemas. The "admin_all" policy
-- would let any office admin arm the morning blast from the browser, skipping the Super Admin check in
-- api/pipeline.js (op reengage_batch_save). Same restrictive pattern as pipeline_texts_server_only
-- (rule 84): the row is hidden from every browser login; the server's service role is not limited.
-- Undo: drop policy "reengage_batch_server_only" on public.site_settings (and practice.site_settings).
drop policy if exists "reengage_batch_server_only" on public.site_settings;
create policy "reengage_batch_server_only" on public.site_settings
  as restrictive for all to authenticated, anon
  using (key <> 'reengage_batch')
  with check (key <> 'reengage_batch');
drop policy if exists "reengage_batch_server_only" on practice.site_settings;
create policy "reengage_batch_server_only" on practice.site_settings
  as restrictive for all to authenticated, anon
  using (key <> 'reengage_batch')
  with check (key <> 'reengage_batch');
