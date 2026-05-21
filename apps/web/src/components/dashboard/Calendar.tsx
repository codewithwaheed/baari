'use client';

import { useEffect, useRef, useState } from 'react';
import { Avatar, fmtTime } from './primitives';
import { AppointmentCard, APPT_PALETTES } from './AppointmentCard';
import type { DragStartPayload } from './AppointmentCard';
import { StaffPillRow } from './StaffPillRow';
import { useIsMobile } from '../../hooks/useIsMobile';
import type { Appointment, Staff } from './data';

const HOUR_PX    = 76;
const START_HOUR = 8;
const END_HOUR   = 20;
const TIME_GUTTER = 64;
const SNAP_MINS  = 30; // minutes per snap step

const HOURS: number[] = [];
for (let h = START_HOUR; h < END_HOUR; h++) HOURS.push(h);

function toY(hour: number) {
  return (hour - START_HOUR) * HOUR_PX;
}

function snapHour(raw: number): number {
  const step = SNAP_MINS / 60;
  return Math.round(raw / step) * step;
}

interface DragState {
  apptId: string;
  staffId: string;
  duration: number;   // hours
  snapStart: number;  // snapped start time (decimal hours)
}

interface CalendarProps {
  appts: Appointment[];
  staff: Staff[];
  selectedId?: string | null;
  onSelect?: (a: Appointment) => void;
  onMove?: (apptId: string, newStart: number, newEnd: number) => void;
  activeStaffId?: string;
  onStaffChange?: (id: string) => void;
  loading?: boolean;
}

export function Calendar({ appts, staff, selectedId, onSelect, onMove, activeStaffId, onStaffChange, loading = false }: CalendarProps) {
  // Live "now" line
  const [nowHour, setNowHour] = useState(() => {
    const n = new Date();
    return n.getHours() + n.getMinutes() / 60;
  });

  useEffect(() => {
    const id = setInterval(() => {
      const n = new Date();
      setNowHour(n.getHours() + n.getMinutes() / 60);
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  // ─── Drag state ────────────────────────────────────────────────────────────
  // dragRef holds the live value for event handler closures (no stale reads).
  // drag drives re-renders for the ghost overlay.
  const dragRef  = useRef<DragState | null>(null);
  const [drag, setDragState] = useState<DragState | null>(null);

  const setDrag = (s: DragState | null) => { dragRef.current = s; setDragState(s); };

  const containerRef = useRef<HTMLDivElement>(null);
  const headerRef    = useRef<HTMLDivElement>(null);

  // Grabbing cursor + no-select while dragging
  const isDragging = drag !== null;
  useEffect(() => {
    const html = document.documentElement;
    if (isDragging) {
      html.style.cursor = 'grabbing';
      html.style.userSelect = 'none';
    } else {
      html.style.cursor = '';
      html.style.userSelect = '';
    }
    return () => { html.style.cursor = ''; html.style.userSelect = ''; };
  }, [isDragging]);

  // Called by AppointmentCard once drag threshold is crossed.
  // Works for both mouse and touch — caller passes the initial clientY.
  const handleDragStart = (initialClientY: number, { appt, grabY }: DragStartPayload) => {
    if (!containerRef.current) return;

    // Snapshot layout at drag start (avoids repeated reflows during move)
    const containerRect = containerRef.current.getBoundingClientRect();
    const headerH       = headerRef.current?.offsetHeight ?? 0; // 0 on mobile (no sticky header)
    const duration      = appt.end - appt.start;

    const initial: DragState = { apptId: appt.id, staffId: appt.staff, duration, snapStart: appt.start };
    setDrag(initial);

    const updatePos = (clientY: number) => {
      const scrollTop = containerRef.current?.scrollTop ?? 0;
      const relY      = clientY - containerRect.top - headerH + scrollTop - grabY;
      const rawStart  = START_HOUR + relY / HOUR_PX;
      const clamped   = Math.max(START_HOUR, Math.min(END_HOUR - dragRef.current!.duration, snapHour(rawStart)));
      const next      = { ...dragRef.current!, snapStart: clamped };
      dragRef.current = next;
      setDragState({ ...next });
    };

    const commit = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup',   commit);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend',  commit);
      const d = dragRef.current;
      if (d) onMove?.(d.apptId, d.snapStart, d.snapStart + d.duration);
      setDrag(null);
    };

    const onMouseMove = (me: MouseEvent) => updatePos(me.clientY);
    const onTouchMove = (te: TouchEvent) => { te.preventDefault(); updatePos(te.touches[0]!.clientY); };

    updatePos(initialClientY);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup',   commit);
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend',  commit);
  };

  const showNow = nowHour >= START_HOUR && nowHour <= END_HOUR;

  const isMobile = useIsMobile();
  const activeStaff: Staff | undefined = staff.find(s => s.id === activeStaffId) ?? staff[0];
  const mobileAppts = activeStaff ? appts.filter(a => a.staff === activeStaff.id) : [];

  if (isMobile) {
    return (
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#fff', fontFamily: 'var(--font-body)' }}>
        <StaffPillRow
          staff={staff}
          activeId={activeStaff?.id ?? ''}
          onChange={id => onStaffChange?.(id)}
        />
        <div ref={containerRef} style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: `${TIME_GUTTER}px 1fr`,
            minHeight: (END_HOUR - START_HOUR) * HOUR_PX,
            position: 'relative',
          }}>
            {/* Time gutter */}
            <div style={{ borderRight: '1px solid var(--border-subtle)' }}>
              {HOURS.map(h => (
                <div key={h} style={{
                  height: HOUR_PX, paddingRight: 10, paddingTop: 4,
                  textAlign: 'right', fontSize: 11, color: 'var(--fg-muted)', letterSpacing: '0.04em',
                }}>
                  {fmtTime(h)}
                </div>
              ))}
            </div>
            {/* Single staff column */}
            <div style={{ position: 'relative', background: '#fff' }}>
              {HOURS.map((h, i) => (
                <div key={h} style={{
                  position: 'absolute', top: i * HOUR_PX, left: 0, right: 0, height: HOUR_PX,
                  borderBottom: i < HOURS.length - 1 ? '1px solid var(--border-subtle)' : undefined,
                }} />
              ))}
              {mobileAppts.map(a => (
                <AppointmentCard
                  key={a.id}
                  appt={a}
                  top={toY(a.start)}
                  height={(a.end - a.start) * HOUR_PX}
                  selected={selectedId === a.id}
                  isDragging={drag?.apptId === a.id}
                  onClick={() => onSelect?.(a)}
                  onDragStart={handleDragStart}
                />
              ))}
              {mobileAppts.length === 0 && !drag && (
                <div style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--fg-muted)', fontSize: 13,
                }}>
                  No appointments today
                </div>
              )}

              {/* Mobile drag ghost */}
              {drag && (() => {
                const ghostAppt = mobileAppts.find(a => a.id === drag.apptId);
                if (!ghostAppt) return null;
                const gp = APPT_PALETTES[ghostAppt.status] ?? APPT_PALETTES.confirmed;
                return (
                  <div
                    aria-hidden="true"
                    style={{
                      position: 'absolute',
                      top: toY(drag.snapStart), left: 4, right: 4,
                      height: drag.duration * HOUR_PX - 4,
                      background: gp.bg,
                      border: `1px solid ${gp.accent}`,
                      borderLeft: `3px solid ${gp.accent}`,
                      borderRadius: 4,
                      boxShadow: '0 6px 24px rgba(40,34,25,0.18), 0 0 0 2.5px rgba(232,255,71,0.55)',
                      opacity: 0.96,
                      pointerEvents: 'none',
                      zIndex: 20,
                      display: 'flex', flexDirection: 'column',
                      padding: '8px 10px', gap: 4, overflow: 'hidden',
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 600, color: gp.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {ghostAppt.client}
                    </span>
                    <span style={{ fontSize: 11, color: gp.accent, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                      {fmtTime(drag.snapStart)} – {fmtTime(drag.snapStart + drag.duration)}
                    </span>
                  </div>
                );
              })()}
            </div>
            {/* Now line */}
            {showNow && (
              <div style={{
                position: 'absolute', top: toY(nowHour), left: TIME_GUTTER, right: 0,
                borderTop: '2px solid var(--baari-lime)', pointerEvents: 'none', zIndex: 4,
              }}>
                <div style={{
                  position: 'absolute', left: -6, top: -6, width: 10, height: 10,
                  borderRadius: 999, background: 'var(--baari-lime)',
                  boxShadow: '0 0 0 4px rgba(232, 255, 71, 0.18)',
                }} />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{ flex: 1, minWidth: 0, overflow: 'auto', background: '#fff', fontFamily: 'var(--font-body)' }}
    >
      {/* Sticky staff header */}
      <div ref={headerRef} style={{
        position: 'sticky', top: 0, zIndex: 5,
        display: 'grid',
        gridTemplateColumns: `${TIME_GUTTER}px repeat(${staff.length}, 1fr)`,
        background: '#fff', borderBottom: '1px solid var(--border)',
      }}>
        <div />
        {staff.map(s => (
          <div key={s.id} style={{
            padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10,
            borderLeft: '1px solid var(--border-subtle)',
          }}>
            <Avatar name={s.name} size={32} color={s.color} />
            <div style={{ lineHeight: 1.15 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--baari-onyx)' }}>{s.name}</div>
              <div style={{ fontSize: 11, color: 'var(--fg-muted)' }}>{s.role}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Grid */}
      <div style={{
        position: 'relative',
        display: 'grid',
        gridTemplateColumns: `${TIME_GUTTER}px repeat(${staff.length}, 1fr)`,
        minHeight: (END_HOUR - START_HOUR) * HOUR_PX,
      }}>
        {/* Time gutter */}
        <div style={{ position: 'relative', borderRight: '1px solid var(--border-subtle)' }}>
          {HOURS.map(h => (
            <div key={h} style={{
              height: HOUR_PX, paddingRight: 10, paddingTop: 4,
              textAlign: 'right', fontSize: 11, color: 'var(--fg-muted)', letterSpacing: '0.04em',
            }}>
              {fmtTime(h)}
            </div>
          ))}
        </div>

        {/* Staff columns */}
        {staff.map(s => {
          const ghostAppt = drag?.staffId === s.id ? appts.find(a => a.id === drag.apptId) : null;
          const gp = ghostAppt ? (APPT_PALETTES[ghostAppt.status] ?? APPT_PALETTES.confirmed) : null;

          const staffAppts = appts.filter(a => a.staff === s.id);

          return (
            <div key={s.id} style={{
              position: 'relative', borderLeft: '1px solid var(--border-subtle)', background: '#fff',
            }}>
              {/* Hour + half-hour grid lines */}
              {HOURS.map((h, i) => (
                <div key={h} style={{
                  position: 'absolute', top: i * HOUR_PX, left: 0, right: 0, height: HOUR_PX,
                  borderBottom: i < HOURS.length - 1 ? '1px solid var(--border-subtle)' : undefined,
                }}>
                  {/* Half-hour dashed line */}
                  <div style={{
                    position: 'absolute', top: HOUR_PX / 2, left: 0, right: 0,
                    borderTop: '1px dashed rgba(0,0,0,0.07)',
                  }} />
                </div>
              ))}

              {/* Appointments */}
              {staffAppts.map(a => (
                <AppointmentCard
                  key={a.id}
                  appt={a}
                  top={toY(a.start)}
                  height={(a.end - a.start) * HOUR_PX}
                  selected={selectedId === a.id}
                  isDragging={drag?.apptId === a.id}
                  onClick={() => onSelect?.(a)}
                  onDragStart={handleDragStart}
                />
              ))}

              {/* Empty state */}
              {!loading && staffAppts.length === 0 && (
                <div style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  pointerEvents: 'none',
                }}>
                  <span style={{
                    fontSize: 11, color: 'var(--fg-muted)', letterSpacing: '0.03em',
                    background: 'rgba(255,255,255,0.85)', padding: '4px 10px', borderRadius: 99,
                  }}>Free today</span>
                </div>
              )}

              {/* Skeleton cards while loading */}
              {loading && [0.35, 0.5, 0.28].map((h, i) => (
                <div key={i} style={{
                  position: 'absolute',
                  top: toY(START_HOUR + 1 + i * 3.2),
                  left: 4, right: 4,
                  height: h * HOUR_PX * 2,
                  borderRadius: 4,
                  background: 'linear-gradient(90deg, #f0ede8 25%, #e8e4dd 50%, #f0ede8 75%)',
                  backgroundSize: '200% 100%',
                  animation: 'baari-shimmer 1.5s infinite',
                  opacity: 0.7,
                }} />
              ))}

              {/* Drag ghost — elevated card that follows the cursor */}
              {drag && ghostAppt && gp && (
                <div
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    top: toY(drag.snapStart), left: 4, right: 4,
                    height: drag.duration * HOUR_PX - 4,
                    background: gp.bg,
                    border: `1px solid ${gp.accent}`,
                    borderLeft: `3px solid ${gp.accent}`,
                    borderRadius: 4,
                    // Lime halo + drop shadow for the "lifted" feel
                    boxShadow: '0 6px 24px rgba(40,34,25,0.18), 0 0 0 2.5px rgba(232,255,71,0.55)',
                    opacity: 0.96,
                    pointerEvents: 'none',
                    zIndex: 20,
                    display: 'flex', flexDirection: 'column',
                    padding: '8px 10px', gap: 4,
                    overflow: 'hidden',
                  }}
                >
                  <span style={{
                    fontSize: 13, fontWeight: 600, lineHeight: 1.15, color: gp.text,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {ghostAppt.client}
                  </span>
                  {/* Updated time shown live as you drag */}
                  <span style={{
                    fontSize: 11, color: gp.accent, fontWeight: 600,
                    fontVariantNumeric: 'tabular-nums', letterSpacing: '0.01em',
                  }}>
                    {fmtTime(drag.snapStart)} – {fmtTime(drag.snapStart + drag.duration)}
                  </span>
                  {ghostAppt.service && drag.duration * HOUR_PX > 56 && (
                    <span style={{ fontSize: 11, color: gp.text, opacity: 0.7, lineHeight: 1.3 }}>
                      {ghostAppt.service}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Now line */}
        {showNow && (
          <div style={{
            position: 'absolute', top: toY(nowHour), left: TIME_GUTTER, right: 0,
            borderTop: '2px solid var(--baari-lime)',
            pointerEvents: 'none', zIndex: 4,
          }}>
            <div style={{
              position: 'absolute', left: -6, top: -6, width: 10, height: 10,
              borderRadius: 999, background: 'var(--baari-lime)',
              boxShadow: '0 0 0 4px rgba(232, 255, 71, 0.18)',
            }} />
          </div>
        )}
      </div>
    </div>
  );
}
