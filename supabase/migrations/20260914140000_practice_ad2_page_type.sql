-- Ad landing pages 2.0 in Page Studio (Joshua 2026-09-14; meeting 2026-09-11: "Add the 2.0 pages into Page Studio
-- so Arrison can edit them herself"). A fourth page type, "ad2", served at /ads/<slug> by lib/ad2-page-template.js.
-- PRACTICE COPY ONLY: public.ad_pages keeps ad / site / landing, so a 2.0 page cannot reach live until this is
-- added there on purpose (Send to live refuses ad2 pages). Additive: widens one CHECK, drops nothing.
alter table practice.ad_pages drop constraint if exists ad_pages_page_type_check;
alter table practice.ad_pages add constraint ad_pages_page_type_check check (page_type = any (array['ad'::text, 'site'::text, 'landing'::text, 'ad2'::text]));
