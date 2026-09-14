-- Office 2026-09-14 (presentation): the booking calendar shows the trainer's Google free times exactly, and a
-- customer's pick is only sent to the office and the trainer, who book it in Google / Alpha. So a pick is no longer
-- exclusive: two customers may pick the same time. Practice copy only; public is not touched. Undo:
--   create unique index booking_holds_one_per_slot on practice.booking_holds (trainer_slug, slot_start) where status = 'held';
drop index if exists practice.booking_holds_one_per_slot;
