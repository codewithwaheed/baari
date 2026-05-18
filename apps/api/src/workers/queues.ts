// apps/api/src/workers/queues.ts
// BullMQ queue definitions — single source of truth for queue names.
// Workers in this directory consume these queues.

import { Queue } from 'bullmq';
import { redis } from '../lib/redis/client';

const connection = redis;

// Booking expiry — releases slot if payment not received in time
export const bookingExpiryQueue = new Queue('booking-expiry', { connection });

// WhatsApp reminders — sent 24h and 1h before appointment
export const reminderQueue = new Queue('whatsapp-reminder', { connection });

// WhatsApp inbound — all incoming messages from Meta webhook
export const whatsappInboundQueue = new Queue('whatsapp-inbound', { connection });

// Payment reconciliation — polls gateway for stuck PAYMENT_PENDING bookings
export const reconciliationQueue = new Queue('payment-reconciliation', { connection });
