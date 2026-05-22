'use client';

import { useState, useEffect, useRef, useCallback, type CSSProperties } from 'react';
import { Avatar, IconButton, Pill, Icon, Eyebrow, fmtPKR } from './primitives';

const API = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';
const PAGE_SIZE = 20;

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClientListItem {
  id: string;
  name: string;
  phoneE164: string;
  isVip: boolean;
  waOptIn: boolean;
  lastVisitDate: string | null;
  visitCount: number;
}

interface ClientProfile {
  id: string;
  name: string;
  phoneE164: string;
  waOptIn: boolean;
  isVip: boolean;
  notes: string;
  createdAt: string;
  lifetimeSpend: number;
  visitCount: number;
}

interface VisitEntry {
  service: string;
  date: string;
  staff: string;
  amount: number;
  state: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtPhone(e164: string): string {
  // +923001234567 → 0300 1234 567
  if (e164.startsWith('+92') && e164.length === 13) {
    const local = '0' + e164.slice(3);
    return local.slice(0, 4) + ' ' + local.slice(4, 8) + ' ' + local.slice(8);
  }
  return e164;
}

function fmtRelativeDate(iso: string | null): string {
  if (!iso) return 'No visits yet';
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7)  return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}

function initials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

// ─── Skeleton row ─────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '13px 16px',
      borderBottom: '1px solid var(--border-subtle)',
    }}>
      <div style={{ width: 46, height: 46, borderRadius: '50%', background: 'var(--baari-bone)', flexShrink: 0, animation: 'pulse 1.4s ease infinite' }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ height: 13, width: '55%', borderRadius: 4, background: 'var(--baari-bone)', animation: 'pulse 1.4s ease infinite' }} />
        <div style={{ height: 11, width: '38%', borderRadius: 4, background: 'var(--baari-bone)', animation: 'pulse 1.4s ease 0.15s infinite' }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
        <div style={{ height: 11, width: 52, borderRadius: 4, background: 'var(--baari-bone)', animation: 'pulse 1.4s ease 0.05s infinite' }} />
        <div style={{ height: 11, width: 36, borderRadius: 4, background: 'var(--baari-bone)', animation: 'pulse 1.4s ease 0.2s infinite' }} />
      </div>
    </div>
  );
}

// ─── Client list row ──────────────────────────────────────────────────────────

function ClientRow({ client, active, onClick }: {
  client: ClientListItem;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '13px 16px', width: '100%', textAlign: 'left',
        background: active ? 'rgba(232,255,71,0.12)' : 'transparent',
        border: 0, borderBottom: '1px solid var(--border-subtle)',
        cursor: 'pointer', fontFamily: 'inherit',
        transition: 'background 100ms',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {/* Avatar */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <div style={{
          width: 46, height: 46, borderRadius: '50%',
          background: client.isVip ? 'var(--baari-onyx)' : 'var(--baari-bone)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 15, fontWeight: 600,
          color: client.isVip ? 'var(--baari-lime)' : 'var(--baari-graphite)',
          letterSpacing: '0.02em',
        }}>
          {initials(client.name || '?')}
        </div>
        {client.waOptIn && (
          <div style={{
            position: 'absolute', bottom: -1, right: -1,
            width: 16, height: 16, borderRadius: '50%',
            background: '#25D366',
            border: '2px solid var(--baari-cream)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name="whatsapp" size={9} color="#fff" stroke={2} />
          </div>
        )}
      </div>

      {/* Name + phone */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <span style={{
            fontSize: 14, fontWeight: 500, color: 'var(--baari-onyx)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {client.name || 'Unknown'}
          </span>
          {client.isVip && (
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '0.06em',
              background: 'var(--baari-onyx)', color: 'var(--baari-lime)',
              padding: '2px 5px', borderRadius: 3, flexShrink: 0,
            }}>VIP</span>
          )}
        </div>
        <div style={{ fontSize: 12, color: 'var(--fg-muted)', fontVariantNumeric: 'tabular-nums' }}>
          {fmtPhone(client.phoneE164)}
        </div>
      </div>

      {/* Last visit + count */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
        <span style={{ fontSize: 12, color: client.lastVisitDate ? 'var(--fg-secondary)' : 'var(--fg-muted)' }}>
          {fmtRelativeDate(client.lastVisitDate)}
        </span>
        <span style={{ fontSize: 11, color: 'var(--fg-muted)' }}>
          {client.visitCount} visit{client.visitCount !== 1 ? 's' : ''}
        </span>
      </div>
    </button>
  );
}

// ─── Client profile panel ─────────────────────────────────────────────────────

function ClientProfile({ clientId, isMobile, onClose, onClientUpdated }: {
  clientId: string;
  isMobile: boolean;
  onClose: () => void;
  onClientUpdated: () => void;
}) {
  const [profile, setProfile]     = useState<ClientProfile | null>(null);
  const [visits, setVisits]       = useState<VisitEntry[]>([]);
  const [visitsLoading, setVisitsLoading] = useState(false);
  const [visitsHasMore, setVisitsHasMore] = useState(false);
  const [visitsOffset, setVisitsOffset]   = useState(0);
  const [loading, setLoading]     = useState(true);
  const [editing, setEditing]     = useState(false);
  const [notes, setNotes]         = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [savingVip, setSavingVip]     = useState(false);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/v1/customers/${clientId}`, { credentials: 'include' });
      if (!res.ok) return;
      const { data } = await res.json();
      setProfile(data);
      setNotes(data.notes ?? '');
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  const loadVisits = useCallback(async (offset = 0, append = false) => {
    setVisitsLoading(true);
    try {
      const res = await fetch(`${API}/api/v1/customers/${clientId}/bookings?limit=10&offset=${offset}`, { credentials: 'include' });
      if (!res.ok) return;
      const { data, hasMore } = await res.json();
      setVisits(prev => append ? [...prev, ...data] : data);
      setVisitsHasMore(hasMore);
      setVisitsOffset(offset + data.length);
    } finally {
      setVisitsLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    setProfile(null);
    setVisits([]);
    setVisitsOffset(0);
    setVisitsHasMore(false);
    setEditing(false);
    loadProfile();
    loadVisits(0);
  }, [clientId, loadProfile, loadVisits]);

  const saveNotes = async () => {
    if (!profile) return;
    setSavingNotes(true);
    try {
      await fetch(`${API}/api/v1/customers/${profile.id}`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      });
      setProfile(p => p ? { ...p, notes } : p);
      setEditing(false);
      onClientUpdated();
    } finally {
      setSavingNotes(false);
    }
  };

  const toggleVip = async () => {
    if (!profile) return;
    setSavingVip(true);
    const next = !profile.isVip;
    try {
      const res = await fetch(`${API}/api/v1/customers/${profile.id}`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isVip: next }),
      });
      if (res.ok) {
        setProfile(p => p ? { ...p, isVip: next } : p);
        onClientUpdated();
      }
    } finally {
      setSavingVip(false);
    }
  };

  const panelStyle: CSSProperties = isMobile
    ? {
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'var(--baari-cream)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }
    : {
        flex: 1, minWidth: 0,
        background: '#fff',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      };

  return (
    <aside style={panelStyle}>
      {/* Header */}
      <div style={{
        padding: isMobile ? '14px 16px' : '16px 20px',
        display: 'flex', alignItems: 'center', gap: 12,
        borderBottom: '1px solid var(--border-subtle)',
        background: isMobile ? 'var(--baari-onyx)' : '#fff',
        flexShrink: 0,
      }}>
        {isMobile && (
          <button onClick={onClose} style={{
            background: 'transparent', border: 0, cursor: 'pointer', padding: 4,
            color: 'var(--baari-lime)', display: 'flex', alignItems: 'center',
          }}>
            <Icon name="chevLeft" size={20} color="var(--baari-lime)" />
          </button>
        )}
        <span style={{
          flex: 1, fontSize: isMobile ? 16 : 13, fontWeight: isMobile ? 600 : 500,
          color: isMobile ? '#fff' : 'var(--baari-onyx)',
          fontFamily: 'var(--font-body)',
        }}>
          {loading ? 'Loading…' : (profile?.name ?? 'Client profile')}
        </span>
        {!isMobile && <IconButton name="close" onClick={onClose} />}
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflow: 'auto', padding: isMobile ? '20px 16px 40px' : '18px 20px 32px', display: 'flex', flexDirection: 'column', gap: 22 }}>

        {loading ? (
          <>
            {[0,1,2].map(i => (
              <div key={i} style={{ height: 60, borderRadius: 6, background: 'var(--baari-bone)', animation: 'pulse 1.4s ease infinite' }} />
            ))}
          </>
        ) : !profile ? (
          <div style={{ textAlign: 'center', color: 'var(--fg-muted)', fontSize: 13, padding: 32 }}>
            Failed to load client profile.
          </div>
        ) : (
          <>
            {/* Identity */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{
                width: 68, height: 68, borderRadius: '50%', flexShrink: 0,
                background: profile.isVip ? 'var(--baari-onyx)' : 'var(--baari-bone)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22, fontWeight: 700,
                color: profile.isVip ? 'var(--baari-lime)' : 'var(--baari-graphite)',
              }}>
                {initials(profile.name || '?')}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{
                    fontFamily: 'var(--font-display)', fontSize: 24,
                    letterSpacing: '-0.01em', color: 'var(--baari-onyx)', lineHeight: 1.1,
                  }}>
                    {profile.name}
                  </span>
                  {profile.isVip && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
                      background: 'var(--baari-onyx)', color: 'var(--baari-lime)',
                      padding: '3px 7px', borderRadius: 3,
                    }}>VIP</span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginTop: 5, fontVariantNumeric: 'tabular-nums', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Icon name="phone" size={11} />
                  <a href={`tel:${profile.phoneE164}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                    {fmtPhone(profile.phoneE164)}
                  </a>
                </div>
              </div>
            </div>

            {/* Stats row */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr',
              gap: 10,
            }}>
              <div style={{
                padding: '14px 16px', borderRadius: 6,
                background: 'var(--baari-bone)', textAlign: 'center',
              }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--baari-onyx)', fontVariantNumeric: 'tabular-nums' }}>
                  {profile.visitCount}
                </div>
                <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 2 }}>Visits</div>
              </div>
              <div style={{
                padding: '14px 16px', borderRadius: 6,
                background: 'var(--baari-bone)', textAlign: 'center',
              }}>
                <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--baari-onyx)', fontVariantNumeric: 'tabular-nums' }}>
                  {fmtPKR(profile.lifetimeSpend)}
                </div>
                <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 2 }}>Spent total</div>
              </div>
            </div>

            {/* WhatsApp status */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '12px 14px', borderRadius: 6,
              background: profile.waOptIn ? 'rgba(37,211,102,0.07)' : 'var(--baari-bone)',
              border: '1px solid ' + (profile.waOptIn ? '#9BD3AC' : 'transparent'),
            }}>
              <Icon name="whatsapp" size={18} color={profile.waOptIn ? '#25D366' : 'var(--fg-muted)'} stroke={1.6} />
              <span style={{ flex: 1, fontSize: 13, color: 'var(--baari-onyx)' }}>WhatsApp updates</span>
              <span style={{ fontSize: 12, fontWeight: 500, color: profile.waOptIn ? '#1B6E3F' : 'var(--fg-muted)' }}>
                {profile.waOptIn ? 'Opted in' : 'Opted out'}
              </span>
            </div>

            {/* Notes */}
            <section>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <Eyebrow>Notes</Eyebrow>
                {editing ? (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => { setEditing(false); setNotes(profile.notes); }} style={ghostBtn}>
                      Cancel
                    </button>
                    <button onClick={saveNotes} disabled={savingNotes} style={{ ...ghostBtn, color: 'var(--baari-onyx)', fontWeight: 600 }}>
                      {savingNotes ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setEditing(true)} style={ghostBtn}>
                    <Icon name="edit" size={11} /> Edit
                  </button>
                )}
              </div>
              {editing ? (
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  autoFocus rows={5}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    background: 'rgba(232,255,71,0.10)',
                    border: '1px solid rgba(232,255,71,0.55)',
                    borderRadius: 6, padding: '12px 14px', resize: 'vertical',
                    fontFamily: 'var(--font-body)', fontSize: 13,
                    color: 'var(--baari-graphite)', lineHeight: 1.55, outline: 'none',
                  }}
                />
              ) : (
                <div
                  onClick={() => setEditing(true)}
                  style={{
                    background: 'rgba(232,255,71,0.08)',
                    border: '1px solid rgba(232,255,71,0.30)',
                    borderRadius: 6, padding: '12px 14px', minHeight: 56,
                    fontSize: 13, color: notes ? 'var(--baari-graphite)' : 'var(--fg-muted)',
                    lineHeight: 1.55, fontStyle: notes ? 'normal' : 'italic',
                    cursor: 'text',
                  }}
                >
                  {notes || 'No notes yet. Tap to add.'}
                </div>
              )}
            </section>

            {/* Visit history */}
            <section>
              <Eyebrow style={{ marginBottom: 8 }}>Visit history</Eyebrow>
              {visits.length === 0 && !visitsLoading ? (
                <div style={{ padding: '14px 0', fontSize: 13, color: 'var(--fg-muted)', fontStyle: 'italic' }}>
                  No visits on record.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {visits.map((v, i) => (
                    <div key={i} style={{
                      display: 'grid', gridTemplateColumns: '1fr auto',
                      gap: 10, padding: '12px 0',
                      borderBottom: i < visits.length - 1 ? '1px solid var(--border-subtle)' : undefined,
                    }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: 'var(--baari-onyx)', fontWeight: 500 }}>{v.service}</div>
                        <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 2 }}>
                          {v.date} · {v.staff}
                        </div>
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--fg-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                        {v.amount ? fmtPKR(v.amount) : '—'}
                      </div>
                    </div>
                  ))}

                  {visitsLoading && (
                    <div style={{ padding: '12px 0', display: 'flex', gap: 8, alignItems: 'center' }}>
                      <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid var(--baari-sand)', borderTopColor: 'var(--baari-onyx)', animation: 'spin 0.8s linear infinite' }} />
                      <span style={{ fontSize: 12, color: 'var(--fg-muted)' }}>Loading…</span>
                    </div>
                  )}

                  {visitsHasMore && !visitsLoading && (
                    <button
                      onClick={() => loadVisits(visitsOffset, true)}
                      style={{
                        marginTop: 8, padding: '10px 0',
                        background: 'transparent', border: 0, cursor: 'pointer',
                        fontSize: 13, color: 'var(--baari-graphite)', fontWeight: 500,
                        fontFamily: 'inherit', textAlign: 'center',
                        borderTop: '1px solid var(--border-subtle)',
                      }}
                    >
                      Load more visits
                    </button>
                  )}
                </div>
              )}
            </section>

            {/* VIP toggle */}
            <button
              onClick={toggleVip}
              disabled={savingVip}
              style={{
                width: '100%', padding: '13px 16px',
                background: profile.isVip ? 'rgba(13,13,13,0.06)' : 'var(--baari-onyx)',
                border: profile.isVip ? '1px solid var(--border-subtle)' : '1px solid transparent',
                borderRadius: 8, cursor: savingVip ? 'wait' : 'pointer',
                fontSize: 14, fontWeight: 600, fontFamily: 'inherit',
                color: profile.isVip ? 'var(--baari-graphite)' : 'var(--baari-lime)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'opacity 120ms',
                opacity: savingVip ? 0.6 : 1,
              }}
            >
              <span>{profile.isVip ? '★' : '☆'}</span>
              {profile.isVip ? 'Remove VIP status' : 'Mark as VIP'}
            </button>
          </>
        )}
      </div>
    </aside>
  );
}

const ghostBtn: CSSProperties = {
  background: 'transparent', border: 0, cursor: 'pointer', padding: '2px 6px',
  color: 'var(--baari-graphite)', fontSize: 12, fontWeight: 500,
  display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'inherit',
};

// ─── Main view ────────────────────────────────────────────────────────────────

export function ClientsView() {
  const [query, setQuery]           = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [clients, setClients]       = useState<ClientListItem[]>([]);
  const [loading, setLoading]       = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore]       = useState(false);
  const [offset, setOffset]         = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isMobile, setIsMobile]     = useState(false);
  const [refetchKey, setRefetchKey] = useState(0);
  const sentinelRef                 = useRef<HTMLDivElement>(null);
  const searchRef                   = useRef<HTMLInputElement>(null);

  const refetchList = useCallback(() => setRefetchKey(k => k + 1), []);

  // Mobile detection
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  // Fetch list
  const fetchClients = useCallback(async (q: string, off: number, append: boolean) => {
    if (off === 0) setLoading(true); else setLoadingMore(true);
    try {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(off) });
      if (q.trim()) params.set('q', q.trim());
      const res = await fetch(`${API}/api/v1/customers?${params}`, { credentials: 'include' });
      if (!res.ok) return;
      const { data, hasMore: more } = await res.json();
      setClients(prev => append ? [...prev, ...data] : data);
      setHasMore(more);
      setOffset(off + data.length);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  // Reload on search change or after a mutation (refetchKey bump)
  const isFirstMount = useRef(true);
  useEffect(() => {
    const isMutation = !isFirstMount.current && refetchKey > 0;
    isFirstMount.current = false;
    // On mutation-triggered refetch, keep selected client open; don't reset selection
    if (!isMutation) setSelectedId(null);
    setClients([]);
    setOffset(0);
    setHasMore(false);
    fetchClients(debouncedQ, 0, false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ, fetchClients, refetchKey]);

  // Infinite scroll sentinel
  useEffect(() => {
    if (!sentinelRef.current) return;
    const obs = new IntersectionObserver(
      entries => {
        if (entries[0]?.isIntersecting && hasMore && !loadingMore && !loading) {
          fetchClients(debouncedQ, offset, true);
        }
      },
      { rootMargin: '200px' },
    );
    obs.observe(sentinelRef.current);
    return () => obs.disconnect();
  }, [hasMore, loadingMore, loading, offset, debouncedQ, fetchClients]);

  const handleSelectClient = (id: string) => {
    setSelectedId(prev => (prev === id && !isMobile) ? null : id);
  };

  const closeProfile = () => setSelectedId(null);

  return (
    <>
      {/* Pulse + spin keyframes */}
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.45} }
        @keyframes spin  { to{transform:rotate(360deg)} }
      `}</style>

      <div style={{ flex: 1, display: 'flex', minWidth: 0, fontFamily: 'var(--font-body)', overflow: 'hidden' }}>

        {/* ── Client list (hide on mobile when profile is open) ── */}
        {/*
          Desktop layout:
          - Panel closed → list is flex:1 but inner content capped at 560px, centered
          - Panel open   → list is a fixed 380px column; profile takes the rest
        */}
        <div style={{
          // Mobile: hidden when profile open; Desktop: fixed 380px when panel open, else flex-1
          display: (isMobile && selectedId) ? 'none' : 'flex',
          flexDirection: 'column',
          overflow: 'auto',
          background: 'var(--baari-cream)',
          ...(!isMobile && selectedId
            ? { flexShrink: 0, width: 380, borderRight: '1px solid var(--border-subtle)' }
            : { flex: 1, minWidth: 0 }
          ),
        }}>
          {/* Inner content wrapper — caps width and centers when no panel */}
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            width: '100%',
            ...(!isMobile && !selectedId ? { maxWidth: 560, margin: '0 auto' } : {}),
          }}>

          {/* Page title */}
          <div style={{ padding: '24px 16px 0', flexShrink: 0 }}>
            <h2 style={{
              fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 200,
              letterSpacing: '-0.02em', color: 'var(--baari-onyx)', margin: '0 0 16px',
            }}>
              Your <strong>clients</strong>
            </h2>
          </div>

          {/* Sticky search */}
          <div style={{
            position: 'sticky', top: 0, zIndex: 10,
            padding: '0 16px 12px',
            background: 'var(--baari-cream)',
            flexShrink: 0,
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: '#fff', borderRadius: 12,
              padding: '12px 14px',
              border: '1px solid var(--border-subtle)',
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
            }}>
              <Icon name="search" size={16} color="var(--fg-muted)" />
              <input
                ref={searchRef}
                placeholder="Search name or phone…"
                value={query}
                onChange={e => setQuery(e.target.value)}
                style={{
                  flex: 1, border: 0, background: 'transparent', outline: 'none',
                  fontFamily: 'inherit', fontSize: 15, color: 'var(--baari-onyx)',
                }}
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  style={{ background: 'transparent', border: 0, cursor: 'pointer', padding: 0, display: 'flex' }}
                >
                  <Icon name="close" size={16} color="var(--fg-muted)" />
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div style={{ flex: 1, background: '#fff', marginTop: 4 }}>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
            ) : clients.length === 0 ? (
              <div style={{ padding: '64px 24px', textAlign: 'center' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
                <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--baari-onyx)', marginBottom: 6 }}>
                  {debouncedQ ? `No clients match "${debouncedQ}"` : 'No clients yet'}
                </div>
                <div style={{ fontSize: 13, color: 'var(--fg-muted)' }}>
                  {debouncedQ ? 'Try a different name or phone number.' : 'Clients appear here after their first booking.'}
                </div>
              </div>
            ) : (
              <>
                {clients.map(c => (
                  <ClientRow
                    key={c.id}
                    client={c}
                    active={c.id === selectedId}
                    onClick={() => handleSelectClient(c.id)}
                  />
                ))}

                {/* Infinite scroll sentinel */}
                <div ref={sentinelRef} style={{ height: 1 }} />

                {loadingMore && (
                  <div style={{ padding: '16px 0', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid var(--baari-sand)', borderTopColor: 'var(--baari-onyx)', animation: 'spin 0.8s linear infinite' }} />
                    <span style={{ fontSize: 12, color: 'var(--fg-muted)' }}>Loading more…</span>
                  </div>
                )}

                {!hasMore && clients.length > 0 && (
                  <div style={{ padding: '16px 0', textAlign: 'center', fontSize: 12, color: 'var(--fg-muted)' }}>
                    {clients.length} client{clients.length !== 1 ? 's' : ''} total
                  </div>
                )}
              </>
            )}
          </div>
          </div>{/* end inner content wrapper */}
        </div>{/* end list column */}

        {/* ── Client profile ── */}
        {selectedId && (
          <ClientProfile
            key={selectedId}
            clientId={selectedId}
            isMobile={isMobile}
            onClose={closeProfile}
            onClientUpdated={refetchList}
          />
        )}
      </div>
    </>
  );
}
