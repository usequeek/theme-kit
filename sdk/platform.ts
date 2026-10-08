/**
 * Active API platform holder.
 *
 * Every API request the storefront makes carries an `X-Platform` header so the
 * API can resolve the right config + fees. Most of the site runs on the
 * `storefront` channel; the in-core QR ordering page (`/qr`) runs on `instore_qr`.
 *
 * The two client factories (`createBrowserClient`, `getQueekClient`) and the
 * per-platform data caches read this holder. `<PlatformScope>` mutates it
 * synchronously during render so descendant hooks fetch under the right platform.
 *
 * BROWSER-ONLY BY CONSTRUCTION — do not remove the guard in `setActivePlatform`.
 * `'use client'` components are still rendered on the server during SSR, so
 * `<PlatformScope>`'s render-time mutation used to run server-side too. Because
 * this is module state in a long-lived Node process, a single SSR render of
 * `/qr` flipped the holder to `instore_qr` for every subsequent request, for
 * every vendor — the `useEffect` reset only ever runs in the browser. That made
 * `server-store-client`'s `X-Platform` header non-deterministic.
 *
 * SSR therefore always reads `storefront`, which is correct: server-side fetches
 * only ever load storefront-channel content, and the API re-derives and forces
 * the platform regardless.
 */
export type Platform = 'storefront' | 'instore_qr';

let activePlatform: Platform = 'storefront';

export function getActivePlatform(): Platform {
  return activePlatform;
}

export function setActivePlatform(platform: Platform): void {
  if (typeof window === 'undefined') {
    return;
  }

  activePlatform = platform;
}

/**
 * A `zustand/persist` storage engine that isolates instore_qr's client state
 * from the ordinary storefront's, even though both run on the SAME origin (a
 * vendor's own subdomain serves `/` and `/qr` alike, so plain `localStorage`
 * is shared between them by default). Every key this writes while `instore_qr`
 * is active gets a `qr-` prefix, so a value set on the ordinary storefront is
 * simply invisible to `/qr` and vice versa — no in-memory state to keep in
 * sync, no risk of one flow reading the other's leftovers.
 *
 * Without it, a stale non-QR `deliveryMode` (e.g. "pickup", picked earlier on
 * the ordinary storefront) could reach a `/qr` dine-in checkout and have its
 * packaging wrongly enforced. Apply this to every persisted store/key a `/qr`
 * flow touches EXCEPT auth (`queek-storefront-user`, the access/refresh
 * tokens in `queek-client.ts`) — a signed-in customer must stay signed in
 * across both.
 */
export function platformScopedStorage(): {
  getItem: (name: string) => string | null;
  setItem: (name: string, value: string) => void;
  removeItem: (name: string) => void;
} {
  return {
    getItem: (name) => (typeof window === 'undefined' ? null : localStorage.getItem(platformScopedKey(name))),
    setItem: (name, value) => {
      if (typeof window !== 'undefined') localStorage.setItem(platformScopedKey(name), value);
    },
    removeItem: (name) => {
      if (typeof window !== 'undefined') localStorage.removeItem(platformScopedKey(name));
    },
  };
}

/** The raw-localStorage-call equivalent of `platformScopedStorage` — for code
 *  that isn't a zustand store (e.g. the anonymous cart-session token). */
export function platformScopedKey(name: string): string {
  return getActivePlatform() === 'instore_qr' ? `qr-${name}` : name;
}
