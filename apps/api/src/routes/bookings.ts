// apps/api/src/routes/bookings.ts
// Booking CRUD — all routes are tenant-scoped via JWT tid claim.

import type { FastifyInstance } from 'fastify';
import { eq, and, gte, lte } from 'drizzle-orm';
import { z } from 'zod';
import { withTenant, schema } from '@baari/db';
import type { JWTPayload } from '@baari/types';
import { createBooking, SlotUnavailableError } from '../lib/bookings/create';

const CreateBookingSchema = z.object({
  staffId:    z.string().uuid(),
  serviceId:  z.string().uuid(),
  customerId: z.string().uuid(),
  startTime:  z.string().datetime(),
  endTime:    z.string().datetime(),
  pricePaisa: z.number().int().positive(),
  source:     z.enum(['manual', 'whatsapp', 'web']).default('manual'),
  notes:      z.string().optional(),
  locationId: z.string().uuid().optional(),
});

export default async function bookingRoutes(app: FastifyInstance) {
  // All routes require auth
  app.addHook('onRequest', (app as any).authenticate);

  // ── GET /bookings?date=YYYY-MM-DD ──────────────────────────────────────────
  app.get('/', async (request, reply) => {
    const jwt = request.user as JWTPayload;
    const { date } = request.query as { date?: string };

    const dayStart = date ? new Date(`${date}T00:00:00+05:00`) : new Date();
    const dayEnd   = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

    const bookings = await withTenant(jwt.tid, async (tx) =>
      tx.select().from(schema.bookings)
        .where(and(
          eq(schema.bookings.tenantId, jwt.tid),
          gte(schema.bookings.startTime, dayStart),
          lte(schema.bookings.startTime, dayEnd),
        ))
    );

    return { ok: true, data: bookings };
  });

  // ── POST /bookings ─────────────────────────────────────────────────────────
  app.post('/', async (request, reply) => {
    const jwt = request.user as JWTPayload;

    const body = CreateBookingSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ ok: false, error: body.error });

    try {
      const booking = await createBooking({
        tenantId:   jwt.tid,
        ...body.data,
        startTime: new Date(body.data.startTime),
        endTime:   new Date(body.data.endTime),
      });
      return reply.code(201).send({ ok: true, data: booking });
    } catch (err) {
      if (err instanceof SlotUnavailableError) {
        return reply.code(409).send({ ok: false, error: { code: 'SLOT_UNAVAILABLE', message: 'This slot is already taken' } });
      }
      throw err;
    }
  });

  // ── PATCH /bookings/:id/status ─────────────────────────────────────────────
  app.patch('/:id/status', async (request, reply) => {
    const jwt = request.user as JWTPayload;
    const { id } = request.params as { id: string };
    const { state } = request.body as { state: string };

    const allowed = ['checkedIn', 'COMPLETED', 'NO_SHOW', 'CANCELLED'] as const;
    if (!allowed.includes(state as any)) {
      return reply.code(400).send({ ok: false, error: { code: 'INVALID_STATE', message: 'Invalid state transition' } });
    }

    const [booking] = await withTenant(jwt.tid, async (tx) =>
      tx.update(schema.bookings)
        .set({ state, updatedAt: new Date() })
        .where(and(
          eq(schema.bookings.id, id),
          eq(schema.bookings.tenantId, jwt.tid),
        ))
        .returning()
    );

    if (!booking) return reply.code(404).send({ ok: false, error: { code: 'NOT_FOUND', message: 'Booking not found' } });
    return { ok: true, data: booking };
  });
}
