/**
 * ConfirmDialog.tsx — Reusable confirmation modal
 *
 * Used for all destructive or irreversible actions in the app.
 * Features:
 * - Danger / warning / info severity variants
 * - Optional text field for reason/note input
 * - ESC key dismissal
 * - Focus trapped inside modal
 * - Animated entrance
 */
import { useEffect, useRef } from 'react';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  severity?: 'danger' | 'warning' | 'info';
  /** If provided, shows a required text field the user must fill to confirm */
  noteField?: {
    label: string;
    placeholder?: string;
    value: string;
    onChange: (v: string) => void;
    required?: boolean;
  };
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

const SEVERITY = {
  danger:  { icon: 'warning',      headerBg: 'bg-error-container',      btnBg: 'bg-danger text-on-error',       iconClass: 'text-danger' },
  warning: { icon: 'report',       headerBg: 'bg-warning/20',            btnBg: 'bg-warning text-on-background', iconClass: 'text-warning' },
  info:    { icon: 'info',         headerBg: 'bg-primary-container/30',  btnBg: 'bg-primary text-on-primary',    iconClass: 'text-primary' },
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  severity = 'danger',
  noteField,
  onConfirm,
  onCancel,
  loading = false,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const s = SEVERITY[severity];

  // Focus cancel button on open (safer default)
  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  // ESC key support
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onCancel]);

  // Block body scroll while open
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  const canConfirm = !noteField?.required || noteField.value.trim().length > 0;

  return (
    <div
      className="fixed inset-0 z-[999] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-on-background/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
      aria-modal="true"
      role="dialog"
      aria-labelledby="confirm-title"
    >
      <div className="bg-surface border-4 border-on-background shadow-[8px_8px_0px_#1A1A1A] w-full sm:max-w-md flex flex-col animate-[slideInUp_0.2s_ease-out]">
        {/* Header */}
        <div className={`${s.headerBg} border-b-4 border-on-background p-5 flex items-start gap-3`}>
          <span className={`material-symbols-outlined fill-icon text-[28px] shrink-0 ${s.iconClass}`}>
            {s.icon}
          </span>
          <h2 id="confirm-title" className="font-headline-md text-headline-md text-on-background leading-snug">
            {title}
          </h2>
        </div>

        {/* Body */}
        <div className="p-6 flex flex-col gap-4">
          <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
            {description}
          </p>

          {noteField && (
            <div className="flex flex-col gap-2">
              <label className="font-label-sm text-label-sm uppercase text-on-background">
                {noteField.label}
                {noteField.required && <span className="text-danger ml-1">*</span>}
              </label>
              <textarea
                value={noteField.value}
                onChange={(e) => noteField.onChange(e.target.value)}
                placeholder={noteField.placeholder}
                rows={3}
                className="w-full border-2 border-on-background p-3 font-body-md text-body-md bg-surface-container-low focus:outline-none focus:shadow-[2px_2px_0px_#1A1A1A] resize-none"
              />
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 p-5 pt-0">
          <button
            ref={cancelRef}
            onClick={onCancel}
            disabled={loading}
            className="flex-1 border-2 border-on-background p-3 font-label-sm text-label-sm uppercase bg-surface hover:bg-surface-variant transition-colors disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading || !canConfirm}
            className={`flex-1 border-2 border-on-background p-3 font-label-sm text-label-sm uppercase ${s.btnBg} neo-shadow hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_#1A1A1A] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
          >
            {loading && <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />}
            {loading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
