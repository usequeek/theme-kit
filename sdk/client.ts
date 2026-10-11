import { getActivePlatform } from './platform';

const LOCAL_API_URL = 'http://127.0.0.1:8000/api/v1';
const API_URL_FROM_ENV = process.env.QUEEK_API_URL ?? process.env.NEXT_PUBLIC_QUEEK_API_URL;

/**
 * Origin of the Queek API for SERVER-side reads (server rendering and
 * server-to-server calls; this value never reaches the browser).
 *
 * Set `QUEEK_API_URL` (or `NEXT_PUBLIC_QUEEK_API_URL`) in the storefront host's
 * environment. When neither is set the kit falls back to a local development
 * address and warns once in production builds.
 */
export const API_BASE_URL = API_URL_FROM_ENV ?? LOCAL_API_URL;

// BROWSER-side only (createBrowserClient below, for client components and hooks).
// Always same-origin relative: the host app's `next.config` rewrite proxies
// /api/v1/client/:path* to the API, so the browser never needs the API's real
// host. Reading NEXT_PUBLIC_QUEEK_API_URL here would leak that host into every
// browser request whenever the variable holds the same absolute value as the
// server-side QUEEK_API_URL.
const PUBLIC_API_BASE_URL = '/api/v1';

let warnedAboutLocalApiUrl = false;

function warnIfApiUrlUnset(baseUrl: string): void {
  if (warnedAboutLocalApiUrl || baseUrl !== LOCAL_API_URL || API_URL_FROM_ENV !== undefined) return;
  if (process.env.NODE_ENV !== 'production') return;
  warnedAboutLocalApiUrl = true;
  console.warn(
    `[theme-kit] QUEEK_API_URL is not set, so server-side reads go to ${LOCAL_API_URL}. ` +
      'Set QUEEK_API_URL to your Queek API origin in the storefront host environment.',
  );
}

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

/** Stable machine-readable code for a failed request. Branch on this, not on the message. */
export type ApiErrorCode =
  | 'unauthenticated'
  | 'forbidden'
  | 'not_found'
  | 'rate_limited'
  | 'client_error'
  | 'server_error'
  | 'timeout';

function codeForStatus(status: number): ApiErrorCode {
  if (status === 401) return 'unauthenticated';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status === 429) return 'rate_limited';
  return status >= 500 ? 'server_error' : 'client_error';
}

function nextStepForStatus(status: number, retryAfterSeconds: number | null): string {
  if (status === 401) return 'The customer session is missing or has expired. Ask the customer to sign in again.';
  if (status === 403) return 'This session is not allowed to do that on this store.';
  if (status === 404) return 'The resource does not exist, or it is not visible on this store. Check the slug or id.';
  if (status === 429) {
    return retryAfterSeconds === null
      ? 'Too many requests. Wait a moment, then retry.'
      : `Too many requests. Retry after ${retryAfterSeconds} seconds.`;
  }
  if (status >= 500) return 'The Queek API could not complete the request. Retry shortly; if it keeps failing, quote the request id to Queek support.';
  return 'The API rejected the request. Check the inputs; `detail` carries the API message when it sent one.';
}

/** The request path without its query string, so messages and logs never carry search terms or tokens. */
function pathOnly(url: string): string {
  const end = url.search(/[?#]/);
  return end === -1 ? url : url.slice(0, end);
}

/** Extra context an API failure can carry. All fields are optional. */
export interface ApiRequestErrorDetails {
  /** The API's request id (`x-request-id`), for support tickets. */
  requestId?: string | null;
  /** Seconds the API asked the caller to wait (`Retry-After`), when it sent one. */
  retryAfterSeconds?: number | null;
  /** The API's own error message, when its body carried one. */
  detail?: string | null;
}

/**
 * The API answered with a non-2xx status.
 *
 * Carries the HTTP status so callers can tell a genuine "this does not exist"
 * (404) apart from an infrastructure failure (5xx, timeout, network). That
 * distinction is load-bearing in a host's vendor layout: 404 must render
 * not-found, while an API blip must NOT, because a 404 on every URL of a live
 * store is how storefronts get deindexed.
 *
 * @example
 * try {
 *   await client.get('/products/oak-chair');
 * } catch (error) {
 *   if (error instanceof ApiRequestError && error.code === 'not_found') return null;
 *   throw error;
 * }
 */
export class ApiRequestError extends Error {
  /** Stable machine code derived from the status. */
  readonly code: ApiErrorCode;
  /** True when repeating the same request later can succeed (429 and 5xx). */
  readonly retryable: boolean;
  readonly requestId: string | null;
  readonly retryAfterSeconds: number | null;
  readonly detail: string | null;

  constructor(
    public readonly status: number,
    public readonly url: string,
    { requestId = null, retryAfterSeconds = null, detail = null }: ApiRequestErrorDetails = {},
  ) {
    super(
      `Request to ${pathOnly(url)} failed with status ${status}. ${nextStepForStatus(status, retryAfterSeconds)}` +
        (requestId ? ` (request id ${requestId})` : ''),
    );
    this.name = 'ApiRequestError';
    this.code = codeForStatus(status);
    this.retryable = status === 429 || status >= 500;
    this.requestId = requestId;
    this.retryAfterSeconds = retryAfterSeconds;
    this.detail = detail;
  }
}

/**
 * The request did not finish inside its time budget and was aborted.
 *
 * Thrown in place of the raw `DOMException` that `AbortSignal.timeout()`
 * produces. `DOMException` passes `instanceof Error` but its `message` is a
 * getter with no setter, and Next's dev bundler unconditionally assigns
 * `err.message` on anything `instanceof Error` when rendering its overlay,
 * which crashes with "Cannot set property message of ... which has only a
 * getter". Rewrapping into a plain, settable Error here, the one place every
 * server and browser fetch funnels through, avoids that without changing the
 * abort semantics. The original `DOMException` stays on `cause`.
 */
export class ApiTimeoutError extends Error {
  readonly code: ApiErrorCode = 'timeout';
  /** A timed-out read can be repeated. A timed-out write may already have reached the API: do not repeat it blindly. */
  readonly retryable = true;

  constructor(
    public readonly url: string,
    public readonly timeoutMs: number,
    { cause }: { cause?: unknown } = {},
  ) {
    super(
      `Request to ${pathOnly(url)} timed out after ${timeoutMs}ms. ` +
        'Retry a read. For a write, check whether it was applied before sending it again.',
    );
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
 *
 * @example
 * const product = await client.get<Product>(`/products/${slug}`).catch(swallowNotFound);
 * if (!product) notFound();
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

function readRetryAfterSeconds(response: Response): number | null {
  const raw = response.headers.get('retry-after');
  if (raw === null) return null;
  const seconds = Number(raw);
  return Number.isFinite(seconds) && seconds >= 0 ? Math.ceil(seconds) : null;
}

async function readErrorDetail(response: Response): Promise<string | null> {
  try {
    const body = (await response.json()) as { message?: unknown } | null;
    return typeof body?.message === 'string' ? body.message.slice(0, 300) : null;
  } catch {
    return null;
  }
}

/**
 * One JSON request to the Queek API. Everything the kit fetches goes through here.
 *
 * Only `/client/*` paths are accepted: that scope resolves the store and forces
 * the sales channel, so prices are always the storefront's. A write is never
 * retried: an aborted POST may already have reached the API, and sending it
 * again could duplicate an order or a payment.
 *
 * @throws {ApiRequestError} on a non-2xx response (read `code`, `status`, `requestId`).
 * @throws {ApiTimeoutError} when `timeoutMs` elapses first.
 *
 * @example
 * const info = await request<{ data: { name: string } }>(API_BASE_URL, '/client/store/info', {
 *   timeoutMs: 8000,
 * });
 */
export async function request<T>(baseUrl: string, path: string, options: RequestOptions & { credentials?: RequestCredentials } = {}, extraHeaders?: Record<string, string>): Promise<T> {
  if (!path.startsWith('/client/')) {
    throw new Error(
      `Refused to call "${path}": storefront code may only call /client/* routes, which resolve the store and force the storefront sales channel. ` +
        'Use createServerStoreClient (server) or createBrowserClient (browser); both add the /client/store prefix.',
    );
  }

  warnIfApiUrlUnset(baseUrl);

  const { query, timeoutMs, cachePolicy, ...init } = options;
  const url = `${baseUrl}${withQuery(path, query)}`;

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(extraHeaders ?? {}),
    ...((init.headers as Record<string, string> | undefined) ?? {}),
  };

  // Only idempotent, unauthenticated reads may be cached. A POST must always
  // reach the origin, and a bearer token means the response is per-user: the
  // data cache is shared across every visitor, so caching either would serve
  // one customer's data to another.
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
    throw new ApiRequestError(response.status, url, {
      requestId: response.headers.get('x-request-id'),
      retryAfterSeconds: readRetryAfterSeconds(response),
      detail: await readErrorDetail(response),
    });
  }

  return response.json() as Promise<T>;
}

// createServerClient (legacy v1 routes, no client-context middleware) was removed:
// SSR reads now go through createServerStoreClient (/client/store/*) so the platform
// is always forced server-side. Do NOT reintroduce a raw-v1 client here.

/**
 * Browser-side client for client components and hooks.
 *
 * Calls the same-origin `/api/v1/client/store/*` routes, resolving the store from
 * the page origin plus the `X-Vendor-Slug` header. Reads time out after 15 s and
 * writes after 25 s. Failures throw `ApiRequestError` or `ApiTimeoutError`.
 *
 * @example
 * const client = createBrowserClient(vendor.slug);
 * const { data } = await client.get<{ data: Product[] }>('/products', { per_page: 8 });
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
