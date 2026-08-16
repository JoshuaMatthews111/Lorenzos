-- Communications is intentionally additive. The established lead outcome column
-- remains the reporting source of truth; claim/contact activity lives alongside it.
create extension if not exists supabase_vault with schema vault;

alter table public.leads
  add column if not exists communications_code text,
  add column if not exists claim_status text not null default 'new'
    check (claim_status in ('new', 'claimed', 'contacted', 'appointment_set', 'won', 'lost')),
  add column if not exists claimed_by uuid references auth.users(id) on delete set null,
  add column if not exists claimed_at timestamptz,
  add column if not exists first_response_at timestamptz,
  add column if not exists communications_alert_list_id uuid,
  add column if not exists communications_escalated_at timestamptz,
  add column if not exists communications_released_at timestamptz;

create table if not exists public.communications_alert_lists (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 120),
  active boolean not null default true,
  rules jsonb not null default '{"any_new_lead":false,"markets":[],"cities":[],"service_interests":[],"urgent_keywords":[]}'::jsonb,
  timezone text not null default 'America/New_York',
  quiet_hours_start time,
  quiet_hours_end time,
  urgent_overrides_quiet_hours boolean not null default false,
  escalation_list_id uuid references public.communications_alert_lists(id) on delete set null,
  escalation_minutes integer not null default 10 check (escalation_minutes between 1 and 1440),
  claim_follow_up_minutes integer not null default 20 check (claim_follow_up_minutes between 1 and 1440),
  stale_claim_minutes integer not null default 30 check (stale_claim_minutes between 5 and 1440),
  auto_release_stale_claims boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.communications_alert_members (
  id uuid primary key default gen_random_uuid(),
  alert_list_id uuid not null references public.communications_alert_lists(id) on delete cascade,
  portal_user_id uuid references auth.users(id) on delete set null,
  display_name text not null,
  phone text not null,
  active boolean not null default true,
  consented_at timestamptz,
  stopped_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (alert_list_id, phone)
);

create table if not exists public.communications_alert_deliveries (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  lead_id uuid references public.leads(id) on delete cascade,
  alert_list_id uuid references public.communications_alert_lists(id) on delete set null,
  alert_member_id uuid references public.communications_alert_members(id) on delete set null,
  delivery_kind text not null check (delivery_kind in ('new_lead','escalation','claim_notice','release_notice','follow_up_ask','manager_escalation','test')),
  provider_message_id text,
  status text not null default 'queued' check (status in ('queued','sent','delivered','failed','suppressed')),
  payload jsonb not null default '{}'::jsonb,
  error_summary text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.communications_settings (
  setting_key text primary key check (setting_key in (
    'simpletexting_api_key','simpletexting_signing_secret','simpletexting_sending_number',
    'resend_api_key','resend_signing_secret','resend_from_address',
    'unsubscribe_secret','default_quiet_hours','default_escalation_minutes','reply_keywords'
  )),
  secret_id uuid,
  value jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.communications_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 120),
  channel text not null check (channel in ('email','sms','mms')),
  subject text,
  body_html text,
  body_text text not null,
  media_url text,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.communications_testers (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  email text,
  phone text,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (email is not null or phone is not null)
);

create table if not exists public.communications_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  template_id uuid references public.communications_templates(id) on delete set null,
  channel text not null check (channel in ('email','sms','mms')),
  subject text,
  body_html text,
  body_text text not null,
  media_url text,
  audience_filter jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft','sending','completed','failed','cancelled')),
  total_recipients integer not null default 0,
  sent_recipients integer not null default 0,
  failed_recipients integer not null default 0,
  next_offset integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  sent_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.communications_campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.communications_campaigns(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  recipient_email text,
  recipient_phone text,
  rendered_subject text,
  rendered_body text,
  provider_message_id text,
  status text not null default 'queued' check (status in ('queued','sending','sent','failed','suppressed')),
  sending_at timestamptz,
  sent_at timestamptz,
  error_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, client_id)
);

create table if not exists public.communications_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('simpletexting','resend')),
  provider_event_id text not null,
  event_type text not null,
  outcome text,
  raw_payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);

create index if not exists idx_communications_lists_active on public.communications_alert_lists (active, created_at desc);
create index if not exists idx_communications_members_phone on public.communications_alert_members (phone) where active and stopped_at is null;
create index if not exists idx_communications_deliveries_lead on public.communications_alert_deliveries (lead_id, created_at desc);
create index if not exists idx_communications_campaign_recipients_status on public.communications_campaign_recipients (campaign_id, status, created_at);
create index if not exists idx_communications_webhook_provider_event on public.communications_webhook_events (provider, provider_event_id);
create index if not exists idx_leads_communications_claim on public.leads (claim_status, claimed_at, created_at desc);
create index if not exists idx_leads_communications_code on public.leads (communications_code) where communications_code is not null;

drop trigger if exists set_communications_alert_lists_updated_at on public.communications_alert_lists;
create trigger set_communications_alert_lists_updated_at before update on public.communications_alert_lists
for each row execute function public.set_updated_at();
drop trigger if exists set_communications_alert_members_updated_at on public.communications_alert_members;
create trigger set_communications_alert_members_updated_at before update on public.communications_alert_members
for each row execute function public.set_updated_at();
drop trigger if exists set_communications_alert_deliveries_updated_at on public.communications_alert_deliveries;
create trigger set_communications_alert_deliveries_updated_at before update on public.communications_alert_deliveries
for each row execute function public.set_updated_at();
drop trigger if exists set_communications_templates_updated_at on public.communications_templates;
create trigger set_communications_templates_updated_at before update on public.communications_templates
for each row execute function public.set_updated_at();
drop trigger if exists set_communications_testers_updated_at on public.communications_testers;
create trigger set_communications_testers_updated_at before update on public.communications_testers
for each row execute function public.set_updated_at();
drop trigger if exists set_communications_campaigns_updated_at on public.communications_campaigns;
create trigger set_communications_campaigns_updated_at before update on public.communications_campaigns
for each row execute function public.set_updated_at();
drop trigger if exists set_communications_campaign_recipients_updated_at on public.communications_campaign_recipients;
create trigger set_communications_campaign_recipients_updated_at before update on public.communications_campaign_recipients
for each row execute function public.set_updated_at();

create or replace function private.assign_communications_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate text;
  attempts integer := 0;
begin
  if new.communications_code is not null then return new; end if;
  loop
    candidate := lpad((1000 + floor(random() * 9000))::integer::text, 4, '0');
    exit when not exists (
      select 1 from public.leads
      where communications_code = candidate
        and created_at >= now() - interval '31 days'
    );
    attempts := attempts + 1;
    if attempts > 100 then
      raise exception 'Could not allocate a unique communications lead code';
    end if;
  end loop;
  new.communications_code := candidate;
  return new;
end;
$$;

drop trigger if exists assign_communications_code_before_lead_insert on public.leads;
create trigger assign_communications_code_before_lead_insert
before insert on public.leads
for each row execute function private.assign_communications_code();

create or replace function public.communications_store_setting(
  p_key text,
  p_secret text default null,
  p_value jsonb default '{}'::jsonb,
  p_updated_by uuid default null
)
returns public.communications_settings
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  result public.communications_settings;
  existing public.communications_settings;
  next_secret_id uuid;
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
  if p_key not in ('simpletexting_api_key','simpletexting_signing_secret','simpletexting_sending_number','resend_api_key','resend_signing_secret','resend_from_address','unsubscribe_secret','default_quiet_hours','default_escalation_minutes','reply_keywords') then
    raise exception 'Unsupported communications setting';
  end if;
  select * into existing from public.communications_settings where setting_key = p_key;
  next_secret_id := existing.secret_id;
  if nullif(trim(coalesce(p_secret, '')), '') is not null then
    if existing.secret_id is null then
      next_secret_id := vault.create_secret(p_secret, concat('communications_', p_key), 'Lorenzo communications provider setting');
    else
      perform vault.update_secret(existing.secret_id, p_secret, concat('communications_', p_key), 'Lorenzo communications provider setting');
    end if;
  end if;
  insert into public.communications_settings (setting_key, secret_id, value, updated_by)
  values (p_key, next_secret_id, coalesce(p_value, '{}'::jsonb), p_updated_by)
  on conflict (setting_key) do update
    set secret_id = excluded.secret_id,
        value = excluded.value,
        updated_by = excluded.updated_by,
        updated_at = now()
  returning * into result;
  return result;
end;
$$;

create or replace function public.communications_read_setting_secret(p_key text)
returns text
language sql
security definer
set search_path = public, vault
as $$
  select ds.decrypted_secret
  from public.communications_settings setting
  join vault.decrypted_secrets ds on ds.id = setting.secret_id
  where setting.setting_key = p_key
    and auth.role() = 'service_role'
  limit 1;
$$;

create or replace function public.communications_claim_lead(p_lead_id uuid, p_staff_id uuid)
returns table (claimed boolean, lead_id uuid, code text, owner_id uuid, owner_name text)
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed_row public.leads;
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
  update public.leads
  set claimed_by = p_staff_id,
      claimed_at = now(),
      claim_status = 'claimed'
  where id = p_lead_id
    and claimed_by is null
    and status not in ('became_client','first_session_payment','lost_no_response','lost_price_concern','lost_not_ready','lost_chose_another_provider','lost_client_complaint','lost_no_trainer_area','bad_lead','do_not_contact','archived')
  returning * into claimed_row;
  if claimed_row.id is not null then
    insert into public.lead_events (lead_id, event_type, note, actor_user_id, event_key, occurred_at, raw_payload)
    values (claimed_row.id, 'lead_claimed', 'Lead claimed through Communications', p_staff_id, concat('communications:claim:', claimed_row.id, ':', claimed_row.version, ':', extract(epoch from claimed_row.claimed_at)), claimed_row.claimed_at, jsonb_build_object('source','communications'));
    return query select true, claimed_row.id, claimed_row.communications_code, p_staff_id, null::text;
    return;
  end if;
  return query
    select false, lead.id, lead.communications_code, lead.claimed_by,
      coalesce(portal.display_name, concat_ws(' ', portal.first_name, portal.last_name), portal.email)
    from public.leads lead
    left join public.portal_users portal on portal.user_id = lead.claimed_by
    where lead.id = p_lead_id;
end;
$$;

create or replace function public.communications_release_lead(p_lead_id uuid, p_staff_id uuid, p_reason text default 'passed')
returns public.leads
language plpgsql
security definer
set search_path = public
as $$
declare result public.leads;
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
  update public.leads
  set claimed_by = null,
      claimed_at = null,
      claim_status = 'new',
      communications_released_at = now()
  where id = p_lead_id
    and (claimed_by = p_staff_id or p_staff_id is null)
  returning * into result;
  if result.id is null then raise exception 'Lead cannot be released by this staff member'; end if;
  insert into public.lead_events (lead_id, event_type, note, actor_user_id, event_key, occurred_at, raw_payload)
  values (result.id, 'lead_released', coalesce(nullif(trim(p_reason), ''), 'released'), p_staff_id, concat('communications:release:', result.id, ':', extract(epoch from result.communications_released_at)), result.communications_released_at, jsonb_build_object('source','communications'));
  return result;
end;
$$;

create or replace function public.communications_mark_contacted(p_lead_id uuid, p_staff_id uuid, p_note text default null)
returns public.leads
language plpgsql
security definer
set search_path = public
as $$
declare result public.leads;
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
  update public.leads
  set first_response_at = coalesce(first_response_at, now()),
      claim_status = 'contacted',
      status = case when status in ('new_inquiry','site_visit','follow_up_call_needed') then 'office_contacted' else status end
  where id = p_lead_id
    and (claimed_by = p_staff_id or p_staff_id is null)
  returning * into result;
  if result.id is null then raise exception 'Lead cannot be marked contacted by this staff member'; end if;
  insert into public.lead_events (lead_id, event_type, note, actor_user_id, event_key, occurred_at, raw_payload)
  values (result.id, 'first_contact_logged', nullif(trim(p_note), ''), p_staff_id, concat('communications:contact:', result.id, ':', extract(epoch from result.first_response_at)), now(), jsonb_build_object('source','communications'));
  return result;
end;
$$;

revoke all on function public.communications_store_setting(text, text, jsonb, uuid) from public, anon, authenticated;
revoke all on function public.communications_read_setting_secret(text) from public, anon, authenticated;
revoke all on function public.communications_claim_lead(uuid, uuid) from public, anon, authenticated;
revoke all on function public.communications_release_lead(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.communications_mark_contacted(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.communications_store_setting(text, text, jsonb, uuid) to service_role;
grant execute on function public.communications_read_setting_secret(text) to service_role;
grant execute on function public.communications_claim_lead(uuid, uuid) to service_role;
grant execute on function public.communications_release_lead(uuid, uuid, text) to service_role;
grant execute on function public.communications_mark_contacted(uuid, uuid, text) to service_role;

alter table public.communications_alert_lists enable row level security;
alter table public.communications_alert_members enable row level security;
alter table public.communications_alert_deliveries enable row level security;
alter table public.communications_settings enable row level security;
alter table public.communications_templates enable row level security;
alter table public.communications_testers enable row level security;
alter table public.communications_campaigns enable row level security;
alter table public.communications_campaign_recipients enable row level security;
alter table public.communications_webhook_events enable row level security;

revoke all on public.communications_alert_lists, public.communications_alert_members, public.communications_alert_deliveries,
  public.communications_settings, public.communications_templates, public.communications_testers,
  public.communications_campaigns, public.communications_campaign_recipients, public.communications_webhook_events
from anon, authenticated;
