-- Migration 0005: Fix duplicate bookings state check constraint.
--
-- 0001_init created an anonymous inline CHECK that Postgres named
-- "bookings_state_check" (without CHECKED_IN).  0004 tried to drop
-- "bookings_state_chk" (wrong name) so it silently no-oped, then added a
-- second constraint.  Two constraints now coexist; the old one blocks
-- CHECKED_IN writes.  Drop both and re-create the single correct one.

ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_state_check;
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_state_chk;

ALTER TABLE bookings
  ADD CONSTRAINT bookings_state_chk CHECK (
    state IN (
      'INITIATED','PAYMENT_PENDING','CONFIRMED','CHECKED_IN','COMPLETED',
      'CANCELLED','NO_SHOW','EXPIRED'
    )
  );
