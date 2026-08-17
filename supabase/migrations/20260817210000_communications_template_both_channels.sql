-- One template can now hold both versions of the same message: the short text and
-- the full email. It can then be sent as a text, as an email, or as both, without
-- the office writing and maintaining the same announcement twice.
alter table public.communications_templates
  drop constraint if exists communications_templates_channel_check;
alter table public.communications_templates
  add constraint communications_templates_channel_check
  check (channel = any (array['email'::text, 'sms'::text, 'mms'::text, 'both'::text]));

-- A "both" template keeps the email wording in body_html/design and the text
-- wording in body_text, so each channel sends the version written for it.
comment on column public.communications_templates.channel is
  'email | sms | mms | both. "both" carries an email version and a text version in one template.';
