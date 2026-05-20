-- ============================================================
-- Migration 0003 — Working hours: add breaks column
-- ============================================================

ALTER TABLE working_hours
  ADD COLUMN IF NOT EXISTS breaks JSONB NOT NULL DEFAULT '[]'::jsonb;
