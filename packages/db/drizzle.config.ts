import type { Config } from 'drizzle-kit';

export default {
  schema: './src/schema.ts',
  out: './src/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env['DATABASE_URL'] ?? 'postgres://baari:baari_dev@localhost:5432/baari',
  },
  verbose: true,
  strict: true,
} satisfies Config;
