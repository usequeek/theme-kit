'use client';

import { create } from 'zustand';

interface AddressModalState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

export const useAddressModalStore = create<AddressModalState>()((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));
