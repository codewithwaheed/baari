// apps/api/src/routes/requests.ts
// Booking requests queue — all routes are tenant-scoped via JWT tid claim.
//
// Requests arrive from:
//   - Public booking page (source: web) via POST /public/salon/:slug/book
//   - WhatsApp flows (future — Phase 9)
//
// Lifecycle: pending → approved (creates booking) | declined

import type { FastifyInstance } from 'fastify';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { withTenant, schema } from '@baari/db';
import type { JWTPayload } from '@baari/types';
import { createBooking, SlotUnavailableError } from '../lib/bookings/create';

export default async function requestRoutes(app: FastifyInstance) {
  app.addHook('onRequest', (app as any).authenticate);

  // ── GET /requests ──────────────────────────────────────────────────────────
  // Returns pending booking requests for the tenant, newest first.
  app.get('/', async (request, reply) => {
    const jwt = request.user as JWTPayload;

    const rows = await withTenant(jwt.tid, async (tx) =>
      tx
        .select({
          id:                  schema.bookingRequests.id,
          customerId:          schema.bookingRequests.customerId,
          customerName:        schema.customers.name,
          customerPhone:       schema.customers.phoneE164,
          serviceId:           schema.bookingRequests.serviceId,
          serviceName:         schema.services.name,
          serviceIds:          schema.bookingRequests.serviceIds,
          staffId:             schema.bookingRequests.staffId,
          staffName:           schema.staff.name,
          requestedAt:         schema.bookingRequests.requestedAt,
          requestedPricePaisa: schema.bookingRequests.requestedPricePaisa,
          paid:                schema.bookingRequests.paid,
          state:               schema.bookingRequests.state,
          createdAt:           schema.bookingRequests.createdAt,
        })
        .from(schema.bookingRequests)
        .innerJoin(schema.customers, eq(schema.bookingRequests.customerId, schema.customers.id))
        .innerJoin(schema.services,  eq(schema.bookingRequests.serviceId,  schema.services.id))
        .leftJoin(schema.staff,      eq(schema.bookingRequests.staffId,    schema.staff.id))
        .where(and(
          eq(schema.bookingRequests.tenantId, jwt.tid),
          eq(schema.bookingRequests.state,    'pending'),
        ))
        .orderBy(sql`${schema.bookingRequests.createdAt} DESC`)
    );

    // Resolve all service names in one query for multi-service rows
    const allServiceIds = [...new Set(rows.flatMap(r =>
      r.serviceIds && r.serviceIds.length > 0 ? r.serviceIds : [r.serviceId]
    ))];

    const serviceLookup = allServiceIds.length > 0
      ? await withTenant(jwt.tid, async (tx) => {
          const svcs = await tx
            .select({ id: schema.services.id, name: schema.services.name, durationMin: schema.services.durationMin, pricePaisa: schema.services.pricePaisa })
            .from(schema.services)
            .where(inArray(schema.services.id, allServiceIds));
          return Object.fromEntries(svcs.map(s => [s.id, s]));
        })
      : {} as Record<string, { id: string; name: string; durationMin: number; pricePaisa: number }>;

    const data = rows.map(r => {
      const ids = r.serviceIds && r.serviceIds.length > 0 ? r.serviceIds : [r.serviceId];
      const services = ids
        .map(id => serviceLookup[id])
        .filter((s): s is NonNullable<typeof s> => s != null);

      return {
        id:                  r.id,
        customerId:          r.customerId,
        customerName:        r.customerName ?? 'Unknown',
        customerPhone:       r.customerPhone,
        staffId:             r.staffId,
        staffName:           r.staffName ?? 'Unknown',
        requestedAt:         r.requestedAt.toISOString(),
        requestedPricePaisa: r.requestedPricePaisa,
        paid:                r.paid,
        state:               r.state,
        createdAt:           r.createdAt.toISOString(),
        services,
      };
    });

    return reply.send({ ok: true, data });
  });

  // ── GET /requests/count ────────────────────────────────────────────────────
  // Lightweight count for the badge. Must be registered before /:id routes.
  app.get('/count', async (request, reply) => {
    const jwt = request.user as JWTPayload;

    const [row] = await withTenant(jwt.tid, async (tx) =>
      tx
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(schema.bookingRequests)
        .where(and(
          eq(schema.bookingRequests.tenantId, jwt.tid),
          eq(schema.bookingRequests.state,    'pending'),
        ))
    );

    return reply.send({ ok: true, data: { count: row?.count ?? 0 } });
  });

  // ── POST /requests/:id/approve ─────────────────────────────────────────────
  // Creates a confirmed booking from the request and marks it approved.
  app.post('/:id/approve', async (request, reply) => {
    const jwt = request.user as JWTPayload;
    const { id } = request.params as { id: string };

    // Fetch the request
    const [req] = await withTenant(jwt.tid, async (tx) =>
      tx
        .select({
          id:          schema.bookingRequests.id,
          tenantId:    schema.bookingRequests.tenantId,
          customerId:  schema.bookingRequests.customerId,
          serviceId:   schema.bookingRequests.serviceId,
          serviceIds:  schema.bookingRequests.serviceIds,
          staffId:     schema.bookingRequests.staffId,
          requestedAt: schema.bookingRequests.requestedAt,
          state:       schema.bookingRequests.state,
        })
        .from(schema.bookingRequests)
        .where(and(
          eq(schema.bookingRequests.id,       id),
          eq(schema.bookingRequests.tenantId, jwt.tid),
        ))
        .limit(1)
    );

    if (!req) {
      return reply.code(404).send({ ok: false, error: { code: 'NOT_FOUND', message: 'Request not found' } });
    }

    if (req.state !== 'pending') {
      return reply.code(422).send({ ok: false, error: { code: 'NOT_PENDING', message: `Request is already ${req.state}` } });
    }

    // staffId is nullable — use a fallback if not set (shouldn't happen with web flow)
    if (!req.staffId) {
      return reply.code(422).send({ ok: false, error: { code: 'NO_STAFF', message: 'Request has no staff assigned' } });
    }

    try {
      // Use stored serviceIds if present; fall back to legacy single serviceId
      const resolvedServiceIds = req.serviceIds && req.serviceIds.length > 0
        ? req.serviceIds
        : [req.serviceId];

      const booking = await createBooking({
        tenantId:   jwt.tid,
        staffId:    req.staffId,
        serviceIds: resolvedServiceIds,
        customerId: req.customerId,
        startTime:  req.requestedAt,
        source:     'web',
      });

      // Mark request approved
      await withTenant(jwt.tid, async (tx) =>
        tx.update(schema.bookingRequests)
          .set({ state: 'approved' })
          .where(eq(schema.bookingRequests.id, id))
      );

      return reply.send({ ok: true, data: { bookingId: booking.id } });
    } catch (err) {
      if (err instanceof SlotUnavailableError) {
        return reply.code(409).send({
          ok: false,
          error: { code: 'SLOT_UNAVAILABLE', message: 'That slot is no longer available' },
        });
      }
      throw err;
    }
  });

  // ── POST /requests/:id/decline ─────────────────────────────────────────────
  app.post('/:id/decline', async (request, reply) => {
    const jwt = request.user as JWTPayload;
    const { id } = request.params as { id: string };

    const [req] = await withTenant(jwt.tid, async (tx) =>
      tx
        .select({ state: schema.bookingRequests.state })
        .from(schema.bookingRequests)
        .where(and(
          eq(schema.bookingRequests.id,       id),
          eq(schema.bookingRequests.tenantId, jwt.tid),
        ))
        .limit(1)
    );

    if (!req) {
      return reply.code(404).send({ ok: false, error: { code: 'NOT_FOUND', message: 'Request not found' } });
    }

    if (req.state !== 'pending') {
      return reply.code(422).send({ ok: false, error: { code: 'NOT_PENDING', message: `Request is already ${req.state}` } });
    }

    await withTenant(jwt.tid, async (tx) =>
      tx.update(schema.bookingRequests)
        .set({ state: 'declined' })
        .where(eq(schema.bookingRequests.id, id))
    );

    return reply.send({ ok: true });
  });
}
