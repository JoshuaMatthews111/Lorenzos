-- Office holds signed consent forms for its existing clients, but that consent was
-- never recorded in the system. These columns record WHEN consent was captured and
-- WHERE it came from, so a bulk send can be justified per client after the fact.
alter table public.clients
  add column if not exists sms_consent_at timestamptz,
  add column if not exists email_consent_at timestamptz,
  add column if not exists consent_source text,
  add column if not exists consent_note text;

create index if not exists idx_clients_sms_sendable
  on public.clients (sms_consent) where archived_at is null;
create index if not exists idx_clients_email_sendable
  on public.clients (email_consent) where archived_at is null;

-- A client may appear only once per campaign. This is what makes a resumed or
-- retried batch safe: the same person can never be queued or sent twice.
create unique index if not exists uq_campaign_recipient_once
  on public.communications_campaign_recipients (campaign_id, client_id);

create index if not exists idx_campaign_recipients_pending
  on public.communications_campaign_recipients (campaign_id, status, created_at);
