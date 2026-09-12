'use client';

import { create } from 'zustand';

interface PolicyModalState {
  activeSlug: string | null;
  open: (slug: string) => void;
  close: () => void;
}

export const usePolicyModalStore = create<PolicyModalState>()((set) => ({
  activeSlug: null,
  open: (slug) => set({ activeSlug: slug }),
  close: () => set({ activeSlug: null }),
}));
