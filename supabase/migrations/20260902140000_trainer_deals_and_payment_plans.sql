-- Trainer-submitted deals (Tim + Angela, 2026-09-02 call).
--
-- Authorize.net is out. Trainers record the sale in their own portal: what the
-- program sold for, what was collected today, and how the balance is arranged
-- (weekly / monthly / custom dates). The balance is derived, never typed, so
-- nobody can claim they collected more than they sold. Kathy stays the human
-- safeguard on actual pay; this only records and calibrates.
--
-- Also retires the first_session_payment lead status: "Became a Client" is the
-- single terminal win state, and money detail lives on the deal, not the lead.
-- Zero live rows carried first_session_payment at the time of this migration.

create table if not exists public.deals (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  trainer_id uuid not null references public.trainers(id) on delete restrict,
  submitted_by uuid references auth.users(id) on delete set null,
  client_name text not null,
  dog_name text,
  program text not null,
  sold_amount numeric(10,2) not null check (sold_amount >= 0),
  collected_amount numeric(10,2) not null default 0 check (collected_amount >= 0),
  balance_due numeric(10,2) generated always as (sold_amount - collected_amount) stored,
  plan_type text not null default 'paid_in_full'
    check (plan_type in ('paid_in_full','weekly','biweekly','monthly','custom')),
  installments integer not null default 0 check (installments >= 0 and installments <= 60),
  sold_on date not null default current_date,
  status text not null default 'open' check (status in ('open','paid','cancelled')),
  notes text,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint deals_collected_not_over_sold check (collected_amount <= sold_amount)
);

create table if not exists public.deal_payments (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete cascade,
  sequence integer not null check (sequence >= 0),
  amount numeric(10,2) not null check (amount >= 0),
  due_on date not null,
  paid_on date,
  paid_amount numeric(10,2) check (paid_amount is null or paid_amount >= 0),
  reminder_sent_at timestamptz,
  status text not null default 'scheduled'
    check (status in ('collected','scheduled','paid','late','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (deal_id, sequence)
);

create index if not exists idx_deals_trainer on public.deals(trainer_id, sold_on desc);
create index if not exists idx_deals_lead on public.deals(lead_id);
create index if not exists idx_deals_client on public.deals(client_id);
create index if not exists idx_deal_payments_due on public.deal_payments(due_on) where status = 'scheduled';

-- updated_at upkeep, same shape as the other operational tables
create or replace function private.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists deals_touch on public.deals;
create trigger deals_touch before update on public.deals
  for each row execute function private.touch_updated_at();
drop trigger if exists deal_payments_touch on public.deal_payments;
create trigger deal_payments_touch before update on public.deal_payments
  for each row execute function private.touch_updated_at();

-- RLS: admins everything; a trainer sees and writes only their own deals.
alter table public.deals enable row level security;
alter table public.deal_payments enable row level security;

drop policy if exists "admin_all" on public.deals;
create policy "admin_all" on public.deals for all to authenticated
  using (private.is_admin()) with check (private.is_admin());
drop policy if exists "trainer_own_deals" on public.deals;
create policy "trainer_own_deals" on public.deals for select to authenticated
  using (private.is_active_portal_user() and trainer_id = private.current_trainer_id());

drop policy if exists "admin_all" on public.deal_payments;
create policy "admin_all" on public.deal_payments for all to authenticated
  using (private.is_admin()) with check (private.is_admin());
drop policy if exists "trainer_own_deal_payments" on public.deal_payments;
create policy "trainer_own_deal_payments" on public.deal_payments for select to authenticated
  using (
    private.is_active_portal_user()
    and exists (select 1 from public.deals d where d.id = deal_id and d.trainer_id = private.current_trainer_id())
  );

grant select on public.deals, public.deal_payments to authenticated;
grant all on public.deals, public.deal_payments to service_role;

-- Retire first_session_payment. Fold any stragglers into became_client first.
update public.leads set status = 'became_client' where status = 'first_session_payment';

alter table public.leads drop constraint if exists leads_status_check;
alter table public.leads add constraint leads_status_check check (status in (
  'site_visit',
  'new_inquiry',
  'office_contacted',
  'engaged_no_outcome',
  'follow_up_call_needed',
  'evaluation_scheduled',
  'evaluation_cancelled',
  'evaluation_complete',
  'became_client',
  'lost_no_response',
  'lost_price_concern',
  'lost_not_ready',
  'lost_chose_another_provider',
  'lost_client_complaint',
  'lost_no_trainer_area',
  'bad_lead',
  'do_not_contact',
  'archived'
));

-- The client-sync trigger only needs to fire on became_client now.
create or replace function private.sync_client_from_converted_lead()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  converted_client_id uuid;
begin
  if new.status = 'became_client' and old.status is distinct from new.status then
    insert into public.clients (
      lead_id, trainer_id, client_name, phone, email, service_area, zip,
      lead_source, status, sms_consent, email_consent, date_started,
      last_contacted, notes
    ) values (
      new.id, new.trainer_id, trim(new.first_name || ' ' || new.last_name),
      new.phone, new.email, concat_ws(', ', new.city, new.state), new.zip,
      new.lead_source, 'active', new.sms_consent, new.email_consent,
      current_date, current_date, new.office_notes
    )
    on conflict (lead_id) do update
      set trainer_id = excluded.trainer_id,
          client_name = excluded.client_name,
          phone = excluded.phone,
          email = excluded.email,
          service_area = excluded.service_area,
          zip = excluded.zip,
          lead_source = excluded.lead_source,
          sms_consent = excluded.sms_consent,
          email_consent = excluded.email_consent,
          last_contacted = current_date,
          updated_at = now()
    returning id into converted_client_id;
  end if;
  return new;
end $$;

comment on table public.deals is 'Trainer-submitted sales. balance_due is derived; collected can never exceed sold.';
comment on table public.deal_payments is 'Payment plan for a deal. sequence 0 = collected at signing; 1..n = scheduled installments.';
