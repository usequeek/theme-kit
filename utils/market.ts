/**
 * Storefront market transport (markets.currency).
 *
 * A store may publish markets: a set of countries plus one currency. The shopper
 * picks one explicitly (no geo switch), the API then answers prices in that
 * currency when a read carries `?market=<id>`, and an order carries the rate pin
 * the cart or quote issued (`market_pin` in the order body).
 *
 * The choice lives in a cookie, so the server render and the browser agree on
 * it. It is per store: the cookie name carries the store slug, because
 * path-based stores share one host. Like `utils/locale.ts` this module is pure
 * (no `next/*`, no React) and every function returns its input untouched when no
 * market is chosen, so a store without a published market behaves exactly as
 * before.
 */

/** One published market of the store, as `GET /client/store/markets` lists it. */
export interface StoreMarket {
  /** The integer id a read sends back as `?market=`. */
  id: number;
  name: string;
  /** ISO 3166-1 alpha-2 codes the market sells to. */
  countries: string[];
  /** ISO 4217 code prices are shown and charged in. */
  currency: string;
}

import { getActivePlatform } from '../sdk/platform';

const MARKET_ID_MAX_LENGTH = 18;
const COOKIE_PREFIX = 'queek_market_';
export const MARKET_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/** The market id a request names, or null. Only short digit strings qualify, so nothing odd reaches the API or a cache key. */
export function parseMarketId(value: unknown): number | null {
  const text = typeof value === 'number' && Number.isInteger(value) ? String(value) : value;
  if (typeof text !== 'string' || text.length === 0 || text.length > MARKET_ID_MAX_LENGTH || !/^\d+$/.test(text)) {
    return null;
  }
  const id = Number(text);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

/** Cookie holding the shopper's market for one store. Slug characters outside the cookie-name set become `_`. */
export function marketCookieName(vendorSlug: string): string {
  return `${COOKIE_PREFIX}${vendorSlug.replace(/[^A-Za-z0-9_-]/g, '_')}`;
}

/** The market id in a `Cookie` header / `document.cookie` string for this store, or null. */
export function readMarketFromCookieString(cookieString: string | null | undefined, vendorSlug: string): number | null {
  if (!cookieString) return null;
  const name = marketCookieName(vendorSlug);
  for (const part of cookieString.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return parseMarketId(rest.join('='));
  }
  return null;
}

/** The `Set-Cookie`-style value a browser write uses; `null` clears the choice. */
export function marketCookieWrite(vendorSlug: string, marketId: number | null): string {
  const name = marketCookieName(vendorSlug);
  return marketId === null
    ? `${name}=; Path=/; Max-Age=0; SameSite=Lax`
    : `${name}=${marketId}; Path=/; Max-Age=${MARKET_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
}

type QueryRecord = Record<string, string | number | boolean | string[] | null | undefined>;

/** Adds `?market=<id>` to a backend query. No market: the input is returned untouched (same reference). */
export function withMarketQuery<T extends QueryRecord>(
  query: T | undefined,
  marketId: number | null | undefined,
): T | (T & { market: string }) | undefined {
  const id = parseMarketId(marketId);
  if (id === null) return query;
  return { ...(query ?? ({} as T)), market: String(id) };
}

/** Appends `market=<id>` to a built URL or path. No market: the input is returned untouched. */
export function withMarketPath(path: string, marketId: number | null | undefined): string {
  const id = parseMarketId(marketId);
  if (id === null || /[?&]market=/.test(path)) return path;
  const hash = path.indexOf('#');
  const head = hash === -1 ? path : path.slice(0, hash);
  const tail = hash === -1 ? '' : path.slice(hash);
  return `${head}${head.includes('?') ? '&' : '?'}market=${id}${tail}`;
}

/**
 * Whether a store read carries prices (or a price-dependent quote): the only
 * calls that take `?market`. The same list decides which server reads leave the
 * shared data cache for a shopper in a market.
 */
export function isMarketPricedPath(path: string): boolean {
  const clean = (path.split(/[?#]/)[0] ?? '').replace(/^(?:\/api\/v1)?(?:\/client\/store)?/, '');
  // Anchored at the first segment: a page called "cart", a product's reviews or an order's pay link are not priced reads.
  return (
    /^\/products(?:\/[^/]+(?:\/related)?)?\/?$/.test(clean) ||
    /^\/(?:collections|categories|promotions|search|shipping-zones|fulfillment|shipping|checkout|payment-methods|cart|wishlist-items)(?:\/|$)/.test(clean) ||
    /^\/order\/checkout\/?$/.test(clean)
  );
}

/**
 * The market of the running browser page. `Provider` sets it from what the host
 * validated; the browser transports read it per request. Server code never
 * touches it (module state is shared between requests there). Markets are a
 * storefront feature: the in-store QR channel never carries one.
 */
let browserMarketId: number | null = null;

export function setBrowserMarketId(marketId: number | null): void {
  if (typeof window === 'undefined') return;
  browserMarketId = parseMarketId(marketId);
}

export function getBrowserMarketId(): number | null {
  return typeof window === 'undefined' || getActivePlatform() !== 'storefront' ? null : browserMarketId;
}

/** Normalises the `store/markets` payload; anything malformed is dropped, so a bad row never reaches a picker. */
export function normalizeStoreMarkets(input: unknown): StoreMarket[] {
  if (!Array.isArray(input)) return [];
  const markets: StoreMarket[] = [];
  for (const row of input as Array<Record<string, unknown> | null>) {
    const id = parseMarketId(row?.id);
    const currency = typeof row?.currency === 'string' ? row.currency.trim().toUpperCase() : '';
    if (id === null || !/^[A-Z]{3}$/.test(currency) || typeof row?.name !== 'string' || row.name === '') continue;
    markets.push({
      id,
      name: row.name,
      countries: Array.isArray(row.countries) ? row.countries.filter((c): c is string => typeof c === 'string') : [],
      currency,
    });
  }
  return markets;
}

/** The refusal codes the market gates answer with, to branch on instead of a message. */
export const MARKET_ERROR_CODES = [
  'market_rate_changed',
  'market_unavailable',
  'market_payment_unavailable',
  'market_price_unusable',
  'market_method_unavailable',
  'market_delivery_unavailable',
  'market_cart_required',
  // A market order older than markets.order_rate_ttl_hours: GET orders/{id}/pay answers 422, no link, order again.
  'market_rate_expired',
  // 422 at the quote and the order (and cart `market.unavailable`): the market total is zero or below the provider minimum.
  'market_total_unusable',
] as const;

export type MarketErrorCode = (typeof MARKET_ERROR_CODES)[number];

/** The market refusal an API failure carries, with its body data (`market` block, fresh `quote`), or null. */
export interface MarketRefusal {
  code: MarketErrorCode;
  status: number;
  message: string;
  /** `data.market`: the market block with a NEW pin on a 409 `market_rate_changed`; null on `market_unavailable`. */
  market: { id: number; name: string; currency: string; pin: string } | null;
  /** `data.quote`: the cart priced at the current rate, when the API could price it. */
  quote: Record<string, unknown> | null;
}

export function asMarketRefusal(error: unknown): MarketRefusal | null {
  const failure = error as { status?: unknown; code?: unknown; message?: unknown; details?: unknown; data?: unknown } | null;
  if (!failure || typeof failure !== 'object') return null;

  const code = MARKET_ERROR_CODES.find((candidate) => candidate === failure.code);
  if (!code || typeof failure.status !== 'number') return null;

  const body = (failure.details ?? failure.data ?? null) as { market?: unknown; quote?: unknown } | null;
  const market = body?.market as { id?: unknown; name?: unknown; currency?: unknown; pin?: unknown } | null | undefined;
  const marketId = parseMarketId(market?.id);

  return {
    code,
    status: failure.status,
    message: typeof failure.message === 'string' ? failure.message : '',
    market:
      marketId !== null && typeof market?.name === 'string' && typeof market?.currency === 'string' && typeof market?.pin === 'string'
        ? { id: marketId, name: market.name, currency: market.currency, pin: market.pin }
        : null,
    quote: body?.quote && typeof body.quote === 'object' ? (body.quote as Record<string, unknown>) : null,
  };
}
