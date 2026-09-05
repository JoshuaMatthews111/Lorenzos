-- Site Builder: one table for every page type + site-wide settings.
--
-- Decision (2026-09-05): keep the table name ad_pages and ADD page_type
-- ('ad' | 'site' | 'landing') + title, instead of renaming to "pages". Reasons:
-- practice.ad_pages, practice.send_to_live_log (entity_type 'ad_page'),
-- api/send-to-live.js and the reset function all reference ad_pages by name,
-- and a rename would be the one change that could break the practice copy.
-- Every row without a page_type is an ad page (default 'ad'), so the existing
-- Page Studio keeps working untouched.
--
-- site_settings holds the Site Theme (key 'theme') and the menus (key
-- 'navigation') as jsonb. Both schemas (public + practice) get the same
-- structure. Additive only: creates nothing that exists, drops nothing.
-- Requires 20260905120000_ad_pages.sql in the same schema first.

do $$
declare s text;
begin
  foreach s in array array['public', 'practice'] loop
    if not exists (select 1 from information_schema.tables where table_schema = s and table_name = 'ad_pages') then
      raise notice 'schema % has no ad_pages table; skipping', s;
      continue;
    end if;

    execute format('alter table %I.ad_pages add column if not exists page_type text not null default ''ad''', s);
    execute format('alter table %I.ad_pages add column if not exists title text not null default ''''', s);
    execute format('alter table %I.ad_pages drop constraint if exists ad_pages_page_type_check', s);
    execute format('alter table %I.ad_pages add constraint ad_pages_page_type_check check (page_type in (''ad'', ''site'', ''landing''))', s);
    execute format('create index if not exists idx_ad_pages_type_status on %I.ad_pages(page_type, status)', s);
    execute format('comment on column %I.ad_pages.page_type is ''ad = paid-ad landing page (lib/ad-page-template.js, served at /ads/<slug>); site / landing = block-built pages (lib/site-page-template.js, served at /<slug> and /p/<slug>)''', s);

    execute format('create table if not exists %I.site_settings (
      key text primary key check (key ~ ''^[a-z_]{1,40}$''),
      value jsonb not null default ''{}''::jsonb,
      updated_by text,
      updated_at timestamptz not null default now()
    )', s);
    execute format('alter table %I.site_settings enable row level security', s);
    execute format('drop policy if exists "admin_all" on %I.site_settings', s);
    execute format('create policy "admin_all" on %I.site_settings for all to authenticated using (private.is_admin()) with check (private.is_admin())', s);
    execute format('grant select, insert, update, delete on %I.site_settings to authenticated', s);
    execute format('grant all on %I.site_settings to service_role', s);
    execute format('comment on table %I.site_settings is ''Site Builder site-wide settings: key theme (fonts, colours, buttons, spacing, logo) and key navigation (header/footer menus). Served pages read them; the office edits them in Page Studio.''', s);
  end loop;
end $$;

notify pgrst, 'reload schema';

-- The practice twin's admin policy uses the practice helper, like every other
-- practice table (applied as 20260905230100_site_builder_practice_policy).
drop policy if exists "admin_all" on practice.site_settings;
create policy "admin_all" on practice.site_settings for all to authenticated using (practice_private.is_admin()) with check (practice_private.is_admin());
