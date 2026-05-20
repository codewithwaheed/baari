'use client';

import { Icon, IconButton, DButton, Avatar } from './primitives';

interface TopbarProps {
  title: string;
  date?: Date;
  onDateChange?: (d: Date) => void;
  onNew?: () => void;
  showDate?: boolean;
  showSearch?: boolean;
  userName?: string;
  userRole?: string;
}

const FMT_DAY  = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
const FMT_FULL = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

function stepDate(date: Date, delta: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + delta);
  return d;
}

export function Topbar({
  title, date, onDateChange, onNew,
  showDate = false, showSearch = true,
  userName = 'Owner', userRole = 'owner',
}: TopbarProps) {
  const isToday = date ? new Date().toDateString() === date.toDateString() : false;

  return (
    <header style={{
      height: 56, flexShrink: 0,
      background: '#fff',
      borderBottom: '1px solid var(--border)',
      display: 'flex', alignItems: 'center',
      padding: '0 16px', gap: 12,
      fontFamily: 'var(--font-body)',
      position: 'relative',
    }}>
      <h1 style={{
        fontFamily: 'var(--font-display)',
        fontSize: 24, fontWeight: 400, margin: 0,
        color: 'var(--baari-onyx)', letterSpacing: '-0.01em',
        flexShrink: 0,
      }}>{title}</h1>

      {showDate && date && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 4 }}>
          <IconButton name="chevLeft" size={30} onClick={() => onDateChange?.(stepDate(date, -1))} />
          <button
            onClick={() => onDateChange?.(new Date())}
            style={{
              padding: '5px 12px', background: 'transparent',
              border: '1px solid var(--border)', borderRadius: 6,
              fontFamily: 'inherit', fontSize: 12, fontWeight: 500,
              cursor: 'pointer', color: 'var(--baari-onyx)',
              whiteSpace: 'nowrap',
            }}
          >Today</button>
          <IconButton name="chevRight" size={30} onClick={() => onDateChange?.(stepDate(date, 1))} />
          <div style={{ marginLeft: 8, display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--baari-onyx)' }}>
              {isToday ? 'Today' : FMT_DAY.format(date)}
            </span>
            <span style={{ fontSize: 11, color: 'var(--fg-muted)' }}>{FMT_FULL.format(date)}</span>
          </div>
        </div>
      )}

      <div style={{ flex: 1 }} />

      {/* Search — hidden on mobile */}
      {showSearch && (
        <div
          className="topbar-search"
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'var(--baari-bone)', borderRadius: 6,
            padding: '7px 12px', width: 240,
          }}
        >
          <Icon name="search" size={14} color="var(--fg-muted)" />
          <input
            placeholder="Search clients, services…"
            style={{
              flex: 1, border: 0, background: 'transparent', outline: 'none',
              fontFamily: 'inherit', fontSize: 13, color: 'var(--baari-onyx)',
            }}
          />
        </div>
      )}

      {/* New booking button — hidden on mobile */}
      {showDate && (
        <div className="topbar-new-btn">
          <DButton variant="primary" leadingIcon="plus" onClick={onNew}>New booking</DButton>
        </div>
      )}

      {/* FAB — shown on mobile only */}
      {showDate && (
        <button
          className="topbar-fab"
          onClick={onNew}
          style={{
            width: 40, height: 40, borderRadius: 999,
            background: 'var(--baari-onyx)',
            color: 'var(--baari-lime)',
            border: 0, cursor: 'pointer',
            alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          }}
        >
          <Icon name="plus" size={20} color="var(--baari-lime)" stroke={2} />
        </button>
      )}

      {/* User identity — right side */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        paddingLeft: 12, borderLeft: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <Avatar name={userName} size={30} />
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--baari-onyx)', whiteSpace: 'nowrap' }}>
            {userName.split(' ')[0]}
          </span>
          <span style={{ fontSize: 10, color: 'var(--fg-muted)', textTransform: 'capitalize', whiteSpace: 'nowrap' }}>
            {userRole}
          </span>
        </div>
      </div>
    </header>
  );
}
