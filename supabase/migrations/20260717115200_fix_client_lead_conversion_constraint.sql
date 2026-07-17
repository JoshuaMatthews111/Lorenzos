drop index if exists public.clients_lead_id_unique;

-- PostgreSQL permits multiple NULL values in a regular unique index. Keeping
-- this index non-partial lets the conversion trigger use ON CONFLICT (lead_id)
-- while still preventing duplicate clients for the same converted lead.
create unique index clients_lead_id_unique
  on public.clients (lead_id);
