// packages/db/src/migrate.ts
// Run: pnpm db:migrate
//
// Connects as postgres superuser to create the baari database + user,
// then applies 0001_init.sql. Safe to run multiple times (idempotent).
//
// Required env:
//   DATABASE_URL  — app connection (postgres://baari:baari_dev@host:port/baari)
//   ADMIN_DATABASE_URL — optional superuser override
//                        defaults to postgres://postgres@<host>:<port>/postgres

import { Client } from 'pg';
import { readFileSync, existsSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env from monorepo root (two levels up from packages/db/src/)
const envPath = resolve(__dirname, '../../../.env');
if (existsSync(envPath)) process.loadEnvFile(envPath);

function parseUrl(raw: string) {
  const url = new URL(raw);
  return {
    host: url.hostname,
    port: parseInt(url.port || '5432'),
    user: url.username,
    password: url.password,
    database: url.pathname.replace(/^\//, ''),
  };
}

async function ensureDbAndUser(
  adminConn: Record<string, unknown>,
  dbName: string,
  roleName: string,
  rolePassword: string,
) {
  const client = new Client(adminConn);
  await client.connect();

  // Create app role.
  // rolePassword is safely quoted via client.escapeLiteral() (pg's built-in SQL escaping) to
  // prevent injection. roleName is a DB identifier sourced from DATABASE_URL (operator-controlled),
  // not arbitrary user input, so identifier quoting via "" is sufficient.
  const safePassword = client.escapeLiteral(rolePassword);
  await client.query(`
    DO $$ BEGIN
      CREATE ROLE ${roleName} WITH LOGIN PASSWORD ${safePassword};
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `);
  // Ensure password is up-to-date even if the role already existed.
  await client.query(`ALTER ROLE "${roleName}" PASSWORD ${safePassword}`);

  // Create database
  const { rows } = await client.query(
    `SELECT 1 FROM pg_database WHERE datname = $1`,
    [dbName],
  );
  if (rows.length === 0) {
    await client.query(`CREATE DATABASE "${dbName}" OWNER "${roleName}"`);
    console.log(`✓ Database "${dbName}" created.`);
  } else {
    console.log(`✓ Database "${dbName}" already exists.`);
  }

  await client.end();
}

async function applyMigration(
  adminConnOnDb: Record<string, unknown>,
  appRole: string,
) {
  const client = new Client(adminConnOnDb);
  await client.connect();

  // Idempotency check: if tenants table exists, migration already ran.
  const { rows } = await client.query<{ exists: string | null }>(`
    SELECT to_regclass('public.tenants') AS exists
  `);

  if (rows[0]?.exists) {
    console.log('✓ Migration 0001_init already applied, skipping.');
  } else {
    console.log('  Applying migration 0001_init.sql...');
    const sqlText = readFileSync(
      join(__dirname, 'migrations/0001_init.sql'),
      'utf-8',
    );
    await client.query(sqlText);
    console.log('✓ Migration applied.');
  }

  // ── Apply 0002_auth ──────────────────────────────────────────────────────
  const { rows: rows2 } = await client.query<{ exists: string | null }>(`
    SELECT to_regclass('public.refresh_tokens') AS exists
  `);

  if (rows2[0]?.exists) {
    console.log('✓ Migration 0002_auth already applied, skipping.');
  } else {
    console.log('  Applying migration 0002_auth.sql...');
    const sql2 = readFileSync(
      join(__dirname, 'migrations/0002_auth.sql'),
      'utf-8',
    );
    await client.query(sql2);
    console.log('✓ Migration 0002 applied.');
  }

  // ── Apply 0003_working_hours_breaks ─────────────────────────────────────────
  const { rows: rows3 } = await client.query<{ exists: string | null }>(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name='working_hours' AND column_name='breaks' LIMIT 1
  `);
  if (rows3[0]?.exists) {
    console.log('✓ Migration 0003_working_hours_breaks already applied, skipping.');
  } else {
    console.log('  Applying migration 0003_working_hours_breaks.sql...');
    const sql3 = readFileSync(join(__dirname, 'migrations/0003_working_hours_breaks.sql'), 'utf-8');
    await client.query(sql3);
    console.log('✓ Migration 0003 applied.');
  }

  // ── Apply 0004_checked_in_state ──────────────────────────────────────────────
  // Idempotency: check if the correct constraint bookings_state_chk exists with CHECKED_IN.
  // We check for the constraint by name; 0004 creates it.
  const { rows: rows4 } = await client.query<{ exists: boolean }>(`
    SELECT EXISTS(
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name='bookings_state_chk' AND table_name='bookings'
    ) AS exists
  `);
  if (rows4[0]?.exists) {
    console.log('✓ Migration 0004_checked_in_state already applied, skipping.');
  } else {
    console.log('  Applying migration 0004_checked_in_state.sql...');
    const sql4 = readFileSync(join(__dirname, 'migrations/0004_checked_in_state.sql'), 'utf-8');
    await client.query(sql4);
    console.log('✓ Migration 0004 applied.');
  }

  // ── Apply 0005_fix_state_constraint ─────────────────────────────────────────
  // Idempotency: check if the phantom "bookings_state_check" constraint still exists.
  // If it does, the fix hasn't been applied yet.
  const { rows: rows5 } = await client.query<{ exists: boolean }>(`
    SELECT EXISTS(
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name='bookings_state_check' AND table_name='bookings'
    ) AS exists
  `);
  if (!rows5[0]?.exists) {
    console.log('✓ Migration 0005_fix_state_constraint already applied, skipping.');
  } else {
    console.log('  Applying migration 0005_fix_state_constraint.sql...');
    const sql5 = readFileSync(join(__dirname, 'migrations/0005_fix_state_constraint.sql'), 'utf-8');
    await client.query(sql5);
    console.log('✓ Migration 0005 applied — bookings state constraint fixed.');
  }

  // ── Apply 0006_booking_services ─────────────────────────────────────────────
  const { rows: rows6 } = await client.query<{ exists: string | null }>(`
    SELECT to_regclass('public.booking_services') AS exists
  `);
  if (rows6[0]?.exists) {
    console.log('✓ Migration 0006_booking_services already applied, skipping.');
  } else {
    console.log('  Applying migration 0006_booking_services.sql...');
    const sql6 = readFileSync(join(__dirname, 'migrations/0006_booking_services.sql'), 'utf-8');
    await client.query(sql6);
    console.log('✓ Migration 0006 applied.');
  }

  // ── RLS patches (idempotent) ─────────────────────────────────────────────────
  // Applied on every run to ensure RLS is correct even if 0002_auth.sql ran before
  // these policies were added.
  await client.query(`
    -- refresh_tokens: tenant-scoped via user_id → users.tenant_id
    ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;
    ALTER TABLE refresh_tokens FORCE ROW LEVEL SECURITY;
    DO $$ BEGIN
      CREATE POLICY tenant_isolation ON refresh_tokens FOR ALL TO app_user
        USING (user_id IN (SELECT id FROM users WHERE tenant_id = current_setting('app.tenant_id', true)::uuid))
        WITH CHECK (user_id IN (SELECT id FROM users WHERE tenant_id = current_setting('app.tenant_id', true)::uuid));
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    -- otp_log: global (phones are cross-tenant); app_user cannot read/write directly.
    -- Auth routes use the baari role (BYPASSRLS). No policy = deny all to app_user.
    ALTER TABLE otp_log ENABLE ROW LEVEL SECURITY;
    ALTER TABLE otp_log FORCE ROW LEVEL SECURITY;
  `);
  console.log('✓ RLS patches applied (refresh_tokens, otp_log).');

  // Grant the app role (baari) full access + RLS bypass for local dev / seed scripts.
  // In production the pool connects as app_user which has RLS enforced via withTenant().
  await client.query(`
    ALTER ROLE "${appRole}" BYPASSRLS;
    GRANT ALL ON ALL TABLES IN SCHEMA public TO "${appRole}";
    GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO "${appRole}";
  `);
  console.log(`✓ Grants applied to role "${appRole}".`);

  await client.end();
}

async function main() {
  const appUrl = process.env['DATABASE_URL'] ?? 'postgres://baari:baari_dev@localhost:5432/baari';
  const app = parseUrl(appUrl);

  // Admin URL: use ADMIN_DATABASE_URL if set, else postgres user on same host
  const adminUrl = process.env['ADMIN_DATABASE_URL'] ??
    `postgres://postgres@${app.host}:${app.port}/postgres`;
  const admin = parseUrl(adminUrl);

  console.log('🔧 Running Baari DB migration...');
  console.log(`   Host:     ${app.host}:${app.port}`);
  console.log(`   Database: ${app.database}`);
  console.log(`   Admin:    ${admin.user}@${admin.host}`);
  console.log('');

  const adminConn: Record<string, unknown> = {
    host: admin.host,
    port: admin.port,
    user: admin.user,
    database: admin.database,
  };
  if (admin.password) adminConn['password'] = admin.password;

  await ensureDbAndUser(adminConn, app.database, app.user, app.password);

  const adminOnDb = { ...adminConn, database: app.database };
  await applyMigration(adminOnDb, app.user);

  console.log('\n✅ Migration complete.');
}

main().catch((err) => {
  console.error('\n❌ Migration failed:', err.message);
  process.exit(1);
});
