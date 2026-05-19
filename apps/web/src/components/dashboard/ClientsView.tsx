'use client';

import { useState, useEffect } from 'react';
import { Avatar, IconButton, Pill, Icon, Eyebrow, fmtPKR } from './primitives';
import type { Client } from './data';

interface ClientsViewProps {
  clients: Client[];
  onUpdateNotes?: (id: string, notes: string) => void;
}

export function ClientsView({ clients, onUpdateNotes }: ClientsViewProps) {
  const [query, setQuery]       = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = clients.filter(c => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.phone.toLowerCase().includes(q);
  });

  const selected = clients.find(c => c.id === selectedId) ?? null;

  return (
    <div style={{ flex: 1, display: 'flex', minWidth: 0, fontFamily: 'var(--font-body)' }}>
      {/* Master list */}
      <div style={{ flex: 1, minWidth: 0, overflow: 'auto', background: 'var(--baari-cream)' }}>
        <div style={{ maxWidth: 880, margin: '0 auto', padding: '32px 32px 64px' }}>

          <header style={{ marginBottom: 22, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap' }}>
            <div>
              <h2 style={{
                fontFamily: 'var(--font-display)', fontSize: 38, fontWeight: 200,
                letterSpacing: '-0.02em', color: 'var(--baari-onyx)', margin: 0, lineHeight: 1.1,
              }}>
                Your <strong>clients</strong>
              </h2>
              <p style={{ fontSize: 14, color: 'var(--fg-secondary)', margin: '8px 0 0' }}>
                {clients.length} on the books. Tap any name for history and notes.
              </p>
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: '#fff', borderRadius: 6,
              padding: '10px 12px', width: 280,
              border: '1px solid var(--border-subtle)',
            }}>
              <Icon name="search" size={15} color="var(--fg-muted)" />
              <input
                placeholder="Search name or phone…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{
                  flex: 1, border: 0, background: 'transparent', outline: 'none',
                  fontFamily: 'inherit', fontSize: 13, color: 'var(--baari-onyx)',
                }}
              />
            </div>
          </header>

          <div style={{ background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 2, overflow: 'hidden' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: 48, textAlign: 'center', color: 'var(--fg-muted)', fontSize: 13 }}>
                No clients match &ldquo;{query}&rdquo;.
              </div>
            ) : (
              filtered.map((c, i) => (
                <ClientRow
                  key={c.id}
                  client={c}
                  active={c.id === selectedId}
                  divider={i < filtered.length - 1}
                  onClick={() => setSelectedId(c.id === selectedId ? null : c.id)}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Detail sheet */}
      {selected && (
        <ClientSheet
          client={selected}
          onClose={() => setSelectedId(null)}
          onUpdateNotes={(id, notes) => onUpdateNotes?.(id, notes)}
        />
      )}
    </div>
  );
}

interface ClientRowProps {
  client: Client;
  active: boolean;
  divider: boolean;
  onClick: () => void;
}

function ClientRow({ client, active, divider, onClick }: ClientRowProps) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'grid',
        gridTemplateColumns: 'auto minmax(180px,1.6fr) minmax(140px,1fr) minmax(130px,1fr) minmax(60px,auto) auto',
        alignItems: 'center', gap: 18,
        padding: '16px 20px',
        width: '100%', textAlign: 'left',
        background: active ? 'rgba(232, 255, 71, 0.10)' : hover ? 'var(--baari-cream)' : '#fff',
        border: 0, borderBottom: divider ? '1px solid var(--border-subtle)' : undefined,
        cursor: 'pointer', fontFamily: 'inherit',
        transition: 'background 120ms ease',
      }}
    >
      <Avatar name={client.name} size={40} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--baari-onyx)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {client.name}
        </span>
        {client.vip && <Pill tone="vip">VIP</Pill>}
      </div>
      <span style={{ fontSize: 13, color: 'var(--fg-secondary)', fontVariantNumeric: 'tabular-nums' }}>{client.phone}</span>
      <span style={{ fontSize: 13, color: 'var(--fg-secondary)' }}>{client.lastVisit}</span>
      <span style={{ fontSize: 12, color: 'var(--fg-muted)', fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>
        {client.visits} visit{client.visits !== 1 ? 's' : ''}
      </span>
      <Icon name="chevRight" size={16} color="var(--fg-muted)" />
    </button>
  );
}

interface ClientSheetProps {
  client: Client;
  onClose: () => void;
  onUpdateNotes: (id: string, notes: string) => void;
}

function ClientSheet({ client, onClose, onUpdateNotes }: ClientSheetProps) {
  const [notes, setNotes]     = useState(client.notes);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setNotes(client.notes);
    setEditing(false);
  }, [client.id]);

  return (
    <aside style={{
      width: 420, flexShrink: 0,
      background: '#fff',
      borderLeft: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '18px 22px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Eyebrow>Client profile</Eyebrow>
        <IconButton name="close" onClick={onClose} />
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '14px 22px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Identity */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Avatar name={client.name} size={60} />
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{
                fontFamily: 'var(--font-display)', fontSize: 26,
                letterSpacing: '-0.01em', color: 'var(--baari-onyx)', lineHeight: 1.1,
              }}>{client.name}</span>
              {client.vip && <Pill tone="vip">VIP</Pill>}
            </div>
            <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginTop: 6, fontVariantNumeric: 'tabular-nums', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="phone" size={11} />
              {client.phone}
            </div>
          </div>
        </div>

        {/* WhatsApp opt-in */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 14px', borderRadius: 2,
          background: client.whatsappOptIn ? 'rgba(37,211,102,0.07)' : 'var(--baari-cream)',
          border: '1px solid ' + (client.whatsappOptIn ? '#9BD3AC' : 'var(--border-subtle)'),
        }}>
          <Icon name="whatsapp" size={18} color={client.whatsappOptIn ? '#25D366' : 'var(--fg-muted)'} stroke={1.6} />
          <span style={{ flex: 1, fontSize: 13, color: 'var(--baari-onyx)' }}>WhatsApp updates</span>
          <span style={{ fontSize: 12, fontWeight: 500, color: client.whatsappOptIn ? '#1B6E3F' : 'var(--fg-muted)' }}>
            {client.whatsappOptIn ? 'Opted in' : 'Opted out'}
          </span>
        </div>

        {/* Notes */}
        <section>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <Eyebrow>Notes</Eyebrow>
            {!editing ? (
              <button onClick={() => setEditing(true)} style={{
                background: 'transparent', border: 0, cursor: 'pointer', padding: 0,
                color: 'var(--baari-graphite)', fontSize: 11, fontWeight: 500,
                display: 'inline-flex', alignItems: 'center', gap: 4,
              }}>
                <Icon name="edit" size={11} /> Edit
              </button>
            ) : (
              <button onClick={() => { setEditing(false); onUpdateNotes(client.id, notes); }} style={{
                background: 'transparent', border: 0, cursor: 'pointer', padding: 0,
                color: 'var(--baari-ink)', fontSize: 11, fontWeight: 600,
                display: 'inline-flex', alignItems: 'center', gap: 4,
              }}>
                <Icon name="check" size={11} /> Save
              </button>
            )}
          </div>
          {editing ? (
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              autoFocus rows={5}
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'rgba(232, 255, 71, 0.10)',
                border: '1px solid rgba(232, 255, 71, 0.55)',
                borderRadius: 2, padding: 12, resize: 'vertical',
                fontFamily: 'var(--font-body)', fontSize: 13,
                color: 'var(--baari-graphite)', lineHeight: 1.5, outline: 'none',
              }}
            />
          ) : (
            <div style={{
              background: 'rgba(232, 255, 71, 0.10)',
              border: '1px solid rgba(232, 255, 71, 0.35)',
              borderRadius: 2, padding: 12, minHeight: 56,
              fontSize: 13, color: notes ? 'var(--baari-graphite)' : 'var(--fg-muted)',
              lineHeight: 1.5, fontStyle: notes ? 'normal' : 'italic',
            }}>
              {notes || 'No notes yet. Tap Edit to add.'}
            </div>
          )}
        </section>

        {/* Visit history */}
        <section>
          <Eyebrow style={{ marginBottom: 8 }}>Visit history</Eyebrow>
          {client.history.length === 0 ? (
            <div style={{ padding: 14, fontSize: 13, color: 'var(--fg-muted)', fontStyle: 'italic' }}>
              No visits on record.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {client.history.map((h, i) => (
                <div key={i} style={{
                  display: 'grid', gridTemplateColumns: '1fr auto',
                  gap: 10, padding: '12px 0',
                  borderBottom: i < client.history.length - 1 ? '1px solid var(--border-subtle)' : undefined,
                }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: 'var(--baari-onyx)', fontWeight: 500 }}>{h.service}</div>
                    <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 2 }}>
                      {h.date} · with {h.staff}
                    </div>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--fg-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                    {h.amount ? fmtPKR(h.amount) : '—'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </aside>
  );
}
