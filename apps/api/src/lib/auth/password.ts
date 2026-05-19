// apps/api/src/lib/auth/password.ts
import bcrypt from 'bcryptjs';
import { eq, sql } from 'drizzle-orm';
import { db, schema } from '@baari/db';

const ROUNDS            = 12;
const MAX_ATTEMPTS      = 5;
const LOCKOUT_MS        = 15 * 60 * 1000; // 15 minutes

export async function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, ROUNDS);
}

export async function verifyPassword(
  plaintext: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plaintext, hash);
}

export function isLockedOut(user: {
  failedLoginCount: number;
  lockedUntil: Date | null;
}): { locked: boolean; minutesLeft: number } {
  if (!user.lockedUntil) return { locked: false, minutesLeft: 0 };
  const ms = user.lockedUntil.getTime() - Date.now();
  if (ms <= 0) return { locked: false, minutesLeft: 0 };
  return { locked: true, minutesLeft: Math.ceil(ms / 60000) };
}

/** Record a failed attempt. Returns true if the account just became locked. */
export async function recordFailedAttempt(userId: string): Promise<boolean> {
  const [updated] = await db
    .update(schema.users)
    .set({ failedLoginCount: sql`failed_login_count + 1` })
    .where(eq(schema.users.id, userId))
    .returning({ count: schema.users.failedLoginCount });

  if (!updated) return false;

  if (updated.count >= MAX_ATTEMPTS) {
    const lockedUntil = new Date(Date.now() + LOCKOUT_MS);
    await db
      .update(schema.users)
      .set({ lockedUntil })
      .where(eq(schema.users.id, userId));
    return true;
  }

  return false;
}

export async function resetLoginAttempts(userId: string): Promise<void> {
  await db
    .update(schema.users)
    .set({ failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() })
    .where(eq(schema.users.id, userId));
}

export async function updatePasswordHash(
  userId: string,
  newHash: string,
): Promise<void> {
  await db
    .update(schema.users)
    .set({ passwordHash: newHash })
    .where(eq(schema.users.id, userId));
}
