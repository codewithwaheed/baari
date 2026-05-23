import type { NextConfig } from 'next';
import { existsSync } from 'fs';
import { resolve } from 'path';

// ── Monorepo env loading ────────────────────────────────────────────────────────
// Next.js only reads .env files from the app's own directory (apps/web/).
// In this monorepo the canonical .env lives two levels up at the repo root.
// We load it here so NEXT_PUBLIC_* vars are available at build time and during
// `next dev`. Local overrides still work via apps/web/.env.local (gitignored).
//
// Setup: add NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME and NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET
// to the root .env, then restart `pnpm dev`.
const rootEnv = resolve(__dirname, '../../.env');
if (existsSync(rootEnv)) {
  process.loadEnvFile(rootEnv);
}

const nextConfig: NextConfig = {
  // Allow importing from workspace packages
  transpilePackages: ['@baari/db', '@baari/types'],

  // Subdomain routing for public booking pages:
  // book.baari.pk → /book/[slug]
  // app.baari.pk  → /dashboard
  // Handled in middleware.ts

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.digitaloceanspaces.com',
      },
      // Cloudinary CDN — used for salon logos uploaded via unsigned upload preset
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
    ],
  },

  experimental: {
    // Needed for rawBody access in API routes (payment webhooks)
    serverComponentsExternalPackages: ['pg'],
  },
};

export default nextConfig;
