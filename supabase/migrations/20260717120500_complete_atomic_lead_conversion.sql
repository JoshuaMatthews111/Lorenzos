drop index if exists public.idx_clients_lead_unique;

create or replace function private.sync_client_from_converted_lead()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  converted_client_id uuid;
begin
  if new.status in ('first_session_payment', 'became_client')
     and old.status is distinct from new.status then
    insert into public.clients (
      lead_id, trainer_id, client_name, phone, email, service_area, zip,
      lead_source, status, sms_consent, email_consent, date_started,
      last_contacted, notes
    ) values (
      new.id,
      new.trainer_id,
      trim(new.first_name || ' ' || new.last_name),
      new.phone,
      new.email,
      concat_ws(', ', new.city, new.state),
      new.zip,
      new.lead_source,
      'active',
      new.sms_consent,
      new.email_consent,
      current_date,
      current_date,
      new.office_notes
    )
    on conflict (lead_id) do update
      set trainer_id = excluded.trainer_id,
          client_name = excluded.client_name,
          phone = excluded.phone,
          email = excluded.email,
          service_area = excluded.service_area,
          zip = excluded.zip,
          lead_source = excluded.lead_source,
          status = 'active',
          sms_consent = excluded.sms_consent,
          email_consent = excluded.email_consent,
          last_contacted = current_date,
          notes = excluded.notes
    returning id into converted_client_id;

    if coalesce(new.dog_name, '') <> '' or coalesce(new.dog_breed, '') <> '' then
      insert into public.dogs (client_id, name, breed, notes)
      select converted_client_id, new.dog_name, new.dog_breed, 'Created from converted lead'
      where not exists (
        select 1
        from public.dogs
        where client_id = converted_client_id
          and coalesce(name, '') = coalesce(new.dog_name, '')
          and coalesce(breed, '') = coalesce(new.dog_breed, '')
      );
    end if;
  end if;
  return new;
end;
$$;
