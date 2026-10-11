'use client';

import { create } from 'zustand';

interface CartPanelState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

/** Open and close state for the cart panel (drawer). Call `useCartPanelStore.getState().open()` from anywhere, or select from it in a component. */
export const useCartPanelStore = create<CartPanelState>()((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
}));
