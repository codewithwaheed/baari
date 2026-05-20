'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';

const CITIES = ['Lahore', 'Karachi', 'Islamabad', 'Rawalpindi', 'Faisalabad', 'Other'];

const fieldStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  fontSize: 'var(--fs-body-sm)',
  fontFamily: 'var(--font-body)',
  color: 'var(--fg)',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color var(--dur-fast)',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontFamily: 'var(--font-body)',
  fontSize: 'var(--fs-caption)',
  fontWeight: 'var(--fw-medium)',
  color: 'var(--fg-muted)',
  marginBottom: 6,
  textTransform: 'uppercase',
  letterSpacing: 'var(--tracking-caps)',
};

export default function OnboardingSalonPage() {
  const router = useRouter();
  const [salonName, setSalonName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [city,      setCity]      = useState('');
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!salonName.trim() || !ownerName.trim() || !city) {
      setError('Please fill in all fields.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API}/api/v1/onboarding/salon`, {
        method:      'PATCH',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body:        JSON.stringify({ salonName, ownerName, city }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error?.message ?? 'Could not save. Try again.');
        return;
      }

      router.push('/onboarding/services');
    } catch {
      setError('Connection error. Try again.');
    } finally {
      setLoading(false);
    }
  }

  const ready = salonName.trim() && ownerName.trim() && city && !loading;

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'var(--bg)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '32px 16px 64px',
    }}>
      {/* Wordmark above card */}
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
        {/* Progress strip */}
        <div style={{ height: 5, background: 'var(--baari-sand)' }}>
          <div style={{ height: '100%', width: '33%', background: 'var(--baari-lime)' }} />
        </div>

        <div style={{ padding: '32px 28px 40px' }}>
          {/* Step label */}
          <p style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--fs-caption)',
            fontWeight: 'var(--fw-medium)',
            color: 'var(--fg-muted)',
            textTransform: 'uppercase',
            letterSpacing: 'var(--tracking-caps)',
            margin: '0 0 16px',
          }}>
            Step 1 of 3
          </p>

          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 28,
            fontWeight: 200,
            color: 'var(--fg)',
            margin: '0 0 6px',
            lineHeight: 1.2,
          }}>
            Your salon
          </h1>
          <p style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--fs-body-sm)',
            color: 'var(--fg-muted)',
            margin: '0 0 32px',
            lineHeight: 1.5,
          }}>
            Set up the basics. You can change everything later in Settings.
          </p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <label style={labelStyle}>Salon name</label>
              <input
                type="text"
                value={salonName}
                onChange={e => setSalonName(e.target.value)}
                placeholder="e.g. Hassan's Barbershop"
                disabled={loading}
                autoFocus
                style={fieldStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Your name</label>
              <input
                type="text"
                value={ownerName}
                onChange={e => setOwnerName(e.target.value)}
                placeholder="e.g. Hassan Ahmed"
                disabled={loading}
                style={fieldStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>City</label>
              <select
                value={city}
                onChange={e => setCity(e.target.value)}
                disabled={loading}
                style={{
                  ...fieldStyle,
                  appearance: 'none',
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%238A8275' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 14px center',
                  backgroundSize: '12px',
                  paddingRight: 36,
                  cursor: 'pointer',
                }}
              >
                <option value="">Select your city</option>
                {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {error && (
              <div style={{
                padding: '10px 12px',
                background: '#FDF2F1',
                border: '1px solid #F5D0CD',
                borderRadius: 'var(--radius-sm)',
                fontSize: 'var(--fs-body-sm)',
                color: 'var(--baari-error)',
                fontFamily: 'var(--font-body)',
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={!ready}
              style={{
                width: '100%',
                padding: '13px 0',
                marginTop: 4,
                background: ready ? 'var(--baari-onyx)' : 'var(--bg-subtle)',
                color: ready ? '#fff' : 'var(--fg-muted)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--fs-body-sm)',
                fontFamily: 'var(--font-body)',
                fontWeight: 'var(--fw-medium)',
                cursor: ready ? 'pointer' : 'not-allowed',
                transition: 'background var(--dur-fast)',
                letterSpacing: 'var(--tracking-button)',
              }}
            >
              {loading ? 'Saving…' : 'Continue →'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
