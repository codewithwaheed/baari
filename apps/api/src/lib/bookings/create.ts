// apps/api/src/lib/bookings/create.ts
// Core booking creation — three-layer integrity:
//   1. Redis SET NX PX slot lock
//   2. PostgreSQL SELECT FOR UPDATE on staff row
//   3. EXCLUDE GIST constraint (database-level final word)

import { eq } from 'drizzle-orm';
import { withTenant, schema } from '@baari/db';
import { acquireSlotLock, releaseSlotLock } from '../redis/client';
import { bookingExpiryQueue } from '../../workers/queues';

export class SlotUnavailableError extends Error {
  constructor() { super('Slot is unavailable'); this.name = 'SlotUnavailableError'; }
}

interface CreateBookingInput {
  tenantId: string;
  locationId?: string;
  staffId: string;
  serviceId: string;
  customerId: string;
  startTime: Date;
  endTime: Date;
  pricePaisa: number;
  source: 'manual' | 'whatsapp' | 'web';
  notes?: string;
}

export async function createBooking(input: CreateBookingInput) {
  const startIso = input.startTime.toISOString();

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

      // Insert booking — Layer 3 (EXCLUDE GIST) fires here if overlap exists
      const [booking] = await tx.insert(schema.bookings).values({
        tenantId:   input.tenantId,
        locationId: input.locationId,
        staffId:    input.staffId,
        serviceId:  input.serviceId,
        customerId: input.customerId,
        startTime:  input.startTime,
        endTime:    input.endTime,
        pricePaisa: input.pricePaisa,
        source:     input.source,
        notes:      input.notes ?? '',
        state:      'INITIATED',
      }).returning();

      if (!booking) throw new Error('Booking insert returned no rows');
      return booking;
    });

    // ── Enqueue expiry job (release lock if payment not received in 10min) ─
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
