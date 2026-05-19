// apps/api/src/lib/redis/client.ts
// Redis/Valkey client — used for slot locking, tenant routing cache, BullMQ.
//
// DO note: Managed Redis was discontinued June 2025.
// Use Managed Caching for Valkey (fully Redis 7.2 wire-compatible).
// ioredis, BullMQ, and Redlock all work unchanged.

import Redis from 'ioredis';

export const redis = new Redis(process.env['REDIS_URL'] ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null, // required by BullMQ
  enableReadyCheck: false,
  lazyConnect: true,
});

// Separate client for auth operations — fails fast (no infinite buffering).
// maxRetriesPerRequest: 0 causes commands to reject immediately when Redis
// is unavailable, so OTP/token endpoints return 503 instead of hanging.
export const authRedis = new Redis(process.env['REDIS_URL'] ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: 0,
  enableReadyCheck: false,
  lazyConnect: true,
  connectTimeout: 2000,
});

authRedis.on('error', () => { /* handled per-call */ });

redis.on('error', (err) => {
  console.error('[Redis] connection error:', err.message);
});

// ─── Slot locking ─────────────────────────────────────────────────────────────
// Three-layer booking integrity:
//   1. Redis SET NX PX (this) — fast first guard
//   2. PostgreSQL SELECT FOR UPDATE — serializes in transaction
//   3. EXCLUDE GIST constraint — database-level final word

const SLOT_TTL_MS = 10 * 60 * 1000; // 10 minutes (payment window)

/** Acquire a slot lock. Returns a token if acquired, null if already locked. */
export async function acquireSlotLock(
  tenantId: string,
  staffId: string,
  startIso: string,
  ttlMs = SLOT_TTL_MS,
): Promise<string | null> {
  const token = crypto.randomUUID();
  const key = slotLockKey(tenantId, staffId, startIso);
  const result = await redis.set(key, token, 'PX', ttlMs, 'NX');
  return result === 'OK' ? token : null;
}

/** Release a slot lock — only if we still own it (Lua script for atomicity). */
const RELEASE_LUA = `
  if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
  else
    return 0
  end
`;

export async function releaseSlotLock(
  tenantId: string,
  staffId: string,
  startIso: string,
  token: string,
): Promise<boolean> {
  const key = slotLockKey(tenantId, staffId, startIso);
  const result = await redis.eval(RELEASE_LUA, 1, key, token);
  return result === 1;
}

function slotLockKey(tenantId: string, staffId: string, startIso: string): string {
  return `slot:${tenantId}:${staffId}:${startIso}`;
}

// ─── WhatsApp routing cache ────────────────────────────────────────────────────
// Maps Meta phone_number_id → tenantId. Cache TTL 24h.
// Populated on tenant WhatsApp connection. Invalidated on disconnect.

export async function cacheWaTenant(phoneNumberId: string, tenantId: string): Promise<void> {
  await redis.set(`wa:phone:${phoneNumberId}`, tenantId, 'EX', 86400);
}

export async function lookupWaTenant(phoneNumberId: string): Promise<string | null> {
  return redis.get(`wa:phone:${phoneNumberId}`);
}

export async function evictWaTenant(phoneNumberId: string): Promise<void> {
  await redis.del(`wa:phone:${phoneNumberId}`);
}
