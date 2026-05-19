'use client';

import { useState } from 'react';
import { Icon } from './primitives';
import type { NavId } from './data';

interface SidebarProps {
  active: NavId;
  onNavigate: (id: NavId) => void;
  requestsCount?: number;
}

const NAV_SECTIONS = [
  {
    label: 'Bookings',
    items: [
      { id: 'calendar' as NavId, label: 'Calendar', icon: 'calendar' as const },
      { id: 'requests' as NavId, label: 'Requests', icon: 'inbox' as const, badge: true },
      { id: 'waitlist' as NavId, label: 'Waitlist', icon: 'users' as const, locked: true },
    ],
  },
  {
    label: 'Clients',
    items: [
      { id: 'clients'  as NavId, label: 'Clients',  icon: 'user' as const },
      { id: 'messages' as NavId, label: 'Messages', icon: 'message' as const, locked: true },
    ],
  },
  {
    label: 'Sales',
    items: [
      { id: 'inventory' as NavId, label: 'Inventory', icon: 'package' as const, locked: true },
    ],
  },
  {
    label: 'Grow',
    items: [
      { id: 'marketing' as NavId, label: 'Marketing', icon: 'sparkles' as const, locked: true },
      { id: 'reports'   as NavId, label: 'Reports',   icon: 'chart' as const,    locked: true },
    ],
  },
] as const;

interface NavItemProps {
  id: NavId;
  label: string;
  icon: Parameters<typeof Icon>[0]['name'];
  badge?: number | null;
  locked?: boolean;
  active: boolean;
  onClick: () => void;
}

function NavItem({ id: _id, label, icon, badge, locked, active, onClick }: NavItemProps) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '8px 12px',
        background: active
          ? 'rgba(232, 255, 71, 0.14)'
          : hover ? 'rgba(255,255,255,0.04)' : 'transparent',
        color: active ? 'var(--baari-lime)' : 'rgba(255,255,255,0.75)',
        border: 0, borderRadius: 6, cursor: 'pointer',
        textAlign: 'left', fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 500,
        transition: 'background 120ms ease, color 120ms ease',
        opacity: locked ? 0.6 : 1, width: '100%',
      }}
    >
      <Icon name={icon} size={17} stroke={1.6} />
      <span style={{ flex: 1 }}>{label}</span>
      {badge ? (
        <span style={{
          background: 'var(--baari-lime)', color: 'var(--baari-onyx)',
          fontSize: 10, fontWeight: 600, padding: '1px 6px',
          borderRadius: 999, minWidth: 18, textAlign: 'center',
        }}>{badge}</span>
      ) : null}
      {locked && <Icon name="lock" size={12} color="rgba(255,255,255,0.4)" stroke={1.6} />}
    </button>
  );
}

export function Sidebar({ active, onNavigate, requestsCount = 0 }: SidebarProps) {
  const [settingsHover, setSettingsHover] = useState(false);
  const [billieHover, setBillieHover] = useState(false);

  return (
    <aside style={{
      width: 224, flexShrink: 0,
      background: 'var(--baari-onyx)',
      color: 'rgba(255,255,255,0.8)',
      borderRight: '1px solid #1b1815',
      display: 'flex', flexDirection: 'column',
      fontFamily: 'var(--font-body)',
    }}>
      {/* Brand */}
      <div style={{ padding: '22px 22px 24px', display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/logo-lime.svg" alt="Baari" style={{ height: 28 }} />
      </div>

      {/* Location switcher — locked for single-location MVP */}
      <div style={{
        margin: '0 14px 18px',
        padding: '10px 12px',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 6, color: '#fff',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{
          width: 26, height: 26, borderRadius: 4, background: 'var(--baari-lime)',
          color: 'var(--baari-onyx)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 600, fontSize: 14,
          flexShrink: 0,
        }}>S</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Saloni Studio
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>Lahore · DHA Phase 5</div>
        </div>
        <Icon name="lock" size={12} color="rgba(255,255,255,0.35)" stroke={1.6} />
      </div>

      {/* Nav sections */}
      <nav style={{ flex: 1, padding: '0 8px', display: 'flex', flexDirection: 'column', gap: 18, overflow: 'auto' }}>
        {NAV_SECTIONS.map(sec => (
          <div key={sec.label}>
            <div style={{
              fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.16em',
              color: 'rgba(255,255,255,0.35)', fontWeight: 500,
              padding: '4px 12px 8px',
            }}>{sec.label}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {sec.items.map(item => (
                <NavItem
                  key={item.id}
                  id={item.id}
                  label={item.label}
                  icon={item.icon}
                  badge={'badge' in item && item.badge && requestsCount > 0 ? requestsCount : null}
                  locked={'locked' in item ? item.locked : false}
                  active={item.id === active}
                  onClick={() => onNavigate(item.id)}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom — Billie (locked) + Settings */}
      <div style={{
        padding: '12px 8px 16px',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', flexDirection: 'column', gap: 2,
      }}>
        <button
          onClick={() => onNavigate('billie')}
          onMouseEnter={() => setBillieHover(true)}
          onMouseLeave={() => setBillieHover(false)}
          style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px',
            background: billieHover ? 'rgba(255,255,255,0.04)' : 'transparent',
            color: 'rgba(255,255,255,0.55)',
            border: 0, borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13,
            textAlign: 'left', width: '100%',
            transition: 'background 120ms ease',
          }}
        >
          <Icon name="sparkles" size={17} stroke={1.6} color="var(--baari-lime)" />
          <span style={{ flex: 1 }}>Ask Billie</span>
          <Icon name="lock" size={12} color="rgba(255,255,255,0.4)" stroke={1.6} />
        </button>
        <button
          onClick={() => onNavigate('settings')}
          onMouseEnter={() => setSettingsHover(true)}
          onMouseLeave={() => setSettingsHover(false)}
          style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px',
            background: active === 'settings'
              ? 'rgba(255,255,255,0.08)'
              : settingsHover ? 'rgba(255,255,255,0.04)' : 'transparent',
            color: active === 'settings' ? '#fff' : 'rgba(255,255,255,0.6)',
            border: 0, borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13,
            textAlign: 'left', width: '100%',
            transition: 'background 120ms ease',
          }}
        >
          <Icon name="settings" size={17} stroke={1.6} />
          <span>Settings</span>
        </button>
      </div>
    </aside>
  );
}
