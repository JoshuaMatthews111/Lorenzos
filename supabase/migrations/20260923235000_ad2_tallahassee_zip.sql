-- LIVE + PRACTICE. The ad 2.0 "tallahassee" row carried ZIP 32504, which is a PENSACOLA ZIP
-- (325xx). That ZIP is the ONLY thing the row is read for outside the page itself: lib/pipeline.js
-- reengageBookingLink() walks the published ad2 rows, finds the area whose ZIP is nearest the
-- lead's (50-mile window) and sends that area's LIVE static ad page with the lead's ZIP prefilled.
-- It is the link in the re-engage invite and, from today, in the unfinished-form follow-up.
--
-- BEFORE-VALUE (both schemas): published_content->>'zip' = '32504'.
-- Measured effect of the wrong value (2026-09-23, against the real live rows):
--   * a genuine Tallahassee lead (32301) matched NO area at all - 32504 sits ~180 miles away,
--     outside the 50-mile window - so the whole Tallahassee market fell back to /book?zip=
--     and never received its own live ad page.
--   * Gulf Breeze (32561) was NOT mis-sent in the end: 32501 (pensacola) is nearer than 32504,
--     so it still resolved to pensacola, 9 miles. The skew existed but pensacola won anyway.
-- After the fix all 12 markets resolve to their own page (proof run recorded in the release notes).
--
-- 32301 is downtown Tallahassee. Nothing else reads this field (grep: lib/pipeline.js:1087 only);
-- the 2.0 page's own form reads the ?zip= query parameter, not this value, so no page content moves.
--
-- UNDO:
--   update public.ad_pages   set published_content = jsonb_set(published_content, '{zip}', '"32504"') where slug = 'tallahassee' and page_type = 'ad2';
--   update practice.ad_pages set published_content = jsonb_set(published_content, '{zip}', '"32504"') where slug = 'tallahassee' and page_type = 'ad2';

update public.ad_pages
   set published_content = jsonb_set(published_content, '{zip}', '"32301"')
 where slug = 'tallahassee'
   and page_type = 'ad2'
   and published_content->>'zip' = '32504';

update practice.ad_pages
   set published_content = jsonb_set(published_content, '{zip}', '"32301"')
 where slug = 'tallahassee'
   and page_type = 'ad2'
   and published_content->>'zip' = '32504';
