// apps/api/src/lib/auth/otp.ts
import { redis } from '../redis/client';

const OTP_TTL_SEC      = 300;   // 5 minutes — OTP validity
const VERIFIED_TTL_SEC = 600;   // 10 minutes — window to complete signup after OTP
const RATE_TTL_SEC     = 3600;  // 1 hour — rate limit window
const RATE_LIMIT       = 3;     // max OTPs per phone per hour

interface StoredOTP {
  otp: string;
  attempts: number;
}

export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function storeOTP(phone: string, otp: string): Promise<void> {
  const stored: StoredOTP = { otp, attempts: 0 };
  await redis.set(`otp:${phone}`, JSON.stringify(stored), 'EX', OTP_TTL_SEC);
}

export async function validateOTP(
  phone: string,
  submitted: string,
): Promise<'ok' | 'expired' | 'wrong' | 'locked'> {
  const key = `otp:${phone}`;
  const raw = await redis.get(key);
  if (!raw) return 'expired';

  const stored = JSON.parse(raw) as StoredOTP;
  stored.attempts += 1;

  if (stored.attempts >= 5) {
    await redis.del(key);
    return 'locked';
  }

  if (stored.otp !== submitted) {
    // Persist updated attempt count with remaining TTL
    const ttl = await redis.ttl(key);
    await redis.set(key, JSON.stringify(stored), 'EX', Math.max(ttl, 1));
    return 'wrong';
  }

  await redis.del(key);
  await redis.set(`verified:${phone}`, '1', 'EX', VERIFIED_TTL_SEC);
  return 'ok';
}

export async function isPhoneVerified(phone: string): Promise<boolean> {
  return (await redis.get(`verified:${phone}`)) === '1';
}

export async function clearPhoneVerified(phone: string): Promise<void> {
  await redis.del(`verified:${phone}`);
}

/** Returns true if under the limit (request is allowed). */
export async function checkOTPRateLimit(phone: string): Promise<boolean> {
  const key = `otp_rate:${phone}`;
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, RATE_TTL_SEC);
  return count <= RATE_LIMIT;
}

// Email OTP (for forgot-password)
export async function storeEmailOTP(email: string, otp: string): Promise<void> {
  const stored: StoredOTP = { otp, attempts: 0 };
  await redis.set(`email_otp:${email}`, JSON.stringify(stored), 'EX', 600);
}

export async function validateEmailOTP(
  email: string,
  submitted: string,
): Promise<'ok' | 'expired' | 'wrong' | 'locked'> {
  const key = `email_otp:${email}`;
  const raw = await redis.get(key);
  if (!raw) return 'expired';

  const stored = JSON.parse(raw) as StoredOTP;
  stored.attempts += 1;

  if (stored.attempts >= 5) {
    await redis.del(key);
    return 'locked';
  }

  if (stored.otp !== submitted) {
    const ttl = await redis.ttl(key);
    await redis.set(key, JSON.stringify(stored), 'EX', Math.max(ttl, 1));
    return 'wrong';
  }

  await redis.del(key);
  return 'ok';
}

export async function storeResetToken(userId: string, token: string): Promise<void> {
  await redis.set(`reset:${token}`, userId, 'EX', 600); // 10 minutes
}

export async function validateResetToken(token: string): Promise<string | null> {
  return redis.get(`reset:${token}`);
}

export async function deleteResetToken(token: string): Promise<void> {
  await redis.del(`reset:${token}`);
}
