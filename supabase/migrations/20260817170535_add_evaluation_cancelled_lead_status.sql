-- Office request (Melissa Zuk, 2026-08-15): the pipeline had no way to record an
-- evaluation that was booked and then called off. Staff were forced to pick
-- either "Evaluation Scheduled" (wrong — nobody is coming) or a Lost status
-- (wrong — the lead is still workable), which quietly corrupted the funnel math.
--
-- "evaluation_cancelled" is deliberately NOT a closed status: a cancelled
-- evaluation still belongs in Communications as an assignable lead that needs a
-- call back. Only the became_client / lost_* / bad_lead / do_not_contact /
-- archived values close a lead, and that set is unchanged here.

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
  'first_session_payment',
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
