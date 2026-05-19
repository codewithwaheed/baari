# Baari · باری — Product Feature Document

> "Your turn." — WhatsApp-native B2B appointment SaaS for Pakistan.

**Version:** MVP v1.0 · May 2026
**Model:** B2B SaaS · Pay-First
**Primary Channel:** WhatsApp Business API
**Market:** Pakistan — Tier-1 Cities (Lahore, Karachi, Islamabad)

---

## Table of Contents

1. [Product Vision](#1-product-vision)
2. [Information Architecture](#2-information-architecture)
3. [WhatsApp Booking Flow](#3-whatsapp-booking-flow)
4. [Calendar](#4-calendar)
5. [Appointment Panel & POS](#5-appointment-panel--pos)
6. [Requests Queue](#6-requests-queue)
7. [Clients](#7-clients)
8. [Settings](#8-settings)
9. [Authentication & Onboarding](#9-authentication--onboarding)
10. [Public Booking URL](#10-public-booking-url)
11. [MVP Scope & Roadmap](#11-mvp-scope--roadmap)
12. [Booking State Machine](#12-booking-state-machine)
13. [Notifications & Communication](#13-notifications--communication)
14. [Payments](#14-payments)
15. [Technical Notes](#15-technical-notes)

---

## 1. Product Vision

### 1.1 The Problem

Pakistani salons — from DHA boutiques to neighbourhood parlours — run entirely on verbal appointments, WhatsApp voice notes, and paper diaries. This causes:

- **Double-bookings** when two staff members both confirm the same slot
- **No-shows** with zero financial consequence for the customer
- **Underutilised stylists** sitting idle between unplanned gaps
- **Zero client history** — every visit starts cold, no record of preferences
- **Revenue leakage** from informal discounts and untracked walk-ins
- **Owner burnout** from managing bookings on personal phones mixed with family messages

> 📌 The phrase _"meri baari kab hai?"_ — "when is my turn?" — is what every customer asks. Baari answers that question digitally.

### 1.2 The Solution

Baari is a B2B SaaS platform that gives every salon a digital front desk, operating entirely inside WhatsApp — the one app every Pakistani already has. Customers book by messaging the salon's WhatsApp number. The system responds with available slots, collects a deposit, and confirms the appointment — all without the customer ever leaving WhatsApp or downloading anything.

For the salon owner, Baari provides a **mobile-first management dashboard**: live calendar, staff scheduling, one-tap POS checkout, and a queue of incoming WhatsApp booking requests. The entire system is designed to be operated from a smartphone.

### 1.3 Target Users

| User                | Who They Are                                                                | Primary Device                          |
| ------------------- | --------------------------------------------------------------------------- | --------------------------------------- |
| **Salon Owner**     | Runs the business. Books appointments, manages staff, handles payments.     | Mobile (Android, mid-range)             |
| **Staff / Stylist** | Checks their own schedule. Marks appointments complete. Views client notes. | Mobile or shared tablet                 |
| **Receptionist**    | Approves WhatsApp requests. Manages walk-ins. Handles checkout.             | Mobile or desktop                       |
| **End Customer**    | Messages the salon on WhatsApp. Books and pays. Receives reminders.         | Mobile (WhatsApp only — no app install) |

### 1.4 Mobile-First Design Principles

> 📱 **The majority of Baari users — owners, staff, and receptionists — will use the dashboard primarily on mobile. Every feature must be designed mobile-first. Desktop is a secondary target.**

- Touch targets minimum **48×48px** for all interactive elements
- **Bottom navigation bar** on mobile (thumb-reachable zone) — not a sidebar
- No hover-only interactions — everything works with tap
- **Single-column layouts** on mobile — no horizontal scrolling on primary views
- Large text for key data: PKR amounts, client names, time slots — never below 14px
- **Calendar scrolls vertically** on mobile — swipe left/right to switch staff columns
- All modals open as **bottom sheets** on mobile — not centred modals
- Input fields use appropriate keyboard types: `tel` for phone, `number` for amounts
- Confirmation actions (Check out, Approve) must be **one tap** — never buried in menus
- **Offline-resilient**: show last-known state during connectivity drops (common during load-shedding)

---

## 2. Information Architecture

### 2.1 Navigation Structure

Mobile uses a **bottom tab bar**. Desktop uses a **left sidebar**. Same five destinations on both.

| Tab             | Icon          | Audience            | Contains                                                         |
| --------------- | ------------- | ------------------- | ---------------------------------------------------------------- |
| **Calendar**    | Calendar grid | All roles           | Day view by staff column. Appointment cards. New booking button. |
| **Requests**    | Inbox tray    | Owner, Receptionist | Incoming WhatsApp booking requests. Approve / Decline queue.     |
| **Clients**     | Person icon   | All roles           | Client directory. Search. Profile with notes and visit history.  |
| **Sales / POS** | Cash register | Owner, Receptionist | Quick checkout. Payment method selection. Daily takings summary. |
| **Settings**    | Gear          | Owner only          | Services, staff, hours, breaks, WhatsApp setup, business info.   |

> 📱 **Mobile:** Bottom tab bar always visible. Active tab shows a lime underline indicator. Badge count on Requests tab for pending items.

### 2.2 Role-Based Access

Three roles control visibility and permissions:

- **Owner** — full access to all features including settings, reports, and staff management
- **Manager** — all operational features; cannot change subscription plan or delete business data
- **Staff** — own schedule only, client notes for their own appointments, no revenue data

> 📱 **Staff login** shows a simplified mobile view: just their own calendar column and today's client list. No financial data visible.

### 2.3 Tenant Isolation

Each salon is a completely isolated tenant. There is zero cross-salon data visibility. An owner sees only their staff, their clients, their bookings, their revenue. No data from other salons is ever accessible — enforced at the database level via Row-Level Security, not just application code.

---

## 3. WhatsApp Booking Flow

### 3.1 Overview

This is the core of Baari's differentiation. Customers **never download an app**, visit a website, or create an account. They message the salon's existing WhatsApp number. The system handles everything from inside the chat.

> ⚠️ WhatsApp Pay is **NOT available in Pakistan** as of May 2026. All payments go through a branded web checkout page that opens from a WhatsApp CTA button. Time outside WhatsApp: approximately 30 seconds.

### 3.2 Booking Entry Points

Customers can start a booking from:

- "Book Now" button on salon's Instagram or Facebook ad (WhatsApp CTA)
- QR code displayed at the salon reception desk
- Link in Instagram bio (`wa.me/92XXX?text=Book`)
- WhatsApp contact shared by a friend (word of mouth)
- Direct message to the salon WhatsApp number

> 📱 QR codes at reception are a high-priority entry point — walk-in customers pre-book their next visit before leaving the salon.

### 3.3 WhatsApp Flow — Step by Step

The booking uses **WhatsApp Flows**: a multi-screen native form that opens inside the WhatsApp chat. No browser redirect. No external link until payment.

#### Screen 1 — Service Selection

- Salon's active service menu grouped by category (Hair, Skin, Nails, Makeup)
- Each service shows: name, duration, PKR price
- Single-select — customer picks one service

> 📱 Services as a scrollable list with large tap targets. Category filters as horizontal pills at the top.

#### Screen 2 — Staff Selection

- Available staff for the chosen service
- Each staff card: name, role, initials avatar
- "Any available" option for customers with no preference
- Staff on leave or inactive are hidden

> 📱 Staff shown as a vertical card list with large initials avatars. Easy to scan on small screens.

#### Screen 3 — Date Selection

- Calendar showing next 30 days (configurable)
- Greyed-out dates: fully booked, salon closed, public holidays
- Today pre-selected if slots are available

> 📱 Month-view calendar with tap-to-select. Fully booked days in muted gray.

#### Screen 4 — Time Slot Selection

- Available slots fetched in real-time from backend during the Flow (data exchange)
- Slots sized by service duration — a 90-min service shows 90-min gaps
- Already-booked slots are absent (not greyed — simply not shown)
- Buffer time after services automatically excluded

> 📱 Time slots as a scrollable grid of pill buttons (10:00am, 10:30am, 11:00am). Large tap targets. Selected slot highlights in lime.

#### Screen 5 — Confirmation

- Summary: service, staff, date, time, total price
- Customer name field (pre-filled from WhatsApp profile if available)
- "Confirm booking" button
- Note about deposit requirement

> 📱 Recap card at top, CTA button pinned at bottom. Single-purpose screen.

#### After Flow Completion

1. Flow closes, returns to chat
2. System sends: _"Your booking is noted. Tap below to pay your PKR [amount] deposit to lock your slot."_
3. CTA button: **"Pay Deposit"** → opens branded Safepay checkout (JazzCash / EasyPaisa / Raast QR / Card)
4. Customer pays → redirected back to `wa.me` deeplink → returns to chat
5. Confirmation template sent: _"✓ Paid! Your [service] with [staff] on [date] at [time] is confirmed. We'll remind you the day before."_
6. Slot locked. Booking state: **CONFIRMED**

### 3.4 No-Payment Fallback

If the customer does not pay within the configured window (default: 10 minutes):

- Slot automatically released back into the available pool
- Booking state → **EXPIRED**
- System sends: _"Your slot for [time] has been released. Tap here to try again."_
- Customer can restart the booking from the same message thread

> ⚠️ The payment window (5, 10, or 15 minutes) is configurable per salon in Settings. Default: 10 minutes.

### 3.5 Automated WhatsApp Messages

| Trigger                    | Category  | Content                                               |
| -------------------------- | --------- | ----------------------------------------------------- |
| Booking initiated (unpaid) | Utility   | Slot held. Payment link + countdown warning.          |
| Payment received           | Utility   | Confirmed. Date, time, staff name.                    |
| 24 hours before            | Utility   | Reminder: appointment tomorrow at [time].             |
| 2 hours before             | Utility   | Final reminder: today at [time] with [staff].         |
| Appointment completed      | Utility   | Thank you! Tap to leave feedback.                     |
| Cancellation by salon      | Utility   | Apology + refund info + rebooking link.               |
| Slot expired (no payment)  | Utility   | Slot released. Try again link.                        |
| Marketing broadcast        | Marketing | Promotions, discounts, new services. Owner-triggered. |

> 📌 Utility templates inside the 24-hour service window are **free**. Time reminders to fall inside this window whenever possible.

---

## 4. Calendar

### 4.1 Desktop View

Multi-column day view. Each staff member occupies one column. Time slots run vertically from 8am to 8pm (configurable). Appointment cards are positioned and sized by start time and duration.

- Sticky staff header row with avatar, name, and role
- Time gutter on left in 12-hour format (8am, 9am...)
- Current time indicator: lime horizontal line with dot
- Half-hour grid lines (dashed, subtle)
- Clicking a card opens the Appointment Panel on the right
- Clicking empty space opens New Booking modal pre-filled with that staff and time
- "Today" button jumps to current date
- Previous/Next arrows navigate day by day

### 4.2 Mobile Calendar View

> ⚠️ Do not try to show all staff columns on mobile with horizontal scroll — this is unusable on a 6-inch screen. One column at a time is the correct pattern.

Mobile-specific calendar behaviour:

- **Single column view** — one staff member at a time
- **Horizontal swipe** left/right switches between staff members
- **Staff switcher row** at the top: small avatar pills, horizontally scrollable
- Active staff pill highlighted in lime
- **Vertical scroll** through the day's timeline
- Appointment cards **tap to open bottom sheet** (not a right panel)
- **FAB button** ("+") in bottom-right for new booking
- Date navigation: swipe left/right on date header, or tap to open date picker
- Compact cards: client name + time. Service on second line if height allows.

> 📱 The staff switcher row is the key UX decision. It lets owners quickly check each stylist's day without navigating away from the calendar.

### 4.3 Appointment Card States

Cards are visually distinct by booking state. Colour-coding is consistent across all views.

| State               | Left Border     | Background | Meaning                                     |
| ------------------- | --------------- | ---------- | ------------------------------------------- |
| **Confirmed**       | `#4E7C58` green | `#E8F0EA`  | Booking paid and locked in                  |
| **Checked In**      | `#3F8A8A` teal  | `#DFEDED`  | Customer has arrived at the salon           |
| **Pending Payment** | `#C8923C` amber | `#FAEFE1`  | Booking requested, payment not yet received |
| **Completed**       | `#8A8275` gray  | `#ECE9E2`  | Service finished, checkout done             |
| **No Show**         | `#B5483A` red   | `#F5E2DF`  | Customer did not arrive                     |

### 4.4 Appointment Card Content

Content shown depends on card height (service duration):

- **All cards:** client name (bold) + time range right-aligned
- **Cards ≥ 45 min:** + service name on second line
- **Cards ≥ 60 min:** + status badge and PKR amount at bottom
- **Selected card:** lime accent ring on the card border

> 📱 Mobile cards show client name and time only. Tap to see full details in bottom sheet.

### 4.5 New Booking — Manual

The "New Booking" button (desktop: top right; mobile: FAB) opens booking creation for walk-ins or phone bookings.

**Fields required:**

- Client phone number — looks up existing client or creates new one
- Client name — auto-filled if phone matches an existing client
- Service — dropdown from active service list
- Staff member — dropdown (filtered by service capability if configured)
- Date — date picker
- Time slot — dropdown showing available slots (real-time availability check)
- "Send payment link via WhatsApp" toggle

On confirm: booking created as **CONFIRMED** for manual/walk-in bookings (trusted by default). Payment link toggle sends a WhatsApp payment request if turned on.

> 📱 On mobile, the new booking form opens as a full-screen sheet from the bottom. Each field is large enough to tap comfortably. Phone field opens numeric keyboard. Date field uses native date picker.

---

## 5. Appointment Panel & POS

### 5.1 Appointment Detail Panel

Tapping any appointment opens a detailed view.

- **Desktop:** slides in from the right
- **Mobile:** slides up as a bottom sheet (~85% screen height, dismissible by drag)

#### Status + Actions Header

- Current status badge with coloured dot (Confirmed, Checked In, etc.)
- Close button (desktop) / drag handle to dismiss (mobile)
- Edit and more-options (⋯) icon buttons

#### Client Identity

- Large initials avatar
- Client name
- VIP star icon if applicable
- Visit count + member since date

#### Today's Appointment

- Service name (medium bold)
- Time range (e.g., 10:30am – 12:00pm)
- Assigned staff name
- Service total in large display font (PKR format)

#### Contact

- Phone number with tap-to-call icon
- "Booked via WhatsApp" indicator in WhatsApp green

#### Client Notes

- Free text note visible inline
- Edit button opens note into an editable textarea
- Save commits the change immediately
- Notes persist across all future visits

> 📌 _"Prefers cooler tones. Sensitive scalp. Allergic to ammonia-based dyes."_ — These notes are the most important feature for client retention. Make them prominent.

#### Recent Visits

- Last 3–4 visits: service name, date, staff, PKR amount
- Helps staff understand a client's history at a glance before the appointment

#### Footer Actions

- **"Check out"** — primary button, dark background, full width — opens POS panel
- **"Reschedule"** — opens reschedule flow
- **"Cancel"** — danger style, requires confirmation tap

> 📱 All three action buttons visible without scrolling on mobile. Fixed at the bottom of the sheet. Large enough for one-thumb tap.

### 5.2 Status Transitions

Staff can manually change booking state from the appointment panel:

| From       | To         | Action                           | Confirmation Required |
| ---------- | ---------- | -------------------------------- | --------------------- |
| Confirmed  | Checked In | Customer arrives                 | No                    |
| Checked In | Completed  | After service, triggers checkout | No                    |
| Any        | No Show    | Customer didn't arrive           | Yes                   |
| Any        | Cancelled  | Salon initiates cancellation     | Yes                   |

> 📱 State changes are one-tap. Confirmation sheet appears only for No Show and Cancel (destructive actions).

### 5.3 POS / Checkout Panel

Opens from "Check out". On desktop: replaces the appointment panel. On mobile: replaces the full bottom sheet.

#### Service Line Item

- Service name with scissors icon
- Time range
- PKR amount right-aligned

#### Discount Selector

- Quick-select: **None / −PKR 500 / −PKR 1,000**
- Custom discount input field (type any amount)
- Discount requires Manager role or above — staff cannot apply discounts

> 📱 Discount options shown as three large tap-target buttons in a row.

#### Payment Method (single select)

- **Cash** — manual log, no digital transaction
- **JazzCash** — customer pays via JazzCash wallet
- **EasyPaisa** — customer pays via EasyPaisa
- **Raast QR** — dynamic QR code displayed for customer to scan
- **Card** — tap/insert on physical terminal (Baari logs the amount, does not process directly)

#### Totals Summary

- Subtotal
- Discount (only shown if applied, in green text)
- **Total in large display font**

#### Confirm Button

- "Confirm Payment · PKR [total]" — full-width dark button, always pinned to bottom
- On confirm: booking → **COMPLETED**, payment record created, post-service WhatsApp sent

> 📱 "Confirm Payment" is always visible at the bottom — never requires scrolling. This is the most-used action at the counter.

> 📌 In the MVP, the POS is a **logging tool** for in-person payments. Digital payments are sent via WhatsApp before arrival. The POS records what was collected at the counter.

---

## 6. Requests Queue

### 6.1 What Are Requests?

When a customer completes a WhatsApp booking flow, the booking enters the Requests queue as **pending approval**. The owner or receptionist reviews and either:

- **Approves** — adds to calendar, sends WhatsApp confirmation
- **Declines** — removes from queue, sends WhatsApp regret message

> 📌 Salons can enable **Auto-approve** in Settings (On/Off). When on, paid requests skip the queue and go directly to Confirmed. Recommended for high-volume salons.

### 6.2 Request Card

Each request shows:

- Client name + initials avatar
- Client phone number
- Requested service
- Preferred staff (or "Any available")
- Requested date and time
- Payment status: **"Paid"** (green pill) or **"Payment Pending"** (amber pill)
- PKR amount
- **"Approve"** button — dark background
- **"Decline"** button — ghost outline button

> 📱 On mobile, Approve and Decline are side-by-side at the bottom of each card. Large enough to tap without error. Swiping the card left reveals a red Decline action (iOS/Android swipe gesture pattern).

### 6.3 Empty State

When all requests are handled: _"You're all caught up."_ with a checkmark icon. Clean and satisfying — the team can see at a glance that nothing is waiting.

### 6.4 Badge Count

The Requests tab shows a live count badge of pending items. Also visible on the home screen icon if the app is installed as a PWA (iOS/Android notification badge).

---

## 7. Clients

### 7.1 Client List

Searchable directory of all clients who have ever booked with the salon. Sorted by last visit date (most recent first) by default.

- **Search** by name or phone number — live filter as you type
- Each row: initials avatar, name, VIP badge, phone, last visit, visit count, chevron
- VIP badge: onyx pill with lime text
- Tapping a row opens the client profile

> 📱 Search bar is prominently placed at the top — not hidden behind a search icon. Mobile users search frequently to find clients before walk-in check-in.

### 7.2 Client Profile Sheet

Full client record. Desktop: slides in from right. Mobile: full-screen view.

- Large initials avatar, name, VIP status
- Phone number with tap-to-call
- WhatsApp opt-in status: "Opted in" (green) or "Opted out" (muted)
- **Editable notes field** — saved per salon, not shared across salons
- Full visit history: service, date, staff, PKR amount
- Lifetime spend total (summed from history)

> 📱 Profile is scrollable on mobile. Notes expand as user types. Visit history shows most recent 10 visits; "Show more" loads older ones.

### 7.3 VIP Designation

Owners and managers can mark clients as VIP. VIP clients:

- Show with a special badge in the client list and on appointment cards
- Can be filtered separately in the client list
- Future: VIP clients get priority slot access before general availability opens

### 7.4 Client Creation

Clients are created automatically when:

- A new phone number completes a WhatsApp booking flow
- A manual booking is created with a phone number not in the system

Clients can also be created manually from the Clients tab (for importing existing regulars).

---

## 8. Settings

> All Settings are accessible to **Owner** role only.

### 8.1 Services

Manage the salon's service menu.

| Field       | Options                                              |
| ----------- | ---------------------------------------------------- |
| Name        | Free text (e.g., "Balayage")                         |
| Category    | Hair / Skin / Nails / Makeup / Other                 |
| Duration    | 15, 30, 45, 60, 90, 120, 150, 180, 240 minutes       |
| Price       | PKR amount                                           |
| Buffer time | 0, 15, 30 minutes (sanitation gap after service)     |
| Active      | Toggle — inactive services hidden from booking flows |

> 📱 Service list as vertical scrollable rows. "Add service" is a FAB at the bottom. Editing opens a bottom sheet form.

### 8.2 Staff

Manage staff profiles and schedules.

- Name and role (Stylist, Colorist, Esthetician, Barber, Nail Tech, Manager)
- Profile photo or auto-generated initials avatar
- Working days (Mon–Sun toggles)
- Working hours start and end time per day
- Recurring breaks (e.g., Zuhr 1:00pm–1:30pm daily)
- Service specialisations — which services this staff member can perform
- Active / Inactive toggle (inactive staff removed from all booking flows)

> 📱 Working days shown as a horizontal row of day pills (M T W T F S S) — lime for working, muted gray for off. Compact and easy to edit on mobile.

### 8.3 Working Hours & Breaks

Salon-wide defaults (overridden per staff if needed):

- Opening and closing time per day of week
- Closed days (no slots available)
- Public holidays (Pakistan: Eid, Independence Day, Rabi ul Awwal, etc.)
- Advance booking window: how many days ahead customers can book (default: 30 days)
- Slot interval: 15 minutes or 30 minutes

### 8.4 WhatsApp Setup

Connect the salon's WhatsApp Business number to Baari:

1. Tap "Connect WhatsApp" — opens Embedded Signup popup
2. Log in with personal Facebook account (required by Meta)
3. Create or select a WhatsApp Business Account (WABA)
4. Add and verify the salon's business phone number via OTP
5. Grant Baari permission to send and receive messages
6. Done — test by sending "Hi" to the number

> 📌 The salon's WhatsApp number remains **owned by the salon**. Baari acts as a tech provider with delegated access. If the salon leaves Baari, they keep their WhatsApp number and all message history.

Additional WhatsApp settings:

- Greeting message (shown on first customer message)
- Away message (shown outside working hours)
- Auto-approve paid bookings: On / Off
- Payment window: 5 / 10 / 15 minutes
- Deposit percentage: 0% / 25% / 50% / 100%

### 8.5 Business Info

- Business name
- Address and city
- Google Maps link
- Instagram / Facebook handle
- Primary contact number
- NTN (National Tax Number — for SBP compliance)
- Timezone (default: Asia/Karachi)

### 8.6 Payment Settings

- Payment gateway: Safepay (recommended) / JazzCash direct / EasyPaisa direct
- Merchant credentials (encrypted at rest)
- Payout bank account IBAN for settlement
- Receipt footer text (e.g., "Thank you for visiting Saloni Studio!")

---

## 9. Authentication & Onboarding

### 9.1 Signup Flow

New salon registration — designed to complete in under 3 minutes on mobile:

1. Landing page "Get started" CTA
2. Phone number entry (Pakistan format: 03XX XXXXXXX)
3. OTP sent via SMS — 6 digits, 5-minute expiry
4. OTP entry — auto-reads SMS on Android (SMS Retriever API)
5. Business name + owner name
6. City selection (Lahore, Karachi, Islamabad, Rawalpindi, Faisalabad, Other)
7. Done — taken to dashboard. WhatsApp setup can be done now or later.

> 📌 No email required at signup. Phone number is the primary identifier. Email can be added in Settings later.

### 9.2 Login

- Phone number → OTP (passwordless — no password to forget or reset)
- Biometric login on subsequent sessions (Face ID / fingerprint via WebAuthn if PWA installed)
- Session: 7 days active. Refresh tokens extend to 30 days.

> 📱 Tested with Pakistani mobile numbers across all operators: Jazz, Telenor, Zong, Ufone, Warid.

### 9.3 Multi-User Access

Owner invites team members:

1. Enter staff member's phone number + assign role (Manager or Staff)
2. Staff member receives a WhatsApp invite message with a join link
3. They log in with their phone + OTP
4. Immediately scoped to the salon with their assigned role permissions

---

## 10. Public Booking URL

### 10.1 Purpose

Every salon on Baari gets a unique public URL: `book.baari.pk/salon-slug`

This serves customers who prefer web booking over WhatsApp, and enables salon discovery via search engines. Most traffic will arrive from Instagram bio links on mobile phones.

### 10.2 Page Content

- Salon name, logo (if uploaded), city/address
- Service menu with prices and durations
- Staff selection
- Real-time availability calendar
- Time slot picker
- Customer phone and name fields
- Payment via Safepay embedded checkout (same JazzCash / EasyPaisa / Raast options)

> 📱 The public booking page is fully responsive and designed mobile-first. All interactions work with touch. No desktop-only elements.

### 10.3 SEO

- **JSON-LD LocalBusiness schema** — enables rich results for "haircut Lahore" Google searches
- **Open Graph meta tags** — WhatsApp and Facebook share previews show salon name, photo, location
- **Server-side rendered** (Next.js SSR) — fully indexed by search engines, no client-only rendering
- **Sitemap** auto-generated for all active salon booking pages

### 10.4 Shareable Formats

- **Instagram bio link:** `book.baari.pk/salon-slug`
- **WhatsApp share:** same URL with preview card (OG tags)
- **Printable QR code:** generated in Settings, downloadable as PNG or PDF at print resolution
- **Business card format:** QR + URL, ready to send to a print shop

---

## 11. MVP Scope & Roadmap

### 11.1 MVP — Build Now (P0 / P1)

| Feature               | Description                                                                                                 | Priority |
| --------------------- | ----------------------------------------------------------------------------------------------------------- | -------- |
| WhatsApp booking flow | Multi-screen Flow inside WhatsApp. Service → Staff → Date → Time → Confirm. Real-time slot availability.    | P0       |
| Pay-first model       | Deposit via Safepay (JazzCash, EasyPaisa, Raast, Card). Slot held pending payment. Auto-release on timeout. | P0       |
| Calendar — desktop    | Day view, multi-staff columns, appointment cards, appointment panel, POS checkout.                          | P0       |
| Calendar — mobile     | Single-staff column, horizontal swipe to switch staff, bottom sheet for appointment detail.                 | P0       |
| Requests queue        | WhatsApp booking approval. Approve / Decline with auto WhatsApp response.                                   | P0       |
| Client directory      | Searchable list, profile sheet with visit history and notes.                                                | P0       |
| POS checkout          | Cash, JazzCash, EasyPaisa, Raast, Card. Discount. Confirm and complete.                                     | P0       |
| Automated reminders   | 24h + 2h WhatsApp reminder templates via BullMQ.                                                            | P0       |
| Settings — Services   | Create, edit, deactivate services. Price, duration, buffer time.                                            | P0       |
| Settings — Staff      | Add staff, set schedule, breaks, service specialisations.                                                   | P0       |
| Settings — WhatsApp   | Embedded Signup. Connect WABA. Configure deposit amount and payment window.                                 | P0       |
| Phone OTP auth        | Signup + login via phone + OTP. No passwords.                                                               | P0       |
| Public booking URL    | `book.baari.pk/[slug]`. SSR. SEO. Mobile-responsive.                                                        | P1       |
| Multi-user access     | Invite staff with role assignment via WhatsApp link.                                                        | P1       |

### 11.2 Phase 2 — After First 50 Customers

| Feature               | Description                                                                         |
| --------------------- | ----------------------------------------------------------------------------------- |
| Inventory management  | Track product stock. Alert on low levels. Cost per service calculation.             |
| Staff commission      | Auto-calculate stylist payouts. Commission % per service or revenue.                |
| Post-service feedback | WhatsApp survey after completion. Star rating. Negative feedback flagged privately. |
| Marketing campaigns   | Broadcast WhatsApp messages to opted-in clients. Discount codes.                    |
| Waitlist              | Auto-fill cancellations from waitlist. WhatsApp notification to next in line.       |
| Multi-location        | Chain management. Branch-wise calendar. Centralized reporting.                      |
| Bridal packages       | Multi-event bookings: mayun, mehndi, baraat, walima. Instalment deposit schedule.   |
| Basic reports         | Daily/weekly revenue. Staff utilisation. Popular services. Peak hours heatmap.      |

### 11.3 Phase 3 — Scale

| Feature             | Description                                                             |
| ------------------- | ----------------------------------------------------------------------- |
| Billie AI assistant | Smart replies to common WhatsApp questions. No-show prediction.         |
| Advanced analytics  | Retention rate, LTV, rebooking rate, per-staff revenue breakdown.       |
| Loyalty programme   | Points per visit. Reward tiers. Redemption via WhatsApp.                |
| Inventory financing | Credit to salon owners based on booking and revenue history.            |
| Marketplace         | Customers discover salons via baari.pk. Commission on new clients only. |

---

## 12. Booking State Machine

### 12.1 States and Transitions

```
INITIATED
    │  (slot locked in Redis, row inserted)
    ▼
PAYMENT_PENDING
    │  (payment link sent, timer running)
    ├──── payment success ──────────► CONFIRMED
    │                                     │
    │                               (reminder jobs enqueued)
    │                                     │
    │                              ┌──────┴──────┐
    │                              ▼             ▼
    │                          COMPLETED    CANCELLED
    │                         (POS done)   (salon/owner)
    │
    ├──── payment failure ──────────► FAILED ──► slot released
    └──── timeout (10 min) ─────────► EXPIRED ──► slot released
                                         │
                                      NO_SHOW
                                    (staff marks)
```

### 12.2 State Reference Table

| State               | Trigger                | What Happens                                                    |
| ------------------- | ---------------------- | --------------------------------------------------------------- |
| **INITIATED**       | Booking created        | Slot locked in Redis. Row inserted. Payment link generated.     |
| **PAYMENT_PENDING** | Payment link sent      | Customer directed to pay. 10-min timer starts.                  |
| **CONFIRMED**       | Payment IPN received   | Slot permanently locked. Reminder jobs enqueued. WhatsApp sent. |
| **COMPLETED**       | POS checkout confirmed | Payment recorded. Post-service WhatsApp sent. Revenue logged.   |
| **CANCELLED**       | Owner/manager cancels  | Slot released. Refund triggered if paid. Regret WhatsApp sent.  |
| **NO_SHOW**         | Staff marks no-show    | Deposit retained. Slot logged as lost revenue.                  |
| **EXPIRED**         | No payment in time     | Slot released. Redis lock cleared. Retry WhatsApp sent.         |

### 12.3 Concurrency Protection — Three Layers

A double-booking is architecturally impossible:

1. **Redis `SET NX PX` lock** — first request wins; all others get "slot unavailable" immediately
2. **PostgreSQL `SELECT FOR UPDATE`** — serializes concurrent DB writes for the same stylist
3. **`EXCLUDE USING GIST` constraint** — database-level rejection of overlapping time ranges

Any one layer is sufficient for correctness. Together they are belt-and-suspenders-and-rivets.

---

## 13. Notifications & Communication

### 13.1 Customer Notifications (WhatsApp)

| Message                  | Category  | Timing                                       |
| ------------------------ | --------- | -------------------------------------------- |
| Slot held — payment link | Utility   | Immediately after booking initiated          |
| Booking confirmed        | Utility   | Immediately after payment received           |
| 24-hour reminder         | Utility   | 24 hours before appointment                  |
| 2-hour reminder          | Utility   | 2 hours before appointment                   |
| Post-service thank you   | Utility   | 30 minutes after appointment completed       |
| Cancellation notice      | Utility   | Immediately on cancellation                  |
| Slot expired — try again | Utility   | 10 minutes after initiated (if no payment)   |
| Promotional broadcast    | Marketing | Owner-scheduled (Eid discount, new services) |

> 📌 All templates must be pre-approved by Meta (3–5 business days). Plan accordingly before launch. Have backup templates ready.

### 13.2 Staff Notifications (In-App)

- Push notification when a new booking is assigned (if PWA installed)
- Badge on Requests tab for pending approvals
- In-app alert when a customer checks in
- Daily schedule summary at 8am (optional, configurable)

### 13.3 Urdu Language Support

Pakistani customers respond significantly better to Urdu messages. The system supports:

- WhatsApp message templates in **both Urdu and English** — salon chooses per template
- Dashboard UI initially in English; Urdu dashboard coming in Phase 2
- **Basis Grotesque Arabic Pro** font used throughout — handles Arabic/Urdu script correctly
- Right-to-left rendering in WhatsApp Urdu messages

> 📌 Urdu reminder and confirmation templates have higher open rates with Pakistani customers. Prioritise Urdu for customer-facing messages.

---

## 14. Payments

### 14.1 Payment Architecture

Baari uses **Safepay** as the primary payment aggregator. Safepay is a licensed PSP in Pakistan and handles JazzCash, EasyPaisa, Raast, and card payments through a single integration.

> 📌 Baari **never holds customer funds**. Money flows: Customer → Safepay → Salon bank account. Baari collects its subscription fee separately via invoice. No SBP license required for Baari under this model.

### 14.2 Payment Methods

| Method                | How It Works                              | Settlement | Coverage                       |
| --------------------- | ----------------------------------------- | ---------- | ------------------------------ |
| **JazzCash**          | Customer enters MSISDN + MPIN in checkout | T+1        | ~35M active wallets            |
| **EasyPaisa**         | Customer enters phone + OTP confirmation  | T+1        | Telenor customers nationwide   |
| **Raast QR**          | Customer scans EMVCo QR with any bank app | Instant    | All bank apps supporting Raast |
| **Debit/Credit Card** | Visa/Mastercard with 3DS                  | T+2        | Growing in urban Pakistan      |

### 14.3 Deposit Model

Configurable per salon:

| Setting     | Description                                   | Recommended For                 |
| ----------- | --------------------------------------------- | ------------------------------- |
| 0% deposit  | Full payment at salon. No prepayment.         | Walk-in focused salons          |
| 25% deposit | Partial upfront. Most common for new clients. | General use                     |
| 50% deposit | Standard for bridal and high-value services.  | Premium salons                  |
| 100%        | Full prepayment required.                     | VIP bookings, frequent no-shows |

The remaining balance after deposit is collected at the salon via POS at checkout.

### 14.4 Refund Policy (Configurable Defaults)

| Scenario                      | Default Refund                                        |
| ----------------------------- | ----------------------------------------------------- |
| Salon cancels > 24h before    | Full refund automatically triggered                   |
| Salon cancels < 24h before    | Full refund + courtesy credit                         |
| Customer cancels > 24h before | Full refund (configurable — some salons keep deposit) |
| Customer cancels < 24h before | Deposit forfeited                                     |
| No Show                       | Deposit forfeited automatically                       |

> ⚠️ Refund policy is configurable per salon in Settings. Salons should communicate their cancellation policy clearly in their WhatsApp greeting message.

---

## 15. Technical Notes

### 15.1 Stack

| Layer       | Choice                                 | Reason                                      |
| ----------- | -------------------------------------- | ------------------------------------------- |
| Frontend    | Next.js 15, App Router, TypeScript     | SSR for public booking pages + dashboard    |
| Backend API | Fastify, Node 20, TypeScript           | I/O-bound, schema-first, shared types       |
| Database    | PostgreSQL self-hosted                 | RLS for tenant isolation, EXCLUDE GIST      |
| ORM         | Drizzle ORM                            | First-class RLS, zero codegen, 7KB bundle   |
| Queue       | BullMQ on Redis/Valkey                 | Reminders, expiry jobs, WhatsApp automation |
| Payments    | Safepay → JazzCash + EasyPaisa + Raast | Single integration, licensed PSP            |
| WhatsApp    | Meta Cloud API via 360dialog           | Multi-tenant WABA, Flows, per-tenant tokens |
| Infra MVP   | DigitalOcean Droplet s-2vcpu-4gb       | ~$49/mo, Docker Compose, Caddy auto-SSL     |
| CDN/DNS     | Cloudflare Free                        | DDoS, SSL, CDN, zero cost                   |

### 15.2 Data Rules

These rules are non-negotiable throughout the codebase:

- All money stored as **paisa (PKR × 100) in BIGINT** — never floating point
- All times stored as **TIMESTAMPTZ in UTC** — displayed in Asia/Karachi timezone
- All tenant IDs come from **JWT `tid` claim** — never from request body or URL params
- Every DB query goes through **`withTenant()`** — RLS enforces isolation at DB level
- Slot overlap prevented by **`EXCLUDE USING GIST`** constraint on bookings table
- Payment webhooks are **idempotent** — deduplicated on `txn_ref` with row-level lock

### 15.3 Infrastructure Cost (MVP)

| Component                               | Provider                   | Monthly USD     |
| --------------------------------------- | -------------------------- | --------------- |
| Droplet s-2vcpu-4gb (API + Web + Redis) | DigitalOcean               | $24             |
| Managed PostgreSQL (1vCPU, 1GB)         | DigitalOcean               | $15             |
| Spaces 250GB + CDN                      | DigitalOcean               | $5              |
| Droplet backups (weekly)                | DigitalOcean               | $4.80           |
| CDN, DDoS, SSL, DNS                     | Cloudflare Free            | $0              |
| Error monitoring                        | Sentry Free (5K errors/mo) | $0              |
| WhatsApp BSP                            | 360dialog (~$5–10/number)  | $5–10 per salon |
| **Total base infra (first 50 salons)**  |                            | **~$49–109/mo** |

Break-even at **2–4 paying salons** at the PKR 2,499/mo Pro tier.

### 15.4 Pricing Tiers

| Tier           | PKR/Month | USD  | Target                                                 |
| -------------- | --------- | ---- | ------------------------------------------------------ |
| **Starter**    | Free      | $0   | Solo barbers, home artists, ≤50 bookings/mo            |
| **Pro**        | 2,499     | ~$9  | Small/mid salons, 1–5 staff, unlimited bookings        |
| **Business**   | 6,999     | ~$25 | Mid-large, 6–15 staff, inventory + multi-location lite |
| **Enterprise** | Custom    | —    | Chains, white-label, API access                        |

Variable revenue: **1–1.5% payment rake** on transactions processed. **20–25% margin** on WhatsApp BSP message resale.

---

_Confidential · Internal Product Document · Baari · باری · v1.0 · May 2026_
