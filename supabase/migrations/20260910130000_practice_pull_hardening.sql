-- Practice pull hardening (2026-09-10, Claude, DO-NOT-BREAK rule 46).
--
-- Fixes every confirmed finding of the full practice-copy test run:
--   * One clashing row can no longer block a table: every live row is applied
--     on its own. A clash on another unique key is resolved (a practice row's
--     text key gets a "-practice-xxxx" suffix; on office tables a non-text clash
--     is resolved live-wins with the practice row logged) or the row is held
--     back in practice_private.pull_skips and shown in the top bar.
--   * The top bar tells the truth: ok/last-matched come from real per-table
--     state; "fresh" and "busy" no longer claim ok after a failure.
--   * Row hashes cover only the columns both copies share, so a future column
--     never makes rows look team-edited. Tables without updated_at get live
--     edits through a live-row hash on reconcile.
--   * A live delete never takes the team's practice rows with it: a parent
--     with team-created children is kept (and logged); every deleted practice
--     row is logged first.
--   * Page work the team deleted is not brought back by a live edit.
--   * Each table copies at most max_rows_per_table rows per pull, so a big
--     catch-up always commits progress.
--   * Missing trigger guards or grants are re-applied automatically (no Reset).
--   * A Reset no longer seeds the ledger in the same call (it could hit the 8 s
--     timeout); the next pull seeds it.
--   * The caller check uses the session / JWT role (current_user is always the
--     definer inside SECURITY DEFINER).
--   * Timings use clock_timestamp(); bookkeeping writes only when needed.
--   * Row security on every practice_private pull table; helper functions are
--     not executable by anon/authenticated.
-- Touches practice and practice_private only. Every public.* reference is a SELECT.

-- ---------------------------------------------------------------------------
-- 0. Bookkeeping changes
-- ---------------------------------------------------------------------------
alter table practice_private.pull_ledger add column if not exists live_hash text;
alter table practice_private.pull_settings add column if not exists needs_seed boolean not null default false;
alter table practice_private.pull_settings add column if not exists seed_since timestamptz;
alter table practice_private.pull_settings add column if not exists max_rows_per_table integer not null default 1000;
alter table practice_private.pull_settings add column if not exists last_pull_at timestamptz;
-- The column list the ledger hashes were taken over, per table. When a table
-- gains or loses a shared column, untouched rows are re-hashed instead of
-- suddenly looking team-edited (which would stop live updates silently).
alter table practice_private.pull_state add column if not exists hash_cols text[];

create table if not exists practice_private.pull_skips (
  tbl text not null,
  pk text not null,
  live_hash text,
  reason text,
  detail jsonb,
  at timestamptz not null default now(),
  primary key (tbl, pk)
);

alter table practice_private.pull_settings enable row level security;
alter table practice_private.pull_state enable row level security;
alter table practice_private.pull_ledger enable row level security;
alter table practice_private.pull_log enable row level security;
alter table practice_private.pull_runs enable row level security;
alter table practice_private.pull_skips enable row level security;

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'practice_puller') then
    execute 'grant select, insert, update, delete on all tables in schema practice_private to practice_puller';
    execute 'grant usage, select on all sequences in schema practice_private to practice_puller';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1. Helpers
-- ---------------------------------------------------------------------------
create or replace function practice_private.pull_shared_column_array(tname text)
returns text[]
language sql
stable
as $$
  select coalesce(array_agg(a.attname::text order by a.attnum), '{}')
  from pg_attribute a
  where a.attrelid = to_regclass('practice.' || quote_ident(tname))
    and a.attnum > 0 and not a.attisdropped and a.attgenerated = ''
    and exists (
      select 1 from pg_attribute b
      where b.attrelid = to_regclass('public.' || quote_ident(tname))
        and b.attname = a.attname and not b.attisdropped
    )
$$;

-- Hash of a row restricted to the shared columns, so both copies hash alike
-- and a column added to one side later changes nothing.
create or replace function practice_private.pull_hash(row_json jsonb, cols text[])
returns text
language sql
immutable
as $$
  select md5(coalesce((select jsonb_object_agg(e.key, e.value) from jsonb_each(row_json) e where e.key = any(cols)), '{}'::jsonb)::text)
$$;

-- Every unique key other than the primary key, as a column list.
create or replace function practice_private.pull_unique_sets(tname text)
returns setof text[]
language sql
stable
as $$
  select array_agg(a.attname::text order by k.ord)
  from pg_index i
  cross join lateral unnest(i.indkey::int2[]) with ordinality as k(attnum, ord)
  join pg_attribute a on a.attrelid = i.indrelid and a.attnum = k.attnum
  where i.indrelid = to_regclass('practice.' || quote_ident(tname))
    and i.indisunique and not i.indisprimary and i.indexprs is null
  group by i.indexrelid
$$;

create or replace function practice_private.pull_record_skip(tname text, pkval text, live_row jsonb, cols text[], why text)
returns void
language sql
as $$
  insert into practice_private.pull_skips (tbl, pk, live_hash, reason, detail, at)
  values (tname, pkval, practice_private.pull_hash(live_row, cols), left(why, 500), jsonb_build_object('live_row', live_row), now())
  on conflict (tbl, pk) do update set live_hash = excluded.live_hash, reason = excluded.reason, detail = excluded.detail, at = excluded.at
$$;

-- True when a practice row has children the team created on the practice copy
-- (rows not in the ledger) through a single-column foreign key.
create or replace function practice_private.pull_has_team_children(tname text, pkval text)
returns boolean
language plpgsql
stable
as $$
declare
  c record;
  cpk text;
  found boolean;
begin
  for c in
    select cl.relname as child, a.attname as col
    from pg_constraint con
    join pg_class cl on cl.oid = con.conrelid
    join pg_namespace n on n.oid = cl.relnamespace
    join pg_attribute a on a.attrelid = con.conrelid and a.attnum = con.conkey[1]
    where con.contype = 'f' and n.nspname = 'practice'
      and con.confrelid = to_regclass('practice.' || quote_ident(tname))
      and array_length(con.conkey, 1) = 1
  loop
    cpk := practice_private.pull_pk_column(c.child);
    if cpk is null then continue; end if;
    execute format(
      'select exists (select 1 from practice.%1$I x where x.%2$I::text = $1
         and not exists (select 1 from practice_private.pull_ledger g where g.tbl = %3$L and g.pk = x.%4$I::text))',
      c.child, c.col, c.child, cpk) using pkval into found;
    if found then return true; end if;
  end loop;
  return false;
end;
$$;

create or replace function practice_private.pull_grants_missing()
returns integer
language sql
stable
as $$
  select case when not exists (select 1 from pg_roles where rolname = 'practice_puller') then 0 else (
    select count(*)::integer
    from pg_class cl join pg_namespace n on n.oid = cl.relnamespace
    where n.nspname in ('practice', 'practice_private') and cl.relkind = 'r'
      and not has_table_privilege('practice_puller', cl.oid, 'INSERT')
  ) end
$$;

-- Truthful status for the top bar: bad = some table failed its last pull,
-- skipped = live rows held back, last_ok_at = when the copy last fully matched.
create or replace function practice_private.pull_status_now()
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'bad', exists (select 1 from practice_private.pull_state where last_error is not null),
    'skipped', (select count(*) from practice_private.pull_skips),
    'last_ok_at', case
      when exists (select 1 from practice_private.pull_state where last_error is not null)
        then (select min(last_ok_at) from practice_private.pull_state where last_error is not null)
      else coalesce((select last_pull_at from practice_private.pull_settings where id), (select max(last_ok_at) from practice_private.pull_state))
    end,
    'failing_tables', coalesce((select jsonb_agg(tbl order by tbl) from practice_private.pull_state where last_error is not null), '[]'::jsonb)
  )
$$;

drop function if exists practice_private.pull_apply_row(text, text, text, jsonb, text[]);

-- ---------------------------------------------------------------------------
-- 2. Apply one live row to the practice copy. Never raises: returns
--    'ok', 'resolved' or 'skipped' (the reason is in pull_skips).
-- ---------------------------------------------------------------------------
create or replace function practice_private.pull_apply_row(tname text, mode text, pkcol text, live_row jsonb, cols text[])
returns text
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  collist text := (select string_agg(quote_ident(c), ', ') from unnest(cols) c);
  setlist text := (select string_agg(format('%1$I = excluded.%1$I', c), ', ') from unnest(cols) c where c <> pkcol);
  ins text;
  pkval text := live_row ->> pkcol;
  uc text[];
  cond text;
  ids text[];
  cid text;
  text_only boolean;
  prow jsonb;
  renames text;
begin
  ins := format('insert into practice.%1$I (%2$s) select %2$s from jsonb_populate_record(null::practice.%1$I, $1) on conflict (%3$I) do %4$s',
    tname, collist, pkcol, case when setlist is null then 'nothing' else 'update set ' || setlist end);
  begin
    execute ins using live_row;
    return 'ok';
  exception
    when unique_violation then
      null; -- resolved below
    when foreign_key_violation then
      perform practice_private.pull_record_skip(tname, pkval, live_row, cols, 'parent_missing: ' || sqlerrm);
      return 'skipped';
    when others then
      perform practice_private.pull_record_skip(tname, pkval, live_row, cols, sqlerrm);
      return 'skipped';
  end;

  -- A practice row holds one of this live row's other unique keys.
  for uc in select u from practice_private.pull_unique_sets(tname) u loop
    -- A unique index never matches on NULL, so NULL keys are not clashes.
    cond := (select string_agg(format('p.%1$I = r.%1$I', c), ' and ') from unnest(uc) c);
    execute format(
      'select coalesce(array_agg(p.%1$I::text), ''{}'') from practice.%2$I p, jsonb_populate_record(null::practice.%2$I, $1) r
        where %3$s and p.%1$I is distinct from r.%1$I',
      pkcol, tname, cond) using live_row into ids;
    foreach cid in array ids loop
      select bool_and(format_type(a.atttypid, a.atttypmod) in ('text', 'citext') or format_type(a.atttypid, a.atttypmod) like 'character varying%')
        into text_only
      from pg_attribute a
      where a.attrelid = to_regclass('practice.' || quote_ident(tname)) and a.attname = any(uc);
      begin
        if text_only then
          renames := (select string_agg(format('%1$I = %1$I || ''-practice-'' || substr(md5(random()::text), 1, 4)', c), ', ') from unnest(uc) c);
          execute format('update practice.%I set %s where %I::text = $1', tname, renames, pkcol) using cid;
          insert into practice_private.pull_log (tbl, pk, action, detail)
          values (tname, cid, 'renamed_practice_row_for_live', jsonb_build_object('columns', to_jsonb(uc), 'live_pk', pkval));
        elsif mode = 'office' then
          execute format('select to_jsonb(p) from practice.%I p where %I::text = $1', tname, pkcol) using cid into prow;
          insert into practice_private.pull_log (tbl, pk, action, detail)
          values (tname, cid, 'live_replaced_clashing_practice_row', jsonb_build_object('columns', to_jsonb(uc), 'live_pk', pkval, 'practice_row', prow));
          execute format('delete from practice.%I where %I::text = $1', tname, pkcol) using cid;
        else
          perform practice_private.pull_record_skip(tname, pkval, live_row, cols, 'clash_kept_practice_page_work: ' || array_to_string(uc, ','));
          return 'skipped';
        end if;
      exception when others then
        perform practice_private.pull_record_skip(tname, pkval, live_row, cols, 'clash_unresolved: ' || sqlerrm);
        return 'skipped';
      end;
    end loop;
  end loop;

  begin
    execute ins using live_row;
    return 'resolved';
  exception when others then
    perform practice_private.pull_record_skip(tname, pkval, live_row, cols, sqlerrm);
    return 'skipped';
  end;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. One table: new rows, then changed rows, each row on its own, capped.
-- ---------------------------------------------------------------------------
create or replace function practice_private.pull_upsert_table(tname text, force_reconcile boolean)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  mode text := practice_private.pull_table_mode(tname);
  pkcol text := practice_private.pull_pk_column(tname);
  stamp text := practice_private.pull_stamp_column(tname);
  cols text[] := practice_private.pull_shared_column_array(tname);
  cap integer := greatest(1, coalesce((select max_rows_per_table from practice_private.pull_settings where id), 1000));
  rowfilter text := practice_private.pull_row_filter(tname, 'l');
  stampexpr text;
  orderexpr text;
  wm timestamptz;
  live_max timestamptz;
  live_count bigint;
  known_count bigint;
  do_reconcile boolean := force_reconcile;
  old_cols text[];
  win text;
  changedcond text;
  r record;
  h text;
  ph text;
  res text;
  exists_same_id boolean;
  n_new int := 0;
  n_upd int := 0;
  n_skip int := 0;
  n_over int := 0;
  seen_new int := 0;
  seen_upd int := 0;
  last_new timestamptz;
  last_upd timestamptz;
  capped boolean := false;
begin
  if pkcol is null then return jsonb_build_object('skipped_table', 'no single-column primary key', 'changed', false); end if;
  stampexpr := case when stamp is null then 'null::timestamptz' else format('l.%I', stamp) end;
  orderexpr := case when stamp is null then format('l.%I', pkcol) else format('l.%I, l.%I', stamp, pkcol) end;

  select live_watermark, hash_cols into wm, old_cols from practice_private.pull_state where tbl = tname;
  if not found then
    insert into practice_private.pull_state (tbl, live_watermark, hash_cols) values (tname, '-infinity', cols);
    wm := '-infinity';
    old_cols := cols;
  end if;
  if old_cols is null then
    update practice_private.pull_state set hash_cols = cols where tbl = tname;
  elsif old_cols is distinct from cols then
    -- A shared column was added or dropped: re-hash rows that were untouched
    -- under the old column list; team-edited rows stay distinct.
    execute format(
      'update practice_private.pull_ledger g
          set practice_hash = case when practice_private.pull_hash(to_jsonb(p), %1$L::text[]) = g.practice_hash
                                   then practice_private.pull_hash(to_jsonb(p), %2$L::text[]) else g.practice_hash end,
              live_hash = case when practice_private.pull_hash(to_jsonb(p), %1$L::text[]) = g.live_hash
                               then practice_private.pull_hash(to_jsonb(p), %2$L::text[]) else g.live_hash end
         from practice.%3$I p
        where g.tbl = %4$L and g.pk = p.%5$I::text',
      old_cols, cols, tname, tname, pkcol);
    update practice_private.pull_state set hash_cols = cols where tbl = tname;
    insert into practice_private.pull_log (tbl, action, detail)
    values (tname, 'rehashed_for_column_change', jsonb_build_object('before', to_jsonb(old_cols), 'after', to_jsonb(cols)));
    do_reconcile := true;
  end if;

  execute format('select count(*), %s from public.%I l where %s',
    case when stamp is null then 'null::timestamptz' else format('max(l.%I)', stamp) end, tname, rowfilter)
    into live_count, live_max;
  select (select count(*) from practice_private.pull_ledger where tbl = tname)
       + (select count(*) from practice_private.pull_skips where tbl = tname)
    into known_count;
  if live_count <> known_count then do_reconcile := true; end if;

  if not do_reconcile and (stamp is null or live_max is null or live_max <= wm) then
    -- Nothing new: an old error on this table is no longer true.
    update practice_private.pull_state set last_error = null, last_ok_at = clock_timestamp()
     where tbl = tname and last_error is not null;
    return jsonb_build_object('changed', false);
  end if;

  win := case when do_reconcile or stamp is null then 'true'
              else format('%s > %L::timestamptz - interval ''2 minutes''', stampexpr, wm) end;

  -- (a) New live rows.
  for r in execute format(
    'select to_jsonb(l) as j, l.%1$I::text as id, %2$s as st
       from public.%3$I l
      where (%4$s) and (%5$s)
        and not exists (select 1 from practice_private.pull_ledger g where g.tbl = %6$L and g.pk = l.%1$I::text)
        and not exists (select 1 from practice_private.pull_skips s where s.tbl = %6$L and s.pk = l.%1$I::text
                          and s.live_hash = practice_private.pull_hash(to_jsonb(l), %7$L::text[])
                          and not (%10$L::boolean and left(s.reason, 14) = ''parent_missing''))
      order by %8$s
      limit %9$s',
    pkcol, stampexpr, tname, win, rowfilter, tname, cols, orderexpr, cap, do_reconcile)
  loop
    seen_new := seen_new + 1;
    last_new := greatest(last_new, r.st);
    h := practice_private.pull_hash(r.j, cols);
    execute format('select exists (select 1 from practice.%I where %I::text = $1)', tname, pkcol) using r.id into exists_same_id;
    if exists_same_id and mode = 'pagework' then
      perform practice_private.pull_record_skip(tname, r.id, r.j, cols, 'page_work_same_id_on_practice');
      n_skip := n_skip + 1;
      continue;
    end if;
    res := practice_private.pull_apply_row(tname, mode, pkcol, r.j, cols);
    if res = 'skipped' then
      n_skip := n_skip + 1;
    else
      insert into practice_private.pull_ledger (tbl, pk, live_stamp, live_hash, practice_hash, copied_at)
      values (tname, r.id, r.st, h, h, now())
      on conflict (tbl, pk) do update set live_stamp = excluded.live_stamp, live_hash = excluded.live_hash, practice_hash = excluded.practice_hash, copied_at = excluded.copied_at;
      delete from practice_private.pull_skips where tbl = tname and pk = r.id;
      n_new := n_new + 1;
    end if;
  end loop;

  -- (b) Changed live rows. With updated_at: the stamp moved. Without: on a
  --     reconcile, the live row's hash moved since we copied it.
  changedcond := case
    when stamp = 'updated_at' then format('l.updated_at is distinct from g.live_stamp and (%s)', win)
    when do_reconcile then format('practice_private.pull_hash(to_jsonb(l), %L::text[]) is distinct from g.live_hash', cols)
    else 'false' end;
  for r in execute format(
    'select to_jsonb(l) as j, l.%1$I::text as id, %2$s as st, g.practice_hash as gh, to_jsonb(p) as pj
       from public.%3$I l
       join practice_private.pull_ledger g on g.tbl = %4$L and g.pk = l.%1$I::text
       left join practice.%3$I p on p.%1$I = l.%1$I
      where (%5$s) and (%6$s)
      order by %7$s
      limit %8$s',
    pkcol, stampexpr, tname, tname, changedcond, rowfilter, orderexpr, cap)
  loop
    seen_upd := seen_upd + 1;
    last_upd := greatest(last_upd, r.st);
    h := practice_private.pull_hash(r.j, cols);
    ph := case when r.pj is null then null else practice_private.pull_hash(r.pj, cols) end;
    if mode = 'pagework' and (r.pj is null or ph is distinct from r.gh) then
      -- Page work the team edited or deleted on the practice copy stays as it is.
      update practice_private.pull_ledger set live_stamp = coalesce(r.st, live_stamp), live_hash = h
       where tbl = tname and pk = r.id;
      insert into practice_private.pull_log (tbl, pk, action, detail)
      values (tname, r.id, case when r.pj is null then 'page_work_deleted_on_practice_kept' else 'page_work_team_edit_kept' end, '{}'::jsonb);
      continue;
    end if;
    if r.pj is not null and ph is distinct from r.gh then
      insert into practice_private.pull_log (tbl, pk, action, detail)
      values (tname, r.id, 'live_replaced_practice_edit', jsonb_build_object('practice_row', r.pj));
      n_over := n_over + 1;
    end if;
    res := practice_private.pull_apply_row(tname, mode, pkcol, r.j, cols);
    if res = 'skipped' then
      update practice_private.pull_ledger set live_stamp = coalesce(r.st, live_stamp), live_hash = h where tbl = tname and pk = r.id;
      n_skip := n_skip + 1;
    else
      update practice_private.pull_ledger set live_stamp = coalesce(r.st, live_stamp), live_hash = h, practice_hash = h, copied_at = now()
       where tbl = tname and pk = r.id;
      delete from practice_private.pull_skips where tbl = tname and pk = r.id;
      n_upd := n_upd + 1;
    end if;
  end loop;

  capped := seen_new >= cap or seen_upd >= cap;
  update practice_private.pull_state
     set live_watermark = case
           when stamp is null then live_watermark
           when capped then greatest(coalesce(live_watermark, '-infinity'), least(coalesce(last_new, live_max), coalesce(last_upd, live_max)) - interval '1 second')
           else greatest(coalesce(live_watermark, '-infinity'), coalesce(live_max, live_watermark, '-infinity'))
         end,
         last_ok_at = clock_timestamp(),
         last_error = null,
         last_reconcile_at = case when do_reconcile and not capped then clock_timestamp() else last_reconcile_at end
   where tbl = tname;
  return jsonb_build_object('inserted', n_new, 'updated', n_upd, 'skipped', n_skip, 'overwritten_practice_edits', n_over,
    'capped', capped, 'changed', n_new > 0 or n_upd > 0);
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Live deletes (office tables). Every deleted practice row is logged first;
--    a parent with team-created children is kept and becomes practice-owned.
-- ---------------------------------------------------------------------------
create or replace function practice_private.pull_delete_table(tname text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  mode text := practice_private.pull_table_mode(tname);
  pkcol text := practice_private.pull_pk_column(tname);
  g record;
  prow jsonb;
  deleted int := 0;
  kept int := 0;
begin
  if pkcol is null then return jsonb_build_object('deleted', 0, 'changed', false); end if;
  for g in execute format(
    'select g.pk from practice_private.pull_ledger g
      where g.tbl = %1$L and not exists (select 1 from public.%2$I l where l.%3$I::text = g.pk)',
    tname, tname, pkcol)
  loop
    if mode <> 'office' then
      insert into practice_private.pull_log (tbl, pk, action, detail) values (tname, g.pk, 'live_deleted_page_work_kept', '{}'::jsonb);
    elsif practice_private.pull_has_team_children(tname, g.pk) then
      insert into practice_private.pull_log (tbl, pk, action, detail) values (tname, g.pk, 'live_deleted_kept_for_team_rows', '{}'::jsonb);
      kept := kept + 1;
    else
      execute format('select to_jsonb(p) from practice.%I p where %I::text = $1', tname, pkcol) using g.pk into prow;
      if prow is not null then
        begin
          insert into practice_private.pull_log (tbl, pk, action, detail) values (tname, g.pk, 'live_deleted', jsonb_build_object('practice_row', prow));
          execute format('delete from practice.%I where %I::text = $1', tname, pkcol) using g.pk;
          deleted := deleted + 1;
        exception when others then
          insert into practice_private.pull_log (tbl, pk, action, detail) values (tname, g.pk, 'live_delete_failed', jsonb_build_object('error', sqlerrm));
        end;
      end if;
    end if;
    delete from practice_private.pull_ledger where tbl = tname and pk = g.pk;
  end loop;
  execute format(
    'delete from practice_private.pull_skips s where s.tbl = %1$L and not exists (select 1 from public.%2$I l where l.%3$I::text = s.pk)',
    tname, tname, pkcol);
  return jsonb_build_object('deleted', deleted, 'kept_for_team_rows', kept, 'changed', deleted > 0);
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Ledger seed. practice_hash marks a row the team changed after the last
--    Reset as 'EDITED' (never equal), so page work stays protected; live_hash
--    is the row as last copied, so stale rows refresh on the next pull.
-- ---------------------------------------------------------------------------
create or replace function practice_private.seed_pull_ledger(since timestamptz default null)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  tname text;
  pkcol text;
  stamp text;
  cols text[];
  n bigint;
  counts jsonb := '{}'::jsonb;
  base timestamptz := coalesce(since, (select max(reset_at) from practice_private.reset_log), '-infinity'::timestamptz);
begin
  delete from practice_private.pull_ledger;
  delete from practice_private.pull_state;
  delete from practice_private.pull_skips;
  foreach tname in array practice_private.pull_table_order() loop
    pkcol := practice_private.pull_pk_column(tname);
    if pkcol is null then continue; end if;
    stamp := practice_private.pull_stamp_column(tname);
    cols := practice_private.pull_shared_column_array(tname);
    execute format(
      'insert into practice_private.pull_ledger (tbl, pk, live_stamp, live_hash, practice_hash)
       select %1$L, p.%2$I::text,
              %3$s,
              practice_private.pull_hash(to_jsonb(p), %4$L::text[]),
              case when %5$s
                     and practice_private.pull_hash(to_jsonb(p), %4$L::text[]) is distinct from practice_private.pull_hash(to_jsonb(l), %4$L::text[])
                   then ''EDITED''
                   else practice_private.pull_hash(to_jsonb(p), %4$L::text[]) end
       from practice.%6$I p join public.%6$I l on l.%2$I = p.%2$I
       where %7$s',
      tname, pkcol,
      case when stamp is null then format('%L::timestamptz', base) else format('least(l.%I, %L::timestamptz)', stamp, base) end,
      cols,
      case when stamp = 'updated_at' then format('p.updated_at > %L::timestamptz', base) else 'false' end,
      tname,
      practice_private.pull_row_filter(tname, 'l'));
    get diagnostics n = row_count;
    counts := counts || jsonb_build_object(tname, n);
    insert into practice_private.pull_state (tbl, live_watermark, hash_cols) values (tname, base, cols)
      on conflict (tbl) do update set live_watermark = excluded.live_watermark, hash_cols = excluded.hash_cols, last_error = null, last_reconcile_at = null;
  end loop;
  update practice_private.pull_settings set needs_seed = false, seed_since = null where id;
  return jsonb_build_object('seeded_at', clock_timestamp(), 'since', base, 'rows', counts);
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Entry point.
-- ---------------------------------------------------------------------------
create or replace function practice.pull_from_live()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
set lock_timeout = '1s'
as $$
declare
  jwt_role text := coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'
  );
  settings practice_private.pull_settings;
  ordered text[];
  tname text;
  one jsonb;
  per jsonb := '{}'::jsonb;
  errors jsonb := '[]'::jsonb;
  changed_tables text[] := '{}';
  failed text[] := '{}';
  reconcile_tables text[] := '{}';
  started timestamptz := clock_timestamp();
  st jsonb;
  healed integer := 0;
  stamps_live jsonb;
  stamps_practice jsonb;
  i integer;
  due boolean;
begin
  if not (session_user in ('postgres', 'supabase_admin') or jwt_role = 'service_role') then
    raise exception 'practice.pull_from_live() may only be run with the service role';
  end if;
  select * into settings from practice_private.pull_settings where id;
  if settings is null or not settings.enabled then
    return practice_private.pull_status_now() || jsonb_build_object('ok', false, 'reason', 'disabled');
  end if;
  if not pg_try_advisory_xact_lock(hashtext('ldtt.practice_pull')) then
    st := practice_private.pull_status_now();
    return st || jsonb_build_object('ok', not (st ->> 'bad')::boolean, 'reason', 'busy');
  end if;
  if settings.needs_seed then
    perform practice_private.seed_pull_ledger(settings.seed_since);
    update practice_private.pull_settings set last_pull_at = clock_timestamp() where id;
    return practice_private.pull_status_now() || jsonb_build_object('ok', true, 'reason', 'seeded');
  end if;
  if settings.last_pull_at is not null and settings.last_pull_at > clock_timestamp() - make_interval(secs => settings.min_interval_ms / 1000.0) then
    st := practice_private.pull_status_now();
    return st || jsonb_build_object('ok', not (st ->> 'bad')::boolean, 'reason', 'fresh');
  end if;
  -- A structure sync or a new practice table drops the trigger guards or grants:
  -- put them back here instead of stopping.
  if practice_private.pull_guards_missing() > 0 or practice_private.pull_grants_missing() > 0 then
    healed := practice_private.apply_pull_guards();
    insert into practice_private.pull_log (action, detail) values ('guards_reapplied', jsonb_build_object('triggers', healed));
  end if;

  perform set_config('ldtt.practice_pull', 'on', true);
  ordered := practice_private.pull_table_order();
  delete from practice_private.pull_state where not (tbl = any(ordered));

  foreach tname in array ordered loop
    due := coalesce((select last_reconcile_at from practice_private.pull_state where tbl = tname), '-infinity')
           < clock_timestamp() - make_interval(secs => settings.reconcile_every_seconds);
    if due then reconcile_tables := reconcile_tables || tname; end if;
    begin
      one := practice_private.pull_upsert_table(tname, due);
      per := per || jsonb_build_object(tname, one);
      if coalesce((one ->> 'changed')::boolean, false) then changed_tables := changed_tables || tname; end if;
    exception when others then
      failed := failed || tname;
      errors := errors || jsonb_build_object('table', tname, 'error', sqlerrm);
      update practice_private.pull_state set last_error = left(sqlerrm, 500),
             last_reconcile_at = case when due then clock_timestamp() else last_reconcile_at end
       where tbl = tname;
      insert into practice_private.pull_log (tbl, action, detail) values (tname, 'error', jsonb_build_object('error', sqlerrm));
    end;
  end loop;

  for i in reverse cardinality(ordered)..1 loop
    tname := ordered[i];
    if not (tname = any(reconcile_tables)) or tname = any(failed) then continue; end if;
    begin
      one := practice_private.pull_delete_table(tname);
      if coalesce((one ->> 'changed')::boolean, false) then
        changed_tables := changed_tables || tname;
        per := per || jsonb_build_object(tname, coalesce(per -> tname, '{}'::jsonb) || one);
      end if;
    exception when others then
      errors := errors || jsonb_build_object('table', tname, 'error', sqlerrm);
      update practice_private.pull_state set last_error = left(sqlerrm, 500) where tbl = tname;
      insert into practice_private.pull_log (tbl, action, detail) values (tname, 'error', jsonb_build_object('error', sqlerrm));
    end;
  end loop;

  begin
    select value into stamps_live from public.site_settings where key = 'portal_visit_stamps';
    select value into stamps_practice from practice.site_settings where key = 'portal_visit_stamps';
    if stamps_live is not null and md5(stamps_live::text) is distinct from md5(coalesce(stamps_practice, '{}'::jsonb)::text) then
      insert into practice.site_settings (key, value) values ('portal_visit_stamps', stamps_live)
        on conflict (key) do update set value = excluded.value;
      changed_tables := changed_tables || array['site_settings'];
    end if;
  exception when others then
    errors := errors || jsonb_build_object('table', 'site_settings', 'error', sqlerrm);
  end;

  update practice_private.pull_settings set last_pull_at = clock_timestamp() where id;
  if cardinality(changed_tables) > 0 or jsonb_array_length(errors) > 0 or cardinality(reconcile_tables) > 0 or healed > 0 then
    insert into practice_private.pull_runs (started_at, finished_at, ok, result)
    values (started, clock_timestamp(), jsonb_array_length(errors) = 0,
            jsonb_build_object('changed', to_jsonb(changed_tables), 'errors', errors, 'reconciled', to_jsonb(reconcile_tables), 'guards_reapplied', healed));
    delete from practice_private.pull_log where at < now() - interval '30 days';
    delete from practice_private.pull_runs where started_at < now() - interval '7 days';
  end if;

  st := practice_private.pull_status_now();
  return st || jsonb_build_object(
    'ok', not (st ->> 'bad')::boolean,
    'reason', case when jsonb_array_length(errors) = 0 then 'pulled' else 'error' end,
    'changed', to_jsonb(changed_tables),
    'per_table', per,
    'errors', errors,
    'took_ms', round(extract(epoch from clock_timestamp() - started) * 1000)
  );
end;
$$;
revoke all on function practice.pull_from_live() from public, anon, authenticated;
grant execute on function practice.pull_from_live() to service_role;

-- Cheap status for the endpoint's timeout path (no row scans).
create or replace function practice.pull_last_ok()
returns jsonb
language sql
security definer
set search_path = pg_catalog, pg_temp
as $$ select practice_private.pull_status_now() $$;
revoke all on function practice.pull_last_ok() from public, anon, authenticated;
grant execute on function practice.pull_last_ok() to service_role;

-- Diagnostics: counts per table of team-edited and team-created rows.
create or replace function practice.pull_status()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  tname text;
  pkcol text;
  cols text[];
  edited bigint;
  created bigint;
  per jsonb := '{}'::jsonb;
  total_edited bigint := 0;
  total_created bigint := 0;
begin
  foreach tname in array practice_private.pull_table_order() loop
    pkcol := practice_private.pull_pk_column(tname);
    if pkcol is null then continue; end if;
    cols := practice_private.pull_shared_column_array(tname);
    execute format(
      'select
         (select count(*) from practice.%1$I p join practice_private.pull_ledger g on g.tbl = %2$L and g.pk = p.%3$I::text
           where practice_private.pull_hash(to_jsonb(p), %4$L::text[]) is distinct from g.practice_hash),
         (select count(*) from practice.%1$I p where not exists (select 1 from practice_private.pull_ledger g where g.tbl = %2$L and g.pk = p.%3$I::text))',
      tname, tname, pkcol, cols) into edited, created;
    if edited > 0 or created > 0 then
      per := per || jsonb_build_object(tname, jsonb_build_object('edited', edited, 'created', created));
    end if;
    total_edited := total_edited + edited;
    total_created := total_created + created;
  end loop;
  return practice_private.pull_status_now() || jsonb_build_object(
    'enabled', (select enabled from practice_private.pull_settings where id),
    'guards_missing', practice_private.pull_guards_missing(),
    'practice_edited', total_edited,
    'practice_created', total_created,
    'per_table', per,
    'skips', coalesce((select jsonb_agg(jsonb_build_object('tbl', tbl, 'pk', pk, 'reason', reason) order by at desc) from practice_private.pull_skips), '[]'::jsonb)
  );
end;
$$;
revoke all on function practice.pull_status() from public, anon, authenticated;
grant execute on function practice.pull_status() to service_role;

-- ---------------------------------------------------------------------------
-- 7. Reset: truncate + copy, guards back, testing logins on, ledger seeded by
--    the NEXT pull (keeps this call well inside the 8 s statement timeout).
-- ---------------------------------------------------------------------------
create or replace function practice.reset_from_live_by(reset_by_name text, reset_by_email text default null)
returns jsonb
language plpgsql
security definer
set search_path = practice, practice_private, pg_catalog, pg_temp
as $$
declare
  jwt_role text := coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'
  );
  who text := regexp_replace(coalesce(reset_by_name, ''), '\s+', ' ', 'g');
  result jsonb;
  reset_moment timestamptz;
begin
  if not (session_user in ('postgres', 'supabase_admin') or jwt_role = 'service_role') then
    raise exception 'practice.reset_from_live_by() may only be run with the service role';
  end if;
  if array_length(string_to_array(trim(who), ' '), 1) < 2 then
    raise exception 'A full name (first and last) is required to reset the practice copy';
  end if;
  result := practice.reset_from_live();
  reset_moment := now();
  insert into practice_private.reset_log (reset_by_name, reset_by_email, rows)
  values (left(trim(who), 200), nullif(left(trim(coalesce(reset_by_email, '')), 254), ''), coalesce(result -> 'rows', '{}'::jsonb));
  perform practice_private.apply_pull_guards();
  update practice_private.pull_settings set needs_seed = true, seed_since = reset_moment where id;
  update practice.portal_users set active = true, access_status = 'active'
    where lower(email) in ('superadmin@lorenzosdogtrainingteam.com', 'officeadmin@lorenzosdogtrainingteam.com', 'trainer@lorenzosdogtrainingteam.com');
  return result || jsonb_build_object('reset_by_name', left(trim(who), 200), 'pull_ledger_seeds_on_next_pull', true);
end;
$$;
revoke all on function practice.reset_from_live_by(text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 8. Helpers are not callable by anon/authenticated; the pull owner may call them.
-- ---------------------------------------------------------------------------
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'practice_private' and p.proname like 'pull\_%' escape '\'
       or n.nspname = 'practice_private' and p.proname in ('apply_pull_guards', 'seed_pull_ledger')
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
    if exists (select 1 from pg_roles where rolname = 'practice_puller') then
      execute format('grant execute on function %s to practice_puller', f.sig);
    end if;
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end $$;

-- The v1 ledger hashed every column; re-seed with the shared-column hash now.
select practice_private.seed_pull_ledger();
