'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';

interface ServiceCard {
  id: string;
  name: string;
  category: string;
  durationMin: number;
  pricePkr: string;
}

interface Template {
  name: string;
  category: string;
  durationMin: number;
}

// Barber listed first — MVP targets male salons
const TEMPLATES: Record<string, Template[]> = {
  Barber: [
    { name: 'Haircut',      category: 'barber', durationMin: 30 },
    { name: 'Beard Trim',   category: 'barber', durationMin: 20 },
    { name: 'Clean Shave',  category: 'barber', durationMin: 20 },
    { name: 'Skin Fade',    category: 'barber', durationMin: 45 },
    { name: 'Head Massage', category: 'barber', durationMin: 30 },
    { name: 'Hair Color',   category: 'barber', durationMin: 60 },
  ],
  Hair: [
    { name: 'Haircut',      category: 'hair', durationMin: 60 },
    { name: 'Blow Dry',     category: 'hair', durationMin: 45 },
    { name: 'Highlights',   category: 'hair', durationMin: 120 },
    { name: 'Balayage',     category: 'hair', durationMin: 150 },
    { name: 'Keratin',      category: 'hair', durationMin: 180 },
    { name: 'Global Color', category: 'hair', durationMin: 90 },
  ],
  Skin: [
    { name: 'Facial',    category: 'skin', durationMin: 60 },
    { name: 'Threading', category: 'skin', durationMin: 30 },
    { name: 'Waxing',    category: 'skin', durationMin: 45 },
    { name: 'Cleanup',   category: 'skin', durationMin: 60 },
  ],
  Nails: [
    { name: 'Manicure',  category: 'nails', durationMin: 45 },
    { name: 'Pedicure',  category: 'nails', durationMin: 60 },
    { name: 'Gel Nails', category: 'nails', durationMin: 90 },
  ],
  Makeup: [
    { name: 'Party Makeup',  category: 'makeup', durationMin: 90 },
    { name: 'Bridal Makeup', category: 'makeup', durationMin: 180 },
    { name: 'Mehndi Makeup', category: 'makeup', durationMin: 120 },
  ],
};

const DURATIONS = [15, 20, 30, 45, 60, 90, 120, 150, 180];

function fmtDuration(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}m` : `${h} hr`;
}

function uid() { return Math.random().toString(36).slice(2); }

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 11px',
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  fontSize: 'var(--fs-body-sm)',
  fontFamily: 'var(--font-body)',
  color: 'var(--fg)',
  outline: 'none',
  boxSizing: 'border-box',
};

export default function OnboardingServicesPage() {
  const router = useRouter();
  const [services, setServices] = useState<ServiceCard[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  function addFromTemplate(tpl: Template) {
    setServices(prev => [
      ...prev,
      { id: uid(), name: tpl.name, category: tpl.category, durationMin: tpl.durationMin, pricePkr: '' },
    ]);
  }

  function removeByTemplate(tpl: Template) {
    setServices(prev => {
      const idx = prev.findIndex(s => s.name === tpl.name && s.category === tpl.category);
      if (idx === -1) return prev;
      return prev.filter((_, i) => i !== idx);
    });
  }

  function addCustom() {
    setServices(prev => [
      ...prev,
      { id: uid(), name: '', category: 'other', durationMin: 30, pricePkr: '' },
    ]);
  }

  function update(id: string, field: keyof ServiceCard, value: string | number) {
    setServices(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  }

  function remove(id: string) {
    setServices(prev => prev.filter(s => s.id !== id));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const valid = services.filter(s => s.name.trim() && s.durationMin > 0 && Number(s.pricePkr) >= 0);
    if (valid.length === 0) {
      setError('Add at least one service with a name, duration, and price.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API}/api/v1/onboarding/services`, {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body:        JSON.stringify({
          services: valid.map(s => ({
            name:        s.name.trim(),
            category:    s.category,
            durationMin: s.durationMin,
            pricePaisa:  Math.round(Number(s.pricePkr) * 100),
          })),
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error?.message ?? 'Could not save services. Try again.');
        return;
      }

      router.push('/onboarding/hours');
    } catch {
      setError('Connection error. Try again.');
    } finally {
      setLoading(false);
    }
  }

  const validCount = services.filter(s => s.name.trim()).length;
  const hasValid   = validCount > 0;

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
        {/* Progress strip — 66% */}
        <div style={{ height: 5, background: 'var(--baari-sand)' }}>
          <div style={{ height: '100%', width: '66%', background: 'var(--baari-lime)' }} />
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
            Step 2 of 3
          </p>

          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 28,
            fontWeight: 200,
            color: 'var(--fg)',
            margin: '0 0 6px',
            lineHeight: 1.2,
          }}>
            Add services
          </h1>
          <p style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--fs-body-sm)',
            color: 'var(--fg-muted)',
            margin: '0 0 28px',
          }}>
            Tap a service to add it, then enter the price.
          </p>

          <form onSubmit={handleSubmit}>
            {/* Template grid */}
            {Object.entries(TEMPLATES).map(([category, templates]) => (
              <div key={category} style={{ marginBottom: 20 }}>
                <p style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 'var(--fs-caption)',
                  fontWeight: 'var(--fw-medium)',
                  color: 'var(--fg-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: 'var(--tracking-caps)',
                  margin: '0 0 8px',
                }}>
                  {category}
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {templates.map(tpl => {
                    const added = services.some(s => s.name === tpl.name && s.category === tpl.category);
                    return (
                      <button
                        key={tpl.name}
                        type="button"
                        onClick={() => added ? removeByTemplate(tpl) : addFromTemplate(tpl)}
                        style={{
                          padding: '7px 12px',
                          background: added ? 'var(--baari-onyx)' : 'var(--bg)',
                          border: added ? '1px solid var(--baari-onyx)' : '1px solid var(--border)',
                          borderRadius: 'var(--radius-pill)',
                          fontSize: 'var(--fs-caption)',
                          fontFamily: 'var(--font-body)',
                          fontWeight: added ? 'var(--fw-medium)' : 'var(--fw-regular)',
                          color: added ? '#fff' : 'var(--fg)',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          transition: 'all var(--dur-fast)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 5,
                        }}
                      >
                        {added ? (
                          <><span style={{ opacity: 0.7, fontSize: 11 }}>✕</span> {tpl.name}</>
                        ) : tpl.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Divider */}
            {services.length > 0 && (
              <div style={{ margin: '24px 0 16px', borderTop: '1px solid var(--border-subtle)' }} />
            )}

            {/* Added service cards */}
            {services.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                <p style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 'var(--fs-caption)',
                  fontWeight: 'var(--fw-medium)',
                  color: 'var(--fg-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: 'var(--tracking-caps)',
                  margin: 0,
                }}>
                  Added ({validCount})
                </p>
                {services.map(svc => (
                  <div
                    key={svc.id}
                    style={{
                      background: 'var(--bg)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      padding: 14,
                    }}
                  >
                    <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                      <input
                        type="text"
                        value={svc.name}
                        onChange={e => update(svc.id, 'name', e.target.value)}
                        placeholder="Service name"
                        style={{ ...inputStyle, flex: 1 }}
                      />
                      <button
                        type="button"
                        onClick={() => remove(svc.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'var(--fg-muted)',
                          fontSize: 20,
                          lineHeight: 1,
                          padding: '0 4px',
                          flexShrink: 0,
                        }}
                        aria-label="Remove"
                      >
                        ×
                      </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 11, color: 'var(--fg-muted)', marginBottom: 4, fontFamily: 'var(--font-body)' }}>
                          Price (PKR)
                        </label>
                        <input
                          type="number"
                          value={svc.pricePkr}
                          onChange={e => update(svc.id, 'pricePkr', e.target.value)}
                          placeholder="e.g. 500"
                          min={0}
                          inputMode="numeric"
                          style={inputStyle}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 11, color: 'var(--fg-muted)', marginBottom: 4, fontFamily: 'var(--font-body)' }}>
                          Duration
                        </label>
                        <select
                          value={svc.durationMin}
                          onChange={e => update(svc.id, 'durationMin', Number(e.target.value))}
                          style={{ ...inputStyle, cursor: 'pointer', appearance: 'none' }}
                        >
                          {DURATIONS.map(d => (
                            <option key={d} value={d}>{fmtDuration(d)}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={addCustom}
              style={{
                width: '100%',
                padding: '11px 0',
                background: 'none',
                border: '1px dashed var(--border)',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--fs-body-sm)',
                fontFamily: 'var(--font-body)',
                color: 'var(--fg-muted)',
                cursor: 'pointer',
                marginBottom: error ? 0 : 4,
              }}
            >
              + Add custom service
            </button>

            {error && (
              <div style={{
                marginTop: 12,
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
              disabled={!hasValid || loading}
              style={{
                width: '100%',
                padding: '13px 0',
                marginTop: 16,
                background: hasValid && !loading ? 'var(--baari-onyx)' : 'var(--bg-subtle)',
                color: hasValid && !loading ? '#fff' : 'var(--fg-muted)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--fs-body-sm)',
                fontFamily: 'var(--font-body)',
                fontWeight: 'var(--fw-medium)',
                cursor: hasValid && !loading ? 'pointer' : 'not-allowed',
                transition: 'background var(--dur-fast)',
                letterSpacing: 'var(--tracking-button)',
              }}
            >
              {loading
                ? 'Saving…'
                : hasValid
                  ? `Continue → (${validCount} service${validCount !== 1 ? 's' : ''})`
                  : 'Add at least one service'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
