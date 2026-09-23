-- LIVE. Stage 1d, deferred on Joshua's order on 2026-09-23 and authorised this morning.
--
-- All 31 active public.trainers carried the shared office number (866) 436-4959, which
-- lib/pipeline.js trainerPhoneFor() refuses outright, so no trainer text could ever reach a
-- trainer. practice.trainers holds each trainer's real number. This copies practice -> public
-- BY SLUG for the active trainers who have a real number there.
--
-- EXCLUDED, deliberately, and left exactly as they are:
--   arion-goble, sean-urena  - out of the sales flow until Missy sends their numbers
--   clark-patton             - practice.phone is NULL, nothing to copy
--   emilio-marotta, john-delbane - practice also holds the (866) placeholder
-- 26 rows change. The trainers row trigger bumps version / updated_at on each.
--
-- EVERY copied number was checked before this ran: exactly 10 digits, (NNN) NNN-NNNN, area code
-- and exchange both starting 2-9, neither being N11, and not a toll-free NPA. All 26 passed.
--
-- BEFORE-VALUES: captured row by row into private.trainers_phone_backup_20260923 by this
-- migration, before the update, so the undo is exact rather than remembered.
--
-- UNDO (restores every prior value by id, including the (866) placeholder):
--   update public.trainers t set phone = b.phone
--     from private.trainers_phone_backup_20260923 b where b.id = t.id;
--   drop table private.trainers_phone_backup_20260923;

create table if not exists private.trainers_phone_backup_20260923 as
select id, slug, phone, version, now() as taken_at
  from public.trainers
 where status = 'active';

update public.trainers p
   set phone = pr.phone
  from practice.trainers pr
 where pr.slug = p.slug
   and p.status = 'active'
   and p.phone = '(866) 436-4959'
   and pr.phone is not null
   and pr.phone <> '(866) 436-4959'
   and pr.phone ~ '^\(\d{3}\) \d{3}-\d{4}$'
   and substring(regexp_replace(pr.phone, '\D', '', 'g'), 1, 1) between '2' and '9'
   and substring(regexp_replace(pr.phone, '\D', '', 'g'), 4, 1) between '2' and '9'
   and substring(regexp_replace(pr.phone, '\D', '', 'g'), 2, 2) <> '11'
   and substring(regexp_replace(pr.phone, '\D', '', 'g'), 5, 2) <> '11'
   and substring(regexp_replace(pr.phone, '\D', '', 'g'), 1, 3)
       not in ('800', '833', '844', '855', '866', '877', '888')
   and p.slug not in ('arion-goble', 'sean-urena');
