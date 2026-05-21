// apps/api/src/routes/services.ts
// Service routes — tenant-scoped via JWT tid claim.

import type { FastifyInstance } from 'fastify';
import { eq, and, asc } from 'drizzle-orm';
import { withTenant, schema } from '@baari/db';
import type { JWTPayload } from '@baari/types';

export default async function serviceRoutes(app: FastifyInstance) {
  app.addHook('onRequest', (app as any).authenticate);

  // ── GET /services ──────────────────────────────────────────────────────────
  // Returns all active services for the tenant, ordered by category then name.
  app.get('/', async (request, reply) => {
    const jwt = request.user as JWTPayload;

    const rows = await withTenant(jwt.tid, async (tx) =>
      tx
        .select({
          id:          schema.services.id,
          name:        schema.services.name,
          category:    schema.services.category,
          durationMin: schema.services.durationMin,
          pricePaisa:  schema.services.pricePaisa,
          bufferMin:   schema.services.bufferMin,
        })
        .from(schema.services)
        .where(and(
          eq(schema.services.tenantId, jwt.tid),
          eq(schema.services.isActive, true),
        ))
        .orderBy(asc(schema.services.category), asc(schema.services.name))
    );

    return reply.send({ ok: true, data: rows });
  });
}
