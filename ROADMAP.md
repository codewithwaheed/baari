# Baari · باری — Development Flow

> Build order for the full MVP. Follow phases in sequence. Do not move to the next phase until the current one is shippable to a real salon.

---

## How to Read This Document

Each phase has a **goal** — a single sentence describing what becomes possible when that phase is done. Phases are designed so that after each one, you can put the product in front of a real salon and get genuine feedback. No phase is purely internal infrastructure that users can't see or touch.

**Status markers used throughout:**

- `[ ]` Not started
- `[~]` In progress
- `[x]` Done

---

## Phase 0 — Foundation (Week 1–2)

**Goal:** A developer can run the full stack locally with one command, connect to the database, and see a working dashboard shell in the browser.

Nothing user-facing is built yet. This phase is purely setting up the ground so every future phase can move fast.

### 0.1 Repository & Tooling

- [ ] Initialise pnpm monorepo (`apps/web`, `apps/api`, `packages/db`, `packages/types`)
- [ ] Root `package.json` with `pnpm dev` starting both web and API concurrently
- [ ] Shared `tsconfig.json` at root, extended by each package
- [ ] `.env.example` with all required variables documented and commented
- [ ] `.gitignore` — node_modules, .next, dist, .env

### 0.2 Database

- [ ] `packages/db/src/schema.ts` — full Drizzle schema (tenants, locations, staff, services, customers, bookings, payments, booking_requests, users)
- [ ] `packages/db/src/migrations/0001_init.sql` — full SQL with RLS policies on every table, EXCLUDE GIST constraint, btree_gist extension, app_user role, updated_at triggers
- [ ] `packages/db/src/client.ts` — `withTenant()` wrapper with `SET LOCAL` (PgBouncer-safe)
- [ ] Run migration locally, confirm all tables and constraints are created
- [ ] `packages/db/src/seed/index.ts` — one Pakistani salon, 4 staff, 11 services, dev owner user
- [ ] Confirm seed runs and data is queryable

### 0.3 Infrastructure

- [ ] `infra/docker-compose.yml` — Postgres + Valkey + Caddy + web + API
- [ ] `infra/caddy/Caddyfile` — reverse proxy for `app.localhost` → web, `api.localhost` → API
- [ ] Confirm `docker compose up` starts everything with no errors
- [ ] Both apps reachable in browser

### 0.4 Next.js Shell

- [ ] `apps/web/src/styles/baari.css` — full design token file (all CSS variables: colours, fonts, radii)
- [ ] `apps/web/src/app/layout.tsx` — root layout importing baari.css
- [ ] `apps/web/src/app/dashboard/page.tsx` — empty shell with "dashboard" text
- [ ] `apps/web/src/components/dashboard/primitives.tsx` — Icon, DButton, StatusBadge, Avatar, IconButton, Eyebrow, Pill, fmtPKR, fmtTime
- [ ] Confirm primitives render correctly on a test page

### 0.5 Fastify Shell

- [ ] `apps/api/src/index.ts` — Fastify server with CORS, helmet, rate limit, JWT plugin
- [ ] `GET /health` returns `{ ok: true }`
- [ ] `apps/api/src/lib/redis/client.ts` — Redis/Valkey connection, slot lock helpers (`acquireSlotLock`, `releaseSlotLock`), WA tenant routing cache
- [ ] `apps/api/src/workers/queues.ts` — BullMQ queue definitions (booking-expiry, whatsapp-reminder, whatsapp-inbound, payment-reconciliation)
- [ ] Confirm API starts and health check returns 200

### Phase 0 Exit Criteria

- `pnpm dev` starts web (port 3000) and API (port 3001) with no errors
- `pnpm db:migrate && pnpm db:seed` runs cleanly
- Dashboard shell visible at localhost:3000
- API health check returns 200 at localhost:3001/health

---

## Phase 1 — Auth (Week 2–3)

**Goal:** A salon owner can sign up with their phone number, verify via OTP, and land on the dashboard. A returning owner can log back in.

This is the gate to everything else. Build it first, build it right.

### 1.1 OTP Auth — API

- [ ] `POST /api/v1/auth/send-otp` — accepts `phone` (E.164), generates 6-digit OTP, stores in Redis with 5-min TTL, sends via SMS (use a simple SMS gateway: Vonage, Twilio, or local provider)
- [ ] `POST /api/v1/auth/verify-otp` — accepts `phone` + `otp`, validates, creates user + tenant if new, returns JWT + refresh token
- [ ] `POST /api/v1/auth/refresh` — accepts refresh token, returns new JWT
- [ ] JWT payload: `{ sub: userId, tid: tenantId, role: 'owner'|'manager'|'staff', loc: [locationId], iat, exp }`
- [ ] Auth middleware: `authenticate` hook — validates JWT, attaches `request.user`
- [ ] Rate limiting on OTP send: max 3 OTPs per phone per 10 minutes

### 1.2 Auth — Web

- [ ] `/login` page — phone input field, "Send OTP" button
- [ ] OTP entry page — 6 boxes or single input, auto-submit on 6th digit
- [ ] On success: store JWT in httpOnly cookie, redirect to `/dashboard`
- [ ] On fail: show error, allow retry
- [ ] `/dashboard/layout.tsx` — server component that checks auth cookie, redirects to `/login` if missing or expired
- [ ] Logout button (clears cookie, redirects to login)

### 1.3 Tenant Bootstrap

- [ ] On first login (new phone): create tenant + location + owner user in a single transaction
- [ ] Tenant gets a slug auto-generated from business name (can be changed in Settings later)
- [ ] `GET /api/v1/me` — returns current user + tenant basic info (name, plan, slug)

### Phase 1 Exit Criteria

- New phone → OTP → account created → redirected to dashboard
- Refresh page → still logged in (cookie persists)
- Log out → redirected to login
- Invalid OTP → error shown, not logged in
- JWT `tid` claim matches tenant in database

---

## Phase 2 — Dashboard Shell & Navigation (Week 3)

**Goal:** The owner sees a real dashboard with working navigation. No real data yet — seed data is fine. The shell is the same one used for all future features.

### 2.1 Sidebar (Desktop)

- [ ] `Sidebar.tsx` — Baari logo, nav items (Calendar, Requests, Clients, POS, Settings), user avatar row at bottom
- [ ] Active item: lime underline or highlight
- [ ] Badge on Requests item (hardcoded to 0 for now, wired up in Phase 6)
- [ ] Locked nav items (Inventory, Marketing, Reports, Billie) shown as muted with lock icon → route to `ComingSoon`
- [ ] Owner name + role shown at bottom from JWT

### 2.2 Bottom Tab Bar (Mobile)

- [ ] `BottomNav.tsx` — five tabs: Calendar, Requests, Clients, POS, Settings
- [ ] Active tab: lime dot or underline indicator
- [ ] Badge on Requests tab
- [ ] Renders instead of Sidebar on screens < 768px (CSS media query or Tailwind)
- [ ] Tab bar is always sticky at bottom of screen — never scrolls away

### 2.3 Topbar

- [ ] `Topbar.tsx` — page title (left), date navigation (calendar only), search pill, "New Booking" button
- [ ] On mobile: page title only + "+" FAB replaces the topbar New Booking button
- [ ] Date navigation: previous/next arrows, "Today" button, current date label

### 2.4 ComingSoon & SettingsStub

- [ ] `ComingSoon.tsx` — placeholder for locked features, shows feature name + "Coming soon" + lime accent
- [ ] `SettingsStub.tsx` — placeholder for Settings, shows "configure your salon" copy

### 2.5 Dashboard Layout

- [ ] `apps/web/src/app/dashboard/layout.tsx` — auth check, Sidebar (desktop), BottomNav (mobile), Topbar, content area
- [ ] Active nav state managed via URL pathname (not local state)
- [ ] Switching nav tabs clears any open right panel

### Phase 2 Exit Criteria

- All five nav tabs are clickable and route correctly
- ComingSoon shown for locked items
- Sidebar visible on desktop, BottomNav on mobile
- Layout does not break at 375px (iPhone SE) or 1280px (desktop)

---

## Phase 3 — Calendar (Week 4–5)

**Goal:** The owner can see all of today's appointments for all staff in a live calendar. This is the single most-used screen in the product — get it right.

### 3.1 Calendar Data — API

- [ ] `GET /api/v1/bookings?date=YYYY-MM-DD` — returns all bookings for tenant on that date, joined with staff + service + customer names
- [ ] Response includes: `id, staffId, staffName, staffColor, clientName, serviceName, startTime, endTime, state, pricePaisa, source, notes`
- [ ] Filtered by `tenantId` from JWT `tid` — never from query param
- [ ] `GET /api/v1/staff` — returns active staff for tenant with `id, name, role`

### 3.2 Calendar — Desktop

- [ ] `Calendar.tsx` — multi-column day view, one column per staff member
- [ ] Staff header row: avatar, name, role — sticky at top
- [ ] Time gutter: 8am–8pm, 1-hour rows, 12-hour format
- [ ] Current time indicator: lime horizontal line with circular dot
- [ ] Half-hour grid lines (dashed, subtle)
- [ ] Appointment cards positioned by `startTime`, sized by `endTime - startTime`
- [ ] Click on appointment card → opens AppointmentPanel
- [ ] Click on empty time slot → opens NewBookingModal pre-filled with staff + time
- [ ] "Today" button resets date to current date
- [ ] Prev/Next arrows navigate one day at a time

### 3.3 Appointment Card — `AppointmentCard.tsx`

- [ ] Shows: client name (bold), time range, service name (if ≥ 45 min card height), PKR amount (if ≥ 60 min)
- [ ] Left border colour by state (confirmed=green, checkedIn=teal, pendingPayment=amber, completed=gray, noShow=red)
- [ ] Background tint by state (matching STATUS_STYLES from primitives)
- [ ] Selected card: lime accent ring
- [ ] WhatsApp icon on card if `source === 'whatsapp'`

### 3.4 Calendar — Mobile

- [ ] Single staff column — one staff member visible at a time
- [ ] Horizontal staff switcher row at top: avatar pills, horizontally scrollable
- [ ] Active staff pill highlighted in lime
- [ ] Swipe left/right on calendar column switches staff (touch gesture)
- [ ] Appointment cards tap → opens bottom sheet (not right panel)
- [ ] FAB "+" button in bottom-right for new booking
- [ ] Date navigation: swipe on date header, or tap date to open date picker

### 3.5 Data Fetching

- [ ] Fetch bookings on date change, staff change, and after any booking mutation
- [ ] Show skeleton cards while loading (not a spinner blocking the whole calendar)
- [ ] Show empty state per staff column when no bookings
- [ ] Polling every 30 seconds to pick up new WhatsApp requests confirmed by other users (or use Supabase Realtime / WebSocket if available)

### Phase 3 Exit Criteria

- Seed bookings visible on calendar in correct time positions
- Card colours match booking states
- Clicking a card does not crash (panel can be a stub for now)
- Mobile calendar shows one staff column with working staff switcher
- Date navigation works (prev/next/today)

---

## Phase 4 — Appointment Panel & POS (Week 5–6)

**Goal:** The owner can tap any appointment, see full client and booking details, check the client in, and complete a checkout with a payment method. This closes the operational loop for in-person visits.

### 4.1 Appointment Panel — `AppointmentPanel.tsx`

- [ ] Desktop: slides in from right (fixed width 280px), pushes calendar content
- [ ] Mobile: bottom sheet (85% screen height), drag handle at top, dismissible by drag or tap outside
- [ ] Sections: status badge + close, client avatar + name + visit count + member since, today's appointment (service, time, staff, PKR total), contact (phone + WhatsApp indicator), client notes (editable), recent visits (last 4), footer actions
- [ ] Status badge uses STATUS_STYLES colours from primitives
- [ ] "Booked via WhatsApp" shows WhatsApp green pill if `source === 'whatsapp'`
- [ ] Notes field: shows text inline, tapping opens textarea, save button commits change
- [ ] `PATCH /api/v1/customers/:id/notes` — saves note, scoped to tenant

### 4.2 Status Transitions — API & UI

- [ ] `PATCH /api/v1/bookings/:id/status` — accepts `{ state }`, validates allowed transitions, updates DB
- [ ] Allowed transitions: `CONFIRMED → CHECKED_IN`, `CHECKED_IN → COMPLETED`, `any → NO_SHOW`, `any → CANCELLED`
- [ ] NO_SHOW and CANCELLED require confirmation tap (destructive action)
- [ ] Status change updates calendar card in real time (optimistic update, rollback on error)

### 4.3 POS Panel — `POSPanel.tsx`

- [ ] Desktop: replaces appointment panel (same right column)
- [ ] Mobile: replaces bottom sheet (full bottom sheet)
- [ ] Back arrow → returns to appointment panel
- [ ] Sections: service line item (name, time, PKR), discount selector (None / −500 / −1000 / custom), payment method selector (Cash, JazzCash, EasyPaisa, Raast QR, Card), totals summary (subtotal, discount, total), confirm button
- [ ] Discount requires `role === 'manager' || 'owner'` — staff cannot apply discounts
- [ ] Raast QR: display a QR code image (static placeholder for MVP — dynamic QR in Phase 9)
- [ ] Totals recalculate live as discount changes
- [ ] "Confirm Payment · PKR [total]" button always pinned to bottom of screen

### 4.4 Checkout — API

- [ ] `POST /api/v1/bookings/:id/checkout` — accepts `{ method, discountPaisa, totalPaisa }`, creates payment record, updates booking to COMPLETED, returns updated booking
- [ ] Payment record: `gateway = method`, `state = 'SUCCESS'` (in-person payment is trusted), `txn_ref = 'manual_' + uuid`
- [ ] On completion: booking state → COMPLETED, WhatsApp post-service message enqueued to BullMQ

### Phase 4 Exit Criteria

- Clicking a calendar card opens the appointment panel with real data
- Notes can be edited and saved
- "Checked In" status change reflected on calendar card immediately
- POS checkout completes without errors
- Completed booking appears as gray on calendar

---

## Phase 5 — New Booking (Week 6–7)

**Goal:** The owner can create a manual booking for a walk-in customer. The system checks real-time availability, prevents double-bookings, and optionally sends a payment link.

### 5.1 Availability — API

- [ ] `GET /api/v1/availability?staffId=&date=&serviceDuration=` — returns available time slots as array of `{ startTime, endTime }`, accounting for: existing bookings (PAYMENT_PENDING, CONFIRMED, COMPLETED states), staff working hours and breaks, service duration + buffer time
- [ ] Slots blocked by Redis lock are excluded
- [ ] Returns in 12-hour display format + ISO format for submission

### 5.2 New Booking Modal — `NewBookingModal.tsx`

- [ ] Desktop: centred modal
- [ ] Mobile: full-screen bottom sheet
- [ ] Fields in order: client phone (tel input, numeric keyboard), client name (auto-filled if phone matches existing client, else editable), service dropdown (grouped by category), staff dropdown (filtered by service if specialisations configured), date picker, time slot dropdown (fetches from availability API on staff + date + service selection), "Send payment link via WhatsApp" toggle
- [ ] Phone lookup: on blur, `GET /api/v1/customers?phone=` → pre-fills name if found
- [ ] Time slot dropdown shows loading state while fetching availability
- [ ] Shows "No slots available" if no slots returned

### 5.3 New Booking — API

- [ ] `POST /api/v1/bookings` — creates booking with three-layer integrity: Redis SET NX PX lock → SELECT FOR UPDATE → EXCLUDE GIST constraint
- [ ] If payment toggle is off: booking created as CONFIRMED (manual/trusted)
- [ ] If payment toggle is on: booking created as PAYMENT_PENDING, WhatsApp payment link sent
- [ ] If slot already taken: return 409 with `{ error: 'SLOT_UNAVAILABLE' }`
- [ ] On success: calendar refreshes, modal closes

### 5.4 Error Handling

- [ ] 409 SLOT_UNAVAILABLE → show "That slot just got taken. Please choose another time." inline
- [ ] Network error → show retry option, do not close modal
- [ ] All fields validated before submission (no empty required fields, valid phone format)

### Phase 5 Exit Criteria

- Walk-in booking created from the calendar
- Pre-existing client phone auto-fills the name
- Attempting to book an already-taken slot shows the 409 error
- New booking appears on calendar immediately (optimistic update)
- "Send payment link" toggle sends a WhatsApp message (can be a placeholder message for now)

---

## Phase 6 — Requests Queue (Week 7)

**Goal:** The owner sees incoming WhatsApp booking requests and can approve or decline them with one tap. The Requests badge count is live.

### 6.1 Requests — API

- [ ] `GET /api/v1/requests` — returns all `booking_requests` with state = 'pending' for tenant, joined with customer + service + staff names
- [ ] `POST /api/v1/requests/:id/approve` — creates booking from request data, updates request state to 'approved', sends WhatsApp confirmation to customer
- [ ] `POST /api/v1/requests/:id/decline` — updates request state to 'declined', sends WhatsApp regret message to customer
- [ ] `GET /api/v1/requests/count` — returns `{ count: N }` for badge (lightweight endpoint)

### 6.2 Requests View — `RequestsView.tsx`

- [ ] List of pending request cards (most recent first)
- [ ] Each card: client avatar, client name, phone, service, preferred staff (or "Any"), requested date/time, payment status pill (Paid = green / Payment Pending = amber), PKR amount, Approve + Decline buttons
- [ ] Approve: calls approve API, removes card from list optimistically, shows "Booking added to calendar" toast
- [ ] Decline: calls decline API, removes card from list, shows brief confirmation
- [ ] Mobile: swipe left on card reveals Decline red action (pattern familiar from iOS/Android)
- [ ] Empty state: "You're all caught up" with checkmark icon
- [ ] Loading skeleton while fetching

### 6.3 Badge Count

- [ ] Requests count fetched on dashboard load and after any approve/decline
- [ ] Badge number shown on Requests tab in sidebar and bottom nav
- [ ] Poll every 60 seconds for new requests (or use WebSocket/SSE if available)

### Phase 6 Exit Criteria

- Pending requests visible in the queue
- Approve → request disappears, booking visible on calendar
- Decline → request disappears
- Badge count decrements on approve/decline
- Empty state shown when queue is clear

---

## Phase 7 — Clients (Week 8)

**Goal:** The owner can find any client by name or phone, see their full visit history, and read or edit notes about them.

### 7.1 Clients — API

- [ ] `GET /api/v1/customers?q=` — full-text search by name or phone, returns list with `name, phoneE164, isVip, lastVisitDate, visitCount`
- [ ] `GET /api/v1/customers/:id` — full client profile with visit history (last 20 bookings), lifetime spend total, wa_opt_in status
- [ ] `PATCH /api/v1/customers/:id` — update `notes`, `isVip`, `name`
- [ ] `GET /api/v1/customers/:id/bookings` — paginated booking history (20 per page)

### 7.2 Clients View — `ClientsView.tsx`

- [ ] Search bar prominently at top (always visible, not behind an icon)
- [ ] Scrollable list of client rows: avatar, name, VIP badge (if applicable), phone, last visit, visit count, chevron
- [ ] VIP badge: onyx background, lime text
- [ ] Live filter as user types (debounce 300ms, call API)
- [ ] Loading state: skeleton rows
- [ ] Empty state: "No clients found" if search returns nothing

### 7.3 Client Profile Sheet — `ClientProfile.tsx`

- [ ] Desktop: slides in from right
- [ ] Mobile: full-screen view (navigate to it, back arrow returns to list)
- [ ] Sections: large avatar + name + VIP star, phone (tap-to-call on mobile), WhatsApp opt-in status, editable notes, visit history list (service, date, staff, PKR), lifetime total spend
- [ ] Notes: tap to enter edit mode (textarea), Save/Cancel buttons
- [ ] Visit history: most recent 10 shown, "Load more" for older ones
- [ ] "Mark as VIP" / "Remove VIP" toggle button

### Phase 7 Exit Criteria

- Searching "Ali" returns all clients with Ali in name or phone
- Tapping a client shows their profile with visit history
- Editing notes persists after refresh
- VIP badge visible on both list and profile

---

## Phase 8 — Settings (Week 8–9)

**Goal:** The owner can configure their salon — services, staff, working hours — without developer help. This is what makes onboarding self-service.

### 8.1 Settings — API

- [ ] `GET/POST/PATCH/DELETE /api/v1/services` — CRUD for services, scoped to tenant
- [ ] `GET/POST/PATCH /api/v1/staff` — CRUD for staff members, scoped to tenant
- [ ] `GET/PATCH /api/v1/settings/hours` — working hours per day + breaks
- [ ] `GET/PATCH /api/v1/settings/business` — business name, address, city, NTN, social handles
- [ ] `GET/PATCH /api/v1/settings/payments` — gateway credentials (encrypted), IBAN, deposit %

### 8.2 Services Settings

- [ ] List of active services with name, duration, price, active toggle
- [ ] Add Service: bottom sheet form — name, category dropdown, duration picker, price (PKR), buffer time, active toggle
- [ ] Edit Service: tap any row to open same form pre-filled
- [ ] Inactive toggle: service hidden from booking flows immediately
- [ ] Confirm delete: requires typing service name to confirm (destructive)

### 8.3 Staff Settings

- [ ] List of staff: avatar, name, role, active toggle
- [ ] Add Staff: name, role dropdown, working days (M T W T F S S pill toggles), start/end time per day, breaks (add multiple), service specialisations (multi-select from services list)
- [ ] Edit Staff: tap any row to open form pre-filled
- [ ] Inactive toggle: staff hidden from all booking flows immediately

### 8.4 Working Hours & Salon Settings

- [ ] Working hours: per-day open/close time + closed toggle
- [ ] Public holidays: pre-loaded Pakistan calendar, owner can add custom dates
- [ ] Advance booking window: number picker (7 / 14 / 30 / 60 days)
- [ ] Slot interval: 15 min or 30 min radio buttons

### 8.5 Business Info

- [ ] Simple form: salon name, address, city, Google Maps link, Instagram, phone, NTN
- [ ] Save button commits all fields at once

### Phase 8 Exit Criteria

- Owner can add a new service and it appears in the booking flow immediately
- Inactive service disappears from availability
- Staff schedule change reflects in availability the same day
- Business info saves and persists

---

## Phase 9 — WhatsApp Integration (Week 9–11)

**Goal:** A customer can message the salon's WhatsApp number, complete a booking entirely inside WhatsApp, pay a deposit, and receive a confirmation. This is the biggest engineering phase.

> ⚠️ Budget 2–3 dev-weeks for this phase. WhatsApp Flows encryption (RSA-OAEP + AES-128-GCM) is the hardest part. Test with Meta's reference implementation first.

### 9.1 Meta App Setup

- [ ] Create Meta Developer App with `whatsapp_business_management`, `whatsapp_business_messaging`, `business_management` permissions
- [ ] Configure webhook URL: `https://api.baari.pk/webhooks/whatsapp`
- [ ] Implement webhook verification challenge: `GET /webhooks/whatsapp`
- [ ] Submit App Review for Embedded Signup permissions (4–8 weeks — start this on Day 1)

### 9.2 Embedded Signup — Settings UI

- [ ] "Connect WhatsApp" button in Settings → WhatsApp tab
- [ ] Opens Meta Embedded Signup popup (Facebook Login SDK)
- [ ] On success: receive OAuth code, exchange server-side for System User token, store encrypted per tenant (`wa_phone_id`, `wa_waba_id`, `wa_token`)
- [ ] Show connected status: phone number, display name, green connected pill
- [ ] "Disconnect" option with confirmation

### 9.3 Webhook Ingestion

- [ ] `POST /webhooks/whatsapp` — verify X-Hub-Signature-256 (HMAC-SHA256 with app secret), ACK 200 immediately, push to BullMQ `whatsapp-inbound` queue
- [ ] `apps/api/src/workers/whatsapp.worker.ts` — consumes queue, extracts `phone_number_id`, Redis lookup → `tenantId`, routes to message handler
- [ ] Handle message types: `text`, `interactive`, `flow_reply` (`nfm_reply`)

### 9.4 WhatsApp Flows

- [ ] Create "Book Appointment" Flow in Meta Flow Builder (5 screens: Service, Staff, Date, Time, Confirm)
- [ ] `apps/api/src/lib/whatsapp/flows.ts` — RSA-OAEP + AES-128-GCM encryption/decryption for Flow data exchange endpoint
- [ ] `POST /webhooks/whatsapp/flow` — decrypts payload, returns real-time slot availability per screen, encrypts response (inverted IV = XOR 0xFF)
- [ ] Flow action `complete` handler: receives final booking payload, creates booking via `createBooking()`, sends payment CTA

### 9.5 WhatsApp Client — `apps/api/src/lib/whatsapp/client.ts`

- [ ] `sendMessage(tenantId, to, message)` — sends free-form message inside 24-hr service window
- [ ] `sendTemplate(tenantId, to, templateName, params)` — sends approved template
- [ ] `sendCTAButton(tenantId, to, bodyText, buttonLabel, url)` — sends payment CTA button message
- [ ] `sendFlow(tenantId, to, flowId)` — triggers the booking Flow
- [ ] Per-tenant token used for each API call (from `tenant.wa_token`)
- [ ] Error handling: log failed sends, retry 3 times with exponential backoff

### 9.6 Booking Flow Automation

- [ ] Customer messages "Hi" or "Book" → system sends Flow trigger message
- [ ] Flow screens call `/webhooks/whatsapp/flow` for real-time data
- [ ] On Flow completion: `createBooking()` called, state = PAYMENT_PENDING
- [ ] Payment CTA button sent: "Pay PKR [amount] deposit"
- [ ] IPN received (Phase 10) → state = CONFIRMED, confirmation template sent
- [ ] Slot expires after 10 min without payment → EXPIRED, retry message sent

### 9.7 Reminder Workers

- [ ] `apps/api/src/workers/reminder.worker.ts` — consumes `whatsapp-reminder` queue
- [ ] On CONFIRMED: enqueue 24h reminder job (delay = startTime - 24h - now) and 2h reminder job
- [ ] Templates submitted to Meta for approval before launch: `appointment_reminder_24h`, `appointment_reminder_2h`, `booking_confirmed`, `payment_received`, `slot_expired`

### Phase 9 Exit Criteria

- Customer texts salon WhatsApp → receives Flow trigger
- Completes all 5 screens → booking created in DB
- Payment CTA button received in chat
- Approved request appears in Requests queue
- 24h reminder sent automatically for confirmed bookings

---

## Phase 10 — Payments (Week 11–12)

**Goal:** A customer can pay their deposit via JazzCash, EasyPaisa, Raast, or card. The slot is confirmed automatically when payment is received. No-payment slots expire automatically.

### 10.1 Safepay Integration — Recommended First

- [ ] Register Safepay sandbox account, get API key and webhook secret
- [ ] `apps/api/src/lib/payments/safepay.ts` — `createCheckoutSession(bookingId, amountPaisa, customerPhone)` → returns hosted checkout URL
- [ ] `POST /webhooks/payments/safepay` — verify X-Safepay-Signature, ACK 200 immediately, call `processPaymentResult()`
- [ ] `processPaymentResult()` — idempotent handler: row-level lock on booking, skip if already CONFIRMED, update state, create payment record, enqueue reminders
- [ ] Reconciliation cron (pg_cron or BullMQ repeatable): every 60s, poll Safepay for PAYMENT_PENDING bookings older than 8 minutes

### 10.2 JazzCash Direct (after Safepay is stable)

- [ ] `apps/api/src/lib/payments/jazzcash.ts` — `pp_SecureHash` generation (HMAC-SHA256 of sorted `pp_*` fields with IntegritySalt)
- [ ] `POST /webhooks/payments/jazzcash` — verify pp_SecureHash, process IPN
- [ ] IPN is signed — verify before processing. Always poll `InquireTransaction` as fallback.
- [ ] Settlement: T+1 for wallet, T+2 for card

### 10.3 EasyPaisa Direct (after JazzCash is stable)

- [ ] `apps/api/src/lib/payments/easypaisa.ts` — AES-128-CBC encryption of parameter string
- [ ] `POST /webhooks/payments/easypaisa` — IPN is UNSIGNED — always call Inquire-Status to validate
- [ ] OTC flow: returns token, customer pays at retailer
- [ ] Settlement: T+1 wallet, T+7 OTC

### 10.4 Slot Expiry Worker

- [ ] `apps/api/src/workers/expiry.worker.ts` — consumes `booking-expiry` queue, row-level lock on booking, flips PAYMENT_PENDING → EXPIRED, releases Redis lock, sends "slot expired" WhatsApp
- [ ] Job enqueued in `createBooking()` with 10-min delay
- [ ] Idempotent: if booking is already CONFIRMED when worker runs, does nothing

### 10.5 Payment Status in Dashboard

- [ ] Pending Payment cards (amber) show in calendar
- [ ] Appointment panel shows payment status: "Deposit paid" (green) or "Awaiting payment" (amber)
- [ ] POS panel shows: deposit already paid, remaining balance to collect

### Phase 10 Exit Criteria

- Customer taps payment CTA → Safepay checkout opens with JazzCash/EasyPaisa/Raast options
- Payment received → booking confirmed, calendar card turns green
- No payment in 10 min → booking expired, slot available again
- IPN arrives after expiry → handled gracefully (auto-refund or log — no DB corruption)
- Reconciliation cron catches any missed IPNs

---

## Phase 11 — Public Booking URL (Week 12–13)

**Goal:** Each salon has a public webpage at `book.baari.pk/[slug]` where customers can book online. Instagram bio link works. Google can index it.

### 11.1 Booking Page — Next.js SSR

- [ ] `apps/web/src/app/book/[slug]/page.tsx` — server component, fetches salon data by slug from API
- [ ] If slug not found: 404 page
- [ ] `generateMetadata()` — dynamic Open Graph title, description, image from salon profile
- [ ] JSON-LD `LocalBusiness` schema in `<script type="application/ld+json">`
- [ ] Page sections: salon header (name, city, photo if uploaded), service list with prices, booking form

### 11.2 Booking Form — Web

- [ ] Step 1: Service selection (card grid)
- [ ] Step 2: Staff selection (card grid, "Any available" option)
- [ ] Step 3: Date picker (month calendar view)
- [ ] Step 4: Time slot grid (fetches from `/api/v1/availability`)
- [ ] Step 5: Customer details (name, phone)
- [ ] Review + confirm
- [ ] On confirm: calls `POST /api/v1/bookings`, receives Safepay checkout URL, redirects

### 11.3 Post-Payment

- [ ] Safepay redirects to `/book/[slug]/success?ref=[txnRef]`
- [ ] Success page: booking confirmed message + `wa.me/[phone]` deeplink button ("Message us on WhatsApp")
- [ ] System sends confirmation WhatsApp to customer

### 11.4 QR Code Generation

- [ ] In Settings → Sharing tab: generate QR code for `book.baari.pk/[slug]`
- [ ] Download as PNG (300dpi for printing) and PDF
- [ ] Preview of how it looks on a printed business card

### Phase 11 Exit Criteria

- `book.baari.pk/ruma-lahore` loads with correct salon name and services
- Complete a booking end-to-end from this URL
- Open Graph preview shows salon name and city when link shared on WhatsApp
- QR code generated, scannable, leads to correct booking page

---

## Phase 12 — Polish, Testing & First Salon (Week 13–14)

**Goal:** The product is stable enough to hand to one real salon and have them use it for a week without a developer present.

### 12.1 Error Handling & Edge Cases

- [ ] All API errors return consistent `{ ok: false, error: { code, message } }` shape
- [ ] All frontend fetch calls have error states (not just loading and success)
- [ ] Network timeout handling: retry once, then show "Something went wrong. Tap to retry."
- [ ] Session expired: redirect to login gracefully with "Please log in again" message
- [ ] Empty states for every list view (no bookings today, no clients, no requests)

### 12.2 Mobile Testing

- [ ] Test on actual devices: Android mid-range (Samsung Galaxy A series), iPhone (Safari)
- [ ] Confirm bottom sheet dismiss works with drag gesture
- [ ] Confirm all buttons are tappable without zooming
- [ ] Confirm phone keyboard does not obscure key fields
- [ ] Confirm date pickers open native pickers on iOS and Android
- [ ] Test on low-end device (2GB RAM Android) — performance must be acceptable

### 12.3 Load Shedding Resilience

- [ ] Calendar shows last-fetched data when offline (no blank screen)
- [ ] Pending mutations queued and retried on reconnect (or show "syncing..." indicator)
- [ ] API requests timeout after 8 seconds — not the browser default 30+

### 12.4 WhatsApp Templates — Submit for Approval

- [ ] Submit all required templates to Meta (3–5 business day review)
- [ ] Templates needed for launch: `booking_confirmed`, `payment_received`, `appointment_reminder_24h`, `appointment_reminder_2h`, `slot_expired`, `booking_declined`
- [ ] Have fallback plain-text messages ready for the approval gap

### 12.5 Monitoring

- [ ] Sentry DSN configured — errors reported from both web and API
- [ ] DigitalOcean monitoring alerts: CPU > 80%, memory > 85%, disk > 70%
- [ ] BullMQ dashboard (or simple endpoint) to monitor queue depths
- [ ] Log every payment IPN received and processed (for debugging)

### 12.6 First Salon Onboarding Checklist

- [ ] Owner signs up → OTP → dashboard
- [ ] Creates 3+ services
- [ ] Adds 2+ staff with working hours
- [ ] Connects WhatsApp Business number
- [ ] Owner sends first test booking via WhatsApp as a customer
- [ ] Approves request, confirms booking, completes checkout
- [ ] Checks that 24h reminder fires for a test booking
- [ ] Reviews public booking URL and shares on Instagram bio

### Phase 12 Exit Criteria

- Zero crash bugs during the first salon's first week
- Salon owner can complete every daily task without calling for help
- WhatsApp booking to checkout works end-to-end with real money
- 24h reminders firing correctly

---

## Feature Dependency Map

```
Phase 0 (Foundation)
    └── Phase 1 (Auth)
            └── Phase 2 (Navigation Shell)
                    └── Phase 3 (Calendar)
                            ├── Phase 4 (Appointment Panel + POS)
                            │       └── Phase 5 (New Booking)
                            │               └── Phase 6 (Requests Queue)
                            │                       └── Phase 7 (Clients)
                            │                               └── Phase 8 (Settings)
                            │                                       └── Phase 9 (WhatsApp)
                            │                                               └── Phase 10 (Payments)
                            │                                                       └── Phase 11 (Public URL)
                            │                                                               └── Phase 12 (Polish)
                            └── Can be parallelised after Phase 3:
                                    Phase 7 (Clients) — no WhatsApp dependency
                                    Phase 8 (Settings) — no WhatsApp dependency
```

---

## Parallelisation Opportunities

If two developers are working simultaneously, these phases can run in parallel after Phase 3:

| Developer A                       | Developer B                                  |
| --------------------------------- | -------------------------------------------- |
| Phase 4 — Appointment Panel + POS | Phase 7 — Clients                            |
| Phase 5 — New Booking             | Phase 8 — Settings                           |
| Phase 6 — Requests Queue          | Phase 9 prep — Meta App Review (start Day 1) |
| Phase 9 — WhatsApp Flows          | Phase 10 — Payments (Safepay sandbox)        |
| Phase 11 — Public URL             | Phase 12 — Mobile testing                    |

> 📌 Start Meta App Review on Day 1. It takes 4–8 weeks and blocks Phase 9. Submit the app while building everything else.

---

## What NOT to Build in MVP

These are explicitly excluded. Do not start them until Phase 12 is complete and at least 5 paying salons are live.

| Feature                       | Reason Excluded                                             |
| ----------------------------- | ----------------------------------------------------------- |
| Inventory management          | Complex, low urgency for first salons                       |
| Staff commission calculator   | Can be done in Excel for first month                        |
| Marketing broadcasts          | Need WhatsApp template approval + significant customer base |
| Waitlist                      | Nice-to-have, not blocking any sale                         |
| Reports / Analytics           | Dashboard counts are enough for 5 salons                    |
| Billie AI assistant           | Phase 3 feature at earliest                                 |
| Multi-location                | No salon will need this before 50+ total tenants            |
| Bridal packages               | Niche, high complexity — Phase 2                            |
| Loyalty programme             | Phase 3                                                     |
| Marketplace (salon discovery) | Requires critical mass of supply first                      |

---

## Launch Readiness Checklist

Before inviting the first paying customer:

- [ ] All P0 features in Phase 1–10 are working end-to-end
- [ ] WhatsApp templates approved by Meta
- [ ] Safepay sandbox tested, production credentials in place
- [ ] SSL certificate active on all domains (Caddy handles this automatically)
- [ ] Database daily backups configured and tested (restore a backup at least once)
- [ ] Sentry error reporting active
- [ ] `.env` in production contains no dev values
- [ ] `app_user` DB role is non-superuser with only required permissions
- [ ] All API routes return 401 for missing/expired JWT
- [ ] Rate limiting confirmed working (send 101 requests, verify 102nd is blocked)
- [ ] Payment IPN tested with real JazzCash sandbox transaction
- [ ] One full end-to-end booking tested: WhatsApp → Flow → Payment → Confirmed → Reminder → Checkout → Completed

---

_Baari · باری — Internal Development Document · v1.0 · May 2026_
