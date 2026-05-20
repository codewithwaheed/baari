'use client';

import { useState } from 'react';
import { Icon, Avatar } from './primitives';
import type { NavId } from './data';

interface SidebarProps {
  active: NavId;
  onNavigate: (id: NavId) => void;
  onLogout: () => void;
  requestsCount?: number;
  userName?: string;
  userRole?: string;
  tenantName?: string;
  tenantCity?: string;
}

const MAIN_NAV: { id: NavId; label: string; icon: Parameters<typeof Icon>[0]['name'] }[] = [
  { id: 'calendar', label: 'Calendar',  icon: 'calendar' },
  { id: 'requests', label: 'Requests',  icon: 'inbox'    },
  { id: 'clients',  label: 'Clients',   icon: 'user'     },
  { id: 'pos',      label: 'POS',       icon: 'pos'      },
  { id: 'settings', label: 'Settings',  icon: 'settings' },
];

const LOCKED_NAV: { id: NavId; label: string; icon: Parameters<typeof Icon>[0]['name'] }[] = [
  { id: 'inventory', label: 'Inventory', icon: 'package'  },
  { id: 'marketing', label: 'Marketing', icon: 'sparkles' },
  { id: 'reports',   label: 'Reports',   icon: 'chart'    },
  { id: 'billie',    label: 'Ask Billie',icon: 'sparkles' },
];

interface NavItemProps {
  id: NavId;
  label: string;
  icon: Parameters<typeof Icon>[0]['name'];
  badge?: number | null;
  locked?: boolean;
  active: boolean;
  onClick: () => void;
}

function NavItem({ label, icon, badge, locked, active, onClick }: NavItemProps) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '9px 12px',
        background: active
          ? 'rgba(232,255,71,0.14)'
          : hover ? 'rgba(255,255,255,0.04)' : 'transparent',
        color: active ? 'var(--baari-lime)' : locked ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.75)',
        border: 0, borderRadius: 6, cursor: 'pointer',
        textAlign: 'left', fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 500,
        transition: 'background 120ms ease, color 120ms ease',
        width: '100%',
      }}
    >
      <Icon name={icon} size={17} stroke={1.6} />
      <span style={{ flex: 1 }}>{label}</span>
      {badge ? (
        <span style={{
          background: 'var(--baari-lime)', color: 'var(--baari-onyx)',
          fontSize: 10, fontWeight: 700, padding: '1px 6px',
          borderRadius: 999, minWidth: 18, textAlign: 'center',
        }}>{badge}</span>
      ) : null}
      {locked && <Icon name="lock" size={12} color="rgba(255,255,255,0.3)" stroke={1.6} />}
    </button>
  );
}

export function Sidebar({
  active, onNavigate, onLogout,
  requestsCount = 0,
  userName = 'Owner',
  userRole = 'owner',
  tenantName = 'My Salon',
  tenantCity,
}: SidebarProps) {
  const [logoutHover, setLogoutHover] = useState(false);
  const initials = tenantName.slice(0, 1).toUpperCase();

  return (
    <aside
      className="dashboard-sidebar"
      style={{
        width: 220, flexShrink: 0,
        background: 'var(--baari-onyx)',
        borderRight: '1px solid #1a1815',
        display: 'flex', flexDirection: 'column',
        fontFamily: 'var(--font-body)',
      }}
    >
      {/* Brand */}
      <div style={{ padding: '20px 20px 18px', display: 'flex', alignItems: 'center' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/logo-lime.svg" alt="Baari" style={{ height: 26 }} />
      </div>

      {/* Salon identity chip */}
      <div style={{
        margin: '0 12px 16px',
        padding: '10px 12px',
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 6,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 4, background: 'var(--baari-lime)',
          color: 'var(--baari-onyx)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 700, fontSize: 14,
          flexShrink: 0,
        }}>{initials}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {tenantName}
          </div>
          {tenantCity && (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{tenantCity}</div>
          )}
        </div>
      </div>

      {/* Main nav */}
      <nav style={{ flex: 1, padding: '0 8px', display: 'flex', flexDirection: 'column', gap: 2, overflow: 'auto' }}>
        {MAIN_NAV.map(item => (
          <NavItem
            key={item.id}
            id={item.id}
            label={item.label}
            icon={item.icon}
            badge={item.id === 'requests' && requestsCount > 0 ? requestsCount : null}
            active={item.id === active}
            onClick={() => onNavigate(item.id)}
          />
        ))}

        {/* Divider */}
        <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '8px 4px' }} />

        {/* Locked items */}
        {LOCKED_NAV.map(item => (
          <NavItem
            key={item.id}
            id={item.id}
            label={item.label}
            icon={item.icon}
            locked
            active={item.id === active}
            onClick={() => onNavigate(item.id)}
          />
        ))}
      </nav>

      {/* User row + logout */}
      <div style={{
        padding: '12px 12px 16px',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', flexDirection: 'column', gap: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px' }}>
          <Avatar name={userName} size={30} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {userName}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'capitalize' }}>
              {userRole}
            </div>
          </div>
          <button
            onClick={onLogout}
            onMouseEnter={() => setLogoutHover(true)}
            onMouseLeave={() => setLogoutHover(false)}
            title="Sign out"
            style={{
              background: logoutHover ? 'rgba(220,50,50,0.15)' : 'transparent',
              border: 0, borderRadius: 6, padding: 6, cursor: 'pointer',
              color: logoutHover ? '#f87171' : 'rgba(255,255,255,0.3)',
              transition: 'all 120ms ease',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Icon name="logout" size={16} stroke={1.6} />
          </button>
        </div>
      </div>
    </aside>
  );
}
