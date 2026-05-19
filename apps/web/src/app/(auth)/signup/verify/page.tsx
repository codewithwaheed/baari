'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AuthCard } from '@/components/auth/AuthCard';
import { OTPInput } from '@/components/auth/OTPInput';

const API = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';

export default function SignupVerifyPage() {
  const router = useRouter();
  const [phone,     setPhone]     = useState('');
  const [otp,       setOtp]       = useState('');
  const [loading,   setLoading]   = useState(false);
  const [resending, setResending] = useState(false);
  const [error,     setError]     = useState('');
  const [countdown, setCountdown] = useState(300);

  useEffect(() => {
    const stored = sessionStorage.getItem('baari_signup_phone');
    if (!stored) { router.replace('/signup'); return; }
    setPhone(stored);
  }, [router]);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  // Auto-submit when all 6 digits entered
  useEffect(() => {
    if (otp.replace(/\s/g, '').length === 6 && !loading) {
      handleVerify(otp);
    }
  }, [otp]); // eslint-disable-line

  async function handleVerify(code: string) {
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/v1/auth/verify-otp`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ phone, otp: code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message ?? 'Wrong code. Try again.');
        setOtp('');
        return;
      }
      router.push('/signup/password');
    } catch {
      setError('Connection error. Try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setResending(true);
    setError('');
    try {
      await fetch(`${API}/api/v1/auth/send-otp`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ phone }),
      });
      setCountdown(300);
      setOtp('');
    } catch {
      setError('Could not resend. Try again.');
    } finally {
      setResending(false);
    }
  }

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <AuthCard
      title="Enter the code"
      subtitle={phone ? `We sent a 6-digit code to ${phone.replace('+92', '0')}` : 'Loading…'}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <OTPInput value={otp} onChange={setOtp} error={error} disabled={loading} />

        {!error && countdown > 0 && (
          <p style={{
            textAlign: 'center',
            fontSize: 'var(--fs-caption)',
            color: 'var(--fg-muted)',
            fontFamily: 'var(--font-body)',
            margin: 0,
          }}>
            Code expires in {fmt(countdown)}
          </p>
        )}

        {countdown === 0 && (
          <button
            type="button"
            onClick={handleResend}
            disabled={resending}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 'var(--fs-body-sm)',
              fontFamily: 'var(--font-body)',
              color: 'var(--fg-link)',
              textDecoration: 'underline',
              padding: 0,
              margin: '0 auto',
              display: 'block',
            }}
          >
            {resending ? 'Sending…' : 'Resend code'}
          </button>
        )}

        <a
          href="/signup"
          style={{
            textAlign: 'center',
            fontSize: 'var(--fs-caption)',
            color: 'var(--fg-muted)',
            fontFamily: 'var(--font-body)',
            display: 'block',
            textDecoration: 'none',
          }}
        >
          ← Change number
        </a>
      </div>
    </AuthCard>
  );
}
