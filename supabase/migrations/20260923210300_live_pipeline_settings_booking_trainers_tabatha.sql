-- GO-LIVE 2026-09-23 step 1c + 1e (data). Before this ran, public.site_settings had NO row for any of
-- these keys (verified read-only 2026-09-23), so every insert is new; on_conflict keeps it re-runnable.
--
-- 1c-1: booking_trainers - the 28 calendars (schedule ids, zones, ZIP prefixes, starts_on/ends_on)
--       copied byte-for-byte from practice (practice md5 46b3e5ce3fda324b0a31d07148f50ccc,
--       last edited 2026-09-22 "pause Arion and Sean").
insert into public.site_settings (key, value, updated_by, updated_at)
select key, value, 'Go-live 2026-09-23 (copied from the practice copy)', now()
  from practice.site_settings where key = 'booking_trainers'
on conflict (key) do update set value = excluded.value, updated_by = excluded.updated_by, updated_at = excluded.updated_at;

-- 1c-2: pipeline_texts - the Track 500 wording and templates the office approved, copied byte-for-byte
--       from practice (md5 d4a0f02c44608b282c11a4703483a99b). The restrictive policy from
--       20260923210200 is already in place, so this row is server-only from its first moment.
insert into public.site_settings (key, value, updated_by, updated_at)
select key, value, 'Go-live 2026-09-23 (copied from the practice copy)', now()
  from practice.site_settings where key = 'pipeline_texts'
on conflict (key) do update set value = excluded.value, updated_by = excluded.updated_by, updated_at = excluded.updated_at;

-- 1c-3: pipeline_office_emails - built for LIVE, never copied: every practice_* key is stripped;
--       auto_followups is FALSE (ships OFF); operations_phone is EMPTY (go-live night: no Operations
--       text can fire); trainer_emails_hold is TRUE (go-live night: no trainer inbox gets an email);
--       recipients are the two office inboxes Joshua allowed tonight (production@ and lorenzo@) - the
--       full team list is the documented morning switch.
insert into public.site_settings (key, value, updated_by, updated_at)
values (
  'pipeline_office_emails',
  '{"recipients": [{"label": "Production", "email": "production@lorenzosdogtrainingteam.com"}, {"label": "Lorenzo", "email": "lorenzo@lorenzosdogtrainingteam.com"}], "alpha_email": "production@lorenzosdogtrainingteam.com", "operations_email": "production@lorenzosdogtrainingteam.com, lorenzo@lorenzosdogtrainingteam.com", "operations_phone": "", "auto_followups": false, "trainer_emails_hold": true}'::jsonb,
  'Go-live 2026-09-23 (live values; no-text night holds on)',
  now()
)
on conflict (key) do update set value = excluded.value, updated_by = excluded.updated_by, updated_at = excluded.updated_at;

-- 1e: Tabatha Shelley's live page address (was NULL; the static page /tabathashelley ships with this release).
update public.trainer_pages
   set public_url = 'https://www.lorenzosdogtrainingteam.com/tabathashelley'
 where slug = 'tabatha-shelley' and public_url is null;
