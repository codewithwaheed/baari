-- 0007_phase8_settings.sql
-- Phase 8: Settings — adds tenant business/payment/booking config and staff schedules.

-- ── Tenants ────────────────────────────────────────────────────────────────────
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS address             text,
  ADD COLUMN IF NOT EXISTS google_maps_url     text,
  ADD COLUMN IF NOT EXISTS instagram_handle    text,
  ADD COLUMN IF NOT EXISTS contact_phone       text,
  ADD COLUMN IF NOT EXISTS advance_booking_days integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS slot_interval_min   integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS payment_settings    jsonb,
  ADD COLUMN IF NOT EXISTS public_holidays     jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE tenants
  ADD CONSTRAINT tenants_slot_interval_chk
    CHECK (slot_interval_min IN (15, 30)),
  ADD CONSTRAINT tenants_advance_booking_days_chk
    CHECK (advance_booking_days IN (7, 14, 30, 60));

-- ── Staff ──────────────────────────────────────────────────────────────────────
-- work_schedule: { mon: { isOpen, openTime, closeTime, breaks: [{from,to}] }, ... }
-- specialisation_ids: string[] — UUIDs of services this staff member can perform
ALTER TABLE staff
  ADD COLUMN IF NOT EXISTS work_schedule      jsonb,
  ADD COLUMN IF NOT EXISTS specialisation_ids jsonb;
