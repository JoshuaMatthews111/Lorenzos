-- LIVE twin of supabase/migrations/20260912120100_practice_shantelle_slug.sql.
-- NOT RUN (2026-09-12). Belongs at scripts/sql/2026-09-12-live-shantelle-slug.sql.
-- Run it in the SAME live release that ships shantelletuck.html and the vercel.json
-- redirects /s -> /shantelletuck and /trainer-bio-s -> /trainer-bio-shantelle-tuck.
-- Why: live pages resolve a trainer by slug. If this runs first, live /s shows
-- "Loading trainer page..." forever and /shantelletuck has no static page yet.
-- Before (verified 2026-09-12): public.trainers slug 's' (Shantelle Tuck, Atlanta),
-- public.trainer_pages slug 's', public_url https://www.lorenzosdogtrainingteam.com/s,
-- published_revision 57, locked true. The 17 site_events rows with trainer_slug 's'
-- all carry trainer_id, so her visit counts do not depend on the slug; leave them.
-- Guarded on the old value: a second run is a no-op.
begin;
update public.trainers
   set slug = 'shantelle-tuck'
 where slug = 's' and full_name = 'Shantelle Tuck';
update public.trainer_pages p
   set slug = 'shantelle-tuck',
       public_url = 'https://www.lorenzosdogtrainingteam.com/shantelletuck'
  from public.trainers t
 where p.trainer_id = t.id and t.full_name = 'Shantelle Tuck' and p.slug = 's';
commit;
-- After: open https://www.lorenzosdogtrainingteam.com/shantelletuck in a real browser
-- (#publicSite has content, console clean - rule 43) and
-- curl -sI https://www.lorenzosdogtrainingteam.com/s  -> 308 to /shantelletuck.
