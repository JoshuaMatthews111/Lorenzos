-- Existing leads predate the insert trigger. Give active records a stable short code
-- without changing their original lead status, owner, source, or contact information.
with missing_codes as (
  select id, 1000 + row_number() over (order by created_at, id) as next_code
  from public.leads
  where communications_code is null
    and status not in (
      'archived', 'do_not_contact', 'bad_lead', 'became_client', 'first_session_payment',
      'lost_no_response', 'lost_price_concern', 'lost_not_ready', 'lost_chose_another_provider',
      'lost_client_complaint', 'lost_no_trainer_area'
    )
)
update public.leads lead
set communications_code = lpad(missing_codes.next_code::text, 4, '0')
from missing_codes
where lead.id = missing_codes.id;
