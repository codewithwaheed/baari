// apps/api/src/workers/expiry.worker.ts
// Releases slot locks and expires bookings where payment was not received.

import { Worker } from 'bullmq';
import { eq, and } from 'drizzle-orm';
import { redis } from '../lib/redis/client';
import { withTenant, schema } from '@baari/db';
import { releaseSlotLock } from '../lib/redis/client';

export const expiryWorker = new Worker(
  'booking-expiry',
  async (job) => {
    const { bookingId, tenantId, lockToken, staffId, startIso } = job.data as {
      bookingId: string;
      tenantId: string;
      lockToken: string;
      staffId: string;
      startIso: string;
    };

    await withTenant(tenantId, async (tx) => {
      // Lock the booking row to prevent race with simultaneous IPN
      const [booking] = await tx.select().from(schema.bookings)
        .where(and(
          eq(schema.bookings.id, bookingId),
          eq(schema.bookings.tenantId, tenantId),
        ))
        .for('update');

      if (!booking) return; // booking was deleted

      // Only expire if still waiting for payment
      if (booking.state !== 'PAYMENT_PENDING' && booking.state !== 'INITIATED') {
        return; // already confirmed or otherwise resolved — do nothing
      }

      await tx.update(schema.bookings)
        .set({ state: 'EXPIRED', updatedAt: new Date() })
        .where(eq(schema.bookings.id, bookingId));
    });

    // Release Redis lock regardless (TTL may have already expired — that's fine)
    await releaseSlotLock(tenantId, staffId, startIso, lockToken);
  },
  { connection: redis, concurrency: 20 },
);

expiryWorker.on('failed', (job, err) => {
  console.error(`[expiry-worker] job ${job?.id} failed:`, err.message);
});
