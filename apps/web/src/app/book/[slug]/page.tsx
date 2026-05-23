// apps/web/src/app/book/[slug]/page.tsx
// Public booking page — one URL per salon: book.baari.pk/ruma-lahore
//
// SSR'd with:
//   - generateMetadata for Open Graph (rich WhatsApp share previews)
//   - JSON-LD LocalBusiness schema for "haircut near me Lahore" SEO

import type { Metadata } from 'next';

const API = process.env['API_URL'] ?? 'http://localhost:3001';

interface SalonPublic {
  name: string;
  slug: string;
  city: string | null;
  address: string | null;
  logoUrl: string | null;
  instagramHandle: string | null;
  contactPhone: string | null;
}

async function getSalon(slug: string): Promise<SalonPublic | null> {
  try {
    const res = await fetch(`${API}/api/v1/public/salon/${encodeURIComponent(slug)}`, {
      next: { revalidate: 300 }, // revalidate every 5 min
    });
    if (!res.ok) return null;
    const { data } = await res.json();
    return data as SalonPublic;
  } catch {
    return null;
  }
}

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const salon = await getSalon(slug);

  const title = salon
    ? `Book at ${salon.name}${salon.city ? ` · ${salon.city}` : ''}`
    : 'Book an appointment — Baari';
  const description = salon
    ? `Book your appointment at ${salon.name}${salon.city ? ` in ${salon.city}` : ''}. Real-time availability. Pay to confirm.`
    : 'Book your appointment via WhatsApp or online. Pay to confirm.';

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      images: salon?.logoUrl ? [{ url: salon.logoUrl, width: 400, height: 400, alt: salon.name }] : [],
    },
    twitter: {
      card: 'summary',
      title,
      description,
      images: salon?.logoUrl ? [salon.logoUrl] : [],
    },
  };
}

export default async function BookingPage({ params }: Props) {
  const { slug } = await params;
  const salon = await getSalon(slug);

  const jsonLd = salon
    ? {
        '@context': 'https://schema.org',
        '@type': 'HairSalon',
        name: salon.name,
        url: `https://book.baari.pk/${slug}`,
        ...(salon.address   && { address: { '@type': 'PostalAddress', streetAddress: salon.address, addressLocality: salon.city ?? undefined, addressCountry: 'PK' } }),
        ...(salon.logoUrl   && { image: salon.logoUrl }),
        ...(salon.contactPhone && { telephone: salon.contactPhone }),
        ...(salon.instagramHandle && { sameAs: [`https://instagram.com/${salon.instagramHandle}`] }),
      }
    : {
        '@context': 'https://schema.org',
        '@type': 'HairSalon',
        name: slug,
        url: `https://book.baari.pk/${slug}`,
      };

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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}>
        {salon?.logoUrl && (
          <img
            src={salon.logoUrl}
            alt={salon.name}
            style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', marginBottom: 20, border: '2px solid var(--baari-sand)' }}
          />
        )}
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 48, fontWeight: 200, letterSpacing: '-0.02em', color: 'var(--baari-onyx)', marginBottom: 8 }}>
          {salon?.name ?? slug}
        </h1>
        {salon?.city && (
          <p style={{ color: 'var(--baari-graphite)', fontSize: 14, margin: '0 0 24px' }}>{salon.city}</p>
        )}
        <p style={{ color: 'var(--baari-stone)', fontSize: 13 }}>
          Booking flow coming soon.
        </p>
      </div>
    </main>
  );
}
