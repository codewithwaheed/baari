// apps/api/src/lib/auth/tokens.ts
import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import type { FastifyReply } from 'fastify';
import type { Redis } from 'ioredis';
import { db, schema } from '@baari/db';
import '@fastify/cookie'; // augments FastifyReply with setCookie / clearCookie

const REFRESH_TTL_SEC = 30 * 24 * 60 * 60; // 30 days
const JWT_TTL_SEC     = 7  * 24 * 60 * 60; // 7 days

export async function createRefreshToken(
  userId: string,
  redis: Redis,
): Promise<string> {
  const token     = randomUUID();
  const expiresAt = new Date(Date.now() + REFRESH_TTL_SEC * 1000);

  await Promise.all([
    redis.set(`refresh:${token}`, userId, 'EX', REFRESH_TTL_SEC),
    db.insert(schema.refreshTokens).values({ userId, token, expiresAt }),
  ]);

  return token;
}

export async function validateRefreshToken(
  token: string,
  redis: Redis,
): Promise<string | null> {
  // Fast path
  const userId = await redis.get(`refresh:${token}`);
  if (userId) return userId;

  // DB fallback (handles Redis restart / cache miss)
  const [row] = await db
    .select()
    .from(schema.refreshTokens)
    .where(eq(schema.refreshTokens.token, token));

  if (!row || row.expiresAt < new Date()) return null;

  // Rewarm Redis
  const ttl = Math.floor((row.expiresAt.getTime() - Date.now()) / 1000);
  await redis.set(`refresh:${token}`, row.userId, 'EX', ttl);
  return row.userId;
}

export async function rotateRefreshToken(
  oldToken: string,
  userId: string,
  redis: Redis,
): Promise<string> {
  await Promise.all([
    redis.del(`refresh:${oldToken}`),
    db.delete(schema.refreshTokens).where(eq(schema.refreshTokens.token, oldToken)),
  ]);
  return createRefreshToken(userId, redis);
}

export async function revokeAllRefreshTokens(
  userId: string,
  redis: Redis,
): Promise<void> {
  const rows = await db
    .select({ token: schema.refreshTokens.token })
    .from(schema.refreshTokens)
    .where(eq(schema.refreshTokens.userId, userId));

  await Promise.all([
    ...rows.map(r => redis.del(`refresh:${r.token}`)),
    db.delete(schema.refreshTokens).where(eq(schema.refreshTokens.userId, userId)),
  ]);
}

export function setCookies(
  reply: FastifyReply,
  jwt: string,
  refreshToken: string,
): void {
  const isProd = process.env['NODE_ENV'] === 'production';

  reply.setCookie('baari_token', jwt, {
    httpOnly: true,
    secure:   isProd,
    sameSite: 'lax',
    path:     '/',
    maxAge:   JWT_TTL_SEC,
  });

  reply.setCookie('baari_refresh', refreshToken, {
    httpOnly: true,
    secure:   isProd,
    sameSite: 'lax',
    path:     '/api/v1/auth',
    maxAge:   REFRESH_TTL_SEC,
  });
}

export function clearCookies(reply: FastifyReply): void {
  reply.clearCookie('baari_token',   { path: '/' });
  reply.clearCookie('baari_refresh', { path: '/api/v1/auth' });
}
