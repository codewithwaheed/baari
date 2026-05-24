# Phase 11 — Public Booking URL · Design Spec

**Date:** 2026-05-24
**Status:** Approved
**Scope:** Public salon page + 5-step booking wizard → booking_requests table → Requests dashboard tab

---

## Goal

Each salon has a public page at `book.baari.pk/[slug]` (or `localhost:3000/book/[slug]` locally). A customer can browse the salon's services, pick a barber, choose a date and time slot, enter their name and phone, and submit a booking request. The request lands in the salon owner's Requests tab in the dashboard, where they approve or decline it. No payments. No WhatsApp integration.

---

## Out of Scope (explicitly excluded from this phase)

- Payment links or deposit collection
- WhatsApp confirmation messages
- QR code generation
- "Any barber" / unassigned staff requests
- Multi-service bookings (single service per request)

---

## Booking Flow — 4-step wizard

Layout: stepped wizard, one screen at a time. Progress bar at the top shows 4 steps: **Service | Staff | Date & Time | Details**. Each step has a "Back" button (except step 1) and a "Next" button. The salon header (name, city, logo) is pinned above the progress bar throughout.

### Step 1 — Service

- Card grid of active services: name, duration in minutes, price in PKR.
- Services grouped by category if more than 6 services exist.
- One service selected at a time. Tapping selects it (highlighted with lime border).
- "Next" is disabled until a service is selected.

### Step 2 — Staff

- Card list of active staff: avatar initial (or photo if available), name, role.
- First staff member is pre-selected by default when the step loads.
- Customer can tap any other staff card to switch selection.
- "Next" is enabled immediately (first is pre-selected).

### Step 3 — Date & Time (combined screen)

- Month calendar at the top. Previous month disabled. Days in the past are non-tappable.
- Tapping a date fetches available slots from the public availability endpoint.
- Slots appear below the calendar as a grid of pill buttons (e.g. "9:00am", "9:30am").
- Loading skeleton shown while slots are fetching.
- If no slots are available for the selected date: "No times available — try another day."
- "Next" is disabled until both a date and a time slot are selected.

### Step 4 — Your Details

- Two fields: Name (text) and Phone (tel, Pakistani format hint "03XX XXXXXXX").
- Booking summary card below the fields: service, barber, date, time, PKR price.
- "Send Request" button submits. Shows a spinner while the API call is in flight.
- On error: inline message "Something went wrong — tap to retry." No modal.
- "Back" navigates to step 3.

### Success Page

- Separate route: `/book/[slug]/success`
- Accessible after a successful `POST /public/salon/:slug/book`.
- Shows: large lime checkmark, "Request sent!", salon name, booking summary (service, barber, date, time, PKR), and the customer's phone number with note "The salon will call you on [phone] to confirm."
- No back-link to the booking form (prevents accidental re-submission).
- Link: "← Back to [Salon Name]" returns to the public salon page.

---

## API — Public Endpoints (no authentication)

All public endpoints are registered under `apps/api/src/routes/public.ts` with prefix `/api/v1`.

### `GET /public/salon/:slug`
Already implemented. Returns name, slug, city, address, logoUrl, instagramHandle, contactPhone.

### `GET /public/salon/:slug/services`
Returns active services for the tenant identified by slug.

Response shape:
```json
{
  "ok": true,
  "data": [
    { "id": "uuid", "name": "Haircut", "category": "hair", "durationMin": 30, "pricePaisa": 80000 }
  ]
}
```
Filtered: `isActive = true` only. Ordered by category, then name.

### `GET /public/salon/:slug/staff`
Returns active staff for the tenant.

Response shape:
```json
{
  "ok": true,
  "data": [
    { "id": "uuid", "name": "Usman", "role": "barber", "avatarUrl": null }
  ]
}
```
Filtered: `isActive = true` only. Ordered by name.

### `GET /public/salon/:slug/availability`
Query params: `staffId` (UUID, required), `date` (YYYY-MM-DD, required), `serviceDurationMin` (integer, required).

Replicates the logic of `GET /api/v1/bookings/availability` but resolves `tenantId` from slug instead of JWT. Uses the same working hours + existing bookings + breaks logic.

Response shape: identical to the authenticated endpoint — array of `{ startHour, endHour, label }`.

Returns 404 if slug not found. Returns empty array if salon is closed that day.

### `POST /public/salon/:slug/book`
Creates a booking request. No authentication required.

Request body:
```json
{
  "serviceId": "uuid",
  "staffId": "uuid",
  "requestedAt": "2026-05-15T09:00:00+05:00",
  "customerName": "Ali Hassan",
  "customerPhone": "+923001234567"
}
```

Logic:
1. Resolve tenant from slug — 404 if not found.
2. Validate serviceId belongs to tenant and is active.
3. Validate staffId belongs to tenant and is active.
4. Find or create customer by `(tenantId, phoneE164)`. If creating, set `name` from body.
5. Compute `requestedPricePaisa` from the service's `pricePaisa`.
6. Insert into `booking_requests`: `{ tenantId, customerId, serviceId, staffId, requestedAt, requestedPricePaisa, paid: false, state: 'pending' }`.
7. Return `{ ok: true, data: { id, requestedAt } }` with status 201.

Errors:
- `404` — slug not found
- `400` — validation failure (missing fields, invalid phone format)
- `404` — serviceId not found or inactive
- `404` — staffId not found or inactive

Phone normalisation: strip spaces and dashes. If starts with `03`, convert to `+923...`. Store as E.164 in `customers.phoneE164`.

---

## API — Requests Endpoints (JWT required)

New file: `apps/api/src/routes/requests.ts`. Registered in `index.ts` at `/api/v1/requests`. All routes require `authenticate` hook.

### `GET /requests`
Returns all `booking_requests` with `state = 'pending'` for the tenant, joined with customer + service + staff names. Ordered by `createdAt` descending (most recent first).

Response shape:
```json
{
  "ok": true,
  "data": [
    {
      "id": "uuid",
      "customerName": "Ali Hassan",
      "customerPhone": "+923001234567",
      "serviceName": "Haircut",
      "staffName": "Usman",
      "requestedAt": "2026-05-15T09:00:00+05:00",
      "requestedPricePaisa": 80000,
      "paid": false,
      "state": "pending",
      "createdAt": "2026-05-14T18:30:00+05:00"
    }
  ]
}
```

### `POST /requests/:id/approve`
Approves a pending request by:
1. Fetching the `booking_request` — 404 if not found or wrong tenant.
2. Checking `state === 'pending'` — 422 if already approved/declined.
3. Fetching the service to get `durationMin` for computing `endTime`.
4. Calling `createBooking()` with `{ tenantId, staffId, serviceIds: [serviceId], customerId, startTime: requestedAt, source: 'web' }`.
5. Updating `booking_requests.state = 'approved'`.
6. Returning `{ ok: true, data: { bookingId } }`.

If slot is unavailable (409 from `createBooking`): return 409 with `{ error: { code: 'SLOT_UNAVAILABLE', message: '...' } }` — the owner sees an inline error and the request stays pending so they can pick a different time or contact the customer.

### `POST /requests/:id/decline`
1. Fetches the request — 404 if not found or wrong tenant.
2. Checks `state === 'pending'` — 422 if not pending.
3. Updates `state = 'declined'`.
4. Returns `{ ok: true }`.

### `GET /requests/count`
Returns `{ ok: true, data: { count: N } }` — count of pending requests for the tenant. Lightweight — used for the badge.

---

## Dashboard — RequestsView wiring

The `RequestsView` component already exists. It needs to be wired to real data:

- On mount, fetch `GET /api/v1/requests` and replace mock data.
- On approve: call `POST /api/v1/requests/:id/approve`, remove card optimistically, show toast "Booking added to calendar". On 409 SLOT_UNAVAILABLE: show inline error on the card — "That slot is no longer available."
- On decline: call `POST /api/v1/requests/:id/decline`, remove card optimistically.
- The heading "WhatsApp requests" should be renamed to "Booking requests" since requests now also come from the web.
- Badge count: fetch `GET /api/v1/requests/count` on dashboard load and after every approve/decline. Poll every 60 seconds.

---

## Design System

All existing tokens from `baari.css` apply. No new colours. Key patterns:

- Selected state: `2px solid var(--baari-lime)` border + `var(--baari-bone)` background.
- Disabled Next button: `background: var(--baari-sand)`, `color: var(--baari-stone)`, `cursor: not-allowed`.
- Loading slots: skeleton pills (grey animated placeholders).
- Error state: `color: var(--baari-onyx)`, small inline text below the field/button.

The booking page uses the same CSS variables as the dashboard but has its own layout (no sidebar, no nav — pure public page).

---

## SEO / Metadata

`generateMetadata()` already exists in `page.tsx` and returns correct Open Graph tags from the salon data. No changes needed to metadata.

JSON-LD `HairSalon` schema already exists. No changes needed.

---

## File Map

| File | Action |
|---|---|
| `apps/api/src/routes/public.ts` | Add 4 new endpoints (services, staff, availability, book) |
| `apps/api/src/routes/requests.ts` | Create — 4 endpoints (list, approve, decline, count) |
| `apps/api/src/index.ts` | Uncomment requests route registration |
| `apps/web/src/app/book/[slug]/page.tsx` | Replace stub with salon header + `<BookingFlow>` |
| `apps/web/src/app/book/[slug]/BookingFlow.tsx` | Create — 5-step client component |
| `apps/web/src/app/book/[slug]/success/page.tsx` | Create — confirmation page |
| `apps/web/src/components/dashboard/RequestsView.tsx` | Wire to real API, rename heading |

---

## Exit Criteria

- `localhost:3000/book/ruma-lahore` loads with correct salon name and active services
- Completing all 5 steps submits a request visible in the dashboard Requests tab
- Switching barbers in step 2 changes the available slots shown in step 3+4
- Approving a request creates a booking visible on the calendar
- Declining a request removes it from the queue
- Badge count on the Requests tab reflects pending count and decrements on approve/decline
- Open Graph tags correct (title = "Book at [Salon Name] · [City]")
