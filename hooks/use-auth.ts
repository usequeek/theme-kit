'use client';

import { useAuthModalStore } from '../stores/auth-modal-store';
import { useUserStore } from '../stores/user-store';

/**
 * The signed-in customer and the sign-in modal controls.
 *
 * `user` is null and `isAuthenticated` false until the shopper signs in.
 * `openAuthModal('signup')` opens the kit's sign-in flow on the sign-up step.
 *
 * @example
 * const { user, isAuthenticated, openAuthModal, logout } = useAuth();
 * return isAuthenticated ? <button onClick={logout}>Sign out</button> : <button onClick={() => openAuthModal()}>Sign in</button>;
 */
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
