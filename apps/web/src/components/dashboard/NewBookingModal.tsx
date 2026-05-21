'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { IconButton, DButton, Eyebrow, Icon, fmtPKR } from './primitives';
import { useIsMobile } from '@/hooks/useIsMobile';

const API = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ApiStaff    { id: string; name: string; role: string; }
interface ApiService  { id: string; name: string; category: string | null; durationMin: number; pricePaisa: number; }
interface ApiCustomer { id: string; name: string | null; phoneE164: string; notes: string; isVip: boolean; }
interface Slot        { startHour: number; endHour: number; label: string; }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isoDate(d: Date): string {
  const yr = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const dy = String(d.getDate()).padStart(2, '0');
  return `${yr}-${mo}-${dy}`;
}

function toISO(dateStr: string, decimalHour: number): string {
  const h = Math.floor(decimalHour);
  const m = Math.round((decimalHour - h) * 60);
  return `${dateStr}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00+05:00`;
}

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('03') && digits.length === 11) return '+92' + digits.slice(1);
  if (digits.startsWith('92') && digits.length === 12) return '+' + digits;
  if (raw.trimStart().startsWith('+')) return '+' + digits;
  return raw.trim();
}

function formatDisplayPhone(e164: string): string {
  // +923001234567 → 0300 1234 567
  if (e164.startsWith('+92') && e164.length === 13) {
    const local = '0' + e164.slice(3);
    return local.slice(0, 4) + ' ' + local.slice(4, 7) + ' ' + local.slice(7);
  }
  return e164;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface NewBookingModalProps {
  open: boolean;
  defaultDate?: Date;
  onClose: () => void;
  onSuccess: () => void;
}

export function NewBookingModal({ open, defaultDate, onClose, onSuccess }: NewBookingModalProps) {
  const isMobile = useIsMobile();

  // ── API data ────────────────────────────────────────────────────────────────
  const [apiStaff,    setApiStaff]    = useState<ApiStaff[]>([]);
  const [apiServices, setApiServices] = useState<ApiService[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  // ── Client search combobox ──────────────────────────────────────────────────
  // mode: 'search' → typing/idle, 'selected' → existing client locked in, 'new' → manual entry
  const [clientMode,      setClientMode]      = useState<'search' | 'selected' | 'new'>('search');
  const [clientQuery,     setClientQuery]     = useState('');
  const [searchResults,   setSearchResults]   = useState<ApiCustomer[]>([]);
  const [searchOpen,      setSearchOpen]      = useState(false);
  const [searchLoading,   setSearchLoading]   = useState(false);
  const [selectedClient,  setSelectedClient]  = useState<ApiCustomer | null>(null);
  const searchRef   = useRef<HTMLDivElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── New-client sub-form (only when clientMode === 'new') ────────────────────
  const [newPhone, setNewPhone] = useState('');
  const [newName,  setNewName]  = useState('');

  // ── Selected services ───────────────────────────────────────────────────────
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [addingService,      setAddingService]      = useState(false);

  // ── Availability slots ──────────────────────────────────────────────────────
  const [slots,           setSlots]           = useState<Slot[]>([]);
  const [slotsLoading,    setSlotsLoading]    = useState(false);
  const [selectedSlotIdx, setSelectedSlotIdx] = useState(-1);

  // ── Form state ──────────────────────────────────────────────────────────────
  const [staffId, setStaffId] = useState('');
  const [date,    setDate]    = useState(() => isoDate(defaultDate ?? new Date()));
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  // ── Reset when modal opens ──────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    setDataLoading(true);
    setClientMode('search'); setClientQuery(''); setSearchResults([]); setSearchOpen(false);
    setSelectedClient(null); setNewPhone(''); setNewName('');
    setError(null);
    setDate(isoDate(defaultDate ?? new Date()));
    setSelectedServiceIds([]);
    setSlots([]); setSelectedSlotIdx(-1);

    Promise.all([
      fetch(`${API}/api/v1/staff`,    { credentials: 'include' }).then(r => r.json()),
      fetch(`${API}/api/v1/services`, { credentials: 'include' }).then(r => r.json()),
    ])
      .then(([staffRes, svcRes]) => {
        const staff: ApiStaff[]  = staffRes.ok ? staffRes.data : [];
        const svcs:  ApiService[] = svcRes.ok   ? svcRes.data  : [];
        setApiStaff(staff);
        setApiServices(svcs);
        if (staff.length > 0) setStaffId(staff[0]!.id);
      })
      .catch(() => null)
      .finally(() => setDataLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ── Close dropdown on outside click ────────────────────────────────────────
  useEffect(() => {
    if (!searchOpen) return;
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [searchOpen]);

  // ── Debounced client search ─────────────────────────────────────────────────
  const runSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setSearchResults([]); setSearchLoading(false); return; }
    setSearchLoading(true);
    try {
      const res  = await fetch(`${API}/api/v1/customers?q=${encodeURIComponent(q.trim())}`, { credentials: 'include' });
      const json = await res.json();
      setSearchResults(json.ok && Array.isArray(json.data) ? json.data : []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  const handleQueryChange = (v: string) => {
    setClientQuery(v);
    setSearchOpen(true);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (v.trim().length >= 2) {
      setSearchLoading(true);
      searchTimer.current = setTimeout(() => runSearch(v), 350);
    } else {
      setSearchResults([]);
      setSearchLoading(false);
    }
  };

  const selectClient = (c: ApiCustomer) => {
    setSelectedClient(c);
    setClientMode('selected');
    setSearchOpen(false);
    setClientQuery('');
    setSearchResults([]);
  };

  const resetClient = () => {
    setSelectedClient(null);
    setClientMode('search');
    setClientQuery('');
    setSearchResults([]);
    setNewPhone(''); setNewName('');
  };

  const switchToNew = () => {
    setClientMode('new');
    setSearchOpen(false);
    // Pre-fill phone if query looks like a number
    const digits = clientQuery.replace(/\D/g, '');
    if (digits.length >= 7) setNewPhone(clientQuery);
    else setNewName(clientQuery);
    setClientQuery('');
    setSearchResults([]);
  };

  // ── Service management ──────────────────────────────────────────────────────
  const selectedServices = selectedServiceIds
    .map(id => apiServices.find(s => s.id === id))
    .filter((s): s is ApiService => s !== undefined);

  const totalDurationMin = selectedServices.reduce((sum, s) => sum + s.durationMin, 0);
  const totalPricePaisa  = selectedServices.reduce((sum, s) => sum + s.pricePaisa, 0);
  const availableToAdd   = apiServices.filter(s => !selectedServiceIds.includes(s.id));

  const removeService = (idx: number) => setSelectedServiceIds(prev => prev.filter((_, i) => i !== idx));
  const addService    = (id: string) => { setSelectedServiceIds(prev => [...prev, id]); setAddingService(false); };

  // ── Slots ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!staffId || !date || selectedServiceIds.length === 0 || totalDurationMin === 0) return;
    const controller = new AbortController();
    setSlotsLoading(true);
    fetch(
      `${API}/api/v1/bookings/availability?staffId=${encodeURIComponent(staffId)}&date=${encodeURIComponent(date)}&serviceDurationMin=${totalDurationMin}`,
      { credentials: 'include', signal: controller.signal },
    )
      .then(r => r.json())
      .then(json => {
        const newSlots: Slot[] = json.ok ? json.data : [];
        setSlots(newSlots);
        setSelectedSlotIdx(newSlots.length > 0 ? 0 : -1);
      })
      .catch(err => { if (err instanceof Error && err.name === 'AbortError') return; setSlots([]); setSelectedSlotIdx(-1); })
      .finally(() => setSlotsLoading(false));
    return () => controller.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffId, date, selectedServiceIds, totalDurationMin]);

  // ── Submission ──────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true); setError(null);

    try {
      let cId: string | null = selectedClient?.id ?? null;

      if (clientMode === 'new') {
        const custRes  = await fetch(`${API}/api/v1/customers`, {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: normalizePhone(newPhone), name: newName.trim() }),
        });
        const custJson = await custRes.json();
        if (!custJson.ok) { setError('Could not save client. Please try again.'); setSubmitting(false); return; }
        cId = (custJson.data as ApiCustomer).id;
      }

      if (!cId) { setError('No client selected.'); setSubmitting(false); return; }

      const selectedSlot = slots[selectedSlotIdx]!;
      const bookingRes = await fetch(`${API}/api/v1/bookings`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffId, serviceIds: selectedServiceIds,
          customerId: cId,
          startTime: toISO(date, selectedSlot.startHour),
          source: 'manual', notes: '',
        }),
      });

      const bookingJson = await bookingRes.json();
      if (!bookingJson.ok) {
        setError(bookingJson.error?.code === 'SLOT_UNAVAILABLE'
          ? 'That slot just got taken. Please choose a different time.'
          : (bookingJson.error?.message ?? 'Booking failed. Please try again.'));
        setSubmitting(false); return;
      }

      onSuccess();
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  const selectedSlot = selectedSlotIdx >= 0 ? slots[selectedSlotIdx] : null;
  const clientOk = clientMode === 'selected'
    || (clientMode === 'new' && newPhone.replace(/\D/g, '').length >= 7 && newName.trim().length > 0);
  const canSubmit = clientOk && selectedServiceIds.length > 0 && !!staffId && selectedSlotIdx >= 0 && !submitting;

  // ── Styles ────────────────────────────────────────────────────────────────────
  const overlayStyle = {
    position: 'fixed' as const, inset: 0,
    background: 'rgba(15,12,8,0.55)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: isMobile ? 'flex-end' : 'center',
    justifyContent: 'center',
    zIndex: 150,
    fontFamily: 'var(--font-body)',
  };

  const cardStyle = isMobile
    ? {
        width: '100%', height: '85dvh',
        borderRadius: '16px 16px 0 0',
        background: '#fff', boxShadow: '0 -8px 40px rgba(0,0,0,0.28)',
        display: 'flex', flexDirection: 'column' as const, overflow: 'hidden',
      }
    : {
        width: 560, maxWidth: '92vw', maxHeight: '90vh',
        background: '#fff', borderRadius: 12,
        boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
        display: 'flex', flexDirection: 'column' as const, overflow: 'hidden',
      };

  return (
    <div onClick={onClose} style={overlayStyle}>
      <div onClick={(e) => e.stopPropagation()} style={cardStyle}>

        {/* ── Header ───────────────────────────────────────────────────────── */}
        {isMobile && (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12, paddingBottom: 4 }}>
            <div style={{ width: 36, height: 4, borderRadius: 99, background: 'var(--baari-sand)' }} />
          </div>
        )}
        <div style={{ padding: isMobile ? '12px 24px 14px' : '20px 24px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <Eyebrow>New booking</Eyebrow>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: isMobile ? 22 : 26, letterSpacing: '-0.01em', color: 'var(--baari-onyx)', lineHeight: 1.1, marginTop: 4 }}>
              Book a <strong>client</strong>
            </div>
          </div>
          <IconButton name="close" onClick={onClose} />
        </div>

        {/* ── Form ─────────────────────────────────────────────────────────── */}
        <div style={{ padding: '20px 24px', overflow: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {dataLoading && (
            <div style={{ padding: '12px 0', color: 'var(--fg-muted)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: '50%', border: '2px solid var(--border)', borderTopColor: 'var(--baari-onyx)', animation: 'spin 0.7s linear infinite' }} />
              Loading…
            </div>
          )}

          {/* ── Client search / selection ───────────────────────────────── */}
          <Field label="Client" required>
            {clientMode === 'selected' && selectedClient ? (
              /* ── Selected pill ── */
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px',
                background: 'var(--baari-cream)', border: '1px solid var(--border-subtle)', borderRadius: 6,
                marginTop: 4,
              }}>
                <span style={{
                  width: 28, height: 28, borderRadius: 999, flexShrink: 0,
                  background: 'var(--baari-espresso)', color: 'var(--baari-lime)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon name="check" size={13} stroke={2.5} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--baari-onyx)', lineHeight: 1.2 }}>
                    {selectedClient.name ?? 'Unknown'}
                    {selectedClient.isVip && (
                      <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, background: '#FFF3CD', color: '#92640A', borderRadius: 999, padding: '1px 6px' }}>VIP</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginTop: 1 }}>
                    {formatDisplayPhone(selectedClient.phoneE164)}
                  </div>
                </div>
                <button
                  onClick={resetClient}
                  style={{ background: 'transparent', border: 0, cursor: 'pointer', padding: '4px 6px', color: 'var(--fg-muted)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, borderRadius: 4, fontFamily: 'inherit' }}
                >
                  <Icon name="close" size={12} stroke={2} /> Change
                </button>
              </div>
            ) : clientMode === 'new' ? (
              /* ── New client sub-form ── */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 }}>
                <div style={{
                  padding: '10px 12px', background: '#FFF8E7', border: '1px solid #E8D58A',
                  borderRadius: 6, fontSize: 12, color: '#8A6820', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <span>New client — will be created on save</span>
                  <button onClick={resetClient} style={{ background: 'transparent', border: 0, cursor: 'pointer', fontSize: 12, color: '#8A6820', fontFamily: 'inherit', padding: 0, display: 'flex', alignItems: 'center', gap: 3 }}>
                    <Icon name="arrowLeft" size={11} stroke={2} /> Search instead
                  </button>
                </div>
                <FormInput
                  value={newPhone}
                  onChange={setNewPhone}
                  placeholder="03xx xxx xxxx"
                  type="tel"
                />
                <FormInput
                  value={newName}
                  onChange={setNewName}
                  placeholder="Client name"
                />
              </div>
            ) : (
              /* ── Search combobox ── */
              <div ref={searchRef} style={{ position: 'relative', marginTop: 4 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  borderBottom: searchOpen ? '1px solid var(--baari-onyx)' : '1px solid var(--border)',
                  paddingBottom: 2, transition: 'border-color 120ms',
                }}>
                  {searchLoading
                    ? <span style={{ flexShrink: 0, width: 14, height: 14, borderRadius: '50%', border: '2px solid var(--border)', borderTopColor: 'var(--baari-onyx)', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
                    : <Icon name="search" size={14} color="var(--fg-muted)" stroke={1.8} />
                  }
                  <input
                    autoComplete="off"
                    value={clientQuery}
                    onChange={e => handleQueryChange(e.target.value)}
                    onFocus={() => { if (clientQuery.trim().length >= 2 || searchResults.length > 0) setSearchOpen(true); }}
                    placeholder="Search by name or number…"
                    style={{
                      flex: 1, border: 0, outline: 'none', padding: '10px 0',
                      fontFamily: 'var(--font-body)', fontSize: 14,
                      color: 'var(--baari-onyx)', background: 'transparent',
                    }}
                  />
                  {clientQuery && (
                    <button onClick={() => { setClientQuery(''); setSearchResults([]); setSearchOpen(false); }} style={{ background: 'transparent', border: 0, cursor: 'pointer', padding: 2, color: 'var(--fg-muted)', display: 'flex' }}>
                      <Icon name="close" size={13} stroke={2} />
                    </button>
                  )}
                </div>

                {/* Dropdown */}
                {searchOpen && (
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 20,
                    background: '#fff', border: '1px solid var(--border)',
                    borderRadius: 8, boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
                    overflow: 'hidden',
                  }}>
                    {searchResults.length > 0 ? (
                      <>
                        {searchResults.map(c => (
                          <button
                            key={c.id}
                            onMouseDown={() => selectClient(c)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 10,
                              width: '100%', padding: '11px 14px', background: 'transparent',
                              border: 0, borderBottom: '1px solid var(--border-subtle)',
                              cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                            }}
                            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--baari-cream)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                          >
                            <span style={{
                              width: 28, height: 28, borderRadius: 999, flexShrink: 0,
                              background: 'var(--baari-bone)', color: 'var(--baari-graphite)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 11, fontWeight: 700,
                            }}>
                              {(c.name ?? '?').slice(0, 1).toUpperCase()}
                            </span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--baari-onyx)', display: 'flex', alignItems: 'center', gap: 5 }}>
                                {c.name ?? 'Unknown'}
                                {c.isVip && <span style={{ fontSize: 10, fontWeight: 700, background: '#FFF3CD', color: '#92640A', borderRadius: 999, padding: '1px 5px' }}>VIP</span>}
                              </div>
                              <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginTop: 1 }}>
                                {formatDisplayPhone(c.phoneE164)}
                              </div>
                            </div>
                          </button>
                        ))}
                        <button
                          onMouseDown={switchToNew}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            width: '100%', padding: '10px 14px', background: 'transparent',
                            border: 0, cursor: 'pointer', fontFamily: 'inherit',
                            fontSize: 12, color: 'var(--fg-muted)',
                          }}
                          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--baari-cream)'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                        >
                          <Icon name="plus" size={12} stroke={2} /> Add as new client
                        </button>
                      </>
                    ) : clientQuery.trim().length >= 2 && !searchLoading ? (
                      <div style={{ padding: '10px 14px' }}>
                        <div style={{ fontSize: 13, color: 'var(--fg-muted)', marginBottom: 8 }}>No clients found</div>
                        <button
                          onMouseDown={switchToNew}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            padding: '8px 12px', background: 'var(--baari-bone)',
                            border: '1px solid var(--border-subtle)', borderRadius: 6,
                            cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, color: 'var(--baari-onyx)', fontWeight: 500,
                          }}
                        >
                          <Icon name="plus" size={13} stroke={2} /> Add new client
                        </button>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            )}
          </Field>

          {/* ── Staff ────────────────────────────────────────────────────── */}
          <Field label="Staff">
            {dataLoading ? <SkeletonField /> : (
              <FormSelect value={staffId} onChange={setStaffId}>
                {apiStaff.map(s => <option key={s.id} value={s.id}>{s.name} · {s.role}</option>)}
              </FormSelect>
            )}
          </Field>

          {/* ── Services ─────────────────────────────────────────────────── */}
          <Field label="Services">
            {dataLoading ? <SkeletonField /> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                {selectedServices.map((svc, i) => (
                  <div key={svc.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '9px 12px', background: 'var(--baari-bone)',
                    border: '1px solid var(--border-subtle)', borderRadius: 4,
                  }}>
                    <span style={{
                      width: 20, height: 20, borderRadius: 999, background: 'var(--baari-espresso)',
                      color: 'var(--baari-lime)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, fontWeight: 700, flexShrink: 0,
                    }}>{i + 1}</span>
                    <span style={{ flex: 1, fontSize: 13, color: 'var(--baari-onyx)', fontWeight: 500 }}>{svc.name}</span>
                    <span style={{ fontSize: 12, color: 'var(--fg-muted)', marginRight: 4 }}>
                      {svc.durationMin} min · {fmtPKR(svc.pricePaisa)}
                    </span>
                    <button onClick={() => removeService(i)} style={{
                      background: 'transparent', border: 0, cursor: 'pointer', padding: 2,
                      color: 'var(--fg-muted)', display: 'flex', alignItems: 'center',
                    }}>
                      <Icon name="close" size={13} stroke={2} />
                    </button>
                  </div>
                ))}

                {availableToAdd.length > 0 && selectedServiceIds.length < 10 && (
                  <div style={{ position: 'relative' }}>
                    <button
                      onClick={() => setAddingService(v => !v)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 7, padding: '8px 12px',
                        background: 'transparent', border: '1px dashed var(--border)',
                        borderRadius: 4, cursor: 'pointer', fontFamily: 'inherit',
                        fontSize: 13, color: 'var(--fg-muted)', width: '100%',
                      }}
                    >
                      <Icon name="plus" size={13} stroke={2} />
                      {selectedServiceIds.length === 0 ? 'Select a service' : 'Add another service'}
                    </button>
                    {addingService && (
                      <div style={{
                        position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
                        background: '#fff', border: '1px solid var(--border)',
                        borderRadius: 4, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                        maxHeight: 200, overflow: 'auto', marginTop: 2,
                      }}>
                        {availableToAdd.map(svc => (
                          <button key={svc.id} onClick={() => addService(svc.id)} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            width: '100%', padding: '10px 14px', background: 'transparent',
                            border: 0, borderBottom: '1px solid var(--border-subtle)',
                            cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                          }}
                          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--baari-cream)'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                          >
                            <span style={{ fontSize: 13, color: 'var(--baari-onyx)', fontWeight: 500 }}>{svc.name}</span>
                            <span style={{ fontSize: 12, color: 'var(--fg-muted)' }}>{svc.durationMin} min · {fmtPKR(svc.pricePaisa)}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </Field>

          {/* ── Date + slot ──────────────────────────────────────────────── */}
          <FormRow>
            <Field label="Date">
              <FormInput type="date" value={date} onChange={setDate} />
            </Field>
            <Field label="Time slot">
              {slotsLoading ? (
                <SkeletonField />
              ) : slots.length === 0 ? (
                <div style={{ padding: '10px 0', fontSize: 13, color: 'var(--fg-muted)', borderBottom: '1px solid var(--border)' }}>
                  {selectedServiceIds.length === 0 ? 'Pick a service first' : 'No slots available'}
                </div>
              ) : (
                <FormSelect value={String(selectedSlotIdx)} onChange={(v) => setSelectedSlotIdx(parseInt(v, 10))}>
                  {slots.map((s, i) => <option key={s.startHour} value={i}>{s.label}</option>)}
                </FormSelect>
              )}
            </Field>
          </FormRow>

          {/* ── Session summary ───────────────────────────────────────────── */}
          {selectedServices.length > 0 && selectedSlot && (
            <div style={{
              background: 'var(--baari-cream)', border: '1px solid var(--border-subtle)', borderRadius: 6, overflow: 'hidden',
            }}>
              {selectedServices.map((svc, i) => (
                <div key={svc.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 14px',
                  borderBottom: i < selectedServices.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                }}>
                  <span style={{ fontSize: 13, color: 'var(--fg-secondary)' }}>{svc.name} · {svc.durationMin} min</span>
                  <span style={{ fontSize: 13, color: 'var(--baari-graphite)', fontVariantNumeric: 'tabular-nums' }}>{fmtPKR(svc.pricePaisa)}</span>
                </div>
              ))}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                padding: '10px 14px', borderTop: '1px solid var(--border-subtle)',
                background: 'rgba(0,0,0,0.02)',
              }}>
                <span style={{ fontSize: 12, color: 'var(--fg-muted)' }}>
                  {selectedSlot.label} · {totalDurationMin} min total
                </span>
                <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--baari-onyx)', fontVariantNumeric: 'tabular-nums' }}>
                  {fmtPKR(totalPricePaisa)}
                </span>
              </div>
            </div>
          )}

          {/* ── Error ─────────────────────────────────────────────────────── */}
          {error && (
            <div style={{ padding: '10px 14px', background: '#FEF2F0', border: '1px solid #E8C4BC', borderRadius: 6, fontSize: 13, color: '#8A3528' }}>
              {error}
            </div>
          )}
        </div>

        {/* ── Footer ───────────────────────────────────────────────────────── */}
        <div style={{
          padding: '16px 24px', borderTop: '1px solid var(--border-subtle)',
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10,
          background: 'var(--baari-cream)',
        }}>
          <DButton variant="ghost" onClick={onClose} disabled={submitting}>Cancel</DButton>
          <DButton variant="primary" onClick={handleSubmit} disabled={!canSubmit}>
            {submitting ? 'Booking…' : 'Confirm booking'}
          </DButton>
        </div>
      </div>
    </div>
  );
}

// ─── Form primitives ──────────────────────────────────────────────────────────

function FormRow({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>{children}</div>;
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 11, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 500 }}>
        {label}{required && <span style={{ color: 'var(--baari-error)' }}> *</span>}
      </span>
      {children}
    </label>
  );
}

function FormInput({ value, onChange, onBlur, placeholder, type = 'text', disabled = false }: {
  value: string; onChange: (v: string) => void; onBlur?: () => void;
  placeholder?: string; type?: string; disabled?: boolean;
}) {
  return (
    <input
      type={type} value={value} placeholder={placeholder} disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      onFocus={(e) => { if (!disabled) e.target.style.borderBottomColor = 'var(--baari-onyx)'; }}
      onBlur={(e)  => { e.target.style.borderBottomColor = 'var(--border)'; onBlur?.(); }}
      style={{
        padding: '10px 0', background: 'transparent', border: 0,
        borderBottom: '1px solid var(--border)', fontFamily: 'inherit',
        fontSize: 14, color: 'var(--baari-onyx)', outline: 'none',
        opacity: disabled ? 0.5 : 1, cursor: disabled ? 'not-allowed' : 'text',
      }}
    />
  );
}

function FormSelect({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        padding: '10px 0', background: 'transparent', border: 0,
        borderBottom: '1px solid var(--border)', fontFamily: 'inherit',
        fontSize: 14, color: 'var(--baari-onyx)', outline: 'none',
        appearance: 'none',
        backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238A8275' stroke-width='1.5'><polyline points='6 9 12 15 18 9'/></svg>")`,
        backgroundRepeat: 'no-repeat', backgroundPosition: 'right 4px center', paddingRight: 24,
      }}
    >
      {children}
    </select>
  );
}

function SkeletonField() {
  return (
    <div style={{
      height: 20, marginTop: 10, borderRadius: 3,
      background: 'linear-gradient(90deg, #f0ede8 25%, #e8e4dd 50%, #f0ede8 75%)',
      backgroundSize: '200% 100%', animation: 'baari-shimmer 1.5s infinite',
    }} />
  );
}
