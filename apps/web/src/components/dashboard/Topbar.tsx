'use client';

import { useState, useRef, useEffect } from 'react';
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

// ─── Mini calendar popover ────────────────────────────────────────────────────

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTH_FMT = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function daysInMonth(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

interface DatePickerProps {
  selected: Date;
  onSelect: (d: Date) => void;
  onClose: () => void;
}

function DatePickerPopover({ selected, onSelect, onClose }: DatePickerProps) {
  const [viewMonth, setViewMonth] = useState(() => new Date(selected.getFullYear(), selected.getMonth(), 1));
  const today = new Date();
  const ref = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const firstDayOfWeek = startOfMonth(viewMonth).getDay(); // 0=Sun
  const totalDays = daysInMonth(viewMonth);

  const cells: Array<Date | null> = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) {
    cells.push(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d));
  }
  // Pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null);

  const prevMonth = () => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1));
  const nextMonth = () => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1));

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute', top: 'calc(100% + 8px)', left: 0,
        zIndex: 200,
        background: '#fff',
        border: '1px solid var(--border)',
        borderRadius: 10,
        boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
        padding: '14px 16px',
        width: 248,
        fontFamily: 'var(--font-body)',
      }}
    >
      {/* Month navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <button onClick={prevMonth} style={navBtnStyle}>
          <Icon name="chevLeft" size={14} color="var(--baari-graphite)" />
        </button>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--baari-onyx)' }}>
          {MONTH_FMT.format(viewMonth)}
        </span>
        <button onClick={nextMonth} style={navBtnStyle}>
          <Icon name="chevRight" size={14} color="var(--baari-graphite)" />
        </button>
      </div>

      {/* Weekday headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0, marginBottom: 4 }}>
        {WEEKDAYS.map(d => (
          <div key={d} style={{
            textAlign: 'center', fontSize: 10, fontWeight: 600,
            color: 'var(--fg-muted)', letterSpacing: '0.05em',
            paddingBottom: 6,
          }}>
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const isSelected = isSameDay(d, selected);
          const isToday    = isSameDay(d, today);
          return (
            <button
              key={i}
              onClick={() => { onSelect(d); onClose(); }}
              style={{
                width: '100%', aspectRatio: '1',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: isSelected || isToday ? 600 : 400,
                background: isSelected ? 'var(--baari-onyx)' : 'transparent',
                color: isSelected ? 'var(--baari-lime)' : isToday ? 'var(--baari-onyx)' : 'var(--baari-graphite)',
                border: isToday && !isSelected ? '1px solid var(--border)' : '1px solid transparent',
                cursor: 'pointer',
                position: 'relative',
              }}
            >
              {d.getDate()}
              {/* Lime dot for today */}
              {isToday && !isSelected && (
                <span style={{
                  position: 'absolute', bottom: 2, left: '50%', transform: 'translateX(-50%)',
                  width: 4, height: 4, borderRadius: '50%', background: 'var(--baari-lime)',
                }} />
              )}
            </button>
          );
        })}
      </div>

      {/* Quick jump */}
      <div style={{ borderTop: '1px solid var(--border-subtle)', marginTop: 10, paddingTop: 10 }}>
        <button
          onClick={() => { onSelect(today); onClose(); }}
          style={{
            width: '100%', padding: '7px 0',
            background: 'var(--baari-cream)', border: '1px solid var(--border-subtle)',
            borderRadius: 6, fontSize: 12, fontWeight: 500,
            color: 'var(--baari-onyx)', cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Today — {FMT_COMPACT.format(today)}
        </button>
      </div>
    </div>
  );
}

const navBtnStyle: React.CSSProperties = {
  width: 26, height: 26, borderRadius: 6,
  border: '1px solid var(--border-subtle)', background: 'transparent',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer',
};

// ─── Topbar ───────────────────────────────────────────────────────────────────

export function Topbar({
  title, date, onDateChange, onNew,
  showDate = false, showSearch = true,
  userName = 'Owner', userRole = 'owner',
}: TopbarProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const dateNavRef = useRef<HTMLDivElement>(null);
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
        <div ref={dateNavRef} style={{ display: 'flex', alignItems: 'center', gap: 2, marginLeft: 4, position: 'relative' }}>
          <IconButton name="chevLeft" size={28} onClick={() => onDateChange?.(stepDate(date, -1))} />

          {/* Today button — hidden on mobile (picker has its own jump) */}
          <button
            className="topbar-today-btn"
            onClick={() => { onDateChange?.(new Date()); setPickerOpen(false); }}
            style={{
              padding: '4px 10px', background: 'transparent',
              border: '1px solid var(--border)', borderRadius: 6,
              fontFamily: 'inherit', fontSize: 12, fontWeight: 500,
              cursor: 'pointer', color: 'var(--baari-onyx)',
              whiteSpace: 'nowrap',
            }}
          >{isToday ? 'Today' : 'Go to today'}</button>

          {/* Clickable date label → opens picker */}
          <button
            className="topbar-date-label"
            onClick={() => setPickerOpen(p => !p)}
            style={{
              background: pickerOpen ? 'var(--baari-bone)' : 'transparent',
              border: '1px solid ' + (pickerOpen ? 'var(--border)' : 'transparent'),
              borderRadius: 6,
              padding: '4px 8px',
              cursor: 'pointer',
              textAlign: 'left',
              lineHeight: 1.2,
              display: 'flex', flexDirection: 'column',
              transition: 'background 120ms ease',
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--baari-onyx)' }}>
              {isToday ? 'Today' : FMT_COMPACT.format(date)}
            </span>
            <span style={{ fontSize: 10, color: 'var(--fg-muted)' }}>{FMT_FULL.format(date)}</span>
          </button>

          <IconButton name="chevRight" size={28} onClick={() => onDateChange?.(stepDate(date, 1))} />

          {/* Date picker popover */}
          {pickerOpen && (
            <DatePickerPopover
              selected={date}
              onSelect={(d) => { onDateChange?.(d); }}
              onClose={() => setPickerOpen(false)}
            />
          )}
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
