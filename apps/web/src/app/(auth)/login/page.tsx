'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthCard } from '@/components/auth/AuthCard';
import { PhoneInput } from '@/components/auth/PhoneInput';
import { PasswordInput } from '@/components/auth/PasswordInput';

const API = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('92')) return `+${digits}`;
  if (digits.startsWith('0'))  return `+92${digits.slice(1)}`;
  if (digits.startsWith('3'))  return `+92${digits}`;
  return `+${digits}`;
}

export default function LoginPage() {
  const router = useRouter();
  const [phone,    setPhone]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`${API}/api/v1/auth/login`, {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body:        JSON.stringify({ phone: normalizePhone(phone), password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error?.message ?? 'Login failed. Try again.');
        return;
      }

      router.push('/dashboard');
    } catch {
      setError('Connection error. Check your internet and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard title="Welcome back" subtitle="Sign in to your dashboard">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <PhoneInput
          value={phone}
          onChange={setPhone}
          disabled={loading}
        />

        <div>
          <PasswordInput
            value={password}
            onChange={setPassword}
            disabled={loading}
          />
          <div style={{ textAlign: 'right', marginTop: 6 }}>
            <a
              href="/login/forgot"
              style={{
                fontSize: 'var(--fs-caption)',
                color: 'var(--fg-muted)',
                textDecoration: 'none',
              }}
            >
              Forgot password?
            </a>
          </div>
        </div>

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
          disabled={loading || !phone || !password}
          style={{
            width: '100%',
            padding: '13px 0',
            background: loading || !phone || !password ? 'var(--bg-subtle)' : 'var(--baari-onyx)',
            color: loading || !phone || !password ? 'var(--fg-muted)' : '#fff',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--fs-body)',
            fontFamily: 'var(--font-body)',
            fontWeight: 'var(--fw-medium)',
            cursor: loading || !phone || !password ? 'not-allowed' : 'pointer',
            transition: 'background var(--dur-fast)',
            letterSpacing: 'var(--tracking-button)',
          }}
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>

        <p style={{
          textAlign: 'center',
          fontSize: 'var(--fs-body-sm)',
          color: 'var(--fg-muted)',
          fontFamily: 'var(--font-body)',
          margin: 0,
        }}>
          No account?{' '}
          <a href="/signup" style={{ color: 'var(--fg-link)', fontWeight: 'var(--fw-medium)' }}>
            Create one
          </a>
        </p>
      </form>
    </AuthCard>
  );
}
