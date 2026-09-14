-- Rule 84 (2026-09-14): the Text messages row is SERVER ONLY. The "admin_all" policy lets every office admin
-- read and write practice.site_settings from the browser, which would skip the Super Admin check in
-- api/pipeline.js and the word checks in lib/pipeline-texts.js. This RESTRICTIVE policy hides the
-- "pipeline_texts" row from every browser login (the server uses the service role, which RLS does not limit).
-- Every other settings key (theme, navigation, pipeline settings, visit stamps) keeps working as before.
-- Practice copy only. Undo: drop policy "pipeline_texts_server_only" on practice.site_settings;
drop policy if exists "pipeline_texts_server_only" on practice.site_settings;
create policy "pipeline_texts_server_only" on practice.site_settings
  as restrictive for all to authenticated, anon
  using (key <> 'pipeline_texts')
  with check (key <> 'pipeline_texts');
