-- Lead form editor (portal chain step 4, 2026-09-12, DO-NOT-BREAK rule 75).
-- The forms themselves live in site_settings key 'lead_forms' (both schemas already have the table and the
-- key CHECK ^[a-z_]{1,40}$ allows it), so no table is created. The only change: the practice copy's Send to
-- live log (practice schema only; nothing in public) also accepts entity_type 'lead_forms'. Widening only:
-- every existing row ('trainer_page', 'ad_page') still passes.
alter table practice.send_to_live_log drop constraint if exists send_to_live_log_entity_type_check;
alter table practice.send_to_live_log add constraint send_to_live_log_entity_type_check
  check (entity_type = any (array['trainer_page'::text, 'ad_page'::text, 'lead_forms'::text]));
