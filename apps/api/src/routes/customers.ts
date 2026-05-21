// apps/api/src/routes/customers.ts
// Customer routes — tenant-scoped via JWT tid claim.

import type { FastifyInstance } from 'fastify';
import { eq, and, or, ilike, desc } from 'drizzle-orm';
import { z } from 'zod';
import { withTenant, schema } from '@baari/db';
import type { JWTPayload } from '@baari/types';

// ─── Phone normalisation ──────────────────────────────────────────────────────
// Accepts: 03001234567 | 0300 1234 567 | +923001234567 | 923001234567
// Returns: +923001234567 (E.164) or the cleaned string if unrecognised.

export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  // 03XXXXXXXXX (11 digits, Pakistani local) → +923XXXXXXXXX
  if (digits.startsWith('03') && digits.length === 11) {
    return '+92' + digits.slice(1);
  }
  // 923XXXXXXXXX (12 digits, without +) → +923XXXXXXXXX
  if (digits.startsWith('92') && digits.length === 12) {
    return '+' + digits;
  }
  // Already E.164 — strip spaces only
  if (raw.trimStart().startsWith('+')) {
    return '+' + digits;
  }
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

  // ── GET /customers?phone=<phone> ──────────────────────────────────────────
  // Look up a customer by phone number (exact match on E.164 after normalisation).
  app.get('/', async (request, reply) => {
    const jwt = request.user as JWTPayload;
    const { phone, q } = request.query as { phone?: string; q?: string };

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

    // Full-text search (for Clients view — Phase 7)
    if (q && q.trim().length > 0) {
      const term = `%${q.trim()}%`;
      const rows = await withTenant(jwt.tid, async (tx) =>
        tx.select({
          id:        schema.customers.id,
          name:      schema.customers.name,
          phoneE164: schema.customers.phoneE164,
          isVip:     schema.customers.isVip,
          waOptIn:   schema.customers.waOptIn,
        })
          .from(schema.customers)
          .where(and(
            eq(schema.customers.tenantId, jwt.tid),
            or(
              ilike(schema.customers.name, term),
              ilike(schema.customers.phoneE164, term),
            ),
          ))
          .limit(20)
      );
      return reply.send({ ok: true, data: rows });
    }

    return reply.code(400).send({ ok: false, error: { code: 'MISSING_PARAM', message: 'Provide phone or q' } });
  });

  // ── POST /customers ────────────────────────────────────────────────────────
  // Find-or-create a customer by phone. Idempotent — safe to call on every booking.
  app.post('/', async (request, reply) => {
    const jwt = request.user as JWTPayload;

    const parsed = CreateCustomerSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ ok: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.message } });
    }

    const e164 = normalizePhone(parsed.data.phone);

    // Try to find existing
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
      // Update name if provided and different (e.g. owner corrected it)
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

    // Create new
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
  // Returns the last N completed bookings for a customer — used for "Recent visits" panel.
  app.get('/:id/bookings', async (request, reply) => {
    const jwt = request.user as JWTPayload;
    const { id } = request.params as { id: string };
    const { limit: limitStr } = request.query as { limit?: string };
    const limit = Math.min(parseInt(limitStr ?? '5', 10) || 5, 20);

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
        .limit(limit)
    );

    const data = rows.map(r => ({
      service: r.serviceName,
      date:    r.startTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Karachi' }),
      staff:   r.staffName,
      amount:  r.pricePaisa,
      state:   r.state,
    }));

    return reply.send({ ok: true, data });
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
