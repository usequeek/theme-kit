import { getActivePlatform } from './platform';

// SERVER-side only (SSR data fetching, server-to-server — never reaches the
// browser, so the real absolute host is correct and required here).
export const API_BASE_URL = process.env.QUEEK_API_URL ?? process.env.NEXT_PUBLIC_QUEEK_API_URL ?? 'http://127.0.0.1:8000/api/v1';
// BROWSER-side only (createBrowserClient below, "for client components/hooks").
// Hardcoded relative on purpose, same reasoning as queek-client.ts's
// API_BASE_URL: the host app's `next.config` rewrite already proxies
// /api/v1/client/:path* to the API server-side, so the browser never needs the
// real host. This
// used to read NEXT_PUBLIC_QUEEK_API_URL directly — when that's set to the
// same absolute value as the server-side QUEEK_API_URL, every hook built on
// createBrowserClient (products, shop, categories, reviews, related products,
// product questions, QR collections) leaked api.usequeek.com straight into
// the browser Network tab, bypassing the proxy entirely.
const PUBLIC_API_BASE_URL = '/api/v1';

export interface RequestOptions extends RequestInit {
  query?: Record<string, string | number | boolean | string[] | null | undefined>;
  /** Abort budget. Omit to leave the request unbounded (browser default). */
  timeoutMs?: number;
  /**
   * Server-only. A policy caches the read; `null` forces `no-store`; `undefined`
   * leaves fetch untouched (the browser path, where `next` options are inert).
   */
  cachePolicy?: RequestCachePolicy | null;
}

export interface RequestCachePolicy {
  revalidate: number;
  tags: string[];
}

/**
 * Browser abort budgets. Generous on purpose — these exist so a hung request
 * eventually releases, not to enforce an SLA on a shopper's mobile connection.
 *
 * A write gets far more room than a read, and `request()` NEVER retries: an
 * aborted POST may already have reached the API, so re-sending it could
 * duplicate an order or a payment.
 */
const BROWSER_GET_TIMEOUT_MS = 15_000;
const BROWSER_POST_TIMEOUT_MS = 25_000;

/**
 * Carries the HTTP status so callers can tell a genuine "this does not exist"
 * (404) apart from an infrastructure failure (5xx, timeout, network). That
 * distinction is load-bearing in a host's vendor layout: 404 must render
 * not-found, while an API blip must NOT — a 404 on every URL of a live store
 * is how storefronts get deindexed.
 */
export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly url: string,
  ) {
    super(`Request failed with status ${status}`);
    this.name = 'ApiRequestError';
  }
}

/**
 * Thrown in place of the raw `DOMException` that `AbortSignal.timeout()`
 * produces. `DOMException` passes `instanceof Error` but its `message` is a
 * getter with no setter — Next's dev bundler (`setup-dev-bundler.js`,
 * `logErrorWithOriginalStack`) unconditionally does `err.message = ...` on
 * anything `instanceof Error` when rendering the dev overlay, which crashes
 * with "Cannot set property message of ... which has only a getter" and
 * cascades into unhandledRejection noise. Rewrapping into a plain, settable
 * Error here — the one place every SSR/browser fetch funnels through — stops
 * that crash without touching the abort/timeout semantics themselves.
 */
export class ApiTimeoutError extends Error {
  constructor(
    public readonly url: string,
    public readonly timeoutMs: number,
    { cause }: { cause?: unknown } = {},
  ) {
    super(`Request to ${url} timed out after ${timeoutMs}ms`);
    this.name = 'ApiTimeoutError';
    this.cause = cause;
  }
}

/**
 * For fetchers whose caller renders not-found on a null result.
 *
 * Returns null ONLY for a real 404 and rethrows everything else. A bare
 * `catch { return null }` there turns an API timeout or 5xx into a 404 for a
 * product/page that exists — which is what deindexes a store's highest-value
 * URLs during a blip, and became far more likely once SSR fetches gained an
 * abort budget.
 *
 * `status` is read structurally rather than via `instanceof`: the class is
 * emitted once per bundler layer, so an `instanceof` check across the RSC/SSR
 * boundary can be silently false.
 */
export function swallowNotFound(error: unknown): null {
  if ((error as { status?: number } | null)?.status === 404) {
    return null;
  }

  throw error;
}

function withQuery(path: string, query?: RequestOptions['query']): string {
  if (!query) {
    return path;
  }

  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined || value === '') {
      continue;
    }

    // The API's query parser only builds a real array from bracket notation
    // (`key[]=a&key[]=b`) — a plain comma-joined `key=a,b` (URLSearchParams'
    // default for an array via String()) arrives server-side as a single
    // string, failing an `array` validation rule outright.
    if (Array.isArray(value)) {
      for (const item of value) {
        params.append(`${key}[]`, String(item));
      }
      continue;
    }

    params.set(key, String(value));
  }

  const queryString = params.toString();

  return queryString === '' ? path : `${path}?${queryString}`;
}

export async function request<T>(baseUrl: string, path: string, options: RequestOptions & { credentials?: RequestCredentials } = {}, extraHeaders?: Record<string, string>): Promise<T> {
  // HARD RULE: the storefront only ever calls the `/v1/client/*` scope. That scope
  // resolves the vendor AND forces the platform (storefront/instore_qr), so prices
  // are always the storefront's (no marketplace commission). Legacy v1 routes
  // (/products, /vendors/*, /categories) skip that resolution → wrong platform →
  // wrong price. Never call them from here.
  if (!path.startsWith('/client/')) {
    throw new Error(`Storefront may only call /v1/client/* routes — got "${path}". Use createServerStoreClient / createBrowserClient (which prefix /client/store).`);
  }

  const { query, timeoutMs, cachePolicy, ...init } = options;
  const url = `${baseUrl}${withQuery(path, query)}`;

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(extraHeaders ?? {}),
    ...((init.headers as Record<string, string> | undefined) ?? {}),
  };

  // Only idempotent, unauthenticated reads may be cached. A POST must always
  // reach the origin, and a bearer token means the response is per-user — the
  // data cache is shared across every visitor, so caching either would serve one
  // customer's data to another.
  const method = (init.method ?? 'GET').toUpperCase();
  const cacheable = method === 'GET' && headers.Authorization === undefined && !!cachePolicy;

  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers,
      ...(timeoutMs === undefined ? {} : { signal: AbortSignal.timeout(timeoutMs) }),
      ...(cacheable
        ? { next: { revalidate: cachePolicy.revalidate, tags: cachePolicy.tags } }
        : cachePolicy === undefined
          ? {}
          : { cache: 'no-store' as const }),
      ...(init.credentials ? { credentials: init.credentials } : {}),
    });
  } catch (error) {
    if (error instanceof DOMException && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      throw new ApiTimeoutError(url, timeoutMs ?? 0, { cause: error });
    }
    throw error;
  }

  if (!response.ok) {
    throw new ApiRequestError(response.status, url);
  }

  return response.json() as Promise<T>;
}

// createServerClient (legacy v1 routes, no client-context middleware) was removed:
// SSR reads now go through createServerStoreClient (/client/store/*) so the platform
// is always forced server-side. Do NOT reintroduce a raw-v1 client here.

/**
 * Browser-side client for client components/hooks.
 * Uses client-store routes (/client/store/*) with Origin + X-Vendor-Slug vendor resolution.
 */
export function createBrowserClient(vendorSlug?: string, token?: string): {
  get: <T>(path: string, query?: RequestOptions['query']) => Promise<T>;
  post: <T>(path: string, body?: unknown) => Promise<T>;
} {
  // Built per-request so X-Platform reflects the active platform at call time
  // (e.g. the /qr page runs on `instore_qr` while the rest is `storefront`).
  const buildHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = { 'X-Platform': getActivePlatform() };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (vendorSlug) headers['X-Vendor-Slug'] = vendorSlug;
    return headers;
  };

  return {
    get: <T>(path: string, query?: RequestOptions['query']) =>
      request<T>(PUBLIC_API_BASE_URL, `/client/store${path}`, { query, timeoutMs: BROWSER_GET_TIMEOUT_MS }, buildHeaders()),
    post: <T>(path: string, body?: unknown) =>
      request<T>(PUBLIC_API_BASE_URL, `/client/store${path}`, {
        method: 'POST',
        body: body ? JSON.stringify(body) : undefined,
        timeoutMs: BROWSER_POST_TIMEOUT_MS,
      }, buildHeaders()),
  };
}
