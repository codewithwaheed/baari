'use client';

import { useState, useCallback, useEffect } from 'react';

const API = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';

import { Sidebar } from '@/components/dashboard/Sidebar';
import { BottomNav } from '@/components/dashboard/BottomNav';
import { Topbar } from '@/components/dashboard/Topbar';
import { Calendar } from '@/components/dashboard/Calendar';
import { AppointmentPanel, AppointmentPanelEmpty } from '@/components/dashboard/AppointmentPanel';
import { POSPanel } from '@/components/dashboard/POSPanel';
import { RequestsView } from '@/components/dashboard/RequestsView';
import { ClientsView } from '@/components/dashboard/ClientsView';
import { NewBookingModal } from '@/components/dashboard/NewBookingModal';
import { ComingSoon, SettingsStub } from '@/components/dashboard/ComingSoon';
import { BottomSheet } from '@/components/dashboard/BottomSheet';
import { useIsMobile } from '@/hooks/useIsMobile';
import {
  SEED_APPTS, SEED_REQUESTS, SEED_CLIENTS, STAFF,
  type NavId, type Appointment, type Client,
} from '@/components/dashboard/data';

interface UserInfo {
  name: string;
  role: string;
  tenantName: string;
  tenantCity?: string;
}

const VIEW_TITLES: Record<NavId, string> = {
  calendar:  'Calendar',
  requests:  'Requests',
  clients:   'Clients',
  pos:       'POS',
  settings:  'Settings',
  waitlist:  'Waitlist',
  messages:  'Messages',
  inventory: 'Inventory',
  marketing: 'Marketing',
  reports:   'Reports',
  billie:    'Ask Billie',
};

const LOCKED_VIEWS: NavId[] = ['waitlist', 'messages', 'inventory', 'marketing', 'reports', 'billie'];

export default function DashboardPage() {
  const [nav, setNav]               = useState<NavId>('calendar');
  const [date, setDate]             = useState(() => new Date());
  const [appts, setAppts]           = useState<Appointment[]>(SEED_APPTS);
  const [requests, setRequests]     = useState(SEED_REQUESTS);
  const [clients, setClients]       = useState<Client[]>(SEED_CLIENTS);
  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null);
  const [posAppt, setPosAppt]       = useState<Appointment | null>(null);
  const [modalOpen, setModalOpen]   = useState(false);
  const [user, setUser]             = useState<UserInfo>({
    name: '', role: 'owner', tenantName: '', tenantCity: undefined,
  });

  const isMobile = useIsMobile();
  const [activeStaffId, setActiveStaffId] = useState<string>(STAFF[0]!.id);
  const [sheetOpen, setSheetOpen]   = useState(false);

  useEffect(() => {
    fetch(`${API}/api/v1/me`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.ok) {
          setUser({
            name:       data.user.name   ?? '',
            role:       data.user.role   ?? 'owner',
            tenantName: data.tenant.name ?? '',
            tenantCity: data.tenant.city ?? undefined,
          });
        }
      })
      .catch(() => null);
  }, []);

  const navigate = (id: NavId) => {
    setNav(id);
    setSelectedAppt(null);
    setPosAppt(null);
  };

  const handleLogout = useCallback(async () => {
    await fetch(`${API}/api/v1/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => null);
    window.location.href = '/login';
  }, []);

  const updateClientNotes = (id: string, notes: string) => {
    setClients(prev => prev.map(c => c.id === id ? { ...c, notes } : c));
  };

  const handleMove = (apptId: string, newStart: number, newEnd: number) => {
    setAppts(prev => prev.map(a => a.id === apptId ? { ...a, start: newStart, end: newEnd } : a));
    setSelectedAppt(prev => prev?.id === apptId ? { ...prev, start: newStart, end: newEnd } : prev);
  };

  const isCalendar = nav === 'calendar';
  const isPOS      = nav === 'pos';

  return (
    <div style={{
      display: 'flex',
      height: '100dvh',
      overflow: 'hidden',
      fontFamily: 'var(--font-body)',
    }}>
      {/* Sidebar — desktop only (hidden on mobile via CSS class) */}
      <Sidebar
        active={nav}
        onNavigate={navigate}
        onLogout={handleLogout}
        requestsCount={requests.length}
        userName={user.name || 'Owner'}
        userRole={user.role}
        tenantName={user.tenantName || 'My Salon'}
        tenantCity={user.tenantCity}
      />

      {/* Main column */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Topbar
          title={VIEW_TITLES[nav]}
          showDate={isCalendar}
          date={date}
          onDateChange={setDate}
          onNew={() => setModalOpen(true)}
          userName={user.name || 'Owner'}
          userRole={user.role}
        />

        {/* Content area */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
          {/* Main view */}
          {isCalendar && (
            <Calendar
              appts={appts}
              selectedId={selectedAppt?.id ?? null}
              onSelect={(a) => {
                setSelectedAppt(a);
                setPosAppt(null);
                if (isMobile) setSheetOpen(true);
              }}
              onMove={handleMove}
              activeStaffId={activeStaffId}
              onStaffChange={setActiveStaffId}
            />
          )}
          {nav === 'requests' && (
            <RequestsView
              requests={requests}
              onApprove={(r) => setRequests(prev => prev.filter(x => x.id !== r.id))}
              onDecline={(r) => setRequests(prev => prev.filter(x => x.id !== r.id))}
            />
          )}
          {nav === 'clients' && (
            <ClientsView clients={clients} onUpdateNotes={updateClientNotes} />
          )}
          {isPOS && (
            posAppt ? (
              <POSPanel
                appt={posAppt}
                onBack={() => setPosAppt(null)}
                onConfirm={() => {
                  setAppts(prev => prev.map(a => a.id === posAppt.id ? { ...a, status: 'completed' } : a));
                  setPosAppt(null);
                }}
              />
            ) : (
              <div style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 12,
                background: 'var(--baari-cream)', padding: 32, textAlign: 'center',
              }}>
                <div style={{ fontSize: 40 }}>🧾</div>
                <p style={{ fontSize: 15, color: 'var(--fg-secondary)', margin: 0, maxWidth: 320, lineHeight: 1.6 }}>
                  Select an appointment from the Calendar to start checkout.
                </p>
              </div>
            )
          )}
          {nav === 'settings' && <SettingsStub />}
          {LOCKED_VIEWS.includes(nav) && <ComingSoon id={nav} />}

          {/* Right panel — calendar only, hidden on mobile */}
          {isCalendar && (
            <div className="calendar-right-panel" style={{ display: 'contents' }}>
              {!posAppt && selectedAppt && (
                <AppointmentPanel
                  appt={selectedAppt}
                  client={clients.find(c => c.name === selectedAppt.client) ?? null}
                  onClose={() => setSelectedAppt(null)}
                  onCheckout={() => setPosAppt(selectedAppt)}
                  onReschedule={() => { /* Phase 5 */ }}
                  onCancel={() => {
                    setAppts(prev => prev.filter(a => a.id !== selectedAppt.id));
                    setSelectedAppt(null);
                  }}
                  onUpdateNotes={updateClientNotes}
                />
              )}
              {!posAppt && !selectedAppt && <AppointmentPanelEmpty />}
              {posAppt && (
                <POSPanel
                  appt={posAppt}
                  onBack={() => setPosAppt(null)}
                  onConfirm={() => {
                    setAppts(prev => prev.map(a => a.id === posAppt.id ? { ...a, status: 'completed' } : a));
                    setPosAppt(null);
                    setSelectedAppt(null);
                  }}
                />
              )}
            </div>
          )}
        </div>

        {/* BottomNav — mobile only (shown via CSS class) */}
        <BottomNav
          active={nav}
          onNavigate={navigate}
          requestsCount={requests.length}
          onNew={() => setModalOpen(true)}
        />
      </div>

      <NewBookingModal
        open={modalOpen}
        defaultDate={date}
        onClose={() => setModalOpen(false)}
        onCreate={(appt) => {
          setAppts(prev => [...prev, appt]);
          setModalOpen(false);
        }}
      />

      {/* Mobile appointment bottom sheet */}
      <BottomSheet
        open={sheetOpen && isMobile}
        onClose={() => { setSheetOpen(false); setSelectedAppt(null); }}
      >
        {selectedAppt && (
          <AppointmentPanel
            appt={selectedAppt}
            client={clients.find(c => c.name === selectedAppt.client) ?? null}
            onClose={() => { setSheetOpen(false); setSelectedAppt(null); }}
            onCheckout={() => {
              setSheetOpen(false);
              setPosAppt(selectedAppt);
              setNav('pos');
            }}
            onReschedule={() => {}}
            onCancel={() => {
              setAppts(prev => prev.filter(a => a.id !== selectedAppt.id));
              setSheetOpen(false);
              setSelectedAppt(null);
            }}
            onUpdateNotes={updateClientNotes}
          />
        )}
      </BottomSheet>
    </div>
  );
}
