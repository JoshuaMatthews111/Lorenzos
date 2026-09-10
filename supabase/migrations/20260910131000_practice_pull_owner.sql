-- Rule 46 least privilege (2026-09-10, Claude). The pull functions must run as
-- practice_puller, a NOLOGIN role that can READ every live table (through
-- pg_read_all_data) and has NO write right on schema public. Then a future
-- slip in the pull code cannot write live: the database itself refuses.
-- The first attempt swallowed its error; this one fails loudly.
-- Touches no object in schema public.

-- PG16+: changing an owner needs SET on the new owner role.
grant practice_puller to postgres with inherit false, set true;
grant create on schema practice, practice_private to practice_puller;

alter function practice.pull_from_live() owner to practice_puller;
alter function practice.pull_status() owner to practice_puller;
alter function practice.pull_last_ok() owner to practice_puller;
alter function practice_private.pull_upsert_table(text, boolean) owner to practice_puller;
alter function practice_private.pull_delete_table(text) owner to practice_puller;
alter function practice_private.pull_apply_row(text, text, text, jsonb, text[]) owner to practice_puller;
alter function practice_private.seed_pull_ledger(timestamptz) owner to practice_puller;

-- The puller writes practice tables only.
grant select, insert, update, delete on all tables in schema practice to practice_puller;
grant select, insert, update, delete on all tables in schema practice_private to practice_puller;
grant usage, select on all sequences in schema practice, practice_private to practice_puller;

-- Prove it in the same transaction: no write right on any live table.
do $$
declare
  bad integer;
  wrong_owner integer;
begin
  select count(*) into bad
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm')
    and (has_table_privilege('practice_puller', c.oid, 'INSERT') or has_table_privilege('practice_puller', c.oid, 'UPDATE')
      or has_table_privilege('practice_puller', c.oid, 'DELETE') or has_table_privilege('practice_puller', c.oid, 'TRUNCATE'));
  if bad > 0 then raise exception 'practice_puller has write rights on % live relations', bad; end if;
  select count(*) into wrong_owner
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where ((n.nspname = 'practice' and p.proname in ('pull_from_live', 'pull_status', 'pull_last_ok'))
      or (n.nspname = 'practice_private' and p.proname in ('pull_upsert_table', 'pull_delete_table', 'pull_apply_row', 'seed_pull_ledger')))
    and pg_get_userbyid(p.proowner) <> 'practice_puller';
  if wrong_owner > 0 then raise exception '% pull functions are not owned by practice_puller', wrong_owner; end if;
end $$;
