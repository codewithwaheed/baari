# Multi-service Booking + Mobile-Friendly Requests View

**Date:** 2026-05-25  
**Scope:** Public booking flow supports selecting multiple services per booking; dashboard Requests tab redesigned as Option-A cards with service chips; fully mobile-responsive.

---

## Goals

1. Customer on `/book/[slug]` can select multiple services in one booking.
2. Total duration (for slot availability) and total price are derived from all selected services.
3. Dashboard `/dashboard?tab=requests` displays requests in a stacked card layout (Option A) with service chips (Option X), readable and actionable at any viewport width.

---

## Out of Scope

- Multiple staff per booking (all services go to one barber).
- Payment integration (requests remain pay-later).
- WhatsApp booking path (unchanged).

---

## 1. Schema Migration

Add one column to `booking_requests`:

```sql
ALTER TABLE booking_requests
  ADD COLUMN service_ids text[] NOT NULL DEFAULT '{}';
```

**Drizzle schema change** (`packages/db/src/schema.ts`):

```ts
serviceId:  uuid('service_id').notNull().references(() => services.id),  // unchanged — primary service, backward compat
serviceIds: text('service_ids').array().notNull().default(sql`'{}'::text[]`),
```

`serviceId` remains the FK anchor and primary service (first in list). `serviceIds` stores all selected IDs including the primary. Existing rows keep `service_ids = '{}'`; the approve endpoint falls back to `[serviceId]` for such rows.

A Drizzle migration file is generated with `pnpm --filter @baari/db db:generate`.

---

## 2. API: `POST /public/salon/:slug/book`

**Request body change** — replace `serviceId: string` with `serviceIds: string[]` (min length 1).

**Server behaviour:**
1. Validate `serviceIds` is a non-empty array of UUIDs.
2. Fetch all services in one query — verify each ID belongs to the tenant (RLS enforces this).
3. Compute `totalDurationMin = sum(durationMin)` and `totalPricePaisa = sum(pricePaisa)`.
4. Insert `booking_request` with `serviceId = serviceIds[0]` (primary) and `serviceIds = full array`.
5. `requestedPricePaisa = totalPricePaisa`.

**No change to `GET /public/salon/:slug/availability`** — it already accepts `serviceDurationMin` as an integer; the client just passes the sum.

---

## 3. API: `GET /api/v1/requests`

After fetching pending requests, perform a second query:

```sql
SELECT id, name, duration_min, price_paisa
FROM services
WHERE id = ANY(
  SELECT UNNEST(service_ids) FROM booking_requests WHERE tenant_id = $tid AND state = 'pending'
)
```

Build a lookup map `serviceId → {name, durationMin, pricePaisa}`, then attach `services: ServiceSummary[]` to each request row, ordered by their position in `serviceIds`. Fall back to the single joined `serviceName` for rows with empty `serviceIds`.

Response shape per item:

```ts
{
  id, customerId, customerName, customerPhone,
  staffId, staffName,
  requestedAt, requestedPricePaisa, paid, state, createdAt,
  services: Array<{ id: string; name: string; durationMin: number; pricePaisa: number }>,
}
```

The existing `serviceId` / `serviceName` fields are dropped from the response (consumers use `services[0]` instead).

---

## 4. API: `POST /api/v1/requests/:id/approve`

Fetch `serviceIds` from the request row. Pass to `createBooking`:

```ts
serviceIds: req.serviceIds.length > 0 ? req.serviceIds : [req.serviceId]
```

`createBooking` already handles arrays — no changes to `lib/bookings/create.ts`.

The approve endpoint no longer needs to join `services` just for `durationMin` (that's computed inside `createBooking`).

---

## 5. BookingFlow — Step 1: Multi-select Services

**Current:** single-select grid (one card highlighted at a time).  
**New:** multi-select grid — each card has a checkmark badge when selected; tapping toggles.

UI additions:
- `selectedServices: PublicService[]` replaces `selectedService: PublicService | null`.
- A sticky bottom bar inside step 1 shows the running total: **"3 services · PKR 1,600 · 75 min"** and a "Continue →" button (enabled when ≥ 1 selected).
- Steps 2–4 use `selectedServices` in place of `selectedService`; total duration is passed to the availability endpoint.
- Step 4 confirmation summary shows service chips matching the dashboard RequestsView style.
- Submit payload: `serviceIds: selectedServices.map(s => s.id)`.

---

## 6. RequestsView — Mobile-Friendly Option A Card

Replace the 5-column `grid` layout with a stacked card per request.

**Card anatomy (Option A):**

```
┌─────────────────────────────────────────────────┐
│ [AK]  Ahmed Khan          0300-1234567           │  ← avatar + name + phone
├────────────────────┬────────────────────────────┤
│ Services           │ When                        │
│ [Haircut] [Beard]  │ Today                       │
│ [Eyebrow]          │ 3:30 PM                     │
│ with Bilal · 75min │                             │
├────────────────────┼────────────────────────────┤
│ Total              │ Payment                     │
│ PKR 1,600          │ [Pending]                   │
├────────────────────┴────────────────────────────┤
│   [ Decline ]          [ ✓ Approve ]            │  ← full-width button pair
├─────────────────────────────────────────────────┤
│ ⚠ Slot no longer available (inline error)       │  ← conditional
└─────────────────────────────────────────────────┘
```

**Service chips (Option X):** each service name rendered as a small pill (`background: --baari-bone; border: --baari-sand; border-radius: 5px`). Chips wrap onto multiple lines for longer lists.

**Responsive rules:**
- Cards fill 100% width on mobile with 16px horizontal padding on the container.
- Max-width 680px centered on desktop — no wasted whitespace, but not absurdly wide.
- Page header reduces font size below 480px (`fontSize: 28px` → `fontSize: 22px`).
- Empty-state padding reduces from 64px to 40px on mobile.

**Container padding:** `padding: '24px 16px 64px'` (was `32px 32px 64px`).

---

## 7. `data.ts` (dashboard) — `BookingRequest` type

```ts
// Replace:
service: string;
// With:
services: Array<{ id: string; name: string; durationMin: number; pricePaisa: number }>;
```

`staff`, `day`, `time`, `amount`, `paid` fields unchanged.

---

## 8. `dashboard/page.tsx` — Mapping + API response

`toLocalRequest` maps `r.services` directly. For the "service" label shown elsewhere (e.g. calendar view), use `services[0]?.name ?? 'Unknown'`.

---

## 9. Success Page (`/book/[slug]/success`)

Replace single `service` query param with `services` (JSON-encoded array of names). Display as a chip row in the booking summary card, matching the RequestsView chip style.

---

## Data Flow Summary

```
Customer selects services → BookingFlow (multi-select, sum duration/price)
  → POST /public/.../book  { serviceIds: [...] }
  → booking_requests row   { serviceId: ids[0], serviceIds: [...], requestedPricePaisa: sum }

Owner views dashboard
  → GET /requests          → { services: [{name, ...}] }
  → RequestsView card      → service chips + total price

Owner approves
  → POST /requests/:id/approve
  → createBooking({ serviceIds: [...] })   ← already multi-service capable
  → booking + booking_services rows created
```

---

## Exit Criteria

- [ ] Customer can select 1–N services; "Continue" is disabled until ≥ 1 selected.
- [ ] Slot availability uses summed duration.
- [ ] `booking_requests.service_ids` is populated on new bookings.
- [ ] Dashboard requests card renders correctly at 375px (iPhone SE) and 1280px.
- [ ] Service chips display for both single and multi-service requests.
- [ ] Approve creates a booking with all service IDs in `booking_services`.
- [ ] Old single-service requests (empty `service_ids`) still approve cleanly.
