'use client';

import { useState } from 'react';
import { IconButton, DButton, Icon, Eyebrow, fmtPKR, fmtTimeRange } from './primitives';
import type { Appointment } from './data';

const METHODS = [
  { id: 'cash',      label: 'Cash',      sub: 'Manual entry',               icon: 'cash'   },
  { id: 'jazzcash',  label: 'JazzCash',  sub: 'Mobile wallet · 03xx',        icon: 'wallet' },
  { id: 'easypaisa', label: 'EasyPaisa', sub: 'Mobile wallet · 03xx',        icon: 'wallet' },
  { id: 'raast',     label: 'Raast QR',  sub: 'Scan-to-pay, instant',        icon: 'qr'     },
  { id: 'card',      label: 'Card',      sub: 'Debit / credit on terminal',  icon: 'card'   },
] as const;

// Quick discount amounts in PKR (stored as paisa in state)
const QUICK_DISCOUNTS = [50, 100, 200] as const;

export interface POSResult {
  method: string;
  discount: number; // paisa
  total: number;    // paisa
}

interface POSPanelProps {
  appt: Appointment;
  onBack: () => void;
  onConfirm: (result: POSResult) => void;
}

export function POSPanel({ appt, onBack, onConfirm }: POSPanelProps) {
  const [discountInput, setDiscountInput] = useState('');
  const [method, setMethod] = useState<string>('cash');

  // Parse input to paisa — blank or 0 means no discount
  const discountPKR = parseFloat(discountInput) || 0;
  const discount = Math.round(Math.max(0, discountPKR) * 100);

  // Subtotal = sum of all service prices (equals appt.price for confirmed bookings)
  const subtotal = appt.services.reduce((sum, s) => sum + s.pricePaisa, 0) || appt.price;
  const total    = Math.max(0, subtotal - discount);

  return (
    <aside style={{
      width: 400, flexShrink: 0,
      background: 'var(--baari-cream)',
      borderLeft: '1px solid var(--border)',
      fontFamily: 'var(--font-body)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 16px 14px 8px',
        display: 'flex', alignItems: 'center', gap: 6,
        borderBottom: '1px solid var(--border-subtle)',
      }}>
        <IconButton name="arrowLeft" onClick={onBack} title="Back to appointment" />
        <div style={{ flex: 1 }}>
          <Eyebrow>Checkout</Eyebrow>
          <div style={{
            fontFamily: 'var(--font-display)', fontSize: 22,
            letterSpacing: '-0.01em', color: 'var(--baari-onyx)', lineHeight: 1.1, marginTop: 2,
          }}>{appt.client}</div>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflow: 'auto', padding: '18px 24px 24px', display: 'flex', flexDirection: 'column', gap: 22 }}>

        {/* Service line items */}
        <section>
          <Eyebrow style={{ marginBottom: 8 }}>Services</Eyebrow>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {appt.services.map((svc, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 2,
                padding: '12px 16px',
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 4, flexShrink: 0,
                  background: i === 0 ? 'var(--baari-espresso)' : 'var(--baari-bone)',
                  color: i === 0 ? 'var(--baari-lime)' : 'var(--baari-graphite)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700,
                }}>
                  {i === 0 ? <Icon name="scissors" size={15} stroke={1.6} /> : i + 1}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: 'var(--baari-onyx)', fontWeight: 500 }}>{svc.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 2 }}>{svc.durationMin} min</div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--baari-onyx)', fontVariantNumeric: 'tabular-nums' }}>
                  {fmtPKR(svc.pricePaisa)}
                </div>
              </div>
            ))}
          </div>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '8px 16px', marginTop: 2,
            fontSize: 11, color: 'var(--fg-muted)',
          }}>
            <span><Icon name="clock" size={11} color="var(--fg-muted)" /> {fmtTimeRange(appt.start, appt.end)}</span>
            <span>{appt.services.reduce((s, svc) => s + svc.durationMin, 0)} min total</span>
          </div>
        </section>

        {/* Discount */}
        <section>
          <Eyebrow style={{ marginBottom: 10 }}>Discount</Eyebrow>
          {/* Custom PKR input */}
          <div style={{
            display: 'flex', alignItems: 'center',
            background: '#fff', border: '1px solid var(--border)',
            borderRadius: 4, overflow: 'hidden', marginBottom: 8,
          }}>
            <span style={{
              padding: '0 10px', fontSize: 13, color: 'var(--fg-muted)',
              borderRight: '1px solid var(--border-subtle)', height: '100%',
              display: 'flex', alignItems: 'center', whiteSpace: 'nowrap',
              background: 'var(--baari-bone)',
            }}>PKR</span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              placeholder="0"
              value={discountInput}
              onChange={e => setDiscountInput(e.target.value)}
              style={{
                flex: 1, border: 0, outline: 'none',
                padding: '12px 12px',
                fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 500,
                color: 'var(--baari-onyx)',
                background: 'transparent',
                fontVariantNumeric: 'tabular-nums',
              }}
            />
            {discountInput && (
              <button
                onClick={() => setDiscountInput('')}
                style={{
                  background: 'transparent', border: 0, cursor: 'pointer',
                  padding: '0 12px', color: 'var(--fg-muted)',
                }}
              >
                <Icon name="close" size={14} stroke={2} />
              </button>
            )}
          </div>
          {/* Quick-pick buttons */}
          <div style={{ display: 'flex', gap: 6 }}>
            {QUICK_DISCOUNTS.map(pkr => {
              const on = discountPKR === pkr && discountInput === String(pkr);
              return (
                <button key={pkr} onClick={() => setDiscountInput(String(pkr))} style={{
                  flex: 1, padding: '9px 0', borderRadius: 4, cursor: 'pointer',
                  background: on ? 'var(--baari-onyx)' : '#fff',
                  border: '1px solid ' + (on ? 'var(--baari-onyx)' : 'var(--border)'),
                  color: on ? '#fff' : 'var(--baari-onyx)',
                  fontFamily: 'inherit', fontSize: 13, fontWeight: 500,
                  transition: 'all 120ms ease',
                }}>
                  {pkr}
                </button>
              );
            })}
          </div>
        </section>

        {/* Payment method */}
        <section>
          <Eyebrow style={{ marginBottom: 10 }}>Payment method</Eyebrow>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {METHODS.map(m => {
              const on = method === m.id;
              return (
                <button key={m.id} onClick={() => setMethod(m.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 14px', borderRadius: 4, cursor: 'pointer',
                  background: '#fff',
                  border: '1px solid ' + (on ? 'var(--baari-onyx)' : 'var(--border-subtle)'),
                  textAlign: 'left', fontFamily: 'inherit',
                  boxShadow: on ? '0 0 0 2px rgba(0,0,0,0.04)' : 'none',
                  transition: 'border-color 120ms ease, box-shadow 120ms ease',
                }}>
                  <span style={{
                    width: 32, height: 32, borderRadius: 4, flexShrink: 0,
                    background: on ? 'var(--baari-onyx)' : 'var(--baari-bone)',
                    color: on ? 'var(--baari-lime)' : 'var(--baari-graphite)',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon name={m.icon} size={16} stroke={1.6} />
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 13, color: 'var(--baari-onyx)', fontWeight: 500 }}>{m.label}</span>
                    <span style={{ display: 'block', fontSize: 11, color: 'var(--fg-muted)', marginTop: 2 }}>{m.sub}</span>
                  </span>
                  <span style={{
                    width: 20, height: 20, borderRadius: 999, flexShrink: 0,
                    background: on ? 'var(--baari-onyx)' : 'transparent',
                    border: '1.5px solid ' + (on ? 'var(--baari-onyx)' : 'var(--baari-sand)'),
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {on && <Icon name="check" size={12} stroke={2.4} color="var(--baari-lime)" />}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Summary */}
        <section style={{
          marginTop: 'auto',
          background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 2,
          padding: '14px 16px',
          display: 'flex', flexDirection: 'column', gap: 8,
          fontVariantNumeric: 'tabular-nums',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--fg-secondary)' }}>
            <span>Subtotal</span>
            <span>{fmtPKR(subtotal)}</span>
          </div>
          {discount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#3A5F46', fontWeight: 500 }}>
              <span>Discount</span>
              <span>− {fmtPKR(discount)}</span>
            </div>
          )}
          <div style={{
            marginTop: 4, paddingTop: 10, borderTop: '1px solid var(--border-subtle)',
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--baari-onyx)' }}>Total</span>
            <span style={{
              fontFamily: 'var(--font-display)', fontSize: 32, letterSpacing: '-0.01em',
              color: 'var(--baari-onyx)', lineHeight: 1,
            }}>{fmtPKR(total)}</span>
          </div>
        </section>
      </div>

      {/* Footer */}
      <div style={{ padding: '16px 24px', background: '#fff', borderTop: '1px solid var(--border-subtle)' }}>
        <DButton variant="primary" onClick={() => onConfirm({ method, discount, total })}
          style={{ width: '100%', justifyContent: 'center', padding: '14px 16px', fontSize: 14 }}>
          Confirm payment · {fmtPKR(total)}
        </DButton>
      </div>
    </aside>
  );
}
