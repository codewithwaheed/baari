// apps/web/src/app/dashboard/page.tsx
// Dashboard shell — wires Sidebar + Topbar + views + panels.
// TODO: Replace seed data with real API calls to apps/api.

'use client';

import { useState } from 'react';
// TODO: import all components from @/components/dashboard/ as they are built

export type NavId =
  | 'calendar' | 'requests' | 'clients' | 'settings'
  | 'waitlist' | 'messages' | 'inventory' | 'marketing' | 'reports' | 'billie';

const VIEW_TITLES: Record<NavId, string> = {
  calendar: 'Calendar', requests: 'Requests', clients: 'Clients',
  settings: 'Settings', waitlist: 'Waitlist', messages: 'Messages',
  inventory: 'Inventory', marketing: 'Marketing', reports: 'Reports', billie: 'Ask Billie',
};

const LOCKED_VIEWS: NavId[] = ['waitlist', 'messages', 'inventory', 'marketing', 'reports', 'billie'];

export default function DashboardPage() {
  const [nav, setNav] = useState<NavId>('calendar');

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: 'var(--font-body)' }}>
      {/*
        TODO: As you build each component, uncomment and wire it in.

        <Sidebar active={nav} onNavigate={setNav} requestsCount={3} />

        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <Topbar title={VIEW_TITLES[nav]} showDate={nav === 'calendar'} date={new Date()} onDateChange={...} onNew={...} />
          <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
            {nav === 'calendar' && <Calendar ... />}
            {nav === 'requests' && <RequestsView ... />}
            {nav === 'clients' && <ClientsView ... />}
            {nav === 'settings' && <SettingsStub />}
            {LOCKED_VIEWS.includes(nav) && <ComingSoon id={nav} />}
            {selectedAppt && !posAppt && <AppointmentPanel ... />}
            {posAppt && <POSPanel ... />}
          </div>
        </div>
      */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--baari-cream)' }}>
        <div style={{ textAlign: 'center', fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 200, color: 'var(--baari-onyx)' }}>
          Build the components in <code style={{ fontFamily: 'var(--font-mono)', fontSize: 18 }}>src/components/dashboard/</code>
        </div>
      </div>
    </div>
  );
}
