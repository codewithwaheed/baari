'use client';
import { useState } from 'react';

interface PasswordInputProps {
  value: string;
  onChange: (v: string) => void;
  label?: string;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  showStrength?: boolean;
}

function getStrength(pw: string): { level: 0 | 1 | 2 | 3; label: string } {
  if (pw.length === 0)  return { level: 0, label: '' };
  if (pw.length < 8)    return { level: 1, label: 'Too short' };
  if (pw.length < 12)   return { level: 2, label: 'OK' };
  return                       { level: 3, label: 'Strong' };
}

const STRENGTH_COLOR: Record<0 | 1 | 2 | 3, string> = {
  0: 'var(--border)',
  1: 'var(--baari-error)',
  2: 'var(--baari-warning)',
  3: 'var(--baari-success)',
};

export function PasswordInput({
  value, onChange, label = 'Password', placeholder = '••••••••',
  error, disabled, showStrength = false,
}: PasswordInputProps) {
  const [show, setShow] = useState(false);
  const strength = getStrength(value);

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
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="current-password"
          style={{
            width: '100%',
            paddingLeft: 12,
            paddingRight: 44,
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
          onBlur={e => {
            e.target.style.borderColor = error ? 'var(--baari-error)' : 'var(--border)';
            e.target.style.boxShadow   = 'none';
          }}
        />
        <button
          type="button"
          onClick={() => setShow(s => !s)}
          tabIndex={-1}
          style={{
            position: 'absolute',
            right: 10,
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 4,
            color: 'var(--fg-muted)',
            fontSize: 16,
            lineHeight: 1,
          }}
        >
          {show ? '🙈' : '👁️'}
        </button>
      </div>

      {showStrength && value.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
            {([1, 2, 3] as const).map(l => (
              <div key={l} style={{
                flex: 1,
                height: 3,
                borderRadius: 999,
                background: strength.level >= l ? STRENGTH_COLOR[strength.level] : 'var(--border)',
                transition: 'background var(--dur-fast)',
              }} />
            ))}
          </div>
          {strength.label && (
            <p style={{
              margin: 0,
              fontSize: 'var(--fs-caption)',
              color: STRENGTH_COLOR[strength.level],
              fontFamily: 'var(--font-body)',
            }}>
              {strength.label}
            </p>
          )}
        </div>
      )}

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
