-- Trainer Base ZIP (portal chain step 3c, Joshua 2026-09-12, DO-NOT-BREAK rule 74).
-- Additive only: one new nullable column on trainers in BOTH schemas (the portal and the
-- booking page read both), plus a filled-in value for every real active trainer.
-- The booking page (/book) lists the trainers whose Base ZIP is within 50 miles of the
-- client's ZIP. Empty Base ZIP = the trainer is not listed there. The office edits it in
-- Trainer Network -> Profile Editor -> "Base ZIP (booking page distance)".
-- CORRECTION (after applying): trainers carries BEFORE UPDATE triggers increment_record_version
-- and set_trainers_updated_at in both schemas (information_schema.triggers hid them; pg_trigger
-- shows them). So this fill bumped version +1 and set updated_at on every filled row (29 live).
-- No other column changed and no audit row was written. The practice pull re-hashes on the new
-- shared column (rule 52) and both schemas get the same values here.
--
-- How each Base ZIP was chosen (from the trainer's market city, 2026-09-12):
--   the market city's central / downtown ZIP (Census ZCTA present in lib/zip-centroids.json):
--   Atlanta GA 30303 (Aryson Whorley, Chloe Chisolm, Christopher Almonte, Robert Wesling,
--   Shantelle Tuck, Shavon Striggles); Harrodsburg KY 40330 (Bailey Brown); Streetsboro OH 44241
--   (Brady DeRemer); San Antonio TX 78205 (Carolina Perez, Giovanni Gutierrez, Jacob Perez);
--   Pensacola FL 32502 (Clark Patton); Crestview FL 32536 (Daniel Bainbridge); Ann Arbor MI 48104
--   (Dylan Atkinson); Boston MA 02108 (Emilio Marotta); Cleveland OH 44113 (Eric Beck, John DelBane);
--   Fort Worth TX 76102 (Eric Hardaway); San Diego CA 92101 (Fred Harris, Karemela Sefferin);
--   North Park, San Diego CA 92104 (Genevieve Twilla); Cleveland Heights OH 44118 (Harley McGrew);
--   Hammond IN 46320 (Jasmine Bland); Navarre FL 32566 (Michael King); Reynoldsburg OH 43068
--   (Shannon Paskins); Panama City FL 32401 (Tabatha Shelley, Victoria Morris); Durham NH 03824
--   (Tristan Gray).
--   Lorenzo Miller: 44128 (Garfield Heights), the ZIP of the training center he works from,
--   4815 Orchard Rd, Garfield Heights, OH 44128, instead of downtown Cleveland.
--   Not filled (practice-only test / draft rows, never real trainers): donal-duck,
--   o-brien-test-mto7wcs1, office-draft-*. They stay off the booking page until the office adds one.
alter table public.trainers add column if not exists base_zip text;
alter table practice.trainers add column if not exists base_zip text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'trainers_base_zip_5_digits' and conrelid = 'public.trainers'::regclass) then
    alter table public.trainers add constraint trainers_base_zip_5_digits check (base_zip is null or base_zip ~ '^[0-9]{5}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'trainers_base_zip_5_digits' and conrelid = 'practice.trainers'::regclass) then
    alter table practice.trainers add constraint trainers_base_zip_5_digits check (base_zip is null or base_zip ~ '^[0-9]{5}$');
  end if;
end $$;

comment on column public.trainers.base_zip is 'Booking page: clients within 50 miles of this ZIP see this trainer (rule 74). Empty = not listed. Office-editable.';
comment on column practice.trainers.base_zip is 'Booking page: clients within 50 miles of this ZIP see this trainer (rule 74). Empty = not listed. Office-editable.';

with fill(slug, zip) as (values
  ('aryson-whorley', '30303'), ('bailey-brown', '40330'), ('brady-deremer', '44241'),
  ('carolina-perez', '78205'), ('chloe-chislom', '30303'), ('christopher-almonte', '30303'),
  ('clark-patton', '32502'), ('daniel-bainbridge', '32536'), ('dylan-atkinson', '48104'),
  ('emilio-marotta', '02108'), ('eric-beck', '44113'), ('eric-hardaway', '76102'),
  ('fred-harris', '92101'), ('genevieve-twilla', '92104'), ('giovanni-gutierrez', '78205'),
  ('harley-mcgrew', '44118'), ('jacob-perez', '78205'), ('jasmine-bland', '46320'),
  ('john-delbane', '44113'), ('karemela-sefferin', '92101'), ('lorenzo-miller', '44128'),
  ('michael-king', '32566'), ('robert-wesling', '30303'), ('shantelle-tuck', '30303'),
  ('s', '30303'), -- live still carries Shantelle Tuck's old slug "s" (rule 70)
  ('shannon-paskins', '43068'), ('shavon-striggles', '30303'), ('tabatha-shelley', '32401'),
  ('tristan-gray', '03824'), ('victoria-bayleigh-morris', '32401')
)
update public.trainers t set base_zip = fill.zip from fill where t.slug = fill.slug and t.base_zip is null;

with fill(slug, zip) as (values
  ('aryson-whorley', '30303'), ('bailey-brown', '40330'), ('brady-deremer', '44241'),
  ('carolina-perez', '78205'), ('chloe-chislom', '30303'), ('christopher-almonte', '30303'),
  ('clark-patton', '32502'), ('daniel-bainbridge', '32536'), ('dylan-atkinson', '48104'),
  ('emilio-marotta', '02108'), ('eric-beck', '44113'), ('eric-hardaway', '76102'),
  ('fred-harris', '92101'), ('genevieve-twilla', '92104'), ('giovanni-gutierrez', '78205'),
  ('harley-mcgrew', '44118'), ('jacob-perez', '78205'), ('jasmine-bland', '46320'),
  ('john-delbane', '44113'), ('karemela-sefferin', '92101'), ('lorenzo-miller', '44128'),
  ('michael-king', '32566'), ('robert-wesling', '30303'), ('shantelle-tuck', '30303'),
  ('s', '30303'),
  ('shannon-paskins', '43068'), ('shavon-striggles', '30303'), ('tabatha-shelley', '32401'),
  ('tristan-gray', '03824'), ('victoria-bayleigh-morris', '32401')
)
update practice.trainers t set base_zip = fill.zip from fill where t.slug = fill.slug and t.base_zip is null;

notify pgrst, 'reload schema';
