-- LIVE. Turn Operations on: public.site_settings 'pipeline_office_emails' carried
-- operations_phone = '' (empty), so lib/pipeline.js sendOpsText() skipped every Operations text and
-- Lorenzo received none of them.
--
-- BEFORE-VALUE: operations_phone = ''  (empty string). Nothing else in the row is touched:
-- operations_email stays "production@… , lorenzo@…", auto_followups stays false (the master switch
-- for automatic follow-ups is a separate decision), trainer_emails_hold stays as it is.
--
-- WHOSE NUMBER, and how it was established without guessing (the brief said to stop rather than
-- guess). Four independent records on this database agree on one number, area code 216 (Cleveland,
-- the company's home market):
--   1. practice.trainers slug 'lorenzo-miller'  -> that number
--   2. practice.communications_testers "Lorenzo" lorenzo@lorenzosdogtrainingteam.com -> same number
--   3. practice.communications_testers "Tim"    tmillerk999@gmail.com -> same number
--      (standing rule: "Tim" is Lorenzo - the same person, his personal address)
--   4. practice.site_settings operations_phone / practice_operations_phone / practice_trainer_phone
--      -> all the same number
-- The value is COPIED from the practice row rather than typed here, so the digits are never written
-- into the repository.
--
-- SIDE NOTE for the office: this number is also the practice copy's trainer/operations redirect and
-- an active tester, so Lorenzo will receive practice-copy Operations texts as well as live ones.
-- Those carry the PRACTICE COPY marking. Moving the practice redirect to another tester phone would
-- separate the two; that is Joshua's call, not this migration's.
--
-- UNDO:
--   update public.site_settings
--      set value = jsonb_set(value, '{operations_phone}', '""')
--    where key = 'pipeline_office_emails';

update public.site_settings
   set value = jsonb_set(
         value,
         '{operations_phone}',
         to_jsonb((select value->>'operations_phone'
                     from practice.site_settings
                    where key = 'pipeline_office_emails')),
         true),
       updated_at = now()
 where key = 'pipeline_office_emails'
   and coalesce(value->>'operations_phone', '') = ''
   and (select coalesce(value->>'operations_phone', '')
          from practice.site_settings
         where key = 'pipeline_office_emails') ~ '^\+1[2-9][0-9]{9}$';
