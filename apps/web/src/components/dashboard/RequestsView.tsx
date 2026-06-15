'use client';

import { Avatar, DButton, Pill, fmtPKR, fmtTime } from './primitives';
import type { BookingRequest } from './data';

interface RequestsViewProps {
  requests: BookingRequest[];
  requestErrors: Record<string, string>; // requestId → error message
  onApprove: (r: BookingRequest) => void;
  onDecline: (r: BookingRequest) => void;
}

export function RequestsView({ requests, requestErrors, onApprove, onDecline }: RequestsViewProps) {
  return (
    <div style={{ flex: 1, overflow: 'auto', background: 'var(--baari-cream)', fontFamily: 'var(--font-body)' }}>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '24px 16px 64px' }}>

        {/* Header */}
        <header style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h2 style={{
              fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 200,
              letterSpacing: '-0.02em', color: 'var(--baari-onyx)', margin: 0, lineHeight: 1.1,
            }}>
              <strong>Booking</strong> requests
            </h2>
            <p style={{ fontSize: 13, color: 'var(--fg-secondary)', margin: '6px 0 0' }}>
              Approve to add to the calendar · decline to remove.
            </p>
          </div>
          {requests.length > 0 && (
            <div style={{ fontSize: 13, color: 'var(--fg-secondary)', whiteSpace: 'nowrap' }}>
              <strong style={{ color: 'var(--baari-onyx)' }}>{requests.length}</strong> pending
            </div>
          )}
        </header>

        {/* Empty state */}
        {requests.length === 0 ? (
          <div style={{
            padding: '40px 24px', textAlign: 'center',
            background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 10,
          }}>
            <div style={{
              width: 52, height: 52, borderRadius: 999, margin: '0 auto 12px',
              background: 'var(--baari-bone)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
                stroke="var(--baari-stone)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>
                <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
              </svg>
            </div>
            <div style={{
              fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 200,
              letterSpacing: '-0.01em', color: 'var(--baari-onyx)',
            }}>
              <strong>Inbox</strong> zero.
            </div>
            <p style={{ fontSize: 13, color: 'var(--fg-muted)', margin: '6px 0 0' }}>
              No pending booking requests. New ones will land here.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {requests.map(r => (
              <RequestCard
                key={r.id}
                req={r}
                error={requestErrors[r.id]}
                onApprove={() => onApprove(r)}
                onDecline={() => onDecline(r)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface RequestCardProps {
  req: BookingRequest;
  error?: string;
  onApprove: () => void;
  onDecline: () => void;
}

function RequestCard({ req, error, onApprove, onDecline }: RequestCardProps) {
  const totalDurationMin = req.services.reduce((s, sv) => s + sv.durationMin, 0);

  return (
    <div style={{
      background: '#fff',
      border: '1px solid var(--baari-sand)',
      borderRadius: 10,
      overflow: 'hidden',
    }}>
      {/* ── Top: avatar + name + phone ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '14px 16px 10px',
      }}>
        <Avatar name={req.client} size={38} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--baari-onyx)', lineHeight: 1.3 }}>{req.client}</div>
          <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 1, fontVariantNumeric: 'tabular-nums' }}>{req.phone}</div>
        </div>
      </div>

      {/* ── Details grid ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 10,
        padding: '0 16px 12px',
        borderBottom: '1px solid var(--baari-bone)',
      }}>

        {/* Services */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--baari-stone)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>
            Services
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {req.services.map(sv => (
              <span key={sv.id} style={{
                display: 'inline-block',
                padding: '3px 8px',
                background: 'var(--baari-bone)',
                border: '1px solid var(--baari-sand)',
                borderRadius: 5,
                fontSize: 11,
                fontWeight: 500,
                color: 'var(--baari-espresso)',
              }}>
                {sv.name}
              </span>
            ))}
          </div>
          <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 5 }}>
            with {req.staff} · {totalDurationMin} min
          </div>
        </div>

        {/* When */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--baari-stone)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>
            When
          </div>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--baari-onyx)' }}>{req.day}</div>
          <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>{fmtTime(req.time)}</div>
        </div>

        {/* Total */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--baari-stone)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>
            Total
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--baari-onyx)', fontVariantNumeric: 'tabular-nums' }}>
            {fmtPKR(req.amount)}
          </div>
        </div>

        {/* Payment */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--baari-stone)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>
            Payment
          </div>
          <Pill tone={req.paid ? 'success' : 'warning'}>
            {req.paid ? 'Paid' : 'Pending'}
          </Pill>
        </div>
      </div>

      {/* ── Actions: full-width Decline + Approve ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 8,
        padding: '10px 12px',
      }}>
        <DButton variant="ghost" onClick={onDecline} size="sm"
          style={{ justifyContent: 'center' }}>
          Decline
        </DButton>
        <DButton variant="primary" onClick={onApprove} size="sm" leadingIcon="check"
          style={{ justifyContent: 'center' }}>
          Approve
        </DButton>
      </div>

      {/* ── Inline error ── */}
      {error && (
        <div style={{
          padding: '8px 16px 12px',
          fontSize: 12, color: '#b5483a',
          background: '#fdf3f2',
          borderTop: '1px solid #f5e2df',
        }}>
          ⚠ {error}
        </div>
      )}
    </div>
  );
}
