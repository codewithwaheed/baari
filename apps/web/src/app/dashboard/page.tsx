'use client';

import { useState, useCallback } from 'react';

const API = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { Topbar } from '@/components/dashboard/Topbar';
import { Calendar } from '@/components/dashboard/Calendar';
import { AppointmentPanel, AppointmentPanelEmpty } from '@/components/dashboard/AppointmentPanel';
import { POSPanel } from '@/components/dashboard/POSPanel';
import { RequestsView } from '@/components/dashboard/RequestsView';
import { ClientsView } from '@/components/dashboard/ClientsView';
import { NewBookingModal } from '@/components/dashboard/NewBookingModal';
import { ComingSoon, SettingsStub } from '@/components/dashboard/ComingSoon';
import {
  SEED_APPTS, SEED_REQUESTS, SEED_CLIENTS,
  type NavId, type Appointment, type Client,
} from '@/components/dashboard/data';

const VIEW_TITLES: Record<NavId, string> = {
  calendar:  'Calendar',
  requests:  'Requests',
  clients:   'Clients',
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

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: 'var(--font-body)' }}>
      <Sidebar
        active={nav}
        onNavigate={navigate}
        onLogout={handleLogout}
        requestsCount={requests.length}
      />

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Topbar
          title={VIEW_TITLES[nav]}
          showDate={isCalendar}
          date={date}
          onDateChange={setDate}
          onNew={() => setModalOpen(true)}
        />

        <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
          {/* Main content area */}
          {isCalendar && (
            <Calendar
              appts={appts}
              selectedId={selectedAppt?.id ?? null}
              onSelect={(a) => { setSelectedAppt(a); setPosAppt(null); }}
              onMove={handleMove}
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
          {nav === 'settings' && <SettingsStub />}
          {LOCKED_VIEWS.includes(nav) && <ComingSoon id={nav} />}

          {/* Right panel — calendar only */}
          {isCalendar && !posAppt && selectedAppt && (
            <AppointmentPanel
              appt={selectedAppt}
              client={clients.find(c => c.name === selectedAppt.client) ?? null}
              onClose={() => setSelectedAppt(null)}
              onCheckout={() => setPosAppt(selectedAppt)}
              onReschedule={() => { /* TODO: reschedule flow */ }}
              onCancel={() => {
                setAppts(prev => prev.filter(a => a.id !== selectedAppt.id));
                setSelectedAppt(null);
              }}
              onUpdateNotes={updateClientNotes}
            />
          )}
          {isCalendar && !posAppt && !selectedAppt && <AppointmentPanelEmpty />}
          {isCalendar && posAppt && (
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
    </div>
  );
}
