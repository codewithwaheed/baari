// apps/api/src/routes/bookings.ts
// Booking routes — all are tenant-scoped via JWT tid claim.
//
// State machine (DB uses uppercase, frontend uses camelCase — normalised here):
//   CONFIRMED     → confirmed
//   CHECKED_IN    → checkedIn
//   PAYMENT_PENDING → pendingPayment
//   COMPLETED     → completed
//   NO_SHOW       → noShow
//   INITIATED / CANCELLED / EXPIRED → treated as confirmed for display

import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { eq, and, gte, lte } from 'drizzle-orm';
import { z } from 'zod';
import { withTenant, schema } from '@baari/db';
import type { JWTPayload } from '@baari/types';
import { createBooking, SlotUnavailableError } from '../lib/bookings/create';

// ─── State normalisation ──────────────────────────────────────────────────────

type FrontendStatus = 'confirmed' | 'checkedIn' | 'pendingPayment' | 'completed' | 'noShow';

function toFrontendStatus(dbState: string): FrontendStatus {
  switch (dbState) {
    case 'CONFIRMED':      return 'confirmed';
    case 'CHECKED_IN':     return 'checkedIn';
    case 'PAYMENT_PENDING':return 'pendingPayment';
    case 'COMPLETED':      return 'completed';
    case 'NO_SHOW':        return 'noShow';
    default:               return 'confirmed'; // INITIATED, CANCELLED, EXPIRED
  }
}

function toDbState(frontendStatus: string): string {
  switch (frontendStatus) {
    case 'confirmed':       return 'CONFIRMED';
    case 'checkedIn':       return 'CHECKED_IN';
    case 'pendingPayment':  return 'PAYMENT_PENDING';
    case 'completed':       return 'COMPLETED';
    case 'noShow':          return 'NO_SHOW';
    case 'cancelled':       return 'CANCELLED';
    default:                return frontendStatus; // allow raw DB state too
  }
}

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  CONFIRMED:       ['CHECKED_IN', 'NO_SHOW', 'CANCELLED'],
  CHECKED_IN:      ['COMPLETED', 'NO_SHOW', 'CANCELLED'],
  PAYMENT_PENDING: ['CONFIRMED', 'CANCELLED', 'EXPIRED'],
  COMPLETED:       [],
  NO_SHOW:         [],
  CANCELLED:       [],
  EXPIRED:         [],
  INITIATED:       ['PAYMENT_PENDING', 'CONFIRMED', 'CHECKED_IN', 'NO_SHOW', 'CANCELLED'],
};

// ─── Input schemas ────────────────────────────────────────────────────────────

const CreateBookingSchema = z.object({
  staffId:    z.string().uuid(),
  serviceId:  z.string().uuid(),
  customerId: z.string().uuid(),
  startTime:  z.string().datetime({ offset: true }),
  endTime:    z.string().datetime({ offset: true }),
  pricePaisa: z.number().int().positive(),
  source:     z.enum(['manual', 'whatsapp', 'web']).default('manual'),
  notes:      z.string().optional(),
  locationId: z.string().uuid().optional(),
});

const StatusSchema = z.object({
  // Accept both camelCase frontend statuses and raw uppercase DB states
  state: z.string().min(1),
});

// ─── Routes ───────────────────────────────────────────────────────────────────

export default async function bookingRoutes(app: FastifyInstance) {
  app.addHook('onRequest', (app as any).authenticate);

  // ── GET /bookings?date=YYYY-MM-DD ──────────────────────────────────────────
  // Returns bookings for the tenant on a given day, joined with staff/service/customer.
  // Defaults to today (Asia/Karachi) if no date is provided.
  app.get('/', async (request, reply) => {
    const jwt = request.user as JWTPayload;
    const { date } = request.query as { date?: string };

    const dayStart = date
      ? new Date(`${date}T00:00:00+05:00`)
      : new Date(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' }) + 'T00:00:00+05:00');
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

    const rows = await withTenant(jwt.tid, async (tx) =>
      tx
        .select({
          id:                schema.bookings.id,
          staffId:           schema.bookings.staffId,
          customerId:        schema.bookings.customerId,
          staffName:         schema.staff.name,
          staffRole:         schema.staff.role,
          clientName:        schema.customers.name,
          clientPhone:       schema.customers.phoneE164,
          customerNotes:     schema.customers.notes,
          customerCreatedAt: schema.customers.createdAt,
          serviceName:       schema.services.name,
          startTime:         schema.bookings.startTime,
          endTime:           schema.bookings.endTime,
          state:             schema.bookings.state,
          pricePaisa:        schema.bookings.pricePaisa,
          source:            schema.bookings.source,
        })
        .from(schema.bookings)
        .innerJoin(schema.staff,     eq(schema.bookings.staffId,    schema.staff.id))
        .innerJoin(schema.services,  eq(schema.bookings.serviceId,  schema.services.id))
        .innerJoin(schema.customers, eq(schema.bookings.customerId, schema.customers.id))
        .where(and(
          eq(schema.bookings.tenantId, jwt.tid),
          gte(schema.bookings.startTime, dayStart),
          lte(schema.bookings.startTime, dayEnd),
        ))
    );

    // Normalise to frontend-friendly shape.
    // dayStart is Karachi midnight expressed as UTC (e.g. 2026-05-20T00:00+05:00 = 2026-05-19T19:00Z).
    // The difference (startMs - midnight) already gives Karachi-local hours — no extra offset needed.
    const midnightMs = dayStart.getTime();
    const data = rows.map(r => {
      const startMs   = r.startTime.getTime();
      const endMs     = r.endTime.getTime();
      const startHour = (startMs - midnightMs) / 3_600_000;
      const endHour   = (endMs   - midnightMs) / 3_600_000;

      return {
        id:                r.id,
        staffId:           r.staffId,
        customerId:        r.customerId,
        staffName:         r.staffName,
        staffRole:         r.staffRole,
        clientName:        r.clientName ?? 'Unknown',
        clientPhone:       r.clientPhone,
        notes:             r.customerNotes,        // customer-level notes, persists across bookings
        customerCreatedAt: r.customerCreatedAt.toISOString(),
        serviceName:       r.serviceName,
        startHour,
        endHour,
        status:            toFrontendStatus(r.state),
        pricePkr:          r.pricePaisa / 100,
        source:            r.source as 'manual' | 'whatsapp' | 'web',
      };
    });

    return reply.send({ ok: true, data });
  });

  // ── POST /bookings ─────────────────────────────────────────────────────────
  app.post('/', async (request, reply) => {
    const jwt = request.user as JWTPayload;

    const body = CreateBookingSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ ok: false, error: { code: 'VALIDATION_ERROR', message: body.error.message } });
    }

    try {
      const booking = await createBooking({
        tenantId:  jwt.tid,
        ...body.data,
        startTime: new Date(body.data.startTime),
        endTime:   new Date(body.data.endTime),
      });
      return reply.code(201).send({ ok: true, data: booking });
    } catch (err) {
      if (err instanceof SlotUnavailableError) {
        return reply.code(409).send({
          ok: false,
          error: { code: 'SLOT_UNAVAILABLE', message: 'This slot is already taken' },
        });
      }
      throw err;
    }
  });

  // ── PATCH /bookings/:id/status ─────────────────────────────────────────────
  app.patch('/:id/status', async (request, reply) => {
    const jwt = request.user as JWTPayload;
    const { id } = request.params as { id: string };

    const parsed = StatusSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'state is required' } });
    }

    // Normalise incoming state to uppercase DB format
    const newDbState = toDbState(parsed.data.state);

    // Fetch current booking to validate transition
    const [current] = await withTenant(jwt.tid, async (tx) =>
      tx.select({ state: schema.bookings.state })
        .from(schema.bookings)
        .where(and(
          eq(schema.bookings.id, id),
          eq(schema.bookings.tenantId, jwt.tid),
        ))
    );

    if (!current) {
      return reply.code(404).send({ ok: false, error: { code: 'NOT_FOUND', message: 'Booking not found' } });
    }

    const allowed = ALLOWED_TRANSITIONS[current.state] ?? [];
    if (!allowed.includes(newDbState)) {
      return reply.code(422).send({
        ok: false,
        error: {
          code: 'INVALID_TRANSITION',
          message: `Cannot transition from ${current.state} to ${newDbState}`,
        },
      });
    }

    const [updated] = await withTenant(jwt.tid, async (tx) =>
      tx.update(schema.bookings)
        .set({ state: newDbState, updatedAt: new Date() })
        .where(and(
          eq(schema.bookings.id, id),
          eq(schema.bookings.tenantId, jwt.tid),
        ))
        .returning()
    );

    return reply.send({
      ok: true,
      data: {
        ...updated,
        status: toFrontendStatus(updated!.state),
      },
    });
  });

  // ── PATCH /bookings/:id/reschedule ────────────────────────────────────────
  app.patch('/:id/reschedule', async (request, reply) => {
    const jwt = request.user as JWTPayload;
    const { id } = request.params as { id: string };

    const schema_ = z.object({
      startTime: z.string().datetime({ offset: true }),
      endTime:   z.string().datetime({ offset: true }),
    });

    const parsed = schema_.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ ok: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.message } });
    }

    const newStart = new Date(parsed.data.startTime);
    const newEnd   = new Date(parsed.data.endTime);

    if (newEnd <= newStart) {
      return reply.code(400).send({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'endTime must be after startTime' } });
    }

    const [updated] = await withTenant(jwt.tid, async (tx) =>
      tx.update(schema.bookings)
        .set({ startTime: newStart, endTime: newEnd, updatedAt: new Date() })
        .where(and(
          eq(schema.bookings.id, id),
          eq(schema.bookings.tenantId, jwt.tid),
        ))
        .returning({ id: schema.bookings.id })
    );

    if (!updated) {
      return reply.code(404).send({ ok: false, error: { code: 'NOT_FOUND', message: 'Booking not found' } });
    }

    return reply.send({ ok: true, data: { id: updated.id } });
  });

  // ── POST /bookings/:id/checkout ───────────────────────────────────────────
  // Records a manual payment and transitions the booking CHECKED_IN → COMPLETED.
  const CheckoutSchema = z.object({
    method:        z.enum(['cash', 'jazzcash', 'easypaisa', 'raast', 'card']),
    discountPaisa: z.number().int().min(0),
    totalPaisa:    z.number().int().positive(),
  });

  app.post('/:id/checkout', async (request, reply) => {
    const jwt = request.user as JWTPayload;
    const { id } = request.params as { id: string };

    const parsed = CheckoutSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ ok: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.message } });
    }

    const { method, totalPaisa } = parsed.data;

    const [current] = await withTenant(jwt.tid, async (tx) =>
      tx.select({ state: schema.bookings.state })
        .from(schema.bookings)
        .where(and(
          eq(schema.bookings.id, id),
          eq(schema.bookings.tenantId, jwt.tid),
        ))
    );

    if (!current) {
      return reply.code(404).send({ ok: false, error: { code: 'NOT_FOUND', message: 'Booking not found' } });
    }

    const checkoutableStates = ['INITIATED', 'CONFIRMED', 'CHECKED_IN'];
    if (!checkoutableStates.includes(current.state)) {
      return reply.code(422).send({
        ok: false,
        error: { code: 'INVALID_STATE', message: `Cannot checkout a booking in state ${current.state}` },
      });
    }

    const txnRef = `manual_${randomUUID()}`;

    const [updated] = await withTenant(jwt.tid, async (tx) => {
      await tx.insert(schema.payments).values({
        bookingId:   id,
        tenantId:    jwt.tid,
        gateway:     method,
        txnRef,
        amountPaisa: totalPaisa,
        state:       'SUCCESS',
      });
      return tx.update(schema.bookings)
        .set({ state: 'COMPLETED', updatedAt: new Date() })
        .where(and(
          eq(schema.bookings.id, id),
          eq(schema.bookings.tenantId, jwt.tid),
        ))
        .returning();
    });

    return reply.send({ ok: true, data: { ...updated!, status: 'completed' } });
  });

  // ── GET /bookings/:id/payment ─────────────────────────────────────────────
  // Returns the most recent successful payment for a booking (for the completed panel).
  app.get('/:id/payment', async (request, reply) => {
    const jwt = request.user as JWTPayload;
    const { id } = request.params as { id: string };

    const [row] = await withTenant(jwt.tid, async (tx) =>
      tx.select({
        gateway:     schema.payments.gateway,
        amountPaisa: schema.payments.amountPaisa,
        state:       schema.payments.state,
        paidAt:      schema.payments.createdAt,
        bookingPrice: schema.bookings.pricePaisa,
      })
        .from(schema.payments)
        .innerJoin(schema.bookings, eq(schema.payments.bookingId, schema.bookings.id))
        .where(and(
          eq(schema.payments.bookingId, id),
          eq(schema.payments.tenantId, jwt.tid),
        ))
        .orderBy(schema.payments.createdAt)
        .limit(1)
    );

    if (!row) {
      return reply.code(404).send({ ok: false, error: { code: 'NOT_FOUND', message: 'No payment found' } });
    }

    return reply.send({
      ok: true,
      data: {
        gateway:      row.gateway,
        amountPaisa:  row.amountPaisa,
        discountPaisa: row.bookingPrice - row.amountPaisa,
        state:        row.state,
        paidAt:       row.paidAt.toISOString(),
      },
    });
  });

  // ── PATCH /bookings/:id/notes ──────────────────────────────────────────────
  app.patch('/:id/notes', async (request, reply) => {
    const jwt = request.user as JWTPayload;
    const { id } = request.params as { id: string };
    const { notes } = request.body as { notes?: string };

    if (typeof notes !== 'string') {
      return reply.code(400).send({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'notes must be a string' } });
    }

    const [updated] = await withTenant(jwt.tid, async (tx) =>
      tx.update(schema.bookings)
        .set({ notes, updatedAt: new Date() })
        .where(and(
          eq(schema.bookings.id, id),
          eq(schema.bookings.tenantId, jwt.tid),
        ))
        .returning({ id: schema.bookings.id, notes: schema.bookings.notes })
    );

    if (!updated) {
      return reply.code(404).send({ ok: false, error: { code: 'NOT_FOUND', message: 'Booking not found' } });
    }

    return reply.send({ ok: true, data: updated });
  });
}
