-- GO-LIVE 2026-09-23 step 1a (Joshua): "Have you logged this lead in Alpha?" is BLANK until answered.
-- public.leads.added_to_alpha: NOT NULL default false -> nullable, no default (practice's exact shape).
-- Every stored false becomes NULL (never answered); a stored true stays true (0 true rows on 2026-09-23).
-- The UPDATE fires the increment_record_version and set_updated_at triggers on the touched rows (like the
-- 2026-09-12 base_zip fill, rule 74): version +1, updated_at now, no audit row, counts untouched (rule 1).
-- Undo: update ... set added_to_alpha = false where added_to_alpha is null;
--       alter table public.leads alter column added_to_alpha set default false;
--       alter table public.leads alter column added_to_alpha set not null;
alter table public.leads alter column added_to_alpha drop not null;
alter table public.leads alter column added_to_alpha drop default;
update public.leads set added_to_alpha = null where added_to_alpha = false;
