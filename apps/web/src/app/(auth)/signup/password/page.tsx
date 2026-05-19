'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AuthCard } from '@/components/auth/AuthCard';
import { PasswordInput } from '@/components/auth/PasswordInput';

const API = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';

export default function SignupPasswordPage() {
  const router = useRouter();
  const [phone,    setPhone]    = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  useEffect(() => {
    const stored = sessionStorage.getItem('baari_signup_phone');
    if (!stored) { router.replace('/signup'); return; }
    setPhone(stored);
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API}/api/v1/auth/complete-signup`, {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body:        JSON.stringify({ phone, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error?.message ?? 'Could not create account. Try again.');
        return;
      }

      sessionStorage.removeItem('baari_signup_phone');
      router.push('/dashboard');
    } catch {
      setError('Connection error. Try again.');
    } finally {
      setLoading(false);
    }
  }

  const ready = password.length >= 8 && password === confirm;

  return (
    <AuthCard
      title="Set your password"
      subtitle="You'll use this to sign in from now on. No codes needed."
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <PasswordInput
          label="Password"
          value={password}
          onChange={setPassword}
          disabled={loading}
          showStrength
          placeholder="Min. 8 characters"
        />

        <PasswordInput
          label="Confirm password"
          value={confirm}
          onChange={setConfirm}
          disabled={loading}
          error={confirm && password !== confirm ? 'Passwords do not match' : undefined}
        />

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
          disabled={loading || !ready}
          style={{
            width: '100%',
            padding: '13px 0',
            background: loading || !ready ? 'var(--bg-subtle)' : 'var(--baari-onyx)',
            color: loading || !ready ? 'var(--fg-muted)' : '#fff',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--fs-body)',
            fontFamily: 'var(--font-body)',
            fontWeight: 'var(--fw-medium)',
            cursor: loading || !ready ? 'not-allowed' : 'pointer',
            transition: 'background var(--dur-fast)',
          }}
        >
          {loading ? 'Creating account…' : 'Create account →'}
        </button>
      </form>
    </AuthCard>
  );
}
