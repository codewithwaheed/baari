// apps/web/src/app/book/[slug]/page.tsx
// Public booking page — one URL per salon: book.baari.pk/ruma-lahore
//
// SSR'd with:
//   - generateMetadata for Open Graph (rich WhatsApp share previews)
//   - JSON-LD LocalBusiness schema for "haircut near me Lahore" SEO

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BookingFlow } from './BookingFlow';

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
    ? `Book your appointment at ${salon.name}${salon.city ? ` in ${salon.city}` : ''}. Choose your service, pick a time, and send a booking request.`
    : 'Book your appointment online.';

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

  if (!salon) notFound();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'HairSalon',
    name: salon.name,
    url: `https://book.baari.pk/${slug}`,
    ...(salon.address      && { address: { '@type': 'PostalAddress', streetAddress: salon.address, addressLocality: salon.city ?? undefined, addressCountry: 'PK' } }),
    ...(salon.logoUrl      && { image: salon.logoUrl }),
    ...(salon.contactPhone && { telephone: salon.contactPhone }),
    ...(salon.instagramHandle && { sameAs: [`https://instagram.com/${salon.instagramHandle}`] }),
  };

  return (
    <main style={{
      minHeight: '100dvh',
      background: 'var(--baari-cream)',
      fontFamily: 'var(--font-body)',
      padding: '24px 16px 48px',
    }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div style={{ maxWidth: 480, margin: '0 auto' }}>
        {/* Salon header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          {salon.logoUrl && (
            <img
              src={salon.logoUrl}
              alt={salon.name}
              style={{
                width: 72, height: 72, borderRadius: '50%', objectFit: 'cover',
                marginBottom: 14, border: '2px solid var(--baari-sand)',
              }}
            />
          )}
          {!salon.logoUrl && (
            <div style={{
              width: 72, height: 72, borderRadius: '50%', margin: '0 auto 14px',
              background: 'var(--baari-onyx)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--baari-lime)" strokeWidth="1.5" strokeLinecap="round">
                <circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/>
                <line x1="20" y1="4" x2="8.12" y2="15.88"/>
                <line x1="14.47" y1="14.48" x2="20" y2="20"/>
                <line x1="8.12" y1="8.12" x2="12" y2="12"/>
              </svg>
            </div>
          )}
          <h1 style={{
            fontFamily: 'var(--font-display)', fontSize: 36, fontWeight: 200,
            letterSpacing: '-0.02em', color: 'var(--baari-onyx)', margin: '0 0 4px', lineHeight: 1.1,
          }}>
            {salon.name}
          </h1>
          {salon.city && (
            <p style={{ fontSize: 13, color: 'var(--baari-stone)', margin: 0 }}>{salon.city}</p>
          )}
        </div>

        {/* Booking flow widget */}
        <BookingFlow slug={slug} />

        {/* Footer */}
        <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--baari-stone)', marginTop: 24 }}>
          Powered by <strong style={{ color: 'var(--baari-graphite)' }}>Baari</strong>
        </p>
      </div>
    </main>
  );
}
