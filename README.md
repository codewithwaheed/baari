# Baari · باری

> "Your turn." — WhatsApp-native B2B appointment SaaS for Pakistan.

## Quick start

```bash
# 1. Clone and install
git clone https://github.com/yourorg/baari && cd baari
pnpm install

# 2. Configure environment
cp .env.example .env
# Fill in DATABASE_URL, REDIS_URL, JWT_SECRET, META_APP_SECRET, SAFEPAY_API_KEY

# 3. Start infrastructure
docker compose -f infra/docker-compose.yml up -d postgres valkey

# 4. Run migrations and seed
pnpm db:migrate
pnpm db:seed

# 5. Start development servers (web :3000 + api :3001)
pnpm dev
```

## Stack

| | |
|---|---|
| Frontend | Next.js 15 (App Router, TypeScript) |
| Backend API | Fastify (Node 20, TypeScript) |
| Database | PostgreSQL with Row-Level Security |
| ORM | Drizzle ORM |
| Queue | BullMQ on Redis/Valkey |
| Payments | Safepay → JazzCash + EasyPaisa + Raast |
| WhatsApp | Meta Cloud API via 360dialog |
| Infra | DigitalOcean Droplet + Caddy |

## Monorepo

```
apps/web      Next.js dashboard + public booking pages
apps/api      Fastify REST API + webhooks + BullMQ workers
packages/db   Drizzle schema + migrations (shared source of truth)
packages/types  Shared TypeScript types
infra/        Docker Compose + Caddy config
```

## Key commands

```bash
pnpm dev              # start web (3000) + api (3001)
pnpm db:generate      # generate Drizzle migration from schema changes
pnpm db:migrate       # run pending migrations
pnpm db:seed          # seed dev data
pnpm db:studio        # Drizzle Studio (visual DB browser)
pnpm build            # build all packages and apps
pnpm typecheck        # type-check all packages
```

## Docs

- `CLAUDE.md` — Claude Code context (read this first)
- `ARCHITECTURE.md` — full system design
- `packages/db/src/schema.ts` — database schema (source of truth)
- `packages/db/src/migrations/0001_init.sql` — full SQL with RLS + EXCLUDE GIST
