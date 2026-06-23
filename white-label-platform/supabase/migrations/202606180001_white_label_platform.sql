-- Lorenzo's Dog Training Team white-label trainer platform.
-- Apply to a Supabase development branch before production.

create extension if not exists pgcrypto;
create extension if not exists citext;

create schema if not exists private;

create table if not exists public.app_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'trainer' check (role in ('admin', 'trainer', 'staff')),
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trainers (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'archived')),
  full_name text not null,
  business_name text,
  email citext,
  phone text,
  headshot_url text,
  primary_city text,
  primary_state text,
  service_area text,
  short_bio text,
  trainer_since_year integer,
  specialties text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.design_templates (
  id uuid primary key default gen_random_uuid(),
  template_key text not null unique,
  name text not null,
  description text,
  category text not null default 'landing',
  active boolean not null default true,
  schema jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trainer_sites (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.trainers(id) on delete cascade,
  design_template_id uuid references public.design_templates(id) on delete set null,
  slug citext not null unique,
  status text not null default 'draft' check (status in ('draft', 'published', 'paused', 'archived')),
  site_name text not null,
  logo_url text,
  theme jsonb not null default '{}'::jsonb,
  seo_title text,
  seo_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

create table if not exists public.trainer_domains (
  id uuid primary key default gen_random_uuid(),
  trainer_site_id uuid not null references public.trainer_sites(id) on delete cascade,
  domain citext not null unique,
  domain_type text not null default 'custom' check (domain_type in ('default', 'custom')),
  status text not null default 'pending' check (status in ('pending', 'verified', 'active', 'failed', 'archived')),
  is_primary boolean not null default false,
  verification_token text not null default encode(gen_random_bytes(24), 'hex'),
  dns_target text,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.site_sections (
  id uuid primary key default gen_random_uuid(),
  trainer_site_id uuid not null references public.trainer_sites(id) on delete cascade,
  section_key text not null,
  sort_order integer not null default 0,
  enabled boolean not null default true,
  content jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (trainer_site_id, section_key)
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  trainer_site_id uuid not null references public.trainer_sites(id) on delete cascade,
  trainer_id uuid not null references public.trainers(id) on delete cascade,
  status text not null default 'new' check (status in ('new', 'contacted', 'qualified', 'booked', 'won', 'lost', 'spam')),
  name text not null,
  email citext,
  phone text,
  dog_name text,
  dog_age text,
  training_goals text,
  message text,
  source_url text,
  source_domain citext,
  utm jsonb not null default '{}'::jsonb,
  user_agent text,
  ip_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lead_events (
  id uuid primary key default gen_random_uuid(),
  trainer_site_id uuid not null references public.trainer_sites(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete cascade,
  event_type text not null check (event_type in ('page_view', 'cta_click', 'form_started', 'form_submitted', 'phone_click', 'email_click', 'domain_verified')),
  event_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.domain_verification_events (
  id uuid primary key default gen_random_uuid(),
  trainer_domain_id uuid not null references public.trainer_domains(id) on delete cascade,
  status text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select exists (
    select 1
    from public.app_profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  );
$$;

create or replace function private.owns_trainer(p_trainer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select exists (
    select 1
    from public.trainers t
    where t.id = p_trainer_id
      and t.owner_user_id = auth.uid()
  );
$$;

create or replace function private.owns_site(p_site_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select exists (
    select 1
    from public.trainer_sites s
    join public.trainers t on t.id = s.trainer_id
    where s.id = p_site_id
      and t.owner_user_id = auth.uid()
  );
$$;

drop trigger if exists set_app_profiles_updated_at on public.app_profiles;
create trigger set_app_profiles_updated_at
before update on public.app_profiles
for each row execute function private.set_updated_at();

drop trigger if exists set_trainers_updated_at on public.trainers;
create trigger set_trainers_updated_at
before update on public.trainers
for each row execute function private.set_updated_at();

drop trigger if exists set_design_templates_updated_at on public.design_templates;
create trigger set_design_templates_updated_at
before update on public.design_templates
for each row execute function private.set_updated_at();

drop trigger if exists set_trainer_sites_updated_at on public.trainer_sites;
create trigger set_trainer_sites_updated_at
before update on public.trainer_sites
for each row execute function private.set_updated_at();

drop trigger if exists set_trainer_domains_updated_at on public.trainer_domains;
create trigger set_trainer_domains_updated_at
before update on public.trainer_domains
for each row execute function private.set_updated_at();

drop trigger if exists set_site_sections_updated_at on public.site_sections;
create trigger set_site_sections_updated_at
before update on public.site_sections
for each row execute function private.set_updated_at();

drop trigger if exists set_leads_updated_at on public.leads;
create trigger set_leads_updated_at
before update on public.leads
for each row execute function private.set_updated_at();

create index if not exists trainers_owner_user_id_idx on public.trainers(owner_user_id);
create index if not exists trainers_market_idx on public.trainers(primary_state, primary_city);
create index if not exists trainer_sites_trainer_id_idx on public.trainer_sites(trainer_id);
create index if not exists trainer_sites_status_idx on public.trainer_sites(status);
create index if not exists trainer_domains_site_id_idx on public.trainer_domains(trainer_site_id);
create index if not exists trainer_domains_domain_idx on public.trainer_domains(domain);
create index if not exists site_sections_site_sort_idx on public.site_sections(trainer_site_id, sort_order);
create index if not exists leads_site_created_idx on public.leads(trainer_site_id, created_at desc);
create index if not exists leads_trainer_status_idx on public.leads(trainer_id, status);
create index if not exists lead_events_site_created_idx on public.lead_events(trainer_site_id, created_at desc);

alter table public.app_profiles enable row level security;
alter table public.trainers enable row level security;
alter table public.design_templates enable row level security;
alter table public.trainer_sites enable row level security;
alter table public.trainer_domains enable row level security;
alter table public.site_sections enable row level security;
alter table public.leads enable row level security;
alter table public.lead_events enable row level security;
alter table public.domain_verification_events enable row level security;

drop policy if exists "profiles read own or admin" on public.app_profiles;
create policy "profiles read own or admin"
on public.app_profiles for select
to authenticated
using (id = auth.uid() or private.is_admin());

drop policy if exists "profiles update own or admin" on public.app_profiles;
create policy "profiles update own or admin"
on public.app_profiles for update
to authenticated
using (id = auth.uid() or private.is_admin())
with check (id = auth.uid() or private.is_admin());

drop policy if exists "admins manage profiles" on public.app_profiles;
create policy "admins manage profiles"
on public.app_profiles for all
to authenticated
using (private.is_admin())
with check (private.is_admin());

drop policy if exists "admins manage trainers" on public.trainers;
create policy "admins manage trainers"
on public.trainers for all
to authenticated
using (private.is_admin())
with check (private.is_admin());

drop policy if exists "trainer owners read trainers" on public.trainers;
create policy "trainer owners read trainers"
on public.trainers for select
to authenticated
using (owner_user_id = auth.uid());

drop policy if exists "trainer owners update trainers" on public.trainers;
create policy "trainer owners update trainers"
on public.trainers for update
to authenticated
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());

drop policy if exists "admins manage templates" on public.design_templates;
create policy "admins manage templates"
on public.design_templates for all
to authenticated
using (private.is_admin())
with check (private.is_admin());

drop policy if exists "authenticated read active templates" on public.design_templates;
create policy "authenticated read active templates"
on public.design_templates for select
to authenticated
using (active = true or private.is_admin());

drop policy if exists "admins manage sites" on public.trainer_sites;
create policy "admins manage sites"
on public.trainer_sites for all
to authenticated
using (private.is_admin())
with check (private.is_admin());

drop policy if exists "trainer owners read sites" on public.trainer_sites;
create policy "trainer owners read sites"
on public.trainer_sites for select
to authenticated
using (private.owns_trainer(trainer_id));

drop policy if exists "trainer owners update sites" on public.trainer_sites;
create policy "trainer owners update sites"
on public.trainer_sites for update
to authenticated
using (private.owns_trainer(trainer_id))
with check (private.owns_trainer(trainer_id));

drop policy if exists "admins manage domains" on public.trainer_domains;
create policy "admins manage domains"
on public.trainer_domains for all
to authenticated
using (private.is_admin())
with check (private.is_admin());

drop policy if exists "trainer owners read domains" on public.trainer_domains;
create policy "trainer owners read domains"
on public.trainer_domains for select
to authenticated
using (private.owns_site(trainer_site_id));

drop policy if exists "trainer owners insert domains" on public.trainer_domains;
create policy "trainer owners insert domains"
on public.trainer_domains for insert
to authenticated
with check (private.owns_site(trainer_site_id));

drop policy if exists "trainer owners update domains" on public.trainer_domains;
create policy "trainer owners update domains"
on public.trainer_domains for update
to authenticated
using (private.owns_site(trainer_site_id))
with check (private.owns_site(trainer_site_id));

drop policy if exists "admins manage sections" on public.site_sections;
create policy "admins manage sections"
on public.site_sections for all
to authenticated
using (private.is_admin())
with check (private.is_admin());

drop policy if exists "trainer owners manage sections" on public.site_sections;
create policy "trainer owners manage sections"
on public.site_sections for all
to authenticated
using (private.owns_site(trainer_site_id))
with check (private.owns_site(trainer_site_id));

drop policy if exists "admins manage leads" on public.leads;
create policy "admins manage leads"
on public.leads for all
to authenticated
using (private.is_admin())
with check (private.is_admin());

drop policy if exists "trainer owners read leads" on public.leads;
create policy "trainer owners read leads"
on public.leads for select
to authenticated
using (private.owns_trainer(trainer_id));

drop policy if exists "trainer owners update leads" on public.leads;
create policy "trainer owners update leads"
on public.leads for update
to authenticated
using (private.owns_trainer(trainer_id))
with check (private.owns_trainer(trainer_id));

drop policy if exists "admins manage lead events" on public.lead_events;
create policy "admins manage lead events"
on public.lead_events for all
to authenticated
using (private.is_admin())
with check (private.is_admin());

drop policy if exists "trainer owners read lead events" on public.lead_events;
create policy "trainer owners read lead events"
on public.lead_events for select
to authenticated
using (private.owns_site(trainer_site_id));

drop policy if exists "admins manage domain verification events" on public.domain_verification_events;
create policy "admins manage domain verification events"
on public.domain_verification_events for all
to authenticated
using (private.is_admin())
with check (private.is_admin());

drop policy if exists "trainer owners read domain verification events" on public.domain_verification_events;
create policy "trainer owners read domain verification events"
on public.domain_verification_events for select
to authenticated
using (
  exists (
    select 1
    from public.trainer_domains d
    where d.id = trainer_domain_id
      and private.owns_site(d.trainer_site_id)
  )
);

insert into public.design_templates (template_key, name, description, category, active, schema)
values
  (
    'local-service',
    'Local Service Landing Page',
    'A high-conversion local dog training page for obedience, behavior modification, and evaluation requests.',
    'landing',
    true,
    '{
      "layout": "service_first",
      "sections": ["hero", "proof", "services", "method", "lead_form"],
      "cta": "Book Evaluation",
      "tone": "clear, local, trust-building"
    }'::jsonb
  ),
  (
    'premium-authority',
    'Premium Trainer Authority',
    'A polished trainer authority page for markets where trust, proof, and professional presentation matter most.',
    'landing',
    true,
    '{
      "layout": "authority",
      "sections": ["hero", "trainer_profile", "results", "services", "reviews", "lead_form"],
      "cta": "Schedule a Consultation",
      "tone": "premium, confident, experienced"
    }'::jsonb
  ),
  (
    'advanced-specialty',
    'Advanced Specialty Training',
    'A specialty-focused design for protection, service dog, scent work, utility, retrieval, and advanced obedience leads.',
    'landing',
    true,
    '{
      "layout": "advanced_services",
      "sections": ["hero", "specialties", "qualification", "method", "lead_form"],
      "cta": "Request Specialty Training",
      "tone": "serious, expert, selective"
    }'::jsonb
  )
on conflict (template_key) do update
set
  name = excluded.name,
  description = excluded.description,
  category = excluded.category,
  active = excluded.active,
  schema = excluded.schema,
  updated_at = now();

