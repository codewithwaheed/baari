-- ============================================================
-- Migration 0001 — Initial schema with RLS + EXCLUDE GIST
-- Run via: pnpm db:migrate
-- ============================================================

-- Required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "citext";
CREATE EXTENSION IF NOT EXISTS "btree_gist";  -- required for EXCLUDE GIST on TSTZRANGE

-- App user role (used by connection pool — not superuser)
DO $$ BEGIN
  CREATE ROLE app_user WITH LOGIN PASSWORD 'change_in_production';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

GRANT CONNECT ON DATABASE baari TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;

-- ── Tenants ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tenants (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        CITEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  country     TEXT NOT NULL DEFAULT 'PK',
  timezone    TEXT NOT NULL DEFAULT 'Asia/Karachi',
  plan        TEXT NOT NULL DEFAULT 'free',
  status      TEXT NOT NULL DEFAULT 'active',
  wa_phone_id TEXT UNIQUE,
  wa_waba_id  TEXT,
  wa_token    TEXT,
  ntn         TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_self ON tenants FOR ALL TO app_user
  USING (id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (id = current_setting('app.tenant_id', true)::uuid);

-- ── Locations ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS locations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  address     TEXT,
  city        TEXT,
  timezone    TEXT NOT NULL DEFAULT 'Asia/Karachi',
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX locations_tenant_idx ON locations(tenant_id);

ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON locations FOR ALL TO app_user
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- ── Staff ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS staff (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id),
  name        TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'stylist',
  avatar_url  TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX staff_tenant_idx ON staff(tenant_id);

ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON staff FOR ALL TO app_user
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- ── Services ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS services (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  category     TEXT,
  duration_min INTEGER NOT NULL,
  price_paisa  BIGINT NOT NULL,       -- PKR × 100, never float
  buffer_min   INTEGER NOT NULL DEFAULT 0,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX services_tenant_idx ON services(tenant_id);

ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE services FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON services FOR ALL TO app_user
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- ── Customers ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS customers (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  phone_e164   TEXT NOT NULL,         -- +92XXXXXXXXXX
  name         TEXT,
  wa_opt_in    BOOLEAN NOT NULL DEFAULT true,
  notes        TEXT NOT NULL DEFAULT '',
  is_vip       BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, phone_e164)      -- no cross-tenant leakage
);

CREATE INDEX customers_tenant_idx ON customers(tenant_id);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON customers FOR ALL TO app_user
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- ── Bookings ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS bookings (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  location_id  UUID REFERENCES locations(id),
  staff_id     UUID NOT NULL REFERENCES staff(id),
  service_id   UUID NOT NULL REFERENCES services(id),
  customer_id  UUID NOT NULL REFERENCES customers(id),
  start_time   TIMESTAMPTZ NOT NULL,
  end_time     TIMESTAMPTZ NOT NULL,
  -- Generated column: tstzrange used by EXCLUDE GIST constraint
  slot         TSTZRANGE GENERATED ALWAYS AS (tstzrange(start_time, end_time, '[)')) STORED,
  state        TEXT NOT NULL DEFAULT 'INITIATED'
               CHECK (state IN ('INITIATED','PAYMENT_PENDING','CONFIRMED','COMPLETED','CANCELLED','NO_SHOW','EXPIRED')),
  price_paisa  BIGINT NOT NULL,
  notes        TEXT NOT NULL DEFAULT '',
  source       TEXT NOT NULL DEFAULT 'manual'
               CHECK (source IN ('manual','whatsapp','web')),
  version      INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT bookings_time_chk CHECK (end_time > start_time)
);

CREATE INDEX bookings_tenant_idx ON bookings(tenant_id);
CREATE INDEX bookings_staff_start_idx ON bookings(staff_id, start_time);
CREATE INDEX bookings_customer_idx ON bookings(customer_id);
CREATE INDEX bookings_state_idx ON bookings(state);

-- THE CORE CONSTRAINT: prevents overlapping bookings for the same staff member.
-- Combined with Redis lock + SELECT FOR UPDATE = three-layer integrity.
ALTER TABLE bookings ADD CONSTRAINT bookings_no_overlap
  EXCLUDE USING GIST (
    tenant_id WITH =,
    staff_id  WITH =,
    slot      WITH &&
  )
  WHERE (state IN ('PAYMENT_PENDING','CONFIRMED','COMPLETED'));

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON bookings FOR ALL TO app_user
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- ── Payments ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS payments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id    UUID NOT NULL REFERENCES bookings(id),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  gateway       TEXT NOT NULL
                CHECK (gateway IN ('jazzcash','easypaisa','raast','card','cash','safepay')),
  txn_ref       TEXT NOT NULL UNIQUE,   -- gateway txn ID, idempotency key
  amount_paisa  BIGINT NOT NULL,
  state         TEXT NOT NULL DEFAULT 'PENDING'
                CHECK (state IN ('PENDING','SUCCESS','FAILED','REFUNDED')),
  raw_response  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX payments_booking_idx ON payments(booking_id);
CREATE INDEX payments_tenant_idx ON payments(tenant_id);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON payments FOR ALL TO app_user
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- ── Booking Requests ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS booking_requests (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id           UUID NOT NULL REFERENCES customers(id),
  service_id            UUID NOT NULL REFERENCES services(id),
  staff_id              UUID REFERENCES staff(id),
  requested_at          TIMESTAMPTZ NOT NULL,
  requested_price_paisa BIGINT NOT NULL,
  paid                  BOOLEAN NOT NULL DEFAULT false,
  payment_txn_ref       TEXT,
  state                 TEXT NOT NULL DEFAULT 'pending'
                        CHECK (state IN ('pending','approved','declined')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX booking_requests_tenant_idx ON booking_requests(tenant_id);
CREATE INDEX booking_requests_state_idx ON booking_requests(state);

ALTER TABLE booking_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_requests FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON booking_requests FOR ALL TO app_user
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- ── Users ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  staff_id   UUID REFERENCES staff(id),
  email      CITEXT NOT NULL,
  name       TEXT NOT NULL,
  role       TEXT NOT NULL DEFAULT 'staff'
             CHECK (role IN ('owner','manager','staff')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, email)
);

CREATE INDEX users_tenant_idx ON users(tenant_id);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON users FOR ALL TO app_user
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- ── Updated-at trigger ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tenants_updated_at   BEFORE UPDATE ON tenants   FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER bookings_updated_at  BEFORE UPDATE ON bookings  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER payments_updated_at  BEFORE UPDATE ON payments  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
