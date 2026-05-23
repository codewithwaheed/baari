// apps/api/src/routes/settings.ts
// Tenant settings — business info, working hours, payment config.

import type { FastifyInstance } from 'fastify';
import { eq, and, sql } from 'drizzle-orm';
import { withTenant, schema } from '@baari/db';
import type { JWTPayload } from '@baari/types';
import { z } from 'zod';

// ── Default working hours (9am–8pm Mon–Sat, closed Sun) ────────────────────────
const DEFAULT_HOURS = [0, 1, 2, 3, 4, 5, 6].map(day => ({
  dayOfWeek: day,
  isOpen:    day !== 0, // Sunday closed by default
  openTime:  '09:00',
  closeTime: '20:00',
  breaks:    [] as Array<{ from: string; to: string }>,
}));

const HourRowSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  isOpen:    z.boolean(),
  openTime:  z.string().regex(/^\d{2}:\d{2}$/),
  closeTime: z.string().regex(/^\d{2}:\d{2}$/),
  breaks:    z.array(z.object({ from: z.string(), to: z.string() })).default([]),
});

const BusinessSchema = z.object({
  name:               z.string().min(1).max(200).optional(),
  city:               z.string().max(100).optional(),
  address:            z.string().max(500).optional(),
  googleMapsUrl:      z.string().url().nullable().optional(),
  instagramHandle:    z.string().max(60).nullable().optional(),
  contactPhone:       z.string().max(30).nullable().optional(),
  ntn:                z.string().max(20).nullable().optional(),
  logoUrl:            z.string().url().nullable().optional(),
  advanceBookingDays: z.union([z.literal(7), z.literal(14), z.literal(30), z.literal(60)]).optional(),
  slotIntervalMin:    z.union([z.literal(15), z.literal(30)]).optional(),
  publicHolidays:     z.array(z.string()).optional(),
});

const PaymentSchema = z.object({
  iban:               z.string().max(40).nullable().optional(),
  depositPercent:     z.number().int().min(0).max(100).optional(),
  safepayKey:         z.string().nullable().optional(),
  jazzcashMerchantId: z.string().nullable().optional(),
  easypaisaStoreId:   z.string().nullable().optional(),
});

export default async function settingsRoutes(app: FastifyInstance) {
  app.addHook('onRequest', (app as any).authenticate);

  // ── GET /settings/hours ────────────────────────────────────────────────────
  app.get('/settings/hours', async (request, reply) => {
    const jwt = request.user as JWTPayload;

    const rows = await withTenant(jwt.tid, async (tx) =>
      tx
        .select({
          dayOfWeek: schema.workingHours.dayOfWeek,
          isOpen:    schema.workingHours.isOpen,
          openTime:  schema.workingHours.openTime,
          closeTime: schema.workingHours.closeTime,
          breaks:    schema.workingHours.breaks,
        })
        .from(schema.workingHours)
        .where(and(
          eq(schema.workingHours.tenantId, jwt.tid),
          // locationId IS NULL = tenant-wide hours (MVP uses single location defaults)
        ))
        .orderBy(schema.workingHours.dayOfWeek)
    );

    // Auto-seed defaults if no rows exist yet
    if (rows.length === 0) {
      return reply.send({ ok: true, data: DEFAULT_HOURS });
    }

    // Merge with defaults so all 7 days are always returned
    const byDay = Object.fromEntries(rows.map(r => [r.dayOfWeek, r]));
    const data = [0, 1, 2, 3, 4, 5, 6].map(d =>
      byDay[d] ?? DEFAULT_HOURS.find(h => h.dayOfWeek === d)!
    );

    return reply.send({ ok: true, data });
  });

  // ── PATCH /settings/hours ──────────────────────────────────────────────────
  app.patch('/settings/hours', async (request, reply) => {
    const jwt = request.user as JWTPayload;
    const body = z.array(HourRowSchema).safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ ok: false, error: { code: 'VALIDATION_ERROR', message: body.error.message } });
    }

    // Delete-then-insert: simpler than fighting Drizzle's partial-index upsert.
    // locationId IS NULL = tenant-wide hours (MVP single-location).
    await withTenant(jwt.tid, async (tx) => {
      await tx
        .delete(schema.workingHours)
        .where(and(
          eq(schema.workingHours.tenantId, jwt.tid),
          sql`location_id IS NULL`,
        ));

      if (body.data.length > 0) {
        await tx.insert(schema.workingHours).values(
          body.data.map(row => ({
            tenantId:  jwt.tid,
            dayOfWeek: row.dayOfWeek,
            isOpen:    row.isOpen,
            openTime:  row.openTime,
            closeTime: row.closeTime,
            breaks:    row.breaks,
          }))
        );
      }
    });

    return reply.send({ ok: true, data: null });
  });

  // ── GET /settings/business ─────────────────────────────────────────────────
  app.get('/settings/business', async (request, reply) => {
    const jwt = request.user as JWTPayload;

    const [tenant] = await withTenant(jwt.tid, async (tx) =>
      tx
        .select({
          name:               schema.tenants.name,
          city:               schema.tenants.city,
          address:            schema.tenants.address,
          googleMapsUrl:      schema.tenants.googleMapsUrl,
          instagramHandle:    schema.tenants.instagramHandle,
          contactPhone:       schema.tenants.contactPhone,
          ntn:                schema.tenants.ntn,
          logoUrl:            schema.tenants.logoUrl,
          advanceBookingDays: schema.tenants.advanceBookingDays,
          slotIntervalMin:    schema.tenants.slotIntervalMin,
          publicHolidays:     schema.tenants.publicHolidays,
        })
        .from(schema.tenants)
        .where(eq(schema.tenants.id, jwt.tid))
        .limit(1)
    );

    if (!tenant) return reply.code(404).send({ ok: false, error: { code: 'NOT_FOUND', message: 'Tenant not found' } });
    return reply.send({ ok: true, data: tenant });
  });

  // ── PATCH /settings/business ───────────────────────────────────────────────
  app.patch('/settings/business', async (request, reply) => {
    const jwt = request.user as JWTPayload;
    const body = BusinessSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ ok: false, error: { code: 'VALIDATION_ERROR', message: body.error.message } });
    }

    const updates: Record<string, unknown> = {};
    if (body.data.name               !== undefined) updates['name']               = body.data.name;
    if (body.data.city               !== undefined) updates['city']               = body.data.city;
    if (body.data.address            !== undefined) updates['address']            = body.data.address;
    if (body.data.googleMapsUrl      !== undefined) updates['googleMapsUrl']      = body.data.googleMapsUrl;
    if (body.data.instagramHandle    !== undefined) updates['instagramHandle']    = body.data.instagramHandle;
    if (body.data.contactPhone       !== undefined) updates['contactPhone']       = body.data.contactPhone;
    if (body.data.ntn                !== undefined) updates['ntn']                = body.data.ntn;
    if (body.data.logoUrl            !== undefined) updates['logoUrl']            = body.data.logoUrl;
    if (body.data.advanceBookingDays !== undefined) updates['advanceBookingDays'] = body.data.advanceBookingDays;
    if (body.data.slotIntervalMin    !== undefined) updates['slotIntervalMin']    = body.data.slotIntervalMin;
    if (body.data.publicHolidays     !== undefined) updates['publicHolidays']     = body.data.publicHolidays;

    if (Object.keys(updates).length === 0) {
      return reply.code(400).send({ ok: false, error: { code: 'NO_FIELDS', message: 'No fields to update' } });
    }

    updates['updatedAt'] = new Date();

    const [updated] = await withTenant(jwt.tid, async (tx) =>
      tx
        .update(schema.tenants)
        .set(updates as any)
        .where(eq(schema.tenants.id, jwt.tid))
        .returning({ name: schema.tenants.name })
    );

    if (!updated) return reply.code(404).send({ ok: false, error: { code: 'NOT_FOUND', message: 'Tenant not found' } });
    return reply.send({ ok: true, data: null });
  });

  // ── GET /settings/payments ─────────────────────────────────────────────────
  // Returns safe fields only — no raw gateway secrets returned.
  app.get('/settings/payments', async (request, reply) => {
    const jwt = request.user as JWTPayload;

    const [tenant] = await withTenant(jwt.tid, async (tx) =>
      tx
        .select({ paymentSettings: schema.tenants.paymentSettings })
        .from(schema.tenants)
        .where(eq(schema.tenants.id, jwt.tid))
        .limit(1)
    );

    const ps = tenant?.paymentSettings ?? {};
    return reply.send({
      ok: true,
      data: {
        iban:                    ps.iban ?? null,
        depositPercent:          ps.depositPercent ?? 0,
        hasSafepayKey:           !!ps.safepayKey,
        hasJazzcashMerchantId:   !!ps.jazzcashMerchantId,
        hasEasypaisaStoreId:     !!ps.easypaisaStoreId,
      },
    });
  });

  // ── PATCH /settings/payments ───────────────────────────────────────────────
  app.patch('/settings/payments', async (request, reply) => {
    const jwt = request.user as JWTPayload;
    const body = PaymentSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ ok: false, error: { code: 'VALIDATION_ERROR', message: body.error.message } });
    }

    // Fetch existing settings to merge (don't overwrite keys not in the patch)
    const [existing] = await withTenant(jwt.tid, async (tx) =>
      tx
        .select({ paymentSettings: schema.tenants.paymentSettings })
        .from(schema.tenants)
        .where(eq(schema.tenants.id, jwt.tid))
        .limit(1)
    );

    const current = existing?.paymentSettings ?? {};
    const merged = {
      ...current,
      ...(body.data.iban               !== undefined && { iban: body.data.iban }),
      ...(body.data.depositPercent      !== undefined && { depositPercent: body.data.depositPercent }),
      ...(body.data.safepayKey          !== undefined && { safepayKey: body.data.safepayKey }),
      ...(body.data.jazzcashMerchantId  !== undefined && { jazzcashMerchantId: body.data.jazzcashMerchantId }),
      ...(body.data.easypaisaStoreId    !== undefined && { easypaisaStoreId: body.data.easypaisaStoreId }),
    };

    await withTenant(jwt.tid, async (tx) =>
      tx
        .update(schema.tenants)
        .set({ paymentSettings: merged, updatedAt: new Date() })
        .where(eq(schema.tenants.id, jwt.tid))
    );

    return reply.send({ ok: true, data: null });
  });
}
