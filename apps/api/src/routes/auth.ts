// apps/api/src/routes/auth.ts
import { randomUUID } from 'crypto';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { db, schema } from '@baari/db';
import type { JWTPayload } from '@baari/types';
import { authRedis as redis } from '../lib/redis/client';
import {
  generateOTP, storeOTP, validateOTP,
  isPhoneVerified, clearPhoneVerified, checkOTPRateLimit,
  storeEmailOTP, validateEmailOTP,
  storeResetToken, validateResetToken, deleteResetToken,
} from '../lib/auth/otp';
import {
  hashPassword, verifyPassword, isLockedOut,
  recordFailedAttempt, resetLoginAttempts, updatePasswordHash,
} from '../lib/auth/password';
import {
  createRefreshToken, validateRefreshToken, rotateRefreshToken,
  revokeAllRefreshTokens, setCookies, clearCookies,
} from '../lib/auth/tokens';
import { sendOTP } from '../lib/auth/sms';
import { sendEmailOTP } from '../lib/auth/email';

/** Normalize Pakistani phone → E.164.  03001234567 → +923001234567 */
function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('92')) return `+${digits}`;
  if (digits.startsWith('0'))  return `+92${digits.slice(1)}`;
  if (digits.startsWith('3'))  return `+92${digits}`;
  return `+${digits}`;
}

function isValidPhone(phone: string): boolean {
  return /^\+923\d{9}$/.test(phone);
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  return `${local![0]}***@${domain}`;
}

export default async function authRoutes(app: FastifyInstance) {

  // Convert Redis-unavailable errors to 503 so clients get a clear signal
  // instead of a generic 500 when the cache layer is not reachable.
  app.setErrorHandler((err, _req, reply) => {
    if (err.message?.includes('max retries per request') || err.message?.includes('ECONNREFUSED')) {
      return reply.code(503).send({ ok: false, error: { code: 'SERVICE_UNAVAILABLE', message: 'Service temporarily unavailable. Please try again in a moment.' } });
    }
    throw err;
  });

  // ── POST /auth/send-otp ──────────────────────────────────────────────────
  app.post<{ Body: { phone: string } }>('/send-otp', async (request, reply) => {
    const phone = normalizePhone(request.body.phone ?? '');
    if (!isValidPhone(phone)) {
      return reply.code(400).send({ ok: false, error: { code: 'INVALID_PHONE', message: 'Enter a valid Pakistani mobile number (03XX...)' } });
    }

    const existing = await db.query.users.findFirst({ where: eq(schema.users.phoneE164, phone) });
    if (existing) {
      return reply.code(409).send({ ok: false, error: { code: 'PHONE_EXISTS', message: 'An account with this number already exists. Please log in.' } });
    }

    const allowed = await checkOTPRateLimit(phone);
    if (!allowed) {
      return reply.code(429).send({ ok: false, error: { code: 'RATE_LIMITED', message: 'Too many attempts. Try again in an hour.' } });
    }

    const otp = generateOTP();
    await storeOTP(phone, otp);
    await sendOTP(phone, otp);

    return reply.send({ ok: true, expiresIn: 300 });
  });

  // ── POST /auth/verify-otp ────────────────────────────────────────────────
  app.post<{ Body: { phone: string; otp: string } }>('/verify-otp', async (request, reply) => {
    const phone = normalizePhone(request.body.phone ?? '');
    const result = await validateOTP(phone, request.body.otp ?? '');

    if (result === 'expired') return reply.code(401).send({ ok: false, error: { code: 'OTP_EXPIRED',  message: 'Code expired. Request a new one.' } });
    if (result === 'locked')  return reply.code(401).send({ ok: false, error: { code: 'OTP_LOCKED',   message: 'Too many wrong attempts. Request a new code.' } });
    if (result === 'wrong')   return reply.code(401).send({ ok: false, error: { code: 'OTP_WRONG',    message: 'Wrong code. Try again.' } });

    return reply.send({ ok: true, phoneVerified: true });
  });

  // ── POST /auth/complete-signup ───────────────────────────────────────────
  app.post<{ Body: { phone: string; password: string; ownerName?: string } }>('/complete-signup', async (request, reply) => {
    const phone = normalizePhone(request.body.phone ?? '');
    const { password, ownerName } = request.body;

    if (!isValidPhone(phone)) {
      return reply.code(400).send({ ok: false, error: { code: 'INVALID_PHONE', message: 'Invalid phone number' } });
    }
    if (!password || password.length < 8) {
      return reply.code(400).send({ ok: false, error: { code: 'PASSWORD_TOO_SHORT', message: 'Password must be at least 8 characters' } });
    }

    const verified = await isPhoneVerified(phone);
    if (!verified) {
      return reply.code(400).send({ ok: false, error: { code: 'PHONE_NOT_VERIFIED', message: 'Phone number was not verified in this session. Start over.' } });
    }

    const duplicate = await db.query.users.findFirst({ where: eq(schema.users.phoneE164, phone) });
    if (duplicate) {
      return reply.code(409).send({ ok: false, error: { code: 'ALREADY_REGISTERED', message: 'Account already exists. Please log in.' } });
    }

    const passwordHash = await hashPassword(password);
    const newTenantId  = randomUUID();
    const slug         = `shop-${randomUUID().slice(0, 8)}`;

    const { user, location } = await db.transaction(async (tx) => {
      const [tenant] = await tx.insert(schema.tenants).values({
        id: newTenantId,
        slug,
        name: ownerName ? `${ownerName}'s Salon` : 'My Salon',
        onboardingStep: 0,
        onboardingComplete: false,
      }).returning();

      const [location] = await tx.insert(schema.locations).values({
        tenantId: newTenantId,
        name: 'Main Branch',
      }).returning();

      const [user] = await tx.insert(schema.users).values({
        tenantId:      newTenantId,
        phoneE164:     phone,
        name:          ownerName ?? 'Owner',
        role:          'owner',
        passwordHash,
        phoneVerified: true,
      }).returning();

      return { tenant, user, location };
    });

    await clearPhoneVerified(phone);

    const jwtPayload: Omit<JWTPayload, 'iat' | 'exp'> = {
      sub:  user.id,
      tid:  newTenantId,
      role: 'owner',
      loc:  [location.id],
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const jwt          = app.jwt.sign(jwtPayload, { expiresIn: '7d' } as any);
    const refreshToken = await createRefreshToken(user.id, redis);
    setCookies(reply, jwt, refreshToken);

    return reply.send({ ok: true, isNewUser: true, user: { id: user.id, name: user.name, role: user.role } });
  });

  // ── POST /auth/login ─────────────────────────────────────────────────────
  app.post<{ Body: { phone: string; password: string } }>('/login', async (request, reply) => {
    const phone = normalizePhone(request.body.phone ?? '');

    const user = await db.query.users.findFirst({ where: eq(schema.users.phoneE164, phone) });
    if (!user || !user.passwordHash) {
      return reply.code(401).send({ ok: false, error: { code: 'NOT_FOUND', message: 'No account found with this number.' } });
    }

    const lockStatus = isLockedOut(user);
    if (lockStatus.locked) {
      return reply.code(429).send({ ok: false, error: { code: 'LOCKED', message: `Too many failed attempts. Try again in ${lockStatus.minutesLeft} minutes.` } });
    }

    const valid = await verifyPassword(request.body.password ?? '', user.passwordHash);
    if (!valid) {
      const nowLocked = await recordFailedAttempt(user.id);
      const msg = nowLocked
        ? 'Too many failed attempts. Account locked for 15 minutes.'
        : 'Wrong password.';
      return reply.code(401).send({ ok: false, error: { code: 'WRONG_PASSWORD', message: msg } });
    }

    await resetLoginAttempts(user.id);

    const [locations, tenant] = await Promise.all([
      db.query.locations.findMany({ where: eq(schema.locations.tenantId, user.tenantId) }),
      db.query.tenants.findFirst({ where: eq(schema.tenants.id, user.tenantId) }),
    ]);

    const jwtPayload: Omit<JWTPayload, 'iat' | 'exp'> = {
      sub:  user.id,
      tid:  user.tenantId,
      role: user.role as JWTPayload['role'],
      loc:  locations.map(l => l.id),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const jwt          = app.jwt.sign(jwtPayload, { expiresIn: '7d' } as any);
    const refreshToken = await createRefreshToken(user.id, redis);
    setCookies(reply, jwt, refreshToken);

    return reply.send({
      ok: true,
      user: { id: user.id, name: user.name, role: user.role, tenantId: user.tenantId },
      onboarding: {
        complete: tenant?.onboardingComplete ?? false,
        step:     tenant?.onboardingStep     ?? 0,
      },
    });
  });

  // ── POST /auth/forgot-password ───────────────────────────────────────────
  app.post<{ Body: { phone: string } }>('/forgot-password', async (request, reply) => {
    const phone = normalizePhone(request.body.phone ?? '');
    const user  = await db.query.users.findFirst({ where: eq(schema.users.phoneE164, phone) });

    // Always return 200 — never reveal if phone exists
    if (!user) {
      return reply.send({ ok: true, method: 'sms', hint: null });
    }

    const otp = generateOTP();

    if (user.email) {
      await storeEmailOTP(user.email, otp);
      await sendEmailOTP(user.email, otp);
      return reply.send({ ok: true, method: 'email', hint: maskEmail(user.email) });
    }

    await storeOTP(phone, otp);
    await sendOTP(phone, otp);
    return reply.send({ ok: true, method: 'sms', hint: null });
  });

  // ── POST /auth/verify-reset-otp ─────────────────────────────────────────────
  // Verifies the OTP sent by /forgot-password, issues a one-time reset token.
  app.post<{ Body: { phone: string; otp: string } }>('/verify-reset-otp', async (request, reply) => {
    const phone = normalizePhone(request.body.phone ?? '');
    const result = await validateOTP(phone, request.body.otp ?? '');

    if (result === 'expired') return reply.code(401).send({ ok: false, error: { code: 'OTP_EXPIRED',  message: 'Code expired. Request a new one.' } });
    if (result === 'locked')  return reply.code(401).send({ ok: false, error: { code: 'OTP_LOCKED',   message: 'Too many wrong attempts. Request a new code.' } });
    if (result === 'wrong')   return reply.code(401).send({ ok: false, error: { code: 'OTP_WRONG',    message: 'Wrong code. Try again.' } });

    const user = await db.query.users.findFirst({ where: eq(schema.users.phoneE164, phone) });
    if (!user) {
      return reply.code(404).send({ ok: false, error: { code: 'USER_NOT_FOUND', message: 'No account found.' } });
    }

    const resetToken = randomUUID();
    await storeResetToken(user.id, resetToken);

    return reply.send({ ok: true, resetToken });
  });

  // ── POST /auth/send-email-otp ────────────────────────────────────────────
  app.post<{ Body: { email: string } }>('/send-email-otp', async (request, reply) => {
    const { email } = request.body;
    if (!email) {
      return reply.code(400).send({ ok: false, error: { code: 'INVALID_EMAIL', message: 'Email required' } });
    }

    const user = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
    if (user) {
      const otp = generateOTP();
      await storeEmailOTP(email, otp);
      await sendEmailOTP(email, otp);
    }
    // Always return 200
    return reply.send({ ok: true, message: 'Check your email' });
  });

  // ── POST /auth/verify-email-otp ──────────────────────────────────────────
  app.post<{ Body: { email: string; otp: string } }>('/verify-email-otp', async (request, reply) => {
    const { email, otp } = request.body;
    const result = await validateEmailOTP(email ?? '', otp ?? '');

    if (result === 'expired') return reply.code(401).send({ ok: false, error: { code: 'OTP_EXPIRED', message: 'Code expired. Request a new one.' } });
    if (result === 'locked')  return reply.code(401).send({ ok: false, error: { code: 'OTP_LOCKED',  message: 'Too many attempts.' } });
    if (result === 'wrong')   return reply.code(401).send({ ok: false, error: { code: 'OTP_WRONG',   message: 'Wrong code.' } });

    const user = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
    if (!user) return reply.code(401).send({ ok: false, error: { code: 'USER_NOT_FOUND', message: 'User not found.' } });

    const locations = await db.query.locations.findMany({ where: eq(schema.locations.tenantId, user.tenantId) });

    const jwtPayload: Omit<JWTPayload, 'iat' | 'exp'> = {
      sub:  user.id,
      tid:  user.tenantId,
      role: user.role as JWTPayload['role'],
      loc:  locations.map(l => l.id),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const jwt          = app.jwt.sign(jwtPayload, { expiresIn: '7d' } as any);
    const refreshToken = await createRefreshToken(user.id, redis);
    setCookies(reply, jwt, refreshToken);

    return reply.send({ ok: true, user: { id: user.id, name: user.name, role: user.role } });
  });

  // ── POST /auth/reset-password ────────────────────────────────────────────
  app.post<{ Body: { resetToken: string; newPassword: string } }>('/reset-password', async (request, reply) => {
    const { resetToken, newPassword } = request.body;

    if (!newPassword || newPassword.length < 8) {
      return reply.code(400).send({ ok: false, error: { code: 'PASSWORD_TOO_SHORT', message: 'Password must be at least 8 characters' } });
    }

    const userId = await validateResetToken(resetToken ?? '');
    if (!userId) {
      return reply.code(401).send({ ok: false, error: { code: 'INVALID_RESET_TOKEN', message: 'Reset link expired. Request a new one.' } });
    }

    const hash = await hashPassword(newPassword);
    await updatePasswordHash(userId, hash);
    await deleteResetToken(resetToken);
    await revokeAllRefreshTokens(userId, redis);

    const user = await db.query.users.findFirst({ where: eq(schema.users.id, userId) });
    if (!user) return reply.code(500).send({ ok: false, error: { code: 'SERVER_ERROR', message: 'User not found after reset' } });

    const locations = await db.query.locations.findMany({ where: eq(schema.locations.tenantId, user.tenantId) });

    const jwtPayload: Omit<JWTPayload, 'iat' | 'exp'> = {
      sub:  user.id,
      tid:  user.tenantId,
      role: user.role as JWTPayload['role'],
      loc:  locations.map(l => l.id),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const jwt          = app.jwt.sign(jwtPayload, { expiresIn: '7d' } as any);
    const refreshToken = await createRefreshToken(user.id, redis);
    setCookies(reply, jwt, refreshToken);

    return reply.send({ ok: true });
  });

  // ── POST /auth/refresh ───────────────────────────────────────────────────
  app.post('/refresh', async (request, reply) => {
    const token = request.cookies['baari_refresh'];
    if (!token) {
      return reply.code(401).send({ ok: false, error: { code: 'NO_REFRESH_TOKEN', message: 'Not authenticated' } });
    }

    const userId = await validateRefreshToken(token, redis);
    if (!userId) {
      clearCookies(reply);
      return reply.code(401).send({ ok: false, error: { code: 'INVALID_REFRESH', message: 'Session expired. Please log in again.' } });
    }

    const user = await db.query.users.findFirst({ where: eq(schema.users.id, userId) });
    if (!user) {
      clearCookies(reply);
      return reply.code(401).send({ ok: false, error: { code: 'USER_NOT_FOUND', message: 'Session invalid.' } });
    }

    const locations = await db.query.locations.findMany({ where: eq(schema.locations.tenantId, user.tenantId) });

    const jwtPayload: Omit<JWTPayload, 'iat' | 'exp'> = {
      sub:  user.id,
      tid:  user.tenantId,
      role: user.role as JWTPayload['role'],
      loc:  locations.map(l => l.id),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const newJwt     = app.jwt.sign(jwtPayload, { expiresIn: '7d' } as any);
    const newRefresh = await rotateRefreshToken(token, userId, redis);
    setCookies(reply, newJwt, newRefresh);

    return reply.send({ ok: true });
  });

  // ── POST /auth/logout ────────────────────────────────────────────────────
  app.post('/logout', async (request, reply) => {
    const token = request.cookies['baari_refresh'];
    if (token) {
      await Promise.all([
        redis.del(`refresh:${token}`),
        db.delete(schema.refreshTokens).where(eq(schema.refreshTokens.token, token)),
      ]);
    }
    clearCookies(reply);
    return reply.send({ ok: true });
  });
}
