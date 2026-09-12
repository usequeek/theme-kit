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

export const useOrdersSheetStore = create<OrdersSheetState>()((set) => ({
  isOpen: false,
  activeOrderId: null,
  open: () => set({ isOpen: true, activeOrderId: null }),
  close: () => set({ isOpen: false, activeOrderId: null }),
  openDetail: (id) => set({ activeOrderId: id }),
  closeDetail: () => set({ activeOrderId: null }),
}));
