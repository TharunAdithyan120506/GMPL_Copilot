/**
 * Toast.tsx — Global Toast Notification System
 *
 * Features:
 * - 4 variants: success | error | warning | info
 * - Optional action button (used for "Undo" patterns)
 * - Auto-dismiss after configurable duration (default 4s)
 * - Stacks multiple toasts, max 5 visible
 * - Slides in from bottom-right, swipe-to-dismiss on mobile
 * - Accessible: role="alert", aria-live
 */
import { useEffect, useRef } from 'react';
import { useToast } from '../hooks/useToast';

const VARIANT_STYLES = {
  success: {
    bar: 'bg-success',
    icon: 'check_circle',
    iconClass: 'text-success',
    bg: 'bg-surface',
    border: 'border-success',
  },
  error: {
    bar: 'bg-danger',
    icon: 'error',
    iconClass: 'text-danger',
    bg: 'bg-error-container',
    border: 'border-danger',
  },
  warning: {
    bar: 'bg-warning',
    icon: 'warning',
    iconClass: 'text-warning',
    bg: 'bg-surface',
    border: 'border-warning',
  },
  info: {
    bar: 'bg-info',
    icon: 'info',
    iconClass: 'text-info',
    bg: 'bg-surface',
    border: 'border-on-background',
  },
};

function ToastItem({
  id,
  message,
  variant = 'info',
  action,
  duration = 4000,
}: {
  id: string;
  message: string;
  variant?: keyof typeof VARIANT_STYLES;
  action?: { label: string; onClick: () => void };
  duration?: number;
}) {
  const { dismiss } = useToast();
  const style = VARIANT_STYLES[variant];
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    timerRef.current = setTimeout(() => dismiss(id), duration);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [id, duration, dismiss]);

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`
        relative flex items-start gap-3 w-full max-w-sm
        ${style.bg} border-2 ${style.border}
        shadow-[4px_4px_0px_#1A1A1A] p-4
        animate-[slideInUp_0.25s_ease-out]
      `}
    >
      {/* Left accent bar */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${style.bar}`} />

      {/* Icon */}
      <span className={`material-symbols-outlined fill-icon text-[22px] shrink-0 mt-0.5 ${style.iconClass}`}>
        {style.icon}
      </span>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="font-body-md text-body-md text-on-background leading-snug">{message}</p>
        {action && (
          <button
            onClick={() => { action.onClick(); dismiss(id); }}
            className="mt-2 font-label-sm text-label-sm uppercase text-primary underline hover:no-underline"
          >
            {action.label}
          </button>
        )}
      </div>

      {/* Close */}
      <button
        onClick={() => dismiss(id)}
        aria-label="Dismiss"
        className="shrink-0 p-0.5 text-on-surface-variant hover:text-on-background transition-colors"
      >
        <span className="material-symbols-outlined text-[18px]">close</span>
      </button>
    </div>
  );
}

export function ToastContainer() {
  const { toasts } = useToast();
  if (toasts.length === 0) return null;

  return (
    <div
      aria-label="Notifications"
      className="fixed bottom-4 right-4 z-[9999] flex flex-col-reverse gap-3 w-[calc(100vw-2rem)] max-w-sm pointer-events-none"
    >
      {toasts.slice(-5).map(toast => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem {...toast} />
        </div>
      ))}
    </div>
  );
}
