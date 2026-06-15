// apps/web/src/app/book/[slug]/success/page.tsx
// Post-submission confirmation page.
// Query params: services (JSON string[]), staff, date, time, price, phone
// Passed from BookingFlow on successful POST /public/salon/:slug/book.

import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Booking request sent — Baari',
  robots: { index: false },
};

interface Props {
  params:      Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string>>;
}

export default async function BookingSuccessPage({ params, searchParams }: Props) {
  const { slug }           = await params;
  const sp                 = await searchParams;

  // `services` is JSON-encoded string[] — parse it; fall back to legacy `service` param
  let serviceNames: string[] = [];
  try {
    const raw = sp['services'];
    if (raw) serviceNames = JSON.parse(raw) as string[];
  } catch {
    // fallback: legacy single-service param
  }
  if (serviceNames.length === 0 && sp['service']) serviceNames = [sp['service']];

  const staff  = sp['staff']   ?? '';
  const date   = sp['date']    ?? '';
  const time   = sp['time']    ?? '';
  const price  = sp['price']   ? Number(sp['price']) : null;
  const phone  = sp['phone']   ?? '';

  const priceFmt = price !== null
    ? `PKR ${(price / 100).toLocaleString()}`
    : null;

  return (
    <main style={{
      minHeight: '100dvh',
      background: 'var(--baari-cream)',
      fontFamily: 'var(--font-body)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
    }}>
      <div style={{ maxWidth: 400, width: '100%' }}>
        {/* Card */}
        <div style={{
          background: '#fff',
          border: '1px solid var(--baari-sand)',
          borderRadius: 6,
          overflow: 'hidden',
          boxShadow: '0 2px 12px rgba(0,0,0,.06)',
        }}>
          {/* Green top stripe */}
          <div style={{ height: 4, background: 'var(--baari-lime)' }} />

          <div style={{ padding: '32px 24px 28px', textAlign: 'center' }}>
            {/* Checkmark */}
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'var(--baari-onyx)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 18px',
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                stroke="var(--baari-lime)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>

            <h1 style={{
              fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 200,
              letterSpacing: '-0.02em', color: 'var(--baari-onyx)', margin: '0 0 6px', lineHeight: 1.1,
            }}>
              <strong>Request</strong> sent!
            </h1>
            <p style={{ fontSize: 13, color: 'var(--baari-graphite)', margin: '0 0 24px', lineHeight: 1.6 }}>
              The salon will confirm your booking shortly.
            </p>

            {/* Booking details */}
            <div style={{
              padding: '14px 16px',
              background: 'var(--baari-bone)',
              border: '1px solid var(--baari-sand)',
              borderRadius: 4,
              textAlign: 'left',
              marginBottom: 18,
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--baari-stone)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 10 }}>
                Your booking
              </div>

              {/* Service chips */}
              {serviceNames.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
                  {serviceNames.map((name, i) => (
                    <span key={i} style={{
                      display: 'inline-block',
                      padding: '3px 8px',
                      background: '#fff',
                      border: '1px solid var(--baari-sand)',
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 500,
                      color: 'var(--baari-espresso)',
                    }}>
                      {name}
                    </span>
                  ))}
                </div>
              )}

              {staff && <Row label="With" value={staff} />}
              {date && time && <Row label="When" value={`${date} · ${time}`} />}
              {priceFmt && <Row label="Total" value={priceFmt} bold />}
            </div>

            {/* Contact note */}
            {phone && (
              <p style={{ fontSize: 12, color: 'var(--baari-stone)', margin: '0 0 22px', lineHeight: 1.6 }}>
                The salon will call you on{' '}
                <strong style={{ color: 'var(--baari-espresso)' }}>{phone}</strong>{' '}
                to confirm.
              </p>
            )}

            {/* Back link */}
            <Link
              href={`/book/${encodeURIComponent(slug)}`}
              style={{
                display: 'block',
                padding: '10px 0',
                fontSize: 13,
                color: 'var(--baari-stone)',
                textDecoration: 'none',
                borderTop: '1px solid var(--baari-bone)',
                paddingTop: 18,
                marginTop: 4,
              }}
            >
              ← Back to salon page
            </Link>
          </div>
        </div>

        <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--baari-stone)', marginTop: 20 }}>
          Powered by <strong style={{ color: 'var(--baari-graphite)' }}>Baari</strong>
        </p>
      </div>
    </main>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 5, fontSize: 13 }}>
      <span style={{ color: 'var(--baari-stone)', flexShrink: 0 }}>{label}</span>
      <span style={{ color: 'var(--baari-onyx)', fontWeight: bold ? 700 : 500, textAlign: 'right' }}>{value}</span>
    </div>
  );
}
