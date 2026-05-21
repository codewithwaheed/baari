'use client';

import { useEffect, useState } from 'react';
import { Icon } from './primitives';

export interface ToastMessage {
  id: string;
  type: 'error' | 'success' | 'info';
  message: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

function ToastItem({ toast, onDismiss }: { toast: ToastMessage; onDismiss: (id: string) => void }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setVisible(false), 3600);
    const removeTimer = setTimeout(() => onDismiss(toast.id), 4000);
    return () => { clearTimeout(fadeTimer); clearTimeout(removeTimer); };
  }, [toast.id, onDismiss]);

  const colors = {
    error:   { bg: '#3D1F1A', border: '#B5483A', icon: '#F08070' as string },
    success: { bg: '#1A2F20', border: '#4E7C58', icon: '#6BBF8A' as string },
    info:    { bg: '#1A2030', border: '#4F6E89', icon: '#7EB0D4' as string },
  }[toast.type];

  const iconName = toast.type === 'error' ? 'close' : 'check';

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      padding: '12px 14px',
      background: colors.bg,
      border: `1px solid ${colors.border}`,
      borderRadius: 8,
      boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
      fontFamily: 'var(--font-body)',
      maxWidth: 360, minWidth: 240,
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(8px)',
      transition: 'opacity 400ms ease, transform 400ms ease',
      pointerEvents: visible ? 'auto' : 'none',
    }}>
      <span style={{
        width: 20, height: 20, borderRadius: 999, flexShrink: 0,
        background: colors.border,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginTop: 1,
      }}>
        <Icon name={iconName} size={12} stroke={2.5} color="#fff" />
      </span>
      <span style={{ fontSize: 13, color: '#fff', lineHeight: 1.5, flex: 1 }}>
        {toast.message}
      </span>
      <button
        onClick={() => onDismiss(toast.id)}
        style={{
          background: 'transparent', border: 0, cursor: 'pointer',
          padding: 2, color: 'rgba(255,255,255,0.5)', flexShrink: 0,
          lineHeight: 0,
        }}
      >
        <Icon name="close" size={14} stroke={2} />
      </button>
    </div>
  );
}

export function ToastStack({ toasts, onDismiss }: ToastProps) {
  if (toasts.length === 0) return null;
  return (
    <div style={{
      position: 'fixed', bottom: 80, right: 20, zIndex: 10000,
      display: 'flex', flexDirection: 'column', gap: 8,
      pointerEvents: 'none',
    }}>
      {toasts.map(t => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

export function useToasts() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const push = (type: ToastMessage['type'], message: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { id, type, message }]);
  };

  const dismiss = (id: string) => setToasts(prev => prev.filter(t => t.id !== id));

  return { toasts, push, dismiss };
}
