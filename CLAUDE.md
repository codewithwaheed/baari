# Baari — Claude Code Context

> باری · "Your turn." — WhatsApp-native B2B appointment SaaS for Pakistan.

**Read this file first. Then read `ARCHITECTURE.md`. Then read `PRODUCT.md` for full feature specs. For local dev setup see `DEVELOPMENT.md`. Then read `packages/db/src/schema.ts`.**

---

## What this is

Multi-tenant B2B SaaS. Salon owners onboard as tenants, configure staff/services/breaks,
and customers book via WhatsApp chat or a public web URL. Pay-first model via JazzCash,
EasyPaisa, Raast QR, or card. No app download required for customers.

**MVP targets male salons (barbershops) first.** Female beauty parlours are Phase 2.
All placeholder text, service templates, and defaults reflect a barbershop context.

---

## Monorepo layout

```
baari/
├── apps/
│   ├── web/          Next.js 15 — dashboard + public booking pages
│   └── api/          Fastify — REST API + WhatsApp webhooks + BullMQ workers
├── packages/
│   ├── db/           Drizzle schema + migrations (shared by web + api)
│   ├── types/        Shared TypeScript types (no runtime deps)
│   └── config/       Shared env validation (zod)
├── infra/
│   ├── docker-compose.yml
│   └── caddy/Caddyfile
├── CLAUDE.md         ← you are here
└── ARCHITECTURE.md   ← full system design, read second
```

---

## Working style

- **Do NOT invoke superpowers skills** (`brainstorm`, `writing-plans`, `TDD`, etc.) unless the user explicitly asks for them. Just implement directly.

---

## Hard rules — never violate these

1. **`packages/db/src/schema.ts` is the source of truth.** All data shapes flow from it.
2. **Never trust tenantId from request body or URL.** Always read from JWT `tid` claim.
3. **Money is stored as paisa (PKR × 100) in BIGINT.** Display via `fmtPKR(paisa)` helper.
4. **Times are TIMESTAMPTZ, Asia/Karachi.** Display in 12-hour via `fmtTime(h)`.
5. **All DB queries go through `withTenant(tenantId, fn)`.** Never raw queries outside it.
6. **Use `SET LOCAL` not `SET` for tenant context** — PgBouncer transaction mode safe.
7. **All payment webhook handlers are idempotent.** Dedupe on `txn_ref` + row-level lock.
8. **Never hold customer funds.** Use Model A (each salon = own merchant) or Model C (Safepay aggregator).
9. **Lime (#E8FF47) is bg-only on light surfaces.** Never as text on cream/bone — fails contrast.
10. **Schema changes need a Drizzle migration.** Never ALTER TABLE manually.

---

## Active MVP features

| Route / Feature     | Status   | Location                                      |
|---------------------|----------|-----------------------------------------------|
| Auth API            | ✅ Done   | `apps/api/src/routes/auth.ts`                 |
| Auth web pages      | ✅ Done   | `apps/web/src/app/(auth)/`                    |
| Onboarding API      | ✅ Done   | `apps/api/src/routes/onboarding.ts`           |
| Onboarding pages    | ✅ Done   | `apps/web/src/app/onboarding/`                |
| Dashboard calendar  | ✅ Build  | `apps/web/src/app/dashboard/`                 |
| Requests queue      | ✅ Build  | `apps/web/src/components/dashboard/RequestsView.tsx` |
| Clients list        | ✅ Build  | `apps/web/src/components/dashboard/ClientsView.tsx`  |
| POS checkout        | ✅ Build  | `apps/web/src/components/dashboard/POSPanel.tsx`     |
| Settings stub       | ✅ Build  | `apps/web/src/components/dashboard/ComingSoon.tsx`   |
| Public booking URL  | ✅ Build  | `apps/web/src/app/book/[slug]/`               |
| WhatsApp webhook    | ✅ Build  | `apps/api/src/routes/webhooks/whatsapp.ts`    |
| Payment webhook     | ✅ Build  | `apps/api/src/routes/webhooks/payments.ts`    |
| Booking API         | ✅ Build  | `apps/api/src/routes/bookings.ts`             |
| Reminder worker     | ✅ Build  | `apps/api/src/workers/reminder.worker.ts`     |
| Expiry worker       | ✅ Build  | `apps/api/src/workers/expiry.worker.ts`       |
| Inventory           | 🔒 Lock  | ComingSoon stub only                          |
| Marketing           | 🔒 Lock  | ComingSoon stub only                          |
| Reports             | 🔒 Lock  | ComingSoon stub only                          |
| Billie AI           | 🔒 Lock  | ComingSoon stub only                          |

---

## Key env vars (see .env.example at root)

```
DATABASE_URL            postgres://... (self-hosted on Droplet)
REDIS_URL               redis://... (local on Droplet for MVP)
JWT_SECRET              32+ char secret
META_APP_SECRET         WhatsApp webhook verification
META_VERIFY_TOKEN       WhatsApp webhook challenge
SAFEPAY_API_KEY         Payment aggregator
JAZZCASH_MERCHANT_ID    Direct JazzCash (optional, use Safepay first)
EASYPAISA_STORE_ID      Direct EasyPaisa (optional)
```

---

## How to run locally

```bash
cp .env.example .env          # fill in values
docker compose up -d          # starts postgres + redis + caddy
pnpm install
pnpm --filter @baari/db db:migrate
pnpm --filter @baari/db db:seed
pnpm dev                      # starts web (3000) + api (3001) concurrently
```

---

## Design system tokens (never hardcode these)

All in `apps/web/src/styles/baari.css`:

| Token                | Value     | Use                                  |
|----------------------|-----------|--------------------------------------|
| `--baari-lime`       | `#E8FF47` | Primary accent — buttons, highlights |
| `--baari-onyx`       | `#0D0D0D` | Dark bg, primary button fill         |
| `--baari-cream`      | `#F7F2E9` | Page background (light mode)         |
| `--baari-bone`       | `#EFE8DA` | Card surfaces on cream               |
| `--baari-sand`       | `#D9CFBC` | Borders, dividers                    |
| `--baari-espresso`   | `#322B20` | Dark text on cream                   |
| `--baari-graphite`   | `#4A443B` | Secondary text                       |
| `--baari-stone`      | `#8A8275` | Muted text, captions                 |
| `--font-display`     | Rework Headline | Headings, page titles         |
| `--font-body`        | Basis Grotesque Arabic Pro | All UI text, supports Urdu |

Booking status colors — from `primitives.tsx` STATUS_STYLES, never invent new ones:
- `confirmed` → green · `checkedIn` → teal · `pendingPayment` → amber · `completed` → gray · `noShow` → red
