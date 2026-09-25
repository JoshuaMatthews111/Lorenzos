-- Rule 105 (2026-09-25, Joshua, from the owner's chart "Hierarchy - 9-23-26"): the trainer hierarchy.
-- One site_settings row, key "trainer_hierarchy", in BOTH schemas (public = live, practice = the practice copy):
--   { owner_slug, updated_from, nodes: [{ slug, parent_slug, rank }] }
-- 31 nodes = the owner (lorenzo-miller, parent null, rank "owner") + the 30 people on the chart. Every slug was
-- checked read-only on 2026-09-25 to exist in BOTH public.trainers and practice.trainers (same ids); none left out.
-- lib/hierarchy.js validateTree() passes on this exact value (tests/trainer-hierarchy.test.mjs parses this file).
--
-- SERVER ONLY, same restrictive pattern as pipeline_texts_server_only (rule 84) and reengage_batch_server_only
-- (rule 101): the "admin_all" policy would otherwise let any office login read or rewrite the chart from the
-- browser. The chart is read by api/trainer-lead-action.js with the service role; the browser only ever gets
-- what that API returns (the caller's own upline and downline, or the whole tree for the owner).
--
-- The policy is created BEFORE the row is written, so the row is never browser-readable, even for a moment.
-- on_conflict keeps it re-runnable. Undo:
--   delete from public.site_settings where key = 'trainer_hierarchy'; (same for practice)
--   drop policy "trainer_hierarchy_server_only" on public.site_settings; (same for practice)
drop policy if exists "trainer_hierarchy_server_only" on public.site_settings;
create policy "trainer_hierarchy_server_only" on public.site_settings
  as restrictive for all to authenticated, anon
  using (key <> 'trainer_hierarchy')
  with check (key <> 'trainer_hierarchy');
drop policy if exists "trainer_hierarchy_server_only" on practice.site_settings;
create policy "trainer_hierarchy_server_only" on practice.site_settings
  as restrictive for all to authenticated, anon
  using (key <> 'trainer_hierarchy')
  with check (key <> 'trainer_hierarchy');

insert into public.site_settings (key, value, updated_by, updated_at)
values ('trainer_hierarchy', $chart${
  "owner_slug": "lorenzo-miller",
  "updated_from": "Hierarchy - 9-23-26",
  "nodes": [
    {"slug":"lorenzo-miller","parent_slug":null,"rank":"owner"},
    {"slug":"john-delbane","parent_slug":"lorenzo-miller","rank":"senior_vice_president"},
    {"slug":"emilio-marotta","parent_slug":"john-delbane","rank":"senior_vice_president"},
    {"slug":"shavon-striggles","parent_slug":"emilio-marotta","rank":"regional_director"},
    {"slug":"daniel-bainbridge","parent_slug":"shavon-striggles","rank":"master_trainer"},
    {"slug":"robert-wesling","parent_slug":"shavon-striggles","rank":"team_coordinator"},
    {"slug":"eric-hardaway","parent_slug":"shavon-striggles","rank":"team_coordinator"},
    {"slug":"tristan-gray","parent_slug":"daniel-bainbridge","rank":"team_coordinator"},
    {"slug":"jacob-perez","parent_slug":"daniel-bainbridge","rank":"team_coordinator"},
    {"slug":"michael-king","parent_slug":"daniel-bainbridge","rank":"team_coordinator"},
    {"slug":"victoria-bayleigh-morris","parent_slug":"tristan-gray","rank":"executive_team_trainer"},
    {"slug":"bailey-brown","parent_slug":"victoria-bayleigh-morris","rank":"executive_team_trainer"},
    {"slug":"tabatha-shelley","parent_slug":"victoria-bayleigh-morris","rank":"team_trainer"},
    {"slug":"jasmine-bland","parent_slug":"bailey-brown","rank":"team_trainer"},
    {"slug":"shannon-paskins","parent_slug":"bailey-brown","rank":"team_trainer"},
    {"slug":"carolina-perez","parent_slug":"jacob-perez","rank":"team_coordinator"},
    {"slug":"giovanni-gutierrez","parent_slug":"jacob-perez","rank":"team_trainer"},
    {"slug":"sean-urena","parent_slug":"jacob-perez","rank":"team_trainer"},
    {"slug":"fred-harris","parent_slug":"carolina-perez","rank":"team_trainer"},
    {"slug":"genevieve-twilla","parent_slug":"fred-harris","rank":"team_trainer"},
    {"slug":"karemela-sefferin","parent_slug":"genevieve-twilla","rank":"team_trainer"},
    {"slug":"clark-patton","parent_slug":"michael-king","rank":"executive_team_trainer"},
    {"slug":"dylan-atkinson","parent_slug":"michael-king","rank":"team_trainer"},
    {"slug":"arion-goble","parent_slug":"michael-king","rank":"team_trainer"},
    {"slug":"christopher-almonte","parent_slug":"robert-wesling","rank":"team_trainer"},
    {"slug":"chloe-chislom","parent_slug":"robert-wesling","rank":"team_trainer"},
    {"slug":"shantelle-tuck","parent_slug":"robert-wesling","rank":"team_trainer"},
    {"slug":"aryson-whorley","parent_slug":"christopher-almonte","rank":"team_trainer"},
    {"slug":"eric-beck","parent_slug":"eric-hardaway","rank":"team_coordinator"},
    {"slug":"brady-deremer","parent_slug":"eric-beck","rank":"team_trainer"},
    {"slug":"harley-mcgrew","parent_slug":"eric-beck","rank":"team_trainer"}
  ]
}$chart$::jsonb, 'Hierarchy - 9-23-26 (Joshua 2026-09-25)', now())
on conflict (key) do update set value = excluded.value, updated_by = excluded.updated_by, updated_at = excluded.updated_at;

insert into practice.site_settings (key, value, updated_by, updated_at)
select key, value, updated_by, updated_at from public.site_settings where key = 'trainer_hierarchy'
on conflict (key) do update set value = excluded.value, updated_by = excluded.updated_by, updated_at = excluded.updated_at;
