// apps/api/src/routes/staff.ts
// Staff routes — tenant-scoped via JWT tid claim.

import type { FastifyInstance } from 'fastify';
import { eq, and, asc } from 'drizzle-orm';
import { withTenant, schema } from '@baari/db';
import type { JWTPayload } from '@baari/types';

export default async function staffRoutes(app: FastifyInstance) {
  app.addHook('onRequest', (app as any).authenticate);

  // ── GET /staff ─────────────────────────────────────────────────────────────
  // Returns all active staff for the tenant, ordered by creation date.
  // No color stored in DB — the frontend assigns palette colors by index.
  app.get('/', async (request, reply) => {
    const jwt = request.user as JWTPayload;

    const rows = await withTenant(jwt.tid, async (tx) =>
      tx
        .select({
          id:        schema.staff.id,
          name:      schema.staff.name,
          role:      schema.staff.role,
          avatarUrl: schema.staff.avatarUrl,
        })
        .from(schema.staff)
        .where(and(
          eq(schema.staff.tenantId, jwt.tid),
          eq(schema.staff.isActive, true),
        ))
        .orderBy(asc(schema.staff.createdAt))
    );

    return reply.send({ ok: true, data: rows });
  });
}
