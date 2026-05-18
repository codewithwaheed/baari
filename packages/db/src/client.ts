// packages/db/src/client.ts
// DB connection + withTenant() wrapper.
// ALL tenant-scoped queries MUST go through withTenant().

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { sql } from 'drizzle-orm';
import * as schema from './schema';

const pool = new Pool({
  connectionString: process.env['DATABASE_URL'],
  max: parseInt(process.env['DB_POOL_MAX'] ?? '20'),
  idleTimeoutMillis: parseInt(process.env['DB_POOL_IDLE_TIMEOUT'] ?? '30000'),
  connectionTimeoutMillis: 2000,
  ssl: process.env['NODE_ENV'] === 'production' ? { rejectUnauthorized: false } : false,
});

export const db = drizzle(pool, { schema, logger: process.env['NODE_ENV'] === 'development' });

export type DB = typeof db;
export type TX = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Wraps all DB operations in a transaction with RLS tenant context.
 *
 * Uses SET LOCAL (transaction-scoped) — safe with PgBouncer in transaction mode.
 * Never use plain SET — it's session-scoped and leaks across pooled connections.
 *
 * @example
 * const bookings = await withTenant(tenantId, (tx) =>
 *   tx.select().from(schema.bookings)
 * );
 */
export async function withTenant<T>(
  tenantId: string,
  fn: (tx: TX) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT set_config('app.tenant_id', ${tenantId}, true)`,
    );
    return fn(tx);
  });
}

export { schema };
