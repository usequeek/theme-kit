'use client';

import { create } from 'zustand';

interface AuthModalState {
  isOpen: boolean;
  mode: 'login' | 'signup';
  open: (mode?: 'login' | 'signup') => void;
  close: () => void;
}

export const useAuthModalStore = create<AuthModalState>()((set) => ({
  isOpen: false,
  mode: 'login',
  open: (mode = 'login') => set({ isOpen: true, mode }),
  close: () => set({ isOpen: false }),
}));
