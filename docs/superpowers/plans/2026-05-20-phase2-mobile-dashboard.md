# Phase 2 Mobile-First Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Baari dashboard truly mobile-first — compact topbar, single-staff calendar with staff pill switcher, bottom sheet for appointment details, raised-centre FAB in BottomNav, and a proper Baari B monogram in the sidebar.

**Architecture:** All changes live inside `apps/web/src/`. A `useIsMobile` hook (SSR-safe) drives conditional layout in Calendar and page.tsx. A new `BottomSheet` component wraps the existing `AppointmentPanel` on mobile. Desktop behaviour is preserved exactly — the right panel still shows on ≥768px.

**Tech Stack:** Next.js 15, React 18, TypeScript, inline styles + CSS classes (existing pattern), no new dependencies.

---

## File Map

| Action   | Path                                                              | Responsibility                                  |
|----------|-------------------------------------------------------------------|-------------------------------------------------|
| Create   | `apps/web/src/hooks/useIsMobile.ts`                              | SSR-safe window width hook                      |
| Create   | `apps/web/src/components/dashboard/BottomSheet.tsx`              | Slide-up sheet with drag-to-dismiss             |
| Create   | `apps/web/src/components/dashboard/StaffPillRow.tsx`             | Horizontal staff switcher pills                 |
| Modify   | `apps/web/src/styles/baari.css`                                  | Bottom sheet CSS, pill row, compact topbar      |
| Modify   | `apps/web/src/components/dashboard/BottomNav.tsx`                | 4 tabs + raised centre FAB, remove POS tab      |
| Modify   | `apps/web/src/components/dashboard/Topbar.tsx`                   | 44px compact mobile, inline date nav            |
| Modify   | `apps/web/src/components/dashboard/Calendar.tsx`                 | Mobile single-staff view + StaffPillRow         |
| Modify   | `apps/web/src/components/dashboard/Sidebar.tsx`                  | Baari B monogram placeholder                    |
| Modify   | `apps/web/src/app/dashboard/page.tsx`                            | Wire activeStaff, bottomSheet, FAB              |
| Modify   | `apps/web/src/components/dashboard/index.ts`                     | Export BottomSheet, StaffPillRow                |

---

## Task 1: `useIsMobile` hook

**Files:**
- Create: `apps/web/src/hooks/useIsMobile.ts`

- [ ] **Step 1: Create the hook**

```ts
// apps/web/src/hooks/useIsMobile.ts
'use client';

import { useEffect, useState } from 'react';

export function useIsMobile(breakpoint = 768): boolean {
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    setMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [breakpoint]);

  return mobile;
}
```

- [ ] **Step 2: Type-check**

```bash
cd /Users/m3/Work/baari/.claude/worktrees/friendly-bohr-9af6cc
pnpm --filter @baari/web typecheck
```
Expected: no errors (new file, no imports yet).

- [ ] **Step 3: Commit**

```bash
cd /Users/m3/Work/baari/.claude/worktrees/friendly-bohr-9af6cc
git add apps/web/src/hooks/useIsMobile.ts
git commit -m "feat(web): add useIsMobile SSR-safe hook"
```

---

## Task 2: `BottomSheet` component

**Files:**
- Create: `apps/web/src/components/dashboard/BottomSheet.tsx`
- Modify: `apps/web/src/styles/baari.css` (add sheet animation class)

- [ ] **Step 1: Add CSS for bottom sheet animation**

Append to `apps/web/src/styles/baari.css`:

```css
/* ─── Bottom sheet ─────────────────────────────────────────────────────────── */
@keyframes sheet-up {
  from { transform: translateY(100%); }
  to   { transform: translateY(0); }
}

.bottom-sheet-overlay {
  position: fixed; inset: 0; z-index: 50;
  background: rgba(13,13,13,0.55);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
}

.bottom-sheet-panel {
  position: fixed;
  bottom: 0; left: 0; right: 0;
  height: 88%;
  background: var(--baari-cream);
  border-radius: 16px 16px 0 0;
  overflow: hidden;
  animation: sheet-up 260ms cubic-bezier(0.22, 1, 0.36, 1) both;
  display: flex; flex-direction: column;
  /* safe area for iPhone home indicator */
  padding-bottom: env(safe-area-inset-bottom);
}
```

- [ ] **Step 2: Create the component**

```tsx
// apps/web/src/components/dashboard/BottomSheet.tsx
'use client';

import { useEffect, useRef } from 'react';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export function BottomSheet({ open, onClose, children }: BottomSheetProps) {
  const startYRef = useRef<number>(0);
  const panelRef  = useRef<HTMLDivElement>(null);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  const handleTouchStart = (e: React.TouchEvent) => {
    startYRef.current = e.touches[0]!.clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const delta = e.changedTouches[0]!.clientY - startYRef.current;
    if (delta > 80) onClose(); // dragged down 80px → dismiss
  };

  return (
    <div
      className="bottom-sheet-overlay"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={panelRef}
        className="bottom-sheet-panel"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drag handle */}
        <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'center', padding: '12px 0 8px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 999, background: 'var(--baari-sand)' }} />
        </div>
        {/* Scrollable content */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          {children}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Export from index**

In `apps/web/src/components/dashboard/index.ts`, add:
```ts
export { BottomSheet } from './BottomSheet';
```

- [ ] **Step 4: Type-check**

```bash
cd /Users/m3/Work/baari/.claude/worktrees/friendly-bohr-9af6cc
pnpm --filter @baari/web typecheck
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd /Users/m3/Work/baari/.claude/worktrees/friendly-bohr-9af6cc
git add apps/web/src/components/dashboard/BottomSheet.tsx \
        apps/web/src/components/dashboard/index.ts \
        apps/web/src/styles/baari.css
git commit -m "feat(web): add BottomSheet component with drag-to-dismiss"
```

---

## Task 3: `StaffPillRow` component

**Files:**
- Create: `apps/web/src/components/dashboard/StaffPillRow.tsx`
- Modify: `apps/web/src/styles/baari.css` (hide scrollbar on pill row)

- [ ] **Step 1: Add CSS for pill row scrollbar hiding**

Append to `apps/web/src/styles/baari.css`:

```css
/* ─── Staff pill row ───────────────────────────────────────────────────────── */
.staff-pill-row {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 10px 12px;
  flex-shrink: 0;
  background: #fff;
  border-bottom: 1px solid var(--border-subtle);
  scrollbar-width: none;
}
.staff-pill-row::-webkit-scrollbar { display: none; }
```

- [ ] **Step 2: Create the component**

```tsx
// apps/web/src/components/dashboard/StaffPillRow.tsx
'use client';

import { Avatar } from './primitives';
import type { Staff } from './data';

interface StaffPillRowProps {
  staff: Staff[];
  activeId: string;
  onChange: (id: string) => void;
}

export function StaffPillRow({ staff, activeId, onChange }: StaffPillRowProps) {
  return (
    <div className="staff-pill-row">
      {staff.map(s => {
        const isActive = s.id === activeId;
        return (
          <button
            key={s.id}
            onClick={() => onChange(s.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '6px 12px 6px 8px',
              borderRadius: 999,
              border: isActive ? '1.5px solid var(--baari-onyx)' : '1.5px solid var(--border)',
              background: isActive ? 'var(--baari-onyx)' : '#fff',
              color: isActive ? 'var(--baari-lime)' : 'var(--baari-graphite)',
              fontFamily: 'var(--font-body)',
              fontSize: 13,
              fontWeight: isActive ? 600 : 400,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              transition: 'all 140ms ease',
            }}
          >
            <Avatar name={s.name} size={22} color={s.color} />
            <span>{s.name.split(' ')[0]}</span>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Export from index**

In `apps/web/src/components/dashboard/index.ts`, add:
```ts
export { StaffPillRow } from './StaffPillRow';
```

- [ ] **Step 4: Type-check**

```bash
cd /Users/m3/Work/baari/.claude/worktrees/friendly-bohr-9af6cc
pnpm --filter @baari/web typecheck
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd /Users/m3/Work/baari/.claude/worktrees/friendly-bohr-9af6cc
git add apps/web/src/components/dashboard/StaffPillRow.tsx \
        apps/web/src/components/dashboard/index.ts \
        apps/web/src/styles/baari.css
git commit -m "feat(web): add StaffPillRow horizontal staff switcher"
```

---

## Task 4: BottomNav — raised centre FAB

**Files:**
- Modify: `apps/web/src/components/dashboard/BottomNav.tsx`

**Decision recorded:** The POS tab is removed from BottomNav. POS is only accessible via the Checkout button inside the appointment panel. Tab layout: Calendar | Requests | [+ FAB] | Clients | Settings.

- [ ] **Step 1: Rewrite BottomNav**

Replace the full contents of `apps/web/src/components/dashboard/BottomNav.tsx` with:

```tsx
'use client';

import { Icon } from './primitives';
import type { NavId } from './data';

interface BottomNavProps {
  active: NavId;
  onNavigate: (id: NavId) => void;
  onNew: () => void;
  requestsCount?: number;
}

const LEFT_TABS: { id: NavId; label: string; icon: Parameters<typeof Icon>[0]['name'] }[] = [
  { id: 'calendar', label: 'Calendar', icon: 'calendar' },
  { id: 'requests', label: 'Requests', icon: 'inbox'    },
];

const RIGHT_TABS: { id: NavId; label: string; icon: Parameters<typeof Icon>[0]['name'] }[] = [
  { id: 'clients',  label: 'Clients',  icon: 'user'     },
  { id: 'settings', label: 'Settings', icon: 'settings' },
];

export function BottomNav({ active, onNavigate, onNew, requestsCount = 0 }: BottomNavProps) {
  const tabs = [...LEFT_TABS, ...RIGHT_TABS];

  const renderTab = (tab: typeof LEFT_TABS[0]) => {
    const isActive  = tab.id === active;
    const showBadge = tab.id === 'requests' && requestsCount > 0;
    return (
      <button
        key={tab.id}
        onClick={() => onNavigate(tab.id)}
        style={{
          flex: 1,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 3,
          background: 'transparent', border: 0, cursor: 'pointer',
          color: isActive ? 'var(--baari-lime)' : 'rgba(255,255,255,0.45)',
          fontFamily: 'var(--font-body)', fontSize: 10,
          fontWeight: isActive ? 600 : 400,
          position: 'relative',
          transition: 'color 120ms ease',
          borderTop: isActive ? '2px solid var(--baari-lime)' : '2px solid transparent',
          paddingTop: 2,
        }}
      >
        <Icon name={tab.icon} size={20} stroke={isActive ? 2 : 1.6} />
        <span>{tab.label}</span>
        {showBadge && (
          <span style={{
            position: 'absolute', top: 6, right: 'calc(50% - 16px)',
            background: 'var(--baari-lime)', color: 'var(--baari-onyx)',
            fontSize: 9, fontWeight: 700,
            minWidth: 16, height: 16, borderRadius: 999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 3px',
          }}>
            {requestsCount}
          </span>
        )}
      </button>
    );
  };

  return (
    <nav
      className="dashboard-bottom-nav"
      style={{
        flexShrink: 0,
        height: 64,
        background: 'var(--baari-onyx)',
        borderTop: '1px solid #1a1815',
        display: 'flex', alignItems: 'stretch',
        fontFamily: 'var(--font-body)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        position: 'relative',
      }}
    >
      {LEFT_TABS.map(renderTab)}

      {/* Raised centre FAB */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: 3, position: 'relative',
      }}>
        <button
          onClick={onNew}
          aria-label="New booking"
          style={{
            width: 48, height: 48,
            borderRadius: 999,
            background: 'var(--baari-lime)',
            border: '3px solid var(--baari-onyx)',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'absolute',
            top: -20,
            boxShadow: '0 4px 16px rgba(232,255,71,0.35)',
            transition: 'transform 120ms ease, box-shadow 120ms ease',
          }}
          onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.93)')}
          onMouseUp={e => (e.currentTarget.style.transform = '')}
          onTouchStart={e => (e.currentTarget.style.transform = 'scale(0.93)')}
          onTouchEnd={e => (e.currentTarget.style.transform = '')}
        >
          <Icon name="plus" size={22} color="var(--baari-onyx)" stroke={2.5} />
        </button>
        <span style={{
          fontSize: 10, color: 'rgba(255,255,255,0.45)',
          fontFamily: 'var(--font-body)', position: 'absolute', bottom: 8,
        }}>New</span>
      </div>

      {RIGHT_TABS.map(renderTab)}
    </nav>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd /Users/m3/Work/baari/.claude/worktrees/friendly-bohr-9af6cc
pnpm --filter @baari/web typecheck
```
Expected: error on `page.tsx` because `onNew` prop is now required. That's fine — we fix it in Task 7.

- [ ] **Step 3: Commit**

```bash
cd /Users/m3/Work/baari/.claude/worktrees/friendly-bohr-9af6cc
git add apps/web/src/components/dashboard/BottomNav.tsx
git commit -m "feat(web): BottomNav — raised centre FAB, 4 tabs"
```

---

## Task 5: Topbar — compact mobile

**Files:**
- Modify: `apps/web/src/components/dashboard/Topbar.tsx`
- Modify: `apps/web/src/styles/baari.css`

- [ ] **Step 1: Add topbar mobile CSS**

Append to `apps/web/src/styles/baari.css`:

```css
/* ─── Topbar compact mobile ────────────────────────────────────────────────── */
/* Elements hidden/shown on mobile are toggled via these classes */
.topbar-user-name  { }          /* hide on mobile */
.topbar-date-nav   { }          /* always visible on calendar */
.topbar-avatar-sm  { display: none; }  /* compact avatar — shown on mobile */

@media (max-width: 767px) {
  .topbar-user-name  { display: none !important; }
  .topbar-avatar-sm  { display: flex !important; }
  /* topbar-search and topbar-new-btn already hidden via existing rules */
}
```

- [ ] **Step 2: Rewrite Topbar**

Replace full contents of `apps/web/src/components/dashboard/Topbar.tsx`:

```tsx
'use client';

import { Icon, IconButton, DButton, Avatar } from './primitives';

interface TopbarProps {
  title: string;
  date?: Date;
  onDateChange?: (d: Date) => void;
  onNew?: () => void;
  showDate?: boolean;
  showSearch?: boolean;
  userName?: string;
  userRole?: string;
}

const FMT_COMPACT = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const FMT_FULL    = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

function stepDate(date: Date, delta: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + delta);
  return d;
}

export function Topbar({
  title, date, onDateChange, onNew,
  showDate = false, showSearch = true,
  userName = 'Owner', userRole = 'owner',
}: TopbarProps) {
  const isToday = date ? new Date().toDateString() === date.toDateString() : false;

  return (
    <header style={{
      /* Desktop: 56px. Mobile: 44px via media query below */
      height: 56, flexShrink: 0,
      background: '#fff',
      borderBottom: '1px solid var(--border)',
      display: 'flex', alignItems: 'center',
      padding: '0 12px 0 16px', gap: 8,
      fontFamily: 'var(--font-body)',
      position: 'relative',
    }}>
      {/* Page title — display font on desktop, body font smaller on mobile */}
      <h1 style={{
        fontFamily: 'var(--font-display)',
        fontSize: 22, fontWeight: 400, margin: 0,
        color: 'var(--baari-onyx)', letterSpacing: '-0.01em',
        flexShrink: 0,
        /* Mobile: smaller — set via inline media override not possible inline;
           we rely on the .topbar-title class in CSS */
      }} className="topbar-title">{title}</h1>

      {/* Date navigation — calendar only */}
      {showDate && date && (
        <div className="topbar-date-nav" style={{
          display: 'flex', alignItems: 'center', gap: 2, marginLeft: 4,
        }}>
          <IconButton name="chevLeft" size={28} onClick={() => onDateChange?.(stepDate(date, -1))} />
          <button
            onClick={() => onDateChange?.(new Date())}
            style={{
              padding: '4px 10px', background: 'transparent',
              border: '1px solid var(--border)', borderRadius: 6,
              fontFamily: 'inherit', fontSize: 12, fontWeight: 500,
              cursor: 'pointer', color: 'var(--baari-onyx)',
              whiteSpace: 'nowrap',
            }}
          >{isToday ? 'Today' : 'Go to today'}</button>
          <IconButton name="chevRight" size={28} onClick={() => onDateChange?.(stepDate(date, 1))} />
          {/* Date label — hidden on mobile where space is tight */}
          <div className="topbar-date-label" style={{
            marginLeft: 6, display: 'flex', flexDirection: 'column', lineHeight: 1.2,
          }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--baari-onyx)' }}>
              {isToday ? 'Today' : FMT_COMPACT.format(date)}
            </span>
            <span style={{ fontSize: 10, color: 'var(--fg-muted)' }}>{FMT_FULL.format(date)}</span>
          </div>
        </div>
      )}

      <div style={{ flex: 1 }} />

      {/* Search — desktop only */}
      {showSearch && (
        <div className="topbar-search" style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'var(--baari-bone)', borderRadius: 6,
          padding: '6px 12px', width: 220,
        }}>
          <Icon name="search" size={13} color="var(--fg-muted)" />
          <input
            placeholder="Search clients, services…"
            style={{
              flex: 1, border: 0, background: 'transparent', outline: 'none',
              fontFamily: 'inherit', fontSize: 13, color: 'var(--baari-onyx)',
            }}
          />
        </div>
      )}

      {/* New booking button — desktop only */}
      {showDate && (
        <div className="topbar-new-btn">
          <DButton variant="primary" leadingIcon="plus" onClick={onNew}>New booking</DButton>
        </div>
      )}

      {/* User identity — desktop */}
      <div className="topbar-user-name" style={{
        display: 'flex', alignItems: 'center', gap: 8,
        paddingLeft: 10, borderLeft: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <Avatar name={userName} size={28} />
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--baari-onyx)', whiteSpace: 'nowrap' }}>
            {userName.split(' ')[0]}
          </span>
          <span style={{ fontSize: 10, color: 'var(--fg-muted)', textTransform: 'capitalize', whiteSpace: 'nowrap' }}>
            {userRole}
          </span>
        </div>
      </div>

      {/* User avatar — mobile only (compact, no name) */}
      <div className="topbar-avatar-sm" style={{
        alignItems: 'center', flexShrink: 0,
      }}>
        <Avatar name={userName} size={28} />
      </div>
    </header>
  );
}
```

- [ ] **Step 3: Add topbar mobile height + title size CSS**

Append to `apps/web/src/styles/baari.css`:

```css
@media (max-width: 767px) {
  /* Compact topbar height on mobile */
  header.topbar-compact,
  header { min-height: 44px; height: 44px; }

  .topbar-title {
    font-size: 15px !important;
    font-family: var(--font-body) !important;
    font-weight: 600 !important;
    letter-spacing: 0 !important;
  }

  .topbar-date-label { display: none !important; }
}
```

- [ ] **Step 4: Type-check**

```bash
cd /Users/m3/Work/baari/.claude/worktrees/friendly-bohr-9af6cc
pnpm --filter @baari/web typecheck
```
Expected: no errors (or only the pre-existing BottomNav `onNew` error from Task 4).

- [ ] **Step 5: Commit**

```bash
cd /Users/m3/Work/baari/.claude/worktrees/friendly-bohr-9af6cc
git add apps/web/src/components/dashboard/Topbar.tsx \
        apps/web/src/styles/baari.css
git commit -m "feat(web): compact mobile topbar — 44px, inline date nav"
```

---

## Task 6: Calendar — mobile single-staff view

**Files:**
- Modify: `apps/web/src/components/dashboard/Calendar.tsx`

- [ ] **Step 1: Update Calendar props interface and imports**

At the top of `Calendar.tsx`, update the imports and interface:

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { Avatar, fmtTime } from './primitives';
import { AppointmentCard, APPT_PALETTES } from './AppointmentCard';
import type { DragStartPayload } from './AppointmentCard';
import { STAFF } from './data';
import type { Appointment, Staff } from './data';
import { StaffPillRow } from './StaffPillRow';
import { useIsMobile } from '../../hooks/useIsMobile';
```

Update the `CalendarProps` interface:

```tsx
interface CalendarProps {
  appts: Appointment[];
  selectedId?: string | null;
  onSelect?: (a: Appointment) => void;
  onMove?: (apptId: string, newStart: number, newEnd: number) => void;
  activeStaffId?: string;
  onStaffChange?: (id: string) => void;
}
```

- [ ] **Step 2: Add mobile single-staff view inside Calendar**

Update the `Calendar` function signature to accept the new props:

```tsx
export function Calendar({ appts, selectedId, onSelect, onMove, activeStaffId, onStaffChange }: CalendarProps) {
```

Then, directly before the `return` statement, add:

```tsx
  const isMobile = useIsMobile();
  const activeStaff: Staff = STAFF.find(s => s.id === activeStaffId) ?? STAFF[0]!;
  const mobileAppts = appts.filter(a => a.staff === activeStaff.id);
```

- [ ] **Step 3: Add mobile layout branch to the return**

Replace the existing `return (` block with a conditional that returns the mobile layout when `isMobile` is true:

```tsx
  if (isMobile) {
    return (
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#fff', fontFamily: 'var(--font-body)' }}>
        {/* Staff pill switcher */}
        <StaffPillRow
          staff={STAFF}
          activeId={activeStaff.id}
          onChange={id => onStaffChange?.(id)}
        />

        {/* Single-staff timeline */}
        <div ref={containerRef} style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
          {/* Time gutter + single column grid */}
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
              {/* Grid lines */}
              {HOURS.map((h, i) => (
                <div key={h} style={{
                  position: 'absolute', top: i * HOUR_PX, left: 0, right: 0, height: HOUR_PX,
                  borderBottom: i < HOURS.length - 1 ? '1px solid var(--border-subtle)' : undefined,
                }} />
              ))}

              {/* Appointment cards */}
              {mobileAppts.map(a => (
                <AppointmentCard
                  key={a.id}
                  appt={a}
                  top={toY(a.start)}
                  height={(a.end - a.start) * HOUR_PX}
                  selected={selectedId === a.id}
                  isDragging={false}
                  onClick={() => onSelect?.(a)}
                  onDragStart={() => {}}
                />
              ))}

              {/* Empty state */}
              {mobileAppts.length === 0 && (
                <div style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--fg-muted)', fontSize: 13,
                }}>
                  No appointments today
                </div>
              )}
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
```

The existing desktop `return (...)` block follows unchanged.

- [ ] **Step 4: Type-check**

```bash
cd /Users/m3/Work/baari/.claude/worktrees/friendly-bohr-9af6cc
pnpm --filter @baari/web typecheck
```
Expected: no errors (or only the pre-existing BottomNav error).

- [ ] **Step 5: Commit**

```bash
cd /Users/m3/Work/baari/.claude/worktrees/friendly-bohr-9af6cc
git add apps/web/src/components/dashboard/Calendar.tsx
git commit -m "feat(web): Calendar mobile single-staff view with StaffPillRow"
```

---

## Task 7: Sidebar — Baari B monogram

**Files:**
- Modify: `apps/web/src/components/dashboard/Sidebar.tsx`

- [ ] **Step 1: Replace lime initial chip with Baari B monogram**

In `Sidebar.tsx`, find the salon identity chip block (lines ~105–129) and replace it with:

```tsx
      {/* Salon identity chip */}
      <div style={{
        margin: '0 12px 16px',
        padding: '10px 12px',
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 6,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        {/* Baari B monogram placeholder — replaced by salon logo once uploaded */}
        <div style={{
          width: 32, height: 32, borderRadius: 6,
          background: 'var(--baari-onyx)',
          border: '1.5px solid rgba(232,255,71,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, overflow: 'hidden',
        }}>
          <span style={{
            fontFamily: 'var(--font-display)',
            fontStyle: 'italic', fontWeight: 700,
            fontSize: 18, lineHeight: 1,
            color: 'var(--baari-lime)',
            letterSpacing: '-0.03em',
            userSelect: 'none',
          }}>B</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {tenantName || 'My Salon'}
          </div>
          {tenantCity && (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{tenantCity}</div>
          )}
        </div>
      </div>
```

Also remove the `initials` variable that's no longer used (line ~86: `const initials = tenantName.slice(0, 1).toUpperCase();`).

- [ ] **Step 2: Type-check**

```bash
cd /Users/m3/Work/baari/.claude/worktrees/friendly-bohr-9af6cc
pnpm --filter @baari/web typecheck
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/m3/Work/baari/.claude/worktrees/friendly-bohr-9af6cc
git add apps/web/src/components/dashboard/Sidebar.tsx
git commit -m "feat(web): Sidebar — Baari B monogram placeholder for salon logo"
```

---

## Task 8: Wire everything together in `page.tsx`

**Files:**
- Modify: `apps/web/src/app/dashboard/page.tsx`

- [ ] **Step 1: Add new imports and state**

At the top of `page.tsx`, add to imports:

```tsx
import { BottomSheet } from '@/components/dashboard/BottomSheet';
import { useIsMobile } from '@/hooks/useIsMobile';
import { STAFF } from '@/components/dashboard/data';
```

Inside `DashboardPage()`, add new state:

```tsx
  const isMobile = useIsMobile();
  const [activeStaffId, setActiveStaffId] = useState<string>(STAFF[0]!.id);
  const [sheetOpen, setSheetOpen] = useState(false);
```

- [ ] **Step 2: Update appointment selection to open bottom sheet on mobile**

Replace the `onSelect` handler in the Calendar component call:

```tsx
onSelect={(a) => {
  setSelectedAppt(a);
  setPosAppt(null);
  if (isMobile) setSheetOpen(true);
}}
```

- [ ] **Step 3: Pass activeStaffId to Calendar**

Update the Calendar JSX to pass the new props:

```tsx
<Calendar
  appts={appts}
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
```

- [ ] **Step 4: Pass `onNew` to BottomNav**

Update the BottomNav JSX:

```tsx
<BottomNav
  active={nav}
  onNavigate={navigate}
  onNew={() => setModalOpen(true)}
  requestsCount={requests.length}
/>
```

- [ ] **Step 5: Add BottomSheet with AppointmentPanel inside**

After the `NewBookingModal`, add the mobile bottom sheet:

```tsx
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
```

- [ ] **Step 6: Type-check — expect clean**

```bash
cd /Users/m3/Work/baari/.claude/worktrees/friendly-bohr-9af6cc
pnpm --filter @baari/web typecheck
```
Expected: **zero errors**.

- [ ] **Step 7: Commit**

```bash
cd /Users/m3/Work/baari/.claude/worktrees/friendly-bohr-9af6cc
git add apps/web/src/app/dashboard/page.tsx
git commit -m "feat(web): wire mobile bottom sheet, staff switcher, FAB in page.tsx"
```

---

## Task 9: Manual browser verification

- [ ] **Step 1: Start dev server**

```bash
cd /Users/m3/Work/baari/.claude/worktrees/friendly-bohr-9af6cc
pnpm dev
```
Open `http://localhost:3000/dashboard`

- [ ] **Step 2: Desktop checks (≥768px)**

- [ ] Sidebar visible, Baari B monogram shows in lime italic on dark chip
- [ ] Topbar shows page title + date nav on calendar, user avatar + name on right
- [ ] Calendar shows 4 staff columns side-by-side
- [ ] Clicking an appointment opens the right panel (AppointmentPanel)
- [ ] BottomNav hidden

- [ ] **Step 3: Mobile checks (≤767px, use DevTools responsive mode at 390px)**

- [ ] BottomNav visible: Calendar | Requests | [lime raised FAB] | Clients | Settings
- [ ] FAB taps open NewBookingModal
- [ ] Topbar is compact (~44px), title in body font 15px
- [ ] Calendar shows staff pill row + single-column timeline
- [ ] Tapping a staff pill switches the timeline to that staff's appointments
- [ ] Tapping an appointment card opens the bottom sheet (slides up)
- [ ] Drag handle visible at top of sheet
- [ ] Dragging the sheet down >80px closes it
- [ ] Tapping the dark overlay closes the sheet
- [ ] Sidebar hidden

- [ ] **Step 4: Final commit if clean**

```bash
cd /Users/m3/Work/baari/.claude/worktrees/friendly-bohr-9af6cc
git log --oneline -8
```
