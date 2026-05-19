'use client';

import { useState } from 'react';
import { IconButton, DButton, Eyebrow, Icon } from './primitives';
import { STAFF, SERVICES } from './data';
import type { Appointment } from './data';

const TIME_SLOTS: number[] = [];
for (let h = 8; h < 20; h += 0.5) TIME_SLOTS.push(h);

function isoDate(d: Date): string {
  const yr = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const dy = String(d.getDate()).padStart(2, '0');
  return `${yr}-${mo}-${dy}`;
}

function fmtSlot(h: number): string {
  const period = h >= 12 ? 'pm' : 'am';
  const hr = Math.floor(h);
  const m = Math.round((h - hr) * 60);
  const display = hr > 12 ? hr - 12 : hr === 0 ? 12 : hr;
  return m ? `${display}:${String(m).padStart(2, '0')}${period}` : `${display}${period}`;
}

interface NewBookingModalProps {
  open: boolean;
  defaultDate?: Date;
  onClose: () => void;
  onCreate: (appt: Appointment) => void;
}

export function NewBookingModal({ open, defaultDate, onClose, onCreate }: NewBookingModalProps) {
  const [phone, setPhone]     = useState('');
  const [name, setName]       = useState('');
  const [service, setService] = useState(SERVICES[0].name);
  const [staffId, setStaffId] = useState(STAFF[0].id);
  const [date, setDate]       = useState(() => isoDate(defaultDate ?? new Date()));
  const [slot, setSlot]       = useState(11.0);
  const [sendLink, setSendLink] = useState(true);

  if (!open) return null;

  const handleSubmit = () => {
    if (!phone.trim() || !name.trim()) return;
    const svc = SERVICES.find(s => s.name === service);
    const start = slot;
    const end = parseFloat((start + (svc?.dur ?? 1)).toFixed(2));
    onCreate({
      id: `new-${Date.now()}`,
      staff: staffId,
      client: name.trim(),
      phone: phone.trim(),
      service,
      start, end,
      status: 'pendingPayment',
      price: svc?.price ?? 0,
    });
    setPhone(''); setName('');
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15,12,8,0.55)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 150, fontFamily: 'var(--font-body)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 560, maxWidth: '92vw', maxHeight: '90vh',
          background: '#fff', borderRadius: 12,
          boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <Eyebrow>New booking</Eyebrow>
            <div style={{
              fontFamily: 'var(--font-display)', fontSize: 26, letterSpacing: '-0.01em',
              color: 'var(--baari-onyx)', lineHeight: 1.1, marginTop: 4,
            }}>Book a <strong>client</strong></div>
          </div>
          <IconButton name="close" onClick={onClose} />
        </div>

        {/* Form */}
        <div style={{ padding: '20px 24px', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <FormRow>
            <Field label="Client phone" required>
              <FormInput value={phone} onChange={setPhone} placeholder="0300 1234 567" type="tel" />
            </Field>
            <Field label="Client name" required>
              <FormInput value={name} onChange={setName} placeholder="Aiman Saeed" />
            </Field>
          </FormRow>

          <Field label="Service">
            <FormSelect value={service} onChange={setService}>
              {SERVICES.map(s => (
                <option key={s.name} value={s.name}>
                  {s.name} — PKR {(s.price / 100).toLocaleString()}
                </option>
              ))}
            </FormSelect>
          </Field>

          <Field label="Staff">
            <FormSelect value={staffId} onChange={setStaffId}>
              {STAFF.map(s => (
                <option key={s.id} value={s.id}>{s.name} · {s.role}</option>
              ))}
            </FormSelect>
          </Field>

          <FormRow>
            <Field label="Date">
              <FormInput type="date" value={date} onChange={setDate} />
            </Field>
            <Field label="Time slot">
              <FormSelect value={String(slot)} onChange={(v) => setSlot(parseFloat(v))}>
                {TIME_SLOTS.map(h => (
                  <option key={h} value={h}>{fmtSlot(h)}</option>
                ))}
              </FormSelect>
            </Field>
          </FormRow>

          {/* WhatsApp payment link toggle */}
          <button onClick={() => setSendLink(!sendLink)} style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
            background: sendLink ? 'rgba(37,211,102,0.07)' : 'var(--baari-cream)',
            border: '1px solid ' + (sendLink ? '#7BC698' : 'var(--border-subtle)'),
            borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
          }}>
            <span style={{
              width: 32, height: 32, borderRadius: 999,
              background: sendLink ? '#25D366' : 'var(--baari-bone)',
              color: sendLink ? '#fff' : 'var(--fg-muted)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Icon name="whatsapp" size={16} stroke={1.6} />
            </span>
            <span style={{ flex: 1 }}>
              <span style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--baari-onyx)' }}>
                Send payment link via WhatsApp
              </span>
              <span style={{ display: 'block', fontSize: 11, color: 'var(--fg-muted)', marginTop: 2 }}>
                Client confirms booking by paying. Auto-confirms on payment.
              </span>
            </span>
            {/* Toggle pill */}
            <span style={{
              width: 36, height: 22, borderRadius: 999, flexShrink: 0, position: 'relative',
              background: sendLink ? 'var(--baari-onyx)' : 'var(--baari-sand)',
              transition: 'background 150ms ease',
            }}>
              <span style={{
                position: 'absolute', top: 2, left: sendLink ? 16 : 2,
                width: 18, height: 18, borderRadius: 999, background: '#fff',
                transition: 'left 150ms ease',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }} />
            </span>
          </button>
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px', borderTop: '1px solid var(--border-subtle)',
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10,
          background: 'var(--baari-cream)',
        }}>
          <DButton variant="ghost" onClick={onClose}>Cancel</DButton>
          <DButton variant="primary" onClick={handleSubmit} disabled={!phone.trim() || !name.trim()}>
            Confirm booking
          </DButton>
        </div>
      </div>
    </div>
  );
}

// ─── Form helpers ─────────────────────────────────────────────────────────────

function FormRow({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>{children}</div>;
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 11, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 500 }}>
        {label}{required && <span style={{ color: 'var(--baari-error)' }}> *</span>}
      </span>
      {children}
    </label>
  );
}

function FormInput({ value, onChange, placeholder, type = 'text' }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <input
      type={type} value={value} placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      style={{
        padding: '10px 0', background: 'transparent',
        border: 0, borderBottom: '1px solid var(--border)',
        fontFamily: 'inherit', fontSize: 14, color: 'var(--baari-onyx)', outline: 'none',
      }}
      onFocus={(e) => { e.target.style.borderBottomColor = 'var(--baari-onyx)'; }}
      onBlur={(e)  => { e.target.style.borderBottomColor = 'var(--border)'; }}
    />
  );
}

function FormSelect({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        padding: '10px 0', background: 'transparent',
        border: 0, borderBottom: '1px solid var(--border)',
        fontFamily: 'inherit', fontSize: 14, color: 'var(--baari-onyx)',
        outline: 'none', appearance: 'none',
        backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238A8275' stroke-width='1.5'><polyline points='6 9 12 15 18 9'/></svg>")`,
        backgroundRepeat: 'no-repeat', backgroundPosition: 'right 4px center',
        paddingRight: 24,
      }}
    >
      {children}
    </select>
  );
}
