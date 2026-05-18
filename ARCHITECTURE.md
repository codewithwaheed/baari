# Baari — Architecture

> باری · "Your turn." — WhatsApp-native B2B appointment SaaS for Pakistan.

---

## Stack

| Layer        | Choice                                  | Reason                                                    |
|--------------|-----------------------------------------|-----------------------------------------------------------|
| Frontend     | Next.js 15, App Router, TypeScript      | SSR booking pages, dashboard, shared TS types with API    |
| Backend API  | Fastify, Node 20, TypeScript            | I/O-bound workload, schema-first validation, Pino logging |
| Database     | PostgreSQL (self-hosted on Droplet)     | RLS for tenant isolation, EXCLUDE GIST for overlap lock   |
| ORM          | Drizzle ORM                             | First-class RLS, zero codegen, 7KB bundle                 |
| Queue        | BullMQ on Redis/Valkey                  | Reminders, payment expiry, WhatsApp automation            |
| Cache / Lock | Redis/Valkey (single node MVP)          | Distributed slot locking, tenant routing cache            |
| Payments     | Safepay (aggregator) → JazzCash + EasyPaisa + Raast + Card | Single integration, licensed PSP, no SBP license needed |
| WhatsApp     | Meta Cloud API via 360dialog            | Multi-tenant WABA, Flows, per-tenant token storage        |
| Infra MVP    | DigitalOcean Droplet s-2vcpu-4gb        | ~$49/mo, Docker Compose, Caddy reverse proxy              |
| CDN / DNS    | Cloudflare Free                         | DDoS, SSL, CDN, no cost                                   |

---

## Multi-tenancy

**Pool model**: shared tables, `tenant_id` on every row, Postgres RLS as defense-in-depth.

```sql
-- Every table has this policy (see packages/db/src/schema.ts)
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON bookings FOR ALL TO app_user
  USING      (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
```

Always set tenant context inside a transaction (PgBouncer-safe):
```typescript
await withTenant(tenantId, async (tx) => {
  // all queries here are auto-scoped to this tenant
});
```

**JWT claims:**
```json
{ "sub": "user_uuid", "tid": "tenant_uuid", "role": "owner|manager|staff",
  "loc": ["location_uuid"], "iat": 1234567890, "exp": 1234567890 }
```
`tid` is the ONLY authoritative tenant identifier. Reject any `tenantId` from request body or URL params.

---

## Booking state machine

```
INITIATED
    │  (slot locked in Redis, row inserted)
    ▼
PAYMENT_PENDING
    │  (payment link sent, 10-min TTL)
    ├──── payment IPN success ──► CONFIRMED
    │                                 │
    │                            (reminder jobs enqueued)
    │                                 │
    │                                 ▼
    │                            COMPLETED  (staff marks done)
    │                                 │
    │                            CANCELLED  (salon cancels)
    │
    ├──── IPN failure ──────────► FAILED ──► slot released
    └──── timeout (10 min) ─────► EXPIRED ──► slot released
                                  │
                              NO_SHOW  (staff marks)
```

**Three-layer booking integrity:**
1. Redis `SET NX PX` distributed lock — fast first guard
2. PostgreSQL `SELECT FOR UPDATE` on staff row — serializes within transaction
3. `EXCLUDE USING GIST` constraint — database-level, final safety net

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE bookings ADD CONSTRAINT bookings_no_overlap
  EXCLUDE USING GIST (tenant_id WITH =, staff_id WITH =, slot WITH &&)
  WHERE (state IN ('PAYMENT_PENDING','CONFIRMED','COMPLETED'));
```

---

## Payment flow (Safepay aggregator — recommended MVP path)

```
Customer confirms booking in WhatsApp Flow
    │
    ▼
API creates booking (state=INITIATED)
Redis: SET slot_lock:{tenantId}:{staffId}:{slotIso} {bookingId} NX PX 600000
    │
    ▼
API creates Safepay checkout session
Returns hosted payment URL
    │
    ▼
WhatsApp sends CTA button: "Pay PKR 500 deposit"
Customer taps → Safepay hosted page (JazzCash / EasyPaisa / Raast / Card)
    │
    ▼
Safepay IPN webhook → POST /webhooks/payments
    │
    ├── success → state=CONFIRMED, BullMQ reminder jobs, WhatsApp confirmation template
    └── fail/timeout → state=EXPIRED, Redis lock released, slot available again

Reconciliation cron (every 60s): poll gateway for PAYMENT_PENDING > 8 min old
Webhooks miss ~1-2% in field — always poll as fallback.
```

**JazzCash direct integration (when needed at scale):**
- Endpoint: `POST /ApplicationAPI/API/Purchase/DoMWalletTransaction`
- Hash: HMAC-SHA256 of sorted `pp_*` fields prepended with IntegritySalt
- IPN is signed — verify before processing
- Always poll `InquireTransaction` as fallback

**EasyPaisa direct integration:**
- Encryption: AES-128-CBC of parameter string (not HMAC)
- IPN is UNSIGNED — always call Inquire-Status to validate
- OTC flow: returns token, customer pays at retailer (T+7 settlement)

**Raast P2M:**
- Cannot connect directly — use PayFast or Bank Alfalah Alfa Business as MSP
- Currently 0% MDR (subsidised until June 2026 — treat as temporary)
- Dynamic EMVCo QR per booking via MSP API

---

## WhatsApp multi-tenant architecture

Each salon connects their own WhatsApp Business number via Embedded Signup.

**Per-tenant storage:**
```
tenant.wa_phone_id    Meta phone_number_id
tenant.wa_waba_id     WhatsApp Business Account ID
tenant.wa_token       System User access token (encrypted at rest)
```

**Inbound message routing:**
```
POST /webhooks/whatsapp (all tenants share one URL)
    │
    ├── verify X-Hub-Signature-256 (HMAC-SHA256 with app secret)
    ├── push to BullMQ whatsapp-inbound queue (ACK < 500ms)
    └── worker: extract phone_number_id → Redis lookup → tenantId → handle
```

**WhatsApp Flows (booking inside WhatsApp):**
- Use dynamic flows with `data_exchange` for real-time slot availability
- Encryption: RSA-OAEP (SHA-256) + AES-128-GCM
- Response IV = inbound IV XOR 0xFF (inverted byte-by-byte)
- Budget 1-2 dev-weeks. Use Meta's reference Node.js implementation.
- Flow: SERVICE → STYLIST → DATE → TIME → CONFIRM
- On `action: "complete"` → create booking, send payment CTA

**In-chat payments:**
- WhatsApp Pay NOT available in Pakistan as of May 2026
- Pattern: Flow confirms → CTA button → Safepay hosted checkout → wa.me deeplink back
- Total time outside WhatsApp: ~30 seconds

**Per-message pricing (post July 2025):**
- Utility templates inside 24-hr service window: FREE
- Utility outside window: ~$0.007-0.009
- Marketing templates: ~$0.0473
- Time reminders inside the CSW whenever possible

---

## Infrastructure (DigitalOcean MVP)

```
Cloudflare (DNS + CDN + DDoS, Free)
    │
    ▼
DO Droplet s-2vcpu-4gb ($24/mo)
    ├── Caddy (reverse proxy, auto SSL)
    ├── Next.js (port 3000) — dashboard + booking pages
    ├── Fastify API (port 3001) — REST + webhooks
    ├── BullMQ workers (same process as API or separate)
    └── Redis/Valkey (local, port 6379)

DO Managed Postgres ($15/mo) — separate managed instance, 7-day PITR
DO Spaces ($5/mo) — staff photos, service images, CDN
```

**Note:** DigitalOcean discontinued Managed Redis June 2025. Use **Managed Caching for Valkey**
(Valkey 8.0, fully Redis 7.2 wire-compatible — ioredis, BullMQ, Redlock all work unchanged).

**Total MVP cost: ~$49-109/mo**. Break-even at 2-4 paying salons at PKR 2,499/mo tier.

**Migration to AWS at 500+ salons:**
- ECS Fargate Graviton + Aurora PostgreSQL Multi-AZ + ElastiCache Valkey
- Use PostgreSQL logical replication for zero-downtime migration
- DO Managed Postgres doesn't allow superuser → use `aiven-extras` for publications
- ~$530-730/mo at scale = <5% of revenue

---

## Pricing model

| Tier       | PKR/month | USD  | Target                                           |
|------------|-----------|------|--------------------------------------------------|
| Starter    | 0         | $0   | Solo barbers, ≤50 bookings/mo                    |
| Pro        | 2,499     | ~$9  | Small/mid salons 1-5 staff, unlimited bookings   |
| Business   | 6,999     | ~$25 | Mid-large 6-15 staff, inventory + multi-location |
| Enterprise | Custom    | —    | Chains, white-label, API access                  |

**Variable revenue (where unit economics live):**
- Payment rake: 1.0-1.5% on transactions processed
- WhatsApp BSP reseller margin: 20-25% over Meta rates
- No-show deposit fee: 1%

---

## API route contracts

All routes are prefixed `/api/v1/`. Auth via Bearer JWT. Tenant from JWT `tid` claim.

```
POST   /auth/login
POST   /auth/refresh

GET    /bookings?date=YYYY-MM-DD&staffId=...
POST   /bookings                    create booking (INITIATED state)
GET    /bookings/:id
PATCH  /bookings/:id/status         { state: 'checkedIn' | 'completed' | 'noShow' | 'cancelled' }
POST   /bookings/:id/checkout       initiate payment → returns Safepay URL
POST   /bookings/:id/reschedule     { newStart, newEnd, staffId }

GET    /staff
POST   /staff
PATCH  /staff/:id

GET    /services
POST   /services
PATCH  /services/:id

GET    /customers?q=search
GET    /customers/:id
PATCH  /customers/:id/notes

GET    /requests                    pending WhatsApp booking requests
POST   /requests/:id/approve
POST   /requests/:id/decline

POST   /webhooks/whatsapp           Meta webhook (verify + ingest)
POST   /webhooks/payments           Safepay / JazzCash / EasyPaisa IPN
```

---

## SBP compliance

**No license needed (MVP path):**
- Use Safepay or PayFast as licensed aggregator (Model C)
- Platform does NOT hold customer funds
- Platform operates as tech/booking layer only
- Each salon is sub-merchant under Safepay's license

**License needed (avoid until scale):**
- EMI / PSP / PSO licenses require PKR 200M minimum capital
- Triggered if you hold customer money before disbursing
- Triggered if you run your own switching infrastructure

**KYC for salon onboarding (required regardless):**
- Verify NTN with FBR
- Identify UBOs of the salon business
- Keep records per SBP Consolidated Customer Onboarding Framework 2025
