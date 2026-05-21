-- ============================================================
-- Migration 0006 — booking_services junction table
-- Supports multiple services per booking session.
-- bookings.service_id stays as primary service (backward compat).
-- bookings.price_paisa is the sum of all booking_services.price_paisa.
-- ============================================================

CREATE TABLE IF NOT EXISTS booking_services (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id   UUID        NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  tenant_id    UUID        NOT NULL REFERENCES tenants(id)  ON DELETE CASCADE,
  service_id   UUID        NOT NULL REFERENCES services(id),
  duration_min INTEGER     NOT NULL,
  price_paisa  BIGINT      NOT NULL,
  sort_order   INTEGER     NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS booking_services_booking_idx ON booking_services(booking_id);
CREATE INDEX IF NOT EXISTS booking_services_tenant_idx  ON booking_services(tenant_id);

-- RLS — same pattern as every other table
ALTER TABLE booking_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_services FORCE ROW LEVEL SECURITY;
CREATE POLICY booking_services_tenant ON booking_services FOR ALL TO app_user
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Grant to app_user (covers tables created after the initial GRANT on schema)
GRANT SELECT, INSERT, UPDATE, DELETE ON booking_services TO app_user;
