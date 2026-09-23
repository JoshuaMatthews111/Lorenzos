-- PRACTICE ONLY. Tabatha Shelley's trainer page is published and served at
-- /tabathashelley (tabathashelley.html, data-trainer="tabatha-shelley"), but her
-- practice.trainer_pages row carried public_url NULL. Same shape the Shantelle
-- fix corrected (20260912120100_practice_shantelle_slug.sql): the practice copy's
-- public_url points at the practice host. The live twin (public schema, also
-- NULL today) is NOT touched here; it belongs to a live release.
update practice.trainer_pages
   set public_url = 'https://ldtt-sandbox.vercel.app/tabathashelley'
 where slug = 'tabatha-shelley' and public_url is null;
