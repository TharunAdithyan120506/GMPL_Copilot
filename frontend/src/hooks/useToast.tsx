/**
 * useToast.tsx — Toast context + hook
 *
 * Usage:
 *   const { toast } = useToast();
 *   toast.success('Mould assigned!');
 *   toast.error('Failed to save');
 *   toast.warning('Low material stock');
 *   toast.info('Syncing...', { action: { label: 'Undo', onClick: handleUndo } });
 */
import React, { createContext, useCallback, useContext, useState } from 'react';

export interface ToastItem {
  id: string;
  message: string;
  variant: 'success' | 'error' | 'warning' | 'info';
  action?: { label: string; onClick: () => void };
  duration?: number;
}

interface ToastContextValue {
  toasts: ToastItem[];
  toast: {
    success: (msg: string, opts?: Partial<Omit<ToastItem, 'id' | 'message' | 'variant'>>) => void;
    error: (msg: string, opts?: Partial<Omit<ToastItem, 'id' | 'message' | 'variant'>>) => void;
    warning: (msg: string, opts?: Partial<Omit<ToastItem, 'id' | 'message' | 'variant'>>) => void;
    info: (msg: string, opts?: Partial<Omit<ToastItem, 'id' | 'message' | 'variant'>>) => void;
  };
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const add = useCallback((item: Omit<ToastItem, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts(prev => [...prev.slice(-9), { ...item, id }]); // max 10 in state
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = {
    success: (msg: string, opts?: any) => add({ message: msg, variant: 'success', ...opts }),
    error:   (msg: string, opts?: any) => add({ message: msg, variant: 'error',   duration: 6000, ...opts }),
    warning: (msg: string, opts?: any) => add({ message: msg, variant: 'warning', ...opts }),
    info:    (msg: string, opts?: any) => add({ message: msg, variant: 'info',    ...opts }),
  };

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
