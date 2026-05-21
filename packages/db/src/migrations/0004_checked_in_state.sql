-- Migration 0004: Add CHECKED_IN to booking state check constraint
-- Allows the CONFIRMED → CHECKED_IN transition (staff has started the service).

ALTER TABLE bookings
  DROP CONSTRAINT IF EXISTS bookings_state_chk;

ALTER TABLE bookings
  ADD CONSTRAINT bookings_state_chk CHECK (
    state IN (
      'INITIATED','PAYMENT_PENDING','CONFIRMED','CHECKED_IN','COMPLETED',
      'CANCELLED','NO_SHOW','EXPIRED'
    )
  );
