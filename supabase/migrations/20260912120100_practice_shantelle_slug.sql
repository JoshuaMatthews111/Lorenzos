-- PRACTICE ONLY. APPLIED 2026-09-12 as migration version 20260912073554
-- "practice_shantelle_slug". Shantelle Tuck (Atlanta) got slug 's' when her page
-- was set up; every other trainer uses first-last. Her static page is
-- /shantelletuck (shantelletuck.html, data-trainer="shantelle-tuck"); vercel.json
-- sends /s and /trainer-bio-s there with a 308.
-- The LIVE twin is scripts/sql/2026-09-12-live-shantelle-slug.sql and is NOT run:
-- it must ship in the same live release as shantelletuck.html + the redirects.
update practice.trainers
   set slug = 'shantelle-tuck'
 where slug = 's' and full_name = 'Shantelle Tuck';
update practice.trainer_pages p
   set slug = 'shantelle-tuck',
       public_url = 'https://ldtt-sandbox.vercel.app/shantelletuck'
  from practice.trainers t
 where p.trainer_id = t.id and t.full_name = 'Shantelle Tuck' and p.slug = 's';
