\set ON_ERROR_STOP on
\pset format unaligned
\pset tuples_only on
create or replace function pg_temp.assert(cond boolean, msg text) returns void language plpgsql as $$ begin if not cond then raise exception 'ASSERT FAILED: %', msg; end if; raise notice 'ok: %', msg; end $$;
create or replace function pg_temp.pub_hash(t text) returns text language plpgsql as $$ declare h text; begin execute format('select md5(coalesce(string_agg(to_jsonb(x)::text, '''' order by x.id::text), '''')) from public.%I x', t) into h; return h; end $$;
create or replace function pg_temp.pull_guarded() returns jsonb language plpgsql as $$
declare h1 text; h2 text; r jsonb; s1 bigint; s2 bigint; begin
  h1 := pg_temp.pub_hash('leads') || pg_temp.pub_hash('office_notes') || pg_temp.pub_hash('trainers') || pg_temp.pub_hash('trainer_applications');
  select n_tup_ins+n_tup_upd+n_tup_del into s1 from pg_stat_user_tables where schemaname='public' and relname='leads';
  r := practice.pull_from_live();
  h2 := pg_temp.pub_hash('leads') || pg_temp.pub_hash('office_notes') || pg_temp.pub_hash('trainers') || pg_temp.pub_hash('trainer_applications');
  select n_tup_ins+n_tup_upd+n_tup_del into s2 from pg_stat_user_tables where schemaname='public' and relname='leads';
  perform pg_temp.assert(h1 = h2, 'live rows byte-identical across a pull');
  perform pg_temp.assert(s1 = s2, 'no insert/update/delete counted on public.leads during a pull');
  return r; end $$;
update practice_private.pull_settings set min_interval_ms = 0, reconcile_every_seconds = 0;

-- T1 new live lead appears as an exact copy
insert into public.leads (id, first_name, last_name, email, phone, status) values ('11111111-1111-1111-1111-111111111111', 'Live', 'Lead', 'live@example.com', '4405551111', 'new_inquiry');
select pg_temp.pull_guarded() -> 'ok' as t1_ok;
select pg_temp.assert((select count(*) from practice.leads where id='11111111-1111-1111-1111-111111111111') = 1, 'T1 lead copied to practice');
select pg_temp.assert((select to_jsonb(p) from practice.leads p where id='11111111-1111-1111-1111-111111111111') = (select to_jsonb(l) from public.leads l where id='11111111-1111-1111-1111-111111111111'), 'T1 practice row is byte-identical to live (triggers stayed quiet)');
select pg_temp.assert(exists(select 1 from practice_private.pull_ledger where tbl='leads' and pk='11111111-1111-1111-1111-111111111111'), 'T1 ledger row written');

-- T2 live edit flows through, version stays equal
update public.leads set status = 'office_contacted' where id='11111111-1111-1111-1111-111111111111';
select pg_temp.pull_guarded() -> 'changed' as t2_changed;
select pg_temp.assert((select status from practice.leads where id='11111111-1111-1111-1111-111111111111') = 'office_contacted', 'T2 live status change reached practice');
select pg_temp.assert((select version from practice.leads where id='11111111-1111-1111-1111-111111111111') = (select version from public.leads where id='11111111-1111-1111-1111-111111111111'), 'T2 version equal after pull');

-- T3 practice edit survives while live is quiet
update practice.leads set comments = 'practice edit' where id='11111111-1111-1111-1111-111111111111';
select pg_temp.pull_guarded() -> 'ok'; select pg_temp.pull_guarded() -> 'ok';
select pg_temp.assert((select comments from practice.leads where id='11111111-1111-1111-1111-111111111111') = 'practice edit', 'T3 practice edit kept across 2 pulls');
select pg_temp.assert((practice.pull_status() ->> 'practice_edited')::int >= 1, 'T3 status counts the practice edit');

-- T4 then live changes the same row: live wins and the old practice row is logged
update public.leads set phone = '4405559999' where id='11111111-1111-1111-1111-111111111111';
select pg_temp.pull_guarded() -> 'per_table' -> 'leads' as t4;
select pg_temp.assert((select comments from practice.leads where id='11111111-1111-1111-1111-111111111111') is null, 'T4 live wins: practice edit replaced');
select pg_temp.assert((select phone from practice.leads where id='11111111-1111-1111-1111-111111111111') = '4405559999', 'T4 live phone arrived');
select pg_temp.assert(exists(select 1 from practice_private.pull_log where action='live_replaced_practice_edit' and pk='11111111-1111-1111-1111-111111111111' and detail->'practice_row'->>'comments'='practice edit'), 'T4 old practice row saved in pull_log');

-- T5 practice-created lead is never touched
insert into practice.leads (id, first_name, last_name, email, phone, status) values ('22222222-2222-2222-2222-222222222222', 'Practice', 'Only', 'p@example.com', '4405552222', 'new_inquiry');
select pg_temp.pull_guarded() -> 'ok'; select pg_temp.pull_guarded() -> 'ok';
select pg_temp.assert((select count(*) from practice.leads where id='22222222-2222-2222-2222-222222222222') = 1, 'T5 practice-created lead still there');
select pg_temp.assert((practice.pull_status() ->> 'practice_created')::int >= 1, 'T5 status counts the practice-created row');

-- T6 live delete mirrored; practice-created row untouched
delete from public.leads where id='11111111-1111-1111-1111-111111111111';
select pg_temp.pull_guarded() -> 'per_table' -> 'leads' as t6;
select pg_temp.assert((select count(*) from practice.leads where id='11111111-1111-1111-1111-111111111111') = 0, 'T6 live delete mirrored');
select pg_temp.assert((select count(*) from practice.leads where id='22222222-2222-2222-2222-222222222222') = 1, 'T6 practice-created lead survives the delete pass');

-- T7 notes: revisions come from live only, no duplicates
insert into public.leads (id, first_name, last_name, email, phone, status) values ('33333333-3333-3333-3333-333333333333', 'Note', 'Owner', 'n@example.com', '4405553333', 'new_inquiry');
insert into public.office_notes (id, entity_type, entity_id, note) values ('44444444-4444-4444-4444-444444444444', 'lead', '33333333-3333-3333-3333-333333333333', 'a live note');
select pg_temp.pull_guarded() -> 'ok';
select pg_temp.assert((select count(*) from practice.office_notes where id='44444444-4444-4444-4444-444444444444') = 1, 'T7 note copied');
select pg_temp.assert((select count(*) from practice.office_note_revisions where office_note_id='44444444-4444-4444-4444-444444444444') = (select count(*) from public.office_note_revisions where office_note_id='44444444-4444-4444-4444-444444444444'), 'T7 revision count equals live (no duplicate from practice trigger)');

-- T8 kill switch
update practice_private.pull_settings set enabled = false;
select pg_temp.assert((practice.pull_from_live() ->> 'reason') = 'disabled', 'T8 disabled switch answers disabled');
update practice_private.pull_settings set enabled = true;

-- T9 a missing guard stops the pull safely; apply_pull_guards repairs it
drop trigger set_leads_updated_at on practice.leads;
create trigger set_leads_updated_at before update on practice.leads for each row execute function practice.set_updated_at();
select pg_temp.assert((practice.pull_from_live() ->> 'reason') = 'guards_missing', 'T9 unguarded trigger refuses the pull');
select pg_temp.assert(practice_private.apply_pull_guards() = 1, 'T9 apply_pull_guards fixed exactly one trigger');
select pg_temp.assert((practice.pull_from_live() ->> 'ok')::boolean, 'T9 pull ok again');

-- T10 page-work: practice edit wins over a live edit
insert into public.trainers (id, slug, full_name, email) values ('55555555-5555-5555-5555-555555555555', 'live-trainer', 'Live Trainer', 'lt@example.com');
select pg_temp.pull_guarded() -> 'ok';
select pg_temp.assert((select count(*) from practice.trainers where id='55555555-5555-5555-5555-555555555555') = 1, 'T10 new live trainer arrived');
update practice.trainers set bio = 'practice bio' where id='55555555-5555-5555-5555-555555555555';
update public.trainers set bio = 'live bio' where id='55555555-5555-5555-5555-555555555555';
select pg_temp.pull_guarded() -> 'ok';
select pg_temp.assert((select bio from practice.trainers where id='55555555-5555-5555-5555-555555555555') = 'practice bio', 'T10 page-work: practice edit kept when both changed');

-- T11 fresh throttle
update practice_private.pull_settings set min_interval_ms = 60000;
select pg_temp.assert((practice.pull_from_live() ->> 'reason') = 'fresh', 'T11 back-to-back call answers fresh');
update practice_private.pull_settings set min_interval_ms = 0;

-- T12 reset re-seeds ledger and re-applies guards; first pull after is a no-op
select practice.reset_from_live_by('Test Person', 'test@example.com') -> 'pull_ledger_seeded' as t12_seeded;
select pg_temp.assert(practice_private.pull_guards_missing() = 0, 'T12 guards present after reset');
select pg_temp.assert((select count(*) from practice_private.pull_ledger where tbl='leads') = (select count(*) from public.leads), 'T12 ledger seeded to live lead count');
select pg_temp.assert(jsonb_array_length(pg_temp.pull_guarded() -> 'changed') = 0, 'T12 first pull after reset changes nothing');
select 'ALL TESTS PASSED' as result;
-- T13 practice-only logins: live switches them off, the pull leaves practice's rows alone
insert into auth.users (id, email) values ('66666666-6666-6666-6666-666666666666', 'superadmin@lorenzosdogtrainingteam.com') on conflict do nothing;
insert into public.portal_users (user_id, email, role, active, access_status) values ('66666666-6666-6666-6666-666666666666', 'superadmin@lorenzosdogtrainingteam.com', 'admin', false, 'disabled') on conflict do nothing;
insert into practice.portal_users (user_id, email, role, active, access_status) values ('66666666-6666-6666-6666-666666666666', 'superadmin@lorenzosdogtrainingteam.com', 'admin', true, 'active') on conflict do nothing;
select pg_temp.pull_guarded() -> 'ok';
select pg_temp.assert((select active from practice.portal_users where user_id='66666666-6666-6666-6666-666666666666'), 'T13 practice testing login stays active while live has it off');
update public.portal_users set display_name = 'poke' where user_id='66666666-6666-6666-6666-666666666666';
select pg_temp.pull_guarded() -> 'ok';
select pg_temp.assert((select active from practice.portal_users where user_id='66666666-6666-6666-6666-666666666666'), 'T13 still active after a live edit to that row');
select practice.reset_from_live_by('Test Person', 'test@example.com') -> 'pull_ledger_seeded';
select pg_temp.assert((select active from practice.portal_users where user_id='66666666-6666-6666-6666-666666666666'), 'T13 reset switches the practice testing login back on');
select 'ALL TESTS PASSED (13)' as result;
