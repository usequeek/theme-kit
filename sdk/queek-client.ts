'use client';

import { createQueekClient, type QueekClientInstance, type StorageAdapter } from '@queekai/client-sdk';
import { triggerReauth } from './error-handler';
import { getActivePlatform } from './platform';

// This file is 'use client' — every export here only ever runs in the browser.
// ALWAYS same-origin-relative, on purpose: next.config.ts's rewrite already
// proxies /api/v1/client/:path* to the real backend server-side, so the
// browser never needs (or should have) the backend's actual host. Reading
// NEXT_PUBLIC_QUEEK_API_URL here would let a misconfigured env var (e.g. the
// same absolute value used for the SERVER-side QUEEK_API_URL) leak
// api.usequeek.com straight into every client-side request — confirmed live,
// visible in the browser Network tab for autocomplete/resolve/fees/couriers/
// addresses. No such var read = structurally impossible to leak it from here.
export const API_BASE_URL = '/api/v1';
export const QUEEK_AUTH_URL = process.env.NEXT_PUBLIC_QUEEK_AUTH_URL ?? 'https://auth.usequeek.com';

const ACCESS_KEY = 'queek_client_access_token';
const REFRESH_KEY = 'queek_client_refresh_token';

// SSR-safe localStorage adapter — tokens survive page refresh
const localStorageAdapter: StorageAdapter = {
  getItem: (key) => (typeof window !== 'undefined' ? localStorage.getItem(key) : null),
  setItem: (key, value) => { if (typeof window !== 'undefined') localStorage.setItem(key, value); },
  removeItem: (key) => { if (typeof window !== 'undefined') localStorage.removeItem(key); },
};

/**
 * The SDK's HTTP layer hardcodes `X-Platform: storefront` (auth.js) and writes
 * it AFTER any per-request headers, so neither `config.platform` nor a request
 * override can change it. We intercept via `config.fetch` and rewrite the header
 * to the active platform at request time — so `/qr` requests (config, fees,
 * product detail, order submit, auth) are correctly stamped `instore_qr` while
 * the rest of the site stays `storefront`. Reads the holder per request, so a
 * single cached client serves both platforms.
 */
const platformFetch: typeof fetch = (input, init) => {
  if (init?.headers) {
    const headers = new Headers(init.headers);
    headers.set('X-Platform', getActivePlatform());
    return fetch(input, { ...init, headers });
  }
  return fetch(input, init);
};

let cachedClient: QueekClientInstance | null = null;
let cachedSlug: string | null = null;

export function getQueekClient(vendorSlug?: string): QueekClientInstance {
  const slug = vendorSlug ?? null;

  if (cachedClient && cachedSlug === slug) {
    return cachedClient;
  }

  cachedClient = createQueekClient({
    baseUrl: API_BASE_URL,
    fetch: platformFetch,
    ...(slug ? { vendorSlug: slug } : {}),
    accessTokenStorage: localStorageAdapter,
    refreshTokenStorage: localStorageAdapter,
    accessTokenStorageKey: ACCESS_KEY,
    refreshTokenStorageKey: REFRESH_KEY,
    onUnauthenticated: ({ path }) => {
      triggerReauth(path);
    },
  });
  cachedSlug = slug;

  return cachedClient;
}

/** Read the current access token for one-off requests outside the SDK (e.g. inbox pairing-code mint). */
export function getAccessToken(): string | null {
  return typeof window !== 'undefined' ? localStorage.getItem(ACCESS_KEY) : null;
}

/**
 * Headers for a raw `fetch` to the API outside the SDK. Needed only for verbs
 * the SDK does not expose (it has GET/POST/PUT/DELETE — no PATCH). Mirrors the
 * headers the SDK sends so the request is authenticated + scoped identically.
 */
export function clientAuthHeaders(vendorSlug?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'X-Platform': getActivePlatform(),
  };
  const token = getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (vendorSlug) headers['X-Vendor-Slug'] = vendorSlug;
  return headers;
}

/** Persist tokens from external auth flows (Google OAuth, email-password) and reset the SDK cache. */
export function setAuthTokens(accessToken: string, refreshToken: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ACCESS_KEY, accessToken);
  localStorage.setItem(REFRESH_KEY, refreshToken);
  // Reset cache so the next getQueekClient() reads the new tokens from localStorage.
  cachedClient = null;
  cachedSlug = null;
}
