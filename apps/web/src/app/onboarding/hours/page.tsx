'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';

interface Break {
  id: string;
  from: string;
  to: string;
}

interface DayHours {
  day: number;
  label: string;
  short: string;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
  breaks: Break[];
}

const DEFAULT_HOURS: DayHours[] = [
  { day: 1, label: 'Monday',    short: 'Mon', isOpen: true, openTime: '09:00', closeTime: '21:00', breaks: [] },
  { day: 2, label: 'Tuesday',   short: 'Tue', isOpen: true, openTime: '09:00', closeTime: '21:00', breaks: [] },
  { day: 3, label: 'Wednesday', short: 'Wed', isOpen: true, openTime: '09:00', closeTime: '21:00', breaks: [] },
  { day: 4, label: 'Thursday',  short: 'Thu', isOpen: true, openTime: '09:00', closeTime: '21:00', breaks: [] },
  { day: 5, label: 'Friday',    short: 'Fri', isOpen: true, openTime: '09:00', closeTime: '21:00', breaks: [] },
  { day: 6, label: 'Saturday',  short: 'Sat', isOpen: true, openTime: '09:00', closeTime: '21:00', breaks: [] },
  { day: 0, label: 'Sunday',    short: 'Sun', isOpen: true, openTime: '09:00', closeTime: '21:00', breaks: [] },
];

function uid() { return Math.random().toString(36).slice(2); }

const timeInput: React.CSSProperties = {
  padding: '7px 9px',
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  fontSize: 'var(--fs-caption)',
  fontFamily: 'var(--font-body)',
  color: 'var(--fg)',
  outline: 'none',
  minWidth: 84,
};

export default function OnboardingHoursPage() {
  const router  = useRouter();
  const [hours,   setHours]   = useState<DayHours[]>(DEFAULT_HOURS);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  // ── Day toggle ─────────────────────────────────────────────────────────────
  function toggleDay(day: number) {
    setHours(prev => prev.map(h => h.day === day ? { ...h, isOpen: !h.isOpen } : h));
  }

  // ── Time update ────────────────────────────────────────────────────────────
  function updateTime(day: number, field: 'openTime' | 'closeTime', value: string) {
    setHours(prev => prev.map(h => h.day === day ? { ...h, [field]: value } : h));
  }

  // ── Copy one day's schedule to all currently-open days ─────────────────────
  function copyToAll(sourceDay: number) {
    const src = hours.find(h => h.day === sourceDay);
    if (!src) return;
    setHours(prev => prev.map(h =>
      h.isOpen && h.day !== sourceDay
        ? { ...h, openTime: src.openTime, closeTime: src.closeTime, breaks: src.breaks.map(b => ({ ...b, id: uid() })) }
        : h,
    ));
  }

  // ── Breaks ─────────────────────────────────────────────────────────────────
  function addBreak(day: number) {
    setHours(prev => prev.map(h =>
      h.day === day
        ? { ...h, breaks: [...h.breaks, { id: uid(), from: '13:00', to: '14:00' }] }
        : h,
    ));
  }

  function updateBreak(day: number, breakId: string, field: 'from' | 'to', value: string) {
    setHours(prev => prev.map(h =>
      h.day === day
        ? { ...h, breaks: h.breaks.map(b => b.id === breakId ? { ...b, [field]: value } : b) }
        : h,
    ));
  }

  function removeBreak(day: number, breakId: string) {
    setHours(prev => prev.map(h =>
      h.day === day ? { ...h, breaks: h.breaks.filter(b => b.id !== breakId) } : h,
    ));
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`${API}/api/v1/onboarding/hours`, {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body:        JSON.stringify({
          hours: hours.map(h => ({
            day:       h.day,
            isOpen:    h.isOpen,
            openTime:  h.openTime,
            closeTime: h.closeTime,
            breaks:    h.breaks.map(b => ({ from: b.from, to: b.to })),
          })),
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error?.message ?? 'Could not save hours. Try again.');
        return;
      }

      router.push('/onboarding/done');
    } catch {
      setError('Connection error. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'var(--bg)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '32px 16px 64px',
    }}>
      {/* Wordmark */}
      <div style={{ width: '100%', maxWidth: 520, marginBottom: 20 }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--fg)' }}>باری</span>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 200, color: 'var(--fg)', marginLeft: 6 }}>Baari</span>
      </div>

      {/* Card */}
      <div style={{
        width: '100%',
        maxWidth: 520,
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-lg)',
        overflow: 'hidden',
      }}>
        {/* Progress strip — 100% (last step) */}
        <div style={{ height: 5, background: 'var(--baari-sand)' }}>
          <div style={{ height: '100%', width: '100%', background: 'var(--baari-lime)' }} />
        </div>

        <div style={{ padding: '32px 28px 40px' }}>
          <p style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--fs-caption)',
            fontWeight: 'var(--fw-medium)',
            color: 'var(--fg-muted)',
            textTransform: 'uppercase',
            letterSpacing: 'var(--tracking-caps)',
            margin: '0 0 16px',
          }}>
            Step 3 of 3
          </p>

          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 28,
            fontWeight: 200,
            color: 'var(--fg)',
            margin: '0 0 4px',
            lineHeight: 1.2,
          }}>
            Working hours
          </h1>
          <p style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--fs-body-sm)',
            color: 'var(--fg-muted)',
            margin: '0 0 24px',
          }}>
            Toggle any day off. Hit the copy icon on any row to apply its schedule to all open days.
          </p>

          <form onSubmit={handleSubmit}>
            {/* Day rows */}
            <div style={{
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
              marginBottom: 20,
            }}>
              {hours.map((h, idx) => (
                <div
                  key={h.day}
                  style={{
                    borderBottom: idx < hours.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                    background: 'var(--bg-elevated)',
                  }}
                >
                  {/* ── Main row ── */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '12px 14px',
                  }}>
                    {/* Day label */}
                    <span style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: 'var(--fs-body-sm)',
                      fontWeight: h.isOpen ? 'var(--fw-medium)' : 'var(--fw-regular)',
                      color: h.isOpen ? 'var(--fg)' : 'var(--fg-muted)',
                      width: 82,
                      flexShrink: 0,
                      transition: 'color var(--dur-fast)',
                    }}>
                      {h.label}
                    </span>

                    {/* Toggle switch */}
                    <button
                      type="button"
                      role="switch"
                      aria-checked={h.isOpen}
                      onClick={() => toggleDay(h.day)}
                      title={h.isOpen ? 'Mark closed' : 'Mark open'}
                      style={{
                        width: 36,
                        height: 20,
                        borderRadius: 999,
                        background: h.isOpen ? 'var(--baari-onyx)' : 'var(--baari-sand)',
                        border: 'none',
                        cursor: 'pointer',
                        position: 'relative',
                        flexShrink: 0,
                        transition: 'background var(--dur-fast)',
                      }}
                    >
                      <span style={{
                        position: 'absolute',
                        top: 2,
                        left: h.isOpen ? 18 : 2,
                        width: 16,
                        height: 16,
                        borderRadius: '50%',
                        background: '#fff',
                        transition: 'left var(--dur-fast)',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.18)',
                      }} />
                    </button>

                    {h.isOpen ? (
                      <>
                        {/* Time range */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flex: 1, minWidth: 0 }}>
                          <input
                            type="time"
                            value={h.openTime}
                            onChange={e => updateTime(h.day, 'openTime', e.target.value)}
                            style={timeInput}
                          />
                          <span style={{ color: 'var(--fg-muted)', fontSize: 12, flexShrink: 0 }}>–</span>
                          <input
                            type="time"
                            value={h.closeTime}
                            onChange={e => updateTime(h.day, 'closeTime', e.target.value)}
                            style={timeInput}
                          />
                        </div>

                        {/* Copy-to-all button */}
                        <button
                          type="button"
                          onClick={() => copyToAll(h.day)}
                          title={`Copy ${h.short} schedule to all open days`}
                          style={{
                            flexShrink: 0,
                            background: 'none',
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-sm)',
                            cursor: 'pointer',
                            color: 'var(--fg-muted)',
                            padding: '4px 6px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 3,
                            transition: 'border-color var(--dur-fast), color var(--dur-fast)',
                          }}
                        >
                          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="5" y="5" width="9" height="9" rx="1.5"/>
                            <path d="M11 5V3a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h2"/>
                          </svg>
                          <span style={{ fontSize: 10, fontFamily: 'var(--font-body)', lineHeight: 1 }}>all</span>
                        </button>
                      </>
                    ) : (
                      <span style={{
                        fontFamily: 'var(--font-body)',
                        fontSize: 'var(--fs-caption)',
                        color: 'var(--fg-muted)',
                        flex: 1,
                        fontStyle: 'italic',
                      }}>
                        Closed
                      </span>
                    )}
                  </div>

                  {/* ── Breaks sub-section ── */}
                  {h.isOpen && (
                    <div style={{
                      padding: '0 14px 10px',
                      marginLeft: 82 + 36 + 10 + 10,   /* align under time pickers */
                    }}>
                      {h.breaks.map(b => (
                        <div
                          key={b.id}
                          style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}
                        >
                          <span style={{
                            fontSize: 10,
                            fontFamily: 'var(--font-body)',
                            color: 'var(--fg-muted)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            width: 30,
                            flexShrink: 0,
                          }}>
                            Off
                          </span>
                          <input
                            type="time"
                            value={b.from}
                            onChange={e => updateBreak(h.day, b.id, 'from', e.target.value)}
                            style={{ ...timeInput, minWidth: 78 }}
                          />
                          <span style={{ color: 'var(--fg-muted)', fontSize: 12, flexShrink: 0 }}>–</span>
                          <input
                            type="time"
                            value={b.to}
                            onChange={e => updateBreak(h.day, b.id, 'to', e.target.value)}
                            style={{ ...timeInput, minWidth: 78 }}
                          />
                          <button
                            type="button"
                            onClick={() => removeBreak(h.day, b.id)}
                            aria-label="Remove break"
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              color: 'var(--fg-muted)',
                              fontSize: 18,
                              lineHeight: 1,
                              padding: '0 2px',
                              flexShrink: 0,
                            }}
                          >
                            ×
                          </button>
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={() => addBreak(h.day)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'var(--fg-link)',
                          fontSize: 12,
                          fontFamily: 'var(--font-body)',
                          padding: 0,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <span style={{ fontSize: 15, lineHeight: 1 }}>+</span> Add break
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {error && (
              <div style={{
                marginBottom: 14,
                padding: '10px 12px',
                background: '#FDF2F1',
                border: '1px solid #F5D0CD',
                borderRadius: 'var(--radius-sm)',
                fontSize: 'var(--fs-body-sm)',
                color: 'var(--baari-error)',
                fontFamily: 'var(--font-body)',
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '13px 0',
                background: loading ? 'var(--bg-subtle)' : 'var(--baari-onyx)',
                color: loading ? 'var(--fg-muted)' : '#fff',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--fs-body-sm)',
                fontFamily: 'var(--font-body)',
                fontWeight: 'var(--fw-medium)',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background var(--dur-fast)',
                letterSpacing: 'var(--tracking-button)',
              }}
            >
              {loading ? 'Saving…' : 'Finish setup →'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
