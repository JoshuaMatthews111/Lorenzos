-- Practice copy pulls from live on read (2026-09-10, Claude, DO-NOT-BREAK rule 46).
--
-- The practice copy used to be a photo of live taken by the last Reset. From
-- now on the practice data endpoint calls practice.pull_from_live() before it
-- reads, so the office sees live's real leads, applications, clients and notes
-- the moment a screen opens.
--
-- What this file touches: schema practice, schema practice_private, and one
-- optional NOLOGIN role. NOTHING in schema public: no table, trigger, view,
-- grant, policy or function there. Every statement that names public.* is a
-- SELECT. scripts/audit-office-requirements.mjs enforces that on the text.
--
-- Rules the pull follows (owner decision 2026-09-10, "live wins"):
--   * Office tables (leads, applications, clients, notes, ...): a row live has
--     changed since the last pull replaces the practice row, even if the team
--     moved it on the practice copy; the old practice row is kept in
--     practice_private.pull_log so nothing is silently lost. A practice edit on
--     a row live has NOT touched stays.
--   * Page-work tables (trainers, trainer_pages, trainer_page_versions,
--     content_submissions, review_publications): new live rows come in; a row
--     the team edited on the practice copy is never overwritten (practice wins).
--   * Rows the team created on the practice copy (test trainers, built pages,
--     practice notes, deals) are never touched or deleted.
--   * Never pulled: ad_pages, ad_page_revisions (built by Page Studio),
--     send_to_live_log, reset_log, storage buckets. site_settings: only the
--     key portal_visit_stamps, so the visits tile matches live.
--   * Live deletes are mirrored for rows that came from live.
--   * Practice triggers do not fire while a pull writes (a WHEN guard on every
--     practice user trigger reads a transaction-local setting), so a copied row
--     is byte-for-byte live's row: same version, same updated_at, no extra
--     revision, client, code or audit row. No ALTER TABLE, no DISABLE TRIGGER
--     per pull (those reload the API's schema cache that live shares).
--   * Two kill switches: practice_private.pull_settings.enabled (no deploy)
--     and the Vercel env LDTT_PRACTICE_PULL=0 on the preview target.

-- ---------------------------------------------------------------------------
-- 0. Bookkeeping tables (practice_private survives a Reset; the reset only
--    truncates practice.*).
-- ---------------------------------------------------------------------------
create table if not exists practice_private.pull_settings (
  id boolean primary key default true check (id),
  enabled boolean not null default true,
  min_interval_ms integer not null default 2000,
  reconcile_every_seconds integer not null default 600,
  updated_at timestamptz not null default now()
);
insert into practice_private.pull_settings (id) values (true) on conflict (id) do nothing;

create table if not exists practice_private.pull_state (
  tbl text primary key,
  live_watermark timestamptz,
  last_ok_at timestamptz,
  last_error text,
  last_reconcile_at timestamptz
);

-- One row per practice row that came from live. A practice row with no ledger
-- row is team-created and belongs to the practice copy alone.
create table if not exists practice_private.pull_ledger (
  tbl text not null,
  pk text not null,
  live_stamp timestamptz,
  practice_hash text,
  copied_at timestamptz not null default now(),
  primary key (tbl, pk)
);
create index if not exists pull_ledger_tbl_idx on practice_private.pull_ledger (tbl);

create table if not exists practice_private.pull_log (
  id bigserial primary key,
  at timestamptz not null default now(),
  tbl text,
  pk text,
  action text not null,
  detail jsonb
);
create index if not exists pull_log_at_idx on practice_private.pull_log (at);

create table if not exists practice_private.pull_runs (
  id bigserial primary key,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  ok boolean,
  result jsonb
);

-- ---------------------------------------------------------------------------
-- 1. Optional least-privilege owner. On a plain Postgres this works; on
--    Supabase CREATE ROLE ... BYPASSRLS may be refused for the postgres role,
--    in which case the functions stay owned by postgres and rule 2 rests on
--    the code (every write statement is built with format('... practice.%I')
--    and the audit refuses any DML aimed at public).
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'practice_puller') then
    begin
      execute 'create role practice_puller nologin bypassrls';
      execute 'grant pg_read_all_data to practice_puller';
      execute 'grant usage on schema practice, practice_private to practice_puller';
      raise notice 'practice_puller created';
    exception when others then
      raise notice 'practice_puller not created (%). Functions stay owned by the current role.', sqlerrm;
    end;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Which tables the pull covers, and how.
-- ---------------------------------------------------------------------------
create or replace function practice_private.pull_table_mode(tname text)
returns text
language sql
immutable
as $$
  select case
    when tname in ('ad_pages', 'ad_page_revisions', 'send_to_live_log', 'reset_log', 'site_settings') then 'never'
    when tname in ('trainers', 'trainer_pages', 'trainer_page_versions', 'content_submissions', 'review_publications') then 'pagework'
    else 'office'
  end
$$;

-- The column that says when a live row last changed, or null when the table
-- has none (then the pull compares the whole table by id every reconcile).
create or replace function practice_private.pull_stamp_column(tname text)
returns text
language sql
stable
as $$
  select case
    when exists (select 1 from pg_attribute where attrelid = to_regclass('public.' || quote_ident(tname)) and attname = 'updated_at' and not attisdropped) then 'updated_at'
    when exists (select 1 from pg_attribute where attrelid = to_regclass('public.' || quote_ident(tname)) and attname = 'created_at' and not attisdropped) then 'created_at'
    else null
  end
$$;

-- Single-column primary key name, or null (a table without one is skipped and logged).
-- The practice-only testing logins are switched OFF on live (they must never
-- reach live data) and ON on the practice copy. The pull leaves their rows alone.
create or replace function practice_private.pull_row_filter(tname text, alias text)
returns text
language sql
immutable
as $$
  select case
    when tname = 'portal_users' then format('lower(%s.email) not in (''superadmin@lorenzosdogtrainingteam.com'', ''officeadmin@lorenzosdogtrainingteam.com'', ''trainer@lorenzosdogtrainingteam.com'')', alias)
    else 'true'
  end
$$;

create or replace function practice_private.pull_pk_column(tname text)
returns text
language sql
stable
as $$
  select a.attname::text
  from pg_index i
  join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
  where i.indrelid = to_regclass('practice.' || quote_ident(tname)) and i.indisprimary
    and array_length(i.indkey::int2[], 1) = 1
  limit 1
$$;

-- Columns both copies share (generated columns excluded), for INSERT ... SELECT.
create or replace function practice_private.pull_shared_columns(tname text)
returns text
language sql
stable
as $$
  select string_agg(quote_ident(a.attname), ', ' order by a.attnum)
  from pg_attribute a
  where a.attrelid = to_regclass('practice.' || quote_ident(tname))
    and a.attnum > 0 and not a.attisdropped and a.attgenerated = ''
    and exists (
      select 1 from pg_attribute b
      where b.attrelid = to_regclass('public.' || quote_ident(tname))
        and b.attname = a.attname and not b.attisdropped
    )
$$;

-- Tables in foreign-key order (parents first), the same walk the Reset uses.
create or replace function practice_private.pull_table_order()
returns text[]
language plpgsql
stable
as $$
declare
  remaining text[];
  ordered text[] := '{}';
  tname text;
  progressed boolean;
begin
  select array_agg(cl.relname order by cl.relname) into remaining
  from pg_class cl join pg_namespace ns on ns.oid = cl.relnamespace
  where ns.nspname = 'public' and cl.relkind = 'r'
    and to_regclass('practice.' || quote_ident(cl.relname)) is not null
    and practice_private.pull_table_mode(cl.relname) <> 'never';
  while remaining is not null and cardinality(remaining) > 0 loop
    progressed := false;
    foreach tname in array remaining loop
      if not exists (
        select 1
        from pg_constraint con
        join pg_class p on p.oid = con.confrelid
        join pg_namespace pn on pn.oid = p.relnamespace
        where con.conrelid = to_regclass('practice.' || quote_ident(tname))
          and con.contype = 'f' and pn.nspname = 'practice'
          and p.relname <> tname and p.relname = any(remaining)
      ) then
        ordered := ordered || tname;
        remaining := array_remove(remaining, tname);
        progressed := true;
      end if;
    end loop;
    if not progressed then
      raise exception 'practice_private.pull_table_order(): foreign-key cycle among %', remaining;
    end if;
  end loop;
  return ordered;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Trigger guards. Every practice user trigger gets
--      WHEN (coalesce(current_setting('ldtt.practice_pull', true), '') <> 'on')
--    so a pull can copy a live row without practice triggers rewriting it.
--    The Reset re-creates every trigger from live's definition, so
--    reset_from_live_by() calls this again afterwards.
-- ---------------------------------------------------------------------------
create or replace function practice_private.apply_pull_guards()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  r record;
  def text;
  guard constant text := 'coalesce(current_setting(''ldtt.practice_pull'', true), '''') <> ''on''';
  changed integer := 0;
begin
  for r in
    select cl.relname as tname, tg.tgname, pg_get_triggerdef(tg.oid) as def
    from pg_trigger tg
    join pg_class cl on cl.oid = tg.tgrelid
    join pg_namespace n on n.oid = cl.relnamespace
    where n.nspname = 'practice' and not tg.tgisinternal
      and position('ldtt.practice_pull' in pg_get_triggerdef(tg.oid)) = 0
  loop
    def := r.def;
    if position(' WHEN (' in def) > 0 then
      def := replace(def, ' WHEN (', ' WHEN ((' || guard || ') AND (');
      def := replace(def, ' EXECUTE FUNCTION ', ') EXECUTE FUNCTION ');
    else
      def := replace(def, ' EXECUTE FUNCTION ', ' WHEN (' || guard || ') EXECUTE FUNCTION ');
    end if;
    execute format('drop trigger if exists %I on practice.%I', r.tgname, r.tname);
    execute def;
    changed := changed + 1;
  end loop;
  -- Write rights for the least-privilege owner, when it exists.
  if exists (select 1 from pg_roles where rolname = 'practice_puller') then
    execute 'grant select, insert, update, delete on all tables in schema practice to practice_puller';
    execute 'grant select, insert, update, delete on all tables in schema practice_private to practice_puller';
    execute 'grant usage, select on all sequences in schema practice_private to practice_puller';
  end if;
  return changed;
end;
$$;
revoke all on function practice_private.apply_pull_guards() from public, anon, authenticated;

create or replace function practice_private.pull_guards_missing()
returns integer
language sql
stable
as $$
  select count(*)::integer
  from pg_trigger tg
  join pg_class cl on cl.oid = tg.tgrelid
  join pg_namespace n on n.oid = cl.relnamespace
  where n.nspname = 'practice' and not tg.tgisinternal
    and position('ldtt.practice_pull' in pg_get_triggerdef(tg.oid)) = 0
$$;

-- ---------------------------------------------------------------------------
-- 4. Ledger seed: after a Reset every practice row equals live, so every row
--    present in both copies is recorded as "came from live at <reset time>".
-- ---------------------------------------------------------------------------
create or replace function practice_private.seed_pull_ledger(since timestamptz default null)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  tname text;
  pk text;
  n bigint;
  counts jsonb := '{}'::jsonb;
  base timestamptz := coalesce(since, (select max(reset_at) from practice_private.reset_log), '-infinity'::timestamptz);
begin
  delete from practice_private.pull_ledger;
  delete from practice_private.pull_state;
  foreach tname in array practice_private.pull_table_order() loop
    pk := practice_private.pull_pk_column(tname);
    if pk is null then continue; end if;
    -- live_stamp = the live row's own stamp when it has not moved since the
    -- snapshot (so the first pull leaves it alone), else the snapshot time
    -- (so the first pull sees it as changed and brings live's version in).
    execute format(
      'insert into practice_private.pull_ledger (tbl, pk, live_stamp, practice_hash)
       select %1$L, p.%2$I::text, least(%3$s, %4$L::timestamptz), md5(to_jsonb(p)::text)
       from practice.%5$I p join public.%5$I l on l.%2$I = p.%2$I',
      tname, pk,
      case when practice_private.pull_stamp_column(tname) is null then quote_literal(base) || '::timestamptz' else format('l.%I', practice_private.pull_stamp_column(tname)) end,
      base, tname);
    get diagnostics n = row_count;
    counts := counts || jsonb_build_object(tname, n);
    insert into practice_private.pull_state (tbl, live_watermark) values (tname, base)
      on conflict (tbl) do update set live_watermark = excluded.live_watermark, last_error = null;
  end loop;
  return jsonb_build_object('seeded_at', now(), 'since', base, 'rows', counts);
end;
$$;
revoke all on function practice_private.seed_pull_ledger(timestamptz) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. One table, one pull. Two passes: upsert (parents first) and delete
--    (children first). Each runs inside its own sub-transaction in the caller.
--    Rows written by one statement are not visible to that statement's other
--    parts, so the ledger is always recorded in a second statement.
-- ---------------------------------------------------------------------------
create or replace function practice_private.pull_upsert_table(tname text, force_reconcile boolean)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  mode text := practice_private.pull_table_mode(tname);
  pk text := practice_private.pull_pk_column(tname);
  stamp text := practice_private.pull_stamp_column(tname);
  cols text := practice_private.pull_shared_columns(tname);
  setlist text;
  wm timestamptz;
  live_max timestamptz;
  live_count bigint;
  ledger_count bigint;
  ids text[] := '{}';
  ids2 text[] := '{}';
  overwritten bigint := 0;
  do_reconcile boolean := force_reconcile;
begin
  if pk is null then
    return jsonb_build_object('skipped', 'no single-column primary key');
  end if;

  select live_watermark into wm from practice_private.pull_state where tbl = tname;
  if not found then
    insert into practice_private.pull_state (tbl, live_watermark) values (tname, '-infinity');
    wm := '-infinity';
  end if;

  -- Cheap probe first: skip a table live has not touched.
  if stamp is not null then
    execute format('select count(*), max(%I) from public.%I', stamp, tname) into live_count, live_max;
  else
    execute format('select count(*), null::timestamptz from public.%I', tname) into live_count, live_max;
    do_reconcile := true; -- no stamp column: the id anti-join is the only way
  end if;
  select count(*) into ledger_count from practice_private.pull_ledger where tbl = tname;
  if live_count <> ledger_count then do_reconcile := true; end if;

  if stamp is not null and not do_reconcile and (live_max is null or live_max <= wm) then
    update practice_private.pull_state set last_ok_at = now(), last_error = null where tbl = tname;
    return jsonb_build_object('inserted', 0, 'updated', 0, 'overwritten_practice_edits', 0, 'changed', false);
  end if;

  select string_agg(format('%I = excluded.%I', a.attname, a.attname), ', ')
    into setlist
  from pg_attribute a
  where a.attrelid = to_regclass('practice.' || quote_ident(tname))
    and a.attnum > 0 and not a.attisdropped and a.attgenerated = '' and a.attname <> pk
    and exists (select 1 from pg_attribute b where b.attrelid = to_regclass('public.' || quote_ident(tname)) and b.attname = a.attname and not b.attisdropped);

  -- (a) New live rows: not in the ledger and not already on the practice copy
  --     (a practice-created row with the same id is left alone).
  execute format(
    'with src as (
       select l.* from public.%1$I l
       where (%3$s or l.%2$I > %4$L::timestamptz - interval ''2 minutes'') and (%8$s)
         and not exists (select 1 from practice_private.pull_ledger g where g.tbl = %5$L and g.pk = l.%6$I::text)
         and not exists (select 1 from practice.%1$I p where p.%6$I = l.%6$I)
     ), ins as (
       insert into practice.%1$I (%7$s) select %7$s from src returning %6$I
     )
     select coalesce(array_agg(%6$I::text), ''{}'') from ins',
    tname, coalesce(stamp, pk), case when stamp is null or do_reconcile then 'true' else 'false' end, wm, tname, pk, cols, practice_private.pull_row_filter(tname, 'l'))
    into ids;
  if cardinality(ids) > 0 then
    execute format(
      'insert into practice_private.pull_ledger (tbl, pk, live_stamp, practice_hash)
       select %1$L, p.%2$I::text, %3$s, md5(to_jsonb(p)::text)
       from practice.%4$I p join public.%4$I l on l.%2$I = p.%2$I
       where p.%2$I::text = any($1)
       on conflict (tbl, pk) do nothing',
      tname, pk, case when stamp is null then 'now()' else format('l.%I', stamp) end, tname) using ids;
  end if;

  -- (b) Changed live rows: in the ledger, and live''s stamp moved since we copied.
  --     Office tables: live wins (the practice version is logged first when the
  --     team had edited it). Page-work tables: only untouched practice rows change.
  if stamp is not null then
    execute format(
      'insert into practice_private.pull_log (tbl, pk, action, detail)
       select %1$L, p.%2$I::text, ''live_replaced_practice_edit'', jsonb_build_object(''practice_row'', to_jsonb(p))
       from practice.%3$I p
       join practice_private.pull_ledger g on g.tbl = %1$L and g.pk = p.%2$I::text
       join public.%3$I l on l.%2$I = p.%2$I
       where %5$L = ''office'' and (%8$s) and l.%4$I is distinct from g.live_stamp
         and (%6$s or l.%4$I > %7$L::timestamptz - interval ''2 minutes'')
         and md5(to_jsonb(p)::text) is distinct from g.practice_hash',
      tname, pk, tname, stamp, mode, case when do_reconcile then 'true' else 'false' end, wm, practice_private.pull_row_filter(tname, 'l'));
    get diagnostics overwritten = row_count;

    execute format(
      'with cand as (
         select l.* from public.%1$I l
         join practice_private.pull_ledger g on g.tbl = %5$L and g.pk = l.%6$I::text
         left join practice.%1$I p on p.%6$I = l.%6$I
         where (%3$s or l.%2$I > %4$L::timestamptz - interval ''2 minutes'') and (%10$s)
           and l.%2$I is distinct from g.live_stamp
           and (%8$L = ''office'' or p.%6$I is null or md5(to_jsonb(p)::text) is not distinct from g.practice_hash)
       ), upd as (
         insert into practice.%1$I (%7$s) select %7$s from cand
         on conflict (%6$I) do update set %9$s
         returning %6$I
       )
       select coalesce(array_agg(%6$I::text), ''{}'') from upd',
      tname, stamp, case when do_reconcile then 'true' else 'false' end, wm, tname, pk, cols, mode, setlist, practice_private.pull_row_filter(tname, 'l'))
      into ids2;
    if cardinality(ids2) > 0 then
      execute format(
        'update practice_private.pull_ledger g
           set live_stamp = l.%1$I, practice_hash = md5(to_jsonb(p)::text), copied_at = now()
         from practice.%2$I p join public.%2$I l on l.%3$I = p.%3$I
         where g.tbl = %4$L and g.pk = p.%3$I::text and p.%3$I::text = any($1)',
        stamp, tname, pk, tname) using ids2;
    end if;
  end if;

  update practice_private.pull_state
    set live_watermark = greatest(coalesce(live_watermark, '-infinity'), coalesce(live_max, live_watermark, '-infinity')),
        last_ok_at = now(), last_error = null
    where tbl = tname;
  return jsonb_build_object('inserted', cardinality(ids), 'updated', cardinality(ids2), 'overwritten_practice_edits', overwritten,
    'changed', cardinality(ids) > 0 or cardinality(ids2) > 0);
end;
$$;
revoke all on function practice_private.pull_upsert_table(text, boolean) from public, anon, authenticated;

-- Live deletes: a ledger row whose live row is gone. Team-created rows are
-- not in the ledger, so they are never deleted. Office tables only; page
-- work the team may still be using stays and is logged.
create or replace function practice_private.pull_delete_table(tname text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  mode text := practice_private.pull_table_mode(tname);
  pk text := practice_private.pull_pk_column(tname);
  deleted bigint := 0;
begin
  if pk is null then return jsonb_build_object('deleted', 0); end if;
  if mode = 'office' then
    execute format(
      'with gone as (
         select g.pk from practice_private.pull_ledger g
         where g.tbl = %2$L and not exists (select 1 from public.%1$I l where l.%3$I::text = g.pk)
       ), del as (
         delete from practice.%1$I p where p.%3$I::text in (select pk from gone) and (%4$s) returning %3$I
       )
       select count(*) from del',
      tname, tname, pk, practice_private.pull_row_filter(tname, 'p')) into deleted;
    execute format(
      'delete from practice_private.pull_ledger g where g.tbl = %2$L
         and not exists (select 1 from public.%1$I l where l.%3$I::text = g.pk)
         and not exists (select 1 from practice.%1$I p where p.%3$I::text = g.pk)',
      tname, tname, pk);
  else
    execute format(
      'with gone as (
         select g.pk from practice_private.pull_ledger g
         where g.tbl = %2$L and not exists (select 1 from public.%1$I l where l.%3$I::text = g.pk)
       ), led as (
         delete from practice_private.pull_ledger g where g.tbl = %2$L and g.pk in (select pk from gone)
       )
       insert into practice_private.pull_log (tbl, pk, action, detail)
       select %2$L, pk, ''live_deleted_pagework_kept'', ''{}''::jsonb from gone',
      tname, tname, pk);
  end if;
  update practice_private.pull_state set last_reconcile_at = now() where tbl = tname;
  return jsonb_build_object('deleted', deleted, 'changed', deleted > 0);
end;
$$;
revoke all on function practice_private.pull_delete_table(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. The entry point the practice data endpoint calls. Service role only.
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
  last_ok timestamptz;
  run_id bigint;
  reconcile boolean := false;
  stamps_live jsonb;
  stamps_practice jsonb;
  i integer;
begin
  if not (current_user in ('postgres', 'supabase_admin', 'practice_puller') or jwt_role = 'service_role') then
    raise exception 'practice.pull_from_live() may only be run with the service role';
  end if;
  select * into settings from practice_private.pull_settings where id;
  if settings is null or not settings.enabled then
    return jsonb_build_object('ok', false, 'reason', 'disabled', 'last_ok_at', (select max(last_ok_at) from practice_private.pull_state));
  end if;
  if practice_private.pull_guards_missing() > 0 then
    return jsonb_build_object('ok', false, 'reason', 'guards_missing', 'missing', practice_private.pull_guards_missing(),
      'last_ok_at', (select max(last_ok_at) from practice_private.pull_state));
  end if;
  -- One pull at a time; a second caller just reads what the first wrote.
  if not pg_try_advisory_xact_lock(hashtext('ldtt.practice_pull')) then
    return jsonb_build_object('ok', true, 'reason', 'busy', 'last_ok_at', (select max(last_ok_at) from practice_private.pull_state));
  end if;
  select max(last_ok_at) into last_ok from practice_private.pull_state;
  if last_ok is not null and last_ok > now() - make_interval(secs => settings.min_interval_ms / 1000.0) then
    return jsonb_build_object('ok', true, 'reason', 'fresh', 'last_ok_at', last_ok);
  end if;
  if coalesce((select min(last_reconcile_at) from practice_private.pull_state), '-infinity') < now() - make_interval(secs => settings.reconcile_every_seconds) then
    reconcile := true;
  end if;

  insert into practice_private.pull_runs default values returning id into run_id;
  -- Practice triggers stay quiet for the rest of this transaction.
  perform set_config('ldtt.practice_pull', 'on', true);
  ordered := practice_private.pull_table_order();

  -- Pass 1: inserts and live-wins updates, parents first.
  foreach tname in array ordered loop
    begin
      one := practice_private.pull_upsert_table(tname, reconcile);
      per := per || jsonb_build_object(tname, one);
      if coalesce((one ->> 'changed')::boolean, false) then changed_tables := changed_tables || tname; end if;
    exception when others then
      errors := errors || jsonb_build_object('table', tname, 'error', sqlerrm);
      update practice_private.pull_state set last_error = sqlerrm where tbl = tname;
      insert into practice_private.pull_log (tbl, action, detail) values (tname, 'error', jsonb_build_object('error', sqlerrm));
    end;
  end loop;

  -- Pass 2: live deletes, children first.
  if reconcile then
    for i in reverse cardinality(ordered)..1 loop
      tname := ordered[i];
      begin
        one := practice_private.pull_delete_table(tname);
        if coalesce((one ->> 'changed')::boolean, false) then
          changed_tables := changed_tables || tname;
          per := per || jsonb_build_object(tname, coalesce(per -> tname, '{}'::jsonb) || one);
        end if;
      exception when others then
        errors := errors || jsonb_build_object('table', tname, 'error', sqlerrm);
        update practice_private.pull_state set last_error = sqlerrm where tbl = tname;
        insert into practice_private.pull_log (tbl, action, detail) values (tname, 'error', jsonb_build_object('error', sqlerrm));
      end;
    end loop;
  end if;

  -- The visits tile reads site_settings.portal_visit_stamps; copy it only when it moved.
  begin
    select value into stamps_live from public.site_settings where key = 'portal_visit_stamps';
    select value into stamps_practice from practice.site_settings where key = 'portal_visit_stamps';
    if stamps_live is not null and md5(stamps_live::text) is distinct from md5(coalesce(stamps_practice, '{}'::jsonb)::text) then
      insert into practice.site_settings (key, value) values ('portal_visit_stamps', stamps_live)
        on conflict (key) do update set value = excluded.value;
      changed_tables := changed_tables || 'site_settings';
    end if;
  exception when others then
    errors := errors || jsonb_build_object('table', 'site_settings', 'error', sqlerrm);
  end;

  -- Keep the log small.
  delete from practice_private.pull_log where at < now() - interval '30 days';
  delete from practice_private.pull_runs where started_at < now() - interval '7 days';

  update practice_private.pull_runs
    set finished_at = now(), ok = jsonb_array_length(errors) = 0,
        result = jsonb_build_object('changed', to_jsonb(changed_tables), 'errors', errors, 'reconcile', reconcile)
    where id = run_id;

  return jsonb_build_object(
    'ok', jsonb_array_length(errors) = 0,
    'last_ok_at', now(),
    'changed', to_jsonb(changed_tables),
    'reconcile', reconcile,
    'per_table', per,
    'errors', errors
  );
end;
$$;
revoke all on function practice.pull_from_live() from public, anon, authenticated;
grant execute on function practice.pull_from_live() to service_role;

-- What the top bar shows: how many practice rows differ from live and why.
create or replace function practice.pull_status()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  tname text;
  pk text;
  edited bigint;
  created bigint;
  per jsonb := '{}'::jsonb;
  total_edited bigint := 0;
  total_created bigint := 0;
begin
  foreach tname in array practice_private.pull_table_order() loop
    pk := practice_private.pull_pk_column(tname);
    if pk is null then continue; end if;
    execute format(
      'select
         (select count(*) from practice.%1$I p join practice_private.pull_ledger g on g.tbl = %2$L and g.pk = p.%3$I::text where md5(to_jsonb(p)::text) is distinct from g.practice_hash),
         (select count(*) from practice.%1$I p where not exists (select 1 from practice_private.pull_ledger g where g.tbl = %2$L and g.pk = p.%3$I::text))',
      tname, tname, pk) into edited, created;
    if edited > 0 or created > 0 then
      per := per || jsonb_build_object(tname, jsonb_build_object('edited', edited, 'created', created));
    end if;
    total_edited := total_edited + edited;
    total_created := total_created + created;
  end loop;
  return jsonb_build_object(
    'enabled', (select enabled from practice_private.pull_settings where id),
    'last_ok_at', (select max(last_ok_at) from practice_private.pull_state),
    'last_error', (select string_agg(tbl || ': ' || last_error, '; ') from practice_private.pull_state where last_error is not null),
    'guards_missing', practice_private.pull_guards_missing(),
    'practice_edited', total_edited,
    'practice_created', total_created,
    'per_table', per
  );
end;
$$;
revoke all on function practice.pull_status() from public, anon, authenticated;
grant execute on function practice.pull_status() to service_role;

-- ---------------------------------------------------------------------------
-- 7. A Reset must leave the guards and the ledger in place, because
--    practice.reset_from_live() re-creates every practice trigger from live's
--    unguarded definition. Same body as 20260905210000, plus the two calls.
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
  if not (current_user in ('postgres', 'supabase_admin') or jwt_role = 'service_role') then
    raise exception 'practice.reset_from_live_by() may only be run with the service role';
  end if;
  if array_length(string_to_array(trim(who), ' '), 1) < 2 then
    raise exception 'A full name (first and last) is required to reset the practice copy';
  end if;
  result := practice.reset_from_live();
  reset_moment := now();
  insert into practice_private.reset_log (reset_by_name, reset_by_email, rows)
  values (left(trim(who), 200), nullif(left(trim(coalesce(reset_by_email, '')), 254), ''), coalesce(result -> 'rows', '{}'::jsonb));
  -- pull-on-read (rule 46): guards back on every re-created trigger, ledger re-seeded.
  perform practice_private.apply_pull_guards();
  perform practice_private.seed_pull_ledger(reset_moment);
  -- The three practice-only testing logins are off on live; the practice copy keeps them on.
  update practice.portal_users set active = true, access_status = 'active'
    where lower(email) in ('superadmin@lorenzosdogtrainingteam.com', 'officeadmin@lorenzosdogtrainingteam.com', 'trainer@lorenzosdogtrainingteam.com');
  return result || jsonb_build_object('reset_by_name', left(trim(who), 200), 'pull_ledger_seeded', true);
end;
$$;
revoke all on function practice.reset_from_live_by(text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 8. Least-privilege ownership when the role exists, then guards + seed now.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'practice_puller') then
    begin
      execute 'alter function practice.pull_from_live() owner to practice_puller';
      execute 'alter function practice.pull_status() owner to practice_puller';
      execute 'alter function practice_private.pull_upsert_table(text, boolean) owner to practice_puller';
      execute 'alter function practice_private.pull_delete_table(text) owner to practice_puller';
      execute 'alter function practice_private.seed_pull_ledger(timestamptz) owner to practice_puller';
    exception when others then
      raise notice 'pull functions stay owned by the current role (%)', sqlerrm;
    end;
  end if;
end $$;

select practice_private.apply_pull_guards() as guarded_triggers;
select practice_private.seed_pull_ledger() as ledger;
