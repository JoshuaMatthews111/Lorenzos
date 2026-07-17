create extension if not exists pgcrypto;

create table if not exists public.trainers (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  full_name text not null,
  email text,
  phone text,
  market text,
  service_area text,
  state text,
  bio text,
  headshot_url text,
  status text not null default 'enrolled' check (status in ('enrolled','active','inactive','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trainer_pages (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.trainers(id) on delete cascade,
  template_key text not null default 'mock_5' check (template_key in ('mock_5','mock_6','mock_3')),
  page_status text not null default 'draft' check (page_status in ('no_site_started','draft','published','archived')),
  locked boolean not null default false,
  headline text,
  subheadline text,
  approved_bio text,
  approved_photo_urls text[] not null default '{}',
  approved_review_ids uuid[] not null default '{}',
  social_facebook text,
  social_instagram text,
  social_tiktok text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (trainer_id)
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid references public.trainers(id) on delete set null,
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text not null,
  address_line_1 text,
  address_line_2 text,
  city text,
  state text,
  zip text,
  dog_name text,
  dog_breed text,
  service_interest text,
  lead_source text,
  referral_detail text,
  comments text,
  sms_consent boolean not null default false,
  email_consent boolean,
  status text not null default 'new_inquiry' check (status in (
    'site_visit',
    'new_inquiry',
    'office_contacted',
    'engaged_no_outcome',
    'follow_up_call_needed',
    'evaluation_scheduled',
    'evaluation_complete',
    'first_session_payment',
    'became_client',
    'lost_no_response',
    'lost_price_concern',
    'lost_not_ready',
    'lost_chose_another_provider',
    'bad_lead',
    'do_not_contact',
    'archived'
  )),
  lost_reason text,
  office_notes text,
  source_page text,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lead_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  event_type text not null,
  note text,
  previous_status text,
  new_status text,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete set null,
  trainer_id uuid references public.trainers(id) on delete set null,
  client_name text not null,
  phone text,
  email text,
  service_area text,
  zip text,
  lead_source text,
  status text not null default 'active' check (status in ('active','past','won','lost','bad_lead','do_not_contact','archived')),
  sms_consent boolean,
  email_consent boolean,
  imported_source text,
  date_started date,
  last_contacted date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dogs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  name text,
  breed text,
  age text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.trainer_applications (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text not null,
  referral_source text,
  address_line_1 text,
  address_line_2 text,
  city text,
  state text,
  zip text,
  status text not null default 'new_application' check (status in ('new_application','reviewing','discovery_follow_up','moved_forward','not_a_fit','archived')),
  office_notes text,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.content_submissions (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid references public.trainers(id) on delete set null,
  submission_type text not null check (submission_type in ('photo','video','review','testimonial')),
  title text,
  file_url text,
  notes text,
  status text not null default 'pending' check (status in ('pending','approved','declined','archived')),
  office_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.client_import_batches (
  id uuid primary key default gen_random_uuid(),
  imported_source text not null default 'spreadsheet',
  file_name text,
  row_count integer not null default 0,
  status text not null default 'preview' check (status in ('preview','imported','failed','archived')),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.client_import_rows (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.client_import_batches(id) on delete cascade,
  raw_payload jsonb not null default '{}'::jsonb,
  action text not null default 'create' check (action in ('create','update','skip','merge')),
  warnings text[] not null default '{}',
  imported_client_id uuid references public.clients(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.site_events (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid references public.trainers(id) on delete set null,
  event_type text not null,
  page_path text,
  referrer text,
  user_agent text,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_leads_status_created_at on public.leads (status, created_at desc);
create index if not exists idx_leads_trainer_created_at on public.leads (trainer_id, created_at desc);
create index if not exists idx_clients_status on public.clients (status);
create index if not exists idx_clients_trainer on public.clients (trainer_id);
create index if not exists idx_trainer_applications_status on public.trainer_applications (status, created_at desc);
create index if not exists idx_content_submissions_status on public.content_submissions (status, created_at desc);
create index if not exists idx_site_events_trainer_created_at on public.site_events (trainer_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_trainers_updated_at on public.trainers;
create trigger set_trainers_updated_at before update on public.trainers
for each row execute function public.set_updated_at();

drop trigger if exists set_trainer_pages_updated_at on public.trainer_pages;
create trigger set_trainer_pages_updated_at before update on public.trainer_pages
for each row execute function public.set_updated_at();

drop trigger if exists set_leads_updated_at on public.leads;
create trigger set_leads_updated_at before update on public.leads
for each row execute function public.set_updated_at();

drop trigger if exists set_clients_updated_at on public.clients;
create trigger set_clients_updated_at before update on public.clients
for each row execute function public.set_updated_at();

drop trigger if exists set_trainer_applications_updated_at on public.trainer_applications;
create trigger set_trainer_applications_updated_at before update on public.trainer_applications
for each row execute function public.set_updated_at();

drop trigger if exists set_content_submissions_updated_at on public.content_submissions;
create trigger set_content_submissions_updated_at before update on public.content_submissions
for each row execute function public.set_updated_at();

alter table public.trainers enable row level security;
alter table public.trainer_pages enable row level security;
alter table public.leads enable row level security;
alter table public.lead_events enable row level security;
alter table public.clients enable row level security;
alter table public.dogs enable row level security;
alter table public.trainer_applications enable row level security;
alter table public.content_submissions enable row level security;
alter table public.client_import_batches enable row level security;
alter table public.client_import_rows enable row level security;
alter table public.site_events enable row level security;

comment on table public.leads is 'LDTT office-owned lead funnel. Conversion means first_session_payment or became_client.';
comment on table public.trainer_applications is 'Website trainer application submissions for recruiting@lorenzosdogtrainingteam.com follow-up.';
comment on table public.clients is 'Central client list for active, past, won, lost, bad lead, and do-not-contact records.';
comment on table public.trainer_pages is 'Office-controlled trainer landing page setup and lock state. Trainers do not publish pages.';
