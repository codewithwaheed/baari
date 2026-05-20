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

const FMT_COMPACT = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const FMT_FULL    = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

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
      padding: '0 12px 0 16px', gap: 8,
      fontFamily: 'var(--font-body)',
    }}>
      <h1
        className="topbar-title"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 22, fontWeight: 400, margin: 0,
          color: 'var(--baari-onyx)', letterSpacing: '-0.01em',
          flexShrink: 0,
        }}
      >{title}</h1>

      {showDate && date && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginLeft: 4 }}>
          <IconButton name="chevLeft" size={28} onClick={() => onDateChange?.(stepDate(date, -1))} />
          <button
            onClick={() => onDateChange?.(new Date())}
            style={{
              padding: '4px 10px', background: 'transparent',
              border: '1px solid var(--border)', borderRadius: 6,
              fontFamily: 'inherit', fontSize: 12, fontWeight: 500,
              cursor: 'pointer', color: 'var(--baari-onyx)',
              whiteSpace: 'nowrap',
            }}
          >{isToday ? 'Today' : 'Go to today'}</button>
          <IconButton name="chevRight" size={28} onClick={() => onDateChange?.(stepDate(date, 1))} />
          <div className="topbar-date-label" style={{
            marginLeft: 6, display: 'flex', flexDirection: 'column', lineHeight: 1.2,
          }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--baari-onyx)' }}>
              {isToday ? 'Today' : FMT_COMPACT.format(date)}
            </span>
            <span style={{ fontSize: 10, color: 'var(--fg-muted)' }}>{FMT_FULL.format(date)}</span>
          </div>
        </div>
      )}

      <div style={{ flex: 1 }} />

      {showSearch && (
        <div className="topbar-search" style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'var(--baari-bone)', borderRadius: 6,
          padding: '6px 12px', width: 220,
        }}>
          <Icon name="search" size={13} color="var(--fg-muted)" />
          <input
            placeholder="Search clients, services…"
            style={{
              flex: 1, border: 0, background: 'transparent', outline: 'none',
              fontFamily: 'inherit', fontSize: 13, color: 'var(--baari-onyx)',
            }}
          />
        </div>
      )}

      {showDate && (
        <div className="topbar-new-btn">
          <DButton variant="primary" leadingIcon="plus" onClick={onNew}>New booking</DButton>
        </div>
      )}

      {/* Desktop user identity */}
      <div className="topbar-user-name" style={{
        display: 'flex', alignItems: 'center', gap: 8,
        paddingLeft: 10, borderLeft: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <Avatar name={userName} size={28} />
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--baari-onyx)', whiteSpace: 'nowrap' }}>
            {userName.split(' ')[0]}
          </span>
          <span style={{ fontSize: 10, color: 'var(--fg-muted)', textTransform: 'capitalize', whiteSpace: 'nowrap' }}>
            {userRole}
          </span>
        </div>
      </div>

      {/* Mobile user avatar — compact, no name */}
      <div className="topbar-avatar-sm" style={{
        alignItems: 'center', flexShrink: 0,
      }}>
        <Avatar name={userName} size={28} />
      </div>
    </header>
  );
}
