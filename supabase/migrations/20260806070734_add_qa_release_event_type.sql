alter table public.lifecycle_events
  drop constraint if exists lifecycle_events_event_type_check;

alter table public.lifecycle_events
  add constraint lifecycle_events_event_type_check
  check (event_type in (
    'site_visit',
    'cta_click',
    'form_received',
    'evaluation_scheduled',
    'evaluation_completed',
    'became_client',
    'lost_no_response',
    'recruiting_inquiry',
    'full_application',
    'status_correction',
    'baseline_adjustment',
    'qa_release_check'
  ));
