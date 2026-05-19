# Auth & Identity — Design Spec
**Date:** 2026-05-19  
**Scope:** Phase 1A (Auth API) + Phase 1B (Auth Web) + Male salon data sweep  
**Deferred:** Phase 1C (Onboarding wizard), Phase 1D (Team invites)

---

## 1. Scope Summary

### In scope
- **Auth API (Fastify)** — 11 endpoints covering signup OTP, login, password reset, token refresh, logout, and current-user
- **Auth Web (Next.js)** — 4 pages: `/signup`, `/signup/verify`, `/signup/password`, `/login`; plus Next.js middleware for dashboard auth guard
- **Schema migration 0002** — auth columns on `users` and `tenants`, new `refresh_tokens`, `otp_log`, `working_hours` tables
- **Male salon data sweep** — `data.ts` updated to barbershop context (male staff names, male clients, barber services)

### Out of scope (this session)
- Onboarding wizard (`/onboarding/*`)
- Team invites (`/invite/[token]`)
- WhatsApp customer identity
- Email service (Resend) integration — stubbed
- SMS provider (Twilio/Vonage) integration — stubbed

---

## 2. Auth Flow Overview

```
SIGNUP
  /signup          → enter phone (normalized to +92XXXXXXXXXX)
  /signup/verify   → 6-digit OTP (SMS sent once, console.log in dev)
  /signup/password → set password (min 8 chars, strength meter)
  complete-signup API → creates tenant + location + user → JWT cookies set
  → redirect /dashboard

LOGIN (zero SMS)
  /login → phone + password
  login API → bcrypt compare → JWT cookies set
  → redirect /dashboard (or /onboarding if incomplete)

FORGOT PASSWORD
  /login → "Forgot password?" link
  forgot-password API → sends email OTP (free) or SMS OTP (fallback)
  → OTP entry → reset-password API → new password set → JWT cookies
```

---

## 3. API Endpoints

All under `POST /api/v1/auth/*` unless noted. All `/auth/*` routes rate-limited at 20 req/min per IP.

| Endpoint | Body | Returns | Side effects |
|---|---|---|---|
| `POST /auth/send-otp` | `{ phone }` | `{ ok, expiresIn: 300 }` | Redis `otp:{phone}` TTL=300s, SMS (stubbed) |
| `POST /auth/verify-otp` | `{ phone, otp }` | `{ ok, phoneVerified: true }` | Redis: delete OTP, set `verified:{phone}` TTL=600s |
| `POST /auth/complete-signup` | `{ phone, password, ownerName? }` | `{ ok, user }` | DB: tenant+location+user; sets httpOnly cookies |
| `POST /auth/login` | `{ phone, password }` | `{ ok, user }` | Sets httpOnly cookies; increments failedLoginCount on fail |
| `POST /auth/send-email-otp` | `{ email }` | `{ ok }` | Redis `email_otp:{email}` TTL=600s; email (stubbed) |
| `POST /auth/verify-email-otp` | `{ email, otp }` | `{ ok, user }` | Sets httpOnly cookies |
| `POST /auth/forgot-password` | `{ phone }` | `{ ok, method, hint }` | Email OTP if email on account, SMS OTP fallback |
| `POST /auth/reset-password` | `{ resetToken, newPassword }` | `{ ok }` | Updates passwordHash, invalidates all refresh tokens |
| `POST /auth/refresh` | (cookie) | `{ ok }` | Rotates both cookies; deletes old refresh token |
| `POST /auth/logout` | (cookie) | `{ ok }` | Clears cookies, deletes refresh token from Redis + DB |
| `GET /api/v1/me` | — | `{ user, tenant, location }` | Read-only |

### Rate limits (enforced via Fastify rate-limit per endpoint)
- `send-otp`: 3 per phone per hour
- `verify-otp`: 5 attempts per token (then delete)
- `login`: 5 failed attempts → 15-min lockout per phone
- `send-email-otp`: 5 per email per hour
- `refresh`: 10 per user per minute

---

## 4. File Structure

### API
```
apps/api/src/
  lib/auth/
    otp.ts          # generateOTP, storeOTP, validateOTP (Redis)
    tokens.ts       # issueJWT, issueRefreshToken, rotateRefresh, revokeAll
    password.ts     # hashPassword, verifyPassword, checkLockout, recordFailedAttempt
    sms.ts          # sendOTP(phone, otp) — STUB: console.log + TODO
    email.ts        # sendEmailOTP(email, otp) — STUB: console.log + TODO
  routes/
    auth.ts         # all /auth/* endpoints
    me.ts           # GET /me
```

### Web
```
apps/web/src/
  middleware.ts                     # protects /dashboard/*, redirects to /login
  app/
    (auth)/
      layout.tsx                    # auth shell: centered card, Baari branding
      login/
        page.tsx                    # phone + password form
      signup/
        page.tsx                    # phone input step
        verify/page.tsx             # 6-digit OTP input
        password/page.tsx           # set password step
  components/auth/
    PhoneInput.tsx                  # Pakistani phone normalisation (03XX → +923XX)
    OTPInput.tsx                    # 6 individual digit inputs, auto-advance
    PasswordInput.tsx               # show/hide toggle, strength indicator
    AuthCard.tsx                    # shared card shell (lime accent header)
```

---

## 5. Schema Migration 0002

### Changes to existing tables
```sql
-- tenants
ALTER TABLE tenants
  ADD COLUMN onboarding_step     INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN onboarding_complete BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN city                TEXT,
  ADD COLUMN owner_name          TEXT;

-- users: make email nullable, add auth fields
ALTER TABLE users
  ALTER COLUMN email DROP NOT NULL,
  ADD COLUMN phone_e164         TEXT,
  ADD COLUMN password_hash      TEXT,
  ADD COLUMN phone_verified     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN failed_login_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN locked_until       TIMESTAMPTZ,
  ADD COLUMN last_login_at      TIMESTAMPTZ;

CREATE UNIQUE INDEX users_phone_uniq ON users(phone_e164)
  WHERE phone_e164 IS NOT NULL;
```

### New tables
- `refresh_tokens` — user_id, token (unique), expires_at
- `otp_log` — phone, created_at, verified_at, ip_address (audit trail)
- `working_hours` — tenant_id, location_id, day_of_week (0–6), is_open, open_time, close_time
- `team_invites` — tenant_id, phone_e164, role, token, expires_at, accepted_at (partial; needed for schema completeness even though invite flow is deferred)

All new tenant-scoped tables get RLS (`ENABLE ROW LEVEL SECURITY` + policy on `tenant_id`).

---

## 6. Token & Cookie Strategy

- **JWT (`baari_token`)**: httpOnly, Secure, SameSite=Lax, 7d expiry. Claims: `{ sub: userId, tid: tenantId, role, loc: [locationId] }`.
- **Refresh token (`baari_refresh`)**: httpOnly, Secure, SameSite=Lax, 30d expiry. Stored as UUID in both Redis (fast lookup) and `refresh_tokens` table (audit/recovery).
- **Rotation**: on every `/auth/refresh` call, old refresh token is deleted and a new one issued. If Redis TTL expires but DB row exists, DB is authoritative.
- **Revocation**: logout deletes from both Redis and DB. Password reset calls `revokeAll(userId)` which bulk-deletes all refresh_tokens rows and all Redis keys for that user.

---

## 7. Web Pages — Design Decisions

- All auth pages share a centered `AuthCard` component with the Baari lime accent strip at top and the Baari wordmark.
- Phone input normalises Pakistani formats: `03001234567` → `+923001234567` on blur/submit.
- OTP input: 6 separate `<input maxLength=1>` fields that auto-focus next on each digit, auto-submit on 6th digit, and support paste (splits across fields).
- Password input: show/hide toggle (eye icon), minimum 8 chars, no forced complexity (per PRODUCT.md).
- Error messages: inline below the relevant field, using `--baari-red` (`#B5483A`) for text. Toast for network errors.
- Loading state: primary button shows a subtle spinner (no full-page skeleton).
- All forms submit via `fetch` to the API with `credentials: 'include'` to carry cookies cross-origin.
- `middleware.ts` checks for `baari_token` cookie. Missing → `NextResponse.redirect('/login')`. Present → allow. Covers all `/dashboard/*` routes.

---

## 8. Male Salon Data Sweep

`apps/web/src/components/dashboard/data.ts` updated:

**STAFF** (4 barbers):
- Usman — Senior Barber
- Hassan — Color Specialist
- Bilal — Barber
- Ahmed — Grooming Expert

**SERVICES** (barbershop-appropriate):
Haircut, Fade Cut, Beard Trim, Clean Shave, Head Massage, Global Color, Highlights, Hair Spa, Facial (Men), Khatna Preparation

**SEED_APPTS / SEED_REQUESTS / SEED_CLIENTS**: male Pakistani names, male-context client notes (e.g. "prefers low fade on sides, medium on top").

---

## 9. What Is Stubbed (Not Implemented)

| Feature | Stub location | What to do when ready |
|---|---|---|
| SMS send | `lib/auth/sms.ts` → `sendOTP()` | Replace body with Twilio/Vonage SDK call |
| Email send | `lib/auth/email.ts` → `sendEmailOTP()` | Replace body with Resend SDK call |
| SMS forgot-password fallback | Same `sms.ts` | Auto-activates once `sendOTP` is real |

Both stubs log `[AUTH STUB] OTP for {phone}: {otp}` to console in development so the flow can be tested end-to-end without a real provider.

---

## 10. Key Invariants

- `tenantId` in JWT `tid` claim is the only authoritative tenant identifier — never from request body or URL
- All money in paisa (PKR × 100) in BIGINT — not relevant here but preserved
- `complete-signup` creates tenant + location + user in a single DB transaction — no orphaned records
- OTP brute-force protection: 5 wrong attempts deletes the Redis key (user must request a new OTP)
- Login lockout: 5 failed attempts sets `locked_until = NOW() + 15 min` — checked before bcrypt compare to avoid timing attacks leaking valid phone numbers
- Email and phone uniqueness enforced at DB level (partial unique indexes) — not just application code
