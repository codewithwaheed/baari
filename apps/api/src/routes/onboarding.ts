// apps/api/src/routes/onboarding.ts
import type { FastifyInstance } from 'fastify';
import { eq, and, sql } from 'drizzle-orm';
import { db, schema } from '@baari/db';
import type { JWTPayload } from '@baari/types';

function toSlug(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

async function uniqueSlug(base: string, excludeTenantId: string): Promise<string> {
  const existing = await db.query.tenants.findFirst({
    where: and(eq(schema.tenants.slug, base), sql`id != ${excludeTenantId}`),
  });
  if (!existing) return base;
  return `${base}-${Math.random().toString(36).slice(2, 6)}`;
}

export default async function onboardingRoutes(app: FastifyInstance) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app.addHook('onRequest', (app as any).authenticate);

  // ── GET /onboarding/status ───────────────────────────────────────────────
  app.get('/status', async (request, reply) => {
    const jwt = request.user as JWTPayload;
    const tenant = await db.query.tenants.findFirst({ where: eq(schema.tenants.id, jwt.tid) });
    if (!tenant) {
      return reply.code(404).send({ ok: false, error: { code: 'TENANT_NOT_FOUND', message: 'Tenant not found.' } });
    }
    return reply.send({ ok: true, step: tenant.onboardingStep, complete: tenant.onboardingComplete });
  });

  // ── PATCH /onboarding/salon ──────────────────────────────────────────────
  app.patch<{
    Body: { salonName: string; city: string; ownerName: string; slug?: string };
  }>('/salon', async (request, reply) => {
    const jwt = request.user as JWTPayload;
    if (jwt.role !== 'owner') {
      return reply.code(403).send({ ok: false, error: { code: 'FORBIDDEN', message: 'Only owners can complete onboarding.' } });
    }

    const { salonName, city, ownerName, slug: customSlug } = request.body;
    if (!salonName?.trim() || !city?.trim() || !ownerName?.trim()) {
      return reply.code(400).send({ ok: false, error: { code: 'MISSING_FIELDS', message: 'Salon name, city, and your name are required.' } });
    }

    const slug = await uniqueSlug(customSlug ? toSlug(customSlug) : toSlug(salonName), jwt.tid);

    const [tenant] = await db.update(schema.tenants)
      .set({ name: salonName.trim(), city: city.trim(), ownerName: ownerName.trim(), slug, onboardingStep: 1 })
      .where(eq(schema.tenants.id, jwt.tid))
      .returning();

    await db.update(schema.users)
      .set({ name: ownerName.trim() })
      .where(eq(schema.users.id, jwt.sub));

    return reply.send({ ok: true, tenant: { name: tenant.name, slug: tenant.slug, city: tenant.city } });
  });

  // ── POST /onboarding/services ────────────────────────────────────────────
  app.post<{
    Body: {
      services: Array<{
        name: string;
        category?: string;
        durationMin: number;
        pricePaisa: number;
        bufferMin?: number;
      }>;
    };
  }>('/services', async (request, reply) => {
    const jwt = request.user as JWTPayload;
    if (jwt.role !== 'owner') {
      return reply.code(403).send({ ok: false, error: { code: 'FORBIDDEN', message: 'Only owners can complete onboarding.' } });
    }

    const { services } = request.body;
    if (!services?.length) {
      return reply.code(400).send({ ok: false, error: { code: 'NO_SERVICES', message: 'Add at least one service.' } });
    }

    const invalid = services.find(s => !s.name?.trim() || s.durationMin <= 0 || s.pricePaisa < 0);
    if (invalid) {
      return reply.code(400).send({ ok: false, error: { code: 'INVALID_SERVICE', message: 'Each service needs a name, a duration, and a price.' } });
    }

    const created = await db.insert(schema.services)
      .values(services.map(s => ({
        tenantId:    jwt.tid,
        name:        s.name.trim(),
        category:    s.category ?? null,
        durationMin: s.durationMin,
        pricePaisa:  s.pricePaisa,
        bufferMin:   s.bufferMin ?? 0,
      })))
      .returning();

    await db.update(schema.tenants)
      .set({ onboardingStep: 2 })
      .where(eq(schema.tenants.id, jwt.tid));

    return reply.send({ ok: true, services: created });
  });

  // ── POST /onboarding/hours ───────────────────────────────────────────────
  app.post<{
    Body: {
      hours: Array<{
        day:       number;
        isOpen:    boolean;
        openTime:  string;
        closeTime: string;
        breaks:    Array<{ from: string; to: string }>;
      }>;
    };
  }>('/hours', async (request, reply) => {
    const jwt = request.user as JWTPayload;
    if (jwt.role !== 'owner') {
      return reply.code(403).send({ ok: false, error: { code: 'FORBIDDEN', message: 'Only owners can complete onboarding.' } });
    }

    const { hours } = request.body;
    if (!hours || hours.length !== 7) {
      return reply.code(400).send({ ok: false, error: { code: 'INVALID_HOURS', message: 'Must provide hours for all 7 days (0 = Sunday … 6 = Saturday).' } });
    }

    await db.transaction(async (tx) => {
      // Delete any existing salon-wide hours for this tenant
      await tx.delete(schema.workingHours)
        .where(and(
          eq(schema.workingHours.tenantId, jwt.tid),
          sql`location_id IS NULL`,
        ));

      await tx.insert(schema.workingHours)
        .values(hours.map(h => ({
          tenantId:  jwt.tid,
          dayOfWeek: h.day,
          isOpen:    h.isOpen,
          openTime:  h.openTime,
          closeTime: h.closeTime,
          breaks:    h.breaks ?? [],
        })));

      await tx.update(schema.tenants)
        .set({ onboardingStep: 3, onboardingComplete: true })
        .where(eq(schema.tenants.id, jwt.tid));
    });

    return reply.send({ ok: true });
  });
}
