'use client';

import { create } from 'zustand';

export interface Toast {
  id: string;
  title: string;
  description?: string;
  /** Product thumbnail — shown instead of the generic checkmark icon when set. */
  image?: string | null;
  /** Show a "View cart" action that opens the cart panel. */
  showCart?: boolean;
  /** Auto-dismiss after this many ms (default 3200). */
  duration?: number;
}

interface ToastState {
  toasts: Toast[];
  show: (toast: Omit<Toast, 'id'>) => string;
  dismiss: (id: string) => void;
}

function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `t_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

const MAX_TOASTS = 3;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  show: (toast) => {
    const id = makeId();
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }].slice(-MAX_TOASTS) }));
    return id;
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

/**
 * Headless helper so non-React code (the cart store) can raise a toast.
 * Kept out of React render paths — call it from event handlers / store actions.
 */
export function toast(toast: Omit<Toast, 'id'>): string {
  return useToastStore.getState().show(toast);
}
