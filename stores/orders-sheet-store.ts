'use client';

import { create } from 'zustand';

interface OrdersSheetState {
  isOpen: boolean;
  activeOrderId: string | null;
  open: () => void;
  close: () => void;
  openDetail: (id: string) => void;
  closeDetail: () => void;
}

/** Open and close state for the customer's orders sheet. Call `useOrdersSheetStore.getState().open()` from anywhere, or select from it in a component. */
export const useOrdersSheetStore = create<OrdersSheetState>()((set) => ({
  isOpen: false,
  activeOrderId: null,
  open: () => set({ isOpen: true, activeOrderId: null }),
  close: () => set({ isOpen: false, activeOrderId: null }),
  openDetail: (id) => set({ activeOrderId: id }),
  closeDetail: () => set({ activeOrderId: null }),
}));
