// packages/db/src/schema.ts
// ============================================================
// Baari — Drizzle Schema
// THE SOURCE OF TRUTH. All data shapes flow from this file.
//
// Rules:
//   - Money:  always stored as paisa (PKR × 100) in BIGINT
//   - Time:   always TIMESTAMPTZ, display in Asia/Karachi
//   - Tenant: tenant_id on every row, RLS on every table
//   - IDs:    UUID v4 everywhere
// ============================================================

import {
  pgTable, uuid, text, boolean, integer, bigint,
  timestamp, uniqueIndex, index, check, customType,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// citext — case-insensitive text (for slug, email)
const citext = customType<{ data: string }>({
  dataType() { return 'citext'; },
});

// ─── Tenants ──────────────────────────────────────────────────────────────────
// One row per salon business. This is the root of all multi-tenancy.

export const tenants = pgTable('tenants', {
  id:        uuid('id').primaryKey().defaultRandom(),
  slug:      citext('slug').notNull().unique(),            // URL-safe: "ruma-lahore"
  name:      text('name').notNull(),                       // Display: "RUMA Aesthetics"
  country:   text('country').notNull().default('PK'),
  timezone:  text('timezone').notNull().default('Asia/Karachi'),
  plan:      text('plan').notNull().default('free'),       // free | pro | business | enterprise
  status:    text('status').notNull().default('active'),   // active | suspended | churned

  // WhatsApp Business Account — set during Embedded Signup
  waPhoneId: text('wa_phone_id').unique(),                 // Meta phone_number_id (routing key)
  waWabaId:  text('wa_waba_id'),
  waToken:   text('wa_token'),                             // System User token — ENCRYPT AT REST

  // Onboarding
  ntn:       text('ntn'),                                  // National Tax Number (SBP KYC)

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── Locations ────────────────────────────────────────────────────────────────
// A tenant can have multiple branches. MVP: single location per tenant.

export const locations = pgTable('locations', {
  id:        uuid('id').primaryKey().defaultRandom(),
  tenantId:  uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name:      text('name').notNull(),
  address:   text('address'),
  city:      text('city'),
  timezone:  text('timezone').notNull().default('Asia/Karachi'),
  isActive:  boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [
  index('locations_tenant_idx').on(t.tenantId),
]);

// ─── Staff ────────────────────────────────────────────────────────────────────

export const staff = pgTable('staff', {
  id:         uuid('id').primaryKey().defaultRandom(),
  tenantId:   uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  locationId: uuid('location_id').references(() => locations.id),
  name:       text('name').notNull(),
  role:       text('role').notNull().default('stylist'),   // stylist | colorist | esthetician | barber | nail_tech | manager
  avatarUrl:  text('avatar_url'),
  isActive:   boolean('is_active').notNull().default(true),
  createdAt:  timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [
  index('staff_tenant_idx').on(t.tenantId),
]);

// ─── Services ─────────────────────────────────────────────────────────────────

export const services = pgTable('services', {
  id:          uuid('id').primaryKey().defaultRandom(),
  tenantId:    uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name:        text('name').notNull(),
  category:    text('category'),                           // hair | skin | nails | makeup | other
  durationMin: integer('duration_min').notNull(),          // appointment slot length
  pricePaisa:  bigint('price_paisa', { mode: 'number' }).notNull(), // PKR × 100
  bufferMin:   integer('buffer_min').notNull().default(0), // sanitation gap after service
  isActive:    boolean('is_active').notNull().default(true),
  createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [
  index('services_tenant_idx').on(t.tenantId),
]);

// ─── Customers ────────────────────────────────────────────────────────────────
// Per-tenant — no cross-tenant leakage. Same phone can exist in two tenants.

export const customers = pgTable('customers', {
  id:        uuid('id').primaryKey().defaultRandom(),
  tenantId:  uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  phoneE164: text('phone_e164').notNull(),                 // +92XXXXXXXXXX
  name:      text('name'),
  waOptIn:   boolean('wa_opt_in').notNull().default(true),
  notes:     text('notes').notNull().default(''),
  isVip:     boolean('is_vip').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [
  uniqueIndex('customers_tenant_phone_uniq').on(t.tenantId, t.phoneE164),
  index('customers_tenant_idx').on(t.tenantId),
]);

// ─── Bookings ─────────────────────────────────────────────────────────────────
// State machine: INITIATED → PAYMENT_PENDING → CONFIRMED → COMPLETED
//                                            ↓              ↓
//                                         EXPIRED       CANCELLED | NO_SHOW
//
// Overlap prevention via EXCLUDE GIST on the `slot` generated column.
// See migration 0001 for the constraint SQL.

export const bookings = pgTable('bookings', {
  id:         uuid('id').primaryKey().defaultRandom(),
  tenantId:   uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  locationId: uuid('location_id').references(() => locations.id),
  staffId:    uuid('staff_id').notNull().references(() => staff.id),
  serviceId:  uuid('service_id').notNull().references(() => services.id),
  customerId: uuid('customer_id').notNull().references(() => customers.id),

  startTime:  timestamp('start_time', { withTimezone: true }).notNull(),
  endTime:    timestamp('end_time', { withTimezone: true }).notNull(),
  // slot TSTZRANGE is added in migration 0001 as a generated column:
  // ALTER TABLE bookings ADD COLUMN slot TSTZRANGE
  //   GENERATED ALWAYS AS (tstzrange(start_time, end_time, '[)')) STORED;

  state:      text('state').notNull().default('INITIATED'),
  pricePaisa: bigint('price_paisa', { mode: 'number' }).notNull(),
  notes:      text('notes').notNull().default(''),
  source:     text('source').notNull().default('manual'),  // manual | whatsapp | web
  version:    integer('version').notNull().default(0),     // optimistic lock for edits

  createdAt:  timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:  timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [
  index('bookings_tenant_idx').on(t.tenantId),
  index('bookings_staff_start_idx').on(t.staffId, t.startTime),
  index('bookings_customer_idx').on(t.customerId),
  index('bookings_state_idx').on(t.state),
  check('bookings_state_chk', sql`state IN (
    'INITIATED','PAYMENT_PENDING','CONFIRMED','COMPLETED',
    'CANCELLED','NO_SHOW','EXPIRED'
  )`),
  check('bookings_source_chk', sql`source IN ('manual','whatsapp','web')`),
  check('bookings_time_chk', sql`end_time > start_time`),
]);

// ─── Payments ─────────────────────────────────────────────────────────────────
// One payment attempt per booking (retry = new payment row).
// txn_ref is the gateway's transaction ID — use as idempotency key.

export const payments = pgTable('payments', {
  id:           uuid('id').primaryKey().defaultRandom(),
  bookingId:    uuid('booking_id').notNull().references(() => bookings.id),
  tenantId:     uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  gateway:      text('gateway').notNull(),                 // jazzcash|easypaisa|raast|card|cash|safepay
  txnRef:       text('txn_ref').notNull().unique(),        // gateway txn ID — dedupe key
  amountPaisa:  bigint('amount_paisa', { mode: 'number' }).notNull(),
  state:        text('state').notNull().default('PENDING'),// PENDING|SUCCESS|FAILED|REFUNDED
  rawResponse:  text('raw_response'),                      // full gateway JSON (for debugging)
  createdAt:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:    timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [
  index('payments_booking_idx').on(t.bookingId),
  index('payments_tenant_idx').on(t.tenantId),
  check('payments_gateway_chk', sql`gateway IN ('jazzcash','easypaisa','raast','card','cash','safepay')`),
  check('payments_state_chk', sql`state IN ('PENDING','SUCCESS','FAILED','REFUNDED')`),
]);

// ─── Booking Requests ─────────────────────────────────────────────────────────
// WhatsApp booking requests awaiting owner approval.
// Approved requests create a booking. Declined requests are deleted.

export const bookingRequests = pgTable('booking_requests', {
  id:          uuid('id').primaryKey().defaultRandom(),
  tenantId:    uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  customerId:  uuid('customer_id').notNull().references(() => customers.id),
  serviceId:   uuid('service_id').notNull().references(() => services.id),
  staffId:     uuid('staff_id').references(() => staff.id),
  requestedAt: timestamp('requested_at', { withTimezone: true }).notNull(),
  requestedPricePaisa: bigint('requested_price_paisa', { mode: 'number' }).notNull(),
  paid:        boolean('paid').notNull().default(false),
  paymentTxnRef: text('payment_txn_ref'),
  state:       text('state').notNull().default('pending'),  // pending|approved|declined
  createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [
  index('booking_requests_tenant_idx').on(t.tenantId),
  index('booking_requests_state_idx').on(t.state),
]);

// ─── Users ────────────────────────────────────────────────────────────────────
// Dashboard accounts for salon owners, managers, staff.

export const users = pgTable('users', {
  id:        uuid('id').primaryKey().defaultRandom(),
  tenantId:  uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  staffId:   uuid('staff_id').references(() => staff.id), // null for owner/admin users
  email:     citext('email').notNull(),
  name:      text('name').notNull(),
  role:      text('role').notNull().default('staff'),      // owner | manager | staff
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [
  uniqueIndex('users_tenant_email_uniq').on(t.tenantId, t.email),
  index('users_tenant_idx').on(t.tenantId),
  check('users_role_chk', sql`role IN ('owner','manager','staff')`),
]);

// ─── Type exports ─────────────────────────────────────────────────────────────

export type Tenant         = typeof tenants.$inferSelect;
export type TenantInsert   = typeof tenants.$inferInsert;
export type Location       = typeof locations.$inferSelect;
export type Staff          = typeof staff.$inferSelect;
export type Service        = typeof services.$inferSelect;
export type Customer       = typeof customers.$inferSelect;
export type Booking        = typeof bookings.$inferSelect;
export type Payment        = typeof payments.$inferSelect;
export type BookingRequest = typeof bookingRequests.$inferSelect;
export type User           = typeof users.$inferSelect;

export type BookingState   = 'INITIATED' | 'PAYMENT_PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW' | 'EXPIRED';
export type BookingSource  = 'manual' | 'whatsapp' | 'web';
export type PaymentGateway = 'jazzcash' | 'easypaisa' | 'raast' | 'card' | 'cash' | 'safepay';
export type UserRole       = 'owner' | 'manager' | 'staff';
export type TenantPlan     = 'free' | 'pro' | 'business' | 'enterprise';
