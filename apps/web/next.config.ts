import type { NextConfig } from 'next';

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
    ],
  },

  experimental: {
    // Needed for rawBody access in API routes (payment webhooks)
    serverComponentsExternalPackages: ['pg'],
  },
};

export default nextConfig;
