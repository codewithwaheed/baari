// apps/api/src/routes/customers.ts
// Customer routes — tenant-scoped via JWT tid claim.

import type { FastifyInstance } from 'fastify';
import { eq, and, or, ilike, desc, sql } from 'drizzle-orm';
import { z } from 'zod';
import { withTenant, schema } from '@baari/db';
import type { JWTPayload } from '@baari/types';

// ─── Phone normalisation ──────────────────────────────────────────────────────

export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('03') && digits.length === 11) return '+92' + digits.slice(1);
  if (digits.startsWith('92') && digits.length === 12) return '+' + digits;
  if (raw.trimStart().startsWith('+')) return '+' + digits;
  return raw.trim();
}

// ─── Validation ───────────────────────────────────────────────────────────────

const CreateCustomerSchema = z.object({
  phone: z.string().min(6),
  name:  z.string().min(1).max(120),
});

const UpdateCustomerSchema = z.object({
  notes: z.string().optional(),
  isVip: z.boolean().optional(),
  name:  z.string().min(1).max(120).optional(),
});

// ─── Routes ───────────────────────────────────────────────────────────────────

export default async function customerRoutes(app: FastifyInstance) {
  app.addHook('onRequest', (app as any).authenticate);

  // ── GET /customers?phone=&q=&limit=&offset= ───────────────────────────────
  // phone: exact lookup (for booking modal auto-fill)
  // q:     full-text search by name or phone
  // no q:  list all, sorted by lastVisitDate DESC NULLS LAST
  // Always paginated via limit + offset.
  app.get('/', async (request, reply) => {
    const jwt = request.user as JWTPayload;
    const { phone, q, limit: limitStr, offset: offsetStr } = request.query as {
      phone?: string; q?: string; limit?: string; offset?: string;
    };

    // Exact phone lookup (used by booking modal)
    if (phone) {
      const e164 = normalizePhone(phone);
      const [customer] = await withTenant(jwt.tid, async (tx) =>
        tx.select({
          id:        schema.customers.id,
          name:      schema.customers.name,
          phoneE164: schema.customers.phoneE164,
          notes:     schema.customers.notes,
          isVip:     schema.customers.isVip,
          waOptIn:   schema.customers.waOptIn,
        })
          .from(schema.customers)
          .where(and(
            eq(schema.customers.tenantId, jwt.tid),
            eq(schema.customers.phoneE164, e164),
          ))
          .limit(1)
      );

      if (!customer) {
        return reply.code(404).send({ ok: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } });
      }
      return reply.send({ ok: true, data: customer });
    }

    // List / search — with visit stats and pagination
    const limit  = Math.min(Math.max(parseInt(limitStr  ?? '20', 10) || 20, 1), 50);
    const offset = Math.max(parseInt(offsetStr ?? '0',  10) || 0, 0);

    const rows = await withTenant(jwt.tid, async (tx) => {
      // Subquery: aggregate visit stats per customer
      const vs = tx
        .select({
          customerId:    schema.bookings.customerId,
          lastVisitDate: sql<string | null>`MAX(${schema.bookings.startTime})`.as('last_visit_date'),
          visitCount:    sql<number>`COUNT(*)::int`.as('visit_count'),
        })
        .from(schema.bookings)
        .where(and(
          eq(schema.bookings.tenantId, jwt.tid),
          eq(schema.bookings.state, 'COMPLETED'),
        ))
        .groupBy(schema.bookings.customerId)
        .as('vs');

      const searchCond = q && q.trim().length > 0
        ? or(
            ilike(schema.customers.name, `%${q.trim()}%`),
            ilike(schema.customers.phoneE164, `%${q.trim()}%`),
          )
        : undefined;

      return tx
        .select({
          id:            schema.customers.id,
          name:          schema.customers.name,
          phoneE164:     schema.customers.phoneE164,
          isVip:         schema.customers.isVip,
          waOptIn:       schema.customers.waOptIn,
          lastVisitDate: vs.lastVisitDate,
          visitCount:    sql<number>`COALESCE(${vs.visitCount}, 0)::int`,
        })
        .from(schema.customers)
        .leftJoin(vs, eq(schema.customers.id, vs.customerId))
        .where(and(
          eq(schema.customers.tenantId, jwt.tid),
          ...(searchCond ? [searchCond] : []),
        ))
        .orderBy(
          sql`${vs.lastVisitDate} DESC NULLS LAST`,
          desc(schema.customers.createdAt),
        )
        .limit(limit + 1)  // +1 to determine hasMore
        .offset(offset);
    });

    const hasMore = rows.length > limit;
    const data    = hasMore ? rows.slice(0, limit) : rows;

    return reply.send({ ok: true, data, hasMore, offset, limit });
  });

  // ── GET /customers/:id ────────────────────────────────────────────────────
  // Full profile with lifetime spend total.
  app.get('/:id', async (request, reply) => {
    const jwt = request.user as JWTPayload;
    const { id } = request.params as { id: string };

    const [customer] = await withTenant(jwt.tid, async (tx) =>
      tx.select({
        id:        schema.customers.id,
        name:      schema.customers.name,
        phoneE164: schema.customers.phoneE164,
        waOptIn:   schema.customers.waOptIn,
        isVip:     schema.customers.isVip,
        notes:     schema.customers.notes,
        createdAt: schema.customers.createdAt,
      })
        .from(schema.customers)
        .where(and(
          eq(schema.customers.id, id),
          eq(schema.customers.tenantId, jwt.tid),
        ))
        .limit(1)
    );

    if (!customer) {
      return reply.code(404).send({ ok: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } });
    }

    // Lifetime spend + visit count (completed bookings only)
    const [stats] = await withTenant(jwt.tid, async (tx) =>
      tx.select({
        lifetimeSpend: sql<number>`COALESCE(SUM(${schema.bookings.pricePaisa}), 0)::bigint`,
        visitCount:    sql<number>`COUNT(*)::int`,
      })
        .from(schema.bookings)
        .where(and(
          eq(schema.bookings.customerId, id),
          eq(schema.bookings.tenantId, jwt.tid),
          eq(schema.bookings.state, 'COMPLETED'),
        ))
    );

    return reply.send({
      ok: true,
      data: {
        ...customer,
        lifetimeSpend: stats?.lifetimeSpend ?? 0,
        visitCount:    stats?.visitCount    ?? 0,
      },
    });
  });

  // ── POST /customers ────────────────────────────────────────────────────────
  app.post('/', async (request, reply) => {
    const jwt = request.user as JWTPayload;

    const parsed = CreateCustomerSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ ok: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.message } });
    }

    const e164 = normalizePhone(parsed.data.phone);

    const [existing] = await withTenant(jwt.tid, async (tx) =>
      tx.select()
        .from(schema.customers)
        .where(and(
          eq(schema.customers.tenantId, jwt.tid),
          eq(schema.customers.phoneE164, e164),
        ))
        .limit(1)
    );

    if (existing) {
      if (parsed.data.name && existing.name !== parsed.data.name) {
        const [updated] = await withTenant(jwt.tid, async (tx) =>
          tx.update(schema.customers)
            .set({ name: parsed.data.name, updatedAt: new Date() })
            .where(eq(schema.customers.id, existing.id))
            .returning()
        );
        return reply.send({ ok: true, data: updated, created: false });
      }
      return reply.send({ ok: true, data: existing, created: false });
    }

    const [created] = await withTenant(jwt.tid, async (tx) =>
      tx.insert(schema.customers)
        .values({
          tenantId:  jwt.tid,
          phoneE164: e164,
          name:      parsed.data.name,
        })
        .returning()
    );

    return reply.code(201).send({ ok: true, data: created, created: true });
  });

  // ── GET /customers/:id/bookings ──────────────────────────────────────────
  app.get('/:id/bookings', async (request, reply) => {
    const jwt = request.user as JWTPayload;
    const { id } = request.params as { id: string };
    const { limit: limitStr, offset: offsetStr } = request.query as { limit?: string; offset?: string };
    const limit  = Math.min(parseInt(limitStr  ?? '10', 10) || 10, 20);
    const offset = Math.max(parseInt(offsetStr ?? '0',  10) || 0, 0);

    const rows = await withTenant(jwt.tid, async (tx) =>
      tx.select({
        serviceName: schema.services.name,
        startTime:   schema.bookings.startTime,
        staffName:   schema.staff.name,
        pricePaisa:  schema.bookings.pricePaisa,
        state:       schema.bookings.state,
      })
        .from(schema.bookings)
        .innerJoin(schema.services, eq(schema.bookings.serviceId, schema.services.id))
        .innerJoin(schema.staff,    eq(schema.bookings.staffId,   schema.staff.id))
        .where(and(
          eq(schema.bookings.customerId, id),
          eq(schema.bookings.tenantId,   jwt.tid),
        ))
        .orderBy(desc(schema.bookings.startTime))
        .limit(limit + 1)
        .offset(offset)
    );

    const hasMore = rows.length > limit;
    const data = (hasMore ? rows.slice(0, limit) : rows).map(r => ({
      service: r.serviceName,
      date:    r.startTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Karachi' }),
      staff:   r.staffName,
      amount:  r.pricePaisa,
      state:   r.state,
    }));

    return reply.send({ ok: true, data, hasMore, offset, limit });
  });

  // ── PATCH /customers/:id ──────────────────────────────────────────────────
  app.patch('/:id', async (request, reply) => {
    const jwt = request.user as JWTPayload;
    const { id } = request.params as { id: string };

    const parsed = UpdateCustomerSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ ok: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.message } });
    }

    const { notes, isVip, name } = parsed.data;
    if (notes === undefined && isVip === undefined && name === undefined) {
      return reply.code(400).send({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'Provide at least one field' } });
    }

    const setFields: Record<string, unknown> = { updatedAt: new Date() };
    if (notes !== undefined) setFields['notes'] = notes;
    if (isVip !== undefined) setFields['isVip'] = isVip;
    if (name  !== undefined) setFields['name']  = name;

    const [updated] = await withTenant(jwt.tid, async (tx) =>
      tx.update(schema.customers)
        .set(setFields)
        .where(and(
          eq(schema.customers.id, id),
          eq(schema.customers.tenantId, jwt.tid),
        ))
        .returning({
          id:    schema.customers.id,
          name:  schema.customers.name,
          notes: schema.customers.notes,
          isVip: schema.customers.isVip,
        })
    );

    if (!updated) {
      return reply.code(404).send({ ok: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } });
    }

    return reply.send({ ok: true, data: updated });
  });
}
