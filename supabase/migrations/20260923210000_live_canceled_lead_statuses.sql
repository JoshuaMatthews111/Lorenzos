-- GO-LIVE 2026-09-23 step 1b: public.leads accepts the two Canceled statuses the portal ships
-- (canceled_refunded, canceled_write_off). This is the exact 20-value list practice has carried
-- since 2026-09-17. Purely additive: it only widens what the column accepts; no row changes.
-- Undo: drop the constraint and re-add it without the two canceled_* values.
alter table public.leads drop constraint leads_status_check;
alter table public.leads add constraint leads_status_check check (status = any (array[
  'site_visit', 'new_inquiry', 'office_contacted', 'engaged_no_outcome', 'follow_up_call_needed',
  'evaluation_scheduled', 'evaluation_cancelled', 'evaluation_complete', 'became_client',
  'lost_no_response', 'lost_price_concern', 'lost_not_ready', 'lost_chose_another_provider',
  'lost_client_complaint', 'lost_no_trainer_area', 'canceled_refunded', 'canceled_write_off',
  'bad_lead', 'do_not_contact', 'archived'
]::text[]));
