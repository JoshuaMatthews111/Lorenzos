drop index if exists public.idx_leads_source_submission_unique;
drop index if exists public.idx_applications_source_submission_unique;

create unique index idx_leads_source_submission_unique
  on public.leads (source_submission_id);
create unique index idx_applications_source_submission_unique
  on public.trainer_applications (source_submission_id);
