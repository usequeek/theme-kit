'use client';

import { create } from 'zustand';

interface AddressModalState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

/** Open and close state for the delivery address modal. Call `useAddressModalStore.getState().open()` from anywhere, or select from it in a component. */
export const useAddressModalStore = create<AddressModalState>()((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));
