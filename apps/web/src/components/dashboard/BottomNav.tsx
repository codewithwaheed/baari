'use client';

import { Icon } from './primitives';
import type { NavId } from './data';

interface BottomNavProps {
  active: NavId;
  onNavigate: (id: NavId) => void;
  onNew: () => void;
  requestsCount?: number;
}

const LEFT_TABS: { id: NavId; label: string; icon: Parameters<typeof Icon>[0]['name'] }[] = [
  { id: 'calendar', label: 'Calendar', icon: 'calendar' },
  { id: 'requests', label: 'Requests', icon: 'inbox'    },
];

const RIGHT_TABS: { id: NavId; label: string; icon: Parameters<typeof Icon>[0]['name'] }[] = [
  { id: 'clients',  label: 'Clients',  icon: 'user'     },
  { id: 'settings', label: 'Settings', icon: 'settings' },
];

export function BottomNav({ active, onNavigate, onNew, requestsCount = 0 }: BottomNavProps) {
  const renderTab = (tab: typeof LEFT_TABS[0]) => {
    const isActive  = tab.id === active;
    const showBadge = tab.id === 'requests' && requestsCount > 0;
    return (
      <button
        key={tab.id}
        onClick={() => onNavigate(tab.id)}
        style={{
          flex: 1,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 3,
          background: 'transparent', border: 0, cursor: 'pointer',
          color: isActive ? 'var(--baari-lime)' : 'rgba(255,255,255,0.45)',
          fontFamily: 'var(--font-body)', fontSize: 10,
          fontWeight: isActive ? 600 : 400,
          position: 'relative',
          transition: 'color 120ms ease',
          borderTop: isActive ? '2px solid var(--baari-lime)' : '2px solid transparent',
          paddingTop: 2,
        }}
      >
        <Icon name={tab.icon} size={20} stroke={isActive ? 2 : 1.6} />
        <span>{tab.label}</span>
        {showBadge && (
          <span style={{
            position: 'absolute', top: 6, right: 'calc(50% - 16px)',
            background: 'var(--baari-lime)', color: 'var(--baari-onyx)',
            fontSize: 9, fontWeight: 700,
            minWidth: 16, height: 16, borderRadius: 999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 3px',
          }}>
            {requestsCount}
          </span>
        )}
      </button>
    );
  };

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
        paddingBottom: 'env(safe-area-inset-bottom)',
        position: 'relative',
      }}
    >
      {LEFT_TABS.map(renderTab)}

      {/* Raised centre FAB */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: 3, position: 'relative',
      }}>
        <button
          onClick={onNew}
          aria-label="New booking"
          style={{
            width: 48, height: 48,
            borderRadius: 999,
            background: 'var(--baari-lime)',
            border: '3px solid var(--baari-onyx)',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'absolute',
            top: -20,
            boxShadow: '0 4px 16px rgba(232,255,71,0.35)',
            transition: 'transform 120ms ease, box-shadow 120ms ease',
          }}
          onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.93)')}
          onMouseUp={e => (e.currentTarget.style.transform = '')}
          onTouchStart={e => (e.currentTarget.style.transform = 'scale(0.93)')}
          onTouchEnd={e => (e.currentTarget.style.transform = '')}
        >
          <Icon name="plus" size={22} color="var(--baari-onyx)" stroke={2.5} />
        </button>
        <span style={{
          fontSize: 10, color: 'rgba(255,255,255,0.45)',
          fontFamily: 'var(--font-body)', position: 'absolute', bottom: 8,
        }}>New</span>
      </div>

      {RIGHT_TABS.map(renderTab)}
    </nav>
  );
}
