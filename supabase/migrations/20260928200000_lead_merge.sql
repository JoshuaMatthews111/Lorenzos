-- Join duplicate lead cards into ONE card (owner Joshua + office manager Missy, 2026-09-28). See DO-NOT-BREAK rules 129-133.
-- Additive only: one new server-only table in `private`, two functions per schema (public + practice), one disarmed
-- site_settings key per schema behind its own restrictive policy. No existing row, column, policy or trigger changes.
--
-- private.lead_merge_backup keeps a FULL copy of every joined card and of every child row it moved, BEFORE anything
-- moves, so a join can always be undone (ldtt_unmerge_lead). Server only: RLS on, no policy, no grant to browser roles,
-- and the `private` schema is not exposed through the REST API; only the security-definer functions below write it.
create table if not exists private.lead_merge_backup (
  id uuid primary key default gen_random_uuid(),
  db_schema text not null check (db_schema in ('public', 'practice')),
  main_id uuid not null,
  merged_id uuid not null,
  merged_at timestamptz not null default now(),
  actor jsonb not null default '{}'::jsonb,
  lead_row jsonb not null,
  children jsonb not null,
  snapshot jsonb,
  restored_at timestamptz,
  restored_by jsonb
);
create index if not exists lead_merge_backup_merged_idx on private.lead_merge_backup (db_schema, merged_id);
create index if not exists lead_merge_backup_main_idx on private.lead_merge_backup (db_schema, main_id);
alter table private.lead_merge_backup enable row level security;
revoke all on private.lead_merge_backup from public, anon, authenticated;

-- One body, written once, created in both schemas (@S@ = public | practice). Unqualified table names resolve through
-- the function's own search_path, so the practice copy's function only ever touches practice.* (DO-NOT-BREAK rule 5).
do $migration$
declare
  s text;
  merge_tpl text := $tpl$
create or replace function @S@.ldtt_merge_lead(p_main uuid, p_other uuid, p_main_version integer, p_other_version integer, p_snapshot jsonb, p_actor jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = @S@, pg_temp as $fn$
declare
  m leads%rowtype;
  o leads%rowtype;
  v_children jsonb;
  v_backup uuid;
  v_snapshot jsonb;
  v_carried jsonb;
  v_version integer;
  v_actor_id uuid;
  c_le integer := 0; c_cad integer := 0; c_deals integer := 0; c_clients integer := 0; c_holds integer := 0;
  c_notes integer := 0; c_revs integer := 0; c_life integer := 0; c_fda integer := 0; c_audit integer := 0;
begin
  if p_main is null or p_other is null or p_main = p_other then
    raise exception 'lead_merge: two different cards are needed' using errcode = '22023';
  end if;
  select * into m from leads where id = p_main for update;
  if not found then raise exception 'lead_merge: the card that stays was not found' using errcode = 'P0002'; end if;
  select * into o from leads where id = p_other for update;
  if not found then raise exception 'lead_merge: the card to join was not found (it may already be joined)' using errcode = 'P0002'; end if;
  if p_main_version is not null and m.version is distinct from p_main_version then
    raise exception 'lead_merge: the card that stays was changed by someone else (version %, expected %)', m.version, p_main_version using errcode = '40001';
  end if;
  if p_other_version is not null and o.version is distinct from p_other_version then
    raise exception 'lead_merge: the card to join was changed by someone else (version %, expected %)', o.version, p_other_version using errcode = '40001';
  end if;
  if coalesce(m.raw_payload->>'qa', '') = 'true' or coalesce(o.raw_payload->>'qa', '') = 'true' then
    raise exception 'lead_merge: test (qa) cards are never joined' using errcode = '22023';
  end if;
  if exists (select 1 from clients where lead_id = p_main) and exists (select 1 from clients where lead_id = p_other) then
    raise exception 'lead_merge: both cards have their own client record, so the office must decide which one to keep' using errcode = '22023';
  end if;

  -- (a) FULL backup of the joined card and of every child row it is about to move. Written FIRST.
  v_children := jsonb_build_object(
    'lead_events', coalesce((select jsonb_agg(to_jsonb(x)) from lead_events x where x.lead_id = p_other), '[]'::jsonb),
    'communications_alert_deliveries', coalesce((select jsonb_agg(to_jsonb(x)) from communications_alert_deliveries x where x.lead_id = p_other), '[]'::jsonb),
    'deals', coalesce((select jsonb_agg(to_jsonb(x)) from deals x where x.lead_id = p_other), '[]'::jsonb),
    'clients', coalesce((select jsonb_agg(to_jsonb(x)) from clients x where x.lead_id = p_other), '[]'::jsonb),
    'booking_holds', coalesce((select jsonb_agg(to_jsonb(x)) from booking_holds x where x.lead_id = p_other), '[]'::jsonb),
    'office_notes', coalesce((select jsonb_agg(to_jsonb(x)) from office_notes x where x.entity_type = 'lead' and x.entity_id = p_other), '[]'::jsonb),
    'office_note_revisions', coalesce((select jsonb_agg(to_jsonb(x)) from office_note_revisions x where x.entity_type = 'lead' and x.entity_id = p_other), '[]'::jsonb),
    'lifecycle_events', coalesce((select jsonb_agg(to_jsonb(x)) from lifecycle_events x where x.entity_type = 'lead' and x.entity_id = p_other::text), '[]'::jsonb),
    'form_delivery_attempts', coalesce((select jsonb_agg(to_jsonb(x)) from form_delivery_attempts x where x.entity_id = p_other::text), '[]'::jsonb),
    'audit_events', coalesce((select jsonb_agg(to_jsonb(x)) from audit_events x where x.entity_id = p_other::text), '[]'::jsonb)
  );
  insert into private.lead_merge_backup (db_schema, main_id, merged_id, actor, lead_row, children, snapshot)
  values ('@S@', p_main, p_other, coalesce(p_actor, '{}'::jsonb), to_jsonb(o), v_children, p_snapshot)
  returning id into v_backup;

  -- (b) move every child record onto the card that stays.
  update lead_events set lead_id = p_main where lead_id = p_other; get diagnostics c_le = row_count;
  update communications_alert_deliveries set lead_id = p_main where lead_id = p_other; get diagnostics c_cad = row_count;
  update deals set lead_id = p_main where lead_id = p_other; get diagnostics c_deals = row_count;
  update clients set lead_id = p_main where lead_id = p_other; get diagnostics c_clients = row_count;
  update booking_holds set lead_id = p_main where lead_id = p_other; get diagnostics c_holds = row_count;
  update office_notes set entity_id = p_main where entity_type = 'lead' and entity_id = p_other; get diagnostics c_notes = row_count;
  update office_note_revisions set entity_id = p_main where entity_type = 'lead' and entity_id = p_other; get diagnostics c_revs = row_count;
  update lifecycle_events set entity_id = p_main::text where entity_type = 'lead' and entity_id = p_other::text; get diagnostics c_life = row_count;
  update form_delivery_attempts set entity_id = p_main::text where entity_id = p_other::text; get diagnostics c_fda = row_count;
  update audit_events set entity_id = p_main::text where entity_id = p_other::text; get diagnostics c_audit = row_count;

  -- (c) the plain-words snapshot of the joined request, appended (existing merged_requests kept, and any the joined card
  -- itself carried from an earlier join come along). The card that stays keeps its own status, trainer, booking, phone
  -- and email; a field it is missing is filled from the joined card.
  v_snapshot := coalesce(p_snapshot, '{}'::jsonb) || jsonb_build_object(
    'merged_id', p_other, 'merged_at', now(), 'backup_id', v_backup,
    'moved', jsonb_build_object('lead_events', c_le, 'communications_alert_deliveries', c_cad, 'deals', c_deals, 'clients', c_clients,
      'booking_holds', c_holds, 'office_notes', c_notes, 'office_note_revisions', c_revs, 'lifecycle_events', c_life,
      'form_delivery_attempts', c_fda, 'audit_events', c_audit));
  v_carried := case when jsonb_typeof(o.raw_payload->'merged_requests') = 'array' then o.raw_payload->'merged_requests' else '[]'::jsonb end;
  update leads set
    raw_payload = coalesce(raw_payload, '{}'::jsonb) || jsonb_build_object('merged_requests',
      (case when jsonb_typeof(raw_payload->'merged_requests') = 'array' then raw_payload->'merged_requests' else '[]'::jsonb end)
      || v_carried || jsonb_build_array(v_snapshot)),
    email = coalesce(nullif(btrim(email), ''), nullif(btrim(o.email), '')),
    phone = coalesce(nullif(btrim(phone), ''), nullif(btrim(o.phone), '')),
    zip = coalesce(nullif(btrim(zip), ''), nullif(btrim(o.zip), '')),
    address_line_1 = coalesce(nullif(btrim(address_line_1), ''), nullif(btrim(o.address_line_1), '')),
    city = coalesce(nullif(btrim(city), ''), nullif(btrim(o.city), '')),
    state = coalesce(nullif(btrim(state), ''), nullif(btrim(o.state), '')),
    dog_name = coalesce(nullif(btrim(dog_name), ''), nullif(btrim(o.dog_name), '')),
    office_notes = coalesce(nullif(btrim(office_notes), ''), nullif(btrim(o.office_notes), ''))
  where id = p_main
  returning version into v_version;

  -- (d) only now the joined card itself goes (its children are already on the card that stays; the backup holds all).
  delete from leads where id = p_other;

  v_actor_id := case when coalesce(p_actor->>'id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then (p_actor->>'id')::uuid else null end;
  insert into audit_events (actor_user_id, actor_email, actor_name, action, entity_type, entity_id, summary, before_data, after_data)
  values (v_actor_id, nullif(p_actor->>'email', ''), coalesce(nullif(p_actor->>'name', ''), 'Office'), 'lead_merged', 'lead', p_main::text,
    left(format('Joined the %s request of %s %s into this card (one person, one lead).', to_char(o.created_at at time zone 'America/New_York', 'Mon DD, YYYY'), coalesce(o.first_name, ''), left(coalesce(o.last_name, ''), 1)), 1000),
    jsonb_build_object('merged_id', p_other, 'merged_status', o.status, 'merged_created_at', o.created_at, 'main_status', m.status, 'main_version', m.version, 'merged_version', o.version),
    jsonb_build_object('main_id', p_main, 'backup_id', v_backup, 'moved', v_snapshot->'moved', 'main_version', v_version));

  return jsonb_build_object('ok', true, 'main_id', p_main, 'merged_id', p_other, 'backup_id', v_backup, 'main_version', v_version, 'moved', v_snapshot->'moved');
end;
$fn$;
$tpl$;
  unmerge_tpl text := $tpl$
create or replace function @S@.ldtt_unmerge_lead(p_merged uuid, p_actor jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = @S@, pg_temp as $fn$
declare
  b private.lead_merge_backup%rowtype;
  v_carried text[];
  v_actor_id uuid;
begin
  select * into b from private.lead_merge_backup where db_schema = '@S@' and merged_id = p_merged and restored_at is null order by merged_at desc limit 1 for update;
  if not found then raise exception 'lead_unmerge: no join of that card is on file' using errcode = 'P0002'; end if;
  if exists (select 1 from leads where id = p_merged) then raise exception 'lead_unmerge: that card is already back' using errcode = '22023'; end if;
  insert into leads select * from jsonb_populate_record(null::leads, b.lead_row);
  update lead_events set lead_id = p_merged where id in (select (e->>'id')::uuid from jsonb_array_elements(b.children->'lead_events') e);
  update communications_alert_deliveries set lead_id = p_merged where id in (select (e->>'id')::uuid from jsonb_array_elements(b.children->'communications_alert_deliveries') e);
  update deals set lead_id = p_merged where id in (select (e->>'id')::uuid from jsonb_array_elements(b.children->'deals') e);
  update clients set lead_id = p_merged where id in (select (e->>'id')::uuid from jsonb_array_elements(b.children->'clients') e);
  update booking_holds set lead_id = p_merged where id in (select (e->>'id')::uuid from jsonb_array_elements(b.children->'booking_holds') e);
  update office_notes set entity_id = p_merged where id in (select (e->>'id')::uuid from jsonb_array_elements(b.children->'office_notes') e);
  update office_note_revisions set entity_id = p_merged where id in (select (e->>'id')::uuid from jsonb_array_elements(b.children->'office_note_revisions') e);
  update lifecycle_events set entity_id = p_merged::text where id in (select (e->>'id')::uuid from jsonb_array_elements(b.children->'lifecycle_events') e);
  update form_delivery_attempts set entity_id = p_merged::text where id in (select (e->>'id')::uuid from jsonb_array_elements(b.children->'form_delivery_attempts') e);
  update audit_events set entity_id = p_merged::text where id in (select (e->>'id')::uuid from jsonb_array_elements(b.children->'audit_events') e);
  v_carried := array(select x->>'merged_id' from jsonb_array_elements(case when jsonb_typeof(b.lead_row->'raw_payload'->'merged_requests') = 'array' then b.lead_row->'raw_payload'->'merged_requests' else '[]'::jsonb end) x);
  update leads set raw_payload = case
      when jsonb_typeof(raw_payload->'merged_requests') <> 'array' then raw_payload
      when exists (select 1 from jsonb_array_elements(raw_payload->'merged_requests') e where (e->>'merged_id') is distinct from p_merged::text and not coalesce((e->>'merged_id') = any(v_carried), false))
        then jsonb_set(raw_payload, '{merged_requests}', (select jsonb_agg(e) from jsonb_array_elements(raw_payload->'merged_requests') e where (e->>'merged_id') is distinct from p_merged::text and not coalesce((e->>'merged_id') = any(v_carried), false)))
      else raw_payload - 'merged_requests' end
  where id = b.main_id;
  update private.lead_merge_backup set restored_at = now(), restored_by = coalesce(p_actor, '{}'::jsonb) where id = b.id;
  v_actor_id := case when coalesce(p_actor->>'id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then (p_actor->>'id')::uuid else null end;
  insert into audit_events (actor_user_id, actor_email, actor_name, action, entity_type, entity_id, summary, before_data, after_data)
  values (v_actor_id, nullif(p_actor->>'email', ''), coalesce(nullif(p_actor->>'name', ''), 'Office'), 'lead_unmerged', 'lead', p_merged::text,
    'Put this card back from the join backup (its notes, history and messages moved back to it).',
    jsonb_build_object('main_id', b.main_id, 'backup_id', b.id), jsonb_build_object('merged_id', p_merged));
  return jsonb_build_object('ok', true, 'merged_id', p_merged, 'main_id', b.main_id, 'backup_id', b.id);
end;
$fn$;
$tpl$;
begin
  foreach s in array array['public', 'practice'] loop
    execute replace(merge_tpl, '@S@', s);
    execute replace(unmerge_tpl, '@S@', s);
    execute format('revoke all on function %I.ldtt_merge_lead(uuid, uuid, integer, integer, jsonb, jsonb) from public, anon, authenticated', s);
    execute format('revoke all on function %I.ldtt_unmerge_lead(uuid, jsonb) from public, anon, authenticated', s);
    execute format('grant execute on function %I.ldtt_merge_lead(uuid, uuid, integer, integer, jsonb, jsonb) to service_role', s);
    execute format('grant execute on function %I.ldtt_unmerge_lead(uuid, jsonb) to service_role', s);
  end loop;
end
$migration$;

-- The one-time batch switch: server only (the rule 84 / 101 / 128 pattern), created BEFORE the row, ships DISARMED.
drop policy if exists "lead_merge_batch_server_only" on public.site_settings;
create policy "lead_merge_batch_server_only" on public.site_settings
  as restrictive for all to authenticated, anon
  using (key <> 'lead_merge_batch') with check (key <> 'lead_merge_batch');
drop policy if exists "lead_merge_batch_server_only" on practice.site_settings;
create policy "lead_merge_batch_server_only" on practice.site_settings
  as restrictive for all to authenticated, anon
  using (key <> 'lead_merge_batch') with check (key <> 'lead_merge_batch');
insert into public.site_settings (key, value)
values ('lead_merge_batch', '{"armed": false, "mode": "dry", "note": "Built 2026-09-28. Disarmed. Dry run first (lists every group), then send joins them."}'::jsonb)
on conflict (key) do nothing;
insert into practice.site_settings (key, value)
values ('lead_merge_batch', '{"armed": false, "mode": "dry", "note": "Built 2026-09-28. Disarmed. Dry run first (lists every group), then send joins them."}'::jsonb)
on conflict (key) do nothing;

notify pgrst, 'reload schema';

-- Undo (only if nothing was joined yet): drop function public.ldtt_merge_lead(uuid, uuid, integer, integer, jsonb, jsonb);
-- drop function public.ldtt_unmerge_lead(uuid, jsonb); the same two in practice; delete the two site_settings rows and
-- the two policies. Keep private.lead_merge_backup while it holds any row: it is the only copy of a joined card.
