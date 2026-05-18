// apps/api/src/workers/reminder.worker.ts
// Sends WhatsApp reminder messages before appointments.
// 24h reminder (utility template — FREE if inside 24hr service window)
// 1h reminder (utility template)

import { Worker } from 'bullmq';
import { redis } from '../lib/redis/client';
import { withTenant, schema } from '@baari/db';
import { eq, and } from 'drizzle-orm';
// import { sendWhatsAppTemplate } from '../lib/whatsapp/client';

export const reminderWorker = new Worker(
  'whatsapp-reminder',
  async (job) => {
    const { bookingId, tenantId, type } = job.data as {
      bookingId: string;
      tenantId: string;
      type: '24h' | '1h';
    };

    const booking = await withTenant(tenantId, async (tx) => {
      const [b] = await tx.select().from(schema.bookings)
        .where(and(
          eq(schema.bookings.id, bookingId),
          eq(schema.bookings.tenantId, tenantId),
        ));
      return b;
    });

    if (!booking) return;
    if (booking.state !== 'CONFIRMED') return; // cancelled/completed — skip

    // TODO: implement sendWhatsAppTemplate
    // await sendWhatsAppTemplate(tenantId, {
    //   to: customer.phoneE164,
    //   template: type === '24h' ? 'appointment_reminder_24h' : 'appointment_reminder_1h',
    //   params: [customerName, serviceName, formattedTime],
    // });

    console.log(`[reminder] ${type} reminder sent for booking ${bookingId}`);
  },
  {
    connection: redis,
    concurrency: 10,
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: 'exponential', delay: 60_000 },
    },
  },
);

reminderWorker.on('failed', (job, err) => {
  console.error(`[reminder-worker] job ${job?.id} failed:`, err.message);
});
