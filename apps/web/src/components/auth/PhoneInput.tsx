'use client';
import { useState } from 'react';

interface PhoneInputProps {
  value: string;
  onChange: (normalized: string) => void;
  error?: string;
  disabled?: boolean;
}

export function PhoneInput({ value, onChange, error, disabled }: PhoneInputProps) {
  const [display, setDisplay] = useState(value);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    setDisplay(raw);
    onChange(raw);
  }

  function handleBlur() {
    const digits = display.replace(/\D/g, '');
    let normalized = display;
    if (digits.startsWith('0') && digits.length === 11) {
      normalized = `0${digits.slice(1, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
    }
    setDisplay(normalized);
  }

  return (
    <div>
      <label style={{
        display: 'block',
        fontFamily: 'var(--font-body)',
        fontSize: 'var(--fs-body-sm)',
        fontWeight: 'var(--fw-medium)',
        color: 'var(--fg-secondary)',
        marginBottom: 6,
      }}>
        Mobile number
      </label>
      <div style={{ position: 'relative' }}>
        <span style={{
          position: 'absolute',
          left: 12,
          top: '50%',
          transform: 'translateY(-50%)',
          fontSize: 'var(--fs-body)',
          color: 'var(--fg-muted)',
          pointerEvents: 'none',
          userSelect: 'none',
        }}>
          +92
        </span>
        <input
          type="tel"
          inputMode="numeric"
          placeholder="03XX XXX XXXX"
          value={display}
          onChange={handleChange}
          onBlur={handleBlur}
          disabled={disabled}
          style={{
            width: '100%',
            paddingLeft: 48,
            paddingRight: 12,
            paddingTop: 12,
            paddingBottom: 12,
            fontSize: 'var(--fs-body)',
            fontFamily: 'var(--font-body)',
            color: 'var(--fg)',
            background: 'var(--bg)',
            border: `1px solid ${error ? 'var(--baari-error)' : 'var(--border)'}`,
            borderRadius: 'var(--radius-md)',
            outline: 'none',
            boxSizing: 'border-box',
            transition: 'border-color var(--dur-fast)',
          }}
          onFocus={e => {
            e.target.style.borderColor = 'var(--baari-lime-deep)';
            e.target.style.boxShadow   = 'var(--shadow-ring)';
          }}
          onBlurCapture={e => {
            e.target.style.borderColor = error ? 'var(--baari-error)' : 'var(--border)';
            e.target.style.boxShadow   = 'none';
          }}
        />
      </div>
      {error && (
        <p style={{
          margin: '6px 0 0',
          fontSize: 'var(--fs-caption)',
          color: 'var(--baari-error)',
          fontFamily: 'var(--font-body)',
        }}>
          {error}
        </p>
      )}
    </div>
  );
}
