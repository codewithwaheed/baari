-- ============================================================
-- Migration 0002 — Auth, identity, and working hours tables
-- ============================================================

-- ── Tenants: add onboarding + profile columns ────────────────────────────────
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS onboarding_step     INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS city                TEXT,
  ADD COLUMN IF NOT EXISTS owner_name          TEXT;

-- ── Users: make email nullable, add auth columns ─────────────────────────────
ALTER TABLE users
  ALTER COLUMN email DROP NOT NULL;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS phone_e164          TEXT,
  ADD COLUMN IF NOT EXISTS password_hash       TEXT,
  ADD COLUMN IF NOT EXISTS phone_verified      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS failed_login_count  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_login_at       TIMESTAMPTZ;

-- Global unique index on phone (partial — only when not null)
CREATE UNIQUE INDEX IF NOT EXISTS users_phone_uniq
  ON users(phone_e164)
  WHERE phone_e164 IS NOT NULL;

-- ── Refresh tokens ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS refresh_tokens_user_idx ON refresh_tokens(user_id);

ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON refresh_tokens FOR ALL TO app_user
  USING (user_id IN (SELECT id FROM users WHERE tenant_id = current_setting('app.tenant_id', true)::uuid))
  WITH CHECK (user_id IN (SELECT id FROM users WHERE tenant_id = current_setting('app.tenant_id', true)::uuid));

-- ── OTP audit log ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS otp_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone       TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verified_at TIMESTAMPTZ,
  ip_address  TEXT
);

-- otp_log is intentionally global (phones are cross-tenant).
-- No policy for app_user — deny all. Auth routes use the baari role (BYPASSRLS).
ALTER TABLE otp_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE otp_log FORCE ROW LEVEL SECURITY;

-- ── Team invites ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS team_invites (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  phone_e164  TEXT NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('manager', 'staff')),
  staff_id    UUID REFERENCES staff(id),
  token       TEXT NOT NULL UNIQUE,
  invited_by  UUID NOT NULL REFERENCES users(id),
  expires_at  TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS team_invites_token_idx  ON team_invites(token);
CREATE INDEX IF NOT EXISTS team_invites_tenant_idx ON team_invites(tenant_id);

ALTER TABLE team_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_invites FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON team_invites FOR ALL TO app_user
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- ── Working hours ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS working_hours (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  location_id  UUID REFERENCES locations(id),
  day_of_week  INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  is_open      BOOLEAN NOT NULL DEFAULT true,
  open_time    TEXT NOT NULL DEFAULT '09:00',
  close_time   TEXT NOT NULL DEFAULT '20:00'
  -- No inline UNIQUE: Postgres treats all NULLs as distinct, so a single
  -- UNIQUE (tenant_id, location_id, day_of_week) fails to enforce uniqueness
  -- when location_id IS NULL. Two partial indexes are used instead (see below).
);

CREATE INDEX IF NOT EXISTS working_hours_tenant_idx ON working_hours(tenant_id);

-- Uniqueness when location_id is set (branch-level working hours)
CREATE UNIQUE INDEX IF NOT EXISTS working_hours_tenant_loc_day_uniq
  ON working_hours(tenant_id, location_id, day_of_week)
  WHERE location_id IS NOT NULL;

-- Uniqueness when location_id is NULL (tenant-level / default working hours)
-- MVP: most tenants have no locations, so this is the common case.
CREATE UNIQUE INDEX IF NOT EXISTS working_hours_tenant_day_null_uniq
  ON working_hours(tenant_id, day_of_week)
  WHERE location_id IS NULL;

ALTER TABLE working_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE working_hours FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON working_hours FOR ALL TO app_user
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- ── Grants for new tables ─────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON refresh_tokens TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON otp_log TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON team_invites TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON working_hours TO app_user;
