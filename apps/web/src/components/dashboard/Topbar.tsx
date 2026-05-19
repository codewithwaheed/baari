'use client';

import { Icon, IconButton, DButton, Avatar } from './primitives';

interface TopbarProps {
  title: string;
  date?: Date;
  onDateChange?: (d: Date) => void;
  onNew?: () => void;
  showDate?: boolean;
  showSearch?: boolean;
}

const FMT_DAY  = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
const FMT_FULL = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

function stepDate(date: Date, delta: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + delta);
  return d;
}

export function Topbar({ title, date, onDateChange, onNew, showDate = false, showSearch = true }: TopbarProps) {
  const isToday = date ? new Date().toDateString() === date.toDateString() : false;

  return (
    <header style={{
      height: 64, flexShrink: 0,
      background: '#fff',
      borderBottom: '1px solid var(--border)',
      display: 'flex', alignItems: 'center',
      padding: '0 24px', gap: 20,
      fontFamily: 'var(--font-body)',
    }}>
      <h1 style={{
        fontFamily: 'var(--font-display)',
        fontSize: 28, fontWeight: 400, margin: 0,
        color: 'var(--baari-onyx)', letterSpacing: '-0.01em',
      }}>{title}</h1>

      {showDate && date && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 8 }}>
          <IconButton name="chevLeft" size={32} onClick={() => onDateChange?.(stepDate(date, -1))} />
          <button
            onClick={() => onDateChange?.(new Date())}
            style={{
              padding: '6px 14px', background: 'transparent',
              border: '1px solid var(--border)', borderRadius: 6,
              fontFamily: 'inherit', fontSize: 13, fontWeight: 500,
              cursor: 'pointer', color: 'var(--baari-onyx)',
            }}
          >Today</button>
          <IconButton name="chevRight" size={32} onClick={() => onDateChange?.(stepDate(date, 1))} />
          <div style={{ marginLeft: 12, display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
            <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--baari-onyx)' }}>
              {isToday ? 'Today' : FMT_DAY.format(date)}
            </span>
            <span style={{ fontSize: 11, color: 'var(--fg-muted)' }}>{FMT_FULL.format(date)}</span>
          </div>
        </div>
      )}

      <div style={{ flex: 1 }} />

      {showSearch && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'var(--baari-bone)', borderRadius: 6,
          padding: '8px 12px', width: 280,
        }}>
          <Icon name="search" size={15} color="var(--fg-muted)" />
          <input
            placeholder="Search clients, services…"
            style={{
              flex: 1, border: 0, background: 'transparent', outline: 'none',
              fontFamily: 'inherit', fontSize: 13, color: 'var(--baari-onyx)',
            }}
          />
          <span style={{
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            fontSize: 10, padding: '2px 5px', borderRadius: 3,
            background: '#fff', border: '1px solid var(--border)', color: 'var(--fg-muted)',
          }}>⌘K</span>
        </div>
      )}

      <IconButton name="bell" size={36} title="Notifications" />

      {showDate && (
        <DButton variant="primary" leadingIcon="plus" onClick={onNew}>New booking</DButton>
      )}

      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        paddingLeft: 8, borderLeft: '1px solid var(--border)',
      }}>
        <Avatar name="Sana Aslam" size={32} color="#4F6E89" />
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--baari-onyx)' }}>Sana A.</span>
          <span style={{ fontSize: 11, color: 'var(--fg-muted)' }}>Owner</span>
        </div>
      </div>
    </header>
  );
}
