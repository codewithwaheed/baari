'use client';

import { useRef } from 'react';
import { StatusBadge, Icon, fmtPKR, fmtTime } from './primitives';
import type { BookingStatus } from './primitives';
import type { Appointment } from './data';

export const APPT_PALETTES: Record<BookingStatus, { bg: string; border: string; accent: string; text: string }> = {
  confirmed:      { bg: '#F1F7F3', border: '#C4DCC9', accent: '#4E7C58', text: 'var(--baari-onyx)' },
  checkedIn:      { bg: '#E6F1F1', border: '#B6D1D1', accent: '#3F8A8A', text: 'var(--baari-onyx)' },
  pendingPayment: { bg: '#FAEFE1', border: '#E2C68F', accent: '#C8923C', text: '#3D2F18' },
  completed:      { bg: '#F2F0EA', border: '#D7D1C5', accent: '#8A8275', text: 'var(--baari-graphite)' },
  noShow:         { bg: '#F5E2DF', border: '#D8B0A8', accent: '#B5483A', text: '#3D1F1A' },
};

const DRAG_THRESHOLD = 5; // px of movement before drag starts

export interface DragStartPayload {
  appt: Appointment;
  grabY: number; // px from top of card where user grabbed
}

interface AppointmentCardProps {
  appt: Appointment;
  top: number;
  height: number;
  selected: boolean;
  onClick: () => void;
  isDragging?: boolean;
  onDragStart?: (initialClientY: number, payload: DragStartPayload) => void;
}

export function AppointmentCard({
  appt, top, height, selected, onClick, isDragging = false, onDragStart,
}: AppointmentCardProps) {
  const p = APPT_PALETTES[appt.status] ?? APPT_PALETTES.confirmed;
  const compact = height < 56;
  const dragStartedRef = useRef(false);

  const handleMouseDown = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (e.button !== 0 || !onDragStart) return;
    dragStartedRef.current = false;

    const startX = e.clientX;
    const startY = e.clientY;
    const grabY  = e.clientY - e.currentTarget.getBoundingClientRect().top;

    const onMove = (me: MouseEvent) => {
      const dist = Math.hypot(me.clientX - startX, me.clientY - startY);
      if (!dragStartedRef.current && dist > DRAG_THRESHOLD) {
        dragStartedRef.current = true;
        document.removeEventListener('mousemove', onMove);
        onDragStart(me.clientY, { appt, grabY });
      }
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLButtonElement>) => {
    if (!onDragStart) return;
    dragStartedRef.current = false;

    const t0     = e.touches[0]!;
    const startX = t0.clientX;
    const startY = t0.clientY;
    const grabY  = t0.clientY - e.currentTarget.getBoundingClientRect().top;

    const onMove = (te: TouchEvent) => {
      const t    = te.touches[0]!;
      const dist = Math.hypot(t.clientX - startX, t.clientY - startY);
      if (!dragStartedRef.current && dist > DRAG_THRESHOLD) {
        dragStartedRef.current = true;
        te.preventDefault(); // stop scroll takeover
        document.removeEventListener('touchmove', onMove);
        onDragStart(t.clientY, { appt, grabY });
      }
    };

    const onUp = () => {
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onUp);
    };

    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onUp);
  };

  // Suppress click if the mouse movement turned into a drag
  const handleClick = () => {
    if (!dragStartedRef.current) onClick();
  };

  // Placeholder silhouette while the ghost follows the cursor
  if (isDragging) {
    return (
      <div style={{
        position: 'absolute', top, left: 4, right: 4, height: height - 4,
        background: p.bg, opacity: 0.2,
        border: `1.5px dashed ${p.border}`,
        borderLeft: `3px dashed ${p.accent}`,
        borderRadius: 4,
        pointerEvents: 'none',
      }} />
    );
  }

  return (
    <button
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onClick={handleClick}
      style={{
        position: 'absolute', top, left: 4, right: 4, height: height - 4,
        background: p.bg,
        border: `1px solid ${selected ? p.accent : p.border}`,
        borderLeft: `3px solid ${p.accent}`,
        borderRadius: 4,
        padding: compact ? '4px 8px' : '8px 10px',
        textAlign: 'left', boxSizing: 'border-box',
        cursor: onDragStart ? 'grab' : 'pointer',
        touchAction: onDragStart ? 'none' : 'auto',
        fontFamily: 'var(--font-body)', color: p.text,
        boxShadow: selected ? '0 0 0 3px rgba(232, 255, 71, 0.35)' : 'none',
        transition: 'box-shadow 120ms ease',
        overflow: 'hidden',
        display: 'flex', flexDirection: 'column', gap: compact ? 0 : 3,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 6 }}>
        <span style={{
          fontSize: compact ? 12 : 13, fontWeight: 600, lineHeight: 1.15,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {appt.client}
        </span>
        <span style={{ fontSize: 10, opacity: 0.75, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
          {fmtTime(appt.start)}–{fmtTime(appt.end)}
        </span>
      </div>

      {!compact && (
        <div style={{
          fontSize: 12, lineHeight: 1.3, opacity: 0.8,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {appt.service}
        </div>
      )}

      {!compact && height > 80 && (
        <div style={{
          marginTop: 'auto',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <StatusBadge status={appt.status} />
            {appt.source === 'whatsapp' && (
              <span title="Booked via WhatsApp" style={{ lineHeight: 0, opacity: 0.75 }}>
                <Icon name="whatsapp" size={12} color="#25D366" stroke={0} fill="#25D366" />
              </span>
            )}
          </div>
          <span style={{ fontSize: 11, fontWeight: 500, opacity: 0.85, fontVariantNumeric: 'tabular-nums' }}>
            {fmtPKR(appt.price)}
          </span>
        </div>
      )}
    </button>
  );
}
