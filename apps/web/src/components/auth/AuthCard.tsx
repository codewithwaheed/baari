'use client';

interface AuthCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

export function AuthCard({ title, subtitle, children }: AuthCardProps) {
  return (
    <div style={{
      width: '100%',
      maxWidth: 420,
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
      boxShadow: 'var(--shadow-lg)',
    }}>
      {/* Lime accent strip */}
      <div style={{ height: 4, background: 'var(--baari-lime)' }} />

      <div style={{ padding: '32px 32px 36px' }}>
        {/* Wordmark */}
        <div style={{ marginBottom: 28 }}>
          <span style={{
            fontFamily: 'var(--font-display)',
            fontSize: 22,
            fontWeight: 700,
            color: 'var(--fg)',
            letterSpacing: '-0.02em',
          }}>
            باری
          </span>
          <span style={{
            fontFamily: 'var(--font-display)',
            fontSize: 22,
            fontWeight: 200,
            color: 'var(--fg)',
            letterSpacing: '-0.02em',
            marginLeft: 6,
          }}>
            Baari
          </span>
        </div>

        {/* Title */}
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--fs-h3)',
          fontWeight: 200,
          color: 'var(--fg)',
          margin: '0 0 6px',
          lineHeight: 'var(--lh-heading)',
        }}>
          {title}
        </h1>

        {subtitle && (
          <p style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--fs-body-sm)',
            color: 'var(--fg-muted)',
            margin: '0 0 28px',
            lineHeight: 'var(--lh-body)',
          }}>
            {subtitle}
          </p>
        )}

        {!subtitle && <div style={{ marginBottom: 28 }} />}

        {children}
      </div>
    </div>
  );
}
