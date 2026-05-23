// apps/api/src/routes/services.ts
// Service routes — tenant-scoped via JWT tid claim.

import type { FastifyInstance } from 'fastify';
import { eq, and, asc, inArray, not } from 'drizzle-orm';
import { withTenant, schema } from '@baari/db';
import type { JWTPayload } from '@baari/types';
import { z } from 'zod';

const CreateServiceSchema = z.object({
  name:        z.string().min(1).max(120),
  category:    z.string().max(60).optional(),   // free text — hair, skin, beard, etc.
  durationMin: z.number().int().min(5).max(480),
  pricePaisa:  z.number().int().min(0),
  bufferMin:   z.number().int().min(0).max(60).default(0),
  isActive:    z.boolean().default(true),
});

const UpdateServiceSchema = z.object({
  name:        z.string().min(1).max(120).optional(),
  category:    z.string().max(60).nullable().optional(), // free text — no enum
  durationMin: z.number().int().min(5).max(480).optional(),
  pricePaisa:  z.number().int().min(0).optional(),
  bufferMin:   z.number().int().min(0).max(60).optional(),
  isActive:    z.boolean().optional(),
});

export default async function serviceRoutes(app: FastifyInstance) {
  app.addHook('onRequest', (app as any).authenticate);

  // ── GET /services ──────────────────────────────────────────────────────────
  // Returns services for the tenant. Default: active only.
  // ?includeInactive=true returns all (for settings view).
  app.get('/', async (request, reply) => {
    const jwt = request.user as JWTPayload;
    const { includeInactive } = request.query as { includeInactive?: string };
    const showAll = includeInactive === 'true';

    const rows = await withTenant(jwt.tid, async (tx) =>
      tx
        .select({
          id:          schema.services.id,
          name:        schema.services.name,
          category:    schema.services.category,
          durationMin: schema.services.durationMin,
          pricePaisa:  schema.services.pricePaisa,
          bufferMin:   schema.services.bufferMin,
          isActive:    schema.services.isActive,
        })
        .from(schema.services)
        .where(
          showAll
            ? eq(schema.services.tenantId, jwt.tid)
            : and(eq(schema.services.tenantId, jwt.tid), eq(schema.services.isActive, true))
        )
        .orderBy(asc(schema.services.category), asc(schema.services.name))
    );

    return reply.send({ ok: true, data: rows });
  });

  // ── POST /services ─────────────────────────────────────────────────────────
  app.post('/', async (request, reply) => {
    const jwt = request.user as JWTPayload;
    const body = CreateServiceSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ ok: false, error: { code: 'VALIDATION_ERROR', message: body.error.message } });
    }

    const [row] = await withTenant(jwt.tid, async (tx) =>
      tx
        .insert(schema.services)
        .values({
          tenantId:    jwt.tid,
          name:        body.data.name,
          category:    body.data.category ?? null,
          durationMin: body.data.durationMin,
          pricePaisa:  body.data.pricePaisa,
          bufferMin:   body.data.bufferMin,
          isActive:    body.data.isActive,
        })
        .returning({
          id:          schema.services.id,
          name:        schema.services.name,
          category:    schema.services.category,
          durationMin: schema.services.durationMin,
          pricePaisa:  schema.services.pricePaisa,
          bufferMin:   schema.services.bufferMin,
          isActive:    schema.services.isActive,
        })
    );

    return reply.code(201).send({ ok: true, data: row });
  });

  // ── PATCH /services/:id ────────────────────────────────────────────────────
  app.patch('/:id', async (request, reply) => {
    const jwt = request.user as JWTPayload;
    const { id } = request.params as { id: string };
    const body = UpdateServiceSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ ok: false, error: { code: 'VALIDATION_ERROR', message: body.error.message } });
    }

    const updates: Record<string, unknown> = {};
    if (body.data.name        !== undefined) updates['name']        = body.data.name;
    if (body.data.category    !== undefined) updates['category']    = body.data.category;
    if (body.data.durationMin !== undefined) updates['durationMin'] = body.data.durationMin;
    if (body.data.pricePaisa  !== undefined) updates['pricePaisa']  = body.data.pricePaisa;
    if (body.data.bufferMin   !== undefined) updates['bufferMin']   = body.data.bufferMin;
    if (body.data.isActive    !== undefined) updates['isActive']    = body.data.isActive;

    if (Object.keys(updates).length === 0) {
      return reply.code(400).send({ ok: false, error: { code: 'NO_FIELDS', message: 'No fields to update' } });
    }

    const [row] = await withTenant(jwt.tid, async (tx) =>
      tx
        .update(schema.services)
        .set(updates as any)
        .where(and(eq(schema.services.id, id), eq(schema.services.tenantId, jwt.tid)))
        .returning({
          id:          schema.services.id,
          name:        schema.services.name,
          category:    schema.services.category,
          durationMin: schema.services.durationMin,
          pricePaisa:  schema.services.pricePaisa,
          bufferMin:   schema.services.bufferMin,
          isActive:    schema.services.isActive,
        })
    );

    if (!row) return reply.code(404).send({ ok: false, error: { code: 'NOT_FOUND', message: 'Service not found' } });
    return reply.send({ ok: true, data: row });
  });

  // ── DELETE /services/:id ───────────────────────────────────────────────────
  // Hard-delete only if no active bookings reference this service.
  app.delete('/:id', async (request, reply) => {
    const jwt = request.user as JWTPayload;
    const { id } = request.params as { id: string };

    // Check for active bookings referencing this service
    const [activeBooking] = await withTenant(jwt.tid, async (tx) =>
      tx
        .select({ id: schema.bookings.id })
        .from(schema.bookings)
        .where(and(
          eq(schema.bookings.serviceId, id),
          eq(schema.bookings.tenantId, jwt.tid),
          not(inArray(schema.bookings.state, ['CANCELLED', 'EXPIRED', 'NO_SHOW', 'COMPLETED'])),
        ))
        .limit(1)
    );

    if (activeBooking) {
      return reply.code(409).send({ ok: false, error: { code: 'SERVICE_IN_USE', message: 'Service has active bookings — deactivate it instead' } });
    }

    const [deleted] = await withTenant(jwt.tid, async (tx) =>
      tx
        .delete(schema.services)
        .where(and(eq(schema.services.id, id), eq(schema.services.tenantId, jwt.tid)))
        .returning({ id: schema.services.id })
    );

    if (!deleted) return reply.code(404).send({ ok: false, error: { code: 'NOT_FOUND', message: 'Service not found' } });
    return reply.send({ ok: true, data: { id: deleted.id } });
  });
}
