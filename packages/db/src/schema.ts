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
  timestamp, uniqueIndex, index, check, customType, jsonb,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// citext — case-insensitive text (for slug, email)
const citext = customType<{ data: string }>({
  dataType() { return 'citext'; },
});

// ─── Tenants ──────────────────────────────────────────────────────────────────
// One row per salon business. This is the root of all multi-tenancy.

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
  address:            text('address'),
  googleMapsUrl:      text('google_maps_url'),
  instagramHandle:    text('instagram_handle'),
  contactPhone:       text('contact_phone'),
  advanceBookingDays: integer('advance_booking_days').notNull().default(30),
  slotIntervalMin:    integer('slot_interval_min').notNull().default(30),
  paymentSettings:    jsonb('payment_settings').$type<{
    iban?: string;
    depositPercent?: number;
    safepayKey?: string;
    jazzcashMerchantId?: string;
    easypaisaStoreId?: string;
  }>(),
  publicHolidays:     jsonb('public_holidays').$type<string[]>().notNull().default([]),
  logoUrl:            text('logo_url'),
  createdAt:          timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:          timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
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
  avatarUrl:         text('avatar_url'),
  isActive:          boolean('is_active').notNull().default(true),
  workSchedule:      jsonb('work_schedule').$type<Record<string, {
    isOpen: boolean;
    openTime: string;
    closeTime: string;
    breaks: Array<{ from: string; to: string }>;
  }>>(),
  specialisationIds: jsonb('specialisation_ids').$type<string[]>(),
  createdAt:         timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
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
    'INITIATED','PAYMENT_PENDING','CONFIRMED','CHECKED_IN','COMPLETED',
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
  // All selected service IDs (including primary). Empty array = legacy single-service row.
  serviceIds:  text('service_ids').array().notNull().default(sql`'{}'::text[]`),
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
  // Partial index: phone must be globally unique but only when set
  uniqueIndex('users_phone_uniq').on(t.phoneE164).where(sql`phone_e164 IS NOT NULL`),
  index('users_tenant_idx').on(t.tenantId),
  check('users_role_chk', sql`role IN ('owner','manager','staff')`),
]);

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
  breaks:      jsonb('breaks').$type<Array<{ from: string; to: string }>>().notNull().default([]),
}, t => [
  // Two partial indexes instead of one UNIQUE — Postgres treats all NULLs as distinct
  // in a plain UNIQUE constraint, so location_id IS NULL rows would never collide.
  uniqueIndex('working_hours_tenant_loc_day_uniq').on(t.tenantId, t.locationId, t.dayOfWeek).where(sql`location_id IS NOT NULL`),
  uniqueIndex('working_hours_tenant_day_null_uniq').on(t.tenantId, t.dayOfWeek).where(sql`location_id IS NULL`),
  index('working_hours_tenant_idx').on(t.tenantId),
  check('working_hours_day_chk', sql`day_of_week BETWEEN 0 AND 6`),
]);

// ─── Booking Services ─────────────────────────────────────────────────────────
// Junction table — one row per service within a booking session.
// bookings.service_id still points to services[0] (primary) for backward compat.
// bookings.price_paisa is the SUM of all service prices here.

export const bookingServices = pgTable('booking_services', {
  id:          uuid('id').primaryKey().defaultRandom(),
  bookingId:   uuid('booking_id').notNull().references(() => bookings.id, { onDelete: 'cascade' }),
  tenantId:    uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  serviceId:   uuid('service_id').notNull().references(() => services.id),
  durationMin: integer('duration_min').notNull(),
  pricePaisa:  bigint('price_paisa', { mode: 'number' }).notNull(),
  sortOrder:   integer('sort_order').notNull().default(0),
  createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [
  index('booking_services_booking_idx').on(t.bookingId),
  index('booking_services_tenant_idx').on(t.tenantId),
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
export type RefreshToken   = typeof refreshTokens.$inferSelect;
export type OtpLog         = typeof otpLog.$inferSelect;
export type TeamInvite     = typeof teamInvites.$inferSelect;
export type WorkingHours   = typeof workingHours.$inferSelect;
export type BookingService = typeof bookingServices.$inferSelect;

export type BookingState   = 'INITIATED' | 'PAYMENT_PENDING' | 'CONFIRMED' | 'CHECKED_IN' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW' | 'EXPIRED';
export type BookingSource  = 'manual' | 'whatsapp' | 'web';
export type PaymentGateway = 'jazzcash' | 'easypaisa' | 'raast' | 'card' | 'cash' | 'safepay';
export type UserRole       = 'owner' | 'manager' | 'staff';
export type TenantPlan     = 'free' | 'pro' | 'business' | 'enterprise';
