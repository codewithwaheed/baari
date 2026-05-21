'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { IconButton, DButton, Eyebrow, Icon } from './primitives';

const API = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ApiStaff   { id: string; name: string; role: string; }
interface ApiService { id: string; name: string; category: string | null; durationMin: number; pricePaisa: number; }
interface ApiCustomer { id: string; name: string | null; phoneE164: string; notes: string; isVip: boolean; }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isoDate(d: Date): string {
  const yr = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const dy = String(d.getDate()).padStart(2, '0');
  return `${yr}-${mo}-${dy}`;
}

/** decimal hour + date string → ISO datetime string at Asia/Karachi (+05:00) */
function toISO(dateStr: string, decimalHour: number): string {
  const h = Math.floor(decimalHour);
  const m = Math.round((decimalHour - h) * 60);
  return `${dateStr}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00+05:00`;
}

function fmtSlot(h: number): string {
  const period = h >= 12 ? 'pm' : 'am';
  const hr = Math.floor(h);
  const m = Math.round((h - hr) * 60);
  const display = hr > 12 ? hr - 12 : hr === 0 ? 12 : hr;
  return m ? `${display}:${String(m).padStart(2, '0')}${period}` : `${display}${period}`;
}

/** Normalise Pakistani phone to E.164 on the client side before API call */
function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('03') && digits.length === 11) return '+92' + digits.slice(1);
  if (digits.startsWith('92') && digits.length === 12) return '+' + digits;
  if (raw.trimStart().startsWith('+')) return '+' + digits;
  return raw.trim();
}

const TIME_SLOTS: number[] = [];
for (let h = 8; h < 20; h += 0.5) TIME_SLOTS.push(h);

// ─── Component ────────────────────────────────────────────────────────────────

interface NewBookingModalProps {
  open: boolean;
  defaultDate?: Date;
  onClose: () => void;
  onSuccess: () => void;
}

export function NewBookingModal({ open, defaultDate, onClose, onSuccess }: NewBookingModalProps) {
  // ── API data ────────────────────────────────────────────────────────────────
  const [apiStaff,    setApiStaff]    = useState<ApiStaff[]>([]);
  const [apiServices, setApiServices] = useState<ApiService[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  // ── Form state ──────────────────────────────────────────────────────────────
  const [phone,     setPhone]     = useState('');
  const [name,      setName]      = useState('');
  const [serviceId, setServiceId] = useState('');
  const [staffId,   setStaffId]   = useState('');
  const [date,      setDate]      = useState(() => isoDate(defaultDate ?? new Date()));
  const [slot,      setSlot]      = useState(11.0);
  const [sendLink,  setSendLink]  = useState(false);

  // ── Client lookup state ─────────────────────────────────────────────────────
  const [customerId,     setCustomerId]     = useState<string | null>(null);
  const [clientStatus,   setClientStatus]   = useState<'idle' | 'loading' | 'found' | 'new'>('idle');
  const lookupRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Submission state ────────────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  // ── Load staff + services when modal opens ──────────────────────────────────
  useEffect(() => {
    if (!open) return;
    setDataLoading(true);
    // Reset form when reopened
    setPhone(''); setName(''); setCustomerId(null); setClientStatus('idle');
    setError(null);
    setDate(isoDate(defaultDate ?? new Date()));
    setSlot(11.0); setSendLink(false);

    Promise.all([
      fetch(`${API}/api/v1/staff`,    { credentials: 'include' }).then(r => r.json()),
      fetch(`${API}/api/v1/services`, { credentials: 'include' }).then(r => r.json()),
    ])
      .then(([staffRes, svcRes]) => {
        const staff: ApiStaff[]     = staffRes.ok  ? staffRes.data  : [];
        const svcs:  ApiService[]   = svcRes.ok    ? svcRes.data    : [];
        setApiStaff(staff);
        setApiServices(svcs);
        if (staff.length > 0) setStaffId(staff[0]!.id);
        if (svcs.length > 0)  setServiceId(svcs[0]!.id);
      })
      .catch(() => null)
      .finally(() => setDataLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ── Client phone lookup ─────────────────────────────────────────────────────
  const lookupClient = useCallback(async (rawPhone: string) => {
    const e164 = normalizePhone(rawPhone);
    if (e164.length < 7) { setClientStatus('idle'); setCustomerId(null); return; }

    setClientStatus('loading');
    try {
      const res = await fetch(`${API}/api/v1/customers?phone=${encodeURIComponent(e164)}`, { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        if (json.ok && json.data) {
          const c = json.data as ApiCustomer;
          setName(c.name ?? '');
          setCustomerId(c.id);
          setClientStatus('found');
          return;
        }
      }
      // 404 or error — new client
      setCustomerId(null);
      setClientStatus('new');
    } catch {
      setCustomerId(null);
      setClientStatus('new');
    }
  }, []);

  const handlePhoneChange = (v: string) => {
    setPhone(v);
    setCustomerId(null);
    setClientStatus('idle');
    setName('');
    if (lookupRef.current) clearTimeout(lookupRef.current);
    if (v.replace(/\D/g, '').length >= 7) {
      lookupRef.current = setTimeout(() => lookupClient(v), 400);
    }
  };

  const handlePhoneBlur = () => {
    if (lookupRef.current) { clearTimeout(lookupRef.current); lookupRef.current = null; }
    if (phone.replace(/\D/g, '').length >= 7 && clientStatus === 'idle') {
      lookupClient(phone);
    }
  };

  // ── Submission ──────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!phone.trim() || !name.trim() || !serviceId || !staffId) return;
    setSubmitting(true);
    setError(null);

    try {
      // Step 1: find or create customer
      let cId = customerId;
      if (!cId) {
        const custRes = await fetch(`${API}/api/v1/customers`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: normalizePhone(phone), name: name.trim() }),
        });
        const custJson = await custRes.json();
        if (!custJson.ok) {
          setError('Could not save client. Please try again.');
          setSubmitting(false);
          return;
        }
        cId = (custJson.data as ApiCustomer).id;
      }

      // Step 2: resolve service duration for endTime
      const svc = apiServices.find(s => s.id === serviceId);
      const durationHours = (svc?.durationMin ?? 60) / 60;
      const startHour = slot;
      const endHour   = parseFloat((startHour + durationHours).toFixed(4));

      // Step 3: create booking
      const bookingRes = await fetch(`${API}/api/v1/bookings`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffId,
          serviceId,
          customerId: cId,
          startTime:  toISO(date, startHour),
          endTime:    toISO(date, endHour),
          pricePaisa: svc?.pricePaisa ?? 0,
          source:     'manual',
          notes:      '',
        }),
      });

      const bookingJson = await bookingRes.json();
      if (!bookingJson.ok) {
        if (bookingJson.error?.code === 'SLOT_UNAVAILABLE') {
          setError('That slot just got taken. Please choose a different time.');
        } else {
          setError(bookingJson.error?.message ?? 'Booking failed. Please try again.');
        }
        setSubmitting(false);
        return;
      }

      // TODO Phase 9: if sendLink is on, trigger WhatsApp payment link
      onSuccess();
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  const selectedSvc = apiServices.find(s => s.id === serviceId);
  const canSubmit   = phone.trim().length >= 6 && name.trim().length > 0 && serviceId && staffId && !submitting;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15,12,8,0.55)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 150, fontFamily: 'var(--font-body)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 560, maxWidth: '92vw', maxHeight: '90vh',
          background: '#fff', borderRadius: 12,
          boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <Eyebrow>New booking</Eyebrow>
            <div style={{
              fontFamily: 'var(--font-display)', fontSize: 26, letterSpacing: '-0.01em',
              color: 'var(--baari-onyx)', lineHeight: 1.1, marginTop: 4,
            }}>Book a <strong>client</strong></div>
          </div>
          <IconButton name="close" onClick={onClose} />
        </div>

        {/* Form */}
        <div style={{ padding: '20px 24px', overflow: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {dataLoading && (
            <div style={{ padding: '12px 0', color: 'var(--fg-muted)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: '50%', border: '2px solid var(--border)', borderTopColor: 'var(--baari-onyx)', animation: 'spin 0.7s linear infinite' }} />
              Loading services…
            </div>
          )}

          {/* Phone + name row */}
          <FormRow>
            <Field label="Client phone" required>
              <div style={{ position: 'relative' }}>
                <FormInput
                  value={phone}
                  onChange={handlePhoneChange}
                  onBlur={handlePhoneBlur}
                  placeholder="0300 1234 567"
                  type="tel"
                />
                {/* Lookup indicator */}
                {clientStatus === 'loading' && (
                  <span style={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--fg-muted)' }}>
                    looking up…
                  </span>
                )}
              </div>
              {clientStatus === 'found' && (
                <span style={{ fontSize: 11, color: '#3A6E47', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                  <Icon name="check" size={11} color="#3A6E47" stroke={2.5} /> Existing client
                </span>
              )}
              {clientStatus === 'new' && (
                <span style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 2 }}>
                  New client — will be created
                </span>
              )}
            </Field>
            <Field label="Client name" required>
              <FormInput
                value={name}
                onChange={(v) => { setName(v); if (clientStatus === 'found') setClientStatus('new'); }}
                placeholder="Aiman Saeed"
                disabled={clientStatus === 'found'}
              />
            </Field>
          </FormRow>

          <Field label="Service">
            {dataLoading ? (
              <SkeletonField />
            ) : (
              <FormSelect value={serviceId} onChange={setServiceId}>
                {apiServices.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} — PKR {(s.pricePaisa / 100).toLocaleString()} · {s.durationMin} min
                  </option>
                ))}
              </FormSelect>
            )}
          </Field>

          <Field label="Staff">
            {dataLoading ? (
              <SkeletonField />
            ) : (
              <FormSelect value={staffId} onChange={setStaffId}>
                {apiStaff.map(s => (
                  <option key={s.id} value={s.id}>{s.name} · {s.role}</option>
                ))}
              </FormSelect>
            )}
          </Field>

          <FormRow>
            <Field label="Date">
              <FormInput type="date" value={date} onChange={setDate} />
            </Field>
            <Field label="Time slot">
              <FormSelect value={String(slot)} onChange={(v) => setSlot(parseFloat(v))}>
                {TIME_SLOTS.map(h => (
                  <option key={h} value={h}>{fmtSlot(h)}</option>
                ))}
              </FormSelect>
            </Field>
          </FormRow>

          {/* Price summary */}
          {selectedSvc && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 14px', background: 'var(--baari-cream)', borderRadius: 6,
              border: '1px solid var(--border-subtle)',
            }}>
              <span style={{ fontSize: 13, color: 'var(--fg-secondary)' }}>
                {selectedSvc.name} · {selectedSvc.durationMin} min · {fmtSlot(slot)}–{fmtSlot(slot + selectedSvc.durationMin / 60)}
              </span>
              <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--baari-onyx)', fontVariantNumeric: 'tabular-nums' }}>
                PKR {(selectedSvc.pricePaisa / 100).toLocaleString()}
              </span>
            </div>
          )}

          {/* WhatsApp payment link toggle */}
          <button onClick={() => setSendLink(!sendLink)} style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
            background: sendLink ? 'rgba(37,211,102,0.07)' : 'var(--baari-cream)',
            border: '1px solid ' + (sendLink ? '#7BC698' : 'var(--border-subtle)'),
            borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
          }}>
            <span style={{
              width: 32, height: 32, borderRadius: 999,
              background: sendLink ? '#25D366' : 'var(--baari-bone)',
              color: sendLink ? '#fff' : 'var(--fg-muted)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Icon name="whatsapp" size={16} fill={sendLink ? '#fff' : undefined} color={sendLink ? 'none' : 'var(--fg-muted)'} />
            </span>
            <span style={{ flex: 1 }}>
              <span style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--baari-onyx)' }}>
                Send payment link via WhatsApp
              </span>
              <span style={{ display: 'block', fontSize: 11, color: 'var(--fg-muted)', marginTop: 2 }}>
                Client confirms booking by paying. Auto-confirms on payment.
              </span>
            </span>
            <span style={{
              width: 36, height: 22, borderRadius: 999, flexShrink: 0, position: 'relative',
              background: sendLink ? 'var(--baari-onyx)' : 'var(--baari-sand)',
              transition: 'background 150ms ease',
            }}>
              <span style={{
                position: 'absolute', top: 2, left: sendLink ? 16 : 2,
                width: 18, height: 18, borderRadius: 999, background: '#fff',
                transition: 'left 150ms ease',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }} />
            </span>
          </button>

          {/* Error */}
          {error && (
            <div style={{
              padding: '10px 14px', background: '#FEF2F0',
              border: '1px solid #E8C4BC', borderRadius: 6,
              fontSize: 13, color: '#8A3528',
            }}>
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px', borderTop: '1px solid var(--border-subtle)',
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10,
          background: 'var(--baari-cream)',
        }}>
          <DButton variant="ghost" onClick={onClose} disabled={submitting}>Cancel</DButton>
          <DButton
            variant="primary"
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
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

function FormInput({
  value, onChange, onBlur, placeholder, type = 'text', disabled = false,
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <input
      type={type} value={value} placeholder={placeholder} disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      onFocus={(e) => { if (!disabled) e.target.style.borderBottomColor = 'var(--baari-onyx)'; }}
      onBlur={(e)  => { e.target.style.borderBottomColor = 'var(--border)'; onBlur?.(); }}
      style={{
        padding: '10px 0', background: 'transparent',
        border: 0, borderBottom: '1px solid var(--border)',
        fontFamily: 'inherit', fontSize: 14, color: 'var(--baari-onyx)', outline: 'none',
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
        padding: '10px 0', background: 'transparent',
        border: 0, borderBottom: '1px solid var(--border)',
        fontFamily: 'inherit', fontSize: 14, color: 'var(--baari-onyx)',
        outline: 'none', appearance: 'none',
        backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238A8275' stroke-width='1.5'><polyline points='6 9 12 15 18 9'/></svg>")`,
        backgroundRepeat: 'no-repeat', backgroundPosition: 'right 4px center',
        paddingRight: 24,
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
