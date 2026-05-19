'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthCard } from '@/components/auth/AuthCard';
import { PhoneInput } from '@/components/auth/PhoneInput';

const API = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('92')) return `+${digits}`;
  if (digits.startsWith('0'))  return `+92${digits.slice(1)}`;
  if (digits.startsWith('3'))  return `+92${digits}`;
  return `+${digits}`;
}

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [phone,   setPhone]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const normalized = normalizePhone(phone);
    if (!/^\+923\d{9}$/.test(normalized)) {
      setError('Enter a valid Pakistani mobile number (03XX...)');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API}/api/v1/auth/forgot-password`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ phone: normalized }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error?.message ?? 'Something went wrong. Try again.');
        return;
      }

      sessionStorage.setItem('baari_reset_phone', normalized);
      router.push('/login/forgot/verify');
    } catch {
      setError('Connection error. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard
      title="Reset your password"
      subtitle="Enter your registered mobile number. We'll send a one-time code."
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <PhoneInput value={phone} onChange={setPhone} error={error} disabled={loading} />

        {error && (
          <div style={{
            padding: '10px 12px',
            background: '#FDF2F1',
            border: '1px solid #F5D0CD',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--fs-body-sm)',
            color: 'var(--baari-error)',
            fontFamily: 'var(--font-body)',
          }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !phone}
          style={{
            width: '100%',
            padding: '13px 0',
            background: loading || !phone ? 'var(--bg-subtle)' : 'var(--baari-onyx)',
            color: loading || !phone ? 'var(--fg-muted)' : '#fff',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--fs-body)',
            fontFamily: 'var(--font-body)',
            fontWeight: 'var(--fw-medium)',
            cursor: loading || !phone ? 'not-allowed' : 'pointer',
            transition: 'background var(--dur-fast)',
          }}
        >
          {loading ? 'Sending code…' : 'Send code'}
        </button>

        <a
          href="/login"
          style={{
            textAlign: 'center',
            fontSize: 'var(--fs-body-sm)',
            color: 'var(--fg-muted)',
            fontFamily: 'var(--font-body)',
            display: 'block',
            textDecoration: 'none',
          }}
        >
          ← Back to sign in
        </a>
      </form>
    </AuthCard>
  );
}
