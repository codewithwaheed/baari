// apps/api/src/routes/public.ts
// Public endpoints — no authentication required.
// Used by the public booking page for SSR/SEO metadata and the booking wizard.

import type { FastifyInstance } from 'fastify';
import { eq, and, gte, lte, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '@baari/db';

// ── Phone normalisation ───────────────────────────────────────────────────────
// Accepts Pakistani formats: 03XX-XXXXXXX, 03XXXXXXXXX, +923XXXXXXXXX
// Returns E.164 (+923XXXXXXXXX) or null if unrecognisable.
function normalisePKPhone(raw: string): string | null {
  const cleaned = raw.replace(/[\s\-()]/g, '');
  if (/^\+92\d{10}$/.test(cleaned)) return cleaned;                // already E.164
  if (/^92\d{10}$/.test(cleaned))   return '+' + cleaned;         // 92...
  if (/^03\d{9}$/.test(cleaned))    return '+92' + cleaned.slice(1); // 03...
  return null;
}

export default async function publicRoutes(app: FastifyInstance) {

  // ── GET /public/salon/:slug ────────────────────────────────────────────────
  // Returns public-facing salon info for a given slug.
  // Used by book/[slug]/page.tsx in generateMetadata and JSON-LD.
  app.get('/public/salon/:slug', async (request, reply) => {
    const { slug } = request.params as { slug: string };

    const tenant = await db.query.tenants.findFirst({
      where: eq(schema.tenants.slug, slug),
      columns: {
        name:            true,
        slug:            true,
        city:            true,
        address:         true,
        logoUrl:         true,
        instagramHandle: true,
        contactPhone:    true,
      },
    });

    if (!tenant) {
      return reply.code(404).send({ ok: false, error: { code: 'NOT_FOUND', message: 'Salon not found' } });
    }

    return reply.send({ ok: true, data: tenant });
  });

  // ── GET /public/salon/:slug/services ──────────────────────────────────────
  // Active services for the booking wizard service-selection step.
  app.get('/public/salon/:slug/services', async (request, reply) => {
    const { slug } = request.params as { slug: string };

    const tenant = await db.query.tenants.findFirst({
      where: eq(schema.tenants.slug, slug),
      columns: { id: true },
    });

    if (!tenant) {
      return reply.code(404).send({ ok: false, error: { code: 'NOT_FOUND', message: 'Salon not found' } });
    }

    const rows = await db
      .select({
        id:          schema.services.id,
        name:        schema.services.name,
        category:    schema.services.category,
        durationMin: schema.services.durationMin,
        pricePaisa:  schema.services.pricePaisa,
      })
      .from(schema.services)
      .where(and(
        eq(schema.services.tenantId, tenant.id),
        eq(schema.services.isActive, true),
      ))
      .orderBy(schema.services.category, schema.services.name);

    return reply.send({ ok: true, data: rows });
  });

  // ── GET /public/salon/:slug/staff ─────────────────────────────────────────
  // Active staff for the booking wizard staff-selection step.
  app.get('/public/salon/:slug/staff', async (request, reply) => {
    const { slug } = request.params as { slug: string };

    const tenant = await db.query.tenants.findFirst({
      where: eq(schema.tenants.slug, slug),
      columns: { id: true },
    });

    if (!tenant) {
      return reply.code(404).send({ ok: false, error: { code: 'NOT_FOUND', message: 'Salon not found' } });
    }

    const rows = await db
      .select({
        id:        schema.staff.id,
        name:      schema.staff.name,
        role:      schema.staff.role,
        avatarUrl: schema.staff.avatarUrl,
      })
      .from(schema.staff)
      .where(and(
        eq(schema.staff.tenantId, tenant.id),
        eq(schema.staff.isActive, true),
      ))
      .orderBy(schema.staff.name);

    return reply.send({ ok: true, data: rows });
  });

  // ── GET /public/salon/:slug/availability ──────────────────────────────────
  // Available time slots for a given staff + date + service duration.
  // Mirrors GET /api/v1/bookings/availability but resolved from slug, no JWT.
  app.get('/public/salon/:slug/availability', async (request, reply) => {
    const { slug } = request.params as { slug: string };

    const QuerySchema = z.object({
      staffId:            z.string().uuid(),
      date:               z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      serviceDurationMin: z.coerce.number().int().positive(),
    });

    const parsed = QuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ ok: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.message } });
    }

    const { staffId, date, serviceDurationMin } = parsed.data;
    const durationHours = serviceDurationMin / 60;

    const tenant = await db.query.tenants.findFirst({
      where: eq(schema.tenants.slug, slug),
      columns: { id: true },
    });

    if (!tenant) {
      return reply.code(404).send({ ok: false, error: { code: 'NOT_FOUND', message: 'Salon not found' } });
    }

    const tenantId = tenant.id;

    // Karachi midnight for the requested date
    const dayStart  = new Date(`${date}T00:00:00+05:00`);
    const dayEnd    = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    const dayOfWeek = dayStart.getDay(); // 0=Sun … 6=Sat

    const [whRows, bookingRows] = await Promise.all([
      db.select()
        .from(schema.workingHours)
        .where(and(
          eq(schema.workingHours.tenantId, tenantId),
          eq(schema.workingHours.dayOfWeek, dayOfWeek),
        ))
        .limit(1),
      db.select({ startTime: schema.bookings.startTime, endTime: schema.bookings.endTime })
        .from(schema.bookings)
        .where(and(
          eq(schema.bookings.tenantId, tenantId),
          eq(schema.bookings.staffId, staffId),
          gte(schema.bookings.startTime, dayStart),
          lte(schema.bookings.startTime, dayEnd),
          inArray(schema.bookings.state, ['PAYMENT_PENDING', 'CONFIRMED', 'CHECKED_IN', 'COMPLETED']),
        )),
    ]);

    const wh = whRows[0];

    if (wh && !wh.isOpen) {
      return reply.send({ ok: true, data: [] });
    }

    const openTime  = wh?.openTime  ?? '09:00';
    const closeTime = wh?.closeTime ?? '20:00';
    const breaks    = (wh?.breaks ?? []) as Array<{ from: string; to: string }>;

    function parseHHMM(t: string): number {
      const [hh, mm] = t.split(':').map(Number);
      return (hh ?? 0) + (mm ?? 0) / 60;
    }

    const openHour  = parseHHMM(openTime);
    const closeHour = parseHHMM(closeTime);

    const dayStartMs = dayStart.getTime();
    const bookedSlots = bookingRows.map(b => ({
      start: (b.startTime.getTime() - dayStartMs) / 3_600_000,
      end:   (b.endTime.getTime()   - dayStartMs) / 3_600_000,
    }));

    const breakSlots = breaks.map(b => ({
      start: parseHHMM(b.from),
      end:   parseHHMM(b.to),
    }));

    function overlaps(aS: number, aE: number, bS: number, bE: number): boolean {
      return aS < bE && aE > bS;
    }

    function fmtLabel(h: number): string {
      const period  = h >= 12 ? 'pm' : 'am';
      const hr      = Math.floor(h);
      const m       = Math.round((h - hr) * 60);
      const display = hr > 12 ? hr - 12 : hr === 0 ? 12 : hr;
      return m ? `${display}:${String(m).padStart(2, '0')}${period}` : `${display}${period}`;
    }

    // Only return future slots (if date is today, filter past times)
    const nowKarachi = new Date();
    const nowHour = dayStart.toDateString() === nowKarachi.toDateString()
      ? (nowKarachi.getTime() - dayStartMs) / 3_600_000
      : 0;

    const slots: { startHour: number; endHour: number; label: string }[] = [];

    for (let h = openHour; h + durationHours <= closeHour; h += 0.5) {
      const slotEnd = parseFloat((h + durationHours).toFixed(4));
      if (h <= nowHour) continue; // skip past slots for today
      if (bookedSlots.some(b => overlaps(h, slotEnd, b.start, b.end))) continue;
      if (breakSlots.some(b  => overlaps(h, slotEnd, b.start, b.end))) continue;
      slots.push({ startHour: h, endHour: slotEnd, label: fmtLabel(h) });
    }

    return reply.send({ ok: true, data: slots });
  });

  // ── POST /public/salon/:slug/book ─────────────────────────────────────────
  // Creates a booking_request row. No auth. Finds or creates the customer by phone.
  app.post('/public/salon/:slug/book', async (request, reply) => {
    const { slug } = request.params as { slug: string };

    const BodySchema = z.object({
      serviceIds:    z.array(z.string().uuid()).min(1, 'At least one service is required'),
      staffId:       z.string().uuid(),
      requestedAt:   z.string().datetime({ offset: true }),
      customerName:  z.string().min(1).max(100).trim(),
      customerPhone: z.string().min(1).max(20),
    });

    const parsed = BodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ ok: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.message } });
    }

    const { serviceIds, staffId, requestedAt, customerName, customerPhone } = parsed.data;

    // Normalise phone to E.164
    const phoneE164 = normalisePKPhone(customerPhone);
    if (!phoneE164) {
      return reply.code(400).send({ ok: false, error: { code: 'INVALID_PHONE', message: 'Invalid Pakistani phone number' } });
    }

    // Resolve tenant from slug
    const tenant = await db.query.tenants.findFirst({
      where: eq(schema.tenants.slug, slug),
      columns: { id: true },
    });

    if (!tenant) {
      return reply.code(404).send({ ok: false, error: { code: 'NOT_FOUND', message: 'Salon not found' } });
    }

    const tenantId = tenant.id;

    // Validate all services belong to tenant and are active
    const serviceRows = await db
      .select({ id: schema.services.id, pricePaisa: schema.services.pricePaisa })
      .from(schema.services)
      .where(and(
        inArray(schema.services.id, serviceIds),
        eq(schema.services.tenantId, tenantId),
        eq(schema.services.isActive, true),
      ));

    if (serviceRows.length !== serviceIds.length) {
      return reply.code(404).send({ ok: false, error: { code: 'SERVICE_NOT_FOUND', message: 'One or more services not found or inactive' } });
    }

    // Preserve caller order; sum total price
    const orderedServices = serviceIds.map(id => serviceRows.find(s => s.id === id)!);
    const totalPricePaisa = orderedServices.reduce((sum, s) => sum + s.pricePaisa, 0);

    // Validate staff belongs to tenant and is active
    const [staffRow] = await db
      .select({ id: schema.staff.id })
      .from(schema.staff)
      .where(and(
        eq(schema.staff.id, staffId),
        eq(schema.staff.tenantId, tenantId),
        eq(schema.staff.isActive, true),
      ))
      .limit(1);

    if (!staffRow) {
      return reply.code(404).send({ ok: false, error: { code: 'STAFF_NOT_FOUND', message: 'Staff not found or inactive' } });
    }

    // Find or create customer by (tenantId, phoneE164)
    const [existing] = await db
      .select({ id: schema.customers.id })
      .from(schema.customers)
      .where(and(
        eq(schema.customers.tenantId, tenantId),
        eq(schema.customers.phoneE164, phoneE164),
      ))
      .limit(1);

    let customerId: string;

    if (existing) {
      customerId = existing.id;
    } else {
      const [created] = await db
        .insert(schema.customers)
        .values({ tenantId, phoneE164, name: customerName })
        .returning({ id: schema.customers.id });
      customerId = created!.id;
    }

    // Insert booking_request — serviceId = primary (first), serviceIds = all
    const [req] = await db
      .insert(schema.bookingRequests)
      .values({
        tenantId,
        customerId,
        serviceId:           serviceIds[0]!,
        serviceIds,
        staffId,
        requestedAt:         new Date(requestedAt),
        requestedPricePaisa: totalPricePaisa,
        paid:                false,
        state:               'pending',
      })
      .returning({ id: schema.bookingRequests.id, requestedAt: schema.bookingRequests.requestedAt });

    return reply.code(201).send({ ok: true, data: { id: req!.id, requestedAt: req!.requestedAt.toISOString() } });
  });
}
