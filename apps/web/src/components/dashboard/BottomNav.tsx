'use client';

import { Icon } from './primitives';
import type { NavId } from './data';

interface BottomNavProps {
  active: NavId;
  onNavigate: (id: NavId) => void;
  requestsCount?: number;
}

const TABS: { id: NavId; label: string; icon: Parameters<typeof Icon>[0]['name'] }[] = [
  { id: 'calendar', label: 'Calendar', icon: 'calendar' },
  { id: 'requests', label: 'Requests', icon: 'inbox'    },
  { id: 'clients',  label: 'Clients',  icon: 'user'     },
  { id: 'pos',      label: 'POS',      icon: 'pos'      },
  { id: 'settings', label: 'Settings', icon: 'settings' },
];

export function BottomNav({ active, onNavigate, requestsCount = 0 }: BottomNavProps) {
  return (
    <nav
      className="dashboard-bottom-nav"
      style={{
        flexShrink: 0,
        height: 64,
        background: 'var(--baari-onyx)',
        borderTop: '1px solid #1a1815',
        alignItems: 'stretch',
        fontFamily: 'var(--font-body)',
        // safe area padding for iPhone home indicator
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {TABS.map(tab => {
        const isActive = tab.id === active;
        const showBadge = tab.id === 'requests' && requestsCount > 0;
        return (
          <button
            key={tab.id}
            onClick={() => onNavigate(tab.id)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              background: 'transparent',
              border: 0,
              cursor: 'pointer',
              color: isActive ? 'var(--baari-lime)' : 'rgba(255,255,255,0.45)',
              fontFamily: 'var(--font-body)',
              fontSize: 10,
              fontWeight: isActive ? 600 : 400,
              position: 'relative',
              transition: 'color 120ms ease',
              // Lime top border indicator for active tab
              borderTop: isActive ? '2px solid var(--baari-lime)' : '2px solid transparent',
            }}
          >
            <Icon name={tab.icon} size={20} stroke={isActive ? 2 : 1.6} />
            <span>{tab.label}</span>
            {showBadge && (
              <span style={{
                position: 'absolute',
                top: 8,
                right: 'calc(50% - 14px)',
                background: 'var(--baari-lime)',
                color: 'var(--baari-onyx)',
                fontSize: 9,
                fontWeight: 700,
                minWidth: 16,
                height: 16,
                borderRadius: 999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 3px',
              }}>
                {requestsCount}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
