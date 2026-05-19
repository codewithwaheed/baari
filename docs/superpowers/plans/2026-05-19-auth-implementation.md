# Auth & Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Phase 1A (auth API endpoints) + Phase 1B (auth web pages) + male barbershop data sweep, per `docs/superpowers/specs/2026-05-19-auth-web-design.md`.

**Architecture:** Fastify API at port 3001 handles all auth; Next.js 15 at port 3000 renders auth pages and calls the API via `fetch` with `credentials: 'include'`; httpOnly cookies carry the JWT and refresh token cross-origin. The `baari` Postgres role already has BYPASSRLS (granted in `migrate.ts`), so auth routes can query the `users` table directly without `withTenant()`.

**Tech Stack:** Fastify 4, `@fastify/jwt`, `@fastify/cookie`, `bcryptjs`, `ioredis`, Drizzle ORM, Next.js 15 App Router, `jose` (already in web for middleware), TypeScript throughout.

---

## File Map

### New API files
| File | Responsibility |
|---|---|
| `apps/api/src/lib/auth/otp.ts` | Redis OTP generation, storage, validation, rate-key |
| `apps/api/src/lib/auth/password.ts` | bcrypt hash/compare, lockout tracking |
| `apps/api/src/lib/auth/tokens.ts` | Refresh token create/validate/rotate/revoke, set/clear cookies |
| `apps/api/src/lib/auth/sms.ts` | STUB — logs OTP, returns ok |
| `apps/api/src/lib/auth/email.ts` | STUB — logs email OTP, returns ok |
| `apps/api/src/routes/auth.ts` | All 10 `/auth/*` endpoints |
| `apps/api/src/routes/me.ts` | `GET /me` |

### Modified API files
| File | Change |
|---|---|
| `apps/api/package.json` | Add `bcryptjs`, `@fastify/cookie` |
| `apps/api/src/index.ts` | Register cookie plugin + auth/me routes |

### New DB files
| File | Responsibility |
|---|---|
| `packages/db/src/migrations/0002_auth.sql` | Auth columns on users/tenants + new tables |

### Modified DB files
| File | Change |
|---|---|
| `packages/db/src/schema.ts` | New columns + tables for auth |
| `packages/db/src/migrations/meta/_journal.json` | Add 0002 entry |
| `packages/db/src/migrate.ts` | Apply 0002 after 0001 |
| `packages/db/src/index.ts` | No change needed |

### New Web files
| File | Responsibility |
|---|---|
| `apps/web/src/middleware.ts` | Protect `/dashboard/*`, redirect to `/login` |
| `apps/web/src/app/(auth)/layout.tsx` | Centered card shell, Baari branding |
| `apps/web/src/app/(auth)/login/page.tsx` | Phone + password form |
| `apps/web/src/app/(auth)/signup/page.tsx` | Phone input step |
| `apps/web/src/app/(auth)/signup/verify/page.tsx` | 6-digit OTP |
| `apps/web/src/app/(auth)/signup/password/page.tsx` | Set password |
| `apps/web/src/components/auth/AuthCard.tsx` | Shared card shell |
| `apps/web/src/components/auth/PhoneInput.tsx` | Pakistani phone normalisation |
| `apps/web/src/components/auth/OTPInput.tsx` | 6-field OTP with auto-advance |
| `apps/web/src/components/auth/PasswordInput.tsx` | Show/hide + strength bar |

### Modified Web files
| File | Change |
|---|---|
| `apps/web/src/app/dashboard/layout.tsx` | Create (auth guard is handled by middleware; layout wraps children) |
| `apps/web/src/components/dashboard/data.ts` | Male barbershop data |

---

## Task 1 — Install API dependencies

**Files:**
- Modify: `apps/api/package.json`

- [ ] **Step 1: Install packages**

```bash
cd apps/api && pnpm add bcryptjs @fastify/cookie && pnpm add -D @types/bcryptjs
```

Expected output: `dependencies: bcryptjs, @fastify/cookie` added.

- [ ] **Step 2: Verify typecheck passes**

```bash
cd apps/api && pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/api/package.json apps/api/pnpm-lock.yaml pnpm-lock.yaml
git commit -m "chore(api): add bcryptjs and @fastify/cookie"
```

---

## Task 2 — Schema update + migration 0002

**Files:**
- Modify: `packages/db/src/schema.ts`
- Create: `packages/db/src/migrations/0002_auth.sql`
- Modify: `packages/db/src/migrations/meta/_journal.json`
- Modify: `packages/db/src/migrate.ts`

- [ ] **Step 1: Update schema.ts — tenants table**

In `packages/db/src/schema.ts`, replace the `tenants` table definition with:

```typescript
export const tenants = pgTable('tenants', {
  id:                 uuid('id').primaryKey().defaultRandom(),
  slug:               citext('slug').notNull().unique(),
  name:               text('name').notNull(),
  country:            text('country').notNull().default('PK'),
  timezone:           text('timezone').notNull().default('Asia/Karachi'),
  plan:               text('plan').notNull().default('free'),
  status:             text('status').notNull().default('active'),
  city:               text('city'),
  ownerName:          text('owner_name'),
  onboardingStep:     integer('onboarding_step').notNull().default(0),
  onboardingComplete: boolean('onboarding_complete').notNull().default(false),
  waPhoneId:          text('wa_phone_id').unique(),
  waWabaId:           text('wa_waba_id'),
  waToken:            text('wa_token'),
  ntn:                text('ntn'),
  createdAt:          timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:          timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

- [ ] **Step 2: Update schema.ts — users table**

Replace the `users` table definition with:

```typescript
export const users = pgTable('users', {
  id:               uuid('id').primaryKey().defaultRandom(),
  tenantId:         uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  staffId:          uuid('staff_id').references(() => staff.id),
  email:            citext('email'),
  name:             text('name').notNull(),
  role:             text('role').notNull().default('staff'),
  phoneE164:        text('phone_e164'),
  passwordHash:     text('password_hash'),
  phoneVerified:    boolean('phone_verified').notNull().default(false),
  failedLoginCount: integer('failed_login_count').notNull().default(0),
  lockedUntil:      timestamp('locked_until', { withTimezone: true }),
  lastLoginAt:      timestamp('last_login_at', { withTimezone: true }),
  createdAt:        timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [
  uniqueIndex('users_tenant_email_uniq').on(t.tenantId, t.email),
  uniqueIndex('users_phone_uniq').on(t.phoneE164),
  index('users_tenant_idx').on(t.tenantId),
  check('users_role_chk', sql`role IN ('owner','manager','staff')`),
]);
```

Note: `email` is now nullable; `uniqueIndex('users_tenant_email_uniq')` still applies but only when not null (Drizzle will emit a partial index in migration).

- [ ] **Step 3: Add new tables to schema.ts**

Append after the `users` table (before the type exports):

```typescript
// ─── Refresh Tokens ───────────────────────────────────────────────────────────
export const refreshTokens = pgTable('refresh_tokens', {
  id:        uuid('id').primaryKey().defaultRandom(),
  userId:    uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token:     text('token').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [
  index('refresh_tokens_user_idx').on(t.userId),
]);

// ─── OTP Log ─────────────────────────────────────────────────────────────────
export const otpLog = pgTable('otp_log', {
  id:         uuid('id').primaryKey().defaultRandom(),
  phone:      text('phone').notNull(),
  createdAt:  timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  ipAddress:  text('ip_address'),
});

// ─── Team Invites ─────────────────────────────────────────────────────────────
export const teamInvites = pgTable('team_invites', {
  id:         uuid('id').primaryKey().defaultRandom(),
  tenantId:   uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  phoneE164:  text('phone_e164').notNull(),
  role:       text('role').notNull(),
  staffId:    uuid('staff_id').references(() => staff.id),
  token:      text('token').notNull().unique(),
  invitedBy:  uuid('invited_by').notNull().references(() => users.id),
  expiresAt:  timestamp('expires_at', { withTimezone: true }).notNull(),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  createdAt:  timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [
  index('team_invites_token_idx').on(t.token),
  index('team_invites_tenant_idx').on(t.tenantId),
  check('team_invites_role_chk', sql`role IN ('manager','staff')`),
]);

// ─── Working Hours ────────────────────────────────────────────────────────────
export const workingHours = pgTable('working_hours', {
  id:          uuid('id').primaryKey().defaultRandom(),
  tenantId:    uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  locationId:  uuid('location_id').references(() => locations.id),
  dayOfWeek:   integer('day_of_week').notNull(),
  isOpen:      boolean('is_open').notNull().default(true),
  openTime:    text('open_time').notNull().default('09:00'),
  closeTime:   text('close_time').notNull().default('20:00'),
}, t => [
  uniqueIndex('working_hours_tenant_day_uniq').on(t.tenantId, t.locationId, t.dayOfWeek),
  index('working_hours_tenant_idx').on(t.tenantId),
  check('working_hours_day_chk', sql`day_of_week BETWEEN 0 AND 6`),
]);
```

- [ ] **Step 4: Update type exports in schema.ts**

Append to the type exports section:

```typescript
export type RefreshToken  = typeof refreshTokens.$inferSelect;
export type OtpLog        = typeof otpLog.$inferSelect;
export type TeamInvite    = typeof teamInvites.$inferSelect;
export type WorkingHours  = typeof workingHours.$inferSelect;
```

- [ ] **Step 5: Write 0002_auth.sql**

Create `packages/db/src/migrations/0002_auth.sql`:

```sql
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

-- ── OTP audit log ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS otp_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone       TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verified_at TIMESTAMPTZ,
  ip_address  TEXT
);

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
  close_time   TEXT NOT NULL DEFAULT '20:00',
  UNIQUE (tenant_id, location_id, day_of_week)
);

CREATE INDEX IF NOT EXISTS working_hours_tenant_idx ON working_hours(tenant_id);

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
```

- [ ] **Step 6: Update _journal.json**

Replace the content of `packages/db/src/migrations/meta/_journal.json`:

```json
{
  "version": "7",
  "dialect": "postgresql",
  "entries": [
    {
      "idx": 0,
      "version": "7",
      "when": 1747612800000,
      "tag": "0001_init",
      "breakpoints": true
    },
    {
      "idx": 1,
      "version": "7",
      "when": 1747699200000,
      "tag": "0002_auth",
      "breakpoints": true
    }
  ]
}
```

- [ ] **Step 7: Update migrate.ts to apply 0002**

In `packages/db/src/migrate.ts`, inside `applyMigration`, after the existing 0001 block (after `console.log('✓ Migration applied.')` or the skip message), add:

```typescript
  // ── Apply 0002_auth ──────────────────────────────────────────────────────
  const { rows: rows2 } = await client.query<{ exists: string | null }>(`
    SELECT to_regclass('public.refresh_tokens') AS exists
  `);

  if (rows2[0]?.exists) {
    console.log('✓ Migration 0002_auth already applied, skipping.');
  } else {
    console.log('  Applying migration 0002_auth.sql...');
    const sql2 = readFileSync(
      join(__dirname, 'migrations/0002_auth.sql'),
      'utf-8',
    );
    await client.query(sql2);
    console.log('✓ Migration 0002 applied.');
  }
```

- [ ] **Step 8: Run the migration**

```bash
pnpm --filter @baari/db db:migrate
```

Expected output:
```
✓ Database "baari" already exists.
✓ Migration 0001_init already applied, skipping.
  Applying migration 0002_auth.sql...
✓ Migration 0002 applied.
✓ Grants applied to role "baari".
✅ Migration complete.
```

- [ ] **Step 9: Typecheck the db package**

```bash
pnpm --filter @baari/db typecheck 2>/dev/null || pnpm --filter @baari/db exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add packages/db/src/schema.ts packages/db/src/migrations/0002_auth.sql packages/db/src/migrations/meta/_journal.json packages/db/src/migrate.ts
git commit -m "feat(db): migration 0002 — auth columns, refresh_tokens, working_hours"
```

---

## Task 3 — Auth lib: OTP helpers

**Files:**
- Create: `apps/api/src/lib/auth/otp.ts`

- [ ] **Step 1: Create otp.ts**

```typescript
// apps/api/src/lib/auth/otp.ts
import { redis } from '../redis/client';

const OTP_TTL_SEC      = 300;   // 5 minutes — OTP validity
const VERIFIED_TTL_SEC = 600;   // 10 minutes — window to complete signup after OTP
const RATE_TTL_SEC     = 3600;  // 1 hour — rate limit window
const RATE_LIMIT       = 3;     // max OTPs per phone per hour

interface StoredOTP {
  otp: string;
  attempts: number;
}

export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function storeOTP(phone: string, otp: string): Promise<void> {
  const stored: StoredOTP = { otp, attempts: 0 };
  await redis.set(`otp:${phone}`, JSON.stringify(stored), 'EX', OTP_TTL_SEC);
}

export async function validateOTP(
  phone: string,
  submitted: string,
): Promise<'ok' | 'expired' | 'wrong' | 'locked'> {
  const key = `otp:${phone}`;
  const raw = await redis.get(key);
  if (!raw) return 'expired';

  const stored = JSON.parse(raw) as StoredOTP;
  stored.attempts += 1;

  if (stored.attempts >= 5) {
    await redis.del(key);
    return 'locked';
  }

  if (stored.otp !== submitted) {
    // Persist updated attempt count with remaining TTL
    const ttl = await redis.ttl(key);
    await redis.set(key, JSON.stringify(stored), 'EX', Math.max(ttl, 1));
    return 'wrong';
  }

  await redis.del(key);
  await redis.set(`verified:${phone}`, '1', 'EX', VERIFIED_TTL_SEC);
  return 'ok';
}

export async function isPhoneVerified(phone: string): Promise<boolean> {
  return (await redis.get(`verified:${phone}`)) === '1';
}

export async function clearPhoneVerified(phone: string): Promise<void> {
  await redis.del(`verified:${phone}`);
}

/** Returns true if under the limit (request is allowed). */
export async function checkOTPRateLimit(phone: string): Promise<boolean> {
  const key = `otp_rate:${phone}`;
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, RATE_TTL_SEC);
  return count <= RATE_LIMIT;
}

// Email OTP (for forgot-password)
export async function storeEmailOTP(email: string, otp: string): Promise<void> {
  const stored: StoredOTP = { otp, attempts: 0 };
  await redis.set(`email_otp:${email}`, JSON.stringify(stored), 'EX', 600);
}

export async function validateEmailOTP(
  email: string,
  submitted: string,
): Promise<'ok' | 'expired' | 'wrong' | 'locked'> {
  const key = `email_otp:${email}`;
  const raw = await redis.get(key);
  if (!raw) return 'expired';

  const stored = JSON.parse(raw) as StoredOTP;
  stored.attempts += 1;

  if (stored.attempts >= 5) {
    await redis.del(key);
    return 'locked';
  }

  if (stored.otp !== submitted) {
    const ttl = await redis.ttl(key);
    await redis.set(key, JSON.stringify(stored), 'EX', Math.max(ttl, 1));
    return 'wrong';
  }

  await redis.del(key);
  return 'ok';
}

export async function storeResetToken(userId: string, token: string): Promise<void> {
  await redis.set(`reset:${token}`, userId, 'EX', 600); // 10 minutes
}

export async function validateResetToken(token: string): Promise<string | null> {
  return redis.get(`reset:${token}`);
}

export async function deleteResetToken(token: string): Promise<void> {
  await redis.del(`reset:${token}`);
}
```

- [ ] **Step 2: Typecheck**

```bash
cd apps/api && pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/lib/auth/otp.ts
git commit -m "feat(api): auth lib — OTP helpers"
```

---

## Task 4 — Auth lib: password helpers

**Files:**
- Create: `apps/api/src/lib/auth/password.ts`

- [ ] **Step 1: Create password.ts**

```typescript
// apps/api/src/lib/auth/password.ts
import bcrypt from 'bcryptjs';
import { eq, sql } from 'drizzle-orm';
import { db, schema } from '@baari/db';

const ROUNDS            = 12;
const MAX_ATTEMPTS      = 5;
const LOCKOUT_MS        = 15 * 60 * 1000; // 15 minutes

export async function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, ROUNDS);
}

export async function verifyPassword(
  plaintext: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plaintext, hash);
}

export function isLockedOut(user: {
  failedLoginCount: number;
  lockedUntil: Date | null;
}): { locked: boolean; minutesLeft: number } {
  if (!user.lockedUntil) return { locked: false, minutesLeft: 0 };
  const ms = user.lockedUntil.getTime() - Date.now();
  if (ms <= 0) return { locked: false, minutesLeft: 0 };
  return { locked: true, minutesLeft: Math.ceil(ms / 60000) };
}

/** Record a failed attempt. Returns true if the account just became locked. */
export async function recordFailedAttempt(userId: string): Promise<boolean> {
  const [updated] = await db
    .update(schema.users)
    .set({ failedLoginCount: sql`failed_login_count + 1` })
    .where(eq(schema.users.id, userId))
    .returning({ count: schema.users.failedLoginCount });

  if (!updated) return false;

  if (updated.count >= MAX_ATTEMPTS) {
    const lockedUntil = new Date(Date.now() + LOCKOUT_MS);
    await db
      .update(schema.users)
      .set({ lockedUntil })
      .where(eq(schema.users.id, userId));
    return true;
  }

  return false;
}

export async function resetLoginAttempts(userId: string): Promise<void> {
  await db
    .update(schema.users)
    .set({ failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() })
    .where(eq(schema.users.id, userId));
}

export async function updatePasswordHash(
  userId: string,
  newHash: string,
): Promise<void> {
  await db
    .update(schema.users)
    .set({ passwordHash: newHash })
    .where(eq(schema.users.id, userId));
}
```

- [ ] **Step 2: Typecheck**

```bash
cd apps/api && pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/lib/auth/password.ts
git commit -m "feat(api): auth lib — password helpers"
```

---

## Task 5 — Auth lib: token helpers

**Files:**
- Create: `apps/api/src/lib/auth/tokens.ts`

- [ ] **Step 1: Create tokens.ts**

```typescript
// apps/api/src/lib/auth/tokens.ts
import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import type { FastifyReply } from 'fastify';
import type { Redis } from 'ioredis';
import { db, schema } from '@baari/db';

const REFRESH_TTL_SEC = 30 * 24 * 60 * 60; // 30 days
const JWT_TTL_SEC     = 7  * 24 * 60 * 60; // 7 days

export async function createRefreshToken(
  userId: string,
  redis: Redis,
): Promise<string> {
  const token     = randomUUID();
  const expiresAt = new Date(Date.now() + REFRESH_TTL_SEC * 1000);

  await Promise.all([
    redis.set(`refresh:${token}`, userId, 'EX', REFRESH_TTL_SEC),
    db.insert(schema.refreshTokens).values({ userId, token, expiresAt }),
  ]);

  return token;
}

export async function validateRefreshToken(
  token: string,
  redis: Redis,
): Promise<string | null> {
  // Fast path
  const userId = await redis.get(`refresh:${token}`);
  if (userId) return userId;

  // DB fallback (handles Redis restart / cache miss)
  const [row] = await db
    .select()
    .from(schema.refreshTokens)
    .where(eq(schema.refreshTokens.token, token));

  if (!row || row.expiresAt < new Date()) return null;

  // Rewarm Redis
  const ttl = Math.floor((row.expiresAt.getTime() - Date.now()) / 1000);
  await redis.set(`refresh:${token}`, row.userId, 'EX', ttl);
  return row.userId;
}

export async function rotateRefreshToken(
  oldToken: string,
  userId: string,
  redis: Redis,
): Promise<string> {
  await Promise.all([
    redis.del(`refresh:${oldToken}`),
    db.delete(schema.refreshTokens).where(eq(schema.refreshTokens.token, oldToken)),
  ]);
  return createRefreshToken(userId, redis);
}

export async function revokeAllRefreshTokens(
  userId: string,
  redis: Redis,
): Promise<void> {
  const rows = await db
    .select({ token: schema.refreshTokens.token })
    .from(schema.refreshTokens)
    .where(eq(schema.refreshTokens.userId, userId));

  await Promise.all([
    ...rows.map(r => redis.del(`refresh:${r.token}`)),
    db.delete(schema.refreshTokens).where(eq(schema.refreshTokens.userId, userId)),
  ]);
}

export function setCookies(
  reply: FastifyReply,
  jwt: string,
  refreshToken: string,
): void {
  const isProd = process.env['NODE_ENV'] === 'production';

  reply.setCookie('baari_token', jwt, {
    httpOnly: true,
    secure:   isProd,
    sameSite: 'lax',
    path:     '/',
    maxAge:   JWT_TTL_SEC,
  });

  reply.setCookie('baari_refresh', refreshToken, {
    httpOnly: true,
    secure:   isProd,
    sameSite: 'lax',
    path:     '/api/v1/auth',
    maxAge:   REFRESH_TTL_SEC,
  });
}

export function clearCookies(reply: FastifyReply): void {
  reply.clearCookie('baari_token',   { path: '/' });
  reply.clearCookie('baari_refresh', { path: '/api/v1/auth' });
}
```

- [ ] **Step 2: Typecheck**

```bash
cd apps/api && pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/lib/auth/tokens.ts
git commit -m "feat(api): auth lib — refresh token management"
```

---

## Task 6 — Auth lib: SMS + email stubs

**Files:**
- Create: `apps/api/src/lib/auth/sms.ts`
- Create: `apps/api/src/lib/auth/email.ts`

- [ ] **Step 1: Create sms.ts**

```typescript
// apps/api/src/lib/auth/sms.ts
// TODO: Replace stub with Twilio/Vonage SDK when credentials are available.
// Required env: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER
// or: VONAGE_API_KEY, VONAGE_API_SECRET, VONAGE_FROM_NUMBER

export async function sendOTP(phone: string, otp: string): Promise<void> {
  console.log(`[AUTH STUB] SMS OTP for ${phone}: ${otp}`);
  // TODO: await twilioClient.messages.create({ to: phone, from: FROM, body: `Your Baari code: ${otp}` });
}
```

- [ ] **Step 2: Create email.ts**

```typescript
// apps/api/src/lib/auth/email.ts
// TODO: Replace stub with Resend SDK when API key is available.
// Required env: RESEND_API_KEY
// npm install resend  (when ready)

export async function sendEmailOTP(email: string, otp: string): Promise<void> {
  console.log(`[AUTH STUB] Email OTP for ${email}: ${otp}`);
  // TODO:
  // const resend = new Resend(process.env.RESEND_API_KEY);
  // await resend.emails.send({
  //   from: 'noreply@baari.pk',
  //   to: email,
  //   subject: 'Your Baari login code',
  //   html: `<p>Your code is: <strong>${otp}</strong> (expires in 10 minutes)</p>`,
  // });
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/lib/auth/sms.ts apps/api/src/lib/auth/email.ts
git commit -m "feat(api): auth lib — SMS and email stubs (wire provider later)"
```

---

## Task 7 — Auth routes

**Files:**
- Create: `apps/api/src/routes/auth.ts`

- [ ] **Step 1: Create auth.ts**

```typescript
// apps/api/src/routes/auth.ts
import { randomUUID } from 'crypto';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { db, schema } from '@baari/db';
import type { JWTPayload } from '@baari/types';
import { redis } from '../lib/redis/client';
import {
  generateOTP, storeOTP, validateOTP,
  isPhoneVerified, clearPhoneVerified, checkOTPRateLimit,
  storeEmailOTP, validateEmailOTP,
  storeResetToken, validateResetToken, deleteResetToken,
} from '../lib/auth/otp';
import {
  hashPassword, verifyPassword, isLockedOut,
  recordFailedAttempt, resetLoginAttempts, updatePasswordHash,
} from '../lib/auth/password';
import {
  createRefreshToken, validateRefreshToken, rotateRefreshToken,
  revokeAllRefreshTokens, setCookies, clearCookies,
} from '../lib/auth/tokens';
import { sendOTP } from '../lib/auth/sms';
import { sendEmailOTP } from '../lib/auth/email';

/** Normalize Pakistani phone → E.164.  03001234567 → +923001234567 */
function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('92')) return `+${digits}`;
  if (digits.startsWith('0'))  return `+92${digits.slice(1)}`;
  if (digits.startsWith('3'))  return `+92${digits}`;
  return `+${digits}`;
}

function isValidPhone(phone: string): boolean {
  return /^\+923\d{9}$/.test(phone);
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  return `${local[0]}***@${domain}`;
}

export default async function authRoutes(app: FastifyInstance) {

  // ── POST /auth/send-otp ──────────────────────────────────────────────────
  app.post<{ Body: { phone: string } }>('/send-otp', async (request, reply) => {
    const phone = normalizePhone(request.body.phone ?? '');
    if (!isValidPhone(phone)) {
      return reply.code(400).send({ ok: false, error: { code: 'INVALID_PHONE', message: 'Enter a valid Pakistani mobile number (03XX...)' } });
    }

    const existing = await db.query.users.findFirst({ where: eq(schema.users.phoneE164, phone) });
    if (existing) {
      return reply.code(409).send({ ok: false, error: { code: 'PHONE_EXISTS', message: 'An account with this number already exists. Please log in.' } });
    }

    const allowed = await checkOTPRateLimit(phone);
    if (!allowed) {
      return reply.code(429).send({ ok: false, error: { code: 'RATE_LIMITED', message: 'Too many attempts. Try again in an hour.' } });
    }

    const otp = generateOTP();
    await storeOTP(phone, otp);
    await sendOTP(phone, otp);

    return reply.send({ ok: true, expiresIn: 300 });
  });

  // ── POST /auth/verify-otp ────────────────────────────────────────────────
  app.post<{ Body: { phone: string; otp: string } }>('/verify-otp', async (request, reply) => {
    const phone = normalizePhone(request.body.phone ?? '');
    const result = await validateOTP(phone, request.body.otp ?? '');

    if (result === 'expired') return reply.code(401).send({ ok: false, error: { code: 'OTP_EXPIRED',  message: 'Code expired. Request a new one.' } });
    if (result === 'locked')  return reply.code(401).send({ ok: false, error: { code: 'OTP_LOCKED',   message: 'Too many wrong attempts. Request a new code.' } });
    if (result === 'wrong')   return reply.code(401).send({ ok: false, error: { code: 'OTP_WRONG',    message: 'Wrong code. Try again.' } });

    return reply.send({ ok: true, phoneVerified: true });
  });

  // ── POST /auth/complete-signup ───────────────────────────────────────────
  app.post<{ Body: { phone: string; password: string; ownerName?: string } }>('/complete-signup', async (request, reply) => {
    const phone = normalizePhone(request.body.phone ?? '');
    const { password, ownerName } = request.body;

    if (!isValidPhone(phone)) {
      return reply.code(400).send({ ok: false, error: { code: 'INVALID_PHONE', message: 'Invalid phone number' } });
    }
    if (!password || password.length < 8) {
      return reply.code(400).send({ ok: false, error: { code: 'PASSWORD_TOO_SHORT', message: 'Password must be at least 8 characters' } });
    }

    const verified = await isPhoneVerified(phone);
    if (!verified) {
      return reply.code(400).send({ ok: false, error: { code: 'PHONE_NOT_VERIFIED', message: 'Phone number was not verified in this session. Start over.' } });
    }

    const duplicate = await db.query.users.findFirst({ where: eq(schema.users.phoneE164, phone) });
    if (duplicate) {
      return reply.code(409).send({ ok: false, error: { code: 'ALREADY_REGISTERED', message: 'Account already exists. Please log in.' } });
    }

    const passwordHash = await hashPassword(password);
    const newTenantId  = randomUUID();
    const slug         = `shop-${randomUUID().slice(0, 8)}`;

    const { user, location } = await db.transaction(async (tx) => {
      const [tenant] = await tx.insert(schema.tenants).values({
        id: newTenantId,
        slug,
        name: ownerName ? `${ownerName}'s Salon` : 'My Salon',
        onboardingStep: 0,
        onboardingComplete: false,
      }).returning();

      const [location] = await tx.insert(schema.locations).values({
        tenantId: newTenantId,
        name: 'Main Branch',
      }).returning();

      const [user] = await tx.insert(schema.users).values({
        tenantId:      newTenantId,
        phoneE164:     phone,
        name:          ownerName ?? 'Owner',
        role:          'owner',
        passwordHash,
        phoneVerified: true,
      }).returning();

      return { tenant, user, location };
    });

    await clearPhoneVerified(phone);

    const jwtPayload: Omit<JWTPayload, 'iat' | 'exp'> = {
      sub:  user.id,
      tid:  newTenantId,
      role: 'owner',
      loc:  [location.id],
    };

    const jwt          = app.jwt.sign(jwtPayload, { expiresIn: '7d' } as any);
    const refreshToken = await createRefreshToken(user.id, redis);
    setCookies(reply, jwt, refreshToken);

    return reply.send({ ok: true, isNewUser: true, user: { id: user.id, name: user.name, role: user.role } });
  });

  // ── POST /auth/login ─────────────────────────────────────────────────────
  app.post<{ Body: { phone: string; password: string } }>('/login', async (request, reply) => {
    const phone = normalizePhone(request.body.phone ?? '');

    const user = await db.query.users.findFirst({ where: eq(schema.users.phoneE164, phone) });
    if (!user || !user.passwordHash) {
      return reply.code(401).send({ ok: false, error: { code: 'NOT_FOUND', message: 'No account found with this number.' } });
    }

    const lockStatus = isLockedOut(user);
    if (lockStatus.locked) {
      return reply.code(429).send({ ok: false, error: { code: 'LOCKED', message: `Too many failed attempts. Try again in ${lockStatus.minutesLeft} minutes.` } });
    }

    const valid = await verifyPassword(request.body.password ?? '', user.passwordHash);
    if (!valid) {
      const nowLocked = await recordFailedAttempt(user.id);
      const msg = nowLocked
        ? 'Too many failed attempts. Account locked for 15 minutes.'
        : 'Wrong password.';
      return reply.code(401).send({ ok: false, error: { code: 'WRONG_PASSWORD', message: msg } });
    }

    await resetLoginAttempts(user.id);

    // Get tenant + locations for JWT
    const locations = await db.query.locations.findMany({
      where: eq(schema.locations.tenantId, user.tenantId),
    });

    const jwtPayload: Omit<JWTPayload, 'iat' | 'exp'> = {
      sub:  user.id,
      tid:  user.tenantId,
      role: user.role as JWTPayload['role'],
      loc:  locations.map(l => l.id),
    };

    const jwt          = app.jwt.sign(jwtPayload, { expiresIn: '7d' } as any);
    const refreshToken = await createRefreshToken(user.id, redis);
    setCookies(reply, jwt, refreshToken);

    return reply.send({ ok: true, user: { id: user.id, name: user.name, role: user.role, tenantId: user.tenantId } });
  });

  // ── POST /auth/forgot-password ───────────────────────────────────────────
  app.post<{ Body: { phone: string } }>('/forgot-password', async (request, reply) => {
    const phone = normalizePhone(request.body.phone ?? '');
    const user  = await db.query.users.findFirst({ where: eq(schema.users.phoneE164, phone) });

    // Always return 200 — never reveal if phone exists
    if (!user) {
      return reply.send({ ok: true, method: 'sms', hint: null });
    }

    const otp = generateOTP();

    if (user.email) {
      await storeEmailOTP(user.email, otp);
      await sendEmailOTP(user.email, otp);
      return reply.send({ ok: true, method: 'email', hint: maskEmail(user.email) });
    }

    // SMS fallback
    await storeOTP(phone, otp);
    await sendOTP(phone, otp);
    return reply.send({ ok: true, method: 'sms', hint: null });
  });

  // ── POST /auth/send-email-otp ────────────────────────────────────────────
  app.post<{ Body: { email: string } }>('/send-email-otp', async (request, reply) => {
    const { email } = request.body;
    if (!email) {
      return reply.code(400).send({ ok: false, error: { code: 'INVALID_EMAIL', message: 'Email required' } });
    }

    const user = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
    if (user) {
      const otp = generateOTP();
      await storeEmailOTP(email, otp);
      await sendEmailOTP(email, otp);
    }
    // Always return 200
    return reply.send({ ok: true, message: 'Check your email' });
  });

  // ── POST /auth/verify-email-otp ──────────────────────────────────────────
  app.post<{ Body: { email: string; otp: string } }>('/verify-email-otp', async (request, reply) => {
    const { email, otp } = request.body;
    const result = await validateEmailOTP(email ?? '', otp ?? '');

    if (result === 'expired') return reply.code(401).send({ ok: false, error: { code: 'OTP_EXPIRED', message: 'Code expired. Request a new one.' } });
    if (result === 'locked')  return reply.code(401).send({ ok: false, error: { code: 'OTP_LOCKED',  message: 'Too many attempts.' } });
    if (result === 'wrong')   return reply.code(401).send({ ok: false, error: { code: 'OTP_WRONG',   message: 'Wrong code.' } });

    const user = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
    if (!user) return reply.code(401).send({ ok: false, error: { code: 'USER_NOT_FOUND', message: 'User not found.' } });

    const locations = await db.query.locations.findMany({ where: eq(schema.locations.tenantId, user.tenantId) });

    const jwtPayload: Omit<JWTPayload, 'iat' | 'exp'> = {
      sub:  user.id,
      tid:  user.tenantId,
      role: user.role as JWTPayload['role'],
      loc:  locations.map(l => l.id),
    };

    const jwt          = app.jwt.sign(jwtPayload, { expiresIn: '7d' } as any);
    const refreshToken = await createRefreshToken(user.id, redis);
    setCookies(reply, jwt, refreshToken);

    return reply.send({ ok: true, user: { id: user.id, name: user.name, role: user.role } });
  });

  // ── POST /auth/reset-password ────────────────────────────────────────────
  app.post<{ Body: { resetToken: string; newPassword: string } }>('/reset-password', async (request, reply) => {
    const { resetToken, newPassword } = request.body;

    if (!newPassword || newPassword.length < 8) {
      return reply.code(400).send({ ok: false, error: { code: 'PASSWORD_TOO_SHORT', message: 'Password must be at least 8 characters' } });
    }

    const userId = await validateResetToken(resetToken ?? '');
    if (!userId) {
      return reply.code(401).send({ ok: false, error: { code: 'INVALID_RESET_TOKEN', message: 'Reset link expired. Request a new one.' } });
    }

    const hash = await hashPassword(newPassword);
    await updatePasswordHash(userId, hash);
    await deleteResetToken(resetToken);
    await revokeAllRefreshTokens(userId, redis);

    // Issue fresh session
    const user      = await db.query.users.findFirst({ where: eq(schema.users.id, userId) });
    if (!user) return reply.code(500).send({ ok: false, error: { code: 'SERVER_ERROR', message: 'User not found after reset' } });

    const locations = await db.query.locations.findMany({ where: eq(schema.locations.tenantId, user.tenantId) });

    const jwtPayload: Omit<JWTPayload, 'iat' | 'exp'> = {
      sub:  user.id,
      tid:  user.tenantId,
      role: user.role as JWTPayload['role'],
      loc:  locations.map(l => l.id),
    };

    const jwt          = app.jwt.sign(jwtPayload, { expiresIn: '7d' } as any);
    const refreshToken = await createRefreshToken(user.id, redis);
    setCookies(reply, jwt, refreshToken);

    return reply.send({ ok: true });
  });

  // ── POST /auth/refresh ───────────────────────────────────────────────────
  app.post('/refresh', async (request, reply) => {
    const token = (request.cookies as any)['baari_refresh'];
    if (!token) {
      return reply.code(401).send({ ok: false, error: { code: 'NO_REFRESH_TOKEN', message: 'Not authenticated' } });
    }

    const userId = await validateRefreshToken(token, redis);
    if (!userId) {
      clearCookies(reply);
      return reply.code(401).send({ ok: false, error: { code: 'INVALID_REFRESH', message: 'Session expired. Please log in again.' } });
    }

    const user = await db.query.users.findFirst({ where: eq(schema.users.id, userId) });
    if (!user) {
      clearCookies(reply);
      return reply.code(401).send({ ok: false, error: { code: 'USER_NOT_FOUND', message: 'Session invalid.' } });
    }

    const locations = await db.query.locations.findMany({ where: eq(schema.locations.tenantId, user.tenantId) });

    const jwtPayload: Omit<JWTPayload, 'iat' | 'exp'> = {
      sub:  user.id,
      tid:  user.tenantId,
      role: user.role as JWTPayload['role'],
      loc:  locations.map(l => l.id),
    };

    const newJwt      = app.jwt.sign(jwtPayload, { expiresIn: '7d' } as any);
    const newRefresh  = await rotateRefreshToken(token, userId, redis);
    setCookies(reply, newJwt, newRefresh);

    return reply.send({ ok: true });
  });

  // ── POST /auth/logout ────────────────────────────────────────────────────
  app.post('/logout', async (request, reply) => {
    const token = (request.cookies as any)['baari_refresh'];
    if (token) {
      await Promise.all([
        redis.del(`refresh:${token}`),
        db.delete(schema.refreshTokens).where(eq(schema.refreshTokens.token, token)),
      ]);
    }
    clearCookies(reply);
    return reply.send({ ok: true });
  });
}
```

- [ ] **Step 2: Typecheck**

```bash
cd apps/api && pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/routes/auth.ts
git commit -m "feat(api): auth routes — signup, login, OTP, refresh, logout"
```

---

## Task 8 — ME route + register everything

**Files:**
- Create: `apps/api/src/routes/me.ts`
- Modify: `apps/api/src/index.ts`

- [ ] **Step 1: Create me.ts**

```typescript
// apps/api/src/routes/me.ts
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { db, schema } from '@baari/db';
import type { JWTPayload } from '@baari/types';

export default async function meRoutes(app: FastifyInstance) {
  app.addHook('onRequest', (app as any).authenticate);

  app.get('/', async (request, reply) => {
    const jwt = request.user as JWTPayload;

    const [user, tenant, location] = await Promise.all([
      db.query.users.findFirst({ where: eq(schema.users.id, jwt.sub) }),
      db.query.tenants.findFirst({ where: eq(schema.tenants.id, jwt.tid) }),
      db.query.locations.findFirst({ where: eq(schema.locations.tenantId, jwt.tid) }),
    ]);

    if (!user || !tenant) {
      return reply.code(401).send({ ok: false, error: { code: 'USER_NOT_FOUND', message: 'Session invalid.' } });
    }

    return reply.send({
      ok: true,
      user: {
        id:    user.id,
        name:  user.name,
        phone: user.phoneE164,
        role:  user.role,
      },
      tenant: {
        id:                 tenant.id,
        name:               tenant.name,
        slug:               tenant.slug,
        plan:               tenant.plan,
        city:               tenant.city,
        onboardingComplete: tenant.onboardingComplete,
        onboardingStep:     tenant.onboardingStep,
      },
      location: location
        ? { id: location.id, name: location.name }
        : null,
    });
  });
}
```

- [ ] **Step 2: Update index.ts — register cookie plugin + routes**

In `apps/api/src/index.ts`, add these imports at the top:

```typescript
import cookie from '@fastify/cookie';
```

Inside the `build()` function, after the `rateLimit` registration and before the JWT registration, add:

```typescript
  // ── Cookies ───────────────────────────────────────────────────────────────
  await app.register(cookie);
```

Then uncomment and replace the two TODO route lines:

```typescript
  await app.register(import('./routes/auth'), { prefix: '/api/v1/auth' });
  await app.register(import('./routes/me'),   { prefix: '/api/v1/me' });
```

- [ ] **Step 3: Typecheck**

```bash
cd apps/api && pnpm typecheck
```

Expected: no errors.

- [ ] **Step 4: Smoke test — start API and hit health**

```bash
pnpm dev &
sleep 3
curl -s http://localhost:3001/health
```

Expected: `{"ok":true,"ts":"..."}`

- [ ] **Step 5: Smoke test — send-otp (stubbed OTP appears in console)**

```bash
curl -s -X POST http://localhost:3001/api/v1/auth/send-otp \
  -H 'Content-Type: application/json' \
  -d '{"phone":"03001234567"}'
```

Expected response: `{"ok":true,"expiresIn":300}`
Expected console: `[AUTH STUB] SMS OTP for +923001234567: 123456`

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/me.ts apps/api/src/index.ts
git commit -m "feat(api): register auth + me routes, cookie plugin"
```

---

## Task 9 — Male barbershop data sweep

**Files:**
- Modify: `apps/web/src/components/dashboard/data.ts`

- [ ] **Step 1: Replace data.ts**

```typescript
// apps/web/src/components/dashboard/data.ts
// Seed data + shared types for the dashboard.
// Reflects a male barbershop context.
// All monetary values are stored in paisa (PKR × 100) per spec.

import type { BookingStatus } from './primitives';

export type NavId =
  | 'calendar' | 'requests' | 'clients' | 'settings'
  | 'waitlist' | 'messages' | 'inventory' | 'marketing' | 'reports' | 'billie';

export interface Staff {
  id: string;
  name: string;
  role: string;
  color: string;
}

export interface Appointment {
  id: string;
  staff: string;
  client: string;
  phone?: string;
  service: string;
  start: number; // decimal hours e.g. 9.5 = 9:30am
  end: number;
  status: BookingStatus;
  price: number; // paisa
}

export interface BookingRequest {
  id: string;
  client: string;
  phone: string;
  service: string;
  staff: string;
  day: string;
  time: number; // decimal hours
  paid: boolean;
  amount: number; // paisa
}

export interface VisitRecord {
  service: string;
  date: string;
  staff: string;
  amount?: number; // paisa
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  vip: boolean;
  lastVisit: string;
  visits: number;
  whatsappOptIn: boolean;
  notes: string;
  history: VisitRecord[];
}

export interface ServiceItem {
  name: string;
  price: number; // paisa
  dur: number;   // hours
}

export const STAFF: Staff[] = [
  { id: 'usman',  name: 'Usman',  role: 'Senior Barber',     color: '#322B20' },
  { id: 'hassan', name: 'Hassan', role: 'Color Specialist',  color: '#4F6E89' },
  { id: 'bilal',  name: 'Bilal',  role: 'Barber',            color: '#4E7C58' },
  { id: 'ahmed',  name: 'Ahmed',  role: 'Grooming Expert',   color: '#8A6B3A' },
];

export const SEED_APPTS: Appointment[] = [
  { id: 'a1', staff: 'usman',  client: 'Saad Butt',       phone: '0300 1234 567', service: 'Fade + Beard Trim',  start:  9.0, end: 10.0, status: 'completed',      price:  180000 },
  { id: 'a2', staff: 'usman',  client: 'Ali Raza',        phone: '0321 4567 890', service: 'Hair + Beard Combo', start: 11.0, end: 12.0, status: 'checkedIn',      price:  150000 },
  { id: 'a3', staff: 'usman',  client: 'Hamza Sheikh',    phone: '0333 2345 678', service: 'Keratin Treatment',  start: 14.0, end: 16.5, status: 'confirmed',      price:  800000 },
  { id: 'b1', staff: 'hassan', client: 'Zain Malik',      phone: '0301 9876 543', service: 'Global Color',       start: 10.0, end: 12.0, status: 'pendingPayment', price:  650000 },
  { id: 'b2', staff: 'hassan', client: 'Faisal Qureshi',  phone: '0322 1122 334', service: 'Highlights',         start: 13.0, end: 15.0, status: 'confirmed',      price:  850000 },
  { id: 'b3', staff: 'hassan', client: 'Omar Farooq',     phone: '0345 7788 990', service: 'Hair Spa',           start: 15.5, end: 16.5, status: 'confirmed',      price:  300000 },
  { id: 'c1', staff: 'bilal',  client: 'Talha Ahmed',     phone: '0311 5544 332', service: 'Clean Shave',        start:  9.5, end: 10.0, status: 'completed',      price:   80000 },
  { id: 'c2', staff: 'bilal',  client: 'Umar Hayat',      phone: '0334 6677 889', service: 'Haircut',            start: 11.0, end: 11.5, status: 'noShow',         price:  120000 },
  { id: 'c3', staff: 'bilal',  client: 'Shahzaib Mirza',  phone: '0302 8899 776', service: 'Fade + Lineup',      start: 14.0, end: 15.0, status: 'confirmed',      price:  160000 },
  { id: 'd1', staff: 'ahmed',  client: 'Asad Khan',       phone: '0312 3344 556', service: 'Head Massage',       start: 10.0, end: 10.5, status: 'confirmed',      price:  120000 },
  { id: 'd2', staff: 'ahmed',  client: 'Bilal Chaudhry',  phone: '0335 9988 776', service: 'Facial for Men',     start: 11.5, end: 12.5, status: 'pendingPayment', price:  250000 },
  { id: 'd3', staff: 'ahmed',  client: 'Raza Hussain',    phone: '0303 4455 667', service: 'Beard Sculpt',       start: 15.0, end: 15.5, status: 'confirmed',      price:  100000 },
];

export const SEED_REQUESTS: BookingRequest[] = [
  { id: 'r1', client: 'Ahsan Tariq',   phone: '0300 5566 778', service: 'Fade + Beard Trim',  staff: 'Usman',  day: 'Today',    time: 17.0, paid: true,  amount:  180000 },
  { id: 'r2', client: 'Junaid Iqbal',  phone: '0321 8899 220', service: 'Facial for Men',     staff: 'Ahmed',  day: 'Tomorrow', time: 11.0, paid: false, amount:  250000 },
  { id: 'r3', client: 'Waqas Noor',    phone: '0345 1100 234', service: 'Global Color',       staff: 'Hassan', day: 'Tomorrow', time: 14.5, paid: true,  amount:  650000 },
  { id: 'r4', client: 'Imran Siddiq',  phone: '0333 6677 010', service: 'Hair Spa',           staff: 'Hassan', day: 'May 19',   time: 10.0, paid: false, amount:  300000 },
  { id: 'r5', client: 'Kamran Bajwa',  phone: '0301 2233 445', service: 'Keratin Treatment',  staff: 'Usman',  day: 'May 20',   time: 16.0, paid: true,  amount:  800000 },
];

export const SEED_CLIENTS: Client[] = [
  {
    id: 'cl1', name: 'Saad Butt', phone: '0300 1234 567', vip: true,
    lastVisit: 'May 17, 2026', visits: 14, whatsappOptIn: true,
    notes: 'Prefers low fade on sides, medium on top. Beard sculpted square. Regular every 3 weeks.',
    history: [
      { service: 'Fade + Beard Trim',  date: 'May 17, 2026', staff: 'Usman',  amount: 180000 },
      { service: 'Hair + Beard Combo', date: 'Apr 26, 2026', staff: 'Usman',  amount: 150000 },
      { service: 'Highlights',         date: 'Apr 02, 2026', staff: 'Hassan', amount: 850000 },
      { service: 'Clean Shave',        date: 'Mar 15, 2026', staff: 'Bilal',  amount:  80000 },
    ],
  },
  {
    id: 'cl2', name: 'Ali Raza', phone: '0321 4567 890', vip: false,
    lastVisit: 'May 17, 2026', visits: 4, whatsappOptIn: true,
    notes: 'New client. Sensitive scalp — use sulfate-free products.',
    history: [
      { service: 'Hair + Beard Combo', date: 'May 17, 2026', staff: 'Usman', amount: 150000 },
      { service: 'Haircut',            date: 'Apr 19, 2026', staff: 'Bilal', amount: 120000 },
    ],
  },
  {
    id: 'cl3', name: 'Hamza Sheikh', phone: '0333 2345 678', vip: true,
    lastVisit: 'May 17, 2026', visits: 22, whatsappOptIn: true,
    notes: 'VIP. Books quarterly for keratin. Always in afternoon slots. Pays cash only.',
    history: [
      { service: 'Keratin Treatment', date: 'May 17, 2026', staff: 'Usman',  amount: 800000 },
      { service: 'Keratin Treatment', date: 'Feb 08, 2026', staff: 'Usman',  amount: 800000 },
      { service: 'Hair Spa',          date: 'Jan 11, 2026', staff: 'Hassan', amount: 300000 },
    ],
  },
  {
    id: 'cl4', name: 'Zain Malik', phone: '0301 9876 543', vip: false,
    lastVisit: 'May 17, 2026', visits: 7, whatsappOptIn: false,
    notes: 'Booked via Instagram. Prefers contact via call, not WhatsApp.',
    history: [
      { service: 'Global Color', date: 'May 17, 2026', staff: 'Hassan', amount: 650000 },
      { service: 'Highlights',   date: 'Mar 22, 2026', staff: 'Hassan', amount: 850000 },
    ],
  },
  {
    id: 'cl5', name: 'Talha Ahmed', phone: '0311 5544 332', vip: false,
    lastVisit: 'May 17, 2026', visits: 5, whatsappOptIn: true,
    notes: 'Quick in-and-out. Never wants product. Straight razor shave only.',
    history: [
      { service: 'Clean Shave', date: 'May 17, 2026', staff: 'Bilal', amount:  80000 },
      { service: 'Clean Shave', date: 'Apr 24, 2026', staff: 'Bilal', amount:  80000 },
    ],
  },
  {
    id: 'cl6', name: 'Asad Khan', phone: '0312 3344 556', vip: true,
    lastVisit: 'May 17, 2026', visits: 11, whatsappOptIn: true,
    notes: 'Comes in every two weeks. Head massage + haircut package. Prefers Ahmed.',
    history: [
      { service: 'Head Massage',        date: 'May 17, 2026', staff: 'Ahmed', amount: 120000 },
      { service: 'Head Massage + Cut',  date: 'May 03, 2026', staff: 'Ahmed', amount: 250000 },
      { service: 'Facial for Men',      date: 'Apr 15, 2026', staff: 'Ahmed', amount: 250000 },
    ],
  },
  {
    id: 'cl7', name: 'Omar Farooq', phone: '0345 7788 990', vip: false,
    lastVisit: 'May 17, 2026', visits: 3, whatsappOptIn: true,
    notes: 'Experimenting with hair color. Currently going lighter. Patch test done.',
    history: [
      { service: 'Hair Spa',    date: 'May 17, 2026', staff: 'Hassan', amount: 300000 },
      { service: 'Highlights',  date: 'Apr 30, 2026', staff: 'Hassan', amount: 850000 },
    ],
  },
  {
    id: 'cl8', name: 'Bilal Chaudhry', phone: '0335 9988 776', vip: false,
    lastVisit: 'May 17, 2026', visits: 2, whatsappOptIn: true,
    notes: '',
    history: [
      { service: 'Facial for Men', date: 'May 17, 2026', staff: 'Ahmed', amount: 250000 },
    ],
  },
];

export const SERVICES: ServiceItem[] = [
  { name: 'Haircut',            price:  120000, dur: 0.5 },
  { name: 'Fade Cut',           price:  160000, dur: 0.75 },
  { name: 'Fade + Beard Trim',  price:  180000, dur: 1.0 },
  { name: 'Hair + Beard Combo', price:  150000, dur: 1.0 },
  { name: 'Beard Trim',         price:   80000, dur: 0.5 },
  { name: 'Beard Sculpt',       price:  100000, dur: 0.5 },
  { name: 'Clean Shave',        price:   80000, dur: 0.5 },
  { name: 'Head Massage',       price:  120000, dur: 0.5 },
  { name: 'Facial for Men',     price:  250000, dur: 1.0 },
  { name: 'Hair Spa',           price:  300000, dur: 1.0 },
  { name: 'Global Color',       price:  650000, dur: 2.0 },
  { name: 'Highlights',         price:  850000, dur: 2.0 },
  { name: 'Keratin Treatment',  price:  800000, dur: 2.5 },
];
```

- [ ] **Step 2: Typecheck web**

```bash
cd apps/web && pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/dashboard/data.ts
git commit -m "feat(web): update seed data to male barbershop context"
```

---

## Task 10 — Auth UI components

**Files:**
- Create: `apps/web/src/components/auth/AuthCard.tsx`
- Create: `apps/web/src/components/auth/PhoneInput.tsx`
- Create: `apps/web/src/components/auth/OTPInput.tsx`
- Create: `apps/web/src/components/auth/PasswordInput.tsx`

- [ ] **Step 1: Create AuthCard.tsx**

```tsx
// apps/web/src/components/auth/AuthCard.tsx
'use client';

interface AuthCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

export function AuthCard({ title, subtitle, children }: AuthCardProps) {
  return (
    <div style={{
      width: '100%',
      maxWidth: 420,
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
      boxShadow: 'var(--shadow-lg)',
    }}>
      {/* Lime accent strip */}
      <div style={{ height: 4, background: 'var(--baari-lime)' }} />

      <div style={{ padding: '32px 32px 36px' }}>
        {/* Wordmark */}
        <div style={{ marginBottom: 28 }}>
          <span style={{
            fontFamily: 'var(--font-display)',
            fontSize: 22,
            fontWeight: 700,
            color: 'var(--fg)',
            letterSpacing: '-0.02em',
          }}>
            باری
          </span>
          <span style={{
            fontFamily: 'var(--font-display)',
            fontSize: 22,
            fontWeight: 200,
            color: 'var(--fg)',
            letterSpacing: '-0.02em',
            marginLeft: 6,
          }}>
            Baari
          </span>
        </div>

        {/* Title */}
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--fs-h3)',
          fontWeight: 200,
          color: 'var(--fg)',
          margin: '0 0 6px',
          lineHeight: 'var(--lh-heading)',
        }}>
          {title}
        </h1>

        {subtitle && (
          <p style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--fs-body-sm)',
            color: 'var(--fg-muted)',
            margin: '0 0 28px',
            lineHeight: 'var(--lh-body)',
          }}>
            {subtitle}
          </p>
        )}

        {!subtitle && <div style={{ marginBottom: 28 }} />}

        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create PhoneInput.tsx**

```tsx
// apps/web/src/components/auth/PhoneInput.tsx
'use client';
import { useState } from 'react';

interface PhoneInputProps {
  value: string;
  onChange: (normalized: string) => void;
  error?: string;
  disabled?: boolean;
}

export function PhoneInput({ value, onChange, error, disabled }: PhoneInputProps) {
  const [display, setDisplay] = useState(value);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    setDisplay(raw);
    onChange(raw);
  }

  function handleBlur() {
    const digits = display.replace(/\D/g, '');
    let normalized = display;
    if (digits.startsWith('0') && digits.length === 11) {
      normalized = `0${digits.slice(1, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
    }
    setDisplay(normalized);
  }

  return (
    <div>
      <label style={{
        display: 'block',
        fontFamily: 'var(--font-body)',
        fontSize: 'var(--fs-body-sm)',
        fontWeight: 'var(--fw-medium)',
        color: 'var(--fg-secondary)',
        marginBottom: 6,
      }}>
        Mobile number
      </label>
      <div style={{ position: 'relative' }}>
        <span style={{
          position: 'absolute',
          left: 12,
          top: '50%',
          transform: 'translateY(-50%)',
          fontSize: 'var(--fs-body)',
          color: 'var(--fg-muted)',
          pointerEvents: 'none',
          userSelect: 'none',
        }}>
          +92
        </span>
        <input
          type="tel"
          inputMode="numeric"
          placeholder="03XX XXX XXXX"
          value={display}
          onChange={handleChange}
          onBlur={handleBlur}
          disabled={disabled}
          style={{
            width: '100%',
            paddingLeft: 48,
            paddingRight: 12,
            paddingTop: 12,
            paddingBottom: 12,
            fontSize: 'var(--fs-body)',
            fontFamily: 'var(--font-body)',
            color: 'var(--fg)',
            background: 'var(--bg)',
            border: `1px solid ${error ? 'var(--baari-error)' : 'var(--border)'}`,
            borderRadius: 'var(--radius-md)',
            outline: 'none',
            boxSizing: 'border-box',
            transition: 'border-color var(--dur-fast)',
          }}
          onFocus={e => {
            e.target.style.borderColor = 'var(--baari-lime-deep)';
            e.target.style.boxShadow   = 'var(--shadow-ring)';
          }}
          onBlurCapture={e => {
            e.target.style.borderColor = error ? 'var(--baari-error)' : 'var(--border)';
            e.target.style.boxShadow   = 'none';
          }}
        />
      </div>
      {error && (
        <p style={{
          margin: '6px 0 0',
          fontSize: 'var(--fs-caption)',
          color: 'var(--baari-error)',
          fontFamily: 'var(--font-body)',
        }}>
          {error}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create OTPInput.tsx**

```tsx
// apps/web/src/components/auth/OTPInput.tsx
'use client';
import { useRef } from 'react';

interface OTPInputProps {
  value: string;            // 6-char string e.g. "123456" (padded with '' for unset)
  onChange: (v: string) => void;
  error?: string;
  disabled?: boolean;
}

export function OTPInput({ value, onChange, error, disabled }: OTPInputProps) {
  const refs = Array.from({ length: 6 }, () => useRef<HTMLInputElement>(null));
  const digits = value.split('').concat(Array(6).fill('')).slice(0, 6);

  function handleChange(i: number, e: React.ChangeEvent<HTMLInputElement>) {
    const char = e.target.value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[i] = char;
    onChange(next.join(''));
    if (char && i < 5) refs[i + 1]?.current?.focus();
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      refs[i - 1]?.current?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const next = pasted.split('').concat(Array(6).fill('')).slice(0, 6);
    onChange(next.join(''));
    const focusIdx = Math.min(pasted.length, 5);
    refs[focusIdx]?.current?.focus();
  }

  const boxStyle = (filled: boolean, hasError: boolean): React.CSSProperties => ({
    width: 48,
    height: 56,
    fontSize: 24,
    fontFamily: 'var(--font-body)',
    fontWeight: 'var(--fw-medium)',
    color: 'var(--fg)',
    textAlign: 'center',
    background: filled ? 'var(--bg-accent-soft)' : 'var(--bg)',
    border: `1.5px solid ${hasError ? 'var(--baari-error)' : filled ? 'var(--baari-lime-deep)' : 'var(--border)'}`,
    borderRadius: 'var(--radius-md)',
    outline: 'none',
    caretColor: 'var(--baari-lime-deep)',
    transition: 'border-color var(--dur-fast), background var(--dur-fast)',
  });

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
        {digits.map((d, i) => (
          <input
            key={i}
            ref={refs[i]}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={d}
            disabled={disabled}
            onChange={e => handleChange(i, e)}
            onKeyDown={e => handleKeyDown(i, e)}
            onPaste={handlePaste}
            style={boxStyle(!!d, !!error)}
          />
        ))}
      </div>
      {error && (
        <p style={{
          margin: '10px 0 0',
          fontSize: 'var(--fs-caption)',
          color: 'var(--baari-error)',
          fontFamily: 'var(--font-body)',
          textAlign: 'center',
        }}>
          {error}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create PasswordInput.tsx**

```tsx
// apps/web/src/components/auth/PasswordInput.tsx
'use client';
import { useState } from 'react';

interface PasswordInputProps {
  value: string;
  onChange: (v: string) => void;
  label?: string;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  showStrength?: boolean;
}

function getStrength(pw: string): { level: 0 | 1 | 2 | 3; label: string } {
  if (pw.length === 0)  return { level: 0, label: '' };
  if (pw.length < 8)    return { level: 1, label: 'Too short' };
  if (pw.length < 12)   return { level: 2, label: 'OK' };
  return                       { level: 3, label: 'Strong' };
}

const STRENGTH_COLOR: Record<0 | 1 | 2 | 3, string> = {
  0: 'var(--border)',
  1: 'var(--baari-error)',
  2: 'var(--baari-warning)',
  3: 'var(--baari-success)',
};

export function PasswordInput({
  value, onChange, label = 'Password', placeholder = '••••••••',
  error, disabled, showStrength = false,
}: PasswordInputProps) {
  const [show, setShow] = useState(false);
  const strength = getStrength(value);

  return (
    <div>
      <label style={{
        display: 'block',
        fontFamily: 'var(--font-body)',
        fontSize: 'var(--fs-body-sm)',
        fontWeight: 'var(--fw-medium)',
        color: 'var(--fg-secondary)',
        marginBottom: 6,
      }}>
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="current-password"
          style={{
            width: '100%',
            paddingLeft: 12,
            paddingRight: 44,
            paddingTop: 12,
            paddingBottom: 12,
            fontSize: 'var(--fs-body)',
            fontFamily: 'var(--font-body)',
            color: 'var(--fg)',
            background: 'var(--bg)',
            border: `1px solid ${error ? 'var(--baari-error)' : 'var(--border)'}`,
            borderRadius: 'var(--radius-md)',
            outline: 'none',
            boxSizing: 'border-box',
            transition: 'border-color var(--dur-fast)',
          }}
          onFocus={e => {
            e.target.style.borderColor = 'var(--baari-lime-deep)';
            e.target.style.boxShadow   = 'var(--shadow-ring)';
          }}
          onBlur={e => {
            e.target.style.borderColor = error ? 'var(--baari-error)' : 'var(--border)';
            e.target.style.boxShadow   = 'none';
          }}
        />
        <button
          type="button"
          onClick={() => setShow(s => !s)}
          tabIndex={-1}
          style={{
            position: 'absolute',
            right: 10,
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 4,
            color: 'var(--fg-muted)',
            fontSize: 16,
            lineHeight: 1,
          }}
        >
          {show ? '🙈' : '👁️'}
        </button>
      </div>

      {showStrength && value.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
            {([1, 2, 3] as const).map(l => (
              <div key={l} style={{
                flex: 1,
                height: 3,
                borderRadius: 999,
                background: strength.level >= l ? STRENGTH_COLOR[strength.level] : 'var(--border)',
                transition: 'background var(--dur-fast)',
              }} />
            ))}
          </div>
          {strength.label && (
            <p style={{
              margin: 0,
              fontSize: 'var(--fs-caption)',
              color: STRENGTH_COLOR[strength.level],
              fontFamily: 'var(--font-body)',
            }}>
              {strength.label}
            </p>
          )}
        </div>
      )}

      {error && (
        <p style={{
          margin: '6px 0 0',
          fontSize: 'var(--fs-caption)',
          color: 'var(--baari-error)',
          fontFamily: 'var(--font-body)',
        }}>
          {error}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Typecheck**

```bash
cd apps/web && pnpm typecheck
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/auth/
git commit -m "feat(web): auth UI components — AuthCard, PhoneInput, OTPInput, PasswordInput"
```

---

## Task 11 — Auth layout + login page

**Files:**
- Create: `apps/web/src/app/(auth)/layout.tsx`
- Create: `apps/web/src/app/(auth)/login/page.tsx`

- [ ] **Step 1: Create auth layout**

```tsx
// apps/web/src/app/(auth)/layout.tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
      background: 'var(--bg)',
    }}>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Create login page**

```tsx
// apps/web/src/app/(auth)/login/page.tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthCard } from '@/components/auth/AuthCard';
import { PhoneInput } from '@/components/auth/PhoneInput';
import { PasswordInput } from '@/components/auth/PasswordInput';

const API = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('92')) return `+${digits}`;
  if (digits.startsWith('0'))  return `+92${digits.slice(1)}`;
  if (digits.startsWith('3'))  return `+92${digits}`;
  return `+${digits}`;
}

export default function LoginPage() {
  const router = useRouter();
  const [phone,    setPhone]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`${API}/api/v1/auth/login`, {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body:        JSON.stringify({ phone: normalizePhone(phone), password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error?.message ?? 'Login failed. Try again.');
        return;
      }

      router.push('/dashboard');
    } catch {
      setError('Connection error. Check your internet and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard title="Welcome back" subtitle="Sign in to your dashboard">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <PhoneInput
          value={phone}
          onChange={setPhone}
          disabled={loading}
        />

        <div>
          <PasswordInput
            value={password}
            onChange={setPassword}
            disabled={loading}
          />
          <div style={{ textAlign: 'right', marginTop: 6 }}>
            <a
              href="/login/forgot"
              style={{
                fontSize: 'var(--fs-caption)',
                color: 'var(--fg-muted)',
                textDecoration: 'none',
              }}
            >
              Forgot password?
            </a>
          </div>
        </div>

        {error && (
          <div style={{
            padding: '10px 12px',
            background: '#FDF2F1',
            border: '1px solid #F5D0CD',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--fs-body-sm)',
            color: 'var(--baari-error)',
            fontFamily: 'var(--font-body)',
          }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !phone || !password}
          style={{
            width: '100%',
            padding: '13px 0',
            background: loading || !phone || !password ? 'var(--bg-subtle)' : 'var(--baari-onyx)',
            color: loading || !phone || !password ? 'var(--fg-muted)' : '#fff',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--fs-body)',
            fontFamily: 'var(--font-body)',
            fontWeight: 'var(--fw-medium)',
            cursor: loading || !phone || !password ? 'not-allowed' : 'pointer',
            transition: 'background var(--dur-fast)',
            letterSpacing: 'var(--tracking-button)',
          }}
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>

        <p style={{
          textAlign: 'center',
          fontSize: 'var(--fs-body-sm)',
          color: 'var(--fg-muted)',
          fontFamily: 'var(--font-body)',
          margin: 0,
        }}>
          No account?{' '}
          <a href="/signup" style={{ color: 'var(--fg-link)', fontWeight: 'var(--fw-medium)' }}>
            Create one
          </a>
        </p>
      </form>
    </AuthCard>
  );
}
```

- [ ] **Step 3: Typecheck**

```bash
cd apps/web && pnpm typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/\(auth\)/
git commit -m "feat(web): auth layout + login page"
```

---

## Task 12 — Signup pages (3 steps)

**Files:**
- Create: `apps/web/src/app/(auth)/signup/page.tsx`
- Create: `apps/web/src/app/(auth)/signup/verify/page.tsx`
- Create: `apps/web/src/app/(auth)/signup/password/page.tsx`

- [ ] **Step 1: Create signup/page.tsx (phone entry)**

```tsx
// apps/web/src/app/(auth)/signup/page.tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthCard } from '@/components/auth/AuthCard';
import { PhoneInput } from '@/components/auth/PhoneInput';

const API = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('92')) return `+${digits}`;
  if (digits.startsWith('0'))  return `+92${digits.slice(1)}`;
  if (digits.startsWith('3'))  return `+92${digits}`;
  return `+${digits}`;
}

export default function SignupPage() {
  const router = useRouter();
  const [phone,   setPhone]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const normalized = normalizePhone(phone);
    if (!/^\+923\d{9}$/.test(normalized)) {
      setError('Enter a valid Pakistani mobile number (03XX...)');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API}/api/v1/auth/send-otp`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ phone: normalized }),
      });
      const data = await res.json();

      if (res.status === 409) {
        setError('An account with this number already exists.');
        return;
      }
      if (!res.ok) {
        setError(data.error?.message ?? 'Failed to send code. Try again.');
        return;
      }

      // Pass phone to verify page via sessionStorage
      sessionStorage.setItem('baari_signup_phone', normalized);
      router.push('/signup/verify');
    } catch {
      setError('Connection error. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard
      title="Create your account"
      subtitle="Enter your mobile number to get started. We'll send a one-time code."
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <PhoneInput value={phone} onChange={setPhone} error={error} disabled={loading} />

        {error && (
          <div style={{
            padding: '10px 12px',
            background: '#FDF2F1',
            border: '1px solid #F5D0CD',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--fs-body-sm)',
            color: 'var(--baari-error)',
            fontFamily: 'var(--font-body)',
          }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !phone}
          style={{
            width: '100%',
            padding: '13px 0',
            background: loading || !phone ? 'var(--bg-subtle)' : 'var(--baari-onyx)',
            color: loading || !phone ? 'var(--fg-muted)' : '#fff',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--fs-body)',
            fontFamily: 'var(--font-body)',
            fontWeight: 'var(--fw-medium)',
            cursor: loading || !phone ? 'not-allowed' : 'pointer',
            transition: 'background var(--dur-fast)',
          }}
        >
          {loading ? 'Sending code…' : 'Send code'}
        </button>

        <p style={{
          textAlign: 'center',
          fontSize: 'var(--fs-body-sm)',
          color: 'var(--fg-muted)',
          fontFamily: 'var(--font-body)',
          margin: 0,
        }}>
          Already have an account?{' '}
          <a href="/login" style={{ color: 'var(--fg-link)', fontWeight: 'var(--fw-medium)' }}>
            Sign in
          </a>
        </p>
      </form>
    </AuthCard>
  );
}
```

- [ ] **Step 2: Create signup/verify/page.tsx (OTP entry)**

```tsx
// apps/web/src/app/(auth)/signup/verify/page.tsx
'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AuthCard } from '@/components/auth/AuthCard';
import { OTPInput } from '@/components/auth/OTPInput';

const API = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';

export default function SignupVerifyPage() {
  const router = useRouter();
  const [phone,     setPhone]     = useState('');
  const [otp,       setOtp]       = useState('');
  const [loading,   setLoading]   = useState(false);
  const [resending, setResending] = useState(false);
  const [error,     setError]     = useState('');
  const [countdown, setCountdown] = useState(300);

  useEffect(() => {
    const stored = sessionStorage.getItem('baari_signup_phone');
    if (!stored) { router.replace('/signup'); return; }
    setPhone(stored);
  }, [router]);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  // Auto-submit when all 6 digits entered
  useEffect(() => {
    if (otp.replace(/\s/g, '').length === 6 && !loading) {
      handleVerify(otp);
    }
  }, [otp]); // eslint-disable-line

  async function handleVerify(code: string) {
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/v1/auth/verify-otp`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ phone, otp: code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message ?? 'Wrong code. Try again.');
        setOtp('');
        return;
      }
      router.push('/signup/password');
    } catch {
      setError('Connection error. Try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setResending(true);
    setError('');
    try {
      await fetch(`${API}/api/v1/auth/send-otp`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ phone }),
      });
      setCountdown(300);
      setOtp('');
    } catch {
      setError('Could not resend. Try again.');
    } finally {
      setResending(false);
    }
  }

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <AuthCard
      title="Enter the code"
      subtitle={phone ? `We sent a 6-digit code to ${phone.replace('+92', '0')}` : 'Loading…'}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <OTPInput value={otp} onChange={setOtp} error={error} disabled={loading} />

        {!error && countdown > 0 && (
          <p style={{
            textAlign: 'center',
            fontSize: 'var(--fs-caption)',
            color: 'var(--fg-muted)',
            fontFamily: 'var(--font-body)',
            margin: 0,
          }}>
            Code expires in {fmt(countdown)}
          </p>
        )}

        {countdown === 0 && (
          <button
            type="button"
            onClick={handleResend}
            disabled={resending}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 'var(--fs-body-sm)',
              fontFamily: 'var(--font-body)',
              color: 'var(--fg-link)',
              textDecoration: 'underline',
              padding: 0,
              margin: '0 auto',
              display: 'block',
            }}
          >
            {resending ? 'Sending…' : 'Resend code'}
          </button>
        )}

        <a
          href="/signup"
          style={{
            textAlign: 'center',
            fontSize: 'var(--fs-caption)',
            color: 'var(--fg-muted)',
            fontFamily: 'var(--font-body)',
            display: 'block',
            textDecoration: 'none',
          }}
        >
          ← Change number
        </a>
      </div>
    </AuthCard>
  );
}
```

- [ ] **Step 3: Create signup/password/page.tsx (set password)**

```tsx
// apps/web/src/app/(auth)/signup/password/page.tsx
'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AuthCard } from '@/components/auth/AuthCard';
import { PasswordInput } from '@/components/auth/PasswordInput';

const API = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';

export default function SignupPasswordPage() {
  const router = useRouter();
  const [phone,    setPhone]    = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  useEffect(() => {
    const stored = sessionStorage.getItem('baari_signup_phone');
    if (!stored) { router.replace('/signup'); return; }
    setPhone(stored);
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API}/api/v1/auth/complete-signup`, {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body:        JSON.stringify({ phone, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error?.message ?? 'Could not create account. Try again.');
        return;
      }

      sessionStorage.removeItem('baari_signup_phone');
      router.push('/dashboard');
    } catch {
      setError('Connection error. Try again.');
    } finally {
      setLoading(false);
    }
  }

  const ready = password.length >= 8 && password === confirm;

  return (
    <AuthCard
      title="Set your password"
      subtitle="You'll use this to sign in from now on. No codes needed."
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <PasswordInput
          label="Password"
          value={password}
          onChange={setPassword}
          disabled={loading}
          showStrength
          placeholder="Min. 8 characters"
        />

        <PasswordInput
          label="Confirm password"
          value={confirm}
          onChange={setConfirm}
          disabled={loading}
          error={confirm && password !== confirm ? 'Passwords do not match' : undefined}
        />

        {error && (
          <div style={{
            padding: '10px 12px',
            background: '#FDF2F1',
            border: '1px solid #F5D0CD',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--fs-body-sm)',
            color: 'var(--baari-error)',
            fontFamily: 'var(--font-body)',
          }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !ready}
          style={{
            width: '100%',
            padding: '13px 0',
            background: loading || !ready ? 'var(--bg-subtle)' : 'var(--baari-onyx)',
            color: loading || !ready ? 'var(--fg-muted)' : '#fff',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--fs-body)',
            fontFamily: 'var(--font-body)',
            fontWeight: 'var(--fw-medium)',
            cursor: loading || !ready ? 'not-allowed' : 'pointer',
            transition: 'background var(--dur-fast)',
          }}
        >
          {loading ? 'Creating account…' : 'Create account →'}
        </button>
      </form>
    </AuthCard>
  );
}
```

- [ ] **Step 4: Typecheck**

```bash
cd apps/web && pnpm typecheck
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/\(auth\)/signup/
git commit -m "feat(web): signup flow — phone → OTP → password pages"
```

---

## Task 13 — Middleware + dashboard layout

**Files:**
- Create: `apps/web/src/middleware.ts`
- Create: `apps/web/src/app/dashboard/layout.tsx`

- [ ] **Step 1: Create middleware.ts**

```typescript
// apps/web/src/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('baari_token');

  if (!token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*'],
};
```

- [ ] **Step 2: Create dashboard/layout.tsx**

```tsx
// apps/web/src/app/dashboard/layout.tsx
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
```

- [ ] **Step 3: Typecheck**

```bash
cd apps/web && pnpm typecheck
```

Expected: no errors.

- [ ] **Step 4: End-to-end smoke test**

Start both servers:
```bash
pnpm dev
```

Test the auth guard:
```bash
# Should redirect to /login (follow redirects, check final URL)
curl -s -o /dev/null -w "%{url_effective}\n" -L http://localhost:3000/dashboard
```
Expected: URL ends in `/login?next=/dashboard`

Test signup OTP stub (API console should log the OTP):
```bash
curl -s -X POST http://localhost:3001/api/v1/auth/send-otp \
  -H 'Content-Type: application/json' \
  -d '{"phone":"03001234567"}'
```
Expected: `{"ok":true,"expiresIn":300}` + console log with OTP.

Open `http://localhost:3000/signup` in a browser.
Verify the signup page renders with Baari branding, lime accent strip, and Pakistani phone input.

Open `http://localhost:3000/login` in a browser.
Verify the login page renders correctly.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/middleware.ts apps/web/src/app/dashboard/layout.tsx
git commit -m "feat(web): dashboard auth guard middleware + layout"
```

---

## Self-review checklist

- [x] **Spec coverage:**
  - Phase 1A endpoints: send-otp ✓ verify-otp ✓ complete-signup ✓ login ✓ send-email-otp ✓ verify-email-otp ✓ forgot-password ✓ reset-password ✓ refresh ✓ logout ✓ GET /me ✓
  - Authenticate hook: registered in index.ts ✓
  - Rate limiting: global `@fastify/rate-limit` already registered in index.ts; per-phone rate key in otp.ts ✓
  - httpOnly cookies: `@fastify/cookie` + `setCookies` helper ✓
  - Phase 1B pages: /login ✓ /signup ✓ /signup/verify ✓ /signup/password ✓
  - Middleware auth guard ✓
  - Male salon data sweep ✓
  - Schema migration 0002 ✓
  - SMS/email stubbed with console.log ✓

- [x] **Placeholder scan:** No TBD, no vague steps, all code shown.

- [x] **Type consistency:**
  - `JWTPayload.sub` = userId throughout ✓
  - `JWTPayload.tid` = tenantId throughout ✓
  - `schema.refreshTokens` matches `refreshTokens` table in schema.ts ✓
  - `schema.users.phoneE164` matches column name `phone_e164` ✓
  - `isLockedOut` (not `checkLockout`) used in auth.ts ✓
  - `validateRefreshToken` signature matches tokens.ts ✓
