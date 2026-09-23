-- Ad landing pages 2.0 go LIVE (Joshua 2026-09-23, decision sheet: Arrison's 2.0 landing page updates
-- "should be pushed and go live too"; he could not see them in the live Site Builder because rule 85
-- kept them practice-only). The live twin of 20260914140000_practice_ad2_page_type.sql: public.ad_pages
-- accepts the fourth page type "ad2", served at /ads/<slug> by lib/ad2-page-template.js.
-- Additive: widens one CHECK, drops nothing, changes no row.
alter table public.ad_pages drop constraint if exists ad_pages_page_type_check;
alter table public.ad_pages add constraint ad_pages_page_type_check check (page_type = any (array['ad'::text, 'site'::text, 'landing'::text, 'ad2'::text]));
