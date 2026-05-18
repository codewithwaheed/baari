// apps/api/src/routes/webhooks/whatsapp.ts
// Meta WhatsApp Cloud API webhook.
//
// GET  /webhooks/whatsapp — verification challenge
// POST /webhooks/whatsapp — inbound messages from all tenants
//
// Architecture:
//   1. Verify X-Hub-Signature-256 (HMAC-SHA256 with app secret)
//   2. ACK immediately with 200 (Meta requires < 20s, we do it < 500ms)
//   3. Push to BullMQ whatsapp-inbound queue for async processing
//   4. Worker extracts phone_number_id → Redis lookup → tenantId → handle

import type { FastifyInstance } from 'fastify';
import crypto from 'crypto';
import { whatsappInboundQueue } from '../../workers/queues';

export default async function whatsappWebhookRoutes(app: FastifyInstance) {
  // ── Webhook verification (one-time setup) ──────────────────────────────────
  app.get('/whatsapp', async (request, reply) => {
    const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } =
      request.query as Record<string, string>;

    if (mode === 'subscribe' && token === process.env['META_VERIFY_TOKEN']) {
      return reply.send(challenge);
    }
    return reply.code(403).send('Forbidden');
  });

  // ── Inbound messages ───────────────────────────────────────────────────────
  app.post('/whatsapp', {
    config: { rawBody: true }, // Fastify must have rawBody enabled for signature check
  }, async (request, reply) => {
    // Always ACK first — Meta will retry if we don't respond in time
    reply.code(200).send('OK');

    // Verify signature (HMAC-SHA256 of raw body with app secret)
    const signature = (request.headers['x-hub-signature-256'] as string) ?? '';
    const rawBody = (request as any).rawBody as Buffer;

    if (!verifyMetaSignature(rawBody, signature)) {
      app.log.warn('[whatsapp-webhook] Invalid signature — dropping');
      return;
    }

    // Push to queue — worker handles tenant routing + message processing
    await whatsappInboundQueue.add('inbound', request.body, {
      attempts: 5,
      backoff: { type: 'exponential', delay: 30_000 },
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 500 },
    });
  });
}

function verifyMetaSignature(rawBody: Buffer, signature: string): boolean {
  const appSecret = process.env['META_APP_SECRET'];
  if (!appSecret) return false;

  const expected = 'sha256=' + crypto
    .createHmac('sha256', appSecret)
    .update(rawBody)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(signature),
    );
  } catch {
    return false;
  }
}
