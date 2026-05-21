'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

const API = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';

import { Sidebar } from '@/components/dashboard/Sidebar';
import { BottomNav } from '@/components/dashboard/BottomNav';
import { Topbar } from '@/components/dashboard/Topbar';
import { Calendar } from '@/components/dashboard/Calendar';
import { AppointmentPanel, AppointmentPanelEmpty, type PaymentInfo } from '@/components/dashboard/AppointmentPanel';
import { POSPanel } from '@/components/dashboard/POSPanel';
import { RequestsView } from '@/components/dashboard/RequestsView';
import { ClientsView } from '@/components/dashboard/ClientsView';
import { NewBookingModal } from '@/components/dashboard/NewBookingModal';
import { ComingSoon, SettingsStub } from '@/components/dashboard/ComingSoon';
import { BottomSheet } from '@/components/dashboard/BottomSheet';
import { ToastStack, useToasts } from '@/components/dashboard/Toast';
import { useIsMobile } from '@/hooks/useIsMobile';
import {
  SEED_APPTS, SEED_REQUESTS, SEED_CLIENTS, STAFF as SEED_STAFF,
  type NavId, type Appointment, type Staff, type Client, type VisitRecord,
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
  customerId: string;
  staffName: string;
  clientName: string;
  clientPhone: string;
  notes: string;             // customers.notes — persists across bookings
  customerCreatedAt: string; // ISO string
  serviceName: string;
  startHour: number;
  endHour: number;
  status: Appointment['status'];
  pricePkr: number;
  source: 'manual' | 'whatsapp' | 'web';
}

// ── Mapping functions ─────────────────────────────────────────────────────────

function toLocalAppt(a: ApiAppointment): Appointment {
  return {
    id:                a.id,
    staff:             a.staffId,
    staffName:         a.staffName,
    client:            a.clientName,
    phone:             a.clientPhone,
    customerId:        a.customerId,
    customerCreatedAt: a.customerCreatedAt,
    service:           a.serviceName,
    start:             a.startHour,
    end:               a.endHour,
    status:            a.status,
    price:             a.pricePkr * 100,
    source:            a.source,
    notes:             a.notes,
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

  const { toasts, push: pushToast, dismiss: dismissToast } = useToasts();
  // Customer visit history fetched on appointment select, keyed by customerId
  const [customerVisits, setCustomerVisits] = useState<Record<string, VisitRecord[]>>({});
  // Payment info for completed bookings, keyed by bookingId
  const [paymentByAppt, setPaymentByAppt] = useState<Record<string, PaymentInfo>>({});

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

  const handleCheckIn = async (apptId: string) => {
    const orig = apptsRef.current.find(a => a.id === apptId);
    setAppts(prev => prev.map(a => a.id === apptId ? { ...a, status: 'checkedIn' } : a));
    setSelectedAppt(prev => prev?.id === apptId ? { ...prev, status: 'checkedIn' } : prev);
    try {
      const res = await fetch(`${API}/api/v1/bookings/${apptId}/status`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: 'checkedIn' }),
      });
      if (!res.ok) throw new Error('check-in failed');
    } catch {
      if (orig) {
        setAppts(prev => prev.map(a => a.id === apptId ? orig : a));
        setSelectedAppt(prev => prev?.id === apptId ? orig : prev);
      }
    }
  };

  const handleCancel = async (apptId: string) => {
    const orig = apptsRef.current.find(a => a.id === apptId);
    setAppts(prev => prev.filter(a => a.id !== apptId));
    setSelectedAppt(null);
    try {
      const res = await fetch(`${API}/api/v1/bookings/${apptId}/status`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: 'cancelled' }),
      });
      if (!res.ok) throw new Error('cancel failed');
    } catch {
      if (orig) {
        setAppts(prev => [...prev, orig]);
        setSelectedAppt(orig);
      }
    }
  };

  const handleNoShow = async (apptId: string) => {
    const orig = apptsRef.current.find(a => a.id === apptId);
    setAppts(prev => prev.map(a => a.id === apptId ? { ...a, status: 'noShow' } : a));
    setSelectedAppt(prev => prev?.id === apptId ? { ...prev, status: 'noShow' } : prev);
    try {
      const res = await fetch(`${API}/api/v1/bookings/${apptId}/status`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: 'noShow' }),
      });
      if (!res.ok) throw new Error('no-show failed');
    } catch {
      if (orig) {
        setAppts(prev => prev.map(a => a.id === apptId ? orig : a));
        setSelectedAppt(prev => prev?.id === apptId ? orig : prev);
      }
    }
  };

  const handlePOSConfirm = async (appt: Appointment, result: { method: string; discount: number; total: number }) => {
    const apptId = appt.id;
    const orig = apptsRef.current.find(a => a.id === apptId);
    setAppts(prev => prev.map(a => a.id === apptId ? { ...a, status: 'completed' } : a));
    setPosAppt(null);
    setSelectedAppt(null);
    try {
      const res = await fetch(`${API}/api/v1/bookings/${apptId}/checkout`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method:        result.method,
          discountPaisa: result.discount,
          totalPaisa:    result.total,
        }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        const msg = errJson?.error?.message ?? 'Checkout failed. Please try again.';
        throw new Error(msg);
      }
      // Cache payment locally so the panel shows it immediately without a refetch
      setPaymentByAppt(prev => ({
        ...prev,
        [apptId]: {
          gateway:       result.method,
          amountPaisa:   result.total,
          discountPaisa: result.discount,
          state:         'SUCCESS',
          paidAt:        new Date().toISOString(),
        },
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Checkout failed. Please try again.';
      pushToast('error', msg);
      if (orig) {
        setAppts(prev => prev.map(a => a.id === apptId ? orig : a));
        setPosAppt(orig);
      }
    }
  };

  const handleSaveCustomerNotes = (clientId: string, notes: string, customerId?: string) => {
    updateClientNotes(clientId, notes);
    if (customerId) {
      fetch(`${API}/api/v1/customers/${customerId}`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      }).catch(() => null);
    }
  };

  const fetchCustomerVisits = useCallback(async (customerId: string) => {
    if (customerVisits[customerId]) return; // already cached
    try {
      const res = await fetch(`${API}/api/v1/customers/${customerId}/bookings?limit=6`, { credentials: 'include' });
      if (!res.ok) return;
      const json = await res.json();
      if (json.ok && Array.isArray(json.data)) {
        const visits: VisitRecord[] = json.data.map((r: { service: string; date: string; staff: string; amount: number }) => ({
          service: r.service,
          date:    r.date,
          staff:   r.staff,
          amount:  r.amount,
        }));
        setCustomerVisits(prev => ({ ...prev, [customerId]: visits }));
      }
    } catch {
      // silently ignore — panel falls back to seed data
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerVisits]);

  const fetchPayment = useCallback(async (apptId: string) => {
    if (paymentByAppt[apptId]) return;
    try {
      const res = await fetch(`${API}/api/v1/bookings/${apptId}/payment`, { credentials: 'include' });
      if (!res.ok) return;
      const json = await res.json();
      if (json.ok && json.data) {
        setPaymentByAppt(prev => ({ ...prev, [apptId]: json.data as PaymentInfo }));
      }
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentByAppt]);

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
                if (a.customerId) fetchCustomerVisits(a.customerId);
                if (a.status === 'completed') fetchPayment(a.id);
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
                onConfirm={(result) => handlePOSConfirm(posAppt, result)}
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
                  visits={selectedAppt.customerId ? customerVisits[selectedAppt.customerId] : undefined}
                  payment={paymentByAppt[selectedAppt.id]}
                  onClose={() => setSelectedAppt(null)}
                  onCheckout={() => setPosAppt(selectedAppt)}
                  onCheckIn={() => handleCheckIn(selectedAppt.id)}
                  onReschedule={() => { /* Phase 5 */ }}
                  onCancel={() => handleCancel(selectedAppt.id)}
                  onNoShow={() => handleNoShow(selectedAppt.id)}
                  onUpdateNotes={(clientId, notes) =>
                    handleSaveCustomerNotes(clientId, notes, selectedAppt.customerId)
                  }
                />
              )}
              {!posAppt && !selectedAppt && <AppointmentPanelEmpty />}
              {posAppt && (
                <POSPanel
                  appt={posAppt}
                  onBack={() => setPosAppt(null)}
                  onConfirm={(result) => handlePOSConfirm(posAppt, result)}
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

      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {/* Mobile appointment bottom sheet */}
      <BottomSheet
        open={sheetOpen && isMobile}
        onClose={() => { setSheetOpen(false); setSelectedAppt(null); }}
      >
        {selectedAppt && (
          <AppointmentPanel
            appt={selectedAppt}
            client={clients.find(c => c.name === selectedAppt.client) ?? null}
            visits={selectedAppt.customerId ? customerVisits[selectedAppt.customerId] : undefined}
            payment={paymentByAppt[selectedAppt.id]}
            onClose={() => { setSheetOpen(false); setSelectedAppt(null); }}
            onCheckout={() => {
              setSheetOpen(false);
              setPosAppt(selectedAppt);
              setNav('pos');
            }}
            onCheckIn={() => { handleCheckIn(selectedAppt.id); setSheetOpen(false); }}
            onReschedule={() => {}}
            onCancel={() => { handleCancel(selectedAppt.id); setSheetOpen(false); }}
            onNoShow={() => { handleNoShow(selectedAppt.id); setSheetOpen(false); }}
            onUpdateNotes={(clientId, notes) =>
              handleSaveCustomerNotes(clientId, notes, selectedAppt.customerId)
            }
          />
        )}
      </BottomSheet>
    </div>
  );
}
