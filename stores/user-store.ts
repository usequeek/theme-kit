'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export interface StorefrontUser {
  id: string;
  name: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string;
  avatar: string | null;
  /** API flag: false for social/email signups that still lack a real phone. */
  profile_complete?: boolean;
  delivery_info?: {
    map_lat: number;
    map_lng: number;
    address: string;
  };
}

/**
 * A signed-in customer whose account is missing the details we require to
 * fulfil an order. The API's `profile_complete` is itself derived purely from
 * phone+name presence (`phone !== null && name !== ''`), so both it and the raw
 * `!user.phone` check are gated by `requiresPhone` together — there's no case where one applies without the
 * other.
 *
 * `requiresPhone` — defaults true (delivery/pickup orders need a real number
 * to reach the customer). Pass false for in-person channels like instore_qr:
 * the vendor already has the customer physically present, so a phone is not
 * needed to fulfil the order (matches POS, which never requires it either).
 *
 * `requiresEmail` — pass true for an automated-shipping vendor: Shipbubble's
 * courier lookup needs a real email, which a phone-OTP-only signup never has.
 * Defaults false everywhere else so this stays a no-op for every other caller.
 */
export function isProfileIncomplete(
  user: StorefrontUser | null,
  options: { requiresPhone?: boolean; requiresEmail?: boolean } = {},
): boolean {
  if (!user) {
    return false;
  }
  const { requiresPhone = true, requiresEmail = false } = options;
  return (requiresPhone && (user.profile_complete === false || !user.phone)) || (requiresEmail && !user.email);
}

interface UserState {
  user: StorefrontUser | null;
  isAuthenticated: boolean;
  setUser: (user: StorefrontUser) => void;
  updateDeliveryInfo: (info: { map_lat: number; map_lng: number; address: string }) => void;
  logout: () => void;
}

const STORAGE_KEY = 'queek-storefront-user';

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      setUser: (user) => set({ user, isAuthenticated: true }),
      updateDeliveryInfo: (info) =>
        set((state) => ({
          user: state.user ? { ...state.user, delivery_info: info } : null,
        })),
      logout: () => set({ user: null, isAuthenticated: false }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

// Cross-tab sync: when another tab logs in or out, rehydrate this tab
// so auth state stays consistent everywhere the SDK is used.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY) {
      void useUserStore.persist.rehydrate();
    }
  });
}
