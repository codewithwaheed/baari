// apps/api/src/routes/me.ts
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { db, schema } from '@baari/db';
import type { JWTPayload } from '@baari/types';

export default async function meRoutes(app: FastifyInstance) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app.addHook('onRequest', (app as any).authenticate);

  app.get('/', async (request, reply) => {
    const jwt = request.user as JWTPayload;

    const [user, tenant, location] = await Promise.all([
      db.query.users.findFirst({ where: eq(schema.users.id, jwt.sub) }),
      db.query.tenants.findFirst({ where: eq(schema.tenants.id, jwt.tid) }),
      db.query.locations.findFirst({ where: eq(schema.locations.tenantId, jwt.tid) }),
    ]);

    if (!user || !tenant) {
      return reply.code(401).send({ ok: false, error: { code: 'USER_NOT_FOUND', message: 'Session invalid.' } });
    }

    return reply.send({
      ok: true,
      user: {
        id:    user.id,
        name:  user.name,
        phone: user.phoneE164,
        role:  user.role,
      },
      tenant: {
        id:                 tenant.id,
        name:               tenant.name,
        slug:               tenant.slug,
        plan:               tenant.plan,
        city:               tenant.city,
        onboardingComplete: tenant.onboardingComplete,
        onboardingStep:     tenant.onboardingStep,
      },
      location: location
        ? { id: location.id, name: location.name }
        : null,
    });
  });
}
