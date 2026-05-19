'use client';
import { useRef } from 'react';

interface OTPInputProps {
  value: string;            // 6-char string e.g. "123456" (padded with '' for unset)
  onChange: (v: string) => void;
  error?: string;
  disabled?: boolean;
}

export function OTPInput({ value, onChange, error, disabled }: OTPInputProps) {
  const refs = Array.from({ length: 6 }, () => useRef<HTMLInputElement>(null));
  const digits = value.split('').concat(Array(6).fill('')).slice(0, 6);

  function handleChange(i: number, e: React.ChangeEvent<HTMLInputElement>) {
    const char = e.target.value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[i] = char;
    onChange(next.join(''));
    if (char && i < 5) refs[i + 1]?.current?.focus();
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      refs[i - 1]?.current?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const next = pasted.split('').concat(Array(6).fill('')).slice(0, 6);
    onChange(next.join(''));
    const focusIdx = Math.min(pasted.length, 5);
    refs[focusIdx]?.current?.focus();
  }

  const boxStyle = (filled: boolean, hasError: boolean): React.CSSProperties => ({
    width: 48,
    height: 56,
    fontSize: 24,
    fontFamily: 'var(--font-body)',
    fontWeight: 'var(--fw-medium)',
    color: 'var(--fg)',
    textAlign: 'center',
    background: filled ? 'var(--bg-accent-soft)' : 'var(--bg)',
    border: `1.5px solid ${hasError ? 'var(--baari-error)' : filled ? 'var(--baari-lime-deep)' : 'var(--border)'}`,
    borderRadius: 'var(--radius-md)',
    outline: 'none',
    caretColor: 'var(--baari-lime-deep)',
    transition: 'border-color var(--dur-fast), background var(--dur-fast)',
  });

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
        {digits.map((d, i) => (
          <input
            key={i}
            ref={refs[i]}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={d}
            disabled={disabled}
            onChange={e => handleChange(i, e)}
            onKeyDown={e => handleKeyDown(i, e)}
            onPaste={handlePaste}
            style={boxStyle(!!d, !!error)}
          />
        ))}
      </div>
      {error && (
        <p style={{
          margin: '10px 0 0',
          fontSize: 'var(--fs-caption)',
          color: 'var(--baari-error)',
          fontFamily: 'var(--font-body)',
          textAlign: 'center',
        }}>
          {error}
        </p>
      )}
    </div>
  );
}
