'use client';

import { create } from 'zustand';

interface AuthModalState {
  isOpen: boolean;
  mode: 'login' | 'signup';
  open: (mode?: 'login' | 'signup') => void;
  close: () => void;
}

/** Open and close state for the sign-in modal. `open('signup')` starts on the sign-up step. Most code uses `useAuth()` instead. */
export const useAuthModalStore = create<AuthModalState>()((set) => ({
  isOpen: false,
  mode: 'login',
  open: (mode = 'login') => set({ isOpen: true, mode }),
  close: () => set({ isOpen: false }),
}));
