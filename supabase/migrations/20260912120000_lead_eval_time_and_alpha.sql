-- Lead cards (meeting 2026-09-11, DO-NOT-BREAK rule 70). APPLIED 2026-09-12 as
-- migration version 20260912073552 "lead_eval_time_and_alpha". Additive only:
-- two new columns on leads in BOTH schemas (the portal reads both). No status
-- vocabulary change (rule 10), no lead count change (rule 1).
alter table public.leads
  add column if not exists eval_scheduled_at timestamptz,
  add column if not exists added_to_alpha boolean not null default false;
alter table practice.leads
  add column if not exists eval_scheduled_at timestamptz,
  add column if not exists added_to_alpha boolean not null default false;
comment on column public.leads.eval_scheduled_at is 'Evaluation date + time the office booked (shown on Eval Scheduled cards). Set from the lead detail panel.';
comment on column public.leads.added_to_alpha is 'Office ticked "Added to Alpha?" = yes (red check on the lead card).';
comment on column practice.leads.eval_scheduled_at is 'Evaluation date + time the office booked (shown on Eval Scheduled cards). Set from the lead detail panel.';
comment on column practice.leads.added_to_alpha is 'Office ticked "Added to Alpha?" = yes (red check on the lead card).';
notify pgrst, 'reload schema';
