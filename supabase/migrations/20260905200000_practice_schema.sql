-- Practice copy: a full, separate copy of the office database inside the SAME
-- Supabase project (LDTT ptnzaeprvkgjgtupmcty).
--
-- Why: the old sandbox showed the live rows and refused every write (DO-NOT-BREAK
-- rule 5, retired 2026-09-05). The office wants the practice copy to behave
-- exactly like live — uploads, publishing, trainer logins, deals, notes, lead
-- moves, Page Studio — without any of it touching the real records. So the
-- practice deployment (LDTT_SANDBOX=1) now talks to schema `practice` instead of
-- `public`, and to buckets named `practice-<bucket>`. Same project, same logins
-- (auth.users is shared on purpose), one bill; everything else is separate.
--
-- This migration is ADDITIVE and IDEMPOTENT. It creates nothing in `public` and
-- drops nothing anywhere. It is generated from the live catalog at apply time,
-- not hand-typed: practice.sync_structure_from_live() walks pg_catalog and
-- mirrors every public table (columns, defaults, constraints, indexes,
-- comments, RLS flag), every foreign key (re-pointed at practice.*), every
-- public/private function (schema references rewritten), every trigger, every
-- RLS policy, the storage.objects policies (re-pointed at practice-* buckets),
-- table/function grants for anon / authenticated / service_role, the three
-- office_*_sheet views, and the realtime publication membership.
--
-- Schemas:
--   practice          mirrors public
--   practice_private  mirrors private (is_admin, current_trainer_id, triggers…)
--
-- practice.reset_from_live()  — "Reset practice copy": re-syncs the structure,
--   truncates every practice table in one FK-safe statement and copies every
--   row from public.* with user triggers off. service_role / postgres only.
--
-- Re-running this file, or calling sync_structure_from_live() again, picks up
-- any table or column that was added to public since (for example ad_pages
-- once supabase/migrations/20260905120000_ad_pages.sql is applied to live).

create schema if not exists practice;
create schema if not exists practice_private;

grant usage on schema practice to anon, authenticated, service_role;
grant usage on schema practice_private to authenticated, service_role;

comment on schema practice is 'PRACTICE COPY of public: what the LDTT_SANDBOX=1 deployment reads and writes. Reset with practice.reset_from_live().';
comment on schema practice_private is 'PRACTICE COPY of private: helper and trigger functions re-pointed at the practice schema.';

-- ---------------------------------------------------------------------------
-- Structure sync (catalog-driven, idempotent)
-- ---------------------------------------------------------------------------
create or replace function practice.sync_structure_from_live()
returns jsonb
language plpgsql
security definer
set search_path = practice, practice_private, pg_catalog, pg_temp
as $$
declare
  t record;
  c record;
  r record;
  b record;
  def text;
  pname text;
  privs text;
  fn_sig text;
  practice_schema text;
  summary jsonb := '{}'::jsonb;
  tables_created int := 0;
  columns_added int := 0;
  fks_added int := 0;
  functions_copied int := 0;
  triggers_copied int := 0;
  policies_copied int := 0;
  storage_policies_copied int := 0;
  views_copied int := 0;
  publication_added int := 0;
  notes text[] := '{}';
begin
  -- 1. Tables: same columns, defaults, CHECK/NOT NULL/PK/UNIQUE constraints,
  --    indexes, identity, generated columns, comments (LIKE ... INCLUDING ALL).
  for t in
    select cl.relname as name, cl.oid, cl.relrowsecurity
    from pg_class cl join pg_namespace n on n.oid = cl.relnamespace
    where n.nspname = 'public' and cl.relkind = 'r'
    order by cl.relname
  loop
    if to_regclass('practice.' || quote_ident(t.name)) is null then
      execute format('create table practice.%I (like public.%I including all)', t.name, t.name);
      tables_created := tables_created + 1;
    else
      -- A column added to live since the last sync.
      for c in
        select a.attname,
               format_type(a.atttypid, a.atttypmod) as typ,
               pg_get_expr(d.adbin, d.adrelid) as dflt,
               a.attnotnull
        from pg_attribute a
        left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
        where a.attrelid = t.oid and a.attnum > 0 and not a.attisdropped and a.attgenerated = ''
          and not exists (
            select 1 from pg_attribute p
            where p.attrelid = to_regclass('practice.' || quote_ident(t.name))
              and p.attname = a.attname and not p.attisdropped
          )
      loop
        begin
          execute format('alter table practice.%I add column %I %s %s',
            t.name, c.attname, c.typ,
            case when c.dflt is not null then 'default ' || replace(replace(c.dflt, 'private.', 'practice_private.'), 'public.', 'practice.') else '' end);
          if c.attnotnull then
            begin
              execute format('alter table practice.%I alter column %I set not null', t.name, c.attname);
            exception when others then
              notes := notes || format('%s.%s left nullable: %s', t.name, c.attname, sqlerrm);
            end;
          end if;
          columns_added := columns_added + 1;
        exception when others then
          notes := notes || format('column %s.%s skipped: %s', t.name, c.attname, sqlerrm);
        end;
      end loop;
    end if;

    if t.relrowsecurity then
      execute format('alter table practice.%I enable row level security', t.name);
    end if;
    if obj_description(t.oid, 'pg_class') is not null then
      execute format('comment on table practice.%I is %L', t.name, obj_description(t.oid, 'pg_class'));
    end if;
  end loop;

  -- 2. Foreign keys, re-pointed at practice.* (auth.users references stay).
  --    With public off the search_path, pg_get_constraintdef qualifies public tables.
  for r in
    select cl.relname as tname, con.conname, pg_get_constraintdef(con.oid) as def
    from pg_constraint con
    join pg_class cl on cl.oid = con.conrelid
    join pg_namespace n on n.oid = cl.relnamespace
    where n.nspname = 'public' and con.contype = 'f'
  loop
    if to_regclass('practice.' || quote_ident(r.tname)) is not null and not exists (
      select 1 from pg_constraint x
      where x.conname = r.conname and x.conrelid = to_regclass('practice.' || quote_ident(r.tname))
    ) then
      def := replace(r.def, 'REFERENCES public.', 'REFERENCES practice.');
      begin
        execute format('alter table practice.%I add constraint %I %s', r.tname, r.conname, def);
        fks_added := fks_added + 1;
      exception when others then
        notes := notes || format('fk %s skipped: %s', r.conname, sqlerrm);
      end;
    end if;
  end loop;

  -- 3. Functions: every function in public and private, with public.→practice.,
  --    private.→practice_private. and the SET search_path clause rewritten so
  --    unqualified names inside the body resolve to the practice tables.
  for r in
    select p.oid, n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private') and p.prokind = 'f'
      and p.proname not in ('sync_structure_from_live', 'reset_from_live')
    order by n.nspname, p.proname
  loop
    def := pg_get_functiondef(r.oid);
    def := replace(def, 'private.', 'practice_private.');
    def := replace(def, 'public.', 'practice.');
    def := replace(def, 'search_path TO ''public''', 'search_path TO ''practice'', ''practice_private''');
    def := replace(def, 'search_path TO ''public'', ', 'search_path TO ''practice'', ''practice_private'', ');
    practice_schema := case when r.nspname = 'private' then 'practice_private' else 'practice' end;
    begin
      execute def;
      functions_copied := functions_copied + 1;
      fn_sig := format('%I.%I(%s)', practice_schema, r.proname, replace(replace(r.args, 'private.', 'practice_private.'), 'public.', 'practice.'));
      execute format('revoke all on function %s from public', fn_sig);
      foreach pname in array array['anon', 'authenticated', 'service_role'] loop
        if has_function_privilege(pname, r.oid, 'EXECUTE') then
          execute format('grant execute on function %s to %I', fn_sig, pname);
        else
          execute format('revoke execute on function %s from %I', fn_sig, pname);
        end if;
      end loop;
    exception when others then
      notes := notes || format('function %s.%s skipped: %s', r.nspname, r.proname, sqlerrm);
    end;
  end loop;

  -- 4. Views (office_*_sheet), same definition against practice tables.
  for r in
    select cl.relname, cl.oid, cl.reloptions
    from pg_class cl join pg_namespace n on n.oid = cl.relnamespace
    where n.nspname = 'public' and cl.relkind = 'v'
  loop
    begin
      def := replace(replace(pg_get_viewdef(r.oid, true), 'private.', 'practice_private.'), 'public.', 'practice.');
      execute format('create or replace view practice.%I as %s', r.relname, def);
      if r.reloptions is not null and array_to_string(r.reloptions, ',') ~* 'security_invoker=(true|on)' then
        execute format('alter view practice.%I set (security_invoker = on)', r.relname);
      end if;
      views_copied := views_copied + 1;
    exception when others then
      notes := notes || format('view %s skipped: %s', r.relname, sqlerrm);
    end;
  end loop;

  -- 5. Triggers (after the functions they call exist).
  for r in
    select cl.relname as tname, tg.tgname, pg_get_triggerdef(tg.oid) as def
    from pg_trigger tg
    join pg_class cl on cl.oid = tg.tgrelid
    join pg_namespace n on n.oid = cl.relnamespace
    where n.nspname = 'public' and not tg.tgisinternal
  loop
    if to_regclass('practice.' || quote_ident(r.tname)) is null then continue; end if;
    def := replace(replace(r.def, 'private.', 'practice_private.'), 'public.', 'practice.');
    begin
      execute format('drop trigger if exists %I on practice.%I', r.tgname, r.tname);
      execute def;
      triggers_copied := triggers_copied + 1;
    exception when others then
      notes := notes || format('trigger %s on %s skipped: %s', r.tgname, r.tname, sqlerrm);
    end;
  end loop;

  -- 6. RLS policies, same names, same roles, expressions re-pointed.
  for r in select * from pg_policies where schemaname = 'public' loop
    if to_regclass('practice.' || quote_ident(r.tablename)) is null then continue; end if;
    begin
      execute format('drop policy if exists %I on practice.%I', r.policyname, r.tablename);
      execute format('create policy %I on practice.%I as %s for %s to %s %s %s',
        r.policyname, r.tablename, r.permissive, r.cmd,
        (select string_agg(quote_ident(x), ', ') from unnest(r.roles) as x),
        case when r.qual is not null then 'using (' || replace(replace(r.qual, 'private.', 'practice_private.'), 'public.', 'practice.') || ')' else '' end,
        case when r.with_check is not null then 'with check (' || replace(replace(r.with_check, 'private.', 'practice_private.'), 'public.', 'practice.') || ')' else '' end);
      policies_copied := policies_copied + 1;
    exception when others then
      notes := notes || format('policy %s on %s skipped: %s', r.policyname, r.tablename, sqlerrm);
    end;
  end loop;

  -- 7. Storage: every storage.objects policy that names a live bucket gets a
  --    twin for the practice-<bucket> (the buckets themselves are created with
  --    the Storage API by api/practice-reset.js / the setup script, since
  --    storage.buckets rows carry per-bucket limits the API owns).
  for b in select id from storage.buckets where id not like 'practice-%' and id <> 'sandbox-practice-layer' loop
    for r in
      select * from pg_policies
      where schemaname = 'storage' and tablename = 'objects' and policyname not like 'practice_%'
        and (coalesce(qual, '') like '%''' || b.id || '''%' or coalesce(with_check, '') like '%''' || b.id || '''%')
    loop
      pname := left('practice_' || b.id || '_' || r.policyname, 63);
      begin
        execute format('drop policy if exists %I on storage.objects', pname);
        execute format('create policy %I on storage.objects as %s for %s to %s %s %s',
          pname, r.permissive, r.cmd,
          (select string_agg(quote_ident(x), ', ') from unnest(r.roles) as x),
          case when r.qual is not null then 'using (' || replace(replace(replace(r.qual, '''' || b.id || '''', '''practice-' || b.id || ''''), 'private.', 'practice_private.'), 'public.', 'practice.') || ')' else '' end,
          case when r.with_check is not null then 'with check (' || replace(replace(replace(r.with_check, '''' || b.id || '''', '''practice-' || b.id || ''''), 'private.', 'practice_private.'), 'public.', 'practice.') || ')' else '' end);
        storage_policies_copied := storage_policies_copied + 1;
      exception when others then
        notes := notes || format('storage policy %s skipped: %s', pname, sqlerrm);
      end;
    end loop;
  end loop;

  -- 8. Grants on tables and views: exactly what each API role has on the
  --    public twin (computed, not assumed).
  for r in
    select cl.relname, cl.oid, cl.relkind
    from pg_class cl join pg_namespace n on n.oid = cl.relnamespace
    where n.nspname = 'public' and cl.relkind in ('r', 'v')
  loop
    if to_regclass('practice.' || quote_ident(r.relname)) is null then continue; end if;
    foreach pname in array array['anon', 'authenticated', 'service_role'] loop
      select string_agg(p, ', ') into privs
      from unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) as p
      where has_table_privilege(pname, r.oid, p);
      execute format('revoke all on practice.%I from %I', r.relname, pname);
      if privs is not null then
        execute format('grant %s on practice.%I to %I', privs, r.relname, pname);
      end if;
    end loop;
  end loop;

  -- 9. Realtime: the practice twins of every public table in supabase_realtime.
  for r in
    select tablename from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public'
  loop
    if to_regclass('practice.' || quote_ident(r.tablename)) is null then continue; end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'practice' and tablename = r.tablename
    ) then
      begin
        execute format('alter publication supabase_realtime add table practice.%I', r.tablename);
        publication_added := publication_added + 1;
      exception when others then
        notes := notes || format('publication add practice.%s skipped: %s', r.tablename, sqlerrm);
      end;
    end if;
  end loop;

  summary := jsonb_build_object(
    'tables_created', tables_created,
    'columns_added', columns_added,
    'foreign_keys_added', fks_added,
    'functions_copied', functions_copied,
    'views_copied', views_copied,
    'triggers_copied', triggers_copied,
    'policies_copied', policies_copied,
    'storage_policies_copied', storage_policies_copied,
    'publication_added', publication_added,
    'notes', to_jsonb(notes)
  );
  return summary;
end;
$$;

revoke all on function practice.sync_structure_from_live() from public, anon, authenticated;
grant execute on function practice.sync_structure_from_live() to service_role;

-- First sync: builds every practice table, function, trigger, policy, grant.
select practice.sync_structure_from_live();

-- ---------------------------------------------------------------------------
-- Page Studio tables. supabase/migrations/20260905120000_ad_pages.sql has not
-- been applied to public yet, so the practice copy carries its own twin of that
-- migration (same DDL, practice names). Once it lands on live, the sync above
-- sees the practice tables already exist and simply mirrors any new column.
-- ---------------------------------------------------------------------------
create table if not exists practice.ad_pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,80}$'),
  market text not null default '',
  city text not null default '',
  state text not null default '',
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  draft_content jsonb not null default '{}'::jsonb,
  published_content jsonb,
  draft_revision integer not null default 1,
  published_revision integer not null default 0,
  published_at timestamptz,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists practice.ad_page_revisions (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references practice.ad_pages(id) on delete cascade,
  revision integer not null,
  kind text not null default 'published' check (kind in ('published', 'draft')),
  content jsonb not null,
  created_by text,
  created_at timestamptz not null default now()
);

create index if not exists idx_ad_pages_status_slug on practice.ad_pages(status, slug);
create index if not exists idx_ad_page_revisions_page on practice.ad_page_revisions(page_id, created_at desc);

drop trigger if exists ad_pages_touch on practice.ad_pages;
create trigger ad_pages_touch before update on practice.ad_pages
  for each row execute function practice_private.touch_updated_at();

alter table practice.ad_pages enable row level security;
alter table practice.ad_page_revisions enable row level security;
drop policy if exists "admin_all" on practice.ad_pages;
create policy "admin_all" on practice.ad_pages for all to authenticated
  using (practice_private.is_admin()) with check (practice_private.is_admin());
drop policy if exists "admin_all" on practice.ad_page_revisions;
create policy "admin_all" on practice.ad_page_revisions for all to authenticated
  using (practice_private.is_admin()) with check (practice_private.is_admin());
grant select, insert, update, delete on practice.ad_pages, practice.ad_page_revisions to authenticated;
grant all on practice.ad_pages, practice.ad_page_revisions to service_role;
comment on table practice.ad_pages is 'PRACTICE COPY. Page Studio ad landing pages. draft_content is edited in the portal; published_content is what /ads/<slug> serves.';
comment on table practice.ad_page_revisions is 'PRACTICE COPY. One row per publish (and optional draft snapshot) so any earlier version of an ad page can be restored.';

-- ---------------------------------------------------------------------------
-- Send-to-live stamps: replaces the old JSON ops log. One row per send so the
-- practice copy can show "Sent to live ✓ at <time>" on the page.
-- ---------------------------------------------------------------------------
create table if not exists practice.send_to_live_log (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('trainer_page', 'ad_page')),
  entity_id text not null,
  slug text,
  live_id text,
  sent_by text,
  sent_at timestamptz not null default now()
);
create index if not exists idx_send_to_live_log_entity on practice.send_to_live_log(entity_type, entity_id, sent_at desc);
alter table practice.send_to_live_log enable row level security;
revoke all on practice.send_to_live_log from anon, authenticated;
grant all on practice.send_to_live_log to service_role;
comment on table practice.send_to_live_log is 'PRACTICE COPY only. Every Send to live, so the practice portal can stamp the page. Service role only.';

-- ---------------------------------------------------------------------------
-- Reset practice copy to match live.
-- ---------------------------------------------------------------------------
create or replace function practice.reset_from_live()
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
  names text;
  r record;
  tname text;
  remaining text[];
  progressed boolean;
  cols text;
  counts jsonb := '{}'::jsonb;
  n bigint;
  structure jsonb;
begin
  if not (current_user in ('postgres', 'supabase_admin') or jwt_role = 'service_role') then
    raise exception 'practice.reset_from_live() may only be run with the service role';
  end if;

  structure := practice.sync_structure_from_live();

  -- Empty every practice table in one statement (FK-safe). Nothing outside the
  -- practice schema references a practice table, so CASCADE cannot reach public.
  select string_agg(format('practice.%I', cl.relname), ', ') into names
  from pg_class cl join pg_namespace ns on ns.oid = cl.relnamespace
  where ns.nspname = 'practice' and cl.relkind = 'r';
  if names is not null then
    execute 'truncate table ' || names || ' cascade';
  end if;

  -- Copy rows with user triggers off (no double revisions, no re-generated codes).
  for r in
    select cl.relname from pg_class cl join pg_namespace ns on ns.oid = cl.relnamespace
    where ns.nspname = 'practice' and cl.relkind = 'r'
  loop
    execute format('alter table practice.%I disable trigger user', r.relname);
  end loop;

  select array_agg(cl.relname order by cl.relname) into remaining
  from pg_class cl join pg_namespace ns on ns.oid = cl.relnamespace
  where ns.nspname = 'public' and cl.relkind = 'r'
    and to_regclass('practice.' || quote_ident(cl.relname)) is not null;

  while remaining is not null and cardinality(remaining) > 0 loop
    progressed := false;
    foreach tname in array remaining loop
      -- Wait until every practice table this one references (other than itself) is filled.
      if not exists (
        select 1
        from pg_constraint con
        join pg_class p on p.oid = con.confrelid
        join pg_namespace pn on pn.oid = p.relnamespace
        where con.conrelid = to_regclass('practice.' || quote_ident(tname))
          and con.contype = 'f' and pn.nspname = 'practice'
          and p.relname <> tname and p.relname = any(remaining)
      ) then
        select string_agg(quote_ident(a.attname), ', ' order by a.attnum) into cols
        from pg_attribute a
        where a.attrelid = to_regclass('practice.' || quote_ident(tname))
          and a.attnum > 0 and not a.attisdropped and a.attgenerated = ''
          and exists (
            select 1 from pg_attribute b
            where b.attrelid = to_regclass('public.' || quote_ident(tname))
              and b.attname = a.attname and not b.attisdropped
          );
        execute format('insert into practice.%I (%s) select %s from public.%I', tname, cols, cols, tname);
        get diagnostics n = row_count;
        counts := counts || jsonb_build_object(tname, n);
        remaining := array_remove(remaining, tname);
        progressed := true;
      end if;
    end loop;
    if not progressed then
      raise exception 'practice.reset_from_live(): foreign-key cycle among %', remaining;
    end if;
  end loop;

  for r in
    select cl.relname from pg_class cl join pg_namespace ns on ns.oid = cl.relnamespace
    where ns.nspname = 'practice' and cl.relkind = 'r'
  loop
    execute format('alter table practice.%I enable trigger user', r.relname);
  end loop;

  return jsonb_build_object('reset_at', now(), 'rows', counts, 'structure', structure);
end;
$$;

revoke all on function practice.reset_from_live() from public, anon, authenticated;
grant execute on function practice.reset_from_live() to service_role;

comment on function practice.reset_from_live() is 'Reset practice copy to match live: truncates practice.* and copies every row from public.*. Service role only. Never touches public.';

-- Seed the copy once.
select practice.reset_from_live();

-- PostgREST: pick up the new schema's tables and functions.
notify pgrst, 'reload schema';
