'use client';

import { create } from 'zustand';

interface SearchModalState {
  isOpen: boolean;
  initialQuery: string;
  open: (query?: string) => void;
  close: () => void;
}

/** Open and close state for the search modal. Call `useSearchModalStore.getState().open()` from anywhere, or select from it in a component. */
export const useSearchModalStore = create<SearchModalState>()((set) => ({
  isOpen: false,
  initialQuery: '',
  open: (query) => set({ isOpen: true, initialQuery: query ?? '' }),
  close: () => set({ isOpen: false }),
}));
