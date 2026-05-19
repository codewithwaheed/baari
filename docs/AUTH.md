# Baari · باری — Auth, Onboarding & Identity

> Covers: Phase 1 expanded — Auth flow, Owner onboarding, Role system, Client identity via WhatsApp.

---

## Table of Contents

1. [User Types & Role System](#1-user-types--role-system)
2. [Auth Flow — Salon Owner](#2-auth-flow--salon-owner)
3. [Owner Onboarding Flow](#3-owner-onboarding-flow)
4. [Auth Flow — Staff & Manager](#4-auth-flow--staff--manager)
5. [Client Identity via WhatsApp](#5-client-identity-via-whatsapp)
6. [API Contracts](#6-api-contracts)
7. [Database Schema — Auth & Identity](#7-database-schema--auth--identity)
8. [Implementation Checklist](#8-implementation-checklist)

---

## 1. User Types & Role System

There are **three distinct user categories** in Baari. They are fundamentally different in how they authenticate, what they can access, and where they live in the database.

```
┌─────────────────────────────────────────────────────────────────┐
│                        BAARI USERS                              │
│                                                                 │
│  ┌──────────────────────────┐   ┌────────────────────────────┐  │
│  │   DASHBOARD USERS        │   │    WHATSAPP CUSTOMERS       │  │
│  │  (log into the app)      │   │  (never log into the app)  │  │
│  │                          │   │                            │  │
│  │  Owner (1 per salon)     │   │  Identified by:            │  │
│  │  Manager (0–N per salon) │   │  phone + tenantId only     │  │
│  │  Staff   (0–N per salon) │   │                            │  │
│  │                          │   │  Live in: customers table  │  │
│  │  Live in: users table    │   │  Auth: none needed         │  │
│  └──────────────────────────┘   └────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 1.1 Dashboard Users — Role Matrix

| Permission                 | Owner | Manager | Staff                 |
| -------------------------- | ----- | ------- | --------------------- |
| View own calendar column   | ✅    | ✅      | ✅                    |
| View all staff calendars   | ✅    | ✅      | ❌                    |
| Create manual bookings     | ✅    | ✅      | ✅                    |
| Approve / decline requests | ✅    | ✅      | ❌                    |
| Check in a client          | ✅    | ✅      | ✅                    |
| Complete checkout (POS)    | ✅    | ✅      | ✅                    |
| Apply discounts at POS     | ✅    | ✅      | ❌                    |
| View client notes          | ✅    | ✅      | ✅ (own clients only) |
| Edit client notes          | ✅    | ✅      | ✅ (own clients only) |
| Mark VIP                   | ✅    | ✅      | ❌                    |
| View revenue / sales data  | ✅    | ✅      | ❌                    |
| Manage services            | ✅    | ❌      | ❌                    |
| Manage staff profiles      | ✅    | ❌      | ❌                    |
| Configure working hours    | ✅    | ❌      | ❌                    |
| Connect WhatsApp           | ✅    | ❌      | ❌                    |
| Configure payments         | ✅    | ❌      | ❌                    |
| Invite new team members    | ✅    | ❌      | ❌                    |
| Change subscription plan   | ✅    | ❌      | ❌                    |

### 1.2 Client Users — No Dashboard Login

WhatsApp customers are **not** dashboard users. They have no login, no password, no account in the traditional sense. They are identified entirely by `(tenantId, phoneE164)` — that composite pair is their identity within a salon.

The same phone number can be a customer at multiple salons. Each salon has their own `customers` row for that phone. There is zero cross-tenant leakage.

Clients do not need an auth system. They are created automatically the moment their phone number interacts with the salon's WhatsApp. See [Section 5](#5-client-identity-via-whatsapp) for the full flow.

---

## 2. Auth Flow — Salon Owner

### 2.0 Strategy — Phone Verified Once, Password Used After

Sending an SMS OTP on every login is expensive and unnecessary. Pakistani SMS rates via Twilio or Vonage run PKR 8–15 per message. At 100 active owners logging in daily that is PKR 25,000–45,000/month just on SMS — before making a rupee.

The correct approach:

- **SIGNUP** — Phone OTP via SMS, one time only. Verify the number is real.
- **SAME SESSION** — Immediately after OTP, user sets a password (required, not optional).
- **EVERY SUBSEQUENT LOGIN** — Phone + Password. Zero SMS. Zero cost.
- **FORGOT PASSWORD** — Email OTP if email is on the account (free). SMS OTP fallback (one-time, rare).

Phone is the **username** — the unique identifier for the account. It is verified once at signup via SMS OTP. After that, it never triggers an SMS again.

> This is exactly how Pakistani fintech apps work — JazzCash, EasyPaisa, Meezan Bank all verify phone once then switch to PIN/password. Users already expect this pattern.

---

### 2.1 Signup Flow — Phone Verified Once, Then Password Set

```
/signup — Step 1: Enter phone number
  Normalize: 03001234567 -> +923001234567
  Check: does this phone already have an account? -> redirect to /login
  Rate check: max 3 OTP requests per phone per hour -> 429 if exceeded

POST /api/v1/auth/send-otp
  Generate 6-digit OTP
  Store in Redis: key=otp:{phone}, value={otp, attempts:0}, TTL=300s
  Send SMS (THE ONLY SMS THIS USER WILL EVER RECEIVE)
  Return: { ok: true, expiresIn: 300 }

/signup — Step 2: Enter 6-digit OTP
  Auto-submit on 6th digit
  Auto-read SMS on Android (SMS Retriever API)

POST /api/v1/auth/verify-otp
  Get Redis key otp:{phone}
  Not found -> 401 "OTP expired. Request a new one."
  Increment attempts. If attempts >= 5: delete key, 401 "Too many attempts"
  Mismatch -> 401 "Wrong code"
  Match -> delete OTP from Redis, mark phone as verified in session

/signup — Step 3: Set password (shown immediately after OTP success)
  Password: min 8 characters, show strength indicator
  Confirm password field
  No "skip" option — password is required to complete signup

POST /api/v1/auth/complete-signup
  Body: { phone, password, ownerName? }
  Server hashes password: bcrypt, rounds=12
  Create in a single DB transaction:
    tenant row  (plan=free, status=active, onboardingStep=0)
    location row (name=Main Branch)
    user row    (role=owner, phoneE164, passwordHash, phoneVerified=true)
  Issue JWT: { sub: userId, tid: tenantId, role: owner, loc: [locationId] }
  Issue refresh token (UUID, stored in Redis + DB, TTL=30d)
  Set httpOnly cookies: baari_token (7d), baari_refresh (30d)
  Return: { ok: true, isNewUser: true, user: { id, name, role } }

-> Redirect to /onboarding/salon
```

---

### 2.2 Login Flow — Password (Zero SMS Cost)

```
/login — Enter phone + password

POST /api/v1/auth/login
  Normalize phone to E.164
  Find user by phoneE164
  Not found -> 401 "No account found with this number"
  Compare password with bcrypt hash
  Mismatch -> increment users.failedLoginCount
    If failedLoginCount >= 5:
      Set lockedUntil = now() + 15 minutes
      Return 429 "Too many attempts. Try again in 15 minutes."
  Match -> reset failedLoginCount, clear lockedUntil
  Issue JWT + refresh token
  Set httpOnly cookies
  Return: { ok: true, user: { id, name, role, tenantId } }

  onboardingComplete === false -> /onboarding (resumes at correct step)
  onboardingComplete === true  -> /dashboard
```

---

### 2.3 Login with Email OTP (Alternative — Zero SMS Cost)

If the owner has added an email to their account, they can get a login code sent to email. Free.
Useful when they forget their password or are on a new device.

```
/login -> tap "Login with email instead"

Enter email address

POST /api/v1/auth/send-email-otp
  Find user by email
  Not found -> return 200 anyway (never reveal if email exists)
  Generate 6-digit OTP
  Store in Redis: key=email_otp:{email}, value={otp, userId, attempts:0}, TTL=600s
  Send email via Resend or SendGrid (cost: < $0.001 per email)
  Return: { ok: true, message: "Check your email" }

Enter OTP from email

POST /api/v1/auth/verify-email-otp
  Validate OTP from Redis (same pattern as phone OTP)
  On success: issue JWT + refresh token, set cookies
  Optionally prompt: "Set a new password?" if coming from forgot-password
  Return: { ok: true, user: {...} }
```

---

### 2.4 Forgot Password Flow

```
/login -> "Forgot password?"

Enter phone number

POST /api/v1/auth/forgot-password
  Find user by phoneE164
  Not found -> 200 (do not leak)
  User has email on account -> send OTP to email (free, preferred)
  User has no email         -> send OTP via SMS (one-time cost, rare)
  Return: { ok: true, method: "email" | "sms", hint: "s***@gmail.com" }

Enter OTP

POST /api/v1/auth/verify-reset-otp
  Validate OTP
  On success: return short-lived reset_token (UUID, Redis, TTL=10min)
  Return: { ok: true, resetToken: "..." }

Enter new password

POST /api/v1/auth/reset-password
  Body: { resetToken, newPassword }
  Validate resetToken in Redis
  Hash newPassword (bcrypt, rounds=12)
  Update user.passwordHash
  Delete resetToken from Redis
  Invalidate all existing refresh tokens for this user (force re-login everywhere)
  Issue fresh JWT + refresh token
  Return: { ok: true }
```

---

### 2.5 Token Refresh

```
JWT expires (7d) -> any API call returns 401

POST /api/v1/auth/refresh  (baari_refresh cookie sent automatically)
  Validate refresh token in Redis
  Not found or expired -> 401, client redirects to /login
  Issue new JWT (7d)
  Rotate refresh token: delete old, create new (30d TTL)
  Set new cookies
  Return: { ok: true }
```

---

### 2.6 SMS Cost Comparison

| Event                              | SMS Sent?                 | Cost per user           |
| ---------------------------------- | ------------------------- | ----------------------- |
| Signup — phone verification        | Yes, once                 | ~PKR 10                 |
| Every subsequent login             | No                        | Free                    |
| Forgot password (email on account) | No — email used           | Free                    |
| Forgot password (no email)         | Yes, rare                 | ~PKR 10, once           |
| Staff invite                       | WhatsApp message, not SMS | ~$0.006                 |
| **500 owners total, ever**         |                           | **~PKR 5,000 one-time** |

OTP-on-every-login alternative:
500 owners x 2 logins/day x 30 days x PKR 10 = **PKR 300,000/month**

---

### 2.7 Rate Limiting Rules

| Endpoint                      | Limit                                         |
| ----------------------------- | --------------------------------------------- |
| `POST /auth/send-otp` (SMS)   | 3 per phone per hour                          |
| `POST /auth/verify-otp`       | 5 attempts per token, then deleted            |
| `POST /auth/login` (password) | 5 failed attempts -> 15 min lockout per phone |
| `POST /auth/send-email-otp`   | 5 per email per hour                          |
| `POST /auth/verify-email-otp` | 5 attempts per token                          |
| All `/auth/*` routes          | 20 req/min per IP                             |
| `POST /auth/refresh`          | 10 req/min per user                           |

---

## 3. Owner Onboarding Flow

After first signup, the owner is redirected to `/onboarding`. This is a **multi-step wizard** that collects the minimum information needed to make the salon functional. Everything collected here can be changed later in Settings.

The goal: owner goes from zero to "first booking possible" in under 5 minutes.

### 3.1 Onboarding Steps

```
Step 1: Salon Basics
Step 2: Services
Step 3: Working Hours
Step 4: Done → Dashboard
```

Progress is saved after each step. If the owner closes the browser mid-onboarding and comes back, they resume at the last incomplete step.

Add `onboarding_step` (integer 0–4) and `onboarding_complete` (boolean) to the `tenants` table.

### 3.2 Step 1 — Salon Basics

**URL:** `/onboarding/salon`

**Fields:**

- **Salon name** (required) — text input, e.g. "Saloni Studio"
  - Auto-generates `slug` from this: "Saloni Studio" → `saloni-studio`
  - Show slug preview: `book.baari.pk/saloni-studio` (editable inline)
- **City** (required) — dropdown: Lahore, Karachi, Islamabad, Rawalpindi, Faisalabad, Other
- **Owner name** (required) — the person using the app
- **Business WhatsApp number** (optional at this step) — the number they want to connect later
  - Show note: "You can connect WhatsApp later in Settings"

**On submit:**

- `PATCH /api/v1/tenants/me` — saves name, city, slug
- `PATCH /api/v1/users/me` — saves owner display name
- Advance `onboarding_step` to 2
- Redirect to `/onboarding/services`

> 📱 **Mobile:** Single-column form. Large input fields. Keyboard type `text` for salon name. City dropdown uses native select. "Continue" button pinned to bottom.

### 3.3 Step 2 — Services

**URL:** `/onboarding/services`

**What it does:** Owner adds at least one service. Without services, the booking flow cannot work.

**UI:** A growing list of service cards. Owner can add multiple services before continuing.

**Pre-loaded service templates** (owner taps to add instantly, can edit):

| Category | Quick-add services shown                                       |
| -------- | -------------------------------------------------------------- |
| Hair     | Haircut, Blow Dry, Highlights, Balayage, Keratin, Global Color |
| Skin     | Facial, Threading, Waxing, Cleanup                             |
| Nails    | Manicure, Pedicure, Gel Nails                                  |
| Makeup   | Party Makeup, Bridal Makeup, Mehndi Makeup                     |
| Barber   | Haircut, Beard Trim, Head Massage, Clean Shave                 |

Owner taps a template → it appears as an editable service card with fields:

- **Service name** (pre-filled from template, editable)
- **Price (PKR)** — number input
- **Duration** — segmented control: 30 / 45 / 60 / 90 / 120 / 150 / 180 min
- **Remove** (×) button

"Add custom service" button for anything not in templates.

**Validation:** At least 1 service with a name and price must be added.

**On submit:**

- `POST /api/v1/services/batch` — creates all services in one call
- Advance `onboarding_step` to 3
- Redirect to `/onboarding/hours`

> 📱 **Mobile:** Template tiles shown as a 2-column grid of large tap targets. Tapped templates expand inline as editable cards. No modal — all editing happens inline on the same screen. "Continue" button at bottom, enabled only after ≥1 service added.

### 3.4 Step 3 — Working Hours

**URL:** `/onboarding/hours`

**What it does:** Sets when the salon is open. Controls which time slots are offered in the booking flow.

**UI:**

- Default pre-filled: Mon–Sat, 9:00am – 8:00pm, Sunday closed
- Day rows (M T W T F S S) — each row: active toggle, open time, close time
- Toggling a day off greys out its time pickers

**On submit:**

- `POST /api/v1/settings/hours` — saves hours for all 7 days
- Advance `onboarding_step` to 4, set `onboarding_complete = true`
- Redirect to `/onboarding/done`

> 📱 **Mobile:** Each day is a row with a toggle on the left. Time pickers open native time picker on tap. "All same hours" shortcut: set Monday hours, apply to all active days with one tap.

### 3.5 Step 4 — Done

**URL:** `/onboarding/done`

**What it shows:**

- ✅ "Your salon is ready."
- Summary: salon name, N services added, working hours
- Two CTAs:
  - **"Go to dashboard"** (primary) → `/dashboard`
  - **"Connect WhatsApp"** (secondary) → `/dashboard?open=whatsapp-setup` (opens WhatsApp setup in Settings automatically)

**No API call needed here.** Just navigation.

### 3.6 Onboarding State in Backend

```typescript
// Add to tenants table
onboardingStep:     integer (0 = not started, 1 = basics done, 2 = services done, 3 = hours done, 4 = complete)
onboardingComplete: boolean (false until step 4)
```

```typescript
// Middleware on /dashboard routes
if (!tenant.onboardingComplete) {
  const stepRoutes = [
    "/onboarding/salon",
    "/onboarding/services",
    "/onboarding/hours",
  ];
  redirect(stepRoutes[tenant.onboardingStep] ?? "/onboarding/salon");
}
```

### 3.7 Onboarding Skip / Resume Logic

| Scenario                                    | Behaviour                                              |
| ------------------------------------------- | ------------------------------------------------------ |
| Owner closes browser on Step 2              | Cookie persists. Next visit → `/onboarding/services`   |
| Owner completes all steps                   | `onboardingComplete = true`. Next login → `/dashboard` |
| Owner visits `/dashboard` before completing | Middleware redirects to correct step                   |
| Owner visits `/onboarding` after completing | Redirect to `/dashboard`                               |

---

## 4. Auth Flow — Staff & Manager

Staff and managers are **invited** by the salon owner. They do not self-register.

### 4.1 Invite Flow (Owner Side)

1. Owner goes to Settings → Team
2. Enters staff member's phone number + selects role (Manager or Staff)
3. Optionally links to an existing staff profile (from the staff table)
4. Taps "Send Invite"

**Backend:**

```
POST /api/v1/team/invite
  → Create invite record: { tenantId, phone, role, staffId?, token: uuid, expiresAt: 48h }
  → Send WhatsApp message to that phone number:
    "Ayesha Khan has invited you to join [Salon Name] on Baari.
     Tap here to accept: app.baari.pk/invite/[token]"
```

### 4.2 Invite Acceptance (Staff Side)

1. Staff taps link → lands on `/invite/[token]`
2. Page shows: "You've been invited to join [Salon Name] as [Role]"
3. "Accept Invite" button

**Backend:**

```
GET /api/v1/team/invite/:token
  → Validate token exists and not expired
  → Return: { salonName, role, inviterName }

POST /api/v1/team/invite/:token/accept
  → Same OTP flow as owner signup (phone from invite record)
  → On OTP verify:
      - Create user row with { tenantId, role, staffId?, phone }
      - Delete invite record
      - Return JWT scoped to this tenant
  → Redirect to /dashboard (staff sees simplified view)
```

### 4.3 Staff Dashboard View

Staff role gets a restricted dashboard:

- Calendar shows **only their own column** (filtered by their `staffId`)
- No revenue amounts shown anywhere
- No access to Settings
- No access to Clients (own appointment clients only)
- No Requests tab visible
- Bottom nav: Calendar only (+ POS if they do checkout)

This is enforced both:

- **API level:** all queries filtered by `staffId` from JWT when role = 'staff'
- **UI level:** nav items hidden based on role from JWT claims

---

## 5. Client Identity via WhatsApp

This answers: _"How does a customer chatting on WhatsApp get identified and stored in our backend?"_

### 5.1 What WhatsApp Gives Us

When a customer sends any message to a salon's WhatsApp Business number, Meta's webhook delivers a payload to `POST /webhooks/whatsapp`. This payload **always contains** the customer's phone number and optionally their WhatsApp profile name.

```json
{
  "entry": [
    {
      "changes": [
        {
          "value": {
            "metadata": {
              "phone_number_id": "123456789",
              "display_phone_number": "923001234567"
            },
            "contacts": [
              {
                "profile": {
                  "name": "Sadia Malik"
                },
                "wa_id": "923001234567"
              }
            ],
            "messages": [
              {
                "from": "923001234567",
                "id": "wamid.xxx",
                "type": "text",
                "text": { "body": "Hi, I want to book an appointment" }
              }
            ]
          }
        }
      ]
    }
  ]
}
```

**From this payload we extract:**

| Field             | Source                     | What we use it for                                       |
| ----------------- | -------------------------- | -------------------------------------------------------- |
| `phone_number_id` | `metadata.phone_number_id` | Identifies WHICH salon this message is for (routing key) |
| `customer_phone`  | `messages[0].from`         | Identifies WHO sent the message (E.164 format)           |
| `customer_name`   | `contacts[0].profile.name` | Optional — their WhatsApp display name                   |

### 5.2 Tenant Identification (phone_number_id → tenantId)

Each salon has their own WhatsApp Business number connected to Baari. When they connect via Embedded Signup, we store their `wa_phone_id` (Meta's identifier for their number) on the tenant row.

On every incoming webhook:

```typescript
// apps/api/src/workers/whatsapp.worker.ts

async function routeInboundMessage(payload: MetaWebhookPayload) {
  const phoneNumberId =
    payload.entry[0].changes[0].value.metadata.phone_number_id;

  // Step 1: Redis cache lookup (fast path)
  let tenantId = await redis.get(`wa:phone:${phoneNumberId}`);

  // Step 2: DB fallback if not in cache
  if (!tenantId) {
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.waPhoneId, phoneNumberId),
    });
    if (!tenant) {
      console.warn(`No tenant found for phone_number_id: ${phoneNumberId}`);
      return; // message from an unconnected number — ignore
    }
    tenantId = tenant.id;
    // Warm the cache for next time (24h TTL)
    await redis.set(`wa:phone:${phoneNumberId}`, tenantId, "EX", 86400);
  }

  // Now we know which salon this message belongs to
  await handleMessage(tenantId, payload);
}
```

### 5.3 Customer Identification and Upsert

Once we know the `tenantId`, we identify the customer:

```typescript
async function identifyOrCreateCustomer(
  tenantId: string,
  customerPhone: string, // from messages[0].from — already E.164
  customerName?: string, // from contacts[0].profile.name — optional
) {
  return withTenant(tenantId, async (tx) => {
    // Upsert: find existing customer or create new one
    // Unique constraint: (tenant_id, phone_e164) — enforced at DB level
    const [customer] = await tx
      .insert(schema.customers)
      .values({
        tenantId,
        phoneE164: `+${customerPhone}`, // wa_id comes without +, add it
        name: customerName ?? null, // use WA profile name if available
        waOptIn: true, // they messaged us = opted in
      })
      .onConflictDoUpdate({
        target: [schema.customers.tenantId, schema.customers.phoneE164],
        set: {
          // Only update name if we have one and current name is null
          name: sql`CASE WHEN customers.name IS NULL
                    THEN EXCLUDED.name
                    ELSE customers.name END`,
          updatedAt: new Date(),
        },
      })
      .returning();

    return customer;
  });
}
```

**Key points:**

- `(tenantId, phoneE164)` is a unique constraint — the upsert is safe to call on every message
- We **never overwrite** a name the salon has manually set — only fill it in if it's null
- `waOptIn: true` is set because messaging the salon is implicit consent per WhatsApp policy
- The customer row is created the moment they send their first message — before any booking exists

### 5.4 Full Message Handling Pipeline

```
Meta sends webhook to POST /webhooks/whatsapp
         │
         ▼
Verify X-Hub-Signature-256
ACK with 200 immediately (< 500ms)
Push raw payload to BullMQ whatsapp-inbound queue
         │
         ▼ (async, in worker)
Extract phone_number_id
Redis lookup → tenantId
         │
         ▼
Extract customer phone from messages[0].from
Extract customer name from contacts[0].profile.name
identifyOrCreateCustomer(tenantId, phone, name)
         │
         ▼
Determine message type:
  ├── text (first message or free text) → send Flow trigger or greeting
  ├── nfm_reply (Flow completion) → create booking from flow payload
  ├── interactive (button/list reply) → handle menu selection
  └── unknown → ignore or send fallback
         │
         ▼
All subsequent actions are tied to:
  customer.id   (who is booking)
  tenantId      (which salon)
```

### 5.5 What Happens on Flow Completion

When a customer completes the booking Flow inside WhatsApp, the webhook receives a message of type `interactive` with `interactive.type = "nfm_reply"`. The body contains everything they selected:

```json
{
  "type": "interactive",
  "interactive": {
    "type": "nfm_reply",
    "nfm_reply": {
      "response_json": "{\"serviceId\":\"uuid\",\"staffId\":\"uuid\",\"date\":\"2026-05-20\",\"timeSlot\":\"10:30\",\"customerName\":\"Sadia Malik\"}",
      "name": "flow"
    }
  }
}
```

Handler:

```typescript
async function handleFlowCompletion(
  tenantId: string,
  customer: Customer,
  flowPayload: FlowBookingPayload,
) {
  // Parse the response_json
  const { serviceId, staffId, date, timeSlot, customerName } = flowPayload;

  // Update customer name if they provided one in the flow
  if (customerName && !customer.name) {
    await updateCustomerName(tenantId, customer.id, customerName);
  }

  // Calculate start and end times
  const service = await getService(tenantId, serviceId);
  const startTime = parseDateTime(date, timeSlot, "Asia/Karachi");
  const endTime = addMinutes(startTime, service.durationMin);

  // Create booking (three-layer integrity)
  const booking = await createBooking({
    tenantId,
    staffId,
    serviceId,
    customerId: customer.id,
    startTime,
    endTime,
    pricePaisa: service.pricePaisa,
    source: "whatsapp",
  });

  // Create Safepay checkout session
  const checkoutUrl = await createCheckoutSession(
    booking.id,
    service.pricePaisa,
  );

  // Send payment CTA button back on WhatsApp
  await sendCTAButton(tenantId, customer.phoneE164, {
    body: `Your ${service.name} with ${staffName} on ${formattedDate} at ${formattedTime} is ready to confirm. Pay your deposit to lock the slot.`,
    buttonLabel: `Pay PKR ${service.pricePaisa / 100}`,
    url: checkoutUrl,
  });

  // Create booking_request record for the Requests queue
  await createBookingRequest({
    tenantId,
    customerId: customer.id,
    serviceId,
    staffId,
    requestedAt: startTime,
    requestedPricePaisa: service.pricePaisa,
    paid: false,
  });
}
```

### 5.6 Customer Data — What We Store vs What We Don't

| Data                      | Do We Store?     | Where                  | Notes                             |
| ------------------------- | ---------------- | ---------------------- | --------------------------------- |
| Phone number              | ✅ Yes           | `customers.phone_e164` | Core identity — always            |
| WhatsApp display name     | ✅ Yes (if null) | `customers.name`       | Never overwrite manually-set name |
| WhatsApp profile photo    | ❌ No            | —                      | Not available via Cloud API       |
| Message content (history) | ❌ No (MVP)      | —                      | Not needed for booking flow       |
| CNIC / ID                 | ❌ Never         | —                      | Not required, privacy risk        |
| Location                  | ❌ No            | —                      | Not needed                        |
| Device info               | ❌ Never         | —                      | Not available and not needed      |

### 5.7 Opt-Out Handling

If a customer sends "STOP" or blocks the salon:

```typescript
// WhatsApp sends a 'contacts' update or the message will fail to send
// On send failure with error code 131026 (receiver opted out):

async function handleOptOut(tenantId: string, customerPhone: string) {
  await withTenant(tenantId, async (tx) => {
    await tx
      .update(schema.customers)
      .set({ waOptIn: false })
      .where(
        and(
          eq(schema.customers.tenantId, tenantId),
          eq(schema.customers.phoneE164, customerPhone),
        ),
      );
  });
  // Do not send any more messages to this number for this tenant
}
```

---

## 6. API Contracts

### 6.1 Auth Endpoints

```
POST /api/v1/auth/send-otp
  Body:    { phone: "03001234567" }
  Returns: { ok: true, expiresIn: 300 }
  Errors:  429 (rate limited), 400 (invalid format), 409 (phone already registered -> use /login)

POST /api/v1/auth/verify-otp
  Body:    { phone: "03001234567", otp: "123456" }
  Returns: { ok: true, phoneVerified: true }
  Errors:  401 (invalid/expired), 401 (too many attempts)
  Note:    Does NOT issue JWT — that happens after password is set in complete-signup

POST /api/v1/auth/complete-signup
  Body:    { phone: "03001234567", password: "min8chars", ownerName?: string }
  Returns: { ok: true, isNewUser: true, user: { id, name, role } }
  Effect:  Creates tenant + location + user, sets httpOnly cookies (baari_token, baari_refresh)
  Errors:  400 (password too short), 400 (phone not verified in this session)

POST /api/v1/auth/login
  Body:    { phone: "03001234567", password: "..." }
  Returns: { ok: true, user: { id, name, role, tenantId } }
  Effect:  Sets httpOnly cookies
  Errors:  401 (wrong password), 401 (account not found), 429 (locked after 5 fails)

POST /api/v1/auth/send-email-otp
  Body:    { email: "owner@salon.pk" }
  Returns: { ok: true, message: "Check your email" }   -- always 200, never leaks existence
  Errors:  429 (rate limited)

POST /api/v1/auth/verify-email-otp
  Body:    { email: "owner@salon.pk", otp: "123456" }
  Returns: { ok: true, user: { id, name, role } }
  Effect:  Sets httpOnly cookies
  Errors:  401 (invalid/expired), 401 (too many attempts)

POST /api/v1/auth/forgot-password
  Body:    { phone: "03001234567" }
  Returns: { ok: true, method: "email"|"sms", hint: "s***@gmail.com" }
  Note:    Sends OTP to email if available, SMS only as last resort

POST /api/v1/auth/reset-password
  Body:    { resetToken: "uuid", newPassword: "..." }
  Returns: { ok: true }
  Effect:  Updates password, invalidates all refresh tokens, sets fresh cookies

POST /api/v1/auth/refresh
  Cookies: baari_refresh
  Returns: { ok: true }
  Effect:  Rotates both cookies
  Errors:  401 -> client redirects to /login

POST /api/v1/auth/logout
  Effect:  Clears both cookies, deletes refresh token from Redis + DB
  Returns: { ok: true }
```

### 6.2 Onboarding Endpoints

```
GET /api/v1/onboarding/status
  Auth:    Required
  Returns: { step: 0-4, complete: bool }

PATCH /api/v1/onboarding/salon
  Auth:    Required (owner only)
  Body:    { salonName, city, ownerName, slug? }
  Returns: { ok: true, tenant: { name, slug, city } }
  Effect:  Advances onboarding_step to 2

POST /api/v1/onboarding/services
  Auth:    Required (owner only)
  Body:    { services: [{ name, category, durationMin, pricePaisa, bufferMin }] }
  Returns: { ok: true, services: [...] }
  Effect:  Creates all services, advances onboarding_step to 3

POST /api/v1/onboarding/hours
  Auth:    Required (owner only)
  Body:    { hours: [{ day: 0-6, isOpen: bool, openTime: "09:00", closeTime: "20:00" }] }
  Returns: { ok: true }
  Effect:  Saves hours, sets onboarding_complete = true, onboarding_step = 4
```

### 6.3 Team Management Endpoints

```
GET /api/v1/team
  Auth:    Required (owner only)
  Returns: List of users in this tenant with role + linked staff profile

POST /api/v1/team/invite
  Auth:    Required (owner only)
  Body:    { phone: "03001234567", role: "manager"|"staff", staffId?: uuid }
  Returns: { ok: true, inviteToken: string }
  Effect:  Creates invite record, sends WhatsApp to phone

GET /api/v1/team/invite/:token
  Auth:    None required
  Returns: { salonName, role, inviterName, expiresAt }
  Errors:  404 (invalid token), 410 (expired)

POST /api/v1/team/invite/:token/accept
  Body:    { otp: "123456" } (OTP was sent to phone on invite)
  Returns: { ok: true, user: {...} }
  Effect:  Creates user, sets cookies (same as normal login)

DELETE /api/v1/team/:userId
  Auth:    Required (owner only)
  Effect:  Soft-deletes user (cannot delete own owner account)
```

### 6.4 Current User

```
GET /api/v1/me
  Auth:    Required
  Returns: {
    user: { id, name, phone, role },
    tenant: { id, name, slug, plan, city, onboardingComplete, onboardingStep },
    location: { id, name }
  }
```

---

## 7. Database Schema — Auth & Identity

### 7.1 Changes to Existing Tables

```sql
-- Add to tenants table (migration 0002)
ALTER TABLE tenants
  ADD COLUMN onboarding_step     INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN onboarding_complete BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN city                TEXT,
  ADD COLUMN owner_name          TEXT;

-- Add to users table
ALTER TABLE users
  ADD COLUMN phone_e164         TEXT,
  ADD COLUMN email              CITEXT,
  ADD COLUMN password_hash      TEXT,          -- bcrypt, rounds=12. NULL until complete-signup
  ADD COLUMN phone_verified     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN failed_login_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN locked_until       TIMESTAMPTZ,   -- set for 15min after 5 failed attempts
  ADD COLUMN last_login_at      TIMESTAMPTZ;

CREATE UNIQUE INDEX users_phone_uniq ON users(phone_e164)
  WHERE phone_e164 IS NOT NULL;

CREATE UNIQUE INDEX users_email_uniq ON users(email)
  WHERE email IS NOT NULL;
```

### 7.2 New Tables

```sql
-- OTP tracking (optional — Redis is primary, this is audit trail)
CREATE TABLE otp_log (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone      TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verified_at TIMESTAMPTZ,
  ip_address TEXT
);

-- Team invites
CREATE TABLE team_invites (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  phone_e164  TEXT NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('manager', 'staff')),
  staff_id    UUID REFERENCES staff(id),
  token       TEXT NOT NULL UNIQUE,     -- UUID sent in invite link
  invited_by  UUID NOT NULL REFERENCES users(id),
  expires_at  TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,              -- null until accepted
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX team_invites_token_idx ON team_invites(token);
CREATE INDEX team_invites_tenant_idx ON team_invites(tenant_id);

-- Refresh tokens
CREATE TABLE refresh_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT NOT NULL UNIQUE,      -- random UUID stored in Redis too
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Salon working hours
CREATE TABLE working_hours (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id),
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday
  is_open    BOOLEAN NOT NULL DEFAULT true,
  open_time  TIME NOT NULL DEFAULT '09:00',
  close_time TIME NOT NULL DEFAULT '20:00',
  UNIQUE (tenant_id, location_id, day_of_week)
);

-- RLS on all new tables
ALTER TABLE team_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_invites FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON team_invites FOR ALL TO app_user
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE working_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE working_hours FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON working_hours FOR ALL TO app_user
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
```

---

## 8. Implementation Checklist

### Phase 1A — Auth API

- [ ] `POST /api/v1/auth/send-otp` — phone normalisation, Redis OTP storage, SMS send (one-time only)
- [ ] `POST /api/v1/auth/verify-otp` — OTP validation, mark phone as verified in Redis session
- [ ] `POST /api/v1/auth/complete-signup` — password hash (bcrypt 12), user+tenant+location creation, JWT issue
- [ ] `POST /api/v1/auth/login` — phone + password, failed login counter, 15-min lockout after 5 fails
- [ ] `POST /api/v1/auth/send-email-otp` — email OTP for forgot-password and email login
- [ ] `POST /api/v1/auth/verify-email-otp` — validate email OTP, issue JWT
- [ ] `POST /api/v1/auth/forgot-password` — email OTP preferred, SMS fallback
- [ ] `POST /api/v1/auth/reset-password` — update hash, invalidate all refresh tokens
- [ ] `POST /api/v1/auth/refresh` — refresh token rotation
- [ ] `POST /api/v1/auth/logout` — cookie clear + Redis delete
- [ ] `GET /api/v1/me` — current user + tenant info
- [ ] `authenticate` Fastify hook — JWT validation, attaches `request.user`
- [ ] Rate limiting on all `/auth/*` routes
- [ ] SMS gateway configured (Vonage/local for dev, .env for production)
- [ ] Email sending configured (Resend.com — generous free tier, simple API)

### Phase 1B — Auth Web

- [ ] `/login` page — phone input, "Send OTP" button, loading state
- [ ] `/login/verify` page — 6-digit OTP input, auto-submit, resend countdown
- [ ] Error states on both pages (expired, invalid, rate limited)
- [ ] `baari_token` cookie set on success
- [ ] `/dashboard/layout.tsx` — checks cookie, redirects to `/login` if missing
- [ ] Logout button in sidebar/profile area

### Phase 1C — Onboarding Flow

- [ ] `/onboarding/salon` — salon name, city, owner name, slug preview
- [ ] `/onboarding/services` — template grid, add/edit/remove service cards, continue on ≥1 service
- [ ] `/onboarding/hours` — 7-day working hours, toggle closed days, "same as Monday" shortcut
- [ ] `/onboarding/done` — summary, "Go to dashboard" + "Connect WhatsApp" CTAs
- [ ] Onboarding middleware: redirect incomplete owners to correct step
- [ ] `PATCH /api/v1/onboarding/salon` — saves step 1 data
- [ ] `POST /api/v1/onboarding/services` — batch creates services
- [ ] `POST /api/v1/onboarding/hours` — saves working hours, marks onboarding complete
- [ ] Mobile-first: all onboarding screens work at 375px width

### Phase 1D — Team Invites (can be built in Phase 8 alongside Settings)

- [ ] `POST /api/v1/team/invite` — creates invite, sends WhatsApp
- [ ] `/invite/[token]` page — shows salon name + role, "Accept" button triggers OTP
- [ ] `POST /api/v1/team/invite/:token/accept` — creates staff user, sets cookies
- [ ] Team list in Settings → Team tab
- [ ] Role enforcement in all API middleware

### Phase 1E — WhatsApp Customer Identity (built in Phase 9)

- [ ] Webhook payload parser — extract `phone_number_id`, `customer_phone`, `customer_name`
- [ ] `identifyOrCreateCustomer()` — upsert with conflict resolution on `(tenant_id, phone_e164)`
- [ ] Opt-out handler — set `wa_opt_in = false` on send failure or STOP message
- [ ] Tenant routing cache — Redis `wa:phone:{phoneNumberId}` → `tenantId`

---

## Key Decisions Summary

| Decision                      | Choice                                   | Reason                                                              |
| ----------------------------- | ---------------------------------------- | ------------------------------------------------------------------- |
| Auth method — signup          | Phone + OTP (SMS) once                   | Verify the number is real. One-time cost.                           |
| Auth method — login           | Phone + Password                         | Zero SMS cost. Familiar pattern (same as JazzCash, bank apps).      |
| Auth method — forgot password | Email OTP preferred, SMS fallback        | Email is free. SMS only when no email on account.                   |
| Password hashing              | bcrypt, rounds=12                        | Industry standard. Slow enough to resist brute force.               |
| Token storage                 | httpOnly cookie                          | XSS-safe. Works with Next.js server components.                     |
| Refresh token                 | Redis + DB (dual)                        | Redis for fast lookup, DB for audit trail and recovery.             |
| Client auth                   | None                                     | WhatsApp customers are identified by phone — they never log in.     |
| Staff invite                  | WhatsApp message                         | Staff don't have work email. WhatsApp link is instant and familiar. |
| Onboarding                    | 3-step wizard after signup               | Fast to complete. Every step is immediately useful.                 |
| Slug                          | Auto-generated from salon name, editable | Reduces friction at signup.                                         |
| Email service                 | Resend.com                               | Simple API, generous free tier (3,000 emails/month free).           |

---

_Baari · باری — Auth & Identity Spec · v1.0 · May 2026_
