-- Rule 46 database proof (pull on read). Run on a THROWAWAY Postgres built from
-- supabase/migrations (never on the real project):
--   LC_ALL=en_US.UTF-8 psql -h 127.0.0.1 -p 5499 -U postgres -d ldtt_test -f tests/practice-pull.sql
-- Re-runnable: every row it makes is marked PULLTEST / pulltest- and removed at
-- the start. Every pull asserts that live (schema public) is byte-identical
-- before and after. Ends with "ALL TESTS PASSED (25)".
\set ON_ERROR_STOP on
\pset format unaligned
\pset tuples_only on
\set QUIET on

-- ------------------------------------------------------------- clean slate
delete from practice.lead_events where lead_id in (select id from practice.leads where first_name like 'PULLTEST%');
delete from public.lead_events where lead_id in (select id from public.leads where first_name like 'PULLTEST%');
delete from practice.dogs where client_id in (select id from practice.clients where client_name like 'PULLTEST%');
delete from public.dogs where client_id in (select id from public.clients where client_name like 'PULLTEST%');
delete from practice.clients where client_name like 'PULLTEST%';
delete from public.clients where client_name like 'PULLTEST%';
delete from practice.office_notes where note like 'PULLTEST%';
delete from public.office_notes where note like 'PULLTEST%';
delete from practice.lifecycle_events where event_key like 'pulltest%';
delete from public.lifecycle_events where event_key like 'pulltest%';
delete from practice.leads where first_name like 'PULLTEST%';
delete from public.leads where first_name like 'PULLTEST%';
delete from practice.trainer_pages where slug like 'pulltest%';
delete from public.trainer_pages where slug like 'pulltest%';
delete from practice.trainers where slug like 'pulltest%';
delete from public.trainers where slug like 'pulltest%';
alter table public.trainers drop column if exists pulltest_extra;
alter table practice.trainers drop column if exists pulltest_extra;
update practice_private.pull_settings set enabled = true, needs_seed = false, min_interval_ms = 0, reconcile_every_seconds = 0, max_rows_per_table = 1000, last_pull_at = null;
select practice_private.apply_pull_guards() is not null;
select practice_private.seed_pull_ledger(now()) is not null;
delete from practice_private.pull_log;

create or replace function pg_temp.assert(cond boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(cond, false) then raise exception 'ASSERT FAILED: %', msg; end if;
  raise notice 'ok: %', msg;
end $$;

-- A fingerprint of every live table the pull reads.
create or replace function pg_temp.live_fingerprint() returns text language plpgsql as $$
declare t text; k text; h text; acc text := '';
begin
  foreach t in array practice_private.pull_table_order() loop
    k := practice_private.pull_pk_column(t);
    if k is null then continue; end if;
    execute format('select md5(coalesce(string_agg(to_jsonb(x)::text, '''' order by x.%I::text), '''')) from public.%I x', k, t) into h;
    acc := acc || t || ':' || h || ';';
  end loop;
  return md5(acc);
end $$;

create or replace function pg_temp.pull() returns jsonb language plpgsql as $$
declare before text; r jsonb;
begin
  before := pg_temp.live_fingerprint();
  update practice_private.pull_settings set last_pull_at = null;
  r := practice.pull_from_live();
  if pg_temp.live_fingerprint() is distinct from before then raise exception 'ASSERT FAILED: a pull changed live'; end if;
  return r;
end $$;

select (pg_temp.pull() ->> 'ok')::boolean as baseline_ok \gset
select pg_temp.assert(:'baseline_ok'::boolean, 'T0 baseline pull is ok and leaves live byte-identical');

-- Allowed event types (both tables carry check constraints).
select coalesce((select (regexp_match(pg_get_constraintdef(c.oid), '''([a-z_]+)'''))[1] from pg_constraint c
                 where c.conrelid = 'public.lifecycle_events'::regclass and c.contype = 'c' and pg_get_constraintdef(c.oid) like '%event_type%' limit 1), 'lead_created') as lc_type \gset
select coalesce((select (regexp_match(pg_get_constraintdef(c.oid), '''([a-z_]+)'''))[1] from pg_constraint c
                 where c.conrelid = 'public.lead_events'::regclass and c.contype = 'c' and pg_get_constraintdef(c.oid) like '%event_type%' limit 1), 'status_changed') as le_type \gset

-- ------------------------------------------------------------- T1-T6 leads
select gen_random_uuid() as l1 \gset
insert into public.leads (id, first_name, last_name, email, phone, status) values (:'l1', 'PULLTEST', 'One', 'p1@example.com', '4405550001', 'new_inquiry');
select pg_temp.pull() is not null;
select pg_temp.assert((select to_jsonb(p) from practice.leads p where id = :'l1') = (select to_jsonb(l) from public.leads l where id = :'l1'), 'T1 a new live lead arrives byte-identical (practice triggers stayed quiet)');
select pg_temp.assert(exists (select 1 from practice_private.pull_ledger where tbl = 'leads' and pk = :'l1'), 'T1 ledger row written');

update public.leads set status = 'office_contacted' where id = :'l1';
select pg_temp.pull() is not null;
select pg_temp.assert((select status from practice.leads where id = :'l1') = 'office_contacted', 'T2 a live status change arrives');
select pg_temp.assert((select version from practice.leads where id = :'l1') = (select version from public.leads where id = :'l1'), 'T2 version equal after the pull');

update practice.leads set comments = 'PULLTEST team edit' where id = :'l1';
select pg_temp.pull() is not null;
select pg_temp.pull() is not null;
select pg_temp.assert((select comments from practice.leads where id = :'l1') = 'PULLTEST team edit', 'T3 a team edit survives while live is quiet');
select pg_temp.assert((practice.pull_status() ->> 'practice_edited')::int >= 1, 'T3 status counts the team edit');

update public.leads set phone = '4405559999' where id = :'l1';
select pg_temp.pull() is not null;
select pg_temp.assert((select phone from practice.leads where id = :'l1') = '4405559999' and (select comments from practice.leads where id = :'l1') is null, 'T4 live wins on an office row live changed');
select pg_temp.assert(exists (select 1 from practice_private.pull_log where action = 'live_replaced_practice_edit' and pk = :'l1' and detail -> 'practice_row' ->> 'comments' = 'PULLTEST team edit'), 'T4 the replaced team row is saved in pull_log');

select gen_random_uuid() as l2 \gset
insert into practice.leads (id, first_name, last_name, email, phone, status) values (:'l2', 'PULLTEST', 'PracticeOnly', 'p2@example.com', '4405550002', 'new_inquiry');
select pg_temp.pull() is not null;
select pg_temp.assert(exists (select 1 from practice.leads where id = :'l2'), 'T5 a team-created lead is untouched');

delete from public.leads where id = :'l1';
select pg_temp.pull() is not null;
select pg_temp.assert(not exists (select 1 from practice.leads where id = :'l1'), 'T6 a live delete is mirrored');
select pg_temp.assert(exists (select 1 from practice_private.pull_log where action = 'live_deleted' and pk = :'l1'), 'T6 the deleted practice row is logged first');
select pg_temp.assert(exists (select 1 from practice.leads where id = :'l2'), 'T6 the team-created lead survives the delete pass');

-- ------------------------------------------------------------- T7 notes
select gen_random_uuid() as l3 \gset
select gen_random_uuid() as n1 \gset
insert into public.leads (id, first_name, last_name, email, phone, status) values (:'l3', 'PULLTEST', 'NoteOwner', 'p3@example.com', '4405550003', 'new_inquiry');
insert into public.office_notes (id, entity_type, entity_id, note) values (:'n1', 'lead', :'l3', 'PULLTEST a live note');
select pg_temp.pull() is not null;
select pg_temp.assert((select count(*) from practice.office_note_revisions where office_note_id = :'n1') = (select count(*) from public.office_note_revisions where office_note_id = :'n1'), 'T7 note revisions come from live only (no duplicate from a practice trigger)');

-- ------------------------------------------------------------- T8, T9, T11 switches
update practice_private.pull_settings set enabled = false;
select pg_temp.assert((practice.pull_from_live() ->> 'reason') = 'disabled', 'T8 the kill switch answers disabled');
update practice_private.pull_settings set enabled = true;

drop trigger if exists set_leads_updated_at on practice.leads;
create trigger set_leads_updated_at before update on practice.leads for each row execute function practice.set_updated_at();
select pg_temp.assert(practice_private.pull_guards_missing() = 1, 'T9 setup: one practice trigger lost its guard');
select pg_temp.assert((pg_temp.pull() ->> 'ok')::boolean, 'T9 the pull heals it and still succeeds (no Reset needed)');
select pg_temp.assert(practice_private.pull_guards_missing() = 0 and exists (select 1 from practice_private.pull_log where action = 'guards_reapplied'), 'T9 guard re-applied and logged');

update practice_private.pull_settings set min_interval_ms = 60000, last_pull_at = clock_timestamp();
select pg_temp.assert((practice.pull_from_live() ->> 'reason') = 'fresh', 'T11 a back-to-back call answers fresh');
update practice_private.pull_state set last_error = 'simulated', last_ok_at = now() - interval '5 minutes' where tbl = 'leads';
select practice.pull_from_live() as fresh_after_fail \gset
select pg_temp.assert((:'fresh_after_fail'::jsonb ->> 'ok')::boolean = false and (:'fresh_after_fail'::jsonb ->> 'last_ok_at')::timestamptz < now() - interval '4 minutes', 'T18 fresh after a failure reports not-ok and the real last-matched time (not now)');
update practice_private.pull_settings set min_interval_ms = 0;
select pg_temp.pull() as good_after_fail \gset
select pg_temp.assert((:'good_after_fail'::jsonb ->> 'ok')::boolean, 'T18 the next good pull reports ok: ' || (:'good_after_fail'::jsonb - 'per_table')::text);
select pg_temp.assert(not exists (select 1 from practice_private.pull_state where last_error is not null), 'T18 and no table is left marked failing: ' || coalesce((select string_agg(tbl || '=' || last_error, '; ') from practice_private.pull_state where last_error is not null), ''));

-- ------------------------------------------------------------- T10, T20, T23 page work
select gen_random_uuid() as t1 \gset
insert into public.trainers (id, slug, full_name, email) values (:'t1', 'pulltest-live-trainer', 'PULLTEST Live Trainer', 'plt@example.com');
select pg_temp.pull() is not null;
select pg_temp.assert(exists (select 1 from practice.trainers where id = :'t1'), 'T10 a new live trainer arrives');
update practice.trainers set bio = 'PULLTEST practice bio' where id = :'t1';
update public.trainers set bio = 'PULLTEST live bio' where id = :'t1';
select pg_temp.pull() is not null;
select pg_temp.assert((select bio from practice.trainers where id = :'t1') = 'PULLTEST practice bio', 'T10 page work: the team edit wins when both copies changed');

select gen_random_uuid() as t2 \gset
insert into public.trainers (id, slug, full_name, email) values (:'t2', 'pulltest-column-trainer', 'PULLTEST Column Trainer', 'pct@example.com');
select pg_temp.pull() is not null;
alter table public.trainers add column pulltest_extra text;
alter table practice.trainers add column pulltest_extra text;
update public.trainers set bio = 'PULLTEST after new column' where id = :'t2';
select pg_temp.pull() is not null;
select pg_temp.assert((select bio from practice.trainers where id = :'t2') = 'PULLTEST after new column', 'T20 a column added to both copies does not make untouched rows look team-edited');
alter table public.trainers drop column pulltest_extra;
alter table practice.trainers drop column pulltest_extra;

delete from practice.trainers where id = :'t2';
update public.trainers set bio = 'PULLTEST live edit after team delete' where id = :'t2';
select pg_temp.pull() is not null;
select pg_temp.assert(not exists (select 1 from practice.trainers where id = :'t2'), 'T23 page work the team deleted is not brought back by a live edit');

-- ------------------------------------------------------------- T14-T16 clashes
select gen_random_uuid() as ta \gset
select gen_random_uuid() as tb \gset
select gen_random_uuid() as l4 \gset
insert into practice.trainers (id, slug, full_name, email) values (:'ta', 'pulltest-clash', 'PULLTEST Team Trainer', 'pta@example.com');
insert into public.trainers (id, slug, full_name, email) values (:'tb', 'pulltest-clash', 'PULLTEST Live Trainer B', 'ptb@example.com');
insert into public.leads (id, first_name, last_name, email, phone, status, trainer_id) values (:'l4', 'PULLTEST', 'ForTrainerB', 'p4@example.com', '4405550004', 'new_inquiry', :'tb');
select pg_temp.pull() is not null;
select pg_temp.assert((select slug from practice.trainers where id = :'tb') = 'pulltest-clash', 'T14 the live trainer arrives despite a slug clash');
select pg_temp.assert((select slug from practice.trainers where id = :'ta') like 'pulltest-clash-practice-%', 'T14 the team trainer keeps its row with a -practice- slug');
select pg_temp.assert(exists (select 1 from practice.leads where id = :'l4'), 'T14 the live lead for that trainer arrives too (no knock-on block)');

select gen_random_uuid() as l5 \gset
select gen_random_uuid() as cp \gset
select gen_random_uuid() as cl \gset
select gen_random_uuid() as c3 \gset
insert into public.leads (id, first_name, last_name, email, phone, status) values (:'l5', 'PULLTEST', 'Converted', 'p5@example.com', '4405550005', 'new_inquiry');
select pg_temp.pull() is not null;
insert into practice.clients (id, client_name, lead_id) values (:'cp', 'PULLTEST team client', :'l5');
insert into public.clients (id, client_name, lead_id) values (:'cl', 'PULLTEST live client', :'l5');
insert into public.clients (id, client_name) values (:'c3', 'PULLTEST unrelated client');
select pg_temp.pull() is not null;
select pg_temp.assert(exists (select 1 from practice.clients where id = :'cl') and exists (select 1 from practice.clients where id = :'c3'), 'T15 the live client and an unrelated live client both arrive');
select pg_temp.assert(not exists (select 1 from practice.clients where id = :'cp') and exists (select 1 from practice_private.pull_log where action = 'live_replaced_clashing_practice_row' and pk = :'cp'), 'T15 office clash on a non-text key: live wins, the team row is logged');

select gen_random_uuid() as ep \gset
select gen_random_uuid() as el \gset
insert into practice.lifecycle_events (id, event_key, entity_type, entity_id, event_type) values (:'ep', 'pulltest-key-1', 'lead', :'l5', :'lc_type');
insert into public.lifecycle_events (id, event_key, entity_type, entity_id, event_type) values (:'el', 'pulltest-key-1', 'lead', :'l5', :'lc_type');
select pg_temp.pull() is not null;
select pg_temp.assert(exists (select 1 from practice.lifecycle_events where id = :'el' and event_key = 'pulltest-key-1'), 'T16 the live lifecycle event arrives despite an event_key clash');
select pg_temp.assert((select event_key from practice.lifecycle_events where id = :'ep') like 'pulltest-key-1-practice-%', 'T16 the team event is kept under a renamed key');

-- ------------------------------------------------------------- T17, T25 missing parent
select gen_random_uuid() as l6 \gset
select gen_random_uuid() as e1 \gset
select gen_random_uuid() as e2 \gset
insert into public.leads (id, first_name, last_name, email, phone, status) values (:'l6', 'PULLTEST', 'TeamDeleted', 'p6@example.com', '4405550006', 'new_inquiry');
select pg_temp.pull() is not null;
delete from practice.leads where id = :'l6';
insert into public.lead_events (id, lead_id, event_type) values (:'e1', :'l6', :'le_type');
insert into public.lead_events (id, lead_id, event_type) values (:'e2', :'l5', :'le_type');
select pg_temp.pull() as after_missing_parent \gset
select pg_temp.assert(exists (select 1 from practice.lead_events where id = :'e2'), 'T17 an unrelated live child row still arrives');
select pg_temp.assert(exists (select 1 from practice_private.pull_skips where tbl = 'lead_events' and pk = :'e1' and reason like 'parent_missing%'), 'T17 the orphan is held back, not blocking');
select pg_temp.assert((:'after_missing_parent'::jsonb ->> 'ok')::boolean and (:'after_missing_parent'::jsonb ->> 'skipped')::int >= 1, 'T17 the status says ok with held-back rows counted');
update public.leads set status = 'office_contacted' where id = :'l6';
select pg_temp.pull() is not null;
select pg_temp.pull() is not null;
select pg_temp.assert(exists (select 1 from practice.leads where id = :'l6') and exists (select 1 from practice.lead_events where id = :'e1'), 'T25 when live changes the parent it returns, and the held-back child follows on the next reconcile');
select pg_temp.assert(not exists (select 1 from practice_private.pull_skips where pk = :'e1'), 'T25 the hold is cleared');

-- ------------------------------------------------------------- T21 created_at-only table
select gen_random_uuid() as d1 \gset
select column_name as dogcol from information_schema.columns where table_schema = 'public' and table_name = 'dogs' and data_type = 'text' order by ordinal_position limit 1 \gset
insert into public.dogs (id, client_id) values (:'d1', :'c3');
update public.dogs set :"dogcol" = 'Rex' where id = :'d1';
select pg_temp.pull() is not null;
update public.dogs set :"dogcol" = 'Max' where id = :'d1';
select pg_temp.pull() is not null;
select pg_temp.assert((select to_jsonb(d) ->> :'dogcol' from practice.dogs d where id = :'d1') = 'Max', 'T21 a live edit to a table without updated_at arrives on reconcile');

-- ------------------------------------------------------------- T22 team children keep a live-deleted parent
select gen_random_uuid() as l7 \gset
select gen_random_uuid() as et \gset
insert into public.leads (id, first_name, last_name, email, phone, status) values (:'l7', 'PULLTEST', 'ParentWithTeamChild', 'p7@example.com', '4405550007', 'new_inquiry');
select pg_temp.pull() is not null;
insert into practice.lead_events (id, lead_id, event_type) values (:'et', :'l7', :'le_type');
delete from public.leads where id = :'l7';
select pg_temp.pull() is not null;
select pg_temp.assert(exists (select 1 from practice.leads where id = :'l7') and exists (select 1 from practice.lead_events where id = :'et'), 'T22 a live delete never takes the team''s practice rows with it');
select pg_temp.assert(exists (select 1 from practice_private.pull_log where action = 'live_deleted_kept_for_team_rows' and pk = :'l7'), 'T22 the kept parent is logged');

-- ------------------------------------------------------------- T24 capped catch-up still makes progress
update practice_private.pull_settings set max_rows_per_table = 2;
insert into public.leads (first_name, last_name, email, phone, status)
select 'PULLTEST', 'Batch' || g, 'batch' || g || '@example.com', '44055510' || lpad(g::text, 2, '0'), 'new_inquiry' from generate_series(1, 5) g;
select pg_temp.pull() is not null;
select pg_temp.pull() is not null;
select pg_temp.pull() is not null;
select pg_temp.assert((select count(*) from practice.leads where first_name = 'PULLTEST' and last_name like 'Batch%') = 5, 'T24 a capped pull (2 rows per table) still copies all 5 over three pulls');
update practice_private.pull_settings set max_rows_per_table = 1000;

-- ------------------------------------------------------------- T19 structure sync
select practice.sync_structure_from_live() is not null;
select pg_temp.assert((pg_temp.pull() ->> 'ok')::boolean and practice_private.pull_guards_missing() = 0, 'T19 a structure re-sync drops the guards; the next pull puts them back by itself');

-- ------------------------------------------------------------- T12, T13 reset + testing logins
insert into auth.users (id, email) values ('66666666-6666-6666-6666-666666666666', 'superadmin@lorenzosdogtrainingteam.com') on conflict do nothing;
insert into public.portal_users (user_id, email, role, active, access_status) values ('66666666-6666-6666-6666-666666666666', 'superadmin@lorenzosdogtrainingteam.com', 'admin', false, 'disabled') on conflict (user_id) do update set active = false, access_status = 'disabled';
insert into practice.portal_users (user_id, email, role, active, access_status) values ('66666666-6666-6666-6666-666666666666', 'superadmin@lorenzosdogtrainingteam.com', 'admin', true, 'active') on conflict (user_id) do update set active = true, access_status = 'active';
update public.portal_users set display_name = 'PULLTEST poke' where user_id = '66666666-6666-6666-6666-666666666666';
select pg_temp.pull() is not null;
select pg_temp.assert((select active from practice.portal_users where user_id = '66666666-6666-6666-6666-666666666666'), 'T13 the practice testing login stays on while live has it off');

select (practice.reset_from_live_by('Test Person', 'test@example.com') ->> 'pull_ledger_seeds_on_next_pull')::boolean as reset_ok \gset
select pg_temp.assert(:'reset_ok'::boolean and (select needs_seed from practice_private.pull_settings where id), 'T12 a Reset asks the next pull to seed (keeps the Reset call short)');
select pg_temp.assert(practice_private.pull_guards_missing() = 0, 'T12 guards are back right after the Reset');
select pg_temp.assert((select active from practice.portal_users where user_id = '66666666-6666-6666-6666-666666666666'), 'T13 the Reset switches the practice testing login back on');
select pg_temp.assert((pg_temp.pull() ->> 'reason') = 'seeded', 'T12 the first pull after a Reset seeds the ledger');
select pg_temp.assert(jsonb_array_length(pg_temp.pull() -> 'changed') = 0, 'T12 the pull after that changes nothing');

-- ------------------------------------------------------------- tidy up
delete from public.lead_events where lead_id in (select id from public.leads where first_name like 'PULLTEST%');
delete from public.dogs where client_id in (select id from public.clients where client_name like 'PULLTEST%');
delete from public.clients where client_name like 'PULLTEST%';
delete from public.office_notes where note like 'PULLTEST%';
delete from public.lifecycle_events where event_key like 'pulltest%';
delete from public.leads where first_name like 'PULLTEST%';
delete from public.trainers where slug like 'pulltest%';
update practice_private.pull_settings set min_interval_ms = 2000, reconcile_every_seconds = 600, last_pull_at = null;
select pg_temp.pull() is not null;
select 'ALL TESTS PASSED (25)';
