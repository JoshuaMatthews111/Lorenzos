-- Lorenzo's Dog Training Team office-controlled back-office foundation.
-- Supabase is not connected yet; this migration is ready for the future project.

create extension if not exists pgcrypto;
create extension if not exists citext;

create table if not exists public.ldtt_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('super_admin', 'admin', 'call_center', 'marketing', 'trainer')),
  display_name text,
  email citext,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ldtt_trainers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  full_name text not null,
  state text,
  market text,
  service_area text,
  phone text,
  email citext,
  headshot_url text,
  bio text,
  live_profile_url text,
  status text not null default 'enrolled' check (status in ('enrolled', 'active', 'paused', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ldtt_trainer_pages (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.ldtt_trainers(id) on delete cascade,
  slug citext not null unique,
  status text not null default 'not_started' check (status in ('not_started', 'draft', 'published', 'locked', 'archived')),
  approved_headline text,
  approved_bio text,
  approved_services text[] not null default '{}',
  approved_photos jsonb not null default '[]'::jsonb,
  approved_reviews jsonb not null default '[]'::jsonb,
  locked_by uuid references auth.users(id) on delete set null,
  locked_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ldtt_contact_submissions (
  id uuid primary key default gen_random_uuid(),
  source_page text,
  page_url text,
  first_name text,
  last_name text,
  address_line_1 text,
  address_line_2 text,
  city text,
  state text,
  zip text,
  email citext,
  phone text,
  i_want_to text,
  heard_about_us text,
  vet_or_previous_client text,
  comments text,
  sms_consent boolean not null default false,
  forwarded_to citext,
  google_form_synced boolean not null default false,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.ldtt_leads (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid references public.ldtt_trainers(id) on delete set null,
  trainer_page_id uuid references public.ldtt_trainer_pages(id) on delete set null,
  contact_submission_id uuid references public.ldtt_contact_submissions(id) on delete set null,
  lead_name text not null,
  phone text,
  email citext,
  dog_name text,
  dog_breed text,
  dog_issue text,
  source text,
  source_url text,
  utm jsonb not null default '{}'::jsonb,
  status text not null default 'new_lead' check (status in ('new_lead', 'contacted', 'evaluation_scheduled', 'no_response', 'became_client', 'lost', 'refer_to_ttrg', 'archived')),
  office_last_update text,
  assigned_to uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table if not exists public.ldtt_lead_notes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.ldtt_leads(id) on delete cascade,
  note text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.ldtt_lead_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.ldtt_leads(id) on delete cascade,
  trainer_id uuid references public.ldtt_trainers(id) on delete set null,
  event_type text not null check (event_type in ('site_visit', 'cta_click', 'form_submitted', 'office_contacted', 'status_changed', 'note_added')),
  event_data jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.ldtt_clients (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid references public.ldtt_trainers(id) on delete set null,
  lead_id uuid references public.ldtt_leads(id) on delete set null,
  client_name text not null,
  phone text,
  email citext,
  service_area text,
  zip text,
  lead_source text,
  status text not null default 'active' check (status in ('active', 'past', 'won', 'lost', 'bad_lead', 'do_not_contact')),
  sms_consent boolean,
  email_consent boolean,
  imported_source text,
  date_started date,
  last_contacted date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ldtt_dogs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.ldtt_clients(id) on delete cascade,
  dog_name text,
  dog_breed text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.ldtt_import_batches (
  id uuid primary key default gen_random_uuid(),
  uploaded_by uuid references auth.users(id) on delete set null,
  imported_source text not null,
  status text not null default 'preview' check (status in ('preview', 'approved', 'imported', 'rejected')),
  row_count integer not null default 0,
  created_at timestamptz not null default now(),
  imported_at timestamptz
);

create table if not exists public.ldtt_import_rows (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.ldtt_import_batches(id) on delete cascade,
  row_number integer not null,
  raw_payload jsonb not null,
  mapped_payload jsonb not null default '{}'::jsonb,
  duplicate_action text check (duplicate_action in ('create', 'update', 'skip', 'merge')),
  review_status text not null default 'needs_review' check (review_status in ('needs_review', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create table if not exists public.ldtt_content_submissions (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid references public.ldtt_trainers(id) on delete cascade,
  submitted_by uuid references auth.users(id) on delete set null,
  submission_type text not null check (submission_type in ('photo', 'video', 'review', 'testimonial')),
  title text,
  content text,
  media_url text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined', 'revoked')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists ldtt_leads_trainer_status_idx on public.ldtt_leads(trainer_id, status);
create index if not exists ldtt_leads_created_idx on public.ldtt_leads(created_at desc);
create index if not exists ldtt_clients_status_idx on public.ldtt_clients(status);
create index if not exists ldtt_contact_submissions_created_idx on public.ldtt_contact_submissions(created_at desc);
