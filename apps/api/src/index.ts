// apps/api/src/index.ts
// Baari API — Fastify entry point.
// Registers all plugins, routes, and workers.

import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import jwt from '@fastify/jwt';
import cookie from '@fastify/cookie';

const app = Fastify({
  logger: {
    transport: process.env['NODE_ENV'] === 'development'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
    level: process.env['LOG_LEVEL'] ?? 'info',
  },
});

async function build() {
  // ── Security ──────────────────────────────────────────────────────────────
  await app.register(helmet);
  await app.register(cors, {
    origin: process.env['WEB_URL'] ?? 'http://localhost:3000',
    credentials: true,
  });
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    skipOnError: true,
  });

  // ── Cookies ───────────────────────────────────────────────────────────────
  await app.register(cookie);

  // ── Auth ──────────────────────────────────────────────────────────────────
  await app.register(jwt, {
    secret: process.env['JWT_SECRET'] ?? 'dev_secret_replace_in_production',
    // Accept token from httpOnly cookie (browsers send cookies, not Authorization headers)
    cookie: {
      cookieName: 'baari_token',
      signed: false,
    },
  });

  // ── Auth middleware ───────────────────────────────────────────────────────
  app.decorate('authenticate', async (request: any, reply: any) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.send(err);
    }
  });

  // ── Routes ────────────────────────────────────────────────────────────────
  await app.register(import('./routes/auth'),        { prefix: '/api/v1/auth' });
  await app.register(import('./routes/me'),          { prefix: '/api/v1/me' });
  await app.register(import('./routes/onboarding'),  { prefix: '/api/v1/onboarding' });
  await app.register(import('./routes/bookings'),   { prefix: '/api/v1/bookings' });
  await app.register(import('./routes/staff'),      { prefix: '/api/v1/staff' });
  await app.register(import('./routes/services'),   { prefix: '/api/v1/services' });
  await app.register(import('./routes/customers'),  { prefix: '/api/v1/customers' });
  await app.register(import('./routes/settings'),   { prefix: '/api/v1' });
  await app.register(import('./routes/public'),     { prefix: '/api/v1' });
  // await app.register(import('./routes/requests'), { prefix: '/api/v1/requests' });
  // await app.register(import('./routes/webhooks/whatsapp'), { prefix: '/webhooks' });
  // await app.register(import('./routes/webhooks/payments'), { prefix: '/webhooks' });

  // Health check
  app.get('/health', async () => ({ ok: true, ts: new Date().toISOString() }));

  return app;
}

const start = async () => {
  const server = await build();
  try {
    const port = parseInt(process.env['API_PORT'] ?? '3001');
    await server.listen({ port, host: '0.0.0.0' });
    server.log.info(`API running on port ${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
