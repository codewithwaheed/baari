// apps/api/src/lib/bookings/create.ts
// Core booking creation — three-layer integrity:
//   1. Redis SET NX PX slot lock
//   2. PostgreSQL SELECT FOR UPDATE on staff row
//   3. EXCLUDE GIST constraint (database-level final word)
//
// Multi-service: caller passes serviceIds[]; server fetches prices/durations,
// computes totalPricePaisa + endTime, inserts booking_services in same tx.

import { eq, inArray } from 'drizzle-orm';
import { withTenant, schema } from '@baari/db';
import { acquireSlotLock, releaseSlotLock } from '../redis/client';
import { bookingExpiryQueue } from '../../workers/queues';

export class SlotUnavailableError extends Error {
  constructor() { super('Slot is unavailable'); this.name = 'SlotUnavailableError'; }
}

export class ServiceNotFoundError extends Error {
  constructor(id: string) { super(`Service not found: ${id}`); this.name = 'ServiceNotFoundError'; }
}

interface CreateBookingInput {
  tenantId:   string;
  locationId?: string;
  staffId:    string;
  /** Ordered list of service IDs — server fetches price/duration for each */
  serviceIds: string[];
  customerId: string;
  startTime:  Date;
  source:     'manual' | 'whatsapp' | 'web';
  notes?:     string;
}

export async function createBooking(input: CreateBookingInput) {
  const startIso = input.startTime.toISOString();

  // ── Resolve services inside a tenant context ─────────────────────────────
  // Fetch in a throw-away tx so we can compute endTime before acquiring the lock.
  const resolvedServices = await withTenant(input.tenantId, async (tx) => {
    const rows = await tx
      .select({
        id:          schema.services.id,
        durationMin: schema.services.durationMin,
        pricePaisa:  schema.services.pricePaisa,
      })
      .from(schema.services)
      .where(inArray(schema.services.id, input.serviceIds));

    // Validate every requested service was found (and belongs to tenant via RLS)
    for (const id of input.serviceIds) {
      if (!rows.find(r => r.id === id)) throw new ServiceNotFoundError(id);
    }

    // Preserve caller-specified order
    return input.serviceIds.map(id => rows.find(r => r.id === id)!);
  });

  const totalDurationMin = resolvedServices.reduce((s, r) => s + r.durationMin, 0);
  const totalPricePaisa  = resolvedServices.reduce((s, r) => s + r.pricePaisa, 0);
  const endTime = new Date(input.startTime.getTime() + totalDurationMin * 60 * 1000);

  // ── Layer 1: Redis slot lock ──────────────────────────────────────────────
  const lockToken = await acquireSlotLock(input.tenantId, input.staffId, startIso);
  if (!lockToken) throw new SlotUnavailableError();

  try {
    // ── Layer 2: DB transaction with SELECT FOR UPDATE ────────────────────
    const booking = await withTenant(input.tenantId, async (tx) => {
      // Lock the staff row to serialize concurrent bookings for same stylist
      await tx.select().from(schema.staff)
        .where(eq(schema.staff.id, input.staffId))
        .for('update');

      // Insert booking — Layer 3 (EXCLUDE GIST) fires here if overlap exists.
      // service_id = primary (first) service for backward compat with existing queries.
      const [booking] = await tx.insert(schema.bookings).values({
        tenantId:   input.tenantId,
        locationId: input.locationId,
        staffId:    input.staffId,
        serviceId:  resolvedServices[0]!.id,
        customerId: input.customerId,
        startTime:  input.startTime,
        endTime,
        pricePaisa: totalPricePaisa,
        source:     input.source,
        notes:      input.notes ?? '',
        state:      'CONFIRMED',
      }).returning();

      if (!booking) throw new Error('Booking insert returned no rows');

      // Insert one row per service in order
      await tx.insert(schema.bookingServices).values(
        resolvedServices.map((svc, i) => ({
          bookingId:   booking.id,
          tenantId:    input.tenantId,
          serviceId:   svc.id,
          durationMin: svc.durationMin,
          pricePaisa:  svc.pricePaisa,
          sortOrder:   i,
        }))
      );

      return booking;
    });

    // ── Enqueue expiry job (no-op for CONFIRMED, but keeps the lock cleanup) ─
    await bookingExpiryQueue.add(
      'expire-unpaid',
      { bookingId: booking.id, tenantId: input.tenantId, lockToken, staffId: input.staffId, startIso },
      { delay: 10 * 60 * 1000, attempts: 1 },
    );

    return booking;

  } catch (err) {
    // Release lock immediately on any error so slot becomes bookable again
    await releaseSlotLock(input.tenantId, input.staffId, startIso, lockToken);
    throw err;
  }
}
