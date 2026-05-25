"use client";

import React, { useState, useEffect, useCallback } from "react";
import { BottomSheet } from "./BottomSheet";
import { ToastStack, useToasts } from "./Toast";
import {
  Icon,
  DButton,
  IconButton,
  Avatar,
  Eyebrow,
  fmtPKR,
} from "./primitives";

const API = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ServiceRow {
  id: string;
  name: string;
  category: string | null;
  durationMin: number;
  pricePaisa: number;
  bufferMin: number;
  isActive: boolean;
}

interface StaffRow {
  id: string;
  name: string;
  role: string;
  avatarUrl: string | null;
  isActive: boolean;
  workSchedule: Record<string, DaySchedule> | null;
  specialisationIds: string[] | null;
}

interface DaySchedule {
  isOpen: boolean;
  openTime: string;
  closeTime: string;
  breaks: Break[];
}
interface Break {
  from: string;
  to: string;
}

interface DayHours {
  dayOfWeek: number;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
  breaks: Break[];
}

interface BusinessInfo {
  name: string;
  slug: string;
  city: string | null;
  address: string | null;
  googleMapsUrl: string | null;
  instagramHandle: string | null;
  contactPhone: string | null;
  ntn: string | null;
  logoUrl: string | null;
  advanceBookingDays: number;
  slotIntervalMin: number;
  publicHolidays: string[];
}

type SettingsTab = "services" | "staff" | "hours" | "business";

// ── Constants ─────────────────────────────────────────────────────────────────

const DAYS_LABEL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAYS_KEY = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

// Suggested role values shown in datalist — owners can type anything
const STAFF_ROLE_SUGGESTIONS = [
  "Barber",
  "Senior Barber",
  "Stylist",
  "Color Specialist",
  "Esthetician",
  "Nail Tech",
  "Manager",
];

// Suggested category values shown in datalist — owners can type anything
const CATEGORY_SUGGESTIONS = [
  "Hair",
  "Beard",
  "Skin",
  "Nails",
  "Makeup",
  "Other",
];

const DURATIONS = [15, 30, 45, 60, 75, 90, 120, 150, 180, 240];
const BUFFERS = [0, 5, 10, 15, 20];

// Pakistan 2026 fixed national holidays
const PK_HOLIDAYS_2026 = [
  "2026-02-05", // Kashmir Day
  "2026-03-23", // Pakistan Day
  "2026-05-01", // Labour Day
  "2026-08-14", // Independence Day
  "2026-09-06", // Defence Day
  "2026-09-11", // Anniversary of Quaid-i-Azam's death
  "2026-11-09", // Iqbal Day
  "2026-12-25", // Quaid's birthday / Christmas
];

// ── Shared input styles ───────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "9px 12px",
  fontSize: 14,
  fontFamily: "var(--font-body)",
  color: "var(--baari-espresso)",
  background: "#fff",
  border: "1px solid var(--baari-sand)",
  borderRadius: 6,
  outline: "none",
  appearance: "none",
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: "0.04em",
  color: "var(--baari-graphite)",
  textTransform: "uppercase",
  display: "block",
  marginBottom: 5,
};

// ── Field ─────────────────────────────────────────────────────────────────────

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

// ── Toggle ────────────────────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{
        width: 40,
        height: 22,
        borderRadius: 999,
        border: "none",
        cursor: disabled ? "default" : "pointer",
        background: checked ? "var(--baari-onyx)" : "var(--baari-sand)",
        position: "relative",
        flexShrink: 0,
        transition: "background 160ms",
        padding: 0,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 3,
          left: checked ? 21 : 3,
          width: 16,
          height: 16,
          borderRadius: 999,
          background: checked ? "var(--baari-lime)" : "#fff",
          transition: "left 160ms, background 160ms",
        }}
      />
    </button>
  );
}

// ── FormDialog ────────────────────────────────────────────────────────────────
// Renders as a BottomSheet on mobile (< 768px) and a centered modal on desktop.

function FormDialog({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const [isDesktop, setIsDesktop] = React.useState(false);

  React.useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Lock body scroll on desktop when open
  React.useEffect(() => {
    if (isDesktop) {
      document.body.style.overflow = open ? "hidden" : "";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [open, isDesktop]);

  // ESC to close on desktop
  React.useEffect(() => {
    if (!open || !isDesktop) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, isDesktop, onClose]);

  if (!isDesktop)
    return (
      <BottomSheet open={open} onClose={onClose}>
        {children}
      </BottomSheet>
    );
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9998,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "rgba(13,13,13,0.55)",
        backdropFilter: "blur(4px)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 560,
          background: "var(--baari-cream)",
          borderRadius: 12,
          border: "1px solid var(--baari-sand)",
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
          position: "relative",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          style={{
            position: "sticky",
            top: 0,
            float: "right",
            marginRight: 16,
            marginTop: 16,
            background: "var(--baari-bone)",
            border: "1px solid var(--baari-sand)",
            borderRadius: "50%",
            width: 28,
            height: 28,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--baari-graphite)",
            zIndex: 1,
          }}
          aria-label="Close"
        >
          <Icon name="close" size={12} stroke={2} />
        </button>
        {children}
      </div>
    </div>
  );
}

// ── ============================================================ ───────────────
// SERVICES TAB
// ── ============================================================ ───────────────

function ServicesTab({
  onToast,
}: {
  onToast: (type: "success" | "error", msg: string) => void;
}) {
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ServiceRow | null>(null);
  const [deleteInput, setDeleteInput] = useState("");
  const [saving, setSaving] = useState(false);

  // Form state
  const [fname, setFname] = useState("");
  const [fcat, setFcat] = useState("");
  const [fdur, setFdur] = useState(30);
  const [fprice, setFprice] = useState("");
  const [fbuffer, setFbuffer] = useState(0);
  const [factive, setFactive] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`${API}/api/v1/services?includeInactive=true`, {
      credentials: "include",
    });
    if (res.ok) {
      const { data } = await res.json();
      setServices(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openAdd() {
    setEditing(null);
    setFname("");
    setFcat("");
    setFdur(30);
    setFprice("");
    setFbuffer(0);
    setFactive(true);
    setFormOpen(true);
  }

  function openEdit(s: ServiceRow) {
    setEditing(s);
    setFname(s.name);
    setFcat(s.category ?? "");
    setFdur(s.durationMin);
    setFprice(String(s.pricePaisa / 100));
    setFbuffer(s.bufferMin);
    setFactive(s.isActive);
    setFormOpen(true);
  }

  async function saveForm() {
    if (!fname.trim()) {
      onToast("error", "Service name is required");
      return;
    }
    const pricePaisa = Math.round(parseFloat(fprice || "0") * 100);
    if (isNaN(pricePaisa) || pricePaisa < 0) {
      onToast("error", "Enter a valid price");
      return;
    }

    setSaving(true);
    const url = editing
      ? `${API}/api/v1/services/${editing.id}`
      : `${API}/api/v1/services`;
    const method = editing ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: fname.trim(),
        category: fcat || null,
        durationMin: fdur,
        pricePaisa,
        bufferMin: fbuffer,
        isActive: factive,
      }),
    });
    setSaving(false);

    if (res.ok) {
      onToast("success", editing ? "Service updated" : "Service added");
      setFormOpen(false);
      load();
    } else {
      const j = await res.json().catch(() => null);
      onToast("error", j?.error?.message ?? "Failed to save service");
    }
  }

  async function toggleActive(s: ServiceRow) {
    const prev = services;
    setServices((ss) =>
      ss.map((x) => (x.id === s.id ? { ...x, isActive: !x.isActive } : x)),
    );
    const res = await fetch(`${API}/api/v1/services/${s.id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !s.isActive }),
    });
    if (!res.ok) {
      setServices(prev);
      onToast("error", "Failed to update service");
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setSaving(true);
    const res = await fetch(`${API}/api/v1/services/${deleteTarget.id}`, {
      method: "DELETE",
      credentials: "include",
    });
    setSaving(false);
    if (res.ok) {
      onToast("success", "Service deleted");
      setDeleteTarget(null);
      setDeleteInput("");
      load();
    } else {
      const j = await res.json().catch(() => null);
      onToast(
        "error",
        j?.error?.code === "SERVICE_IN_USE"
          ? "This service has active bookings — deactivate it instead"
          : "Failed to delete service",
      );
      setDeleteTarget(null);
      setDeleteInput("");
    }
  }

  const catLabel = (c: string | null) =>
    c ? c.charAt(0).toUpperCase() + c.slice(1) : "";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <Eyebrow>Services</Eyebrow>
          <p
            style={{
              margin: "4px 0 0",
              fontSize: 13,
              color: "var(--baari-graphite)",
              lineHeight: 1.5,
            }}
          >
            Manage the services your salon offers.
          </p>
        </div>
        <DButton
          variant="primary"
          size="sm"
          leadingIcon="plus"
          onClick={openAdd}
        >
          Add Service
        </DButton>
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                height: 60,
                background: "var(--baari-bone)",
                borderRadius: 8,
                opacity: 0.5,
              }}
            />
          ))}
        </div>
      ) : services.length === 0 ? (
        <div
          style={{
            padding: "48px 0",
            textAlign: "center",
            color: "var(--baari-stone)",
            fontSize: 14,
          }}
        >
          No services yet — add your first one.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {services.map((s) => (
            <div
              key={s.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 16px",
                background: s.isActive ? "#fff" : "var(--baari-bone)",
                border: "1px solid var(--baari-sand)",
                borderRadius: 8,
                opacity: s.isActive ? 1 : 0.65,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: "var(--baari-onyx)",
                    }}
                  >
                    {s.name}
                  </span>
                  {s.category && (
                    <span
                      style={{
                        fontSize: 11,
                        padding: "1px 7px",
                        borderRadius: 999,
                        background: "var(--baari-bone)",
                        color: "var(--baari-graphite)",
                        border: "1px solid var(--baari-sand)",
                      }}
                    >
                      {catLabel(s.category)}
                    </span>
                  )}
                </div>
                <span
                  style={{
                    fontSize: 12,
                    color: "var(--baari-stone)",
                    marginTop: 2,
                    display: "block",
                  }}
                >
                  {s.durationMin} min · {fmtPKR(s.pricePaisa)}
                  {s.bufferMin > 0 && ` · ${s.bufferMin}min buffer`}
                </span>
              </div>
              <Toggle checked={s.isActive} onChange={() => toggleActive(s)} />
              <IconButton
                name="edit"
                title="Edit"
                onClick={() => openEdit(s)}
                size={16}
              />
              <IconButton
                name="close"
                title="Delete"
                onClick={() => {
                  setDeleteTarget(s);
                  setDeleteInput("");
                }}
                size={14}
                color="var(--baari-error)"
              />
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit form */}
      <FormDialog open={formOpen} onClose={() => setFormOpen(false)}>
        <div
          style={{
            padding: "0 20px 40px",
            display: "flex",
            flexDirection: "column",
            gap: 18,
          }}
        >
          <h3
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 26,
              fontWeight: 200,
              letterSpacing: "-0.02em",
              color: "var(--baari-onyx)",
              margin: "8px 0 0",
            }}
          >
            {editing ? (
              <>
                Edit <strong>{editing.name}</strong>
              </>
            ) : (
              "Add Service"
            )}
          </h3>

          <Field label="Service name">
            <input
              value={fname}
              onChange={(e) => setFname(e.target.value)}
              placeholder="e.g. Fade + Beard Trim"
              style={inputStyle}
            />
          </Field>

          <Field label="Category">
            <input
              value={fcat}
              onChange={(e) => setFcat(e.target.value)}
              list="service-categories-datalist"
              placeholder="e.g. Hair, Beard, Skin…"
              style={inputStyle}
            />
            <datalist id="service-categories-datalist">
              {CATEGORY_SUGGESTIONS.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>

          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
          >
            <Field label="Duration (min)">
              <select
                value={fdur}
                onChange={(e) => setFdur(Number(e.target.value))}
                style={inputStyle}
              >
                {DURATIONS.map((d) => (
                  <option key={d} value={d}>
                    {d} min
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Buffer time (min)">
              <select
                value={fbuffer}
                onChange={(e) => setFbuffer(Number(e.target.value))}
                style={inputStyle}
              >
                {BUFFERS.map((b) => (
                  <option key={b} value={b}>
                    {b === 0 ? "No buffer" : `${b} min`}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Price (PKR)">
            <input
              type="number"
              min="0"
              value={fprice}
              onChange={(e) => setFprice(e.target.value)}
              placeholder="0"
              style={inputStyle}
            />
          </Field>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "4px 0",
            }}
          >
            <span style={{ fontSize: 14, color: "var(--baari-espresso)" }}>
              Active
            </span>
            <Toggle checked={factive} onChange={setFactive} />
          </div>

          <DButton
            variant="primary"
            onClick={saveForm}
            disabled={saving}
            style={{ justifyContent: "center" }}
          >
            {saving ? "Saving…" : editing ? "Save Changes" : "Add Service"}
          </DButton>
        </div>
      </FormDialog>

      {/* Delete confirm */}
      {deleteTarget && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setDeleteTarget(null);
              setDeleteInput("");
            }
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            background: "rgba(13,13,13,0.55)",
            backdropFilter: "blur(4px)",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 400,
              background: "var(--baari-cream)",
              borderRadius: 8,
              border: "1px solid var(--baari-sand)",
              padding: "28px 28px 24px",
              display: "flex",
              flexDirection: "column",
              gap: 16,
              boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
            }}
          >
            <div>
              <p
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 22,
                  color: "var(--baari-onyx)",
                  margin: 0,
                }}
              >
                Delete <strong>{deleteTarget.name}</strong>?
              </p>
              <p
                style={{
                  fontSize: 13,
                  color: "var(--baari-graphite)",
                  margin: "8px 0 0",
                  lineHeight: 1.55,
                }}
              >
                This cannot be undone. Type the service name to confirm.
              </p>
            </div>
            <input
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.target.value)}
              placeholder={deleteTarget.name}
              style={{
                ...inputStyle,
                borderColor:
                  deleteInput === deleteTarget.name
                    ? "var(--baari-error)"
                    : "var(--baari-sand)",
              }}
            />
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <DButton
                variant="danger"
                disabled={deleteInput !== deleteTarget.name || saving}
                onClick={confirmDelete}
                style={{
                  justifyContent: "center",
                  background: "#B5483A",
                  color: "#fff",
                  borderColor: "#B5483A",
                }}
              >
                {saving ? "Deleting…" : "Delete Service"}
              </DButton>
              <DButton
                variant="ghost"
                onClick={() => {
                  setDeleteTarget(null);
                  setDeleteInput("");
                }}
                style={{ justifyContent: "center" }}
              >
                Cancel
              </DButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── ============================================================ ───────────────
// STAFF TAB
// ── ============================================================ ───────────────

const DEFAULT_SCHEDULE: Record<string, DaySchedule> = Object.fromEntries(
  DAYS_KEY.map((k) => [
    k,
    { isOpen: k !== "sun", openTime: "09:00", closeTime: "20:00", breaks: [] },
  ]),
);

function StaffTab({
  onToast,
}: {
  onToast: (type: "success" | "error", msg: string) => void;
}) {
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<StaffRow | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [fname, setFname] = useState("");
  const [frole, setFrole] = useState("Barber");
  const [factive, setFactive] = useState(true);
  const [fschedule, setFschedule] =
    useState<Record<string, DaySchedule>>(DEFAULT_SCHEDULE);
  const [fspecIds, setFspecIds] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const [sRes, svRes] = await Promise.all([
      fetch(`${API}/api/v1/staff?includeInactive=true`, {
        credentials: "include",
      }),
      fetch(`${API}/api/v1/services`, { credentials: "include" }),
    ]);
    if (sRes.ok) {
      const { data } = await sRes.json();
      setStaff(data);
    }
    if (svRes.ok) {
      const { data } = await svRes.json();
      setServices(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openAdd() {
    setEditing(null);
    setFname("");
    setFrole("Barber");
    setFactive(true);
    setFschedule(DEFAULT_SCHEDULE);
    setFspecIds([]);
    setFormOpen(true);
  }

  function openEdit(s: StaffRow) {
    setEditing(s);
    setFname(s.name);
    setFrole(s.role);
    setFactive(s.isActive);
    setFschedule(s.workSchedule ?? DEFAULT_SCHEDULE);
    setFspecIds(s.specialisationIds ?? []);
    setFormOpen(true);
  }

  function updateDaySchedule(day: string, patch: Partial<DaySchedule>) {
    setFschedule((prev) => ({ ...prev, [day]: { ...prev[day]!, ...patch } }));
  }

  function addBreak(day: string) {
    setFschedule((prev) => ({
      ...prev,
      [day]: {
        ...prev[day]!,
        breaks: [...(prev[day]?.breaks ?? []), { from: "13:00", to: "14:00" }],
      },
    }));
  }

  function removeBreak(day: string, idx: number) {
    setFschedule((prev) => ({
      ...prev,
      [day]: {
        ...prev[day]!,
        breaks: (prev[day]?.breaks ?? []).filter((_, i) => i !== idx),
      },
    }));
  }

  function updateBreak(
    day: string,
    idx: number,
    field: "from" | "to",
    value: string,
  ) {
    setFschedule((prev) => ({
      ...prev,
      [day]: {
        ...prev[day]!,
        breaks: (prev[day]?.breaks ?? []).map((b, i) =>
          i === idx ? { ...b, [field]: value } : b,
        ),
      },
    }));
  }

  function toggleSpec(id: string) {
    setFspecIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function saveForm() {
    if (!fname.trim()) {
      onToast("error", "Staff name is required");
      return;
    }
    setSaving(true);
    const url = editing
      ? `${API}/api/v1/staff/${editing.id}`
      : `${API}/api/v1/staff`;
    const method = editing ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: fname.trim(),
        role: frole,
        isActive: factive,
        workSchedule: fschedule,
        specialisationIds: fspecIds.length > 0 ? fspecIds : null,
      }),
    });
    setSaving(false);
    if (res.ok) {
      onToast("success", editing ? "Staff updated" : "Staff member added");
      setFormOpen(false);
      load();
    } else {
      const j = await res.json().catch(() => null);
      onToast("error", j?.error?.message ?? "Failed to save");
    }
  }

  async function toggleActive(s: StaffRow) {
    const prev = staff;
    setStaff((ss) =>
      ss.map((x) => (x.id === s.id ? { ...x, isActive: !x.isActive } : x)),
    );
    const res = await fetch(`${API}/api/v1/staff/${s.id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !s.isActive }),
    });
    if (!res.ok) {
      setStaff(prev);
      onToast("error", "Failed to update");
    }
  }

  const roleLabel = (r: string) => r;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <Eyebrow>Staff</Eyebrow>
          <p
            style={{
              margin: "4px 0 0",
              fontSize: 13,
              color: "var(--baari-graphite)",
              lineHeight: 1.5,
            }}
          >
            Manage your team and their schedules.
          </p>
        </div>
        <DButton
          variant="primary"
          size="sm"
          leadingIcon="plus"
          onClick={openAdd}
        >
          Add Staff
        </DButton>
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                height: 60,
                background: "var(--baari-bone)",
                borderRadius: 8,
                opacity: 0.5,
              }}
            />
          ))}
        </div>
      ) : staff.length === 0 ? (
        <div
          style={{
            padding: "48px 0",
            textAlign: "center",
            color: "var(--baari-stone)",
            fontSize: 14,
          }}
        >
          No staff yet — add your first team member.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {staff.map((s) => (
            <div
              key={s.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 16px",
                background: s.isActive ? "#fff" : "var(--baari-bone)",
                border: "1px solid var(--baari-sand)",
                borderRadius: 8,
                opacity: s.isActive ? 1 : 0.65,
              }}
            >
              <Avatar name={s.name} size={36} />
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "var(--baari-onyx)",
                  }}
                >
                  {s.name}
                </div>
                <div style={{ fontSize: 12, color: "var(--baari-stone)" }}>
                  {roleLabel(s.role)}
                </div>
              </div>
              <Toggle checked={s.isActive} onChange={() => toggleActive(s)} />
              <IconButton
                name="edit"
                title="Edit"
                onClick={() => openEdit(s)}
                size={16}
              />
            </div>
          ))}
        </div>
      )}

      {/* Staff form */}
      <FormDialog open={formOpen} onClose={() => setFormOpen(false)}>
        <div
          style={{
            padding: "0 20px 60px",
            display: "flex",
            flexDirection: "column",
            gap: 22,
          }}
        >
          <h3
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 26,
              fontWeight: 200,
              letterSpacing: "-0.02em",
              color: "var(--baari-onyx)",
              margin: "8px 0 0",
            }}
          >
            {editing ? (
              <>
                Edit <strong>{editing.name}</strong>
              </>
            ) : (
              "Add Staff Member"
            )}
          </h3>

          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
          >
            <Field label="Full name">
              <input
                value={fname}
                onChange={(e) => setFname(e.target.value)}
                placeholder="e.g. Ahmed Khan"
                style={inputStyle}
              />
            </Field>
            <Field label="Role">
              <input
                value={frole}
                onChange={(e) => setFrole(e.target.value)}
                list="staff-roles-datalist"
                placeholder="e.g. Senior Barber"
                style={inputStyle}
              />
              <datalist id="staff-roles-datalist">
                {STAFF_ROLE_SUGGESTIONS.map((r) => (
                  <option key={r} value={r} />
                ))}
              </datalist>
            </Field>
          </div>

          {/* Working days */}
          <div>
            <label style={labelStyle}>Working days</label>
            <div
              style={{
                display: "flex",
                gap: 6,
                flexWrap: "wrap",
                marginBottom: 14,
              }}
            >
              {DAYS_KEY.map((k, i) => {
                const open = fschedule[k]?.isOpen ?? false;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => updateDaySchedule(k, { isOpen: !open })}
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 999,
                      border: `1.5px solid ${open ? "var(--baari-onyx)" : "var(--baari-sand)"}`,
                      background: open ? "var(--baari-onyx)" : "transparent",
                      color: open
                        ? "var(--baari-lime)"
                        : "var(--baari-graphite)",
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {DAYS_LABEL[i]!.slice(0, 1)}
                  </button>
                );
              })}
            </div>

            {/* Per-day time inputs */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {DAYS_KEY.map((k, i) => {
                const day = fschedule[k];
                if (!day?.isOpen) return null;
                return (
                  <div
                    key={k}
                    style={{
                      background: "var(--baari-bone)",
                      borderRadius: 8,
                      padding: "12px 14px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        marginBottom: day.breaks.length > 0 ? 10 : 0,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: "var(--baari-graphite)",
                          width: 28,
                        }}
                      >
                        {DAYS_LABEL[i]}
                      </span>
                      <input
                        type="time"
                        value={day.openTime}
                        onChange={(e) =>
                          updateDaySchedule(k, { openTime: e.target.value })
                        }
                        style={{
                          ...inputStyle,
                          width: "auto",
                          flex: 1,
                          padding: "6px 10px",
                          fontSize: 13,
                        }}
                      />
                      <span
                        style={{ fontSize: 12, color: "var(--baari-stone)" }}
                      >
                        –
                      </span>
                      <input
                        type="time"
                        value={day.closeTime}
                        onChange={(e) =>
                          updateDaySchedule(k, { closeTime: e.target.value })
                        }
                        style={{
                          ...inputStyle,
                          width: "auto",
                          flex: 1,
                          padding: "6px 10px",
                          fontSize: 13,
                        }}
                      />
                      <button
                        type="button"
                        title="Apply to all open days"
                        onClick={() => {
                          const src = fschedule[k]!;
                          setFschedule((prev) => {
                            const next = { ...prev };
                            DAYS_KEY.forEach((dk) => {
                              if (dk !== k && next[dk]?.isOpen) {
                                next[dk] = {
                                  ...next[dk]!,
                                  openTime: src.openTime,
                                  closeTime: src.closeTime,
                                  breaks: src.breaks.map((b) => ({ ...b })),
                                };
                              }
                            });
                            return next;
                          });
                        }}
                        style={{
                          background: "transparent",
                          border: 0,
                          cursor: "pointer",
                          color: "var(--baari-stone)",
                          padding: "0 2px",
                          fontSize: 10,
                          fontFamily: "var(--font-body)",
                          whiteSpace: "nowrap",
                          flexShrink: 0,
                        }}
                      >
                        Apply to all
                      </button>
                      <button
                        type="button"
                        onClick={() => addBreak(k)}
                        title="Add break"
                        style={{
                          background: "transparent",
                          border: 0,
                          cursor: "pointer",
                          color: "var(--baari-graphite)",
                          padding: 4,
                        }}
                      >
                        <Icon name="plus" size={14} stroke={2} />
                      </button>
                    </div>
                    {day.breaks.map((b, bi) => (
                      <div
                        key={bi}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          marginTop: 8,
                          paddingLeft: 36,
                        }}
                      >
                        <span
                          style={{ fontSize: 11, color: "var(--baari-stone)" }}
                        >
                          Break
                        </span>
                        <input
                          type="time"
                          value={b.from}
                          onChange={(e) =>
                            updateBreak(k, bi, "from", e.target.value)
                          }
                          style={{
                            ...inputStyle,
                            width: "auto",
                            flex: 1,
                            padding: "5px 8px",
                            fontSize: 12,
                          }}
                        />
                        <span
                          style={{ fontSize: 12, color: "var(--baari-stone)" }}
                        >
                          –
                        </span>
                        <input
                          type="time"
                          value={b.to}
                          onChange={(e) =>
                            updateBreak(k, bi, "to", e.target.value)
                          }
                          style={{
                            ...inputStyle,
                            width: "auto",
                            flex: 1,
                            padding: "5px 8px",
                            fontSize: 12,
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => removeBreak(k, bi)}
                          style={{
                            background: "transparent",
                            border: 0,
                            cursor: "pointer",
                            color: "var(--baari-error)",
                            padding: 4,
                          }}
                        >
                          <Icon name="close" size={12} stroke={2} />
                        </button>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Service specialisations */}
          {services.length > 0 && (
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  marginBottom: 4,
                }}
              >
                <label style={labelStyle}>Service specialisations</label>
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => setFspecIds(services.map((sv) => sv.id))}
                    style={{
                      background: "transparent",
                      border: 0,
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "var(--baari-onyx)",
                      padding: 0,
                      fontFamily: "var(--font-body)",
                    }}
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    onClick={() => setFspecIds([])}
                    style={{
                      background: "transparent",
                      border: 0,
                      cursor: "pointer",
                      fontSize: 12,
                      color: "var(--baari-stone)",
                      padding: 0,
                      fontFamily: "var(--font-body)",
                    }}
                  >
                    Clear
                  </button>
                </div>
              </div>
              <p
                style={{
                  fontSize: 12,
                  color: "var(--baari-stone)",
                  margin: "0 0 8px",
                  lineHeight: 1.5,
                }}
              >
                Leave all unchecked to allow all services.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {services.map((sv) => (
                  <label
                    key={sv.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      cursor: "pointer",
                      padding: "6px 0",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={fspecIds.includes(sv.id)}
                      onChange={() => toggleSpec(sv.id)}
                      style={{
                        width: 16,
                        height: 16,
                        accentColor: "var(--baari-onyx)",
                      }}
                    />
                    <span
                      style={{ fontSize: 14, color: "var(--baari-espresso)" }}
                    >
                      {sv.name}
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        color: "var(--baari-stone)",
                        marginLeft: "auto",
                      }}
                    >
                      {sv.durationMin} min
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "4px 0",
            }}
          >
            <span style={{ fontSize: 14, color: "var(--baari-espresso)" }}>
              Active
            </span>
            <Toggle checked={factive} onChange={setFactive} />
          </div>

          <DButton
            variant="primary"
            onClick={saveForm}
            disabled={saving}
            style={{ justifyContent: "center" }}
          >
            {saving ? "Saving…" : editing ? "Save Changes" : "Add Staff Member"}
          </DButton>
        </div>
      </FormDialog>
    </div>
  );
}

// ── ============================================================ ───────────────
// WORKING HOURS TAB
// ── ============================================================ ───────────────

function WorkingHoursTab({
  onToast,
}: {
  onToast: (type: "success" | "error", msg: string) => void;
}) {
  const [hours, setHours] = useState<DayHours[]>([]);
  const [advanceDays, setAdvanceDays] = useState<number>(30);
  const [slotInterval, setSlotInterval] = useState<number>(30);
  const [publicHolidays, setPublicHolidays] = useState<string[]>([]);
  const [newHoliday, setNewHoliday] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/api/v1/settings/hours`, { credentials: "include" }),
      fetch(`${API}/api/v1/settings/business`, { credentials: "include" }),
    ])
      .then(async ([hr, br]) => {
        if (hr.ok) {
          const { data } = await hr.json();
          setHours(data);
        }
        if (br.ok) {
          const { data } = await br.json();
          setAdvanceDays(data.advanceBookingDays ?? 30);
          setSlotInterval(data.slotIntervalMin ?? 30);
          setPublicHolidays(data.publicHolidays ?? PK_HOLIDAYS_2026);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  function updateDay(dayOfWeek: number, patch: Partial<DayHours>) {
    setHours((prev) =>
      prev.map((h) => (h.dayOfWeek === dayOfWeek ? { ...h, ...patch } : h)),
    );
  }

  function addBreak(dayOfWeek: number) {
    setHours((prev) =>
      prev.map((h) =>
        h.dayOfWeek === dayOfWeek
          ? { ...h, breaks: [...h.breaks, { from: "13:00", to: "14:00" }] }
          : h,
      ),
    );
  }

  function removeBreak(dayOfWeek: number, idx: number) {
    setHours((prev) =>
      prev.map((h) =>
        h.dayOfWeek === dayOfWeek
          ? { ...h, breaks: h.breaks.filter((_, i) => i !== idx) }
          : h,
      ),
    );
  }

  function updateBreak(
    dayOfWeek: number,
    idx: number,
    field: "from" | "to",
    value: string,
  ) {
    setHours((prev) =>
      prev.map((h) =>
        h.dayOfWeek === dayOfWeek
          ? {
              ...h,
              breaks: h.breaks.map((b, i) =>
                i === idx ? { ...b, [field]: value } : b,
              ),
            }
          : h,
      ),
    );
  }

  function addHoliday() {
    if (!newHoliday) return;
    if (publicHolidays.includes(newHoliday)) {
      setNewHoliday("");
      return;
    }
    setPublicHolidays((prev) => [...prev, newHoliday].sort());
    setNewHoliday("");
  }

  async function save() {
    setSaving(true);
    const [hr, br] = await Promise.all([
      fetch(`${API}/api/v1/settings/hours`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(hours),
      }),
      fetch(`${API}/api/v1/settings/business`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          advanceBookingDays: advanceDays,
          slotIntervalMin: slotInterval,
          publicHolidays,
        }),
      }),
    ]);
    setSaving(false);
    if (hr.ok && br.ok) {
      onToast("success", "Working hours saved");
    } else {
      onToast("error", "Failed to save — please try again");
    }
  }

  if (loading)
    return (
      <div
        style={{
          padding: 48,
          textAlign: "center",
          color: "var(--baari-stone)",
          fontSize: 14,
        }}
      >
        Loading…
      </div>
    );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <div>
        <Eyebrow>Working Hours</Eyebrow>
        <p
          style={{
            margin: "4px 0 0",
            fontSize: 13,
            color: "var(--baari-graphite)",
            lineHeight: 1.5,
          }}
        >
          Set your salon's opening hours and breaks per day.
        </p>
      </div>

      {/* Per-day hours */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {hours.map((h) => (
          <div
            key={h.dayOfWeek}
            style={{
              background: "#fff",
              border: "1px solid var(--baari-sand)",
              borderRadius: 8,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 16px",
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--baari-espresso)",
                  width: 36,
                  flexShrink: 0,
                }}
              >
                {DAYS_LABEL[h.dayOfWeek]}
              </span>
              <Toggle
                checked={h.isOpen}
                onChange={(v) => updateDay(h.dayOfWeek, { isOpen: v })}
              />
              {h.isOpen && (
                <>
                  <input
                    type="time"
                    value={h.openTime}
                    onChange={(e) =>
                      updateDay(h.dayOfWeek, { openTime: e.target.value })
                    }
                    style={{
                      ...inputStyle,
                      width: "auto",
                      flex: 1,
                      padding: "6px 10px",
                      fontSize: 13,
                    }}
                  />
                  <span style={{ fontSize: 12, color: "var(--baari-stone)" }}>
                    –
                  </span>
                  <input
                    type="time"
                    value={h.closeTime}
                    onChange={(e) =>
                      updateDay(h.dayOfWeek, { closeTime: e.target.value })
                    }
                    style={{
                      ...inputStyle,
                      width: "auto",
                      flex: 1,
                      padding: "6px 10px",
                      fontSize: 13,
                    }}
                  />
                  <button
                    type="button"
                    title="Apply to all open days"
                    onClick={() => {
                      setHours((prev) =>
                        prev.map((d) =>
                          d.dayOfWeek !== h.dayOfWeek && d.isOpen
                            ? {
                                ...d,
                                openTime: h.openTime,
                                closeTime: h.closeTime,
                                breaks: h.breaks.map((b) => ({ ...b })),
                              }
                            : d,
                        ),
                      );
                    }}
                    style={{
                      background: "transparent",
                      border: 0,
                      cursor: "pointer",
                      color: "var(--baari-stone)",
                      padding: "0 2px",
                      fontSize: 10,
                      fontFamily: "var(--font-body)",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                    }}
                  >
                    Apply to all
                  </button>
                  <button
                    type="button"
                    onClick={() => addBreak(h.dayOfWeek)}
                    title="Add break"
                    style={{
                      background: "transparent",
                      border: 0,
                      cursor: "pointer",
                      color: "var(--baari-graphite)",
                      padding: 4,
                      flexShrink: 0,
                    }}
                  >
                    <Icon name="plus" size={14} stroke={2} />
                  </button>
                </>
              )}
              {!h.isOpen && (
                <span
                  style={{
                    fontSize: 13,
                    color: "var(--baari-stone)",
                    marginLeft: 4,
                  }}
                >
                  Closed
                </span>
              )}
            </div>

            {h.isOpen &&
              h.breaks.map((b, bi) => (
                <div
                  key={bi}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 16px 10px 68px",
                    background: "var(--baari-bone)",
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      color: "var(--baari-stone)",
                      flexShrink: 0,
                    }}
                  >
                    Break
                  </span>
                  <input
                    type="time"
                    value={b.from}
                    onChange={(e) =>
                      updateBreak(h.dayOfWeek, bi, "from", e.target.value)
                    }
                    style={{
                      ...inputStyle,
                      width: "auto",
                      flex: 1,
                      padding: "5px 8px",
                      fontSize: 12,
                    }}
                  />
                  <span style={{ fontSize: 12, color: "var(--baari-stone)" }}>
                    –
                  </span>
                  <input
                    type="time"
                    value={b.to}
                    onChange={(e) =>
                      updateBreak(h.dayOfWeek, bi, "to", e.target.value)
                    }
                    style={{
                      ...inputStyle,
                      width: "auto",
                      flex: 1,
                      padding: "5px 8px",
                      fontSize: 12,
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => removeBreak(h.dayOfWeek, bi)}
                    style={{
                      background: "transparent",
                      border: 0,
                      cursor: "pointer",
                      color: "var(--baari-error)",
                      padding: 4,
                    }}
                  >
                    <Icon name="close" size={12} stroke={2} />
                  </button>
                </div>
              ))}
          </div>
        ))}
      </div>

      {/* Booking settings */}
      <div
        style={{
          background: "#fff",
          border: "1px solid var(--baari-sand)",
          borderRadius: 8,
          padding: "18px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        <div>
          <label style={labelStyle}>Advance booking window</label>
          <div
            style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}
          >
            {[7, 14, 30, 60].map((d) => (
              <label
                key={d}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  cursor: "pointer",
                }}
              >
                <input
                  type="radio"
                  name="advanceDays"
                  checked={advanceDays === d}
                  onChange={() => setAdvanceDays(d)}
                  style={{ accentColor: "var(--baari-onyx)" }}
                />
                <span style={{ fontSize: 13, color: "var(--baari-espresso)" }}>
                  {d} days
                </span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label style={labelStyle}>Slot interval</label>
          <div style={{ display: "flex", gap: 16, marginTop: 6 }}>
            {[15, 30].map((m) => (
              <label
                key={m}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  cursor: "pointer",
                }}
              >
                <input
                  type="radio"
                  name="slotInterval"
                  checked={slotInterval === m}
                  onChange={() => setSlotInterval(m)}
                  style={{ accentColor: "var(--baari-onyx)" }}
                />
                <span style={{ fontSize: 13, color: "var(--baari-espresso)" }}>
                  {m} min
                </span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Public holidays */}
      <div
        style={{
          background: "#fff",
          border: "1px solid var(--baari-sand)",
          borderRadius: 8,
          padding: "18px 20px",
        }}
      >
        <label style={labelStyle}>Public holidays</label>
        <p
          style={{
            fontSize: 12,
            color: "var(--baari-stone)",
            margin: "0 0 12px",
            lineHeight: 1.5,
          }}
        >
          No bookings will be taken on these dates.
        </p>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            marginBottom: 12,
          }}
        >
          {publicHolidays.map((d) => (
            <span
              key={d}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "4px 10px 4px 12px",
                background: "var(--baari-bone)",
                borderRadius: 999,
                border: "1px solid var(--baari-sand)",
                fontSize: 12,
              }}
            >
              {new Date(d + "T00:00:00").toLocaleDateString("en-PK", {
                month: "short",
                day: "numeric",
              })}
              <button
                type="button"
                onClick={() =>
                  setPublicHolidays((p) => p.filter((x) => x !== d))
                }
                style={{
                  background: "transparent",
                  border: 0,
                  cursor: "pointer",
                  padding: 2,
                  color: "var(--baari-stone)",
                  lineHeight: 0,
                }}
              >
                <Icon name="close" size={11} stroke={2} />
              </button>
            </span>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="date"
            value={newHoliday}
            onChange={(e) => setNewHoliday(e.target.value)}
            style={{ ...inputStyle, flex: 1, maxWidth: 180 }}
          />
          <DButton
            variant="ghost"
            size="sm"
            onClick={addHoliday}
            disabled={!newHoliday}
          >
            Add
          </DButton>
        </div>
      </div>

      <DButton
        variant="primary"
        onClick={save}
        disabled={saving}
        style={{ justifyContent: "center", marginTop: 4 }}
      >
        {saving ? "Saving…" : "Save Working Hours"}
      </DButton>
    </div>
  );
}

// ── ============================================================ ───────────────
// BUSINESS INFO TAB
// ── ============================================================ ───────────────

const CLOUDINARY_CLOUD = process.env["NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME"] ?? "";
const CLOUDINARY_PRESET =
  process.env["NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET"] ?? "";

function BusinessInfoTab({
  onToast,
}: {
  onToast: (type: "success" | "error", msg: string) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const logoInputRef = React.useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<BusinessInfo>({
    name: "",
    slug: "",
    city: null,
    address: null,
    googleMapsUrl: null,
    instagramHandle: null,
    contactPhone: null,
    ntn: null,
    logoUrl: null,
    advanceBookingDays: 30,
    slotIntervalMin: 30,
    publicHolidays: [],
  });

  useEffect(() => {
    fetch(`${API}/api/v1/settings/business`, { credentials: "include" })
      .then(async (r) => {
        if (r.ok) {
          const { data } = await r.json();
          setForm((prev) => ({ ...prev, ...data }));
        }
      })
      .finally(() => setLoading(false));
  }, []);

  function set(key: keyof BusinessInfo, value: string | null | number | boolean | string[]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // Sanitise slug: lowercase, spaces → hyphens, strip illegal chars
  function sanitiseSlug(raw: string): string {
    return raw.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-{2,}/g, '-').replace(/^-|-$/g, '');
  }

  async function handleLogoFile(file: File) {
    if (!CLOUDINARY_CLOUD || !CLOUDINARY_PRESET) {
      onToast(
        "error",
        "Cloudinary not configured — add NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME and NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET to .env",
      );
      return;
    }
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("upload_preset", CLOUDINARY_PRESET);
    fd.append("folder", "baari/logos");
    try {
      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`,
        { method: "POST", body: fd },
      );
      if (!res.ok) throw new Error("Upload failed");
      const { secure_url } = await res.json();
      set("logoUrl", secure_url);
      onToast("success", "Logo uploaded — click Save to apply");
    } catch {
      onToast("error", "Logo upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!form.name.trim()) {
      onToast("error", "Salon name is required");
      return;
    }
    setSaving(true);
    const slugVal = sanitiseSlug(form.slug.trim());
    if (form.slug.trim() && slugVal.length < 3) {
      onToast("error", "Booking URL slug must be at least 3 characters");
      setSaving(false);
      return;
    }

    const res = await fetch(`${API}/api/v1/settings/business`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name.trim(),
        ...(form.slug.trim() && { slug: slugVal }),
        city: form.city?.trim() || null,
        address: form.address?.trim() || null,
        googleMapsUrl: form.googleMapsUrl?.trim() || null,
        instagramHandle: form.instagramHandle?.trim() || null,
        contactPhone: form.contactPhone?.trim() || null,
        logoUrl: form.logoUrl || null,
      }),
    });
    setSaving(false);
    if (res.ok) {
      // Reflect sanitised slug back into form so preview stays accurate
      setForm((prev) => ({ ...prev, slug: sanitiseSlug(form.slug) }));
      onToast("success", "Business info saved");
    } else {
      const j = await res.json().catch(() => null);
      const code = j?.error?.code;
      onToast(
        "error",
        code === "SLUG_TAKEN"
          ? "That booking URL is already taken — please choose another"
          : j?.error?.message ?? "Failed to save",
      );
    }
  }

  if (loading)
    return (
      <div
        style={{
          padding: 48,
          textAlign: "center",
          color: "var(--baari-stone)",
          fontSize: 14,
        }}
      >
        Loading…
      </div>
    );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <Eyebrow>Business Info</Eyebrow>
        <p
          style={{
            margin: "4px 0 0",
            fontSize: 13,
            color: "var(--baari-graphite)",
            lineHeight: 1.5,
          }}
        >
          Your salon's public-facing details.
        </p>
      </div>

      {/* Logo upload */}
      <div
        style={{
          background: "#fff",
          border: "1px solid var(--baari-sand)",
          borderRadius: 8,
          padding: "20px",
          display: "flex",
          alignItems: "center",
          gap: 20,
        }}
      >
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: "50%",
            flexShrink: 0,
            background: "var(--baari-bone)",
            border: "2px solid var(--baari-sand)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          {form.logoUrl ? (
            <img
              src={form.logoUrl}
              alt="Logo"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <Icon
              name="home"
              size={24}
              stroke={1.5}
              color="var(--baari-stone)"
            />
          )}
        </div>
        <div style={{ flex: 1 }}>
          <p
            style={{
              margin: "0 0 6px",
              fontSize: 13,
              fontWeight: 600,
              color: "var(--baari-espresso)",
            }}
          >
            Salon logo
          </p>
          <p
            style={{
              margin: "0 0 10px",
              fontSize: 12,
              color: "var(--baari-stone)",
              lineHeight: 1.5,
            }}
          >
            Shown on your public booking page and WhatsApp previews. JPG or PNG,
            square works best.
          </p>
          <input
            ref={logoInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleLogoFile(f);
              e.target.value = "";
            }}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <DButton
              variant="ghost"
              size="sm"
              onClick={() => logoInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading
                ? "Uploading…"
                : form.logoUrl
                  ? "Change logo"
                  : "Upload logo"}
            </DButton>
            {form.logoUrl && (
              <DButton
                variant="ghost"
                size="sm"
                onClick={() => set("logoUrl", null)}
              >
                Remove
              </DButton>
            )}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 16,
          background: "#fff",
          border: "1px solid var(--baari-sand)",
          borderRadius: 8,
          padding: "20px",
        }}
      >
        <Field label="Salon name">
          <input
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="e.g. Waheed Barber Studio"
            style={inputStyle}
          />
        </Field>

        <Field label="Booking URL">
          <div style={{ position: "relative" }}>
            <span
              style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                fontSize: 13,
                color: "var(--baari-stone)",
                whiteSpace: "nowrap",
                pointerEvents: "none",
              }}
            >
              book.baari.pk/
            </span>
            <input
              value={form.slug}
              onChange={(e) => set("slug", sanitiseSlug(e.target.value))}
              placeholder="your-salon-name"
              style={{ ...inputStyle, paddingLeft: 112 }}
            />
          </div>
          {form.slug && (
            <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--baari-stone)" }}>
              Customers will book at{" "}
              <strong style={{ color: "var(--baari-espresso)" }}>
                book.baari.pk/{form.slug}
              </strong>
            </p>
          )}
        </Field>

        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
        >
          <Field label="City">
            <input
              value={form.city ?? ""}
              onChange={(e) => set("city", e.target.value)}
              placeholder="Lahore"
              style={inputStyle}
            />
          </Field>
          <Field label="Contact phone">
            <input
              type="tel"
              value={form.contactPhone ?? ""}
              onChange={(e) => set("contactPhone", e.target.value)}
              placeholder="+923001234567"
              style={inputStyle}
            />
          </Field>
        </div>

        <Field label="Address">
          <input
            value={form.address ?? ""}
            onChange={(e) => set("address", e.target.value)}
            placeholder="e.g. Shop 4, DHA Phase 5, Lahore"
            style={inputStyle}
          />
        </Field>

        <Field label="Google Maps link">
          <input
            type="url"
            value={form.googleMapsUrl ?? ""}
            onChange={(e) => set("googleMapsUrl", e.target.value || null)}
            placeholder="https://maps.app.goo.gl/..."
            style={inputStyle}
          />
        </Field>

        <Field label="Instagram handle">
          <div style={{ position: "relative" }}>
            <span
              style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                fontSize: 14,
                color: "var(--baari-stone)",
              }}
            >
              @
            </span>
            <input
              value={form.instagramHandle ?? ""}
              onChange={(e) => set("instagramHandle", e.target.value || null)}
              placeholder="yoursalon"
              style={{ ...inputStyle, paddingLeft: 28 }}
            />
          </div>
        </Field>
      </div>

      <DButton
        variant="primary"
        onClick={save}
        disabled={saving}
        style={{ justifyContent: "center" }}
      >
        {saving ? "Saving…" : "Save Business Info"}
      </DButton>
    </div>
  );
}

// ── ============================================================ ───────────────
// MAIN SettingsView
// ── ============================================================ ───────────────

const TABS: {
  id: SettingsTab;
  label: string;
  icon: Parameters<typeof Icon>[0]["name"];
}[] = [
  { id: "services", label: "Services", icon: "scissors" },
  { id: "staff", label: "Staff", icon: "users" },
  { id: "hours", label: "Working Hours", icon: "clock" },
  { id: "business", label: "Business Info", icon: "home" },
];

export function SettingsView() {
  const [tab, setTab] = useState<SettingsTab>("services");
  const { toasts, push: pushToast, dismiss: dismissToast } = useToasts();

  const toast = useCallback(
    (type: "success" | "error", msg: string) => pushToast(type, msg),
    [pushToast],
  );

  return (
    <div
      style={{
        flex: 1,
        overflow: "hidden",
        background: "var(--baari-cream)",
        fontFamily: "var(--font-body)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Tab bar — sticky, never scrolls */}
      <div
        style={{
          display: "flex",
          gap: 0,
          borderBottom: "1px solid var(--baari-sand)",
          background: "#fff",
          overflowX: "auto",
          flexShrink: 0,
          WebkitOverflowScrolling: "touch",
        }}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              padding: "13px 18px",
              fontSize: 13,
              fontWeight: 500,
              fontFamily: "var(--font-body)",
              cursor: "pointer",
              background: "transparent",
              border: "none",
              borderBottom:
                tab === t.id
                  ? "2px solid var(--baari-onyx)"
                  : "2px solid transparent",
              color: tab === t.id ? "var(--baari-onyx)" : "var(--baari-stone)",
              whiteSpace: "nowrap",
              flexShrink: 0,
              transition: "color 120ms",
            }}
          >
            <Icon
              name={t.icon}
              size={14}
              stroke={1.8}
              color={tab === t.id ? "var(--baari-onyx)" : "var(--baari-stone)"}
            />
            {t.label}
          </button>
        ))}
      </div>

      {/* Content — full-width scroll container so the scrollbar sits at the
           right edge of the viewport, not at the edge of the 760px column */}
      <div style={{ flex: 1, overflow: "auto" }}>
        <div
          style={{
            padding: "28px 24px 80px",
            maxWidth: 760,
            width: "100%",
            margin: "0 auto",
            boxSizing: "border-box",
          }}
        >
          {tab === "services" && <ServicesTab onToast={toast} />}
          {tab === "staff" && <StaffTab onToast={toast} />}
          {tab === "hours" && <WorkingHoursTab onToast={toast} />}
          {tab === "business" && <BusinessInfoTab onToast={toast} />}
        </div>
      </div>

      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
