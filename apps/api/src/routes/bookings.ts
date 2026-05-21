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
import { eq, and, gte, lte, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { withTenant, schema } from '@baari/db';
import type { JWTPayload } from '@baari/types';
import { createBooking, SlotUnavailableError, ServiceNotFoundError } from '../lib/bookings/create';

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
  /** Ordered array of service UUIDs — min 1, max 10 per visit */
  serviceIds: z.array(z.string().uuid()).min(1).max(10),
  customerId: z.string().uuid(),
  startTime:  z.string().datetime({ offset: true }),
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

    // Fetch all booking_services for these bookings in one query, join service names
    const bookingIds = rows.map(r => r.id);
    const serviceLines = bookingIds.length > 0
      ? await withTenant(jwt.tid, async (tx) =>
          tx
            .select({
              bookingId:   schema.bookingServices.bookingId,
              sortOrder:   schema.bookingServices.sortOrder,
              durationMin: schema.bookingServices.durationMin,
              pricePaisa:  schema.bookingServices.pricePaisa,
              serviceName: schema.services.name,
            })
            .from(schema.bookingServices)
            .innerJoin(schema.services, eq(schema.bookingServices.serviceId, schema.services.id))
            .where(inArray(schema.bookingServices.bookingId, bookingIds))
            .orderBy(schema.bookingServices.sortOrder)
        )
      : [];

    // Group service lines by bookingId
    const servicesByBooking = new Map<string, typeof serviceLines>();
    for (const sl of serviceLines) {
      const existing = servicesByBooking.get(sl.bookingId) ?? [];
      existing.push(sl);
      servicesByBooking.set(sl.bookingId, existing);
    }

    // Normalise to frontend-friendly shape.
    // dayStart is Karachi midnight expressed as UTC.
    // The difference (startMs - midnight) already gives Karachi-local hours.
    const midnightMs = dayStart.getTime();
    const data = rows.map(r => {
      const startMs   = r.startTime.getTime();
      const endMs     = r.endTime.getTime();
      const startHour = (startMs - midnightMs) / 3_600_000;
      const endHour   = (endMs   - midnightMs) / 3_600_000;

      const svcs = servicesByBooking.get(r.id) ?? [];
      // Fall back to primary service (from bookings.service_id join) if booking_services is empty
      // — covers seed data and bookings created before this migration.
      const services = svcs.length > 0
        ? svcs.map(s => ({ name: s.serviceName, durationMin: s.durationMin, pricePaisa: s.pricePaisa }))
        : [{ name: r.serviceName, durationMin: Math.round((endHour - startHour) * 60), pricePaisa: r.pricePaisa }];

      return {
        id:                r.id,
        staffId:           r.staffId,
        customerId:        r.customerId,
        staffName:         r.staffName,
        staffRole:         r.staffRole,
        clientName:        r.clientName ?? 'Unknown',
        clientPhone:       r.clientPhone,
        notes:             r.customerNotes,
        customerCreatedAt: r.customerCreatedAt.toISOString(),
        serviceName:       services[0]!.name,          // primary — kept for compat
        services,                                      // full list for panels + POS
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
        tenantId:   jwt.tid,
        staffId:    body.data.staffId,
        serviceIds: body.data.serviceIds,
        customerId: body.data.customerId,
        startTime:  new Date(body.data.startTime),
        source:     body.data.source,
        notes:      body.data.notes,
        ...(body.data.locationId !== undefined && { locationId: body.data.locationId }),
      });
      return reply.code(201).send({ ok: true, data: booking });
    } catch (err) {
      if (err instanceof SlotUnavailableError) {
        return reply.code(409).send({
          ok: false,
          error: { code: 'SLOT_UNAVAILABLE', message: 'This slot is already taken' },
        });
      }
      if (err instanceof ServiceNotFoundError) {
        return reply.code(404).send({
          ok: false,
          error: { code: 'SERVICE_NOT_FOUND', message: (err as Error).message },
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

  // ── GET /bookings/availability ────────────────────────────────────────────
  // Returns available 30-minute-stepped slots for a given staff + date + service duration.
  // Filters out: existing confirmed/pending bookings, break windows, and slots that would
  // end after close time.
  app.get('/availability', async (request, reply) => {
    const jwt = request.user as JWTPayload;

    const AvailabilitySchema = z.object({
      staffId:            z.string().uuid(),
      date:               z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      serviceDurationMin: z.coerce.number().int().positive(),
    });

    const parsed = AvailabilitySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ ok: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.message } });
    }

    const { staffId, date, serviceDurationMin } = parsed.data;
    const durationHours = serviceDurationMin / 60;

    // Karachi midnight for the requested date — used as the epoch for decimal-hour offsets.
    const dayStart = new Date(`${date}T00:00:00+05:00`);
    const dayEnd   = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    // 0=Sun, 1=Mon … matching working_hours.day_of_week
    const dayOfWeek = dayStart.getDay();

    // Fetch working hours and existing bookings in parallel
    const [whRows, bookingRows] = await Promise.all([
      withTenant(jwt.tid, async (tx) =>
        tx.select()
          .from(schema.workingHours)
          .where(and(
            eq(schema.workingHours.tenantId, jwt.tid),
            eq(schema.workingHours.dayOfWeek, dayOfWeek),
          ))
          .limit(1)
      ),
      withTenant(jwt.tid, async (tx) =>
        tx.select({ startTime: schema.bookings.startTime, endTime: schema.bookings.endTime })
          .from(schema.bookings)
          .where(and(
            eq(schema.bookings.tenantId, jwt.tid),
            eq(schema.bookings.staffId, staffId),
            gte(schema.bookings.startTime, dayStart),
            lte(schema.bookings.startTime, dayEnd),
            inArray(schema.bookings.state, ['PAYMENT_PENDING', 'CONFIRMED', 'CHECKED_IN', 'COMPLETED']),
          ))
      ),
    ]);

    const wh = whRows[0];

    // If the salon is closed that day, return empty slot list
    if (wh && !wh.isOpen) {
      return reply.send({ ok: true, data: [] });
    }

    const openTime  = wh?.openTime  ?? '09:00';
    const closeTime = wh?.closeTime ?? '20:00';
    const breaks    = wh?.breaks    ?? [];

    // Parse "HH:MM" → decimal hours
    function parseHHMM(t: string): number {
      const [hh, mm] = t.split(':').map(Number);
      return (hh ?? 0) + (mm ?? 0) / 60;
    }

    const openHour  = parseHHMM(openTime);
    const closeHour = parseHHMM(closeTime);

    // Convert DB bookings to decimal hours relative to Karachi midnight
    const dayStartMs = dayStart.getTime();
    const bookedSlots = bookingRows.map(b => ({
      start: (b.startTime.getTime() - dayStartMs) / 3_600_000,
      end:   (b.endTime.getTime()   - dayStartMs) / 3_600_000,
    }));

    const breakSlots = breaks.map(b => ({
      start: parseHHMM(b.from),
      end:   parseHHMM(b.to),
    }));

    function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
      return aStart < bEnd && aEnd > bStart;
    }

    function fmtLabel(h: number): string {
      const period = h >= 12 ? 'pm' : 'am';
      const hr = Math.floor(h);
      const m  = Math.round((h - hr) * 60);
      const display = hr > 12 ? hr - 12 : hr === 0 ? 12 : hr;
      return m ? `${display}:${String(m).padStart(2, '0')}${period}` : `${display}${period}`;
    }

    const slots: { startHour: number; endHour: number; label: string }[] = [];
    // Step every 30 min from open to (close − duration)
    for (let h = openHour; h + durationHours <= closeHour; h += 0.5) {
      const slotEnd = parseFloat((h + durationHours).toFixed(4));

      const blockedByBooking = bookedSlots.some(b => overlaps(h, slotEnd, b.start, b.end));
      const blockedByBreak   = breakSlots.some(b  => overlaps(h, slotEnd, b.start, b.end));

      if (!blockedByBooking && !blockedByBreak) {
        slots.push({ startHour: h, endHour: slotEnd, label: fmtLabel(h) });
      }
    }

    return reply.send({ ok: true, data: slots });
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
