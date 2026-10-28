'use client';

import { createQueekClient, type QueekClientInstance, type StorageAdapter } from '@usequeek/client-sdk';
import { triggerReauth } from './error-handler';
import { getActivePlatform } from './platform';
import { getBrowserMarketId, isMarketPricedPath, withMarketPath } from '../utils/market';

// This file is 'use client' — every export here only ever runs in the browser.
// ALWAYS same-origin-relative, on purpose: the host app's `next.config` rewrite
// already proxies /api/v1/client/:path* to the real API server-side, so the
// browser never needs (or should have) the API's actual host. Reading
// NEXT_PUBLIC_QUEEK_API_URL here would let a misconfigured env var (e.g. the
// same absolute value used for the SERVER-side QUEEK_API_URL) leak
// api.usequeek.com straight into every client-side request, visible in the
// browser Network tab for autocomplete/resolve/fees/couriers/
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
const platformFetch: typeof fetch = (rawInput, init) => {
  const input = withActiveMarket(rawInput);
  if (init?.headers) {
    const headers = new Headers(init.headers);
    headers.set('X-Platform', getActivePlatform());
    return fetch(input, { ...init, headers }).then(captureRequestId);
  }
  return fetch(input, init).then(captureRequestId);
};

/**
 * The shopper's market rides every priced store call as `?market=<id>` (reads,
 * cart writes, the quote and the order): the one place the SDK-backed client
 * learns it, so no caller can forget it. No market chosen: the URL is untouched.
 * The SDK always hands `fetch` a string URL; anything else passes through.
 */
function withActiveMarket(input: RequestInfo | URL): RequestInfo | URL {
  const marketId = getBrowserMarketId();
  if (marketId === null || typeof input !== 'string' || !input.includes('/client/store/') || !isMarketPricedPath(input)) {
    return input;
  }
  return withMarketPath(input, marketId);
}

/**
 * Every API response carries a request id. The SDK's `request()` returns only
 * the parsed body, so this wrapper — the one place every SDK call's raw Response
 * passes through — is where it can be read at all. Kept as the last-seen value:
 * the only consumer is the checkout failure log, which is exactly the report a
 * customer support ticket needs to be traceable to an API request.
 */
const REQUEST_ID_HEADERS = ['x-request-id', 'x-correlation-id', 'request-id'];

let lastRequestId: string | null = null;

function captureRequestId(response: Response): Response {
  for (const name of REQUEST_ID_HEADERS) {
    const value = response.headers.get(name);
    if (value) {
      lastRequestId = value;
      break;
    }
  }

  return response;
}

/** The API request id of the most recent SDK call, when it sent one. */
export function getLastRequestId(): string | null {
  return lastRequestId;
}

let cachedClient: QueekClientInstance | null = null;
let cachedSlug: string | null = null;
let cachedTokens: string | null = null;

/** The stored token pair, as one comparable value. */
function storedTokens(): string {
  return `${localStorageAdapter.getItem(ACCESS_KEY) ?? ''}\n${localStorageAdapter.getItem(REFRESH_KEY) ?? ''}`;
}

/**
 * The Queek customer SDK client for this store, created once and reused.
 * Browser only: it keeps the customer's tokens in `localStorage` and sends
 * every request to the same-origin `/api/v1`. A 401 signs the customer out and
 * opens the sign-in modal (see `triggerReauth`).
 *
 * The SDK reads the tokens once, when the client is created, so the cached
 * client is rebuilt whenever the stored pair changed under it. Another tab
 * signing in writes the tokens here too, and the user store syncs across tabs:
 * a client still holding no token would send a signed-in shopper's request
 * bare, its 401 would sign them out, and that sign-out would sync back to the
 * tab they had just signed in on.
 *
 * @example
 * const client = getQueekClient(vendor.slug);
 * const orders = await client.get('/client/store/orders');
 */
export function getQueekClient(vendorSlug?: string): QueekClientInstance {
  const slug = vendorSlug ?? null;
  const tokens = storedTokens();

  if (cachedClient && cachedSlug === slug && cachedTokens === tokens) {
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
  cachedTokens = tokens;

  return cachedClient;
}

/** The customer's current access token, or null when signed out or on the server. For one-off requests outside the SDK; never log it. */
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
  cachedTokens = null;
}
