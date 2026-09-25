-- Lost vs Archive (Zoom 2026-09-24, Lorenzo: "Lost would be there's no need in us contacting them again").
-- Two NEW hard-no Lost statuses, in BOTH schemas (live public + the practice copy):
--   lost_method_not_a_fit   "Doesn't believe in our training method"
--   lost_dog_not_qualified  "Dog doesn't qualify" (health, age, etc.)
-- Purely additive (DO-NOT-BREAK rule 10): the CHECK only widens what the column accepts. No row changes, no value is
-- renamed; the older soft Lost statuses stay valid on the rows that carry them.
-- Undo: drop each constraint and re-add it without the two new values (only possible while no row carries them).
alter table public.leads drop constraint leads_status_check;
alter table public.leads add constraint leads_status_check check (status = any (array[
  'site_visit', 'new_inquiry', 'office_contacted', 'engaged_no_outcome', 'follow_up_call_needed',
  'evaluation_scheduled', 'evaluation_cancelled', 'evaluation_complete', 'became_client',
  'lost_no_response', 'lost_price_concern', 'lost_not_ready', 'lost_chose_another_provider',
  'lost_client_complaint', 'lost_no_trainer_area', 'canceled_refunded', 'canceled_write_off',
  'bad_lead', 'do_not_contact', 'archived',
  'lost_method_not_a_fit', 'lost_dog_not_qualified'
]::text[]));

alter table practice.leads drop constraint leads_status_check;
alter table practice.leads add constraint leads_status_check check (status = any (array[
  'site_visit', 'new_inquiry', 'office_contacted', 'engaged_no_outcome', 'follow_up_call_needed',
  'evaluation_scheduled', 'evaluation_cancelled', 'evaluation_complete', 'became_client',
  'lost_no_response', 'lost_price_concern', 'lost_not_ready', 'lost_chose_another_provider',
  'lost_client_complaint', 'lost_no_trainer_area', 'canceled_refunded', 'canceled_write_off',
  'bad_lead', 'do_not_contact', 'archived',
  'lost_method_not_a_fit', 'lost_dog_not_qualified'
]::text[]));
