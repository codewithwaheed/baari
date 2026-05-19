'use client';

import { Icon, Pill, Eyebrow } from './primitives';
import type { NavId } from './data';

type LockedId = Extract<NavId, 'waitlist' | 'messages' | 'inventory' | 'marketing' | 'reports' | 'billie'>;

const META: Record<LockedId, { title: string; icon: Parameters<typeof Icon>[0]['name']; blurb: string }> = {
  waitlist:  { title: 'Waitlist',  icon: 'users',    blurb: 'Auto-fill cancellations and last-minute openings from a smart standby list.' },
  messages:  { title: 'Messages',  icon: 'message',  blurb: 'One inbox for WhatsApp, SMS, and in-app threads — with templated replies.' },
  inventory: { title: 'Inventory', icon: 'package',  blurb: 'Track retail products, professional stock, and back-bar usage per service.' },
  marketing: { title: 'Marketing', icon: 'sparkles', blurb: 'Win-back campaigns, birthday offers, and loyalty programs over WhatsApp.' },
  reports:   { title: 'Reports',   icon: 'chart',    blurb: 'Daily takings, staff utilisation, retention, and rebooking — at a glance.' },
  billie:    { title: 'Billie AI', icon: 'sparkles', blurb: 'Your front-desk sidekick. Smart replies, no-show predictions, gentle reminders.' },
};

interface ComingSoonProps {
  id: NavId;
}

export function ComingSoon({ id }: ComingSoonProps) {
  const meta = META[id as LockedId] ?? META.waitlist;
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 18,
      background: 'var(--baari-cream)', padding: 48, textAlign: 'center',
      fontFamily: 'var(--font-body)',
    }}>
      <div style={{
        width: 76, height: 76, borderRadius: 999,
        background: 'var(--baari-onyx)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--baari-lime)', position: 'relative',
      }}>
        <Icon name={meta.icon} size={32} stroke={1.4} />
        <span style={{
          position: 'absolute', bottom: -2, right: -2,
          width: 26, height: 26, borderRadius: 999,
          background: 'var(--baari-lime)', color: 'var(--baari-onyx)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '2px solid var(--baari-cream)',
        }}>
          <Icon name="lock" size={11} color="var(--baari-onyx)" stroke={2} />
        </span>
      </div>

      <h2 style={{
        fontFamily: 'var(--font-display)', fontSize: 44, fontWeight: 200,
        letterSpacing: '-0.025em', color: 'var(--baari-onyx)', margin: 0,
        textWrap: 'balance', lineHeight: 1.05,
      } as React.CSSProperties}>
        <strong>{meta.title}</strong> — your <em style={{ color: 'var(--baari-ink)', fontStyle: 'italic' }}>باری</em> is coming.
      </h2>

      <p style={{ fontSize: 15, color: 'var(--fg-secondary)', margin: 0, maxWidth: 460, lineHeight: 1.55 }}>
        {meta.blurb}
      </p>

      <Pill tone="neutral">Coming soon</Pill>
    </div>
  );
}

export function SettingsStub() {
  const SETTINGS_ITEMS = [
    { label: 'Services',       icon: 'scissors'  },
    { label: 'Staff',          icon: 'users'     },
    { label: 'Working hours',  icon: 'clock'     },
    { label: 'Breaks',         icon: 'calendar'  },
    { label: 'WhatsApp setup', icon: 'whatsapp'  },
    { label: 'Business info',  icon: 'home'      },
  ] as const;

  return (
    <div style={{ flex: 1, overflow: 'auto', background: 'var(--baari-cream)', fontFamily: 'var(--font-body)' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 32px 64px' }}>
        <Eyebrow>Settings</Eyebrow>
        <h2 style={{
          fontFamily: 'var(--font-display)', fontSize: 44, fontWeight: 200,
          letterSpacing: '-0.025em', color: 'var(--baari-onyx)', margin: '10px 0 14px', lineHeight: 1.05,
        }}>
          The <strong>back office</strong>.
        </h2>
        <p style={{ fontSize: 16, color: 'var(--fg-secondary)', margin: '0 0 28px', lineHeight: 1.6 }}>
          Services, staff, working hours, breaks, and WhatsApp setup.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          {SETTINGS_ITEMS.map(item => (
            <div key={item.label} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '16px 18px',
              background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 2,
              opacity: 0.7,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 4,
                background: 'var(--baari-bone)', color: 'var(--baari-graphite)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon name={item.icon} size={17} stroke={1.6} />
              </div>
              <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: 'var(--baari-onyx)' }}>{item.label}</span>
              <Icon name="lock" size={13} color="var(--fg-muted)" stroke={1.6} />
            </div>
          ))}
        </div>

        <p style={{ fontSize: 12, color: 'var(--fg-muted)', margin: '24px 0 0', fontStyle: 'italic' }}>
          No functionality at MVP — placeholders only.
        </p>
      </div>
    </div>
  );
}
