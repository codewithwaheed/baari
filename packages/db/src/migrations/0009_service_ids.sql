-- 0009_service_ids.sql
-- Adds service_ids text[] column to booking_requests.
-- Stores all selected service IDs for multi-service bookings.
-- service_id (FK) remains as the primary/anchor service for backward compat.

ALTER TABLE booking_requests
  ADD COLUMN IF NOT EXISTS "service_ids" text[] NOT NULL DEFAULT '{}'::text[];
