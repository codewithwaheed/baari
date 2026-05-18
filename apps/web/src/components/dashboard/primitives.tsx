// src/components/dashboard/primitives.tsx
// Baari — shared UI primitives.
// Ported from the Claude Design prototype. Use these exclusively.
// Never invent new colors or status styles outside this file.

'use client';

import React, { useState, useEffect } from 'react';

// ─── Formatters ───────────────────────────────────────────────────────────────

/** PKR 4,500 — always prefix PKR, toLocaleString for thousands separator */
export function fmtPKR(paisa: number): string {
  return `PKR ${(paisa / 100).toLocaleString()}`;
}

/** fmtPKRRaw — when you already have the PKR amount (not paisa) */
export function fmtPKRRaw(pkr: number): string {
  return `PKR ${pkr.toLocaleString()}`;
}

/** 12-hour time from decimal hour: 10 → "10am", 13.75 → "1:45pm" */
export function fmtTime(h: number): string {
  const period = h >= 12 ? 'pm' : 'am';
  const hr = Math.floor(h);
  const m = Math.round((h - hr) * 60);
  const display = hr > 12 ? hr - 12 : hr === 0 ? 12 : hr;
  return m ? `${display}:${String(m).padStart(2, '0')}${period}` : `${display}${period}`;
}

export function fmtTimeRange(start: number, end: number): string {
  return `${fmtTime(start)} – ${fmtTime(end)}`;
}

// ─── Booking status ───────────────────────────────────────────────────────────

export type BookingStatus = 'confirmed' | 'checkedIn' | 'pendingPayment' | 'completed' | 'noShow';

export const STATUS_STYLES: Record<BookingStatus, { bg: string; fg: string; dot: string; label: string }> = {
  confirmed:      { bg: '#E8F0EA', fg: '#3A5F46', dot: '#4E7C58', label: 'Confirmed' },
  checkedIn:      { bg: '#DFEDED', fg: '#28615F', dot: '#3F8A8A', label: 'Checked In' },
  pendingPayment: { bg: '#FAEFE1', fg: '#8A6B3A', dot: '#C8923C', label: 'Pending Payment' },
  completed:      { bg: '#ECE9E2', fg: '#4A443B', dot: '#8A8275', label: 'Completed' },
  noShow:         { bg: '#F5E2DF', fg: '#8A3528', dot: '#B5483A', label: 'No Show' },
};

// ─── Icon ─────────────────────────────────────────────────────────────────────

type IconName =
  | 'calendar' | 'user' | 'users' | 'card' | 'chart' | 'message'
  | 'chevDown' | 'chevLeft' | 'chevRight' | 'arrowLeft'
  | 'plus' | 'search' | 'bell' | 'settings' | 'close' | 'check'
  | 'sparkles' | 'inbox' | 'package' | 'scissors' | 'moreH'
  | 'clock' | 'phone' | 'edit' | 'star' | 'lock' | 'whatsapp'
  | 'qr' | 'cash' | 'wallet' | 'home' | 'approve' | 'decline';

const PATHS: Record<IconName, React.ReactNode> = {
  calendar:  <><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>,
  user:      <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>,
  users:     <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>,
  card:      <><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></>,
  chart:     <><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></>,
  message:   <><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></>,
  chevDown:  <><polyline points="6 9 12 15 18 9"/></>,
  chevLeft:  <><polyline points="15 18 9 12 15 6"/></>,
  chevRight: <><polyline points="9 18 15 12 9 6"/></>,
  arrowLeft: <><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></>,
  plus:      <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>,
  search:    <><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></>,
  bell:      <><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></>,
  settings:  <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></>,
  close:     <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>,
  check:     <><polyline points="20 6 9 17 4 12"/></>,
  sparkles:  <><path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z"/><path d="M19 14l.7 2.1L22 17l-2.3.9L19 20l-.7-2.1L16 17l2.3-.9z"/></>,
  inbox:     <><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></>,
  package:   <><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></>,
  scissors:  <><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></>,
  moreH:     <><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></>,
  clock:     <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>,
  phone:     <><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></>,
  edit:      <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></>,
  star:      <><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></>,
  lock:      <><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></>,
  whatsapp:  <><path d="M20.5 3.5A11 11 0 0 0 4.6 18.3L3 22l3.8-1.6A11 11 0 1 0 20.5 3.5z"/><path d="M16.5 14.4c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.7.1l-.9 1.1c-.2.2-.3.2-.6.1a8 8 0 0 1-2.4-1.5 9 9 0 0 1-1.7-2c-.2-.3 0-.4.1-.6l.4-.5c.1-.1.2-.3.3-.5 0-.2 0-.4 0-.5l-.9-2c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3a3 3 0 0 0-1 2.3c0 1.4 1 2.7 1.1 2.9.2.2 2 3.2 5 4.5.7.3 1.2.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.7-.7 2-1.4.2-.6.2-1.2.2-1.3 0-.1-.3-.2-.5-.3z"/></>,
  qr:        <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3z"/><path d="M19 14h2v2h-2z"/><path d="M14 19h2v2h-2z"/><path d="M19 19h2v2h-2z"/></>,
  cash:      <><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/></>,
  wallet:    <><path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6H7a2 2 0 0 1 0-4h14V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2z"/><circle cx="17" cy="13" r="1"/></>,
  home:      <><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></>,
  approve:   <><circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 15 10"/></>,
  decline:   <><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></>,
};

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  stroke?: number;
}

export function Icon({ name, size = 20, color = 'currentColor', stroke = 1.5 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      {PATHS[name] || null}
    </svg>
  );
}

// ─── DButton ──────────────────────────────────────────────────────────────────

type ButtonVariant = 'primary' | 'lime' | 'ghost' | 'danger' | 'quiet';
type ButtonSize = 'sm' | 'md' | 'lg';

interface DButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leadingIcon?: IconName;
}

export function DButton({ variant = 'primary', size = 'md', children, leadingIcon, style, ...rest }: DButtonProps) {
  const [hover, setHover] = useState(false);
  const sizes = {
    sm: { padding: '6px 12px', fontSize: 13 },
    md: { padding: '10px 16px', fontSize: 14 },
    lg: { padding: '13px 20px', fontSize: 15 },
  };
  const base = {
    primary: { background: 'var(--baari-onyx)', color: '#fff', borderColor: 'var(--baari-onyx)' },
    lime:    { background: 'var(--baari-lime)', color: 'var(--baari-onyx)', borderColor: 'var(--baari-lime)' },
    ghost:   { background: 'transparent', color: 'var(--baari-onyx)', borderColor: 'var(--border)' },
    danger:  { background: 'transparent', color: 'var(--baari-error)', borderColor: 'var(--border)' },
    quiet:   { background: 'transparent', color: 'var(--fg-secondary)', borderColor: 'transparent' },
  };
  const hoverStyle = hover ? {
    primary: { background: '#1B1815' },
    lime:    { background: 'var(--baari-lime-deep)', borderColor: 'var(--baari-lime-deep)' },
    ghost:   { borderColor: 'var(--baari-onyx)' },
    danger:  { borderColor: 'var(--baari-error)', background: 'rgba(181,72,58,0.06)' },
    quiet:   { color: 'var(--baari-onyx)' },
  }[variant] : {};
  return (
    <button
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        fontFamily: 'var(--font-body)', fontWeight: 500,
        borderRadius: 6, border: '1px solid', cursor: rest.disabled ? 'not-allowed' : 'pointer',
        lineHeight: 1, display: 'inline-flex', alignItems: 'center', gap: 8,
        transition: 'all 150ms ease', opacity: rest.disabled ? 0.55 : 1,
        ...sizes[size], ...base[variant], ...hoverStyle, ...style,
      }}
      {...rest}
    >
      {leadingIcon && <Icon name={leadingIcon} size={15} stroke={1.75} />}
      {children}
    </button>
  );
}

// ─── StatusBadge ──────────────────────────────────────────────────────────────

export function StatusBadge({ status, withDot = false }: { status: BookingStatus; withDot?: boolean }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.confirmed;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '4px 10px', borderRadius: 999,
      background: s.bg, color: s.fg,
      fontSize: 11, fontWeight: 500, lineHeight: 1.4,
      fontFamily: 'var(--font-body)', letterSpacing: '0.02em', whiteSpace: 'nowrap',
    }}>
      {withDot && <span style={{ width: 6, height: 6, borderRadius: 999, background: s.dot }} />}
      {s.label}
    </span>
  );
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

const AVATAR_COLORS = ['#322B20', '#4A443B', '#8A6B3A', '#4F6E89', '#4E7C58', '#3F8A8A'];

export function Avatar({ name, size = 36, color }: { name: string; size?: number; color?: string }) {
  const initials = (name || '?').split(' ').slice(0, 2).map(n => n[0] || '').join('').toUpperCase();
  const seed = (name || '').split('').reduce((s, c) => s + c.charCodeAt(0), 0);
  const bg = color || AVATAR_COLORS[seed % AVATAR_COLORS.length];
  return (
    <div style={{
      width: size, height: size, borderRadius: 999, background: bg,
      color: 'var(--baari-lime-soft)', display: 'inline-flex',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: size * 0.36,
      letterSpacing: '0.02em', flexShrink: 0,
    }}>{initials}</div>
  );
}

// ─── IconButton ───────────────────────────────────────────────────────────────

export function IconButton({ name, onClick, active = false, size = 36, title, color }: {
  name: IconName; onClick?: () => void; active?: boolean; size?: number; title?: string; color?: string;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      onClick={onClick} title={title}
      style={{
        width: size, height: size, borderRadius: 6,
        background: active || hover ? 'var(--baari-bone)' : 'transparent',
        border: 0, cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        color: color || (active ? 'var(--baari-onyx)' : 'var(--baari-graphite)'),
        transition: 'background 120ms ease, color 120ms ease',
      }}>
      <Icon name={name} size={size * 0.5} stroke={1.6} />
    </button>
  );
}

// ─── Eyebrow ──────────────────────────────────────────────────────────────────

export function Eyebrow({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      fontSize: 11, color: 'var(--fg-muted)',
      textTransform: 'uppercase', letterSpacing: '0.14em',
      fontWeight: 500, ...style,
    }}>{children}</div>
  );
}

// ─── Pill ─────────────────────────────────────────────────────────────────────

type PillTone = 'neutral' | 'success' | 'warning' | 'vip' | 'whatsapp';

export function Pill({ tone = 'neutral', children }: { tone?: PillTone; children: React.ReactNode }) {
  const tones: Record<PillTone, { bg: string; fg: string }> = {
    neutral:  { bg: 'var(--baari-bone)', fg: 'var(--baari-graphite)' },
    success:  { bg: '#E8F0EA', fg: '#3A5F46' },
    warning:  { bg: '#FAEFE1', fg: '#8A6B3A' },
    vip:      { bg: 'var(--baari-onyx)', fg: 'var(--baari-lime)' },
    whatsapp: { bg: '#DFF3E4', fg: '#1B6E3F' },
  };
  const t = tones[tone];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 9px', borderRadius: 999,
      background: t.bg, color: t.fg,
      fontSize: 11, fontWeight: 500, letterSpacing: '0.02em', whiteSpace: 'nowrap',
    }}>{children}</span>
  );
}
