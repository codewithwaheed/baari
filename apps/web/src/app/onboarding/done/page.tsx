'use client';
import { useRouter } from 'next/navigation';

export default function OnboardingDonePage() {
  const router = useRouter();

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'var(--bg)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '32px 16px 64px',
    }}>
      {/* Wordmark */}
      <div style={{ width: '100%', maxWidth: 520, marginBottom: 20 }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--fg)' }}>باری</span>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 200, color: 'var(--fg)', marginLeft: 6 }}>Baari</span>
      </div>

      {/* Card */}
      <div style={{
        width: '100%',
        maxWidth: 520,
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-lg)',
        overflow: 'hidden',
      }}>
        {/* Full lime strip — complete */}
        <div style={{ height: 5, background: 'var(--baari-lime)' }} />

        <div style={{ padding: '40px 28px 44px', textAlign: 'center' }}>
          {/* Check icon */}
          <div style={{
            width: 60,
            height: 60,
            borderRadius: '50%',
            background: 'var(--baari-lime)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 24,
            fontSize: 26,
            color: 'var(--baari-onyx)',
          }}>
            ✓
          </div>

          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 30,
            fontWeight: 200,
            color: 'var(--fg)',
            margin: '0 0 10px',
            lineHeight: 1.2,
          }}>
            Your salon is ready.
          </h1>

          <p style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--fs-body-sm)',
            color: 'var(--fg-muted)',
            margin: '0 0 36px',
            lineHeight: 1.6,
            maxWidth: 360,
            marginLeft: 'auto',
            marginRight: 'auto',
          }}>
            Connect your WhatsApp to start accepting bookings, or head to the dashboard first.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              onClick={() => router.push('/dashboard')}
              style={{
                width: '100%',
                padding: '13px 0',
                background: 'var(--baari-onyx)',
                color: '#fff',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--fs-body-sm)',
                fontFamily: 'var(--font-body)',
                fontWeight: 'var(--fw-medium)',
                cursor: 'pointer',
                letterSpacing: 'var(--tracking-button)',
              }}
            >
              Go to dashboard →
            </button>

            <button
              onClick={() => router.push('/dashboard?open=whatsapp-setup')}
              style={{
                width: '100%',
                padding: '13px 0',
                background: 'none',
                color: 'var(--fg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--fs-body-sm)',
                fontFamily: 'var(--font-body)',
                fontWeight: 'var(--fw-regular)',
                cursor: 'pointer',
              }}
            >
              Connect WhatsApp first
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
