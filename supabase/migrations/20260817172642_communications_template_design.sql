-- Office request (Joshua, 2026-08-17): staff need to design the email itself —
-- logo, coloured bars, fonts, text colours, buttons and placement — save those
-- designs under a name, and have them reload exactly as saved.
--
-- body_html / body_text stay the source of truth for SENDING (the provider path
-- is unchanged). "design" stores the editable block structure so the builder can
-- reopen a saved template, and "format" records which editor produced it.

alter table public.communications_templates
  add column if not exists design jsonb,
  add column if not exists format text;

update public.communications_templates
set format = case
  when format is not null then format
  when channel in ('sms', 'mms') then 'text'
  when coalesce(body_html, '') <> '' then 'html'
  else 'text'
end
where format is null;

alter table public.communications_templates
  drop constraint if exists communications_templates_format_check;
alter table public.communications_templates
  add constraint communications_templates_format_check
  check (format is null or format in ('visual', 'html', 'text'));

-- Saved designs are read and written only through the authenticated server API,
-- exactly like every other communications table.
comment on column public.communications_templates.design is
  'Visual builder block structure. Server-API only; never written from a browser.';
