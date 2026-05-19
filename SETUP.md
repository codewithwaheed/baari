# Baari — Local Development Guide

## Prerequisites

- Node.js 20+ (tested on v24)
- pnpm 9+
- Docker (for postgres)
- Redis/Valkey (optional for local dev — required for workers)

---

## First-time setup

```bash
cp .env.example .env
pnpm install

# Start postgres container + run migration + seed (all idempotent)
pnpm db:up

# Start web (3000) + api (3001)
pnpm dev
```

On subsequent sessions, `pnpm db:up` is instant if the container is already running and the DB is already seeded.

---

## Database setup details

`pnpm db:start` ([scripts/start-db.sh](scripts/start-db.sh)):
- Starts `baari-postgres` Docker container if stopped, or creates it fresh on first run
- Container uses `postgres:16-alpine` with `POSTGRES_USER=baari` — so `baari` is a **superuser**
- Data is persisted in a named Docker volume (`baari-postgres-data`)

`pnpm db:migrate` (`packages/db/src/migrate.ts`):
1. Connects via `ADMIN_DATABASE_URL` (`baari:baari_dev` — the Docker superuser)
2. Creates the `baari` database if it doesn't exist
3. Applies `0001_init.sql` — tables, RLS, EXCLUDE GIST, triggers (idempotent)
4. Grants `BYPASSRLS` + `ALL TABLES` to the `baari` role

All app queries go through `withTenant(tenantId, fn)` in `packages/db/src/client.ts`.

### Fresh start (wipe and re-seed)

```bash
docker rm -f baari-postgres
docker volume rm baari-postgres-data
pnpm db:up
```

---

## Seed data

| Entity | Value |
|--------|-------|
| Tenant | Saloni Studio (`saloni-studio-lahore`) |
| Location | Main Branch, DHA Phase 5, Lahore |
| Staff | Ayesha Malik (stylist), Sana Khan (colorist), Hira Ahmed (esthetician), Zoya Butt (nail_tech) |
| Services | 11 services: hair (5), skin (2), nails (2), makeup (2) |
| Owner login | `owner@saloni.pk` — note: no actual auth yet (MVP stub) |

---

## Homebrew postgres (alternative)

If you prefer Homebrew postgres instead of Docker:

```bash
brew install postgresql@16
brew services start postgresql@16
```

Then set `ADMIN_DATABASE_URL` to your OS username (macOS superuser):

```
ADMIN_DATABASE_URL=postgres://YOUR_USERNAME@localhost:5432/postgres
```

Run `pnpm db:migrate && pnpm db:seed` (skip `db:start`).

---

## Scripts reference

| Script | What it does |
|--------|-------------|
| `pnpm --filter @baari/db db:migrate` | Bootstrap DB, run migration |
| `pnpm --filter @baari/db db:seed` | Insert dev data (idempotent) |
| `pnpm --filter @baari/db db:generate` | Generate drizzle migration from schema diff |
| `pnpm --filter @baari/db db:migrate:drizzle` | Apply drizzle-kit migrations (incremental) |
| `pnpm --filter @baari/db db:studio` | Open Drizzle Studio GUI |
| `pnpm dev` | Start web (3000) + api (3001) concurrently |

---

## Adding a schema change

1. Edit `packages/db/src/schema.ts`
2. Run `pnpm --filter @baari/db db:generate` → generates a new SQL migration
3. Verify the generated SQL, add any RLS policies if adding a new table
4. Run `pnpm --filter @baari/db db:migrate:drizzle` to apply
5. Update seed if needed

Never `ALTER TABLE` directly — always go through Drizzle migrations.
