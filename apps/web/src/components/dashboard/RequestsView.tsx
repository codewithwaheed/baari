'use client';

import { Avatar, DButton, Pill, Icon, fmtPKR, fmtTime } from './primitives';
import type { BookingRequest } from './data';

interface RequestsViewProps {
  requests: BookingRequest[];
  onApprove: (r: BookingRequest) => void;
  onDecline: (r: BookingRequest) => void;
}

export function RequestsView({ requests, onApprove, onDecline }: RequestsViewProps) {
  return (
    <div style={{ flex: 1, overflow: 'auto', background: 'var(--baari-cream)', fontFamily: 'var(--font-body)' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 32px 64px' }}>

        {/* Header */}
        <header style={{ marginBottom: 24, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h2 style={{
              fontFamily: 'var(--font-display)', fontSize: 38, fontWeight: 200,
              letterSpacing: '-0.02em', color: 'var(--baari-onyx)', margin: 0, lineHeight: 1.1,
            }}>
              <strong>WhatsApp</strong> requests
            </h2>
            <p style={{ fontSize: 14, color: 'var(--fg-secondary)', margin: '8px 0 0', maxWidth: 560 }}>
              Bookings coming in via WhatsApp. Approve to push to the calendar; decline to send a regret.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--fg-secondary)' }}>
            <Icon name="whatsapp" size={16} color="#25D366" stroke={1.6} />
            <span><strong style={{ color: 'var(--baari-onyx)' }}>{requests.length}</strong> awaiting your turn</span>
          </div>
        </header>

        {/* Empty state */}
        {requests.length === 0 ? (
          <div style={{
            padding: 64, textAlign: 'center',
            background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 2,
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: 999, margin: '0 auto 14px',
              background: 'rgba(37, 211, 102, 0.10)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon name="whatsapp" size={26} color="#25D366" stroke={1.6} />
            </div>
            <div style={{
              fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 200,
              letterSpacing: '-0.01em', color: 'var(--baari-onyx)',
            }}>
              <strong>Inbox</strong> zero.
            </div>
            <p style={{ fontSize: 13, color: 'var(--fg-muted)', margin: '6px 0 0' }}>
              No pending booking requests. New asks will land here.
            </p>
          </div>
        ) : (
          <div style={{ background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 2, overflow: 'hidden' }}>
            {requests.map((r, i) => (
              <RequestRow
                key={r.id} req={r}
                divider={i < requests.length - 1}
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

interface RequestRowProps {
  req: BookingRequest;
  divider: boolean;
  onApprove: () => void;
  onDecline: () => void;
}

function RequestRow({ req, divider, onApprove, onDecline }: RequestRowProps) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'minmax(220px,1.4fr) minmax(180px,1.2fr) minmax(160px,1fr) minmax(140px,1fr) auto',
      alignItems: 'center', gap: 18,
      padding: '18px 22px',
      borderBottom: divider ? '1px solid var(--border-subtle)' : undefined,
    }}>
      {/* Client */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <Avatar name={req.client} size={40} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--baari-onyx)' }}>{req.client}</div>
          <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>{req.phone}</div>
        </div>
      </div>

      {/* Service + staff */}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, color: 'var(--baari-onyx)', fontWeight: 500 }}>{req.service}</div>
        <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 2 }}>with {req.staff}</div>
      </div>

      {/* Requested time */}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, color: 'var(--baari-onyx)', fontWeight: 500 }}>{req.day}</div>
        <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>{fmtTime(req.time)}</div>
      </div>

      {/* Payment */}
      <div style={{ minWidth: 0 }}>
        <Pill tone={req.paid ? 'success' : 'warning'}>
          {req.paid ? 'Paid' : 'Payment Pending'}
        </Pill>
        <div style={{ fontSize: 12, color: 'var(--fg-secondary)', marginTop: 6, fontVariantNumeric: 'tabular-nums' }}>
          {fmtPKR(req.amount)}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        <DButton variant="ghost" onClick={onDecline} size="sm">Decline</DButton>
        <DButton variant="primary" onClick={onApprove} size="sm" leadingIcon="check">Approve</DButton>
      </div>
    </div>
  );
}
