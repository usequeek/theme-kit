'use client';

import { create } from 'zustand';
import type { Product } from '../types/product';

interface ProductModalState {
  isOpen: boolean;
  product: Product | null;
  open: (product: Product) => void;
  close: () => void;
}

/** Open and close state for the quick-view product modal. Call `useProductModalStore.getState().open()` from anywhere, or select from it in a component. */
export const useProductModalStore = create<ProductModalState>()((set) => ({
  isOpen: false,
  product: null,
  open: (product) => set({ isOpen: true, product }),
  close: () => set({ isOpen: false, product: null }),
}));
