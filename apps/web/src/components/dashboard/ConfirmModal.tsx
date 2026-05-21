'use client';

import { useEffect } from 'react';
import { DButton } from './primitives';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  open, title, description,
  confirmLabel = 'Confirm', cancelLabel = 'Go back',
  danger = false,
  onConfirm, onCancel,
}: ConfirmModalProps) {
  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
        background: 'rgba(13, 13, 13, 0.55)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
      }}
    >
      <div style={{
        width: '100%', maxWidth: 400,
        background: 'var(--baari-cream)',
        borderRadius: 8,
        border: '1px solid var(--border)',
        padding: '28px 28px 24px',
        display: 'flex', flexDirection: 'column', gap: 20,
        boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
      }}>
        {/* Title */}
        <div>
          <p id="confirm-modal-title" style={{
            fontFamily: 'var(--font-display)',
            fontSize: 22, lineHeight: 1.15,
            letterSpacing: '-0.01em',
            color: 'var(--baari-onyx)',
            margin: 0,
          }}>
            {title}
          </p>
          {description && (
            <p style={{
              fontSize: 13, color: 'var(--fg-secondary)',
              margin: '8px 0 0', lineHeight: 1.55,
            }}>
              {description}
            </p>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <DButton
            variant={danger ? 'danger' : 'primary'}
            onClick={onConfirm}
            style={{ width: '100%', justifyContent: 'center', padding: '12px 16px', fontSize: 14,
              ...(danger ? { background: '#B5483A', color: '#fff', borderColor: '#B5483A' } : {}),
            }}
          >
            {confirmLabel}
          </DButton>
          <DButton
            variant="ghost"
            onClick={onCancel}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            {cancelLabel}
          </DButton>
        </div>
      </div>
    </div>
  );
}
