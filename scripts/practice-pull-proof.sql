-- Read-only parity proof for rule 46. Run on the LDTT project with the Supabase SQL tool.
select 'privileges' as check, count(*) filter (where has_table_privilege('practice_puller', format('public.%I', tablename), 'INSERT,UPDATE,DELETE,TRUNCATE')) as public_write_rights_for_puller
from pg_tables where schemaname = 'public' and exists (select 1 from pg_roles where rolname = 'practice_puller');
select 'guards' as check, practice_private.pull_guards_missing() as missing;
select 'function_schema' as check, n.nspname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where p.proname = 'pull_from_live';
select 'leads' as tbl, (select count(*) from public.leads) as live, (select count(*) from practice.leads) as practice,
       (select count(*) from public.leads l where not exists (select 1 from practice.leads p where p.id = l.id)) as live_missing_in_practice
union all select 'trainer_applications', (select count(*) from public.trainer_applications), (select count(*) from practice.trainer_applications),
       (select count(*) from public.trainer_applications l where not exists (select 1 from practice.trainer_applications p where p.id = l.id))
union all select 'clients', (select count(*) from public.clients), (select count(*) from practice.clients),
       (select count(*) from public.clients l where not exists (select 1 from practice.clients p where p.id = l.id))
union all select 'office_notes', (select count(*) from public.office_notes), (select count(*) from practice.office_notes),
       (select count(*) from public.office_notes l where not exists (select 1 from practice.office_notes p where p.id = l.id));
select practice.pull_status();
