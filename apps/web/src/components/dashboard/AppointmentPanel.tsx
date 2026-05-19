'use client';

import { useState, useEffect } from 'react';
import { StatusBadge, Avatar, IconButton, DButton, Icon, Eyebrow, fmtPKR, fmtTimeRange } from './primitives';
import { STAFF } from './data';
import type { Appointment, Client } from './data';

interface AppointmentPanelProps {
  appt: Appointment;
  client: Client | null;
  onClose: () => void;
  onCheckout: () => void;
  onReschedule: () => void;
  onCancel: () => void;
  onUpdateNotes?: (clientId: string, notes: string) => void;
}

export function AppointmentPanel({ appt, client, onClose, onCheckout, onReschedule, onCancel, onUpdateNotes }: AppointmentPanelProps) {
  const [notes, setNotes] = useState(client?.notes ?? '');
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setNotes(client?.notes ?? '');
    setEditing(false);
  }, [appt.id, client?.id]);

  const staff = STAFF.find(s => s.id === appt.staff);
  const visits = client?.history?.length ?? 1;
  const memberSince = client?.history?.length
    ? (client.history[client.history.length - 1].date ?? '').split(', ').pop() ?? '2024'
    : '2024';
  const phone = client?.phone ?? appt.phone ?? '—';
  const optIn = client?.whatsappOptIn !== false;
  const recent = (client?.history ?? []).slice(1, 5);

  return (
    <aside style={{
      width: 400, flexShrink: 0,
      background: 'var(--baari-cream)',
      borderLeft: '1px solid var(--border)',
      fontFamily: 'var(--font-body)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '18px 24px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <StatusBadge status={appt.status} withDot />
        <IconButton name="close" onClick={onClose} title="Close" />
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflow: 'auto', padding: '14px 24px 20px', display: 'flex', flexDirection: 'column', gap: 18 }}>

        {/* Identity */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Avatar name={appt.client} size={56} />
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontFamily: 'var(--font-display)', fontSize: 26, lineHeight: 1.1,
              letterSpacing: '-0.01em', color: 'var(--baari-onyx)',
            }}>{appt.client}</div>
            <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {client?.vip && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Icon name="star" size={11} color="var(--baari-ink)" stroke={2} />
                  <span style={{ color: 'var(--baari-ink)', fontWeight: 500 }}>VIP</span>
                  <span>·</span>
                </span>
              )}
              <span>{visits} visit{visits !== 1 ? 's' : ''}</span>
              <span>·</span>
              <span>Member since {memberSince}</span>
            </div>
          </div>
        </div>

        {/* Today's appointment */}
        <section style={{
          background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 2, padding: 16,
        }}>
          <Eyebrow style={{ marginBottom: 10 }}>Today's appointment</Eyebrow>
          <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--baari-onyx)', lineHeight: 1.3 }}>
            {appt.service}
          </div>
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 14, fontSize: 12, color: 'var(--fg-secondary)', flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <Icon name="clock" size={13} /> {fmtTimeRange(appt.start, appt.end)}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <Icon name="user" size={13} /> {staff?.name ?? '—'}
            </span>
          </div>
          <div style={{
            marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border-subtle)',
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: 12, color: 'var(--fg-muted)' }}>Service total</span>
            <span style={{
              fontFamily: 'var(--font-display)', fontSize: 24,
              letterSpacing: '-0.01em', color: 'var(--baari-onyx)',
            }}>{fmtPKR(appt.price)}</span>
          </div>
        </section>

        {/* Contact */}
        <section>
          <Eyebrow style={{ marginBottom: 8 }}>Contact</Eyebrow>
          <div style={{
            background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 2,
            padding: '12px 16px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
          }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--baari-onyx)', fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
              <Icon name="phone" size={14} color="var(--fg-muted)" />
              {phone}
            </span>
            {optIn && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#1B6E3F', fontSize: 12, fontWeight: 500 }}>
                <Icon name="whatsapp" size={14} color="#25D366" stroke={1.6} />
                Booked via WhatsApp
              </span>
            )}
          </div>
        </section>

        {/* Notes */}
        <section>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <Eyebrow>Client notes</Eyebrow>
            {!editing ? (
              <button onClick={() => setEditing(true)} style={{
                background: 'transparent', border: 0, cursor: 'pointer', padding: 0,
                color: 'var(--baari-graphite)', fontSize: 11, fontWeight: 500,
                display: 'inline-flex', alignItems: 'center', gap: 4,
              }}>
                <Icon name="edit" size={11} /> Edit
              </button>
            ) : (
              <button onClick={() => { setEditing(false); if (client) onUpdateNotes?.(client.id, notes); }} style={{
                background: 'transparent', border: 0, cursor: 'pointer', padding: 0,
                color: 'var(--baari-ink)', fontSize: 11, fontWeight: 600,
                display: 'inline-flex', alignItems: 'center', gap: 4,
              }}>
                <Icon name="check" size={11} /> Save
              </button>
            )}
          </div>
          {editing ? (
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              autoFocus rows={4}
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'rgba(232, 255, 71, 0.10)',
                border: '1px solid rgba(232, 255, 71, 0.55)',
                borderRadius: 2, padding: 12, resize: 'vertical',
                fontFamily: 'var(--font-body)', fontSize: 13,
                color: 'var(--baari-graphite)', lineHeight: 1.5, outline: 'none',
              }}
            />
          ) : (
            <div style={{
              background: 'rgba(232, 255, 71, 0.10)',
              border: '1px solid rgba(232, 255, 71, 0.35)',
              borderRadius: 2, padding: 12, minHeight: 48,
              fontSize: 13, color: notes ? 'var(--baari-graphite)' : 'var(--fg-muted)',
              lineHeight: 1.5, fontStyle: notes ? 'normal' : 'italic',
            }}>
              {notes || 'No notes yet. Tap Edit to add.'}
            </div>
          )}
        </section>

        {/* Recent visits */}
        <section>
          <Eyebrow style={{ marginBottom: 8 }}>Recent visits</Eyebrow>
          {recent.length === 0 ? (
            <div style={{
              padding: 12, background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 2,
              fontSize: 12, color: 'var(--fg-muted)', fontStyle: 'italic',
            }}>No previous visits on record.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recent.map((h, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 12px', background: '#fff',
                  border: '1px solid var(--border-subtle)', borderRadius: 2,
                }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: 'var(--baari-onyx)', fontWeight: 500 }}>{h.service}</div>
                    <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 2 }}>
                      {h.date}{h.staff ? ` · ${h.staff}` : ''}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--fg-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                    {h.amount ? fmtPKR(h.amount) : '—'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Footer actions */}
      <div style={{
        padding: '16px 24px', background: '#fff',
        borderTop: '1px solid var(--border-subtle)',
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        <DButton variant="primary" leadingIcon="card" onClick={onCheckout}
          style={{ width: '100%', justifyContent: 'center', padding: '12px 16px', fontSize: 14 }}>
          Check out
        </DButton>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <DButton variant="ghost" onClick={onReschedule} style={{ justifyContent: 'center' }}>Reschedule</DButton>
          <DButton variant="danger" onClick={onCancel} style={{ justifyContent: 'center' }}>Cancel</DButton>
        </div>
      </div>
    </aside>
  );
}

export function AppointmentPanelEmpty() {
  return (
    <aside style={{
      width: 400, flexShrink: 0,
      background: 'var(--baari-cream)',
      borderLeft: '1px solid var(--border)',
      padding: '40px 28px',
      fontFamily: 'var(--font-body)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      textAlign: 'center', gap: 14,
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: 999,
        background: 'rgba(40,34,25,0.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--fg-muted)',
      }}>
        <Icon name="calendar" size={26} stroke={1.4} />
      </div>
      <div style={{
        fontFamily: 'var(--font-display)', fontSize: 22, lineHeight: 1.2,
        color: 'var(--baari-onyx)', letterSpacing: '-0.01em',
      }}>
        Tap any <strong>appointment</strong>
      </div>
      <p style={{ fontSize: 13, color: 'var(--fg-muted)', margin: 0, maxWidth: 240 }}>
        Open a block on the calendar to see client history, notes, and check them out.
      </p>
    </aside>
  );
}
