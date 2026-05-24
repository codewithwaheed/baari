'use client';

// apps/web/src/app/book/[slug]/BookingFlow.tsx
// 4-step public booking wizard:
//   Step 1 — Service selection
//   Step 2 — Staff selection (first pre-selected)
//   Step 3 — Date & Time (combined)
//   Step 4 — Your details + submit

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';

// ── Types ─────────────────────────────────────────────────────────────────────

interface PublicService {
  id: string;
  name: string;
  category: string | null;
  durationMin: number;
  pricePaisa: number;
}

interface PublicStaff {
  id: string;
  name: string;
  role: string;
  avatarUrl: string | null;
}

interface TimeSlot {
  startHour: number;
  endHour: number;
  label: string;
}

// ── Formatters ────────────────────────────────────────────────────────────────

function fmtPKR(paisa: number): string {
  return `PKR ${(paisa / 100).toLocaleString()}`;
}

function fmtDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00+05:00');
  return d.toLocaleDateString('en-PK', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Karachi' });
}

// ── Mini calendar ─────────────────────────────────────────────────────────────

function MiniCalendar({ selected, onSelect }: { selected: string | null; onSelect: (iso: string) => void }) {
  const today = new Date();
  const todayISO = today.toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });

  const [viewYear, setViewYear]   = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-based

  const firstDay  = new Date(viewYear, viewMonth, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const monthName = new Date(viewYear, viewMonth).toLocaleDateString('en-PK', { month: 'long', year: 'numeric' });

  function toISO(day: number): string {
    return `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  function isPast(day: number): boolean {
    return toISO(day) < todayISO;
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  }

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  // Pad to complete last week
  while (cells.length % 7 !== 0) cells.push(null);

  const canGoPrev = !(viewYear === today.getFullYear() && viewMonth === today.getMonth());

  return (
    <div style={{ background: '#fff', border: '1px solid var(--baari-sand)', borderRadius: 4, padding: 14, userSelect: 'none' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <button
          onClick={prevMonth}
          disabled={!canGoPrev}
          style={{
            border: 'none', background: 'none', padding: '4px 8px', cursor: canGoPrev ? 'pointer' : 'default',
            color: canGoPrev ? 'var(--baari-onyx)' : 'var(--baari-sand)', fontSize: 16, borderRadius: 2,
          }}
        >‹</button>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--baari-onyx)' }}>{monthName}</span>
        <button
          onClick={nextMonth}
          style={{ border: 'none', background: 'none', padding: '4px 8px', cursor: 'pointer', color: 'var(--baari-onyx)', fontSize: 16, borderRadius: 2 }}
        >›</button>
      </div>

      {/* Day labels */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', marginBottom: 6 }}>
        {['S','M','T','W','T','F','S'].map((d, i) => (
          <div key={i} style={{ fontSize: 10, color: 'var(--baari-stone)', paddingBottom: 4, fontWeight: 600 }}>{d}</div>
        ))}
      </div>

      {/* Days */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, textAlign: 'center' }}>
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const iso  = toISO(day);
          const past = isPast(day);
          const isToday    = iso === todayISO;
          const isSelected = iso === selected;

          return (
            <button
              key={i}
              onClick={() => !past && onSelect(iso)}
              disabled={past}
              style={{
                border: 'none',
                borderRadius: 3,
                padding: '6px 2px',
                fontSize: 12,
                cursor: past ? 'default' : 'pointer',
                background: isSelected ? 'var(--baari-onyx)' : isToday ? 'var(--baari-lime)' : 'transparent',
                color: isSelected ? '#fff' : past ? 'var(--baari-sand)' : 'var(--baari-onyx)',
                fontWeight: isSelected || isToday ? 700 : 400,
                transition: 'background .1s',
              }}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Progress bar ──────────────────────────────────────────────────────────────

const STEPS = ['Service', 'Staff', 'Date & Time', 'Details'];

function ProgressBar({ step }: { step: number }) {
  return (
    <div style={{ display: 'flex', background: '#111' }}>
      {STEPS.map((label, i) => {
        const done    = i + 1 < step;
        const current = i + 1 === step;
        return (
          <div
            key={label}
            style={{
              flex: 1, padding: '7px 4px', textAlign: 'center',
              fontSize: 9, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase',
              color: current ? 'var(--baari-lime)' : done ? 'rgba(255,255,255,.45)' : 'rgba(255,255,255,.25)',
              borderBottom: current ? '2px solid var(--baari-lime)' : '2px solid transparent',
              transition: 'color .15s',
            }}
          >
            {done ? `✓ ${label}` : label}
          </div>
        );
      })}
    </div>
  );
}

// ── Bottom action bar ─────────────────────────────────────────────────────────

function ActionBar({
  step, onBack, onNext, nextLabel, nextDisabled, loading,
}: {
  step: number;
  onBack: () => void;
  onNext: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  loading?: boolean;
}) {
  return (
    <div style={{
      padding: '12px 16px',
      borderTop: '1px solid var(--baari-bone)',
      background: '#fff',
      display: 'flex',
      gap: 8,
      position: 'sticky',
      bottom: 0,
    }}>
      {step > 1 && (
        <button
          onClick={onBack}
          style={{
            flex: '0 0 80px',
            padding: '10px 0',
            border: '1px solid var(--baari-sand)',
            borderRadius: 3,
            background: 'transparent',
            color: 'var(--baari-graphite)',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          ← Back
        </button>
      )}
      <button
        onClick={onNext}
        disabled={nextDisabled || loading}
        style={{
          flex: 1,
          padding: '10px 0',
          border: 'none',
          borderRadius: 3,
          background: nextDisabled || loading ? 'var(--baari-sand)' : 'var(--baari-onyx)',
          color: nextDisabled || loading ? 'var(--baari-stone)' : 'var(--baari-lime)',
          fontSize: 13,
          fontWeight: 700,
          cursor: nextDisabled || loading ? 'not-allowed' : 'pointer',
          transition: 'background .15s',
          letterSpacing: '.03em',
        }}
      >
        {loading ? 'Sending…' : (nextLabel ?? 'Next →')}
      </button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function BookingFlow({ slug }: { slug: string }) {
  const router = useRouter();

  // ── State ─────────────────────────────────────────────────────────────────
  const [step, setStep] = useState(1);

  // Data fetched from API
  const [services, setServices]       = useState<PublicService[]>([]);
  const [staffList, setStaffList]     = useState<PublicStaff[]>([]);
  const [slots, setSlots]             = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [noSlots, setNoSlots]         = useState(false);

  // Selections
  const [selectedService, setSelectedService] = useState<PublicService | null>(null);
  const [selectedStaff,   setSelectedStaff]   = useState<PublicStaff | null>(null);
  const [selectedDate,    setSelectedDate]     = useState<string | null>(null); // YYYY-MM-DD
  const [selectedSlot,    setSelectedSlot]     = useState<TimeSlot | null>(null);

  // Customer details
  const [custName,  setCustName]  = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [submitErr, setSubmitErr] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // ── Fetch services on mount ───────────────────────────────────────────────
  useEffect(() => {
    fetch(`${API}/api/v1/public/salon/${encodeURIComponent(slug)}/services`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.ok) setServices(data.data); })
      .catch(() => null);
  }, [slug]);

  // ── Fetch staff when step 2 activates ────────────────────────────────────
  useEffect(() => {
    if (step !== 2 || staffList.length > 0) return;
    fetch(`${API}/api/v1/public/salon/${encodeURIComponent(slug)}/staff`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.ok && Array.isArray(data.data) && data.data.length > 0) {
          setStaffList(data.data);
          setSelectedStaff(prev => prev ?? data.data[0]); // pre-select first
        }
      })
      .catch(() => null);
  }, [step, slug, staffList.length]);

  // ── Fetch slots when date or staff changes on step 3 ─────────────────────
  const fetchSlots = useCallback(async (date: string, staff: PublicStaff, service: PublicService) => {
    setLoadingSlots(true);
    setSlots([]);
    setNoSlots(false);
    setSelectedSlot(null);
    try {
      const url = `${API}/api/v1/public/salon/${encodeURIComponent(slug)}/availability` +
        `?staffId=${encodeURIComponent(staff.id)}&date=${date}&serviceDurationMin=${service.durationMin}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('fetch failed');
      const data = await res.json();
      if (data.ok && Array.isArray(data.data)) {
        setSlots(data.data);
        setNoSlots(data.data.length === 0);
      }
    } catch {
      setNoSlots(true);
    } finally {
      setLoadingSlots(false);
    }
  }, [slug]);

  function handleDateSelect(iso: string) {
    setSelectedDate(iso);
    if (selectedStaff && selectedService) {
      fetchSlots(iso, selectedStaff, selectedService);
    }
  }

  function handleStaffSwitchInStep3(s: PublicStaff) {
    setSelectedStaff(s);
    setSelectedSlot(null);
    if (selectedDate && selectedService) {
      fetchSlots(selectedDate, s, selectedService);
    }
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!selectedService || !selectedStaff || !selectedDate || !selectedSlot) return;
    if (!custName.trim() || !custPhone.trim()) return;

    setSubmitting(true);
    setSubmitErr('');

    // Build requestedAt: date + slot startHour → +05:00 ISO string
    const h = Math.floor(selectedSlot.startHour);
    const m = Math.round((selectedSlot.startHour - h) * 60);
    const requestedAt = `${selectedDate}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00+05:00`;

    try {
      const res = await fetch(`${API}/api/v1/public/salon/${encodeURIComponent(slug)}/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId:     selectedService.id,
          staffId:       selectedStaff.id,
          requestedAt,
          customerName:  custName.trim(),
          customerPhone: custPhone.trim(),
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        const msg = json?.error?.code === 'INVALID_PHONE'
          ? 'Please enter a valid Pakistani phone number (e.g. 0312 3456789).'
          : json?.error?.message ?? 'Something went wrong. Please try again.';
        setSubmitErr(msg);
        return;
      }

      // Redirect to success page, passing booking summary in search params
      const params = new URLSearchParams({
        service: selectedService.name,
        staff:   selectedStaff.name,
        date:    fmtDate(selectedDate),
        time:    selectedSlot.label,
        price:   String(selectedService.pricePaisa),
        phone:   custPhone.trim(),
      });
      router.push(`/book/${encodeURIComponent(slug)}/success?${params.toString()}`);
    } catch {
      setSubmitErr('Network error — please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Group services by category ────────────────────────────────────────────
  const grouped: Record<string, PublicService[]> = {};
  for (const s of services) {
    const cat = s.category ?? 'Other';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat]!.push(s);
  }

  const hasCategories = Object.keys(grouped).length > 1 || services.length > 6;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{
      background: '#fff',
      border: '1px solid var(--baari-sand)',
      borderRadius: 6,
      overflow: 'hidden',
      boxShadow: '0 2px 12px rgba(0,0,0,.06)',
    }}>
      <ProgressBar step={step} />

      {/* ── Step 1: Service ──────────────────────────────────────────────── */}
      {step === 1 && (
        <>
          <div style={{ padding: '20px 16px 8px' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--baari-stone)', textTransform: 'uppercase', letterSpacing: '.06em', margin: '0 0 14px' }}>
              Choose a service
            </p>

            {services.length === 0 ? (
              <ServiceSkeletons />
            ) : hasCategories ? (
              Object.entries(grouped).map(([cat, svcs]) => (
                <div key={cat} style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--baari-stone)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 8 }}>
                    {cat}
                  </div>
                  <ServiceGrid services={svcs} selected={selectedService} onSelect={setSelectedService} />
                </div>
              ))
            ) : (
              <ServiceGrid services={services} selected={selectedService} onSelect={setSelectedService} />
            )}
          </div>

          <ActionBar
            step={1} onBack={() => {}} onNext={() => setStep(2)}
            nextDisabled={!selectedService}
          />
        </>
      )}

      {/* ── Step 2: Staff ───────────────────────────────────────────────── */}
      {step === 2 && (
        <>
          <div style={{ padding: '20px 16px 8px' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--baari-stone)', textTransform: 'uppercase', letterSpacing: '.06em', margin: '0 0 6px' }}>
              Choose your barber
            </p>
            <p style={{ fontSize: 12, color: 'var(--baari-stone)', margin: '0 0 14px' }}>
              {selectedService?.name} · {fmtPKR(selectedService?.pricePaisa ?? 0)}
            </p>

            {staffList.length === 0 ? (
              <StaffSkeletons />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {staffList.map(s => {
                  const active = selectedStaff?.id === s.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => setSelectedStaff(s)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '11px 14px',
                        border: active ? '2px solid var(--baari-onyx)' : '1px solid var(--baari-sand)',
                        borderRadius: 4,
                        background: active ? 'var(--baari-bone)' : '#fff',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'border-color .1s, background .1s',
                        width: '100%',
                      }}
                    >
                      <StaffAvatar name={s.name} avatarUrl={s.avatarUrl} size={36} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--baari-onyx)' }}>{s.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--baari-stone)', marginTop: 1 }}>{s.role}</div>
                      </div>
                      {active && (
                        <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'var(--baari-onyx)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
                            <polyline points="2,6 5,9 10,3" stroke="#E8FF47" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <ActionBar
            step={2} onBack={() => setStep(1)} onNext={() => setStep(3)}
            nextDisabled={!selectedStaff}
          />
        </>
      )}

      {/* ── Step 3: Date & Time ─────────────────────────────────────────── */}
      {step === 3 && selectedStaff && selectedService && (
        <>
          <div style={{ padding: '20px 16px 8px' }}>
            {/* Staff switcher — allow changing barber without going back */}
            <div style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--baari-stone)', textTransform: 'uppercase', letterSpacing: '.06em', margin: '0 0 8px' }}>
                Barber
              </p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {staffList.map(s => {
                  const active = selectedStaff.id === s.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => handleStaffSwitchInStep3(s)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 7,
                        padding: '5px 10px',
                        border: active ? '2px solid var(--baari-onyx)' : '1px solid var(--baari-sand)',
                        borderRadius: 20,
                        background: active ? 'var(--baari-onyx)' : '#fff',
                        color: active ? '#fff' : 'var(--baari-graphite)',
                        cursor: 'pointer',
                        fontSize: 12,
                        fontWeight: active ? 700 : 400,
                      }}
                    >
                      <StaffAvatar name={s.name} avatarUrl={s.avatarUrl} size={20} />
                      {s.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Date picker */}
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--baari-stone)', textTransform: 'uppercase', letterSpacing: '.06em', margin: '0 0 8px' }}>
              Pick a date
            </p>
            <MiniCalendar selected={selectedDate} onSelect={handleDateSelect} />

            {/* Time slots */}
            {selectedDate && (
              <div style={{ marginTop: 16 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--baari-stone)', textTransform: 'uppercase', letterSpacing: '.06em', margin: '0 0 8px' }}>
                  Available times — {fmtDate(selectedDate)}
                </p>

                {loadingSlots ? (
                  <SlotSkeletons />
                ) : noSlots ? (
                  <p style={{ fontSize: 12, color: 'var(--baari-stone)', padding: '12px 0' }}>
                    No times available — try another day.
                  </p>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                    {slots.map(slot => {
                      const active = selectedSlot?.startHour === slot.startHour;
                      return (
                        <button
                          key={slot.startHour}
                          onClick={() => setSelectedSlot(slot)}
                          style={{
                            padding: '9px 4px',
                            border: active ? '2px solid var(--baari-onyx)' : '1px solid var(--baari-sand)',
                            borderRadius: 4,
                            background: active ? 'var(--baari-onyx)' : '#fff',
                            color: active ? 'var(--baari-lime)' : 'var(--baari-onyx)',
                            fontSize: 12,
                            fontWeight: active ? 700 : 400,
                            cursor: 'pointer',
                            transition: 'background .1s',
                          }}
                        >
                          {slot.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          <ActionBar
            step={3} onBack={() => setStep(2)} onNext={() => setStep(4)}
            nextDisabled={!selectedDate || !selectedSlot}
          />
        </>
      )}

      {/* ── Step 4: Your details ────────────────────────────────────────── */}
      {step === 4 && selectedService && selectedStaff && selectedDate && selectedSlot && (
        <>
          <div style={{ padding: '20px 16px 8px' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--baari-stone)', textTransform: 'uppercase', letterSpacing: '.06em', margin: '0 0 14px' }}>
              Your details
            </p>

            {/* Fields */}
            <label style={{ display: 'block', marginBottom: 12 }}>
              <span style={{ fontSize: 12, color: 'var(--baari-graphite)', display: 'block', marginBottom: 5 }}>Your name</span>
              <input
                type="text"
                value={custName}
                onChange={e => setCustName(e.target.value)}
                placeholder="Ali Hassan"
                autoComplete="name"
                style={{
                  width: '100%', padding: '10px 12px',
                  border: '1px solid var(--baari-sand)', borderRadius: 3,
                  fontSize: 14, color: 'var(--baari-onyx)', background: '#fff',
                  outline: 'none', boxSizing: 'border-box',
                }}
              />
            </label>

            <label style={{ display: 'block', marginBottom: 16 }}>
              <span style={{ fontSize: 12, color: 'var(--baari-graphite)', display: 'block', marginBottom: 5 }}>Phone number</span>
              <input
                type="tel"
                value={custPhone}
                onChange={e => setCustPhone(e.target.value)}
                placeholder="0312 3456789"
                autoComplete="tel"
                inputMode="numeric"
                style={{
                  width: '100%', padding: '10px 12px',
                  border: '1px solid var(--baari-sand)', borderRadius: 3,
                  fontSize: 14, color: 'var(--baari-onyx)', background: '#fff',
                  outline: 'none', boxSizing: 'border-box',
                }}
              />
            </label>

            {/* Booking summary */}
            <div style={{
              padding: '12px 14px',
              background: 'var(--baari-bone)',
              border: '1px solid var(--baari-sand)',
              borderRadius: 4,
              marginBottom: 4,
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--baari-stone)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 8 }}>
                Booking summary
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--baari-onyx)' }}>{selectedService.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--baari-graphite)', marginTop: 2 }}>with {selectedStaff.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--baari-graphite)', marginTop: 2 }}>
                    {fmtDate(selectedDate)} · {selectedSlot.label} · {selectedService.durationMin} min
                  </div>
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--baari-onyx)', whiteSpace: 'nowrap', marginLeft: 12 }}>
                  {fmtPKR(selectedService.pricePaisa)}
                </div>
              </div>
            </div>

            {/* Error message */}
            {submitErr && (
              <p style={{ fontSize: 12, color: '#b5483a', margin: '10px 0 0', lineHeight: 1.5 }}>
                {submitErr}
              </p>
            )}
          </div>

          <ActionBar
            step={4}
            onBack={() => setStep(3)}
            onNext={handleSubmit}
            nextLabel="Send Request"
            nextDisabled={!custName.trim() || !custPhone.trim()}
            loading={submitting}
          />
        </>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ServiceGrid({ services, selected, onSelect }: {
  services: PublicService[];
  selected: PublicService | null;
  onSelect: (s: PublicService) => void;
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
      {services.map(s => {
        const active = selected?.id === s.id;
        return (
          <button
            key={s.id}
            onClick={() => onSelect(s)}
            style={{
              padding: '12px', textAlign: 'left',
              border: active ? '2px solid var(--baari-onyx)' : '1px solid var(--baari-sand)',
              borderRadius: 4,
              background: active ? 'var(--baari-bone)' : '#fff',
              cursor: 'pointer',
              transition: 'border-color .1s, background .1s',
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--baari-onyx)', marginBottom: 3 }}>{s.name}</div>
            <div style={{ fontSize: 11, color: 'var(--baari-stone)' }}>{s.durationMin} min</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--baari-onyx)', marginTop: 6 }}>
              {fmtPKR(s.pricePaisa)}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function StaffAvatar({ name, avatarUrl, size }: { name: string; avatarUrl: string | null; size: number }) {
  const initial = name.charAt(0).toUpperCase();
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl} alt={name}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
      />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'var(--baari-sand)', color: 'var(--baari-espresso)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.4, fontWeight: 700, flexShrink: 0,
    }}>
      {initial}
    </div>
  );
}

// ── Skeleton loaders ──────────────────────────────────────────────────────────

const shimmer = {
  background: 'linear-gradient(90deg, var(--baari-bone) 25%, var(--baari-sand) 50%, var(--baari-bone) 75%)',
  backgroundSize: '200% 100%',
  animation: 'shimmer 1.4s infinite',
  borderRadius: 4,
};

function ServiceSkeletons() {
  return (
    <>
      <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
        {[1,2,3,4].map(i => (
          <div key={i} style={{ ...shimmer, height: 72, borderRadius: 4 }} />
        ))}
      </div>
    </>
  );
}

function StaffSkeletons() {
  return (
    <>
      <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[1,2,3].map(i => (
          <div key={i} style={{ ...shimmer, height: 58, borderRadius: 4 }} />
        ))}
      </div>
    </>
  );
}

function SlotSkeletons() {
  return (
    <>
      <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
        {[1,2,3,4,5,6].map(i => (
          <div key={i} style={{ ...shimmer, height: 36, borderRadius: 4 }} />
        ))}
      </div>
    </>
  );
}
