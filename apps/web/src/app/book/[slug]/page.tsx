// apps/web/src/app/book/[slug]/page.tsx
// Public booking page — one URL per salon: book.baari.pk/ruma-lahore
//
// This page is SSR'd with:
//   - generateMetadata for Open Graph (rich WhatsApp share previews)
//   - JSON-LD LocalBusiness schema for "haircut near me Lahore" SEO
//
// TODO: implement the full booking flow
//   1. Load salon by slug (from API or DB direct)
//   2. Show service selector
//   3. Show staff selector
//   4. Show date/time picker (real-time availability from API)
//   5. Collect customer phone
//   6. Redirect to Safepay hosted checkout
//   7. On success: show confirmation + wa.me deeplink

import type { Metadata } from 'next';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  // TODO: fetch salon name from API for dynamic title
  return {
    title: `Book an appointment — Baari`,
    description: 'Book your appointment via WhatsApp or online. Pay to confirm.',
    openGraph: {
      title: `Book an appointment`,
      description: 'Real-time availability. Pay to confirm.',
      type: 'website',
    },
  };
}

export default async function BookingPage({ params }: Props) {
  const { slug } = await params;

  return (
    <main style={{
      minHeight: '100vh',
      background: 'var(--baari-cream)',
      fontFamily: 'var(--font-body)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    }}>
      {/* JSON-LD LocalBusiness schema — important for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'LocalBusiness',
          name: slug, // TODO: replace with real salon name
          url: `https://book.baari.pk/${slug}`,
        }) }}
      />

      <div style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 48, fontWeight: 200, letterSpacing: '-0.02em', color: 'var(--baari-onyx)', marginBottom: 16 }}>
          Book your <b>باری</b>
        </h1>
        <p style={{ color: 'var(--baari-graphite)', fontSize: 16, marginBottom: 32 }}>
          Public booking page for <strong>{slug}</strong>
        </p>
        <p style={{ color: 'var(--baari-stone)', fontSize: 13 }}>
          TODO: implement full booking flow
        </p>
      </div>
    </main>
  );
}
