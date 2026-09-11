-- Website text the office edits in the Page Editor (rule 61, Joshua 2026-09-11).
-- One row per edited spot. The code keeps every other word; the public page swaps in
-- live_value for its spot (script.js, textContent only). Server-only table: RLS on, no
-- policies, no anon/authenticated grants. The practice copy gets the same table; there it
-- counts as the team's page work (pull mode 'pagework').

create table if not exists public.site_text (
  id text primary key,
  page text not null,
  key text not null,
  draft_value text check (draft_value is null or char_length(draft_value) between 1 and 1000),
  live_value text check (live_value is null or char_length(live_value) between 1 and 1000),
  base_default text,
  draft_by_name text,
  draft_by_login text,
  draft_at timestamptz,
  published_by_name text,
  published_by_login text,
  published_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (page, key)
);
alter table public.site_text enable row level security;
revoke all on public.site_text from anon, authenticated;
grant select, insert, update, delete on public.site_text to service_role;

create table if not exists practice.site_text (like public.site_text including all);
alter table practice.site_text enable row level security;
revoke all on practice.site_text from anon, authenticated;
grant select, insert, update, delete on practice.site_text to service_role;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'practice_puller') then
    execute 'grant select, insert, update, delete on practice.site_text to practice_puller';
  end if;
end $$;

create or replace function practice_private.pull_table_mode(tname text)
 returns text
 language sql
 immutable
as $function$
  select case
    when tname in ('ad_pages', 'ad_page_revisions', 'send_to_live_log', 'reset_log', 'site_settings') then 'never'
    when tname in ('trainers', 'trainer_pages', 'trainer_page_versions', 'content_submissions', 'review_publications', 'site_text') then 'pagework'
    else 'office'
  end
$function$;
