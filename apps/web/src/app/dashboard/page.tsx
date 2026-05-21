'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

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
  SEED_APPTS, SEED_REQUESTS, SEED_CLIENTS, STAFF as SEED_STAFF,
  type NavId, type Appointment, type Staff, type Client,
} from '@/components/dashboard/data';

// ── Staff colour palette ──────────────────────────────────────────────────────
// Assigned deterministically by staff index — no DB column needed.
const STAFF_PALETTE = [
  '#322B20', // espresso
  '#4F6E89', // steel blue
  '#4E7C58', // forest
  '#8A6B3A', // caramel
  '#5C4A8A', // purple
  '#7C4E4E', // brick
];

function paletteColor(index: number): string {
  return STAFF_PALETTE[index % STAFF_PALETTE.length] ?? STAFF_PALETTE[0]!;
}

// ── API types (what the server returns) ──────────────────────────────────────

interface ApiStaff {
  id: string;
  name: string;
  role: string;
  avatarUrl?: string | null;
}

interface ApiAppointment {
  id: string;
  staffId: string;
  staffName: string;
  clientName: string;
  clientPhone: string;
  serviceName: string;
  startHour: number;
  endHour: number;
  status: Appointment['status'];
  pricePkr: number;
  source: 'manual' | 'whatsapp' | 'web';
  notes: string;
}

// ── Mapping functions ─────────────────────────────────────────────────────────

function toLocalAppt(a: ApiAppointment): Appointment {
  return {
    id:       a.id,
    staff:    a.staffId,
    staffName: a.staffName,
    client:   a.clientName,
    phone:    a.clientPhone,
    service:  a.serviceName,
    start:    a.startHour,
    end:      a.endHour,
    status:   a.status,
    price:    a.pricePkr * 100, // convert PKR → paisa for display helpers
    source:   a.source,
    notes:    a.notes,
  };
}

function toLocalStaff(rows: ApiStaff[]): Staff[] {
  return rows.map((s, i) => ({
    id:    s.id,
    name:  s.name,
    role:  s.role,
    color: paletteColor(i),
  }));
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function toDateParam(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' }); // YYYY-MM-DD
}

/** Convert a calendar date + decimal hour (e.g. 9.5 = 9:30) → ISO string with +05:00 offset */
function hourToISO(date: Date, decimalHour: number): string {
  const d = toDateParam(date);
  const h = Math.floor(decimalHour);
  const m = Math.round((decimalHour - h) * 60);
  return `${d}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00+05:00`;
}

// ── UserInfo ──────────────────────────────────────────────────────────────────

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
  const [appts, setAppts]           = useState<Appointment[]>([]);
  const [staff, setStaff]           = useState<Staff[]>(SEED_STAFF);
  const [loadingAppts, setLoadingAppts] = useState(false);
  const [requests, setRequests]     = useState(SEED_REQUESTS);
  const [clients, setClients]       = useState<Client[]>(SEED_CLIENTS);
  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null);
  const [posAppt, setPosAppt]       = useState<Appointment | null>(null);
  const [modalOpen, setModalOpen]   = useState(false);
  const [user, setUser]             = useState<UserInfo>({
    name: '', role: 'owner', tenantName: '', tenantCity: undefined,
  });

  const isMobile = useIsMobile();
  const [activeStaffId, setActiveStaffId] = useState<string>(SEED_STAFF[0]!.id);
  const [sheetOpen, setSheetOpen]   = useState(false);

  // ── Fetch staff (once on mount) ─────────────────────────────────────────────
  const fetchStaff = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/v1/staff`, { credentials: 'include' });
      if (!res.ok) return;
      const json = await res.json();
      if (json.ok && Array.isArray(json.data) && json.data.length > 0) {
        const rows = toLocalStaff(json.data as ApiStaff[]);
        setStaff(rows);
        // If the current activeStaffId no longer exists, reset to first
        setActiveStaffId(prev =>
          rows.some(s => s.id === prev) ? prev : rows[0]!.id
        );
      }
    } catch {
      // network error — keep seed staff
    }
  }, []);

  // ── Fetch bookings for a given date ─────────────────────────────────────────
  const fetchAppts = useCallback(async (forDate: Date, silent = false) => {
    if (!silent) setLoadingAppts(true);
    try {
      const dateParam = toDateParam(forDate);
      const res = await fetch(`${API}/api/v1/bookings?date=${dateParam}`, { credentials: 'include' });
      if (!res.ok) return;
      const json = await res.json();
      if (json.ok && Array.isArray(json.data)) {
        setAppts((json.data as ApiAppointment[]).map(toLocalAppt));
      }
    } catch {
      // network error — keep current data
    } finally {
      if (!silent) setLoadingAppts(false);
    }
  }, []);

  // ── Fetch user info ──────────────────────────────────────────────────────────
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

  // ── On mount: fetch staff + today's bookings ─────────────────────────────────
  useEffect(() => {
    fetchStaff();
    fetchAppts(date);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Re-fetch bookings when date changes ──────────────────────────────────────
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    fetchAppts(date);
  }, [date, fetchAppts]);

  // ── 30s polling (silent background refresh) ──────────────────────────────────
  const dateRef  = useRef(date);
  dateRef.current = date;
  // Keep a live snapshot of appts for rollback inside async handleMove
  const apptsRef = useRef(appts);
  apptsRef.current = appts;
  useEffect(() => {
    const id = setInterval(() => fetchAppts(dateRef.current, true), 30_000);
    return () => clearInterval(id);
  }, [fetchAppts]);

  // ── Navigation ───────────────────────────────────────────────────────────────
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

  const handleMove = async (apptId: string, newStart: number, newEnd: number) => {
    // Snapshot original times for rollback
    const orig = apptsRef.current.find(a => a.id === apptId);

    // Optimistic update — UI moves immediately
    setAppts(prev => prev.map(a => a.id === apptId ? { ...a, start: newStart, end: newEnd } : a));
    setSelectedAppt(prev => prev?.id === apptId ? { ...prev, start: newStart, end: newEnd } : prev);

    // Persist to server
    try {
      const res = await fetch(`${API}/api/v1/bookings/${apptId}/reschedule`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startTime: hourToISO(dateRef.current, newStart),
          endTime:   hourToISO(dateRef.current, newEnd),
        }),
      });
      if (!res.ok) throw new Error('reschedule failed');
    } catch {
      // Rollback to original times on failure
      if (orig) {
        setAppts(prev => prev.map(a => a.id === apptId ? { ...a, start: orig.start, end: orig.end } : a));
        setSelectedAppt(prev => prev?.id === apptId ? { ...prev, start: orig.start, end: orig.end } : prev);
      }
    }
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
      {/* Sidebar — desktop only */}
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
              staff={staff}
              loading={loadingAppts}
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

        {/* BottomNav — mobile only */}
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
        onSuccess={() => {
          setModalOpen(false);
          fetchAppts(date, true);
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
