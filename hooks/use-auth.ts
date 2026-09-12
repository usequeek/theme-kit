'use client';

import { useAuthModalStore } from '../stores/auth-modal-store';
import { useUserStore } from '../stores/user-store';

export function useAuth() {
  return {
    user: useUserStore((state) => state.user),
    isAuthenticated: useUserStore((state) => state.isAuthenticated),
    setUser: useUserStore((state) => state.setUser),
    logout: useUserStore((state) => state.logout),
    openAuthModal: useAuthModalStore((state) => state.open),
    closeAuthModal: useAuthModalStore((state) => state.close),
    authModalOpen: useAuthModalStore((state) => state.isOpen),
    authMode: useAuthModalStore((state) => state.mode),
  };
}
