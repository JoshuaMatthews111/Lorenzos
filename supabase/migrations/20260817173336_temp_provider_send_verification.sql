-- TEMPORARY (2026-08-17). Joshua asked for proof that the Lorenzo's site can really
-- send an email and a text, not just that keys are stored. This helper let the check
-- run inside the database so the Vault secrets were never copied out to a laptop.
--
-- It sent one test email and one test text, then was removed the same day by
-- 20260817173440_drop_temp_provider_send_verification.sql. Kept in the history so a
-- rebuilt database follows the same create-then-drop path and ends with neither the
-- function nor the http extension present.
create extension if not exists http with schema extensions;

create or replace function public.__provider_send_test(p_email text, p_phone text, p_html text, p_text text, p_sms text, p_subject text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $fn$
declare
  v_resend text; v_st text; v_from text; v_number text;
  r_dom extensions.http_response;
  r_email extensions.http_response;
  r_sms extensions.http_response;
begin
  select ds.decrypted_secret into v_resend
    from public.communications_settings s join vault.decrypted_secrets ds on ds.id = s.secret_id
    where s.setting_key = 'resend_api_key';
  select ds.decrypted_secret into v_st
    from public.communications_settings s join vault.decrypted_secrets ds on ds.id = s.secret_id
    where s.setting_key = 'simpletexting_api_key';
  select s.value->>'value' into v_from from public.communications_settings s where s.setting_key = 'resend_from_address';
  select s.value->>'value' into v_number from public.communications_settings s where s.setting_key = 'simpletexting_sending_number';

  r_dom := extensions.http((
    'GET', 'https://api.resend.com/domains',
    ARRAY[extensions.http_header('Authorization', 'Bearer ' || v_resend)], NULL, NULL
  )::extensions.http_request);

  r_email := extensions.http((
    'POST', 'https://api.resend.com/emails',
    ARRAY[extensions.http_header('Authorization', 'Bearer ' || v_resend)],
    'application/json',
    jsonb_build_object('from', v_from, 'to', jsonb_build_array(p_email),
                       'subject', p_subject, 'html', p_html, 'text', p_text)::text
  )::extensions.http_request);

  r_sms := extensions.http((
    'POST', 'https://api-app2.simpletexting.com/v2/api/messages',
    ARRAY[extensions.http_header('Authorization', 'Bearer ' || v_st)],
    'application/json',
    jsonb_build_object('contactPhone', p_phone, 'mode', 'AUTO', 'text', p_sms)::text
  )::extensions.http_request);

  return jsonb_build_object(
    'from_address', v_from,
    'sending_number', v_number,
    'resend_domains_status', r_dom.status,
    'resend_domains', left(r_dom.content, 1500),
    'email_status', r_email.status,
    'email_response', left(r_email.content, 800),
    'sms_status', r_sms.status,
    'sms_response', left(r_sms.content, 800)
  );
end;
$fn$;

revoke all on function public.__provider_send_test(text, text, text, text, text, text) from public, anon, authenticated;
