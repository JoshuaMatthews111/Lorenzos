-- Rule 61 review fix (2026-09-11): on the practice copy, live's website text wins for a
-- spot live has edited (pull mode 'office', the default). As page work, a trainee's
-- practice touch of a spot blocked live's newer words there until a Reset.
create or replace function practice_private.pull_table_mode(tname text)
 returns text
 language sql
 immutable
as $function$
  select case
    when tname in ('ad_pages', 'ad_page_revisions', 'send_to_live_log', 'reset_log', 'site_settings') then 'never'
    when tname in ('trainers', 'trainer_pages', 'trainer_page_versions', 'content_submissions', 'review_publications') then 'pagework'
    else 'office'
  end
$function$;
