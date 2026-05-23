// apps/api/src/routes/staff.ts
// Staff routes — tenant-scoped via JWT tid claim.

import type { FastifyInstance } from 'fastify';
import { eq, and, asc } from 'drizzle-orm';
import { withTenant, schema } from '@baari/db';
import type { JWTPayload } from '@baari/types';
import { z } from 'zod';

const DayScheduleSchema = z.object({
  isOpen:    z.boolean(),
  openTime:  z.string().regex(/^\d{2}:\d{2}$/),
  closeTime: z.string().regex(/^\d{2}:\d{2}$/),
  breaks:    z.array(z.object({ from: z.string(), to: z.string() })).default([]),
});

const WorkScheduleSchema = z.object({
  mon: DayScheduleSchema, tue: DayScheduleSchema, wed: DayScheduleSchema,
  thu: DayScheduleSchema, fri: DayScheduleSchema, sat: DayScheduleSchema,
  sun: DayScheduleSchema,
}).optional();

// Role is free text — owners can enter custom titles like "Senior Barber", "Color Specialist"
const CreateStaffSchema = z.object({
  name:              z.string().min(1).max(120),
  role:              z.string().min(1).max(80).default('Barber'),
  locationId:        z.string().uuid().optional(),
  workSchedule:      WorkScheduleSchema,
  specialisationIds: z.array(z.string().uuid()).optional(),
});

const UpdateStaffSchema = z.object({
  name:              z.string().min(1).max(120).optional(),
  role:              z.string().min(1).max(80).optional(),
  isActive:          z.boolean().optional(),
  workSchedule:      WorkScheduleSchema,
  specialisationIds: z.array(z.string().uuid()).nullable().optional(),
});

export default async function staffRoutes(app: FastifyInstance) {
  app.addHook('onRequest', (app as any).authenticate);

  // ── GET /staff ─────────────────────────────────────────────────────────────
  // Returns staff for the tenant. Default: active only.
  // ?includeInactive=true returns all (for settings view).
  app.get('/', async (request, reply) => {
    const jwt = request.user as JWTPayload;
    const { includeInactive } = request.query as { includeInactive?: string };
    const showAll = includeInactive === 'true';

    const rows = await withTenant(jwt.tid, async (tx) =>
      tx
        .select({
          id:                schema.staff.id,
          name:              schema.staff.name,
          role:              schema.staff.role,
          avatarUrl:         schema.staff.avatarUrl,
          isActive:          schema.staff.isActive,
          workSchedule:      schema.staff.workSchedule,
          specialisationIds: schema.staff.specialisationIds,
        })
        .from(schema.staff)
        .where(
          showAll
            ? eq(schema.staff.tenantId, jwt.tid)
            : and(eq(schema.staff.tenantId, jwt.tid), eq(schema.staff.isActive, true))
        )
        .orderBy(asc(schema.staff.createdAt))
    );

    return reply.send({ ok: true, data: rows });
  });

  // ── POST /staff ────────────────────────────────────────────────────────────
  app.post('/', async (request, reply) => {
    const jwt = request.user as JWTPayload;
    const body = CreateStaffSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ ok: false, error: { code: 'VALIDATION_ERROR', message: body.error.message } });
    }

    const [row] = await withTenant(jwt.tid, async (tx) =>
      tx
        .insert(schema.staff)
        .values({
          tenantId:          jwt.tid,
          locationId:        body.data.locationId ?? null,
          name:              body.data.name,
          role:              body.data.role,
          workSchedule:      body.data.workSchedule ?? null,
          specialisationIds: body.data.specialisationIds ?? null,
        })
        .returning({
          id:                schema.staff.id,
          name:              schema.staff.name,
          role:              schema.staff.role,
          avatarUrl:         schema.staff.avatarUrl,
          isActive:          schema.staff.isActive,
          workSchedule:      schema.staff.workSchedule,
          specialisationIds: schema.staff.specialisationIds,
        })
    );

    return reply.code(201).send({ ok: true, data: row });
  });

  // ── PATCH /staff/:id ───────────────────────────────────────────────────────
  app.patch('/:id', async (request, reply) => {
    const jwt = request.user as JWTPayload;
    const { id } = request.params as { id: string };
    const body = UpdateStaffSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ ok: false, error: { code: 'VALIDATION_ERROR', message: body.error.message } });
    }

    const updates: Record<string, unknown> = {};
    if (body.data.name              !== undefined) updates['name']              = body.data.name;
    if (body.data.role              !== undefined) updates['role']              = body.data.role;
    if (body.data.isActive          !== undefined) updates['isActive']          = body.data.isActive;
    if (body.data.workSchedule      !== undefined) updates['workSchedule']      = body.data.workSchedule;
    if (body.data.specialisationIds !== undefined) updates['specialisationIds'] = body.data.specialisationIds;

    if (Object.keys(updates).length === 0) {
      return reply.code(400).send({ ok: false, error: { code: 'NO_FIELDS', message: 'No fields to update' } });
    }

    const [row] = await withTenant(jwt.tid, async (tx) =>
      tx
        .update(schema.staff)
        .set(updates as any)
        .where(and(eq(schema.staff.id, id), eq(schema.staff.tenantId, jwt.tid)))
        .returning({
          id:                schema.staff.id,
          name:              schema.staff.name,
          role:              schema.staff.role,
          avatarUrl:         schema.staff.avatarUrl,
          isActive:          schema.staff.isActive,
          workSchedule:      schema.staff.workSchedule,
          specialisationIds: schema.staff.specialisationIds,
        })
    );

    if (!row) return reply.code(404).send({ ok: false, error: { code: 'NOT_FOUND', message: 'Staff member not found' } });
    return reply.send({ ok: true, data: row });
  });
}
