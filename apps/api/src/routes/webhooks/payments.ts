// apps/api/src/routes/webhooks/payments.ts
// Payment gateway IPN (Instant Payment Notification) handler.
//
// POST /webhooks/payments/jazzcash
// POST /webhooks/payments/easypaisa
// POST /webhooks/payments/safepay
//
// All handlers are IDEMPOTENT — safe to call multiple times for same txn.
// Deduplication key: txn_ref (gateway transaction reference).
// Always use SELECT FOR UPDATE to prevent concurrent processing.
//
// Critical: webhooks miss ~1-2% in the field.
// Reconciliation cron (every 60s) polls gateways for stuck PAYMENT_PENDING bookings.

import type { FastifyInstance } from 'fastify';
import crypto from 'crypto';
import { eq, and } from 'drizzle-orm';
import { withTenant, schema } from '@baari/db';
import { releaseSlotLock } from '../../lib/redis/client';
import { reminderQueue } from '../../workers/queues';

export default async function paymentWebhookRoutes(app: FastifyInstance) {

  // ── JazzCash IPN ──────────────────────────────────────────────────────────
  // IPN is signed — verify pp_SecureHash before processing
  app.post('/payments/jazzcash', async (request, reply) => {
    reply.code(200).send('OK'); // ACK first

    const payload = request.body as Record<string, string>;

    // Verify JazzCash SecureHash
    if (!verifyJazzCashHash(payload)) {
      app.log.warn('[jazzcash] invalid hash — dropping');
      return;
    }

    const txnRef = payload['pp_TxnRefNo'];
    const success = payload['pp_ResponseCode'] === '000';
    const bookingId = payload['pp_BillReference']; // we set this when creating the payment
    const tenantId = payload['pp_MerchantID'];     // or look up via txnRef

    if (!txnRef || !bookingId || !tenantId) return;

    await processPaymentResult({ tenantId, bookingId, txnRef, gateway: 'jazzcash', success, rawResponse: payload });
  });

  // ── EasyPaisa IPN ─────────────────────────────────────────────────────────
  // EasyPaisa IPN is UNSIGNED — always call Inquire-Status to validate
  app.post('/payments/easypaisa', async (request, reply) => {
    reply.code(200).send('OK');

    const payload = request.body as Record<string, string>;
    const txnRef = payload['transactionId'] ?? payload['txnRefNo'];
    const bookingId = payload['orderRefNum'];
    const tenantId = payload['storeId']; // or look up

    if (!txnRef || !bookingId || !tenantId) return;

    // TODO: call EasyPaisa Inquire-Status API to verify (IPN is unsigned)
    // const verified = await inquireEasypaisaTransaction(txnRef);
    // const success = verified.responseCode === '0000';
    const success = payload['responseCode'] === '0000'; // validate via inquiry in production

    await processPaymentResult({ tenantId, bookingId, txnRef, gateway: 'easypaisa', success, rawResponse: payload });
  });

  // ── Safepay webhook ────────────────────────────────────────────────────────
  app.post('/payments/safepay', async (request, reply) => {
    reply.code(200).send('OK');

    const signature = request.headers['x-safepay-signature'] as string;
    const rawBody = (request as any).rawBody as Buffer;

    if (!verifySafepaySignature(rawBody, signature)) {
      app.log.warn('[safepay] invalid signature — dropping');
      return;
    }

    const payload = request.body as any;
    const txnRef = payload?.tracker?.token;
    const bookingId = payload?.order?.ref;
    const tenantId = payload?.merchant?.uid;
    const success = payload?.status === 'paid';

    if (!txnRef || !bookingId || !tenantId) return;

    await processPaymentResult({ tenantId, bookingId, txnRef, gateway: 'safepay', success, rawResponse: payload });
  });
}

// ─── Core payment processing (idempotent) ─────────────────────────────────────

async function processPaymentResult({
  tenantId, bookingId, txnRef, gateway, success, rawResponse,
}: {
  tenantId: string;
  bookingId: string;
  txnRef: string;
  gateway: 'jazzcash' | 'easypaisa' | 'safepay';
  success: boolean;
  rawResponse: unknown;
}) {
  await withTenant(tenantId, async (tx) => {
    // Lock booking row — prevents concurrent IPN handling + expiry worker race
    const [booking] = await tx.select().from(schema.bookings)
      .where(and(
        eq(schema.bookings.id, bookingId),
        eq(schema.bookings.tenantId, tenantId),
      ))
      .for('update');

    if (!booking) return;

    // Idempotency — skip if already resolved
    if (booking.state === 'CONFIRMED' || booking.state === 'COMPLETED' || booking.state === 'REFUNDED' as any) {
      return;
    }

    // Upsert payment record
    await tx.insert(schema.payments).values({
      bookingId,
      tenantId,
      gateway,
      txnRef,
      amountPaisa: booking.pricePaisa,
      state: success ? 'SUCCESS' : 'FAILED',
      rawResponse: JSON.stringify(rawResponse),
    }).onConflictDoUpdate({
      target: schema.payments.txnRef,
      set: {
        state: success ? 'SUCCESS' : 'FAILED',
        rawResponse: JSON.stringify(rawResponse),
        updatedAt: new Date(),
      },
    });

    if (success) {
      await tx.update(schema.bookings)
        .set({ state: 'CONFIRMED', updatedAt: new Date() })
        .where(eq(schema.bookings.id, bookingId));

      // Enqueue reminder jobs
      const msUntil24hBefore = booking.startTime.getTime() - Date.now() - 24 * 60 * 60 * 1000;
      const msUntil1hBefore  = booking.startTime.getTime() - Date.now() - 60 * 60 * 1000;

      if (msUntil24hBefore > 0) {
        await reminderQueue.add('reminder', { bookingId, tenantId, type: '24h' }, { delay: msUntil24hBefore });
      }
      if (msUntil1hBefore > 0) {
        await reminderQueue.add('reminder', { bookingId, tenantId, type: '1h' }, { delay: msUntil1hBefore });
      }
    } else {
      await tx.update(schema.bookings)
        .set({ state: 'EXPIRED', updatedAt: new Date() })
        .where(eq(schema.bookings.id, bookingId));
    }
  });
}

// ─── Signature verification ───────────────────────────────────────────────────

function verifyJazzCashHash(params: Record<string, string>): boolean {
  const salt = process.env['JAZZCASH_INTEGRITY_SALT'] ?? '';
  const ppFields: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    if (k.startsWith('pp_') && v !== '') ppFields[k] = v;
  }
  const sorted = Object.keys(ppFields).sort();
  const msg = salt + '&' + sorted.map(k => ppFields[k]).join('&');
  const expected = crypto.createHmac('sha256', salt).update(msg).digest('hex').toLowerCase();
  return expected === (params['pp_SecureHash'] ?? '').toLowerCase();
}

function verifySafepaySignature(rawBody: Buffer, signature: string): boolean {
  const secret = process.env['SAFEPAY_WEBHOOK_SECRET'] ?? '';
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature ?? ''));
  } catch { return false; }
}
