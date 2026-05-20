'use client';

import { Avatar } from './primitives';
import type { Staff } from './data';

interface StaffPillRowProps {
  staff: Staff[];
  activeId: string;
  onChange: (id: string) => void;
}

export function StaffPillRow({ staff, activeId, onChange }: StaffPillRowProps) {
  return (
    <div className="staff-pill-row" role="tablist" aria-label="Select staff member">
      {staff.map(s => {
        const isActive = s.id === activeId;
        return (
          <button
            key={s.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(s.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '6px 12px 6px 8px',
              borderRadius: 999,
              border: isActive ? '1.5px solid var(--baari-onyx)' : '1.5px solid var(--border)',
              background: isActive ? 'var(--baari-onyx)' : '#fff',
              color: isActive ? 'var(--baari-lime)' : 'var(--baari-graphite)',
              fontFamily: 'var(--font-body)',
              fontSize: 13,
              fontWeight: isActive ? 600 : 400,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              transition: 'all 140ms ease',
            }}
          >
            <Avatar name={s.name} size={22} color={s.color} />
            <span>{s.name.split(' ')[0]}</span>
          </button>
        );
      })}
    </div>
  );
}
