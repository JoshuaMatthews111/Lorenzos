-- Keep the office spreadsheet views as complete mirrors of the current public forms.
-- These views intentionally expose explicit columns plus raw_payload so exports do
-- not become short when the public form adds fields.

create or replace view public.office_leads_sheet
with (security_invoker = true)
as
select
  l.id,
  l.created_at as received_at,
  l.updated_at,
  l.version,
  l.status,
  l.first_name,
  l.last_name,
  concat_ws(' ', l.first_name, l.last_name) as client_name,
  l.email,
  l.phone,
  l.address_line_1,
  l.address_line_2,
  l.city,
  l.state,
  l.zip,
  l.dog_name,
  l.dog_breed,
  l.service_interest,
  l.lead_source,
  l.referral_detail,
  l.comments,
  l.office_notes,
  l.source_page,
  l.trainer_market as market,
  l.trainer_city,
  l.trainer_state,
  l.assigned_trainer_name,
  pu.display_name as assigned_to,
  l.sms_consent,
  case when l.sms_consent is true then 'Yes' else 'No' end as sms_opt_in,
  l.email_consent,
  l.raw_payload ->> 'additional_interest' as additional_interest,
  l.raw_payload ->> 'vet_or_previous_client' as vet_or_previous_client,
  l.raw_payload ->> 'heard_about_us' as heard_about_us,
  l.raw_payload,
  l.archived_at
from public.leads l
left join public.portal_users pu on pu.user_id = l.assigned_user_id;

create or replace view public.office_applications_sheet
with (security_invoker = true)
as
select
  a.id,
  a.received_at,
  a.created_at,
  a.updated_at,
  a.version,
  a.status,
  a.inquiry_type,
  a.first_name,
  a.last_name,
  concat_ws(' ', a.first_name, a.last_name) as applicant_name,
  a.email,
  a.phone,
  a.address_line_1,
  a.address_line_2,
  a.city,
  a.state,
  a.zip,
  a.market,
  a.referral_source,
  a.source_form,
  a.source_page,
  pu.display_name as assigned_to,
  a.linked_discovery_id,
  a.office_notes,
  coalesce(a.raw_payload ->> 'sms_consent', 'no') as sms_consent,
  case when lower(coalesce(a.raw_payload ->> 'sms_consent', 'no')) = 'yes' then 'Yes' else 'No' end as sms_opt_in,
  a.raw_payload ->> 'application_certification' as application_certification,
  a.raw_payload ->> 'signature' as signature,
  a.raw_payload ->> 'birthdate' as birthdate,
  a.raw_payload ->> 'legally_eligible' as legally_eligible,
  a.raw_payload ->> 'drug_test' as drug_test,
  a.raw_payload ->> 'felony' as felony,
  a.raw_payload ->> 'felony_explanation' as felony_explanation,
  coalesce(a.raw_payload ->> 'conviction_date', a.raw_payload ->> 'date_of_conviction') as conviction_date,
  coalesce(a.raw_payload ->> 'release_date', a.raw_payload ->> 'date_of_release') as release_date,
  a.raw_payload ->> 'comfortable_dogs' as comfortable_dogs,
  a.raw_payload ->> 'dog_bite_history' as dog_bite_history,
  a.raw_payload ->> 'dog_bite_explanation' as dog_bite_explanation,
  a.raw_payload ->> 'owns_dogs' as owns_dogs,
  a.raw_payload ->> 'owned_dogs_description' as owned_dogs_description,
  a.raw_payload ->> 'physical_condition' as physical_condition,
  a.raw_payload ->> 'workout' as workout,
  a.raw_payload ->> 'lift_100' as lift_100,
  a.raw_payload ->> 'run_2_miles' as run_2_miles,
  a.raw_payload ->> 'smoke' as smoke,
  a.raw_payload ->> 'team_player' as team_player,
  a.raw_payload ->> 'reliable_vehicle' as reliable_vehicle,
  a.raw_payload ->> 'drivers_license' as drivers_license,
  a.raw_payload ->> 'cleveland_training' as cleveland_training,
  a.raw_payload ->> 'education_level' as education_level,
  a.raw_payload ->> 'high_school' as high_school,
  coalesce(a.raw_payload ->> 'trade_school', a.raw_payload ->> 'trade_technical_school') as trade_school,
  a.raw_payload ->> 'military' as military,
  coalesce(a.raw_payload ->> 'college', a.raw_payload ->> 'college_university') as college,
  a.raw_payload ->> 'additional_training' as additional_training,
  a.raw_payload ->> 'employment_1_company' as employment_1_company,
  a.raw_payload ->> 'employment_1_address' as employment_1_address,
  a.raw_payload ->> 'employment_1_city' as employment_1_city,
  a.raw_payload ->> 'employment_1_state' as employment_1_state,
  a.raw_payload ->> 'employment_1_zip' as employment_1_zip,
  a.raw_payload ->> 'employment_1_status' as employment_1_status,
  a.raw_payload ->> 'employment_1_start_date' as employment_1_start_date,
  a.raw_payload ->> 'employment_1_end_date' as employment_1_end_date,
  a.raw_payload ->> 'employment_1_job_title' as employment_1_job_title,
  a.raw_payload ->> 'employment_1_salary' as employment_1_salary,
  a.raw_payload ->> 'employment_1_reason' as employment_1_reason,
  a.raw_payload ->> 'employment_2_company' as employment_2_company,
  a.raw_payload ->> 'employment_2_address' as employment_2_address,
  a.raw_payload ->> 'employment_2_city' as employment_2_city,
  a.raw_payload ->> 'employment_2_state' as employment_2_state,
  a.raw_payload ->> 'employment_2_zip' as employment_2_zip,
  a.raw_payload ->> 'employment_2_status' as employment_2_status,
  a.raw_payload ->> 'employment_2_start_date' as employment_2_start_date,
  a.raw_payload ->> 'employment_2_end_date' as employment_2_end_date,
  a.raw_payload ->> 'employment_2_job_title' as employment_2_job_title,
  a.raw_payload ->> 'employment_2_salary' as employment_2_salary,
  a.raw_payload ->> 'employment_2_reason' as employment_2_reason,
  a.raw_payload ->> 'employment_3_company' as employment_3_company,
  a.raw_payload ->> 'employment_3_address' as employment_3_address,
  a.raw_payload ->> 'employment_3_city' as employment_3_city,
  a.raw_payload ->> 'employment_3_state' as employment_3_state,
  a.raw_payload ->> 'employment_3_zip' as employment_3_zip,
  a.raw_payload ->> 'employment_3_status' as employment_3_status,
  a.raw_payload ->> 'employment_3_start_date' as employment_3_start_date,
  a.raw_payload ->> 'employment_3_end_date' as employment_3_end_date,
  a.raw_payload ->> 'employment_3_job_title' as employment_3_job_title,
  a.raw_payload ->> 'employment_3_salary' as employment_3_salary,
  a.raw_payload ->> 'employment_3_reason' as employment_3_reason,
  a.raw_payload,
  a.archived_at
from public.trainer_applications a
left join public.portal_users pu on pu.user_id = a.assigned_user_id;

create or replace view public.office_clients_sheet
with (security_invoker = true)
as
select
  c.id,
  c.created_at,
  c.updated_at,
  c.version,
  c.status,
  c.client_name,
  c.email,
  c.phone,
  c.service_area,
  c.zip,
  c.lead_source,
  t.full_name as assigned_trainer_name,
  dog.dog_names,
  dog.dog_breeds,
  c.sms_consent,
  case when c.sms_consent is true then 'Yes' when c.sms_consent is false then 'No' else 'Unknown' end as sms_opt_in,
  c.email_consent,
  c.date_started,
  c.last_contacted,
  c.notes,
  c.raw_payload,
  c.archived_at
from public.clients c
left join public.trainers t on t.id = c.trainer_id
left join lateral (
  select
    string_agg(nullif(d.name, ''), ', ' order by d.name) as dog_names,
    string_agg(nullif(d.breed, ''), ', ' order by d.name) as dog_breeds
  from public.dogs d
  where d.client_id = c.id
) dog on true;

grant select on public.office_leads_sheet to authenticated;
grant select on public.office_applications_sheet to authenticated;
grant select on public.office_clients_sheet to authenticated;
