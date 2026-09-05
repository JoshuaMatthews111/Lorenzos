-- Page Studio: ad landing pages served from the database, no deploy needed.
--
-- Mirrors trainer_pages: a draft the office edits, a published copy the public
-- route serves, and a revision row for every publish so any version can be put
-- back with one click. Office-only: trainers never see or edit ad pages.
--
-- Apply to the LDTT project (ptnzaeprvkgjgtupmcty) before deploying the Page
-- Studio code. Until it is applied, /api/ad-pages answers with a plain
-- "table missing" message and nothing else in the portal changes.

create table if not exists public.ad_pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,80}$'),
  market text not null default '',
  city text not null default '',
  state text not null default '',
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  draft_content jsonb not null default '{}'::jsonb,
  published_content jsonb,
  draft_revision integer not null default 1,
  published_revision integer not null default 0,
  published_at timestamptz,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ad_page_revisions (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.ad_pages(id) on delete cascade,
  revision integer not null,
  kind text not null default 'published' check (kind in ('published', 'draft')),
  content jsonb not null,
  created_by text,
  created_at timestamptz not null default now()
);

create index if not exists idx_ad_pages_status_slug on public.ad_pages(status, slug);
create index if not exists idx_ad_page_revisions_page on public.ad_page_revisions(page_id, created_at desc);

-- Same updated_at trigger the deals tables use.
create or replace function private.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists ad_pages_touch on public.ad_pages;
create trigger ad_pages_touch before update on public.ad_pages
  for each row execute function private.touch_updated_at();

-- RLS: the same admin pattern as every other table (DO-NOT-BREAK #4). No
-- trainer policy exists on purpose. The API routes use the service role.
alter table public.ad_pages enable row level security;
alter table public.ad_page_revisions enable row level security;

drop policy if exists "admin_all" on public.ad_pages;
create policy "admin_all" on public.ad_pages for all to authenticated
  using (private.is_admin()) with check (private.is_admin());
drop policy if exists "admin_all" on public.ad_page_revisions;
create policy "admin_all" on public.ad_page_revisions for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

grant select, insert, update, delete on public.ad_pages, public.ad_page_revisions to authenticated;
grant all on public.ad_pages, public.ad_page_revisions to service_role;

comment on table public.ad_pages is 'Page Studio ad landing pages. draft_content is edited in the portal; published_content is what /ads/<slug> serves.';
comment on table public.ad_page_revisions is 'One row per publish (and optional draft snapshot) so any earlier version of an ad page can be restored.';
