// apps/api/src/routes/public.ts
// Public endpoints — no authentication required.
// Used by the public booking page for SSR/SEO metadata.

import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { db, schema } from '@baari/db';

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
}
