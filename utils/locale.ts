/**
 * Storefront locale transport.
 *
 * The API accepts `?locale=<code>` on every customer-facing read and answers
 * translated text (unknown/unpublished locale → source text, no error). The
 * storefront proxy sets `x-queek-locale` on the incoming request for published NON-primary
 * locales only — the header is ABSENT on the primary locale — and suffixes
 * revalidation tags as `<tag>:locale:<code>`.
 *
 * This module is deliberately pure (no `next/*` imports) so both sides share
 * it: the server transport (`sdk/server-store-client`) and the browser hooks
 * (`hooks/*` via `provider.tsx`). The ONLY `next/headers` read lives in
 * `sdk/server-store-client.ts` (`readRequestLocale`) — never parse the header
 * anywhere else.
 *
 * Backwards compatibility: every function here is a no-op returning its input
 * unchanged when no valid locale is present, so no-locale behaviour is
 * byte-identical to before.
 */

/**
 * English display locale with no region: the neutral last resort when neither
 * the shopper's locale nor the store says where the reader is. Never a fixed
 * country: a store's region comes from the store itself (`storeRegion`), and
 * money from its currency's home (`currencyRegion`). `DISPLAY_LOCALE` in
 * `utils/format.ts` aliases this, so the value lives in exactly one place.
 */
export const ENGLISH_DISPLAY_LOCALE = 'en';

const REGION_PATTERN = /^[A-Z]{2}$/;

function regionCode(value: unknown): string | null {
  const code = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return REGION_PATTERN.test(code) ? code : null;
}

/**
 * The country a currency belongs to: the first two letters of its ISO 4217
 * code (USD → US, GBP → GB, NGN → NG). Null for a currency with no single home
 * (EUR, and the X-codes such as XOF/XAF) or anything that is not a 3-letter code.
 * English money is written the way its home country writes it, so a store's own
 * currency prints the bare local symbol ("$11.50" for USD, "₦5,000" for NGN).
 */
export function currencyRegion(currency: unknown): string | null {
  const code = typeof currency === 'string' ? currency.trim().toUpperCase() : '';
  if (!/^[A-Z]{3}$/.test(code) || code.startsWith('X') || code === 'EUR') return null;
  return code.slice(0, 2);
}

/**
 * Where a store is, for the English dates it prints: its country (`country_code`,
 * ISO 3166-1 alpha-2), else its currency's home (`currencyRegion`), else null
 * (neutral English). Pure: the server render and the browser give the same answer
 * from the same store profile.
 */
export function storeRegion(store: { country_code?: unknown; currency?: unknown } | null | undefined): string | null {
  if (!store || typeof store !== 'object') return null;
  return regionCode(store.country_code) ?? currencyRegion(store.currency);
}

/** The region subtag a locale code carries itself (`en-GB` → GB, `en-Latn-US` → US), or null. */
function ownRegion(code: string): string | null {
  try {
    return regionCode(new Intl.Locale(code).region);
  } catch {
    return null;
  }
}

/**
 * THE single canonical mapping from a storefront locale code to the Intl
 * locale dates/numbers/relative time are formatted in.
 *
 * - English: the reader's own region when the code carries one (`en-GB`
 *   stays `en-GB`), else `region` (the store's, or a currency's home), else
 *   neutral `en`. So a US store reads "Feb 14, 2026" and "$11.50", a
 *   Nigerian one "14 Feb 2026" and "₦5,000".
 * - Missing/invalid codes are English.
 * - Every other well-formed code passes through unchanged (`fr`, `ar`,
 *   `pt-BR`, `zh-CN`, `yo`, `ha`, `sw`, …).
 *
 * Idempotent for a regional tag: `en-US` maps to itself whatever `region`
 * says, so a resolved tag can be passed wherever a storefront locale is
 * expected. Pure (no `next/*`, no
 * React) like the rest of this module. Never throws. Pair with
 * `resolveSupportedLocale` when the runtime's ICU may lack the locale — this
 * function maps, it does not probe.
 */
export function resolveIntlLocale(locale: string | null | undefined, region?: string | null): string {
  const code = parseLocaleCode(locale);
  if (code && (code.split('-')[0] ?? '').toLowerCase() !== 'en') return code;
  const chosen = (code ? ownRegion(code) : null) ?? regionCode(region);
  return chosen ? `en-${chosen}` : ENGLISH_DISPLAY_LOCALE;
}

/**
 * Graceful ICU fallback for one formatting call: the candidate when this
 * Node's ICU formats it natively, `fallback` otherwise (a minimal-ICU build
 * with no French data still renders English, never an exception). Pass the
 * English tag for the same region as the fallback (`resolveIntlLocale(null,
 * region)`) so a language the runtime lacks still prints the store's own
 * symbol and order. Never throws — pass any Intl constructor's
 * `supportedLocalesOf`, e.g. `(l) => Intl.DateTimeFormat.supportedLocalesOf(l)`.
 */
export function resolveSupportedLocale(
  candidate: string,
  supportedLocalesOf: (locales: string[]) => readonly string[],
  fallback: string = ENGLISH_DISPLAY_LOCALE,
): string {
  try {
    return supportedLocalesOf([candidate]).length > 0 ? candidate : fallback;
  } catch {
    return fallback;
  }
}

/** The store's IANA time zone (`timezone` on the store profile), or `UTC` when it sent none or one this runtime does not know. */
export function storeTimeZone(store: unknown): string {
  const zone = typeof store === 'object' && store !== null ? (store as { timezone?: unknown }).timezone : null;
  if (typeof zone !== 'string' || zone.trim() === '') return 'UTC';
  try {
    return new Intl.DateTimeFormat(ENGLISH_DISPLAY_LOCALE, { timeZone: zone.trim() }).resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
}

/** How one store's dates read: the Intl tag for the shopper's language in the store's region, and the store's time zone. */
export interface StoreDisplayFormat {
  locale: string;
  timeZone: string;
}

/**
 * The display format for a store: `locale` through `resolveIntlLocale` with the
 * store's region (checked against this runtime's ICU), `timeZone` from
 * `storeTimeZone`. Pure; server pages call it with the profile they hold,
 * client components read it through `useStoreDisplayFormat()`.
 */
export function storeDisplayFormat(
  locale: string | null | undefined,
  store: { country_code?: unknown; currency?: unknown; timezone?: unknown } | null | undefined,
): StoreDisplayFormat {
  const region = storeRegion(store);
  return {
    locale: resolveSupportedLocale(
      resolveIntlLocale(locale, region),
      (l) => Intl.DateTimeFormat.supportedLocalesOf(l),
      resolveIntlLocale(null, region),
    ),
    timeZone: storeTimeZone(store),
  };
}

/** Request header the proxy sets for published non-primary locales. */
export const LOCALE_CODE_HEADER = 'x-queek-locale';

/** Infix the backend sends on revalidation tags for one locale's entries. */
export const LOCALE_TAG_INFIX = ':locale:';

const LOCALE_CODE_PATTERN = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;
const LOCALE_CODE_MAX_LENGTH = 12;

/**
 * Validates a locale code (header value, provider prop or explicit override).
 * Anything else — absent, wrong shape, too long — is ignored (null), mirroring
 * the backend's unknown-locale → source-text rule: never an error.
 */
export function parseLocaleCode(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0 || value.length > LOCALE_CODE_MAX_LENGTH) {
    return null;
  }
  return LOCALE_CODE_PATTERN.test(value) ? value : null;
}

type QueryRecord = Record<string, string | number | boolean | string[] | null | undefined>;

/**
 * Adds `?locale=<code>` to a backend query. No valid locale → the input is
 * returned untouched (same reference), so the built URL is byte-identical.
 */
export function withLocaleQuery<T extends QueryRecord>(
  query: T | undefined,
  locale: string | null | undefined,
): T | (T & { locale: string }) | undefined {
  const code = parseLocaleCode(locale);
  if (!code) return query;
  return { ...(query ?? ({} as T)), locale: code };
}

/** Cache tag for one locale's entries of a resource (`<tag>:locale:<code>`). */
export function withLocaleTag(tag: string, locale: string | null | undefined): string {
  const code = parseLocaleCode(locale);
  return code ? `${tag}${LOCALE_TAG_INFIX}${code.toLowerCase()}` : tag;
}

/**
 * Suffixes EVERY cache tag with `:locale:<code>` so one locale's entries
 * never share a cache entry with another's (or the primary's). No valid
 * locale → the input array is returned untouched (same reference).
 */
export function withLocaleTags(tags: readonly string[], locale: string | null | undefined): string[] {
  const code = parseLocaleCode(locale);
  if (!code) return tags as string[];
  return tags.map((tag) => `${tag}${LOCALE_TAG_INFIX}${code.toLowerCase()}`);
}

/**
 * Appends `?locale=<code>` to an already-built request path — for callers
 * whose client takes a path string only (the SDK-backed `getQueekClient`,
 * whose `get(path, options?)` carries headers but no query). No valid locale
 * → the path is returned untouched.
 */
export function withLocalePath(path: string, locale: string | null | undefined): string {
  const code = parseLocaleCode(locale);
  if (!code) return path;
  return `${path}${path.includes('?') ? '&' : '?'}locale=${encodeURIComponent(code)}`;
}

/**
 * The locale dimension of a client-side cache key (`''` when unset, so
 * no-locale keys are exactly what they always were). Two locales never share
 * a client cache entry; unset never collides with set.
 */
export function localeCacheKeySegment(locale: string | null | undefined): string {
  const code = parseLocaleCode(locale);
  return code ? code.toLowerCase() : '';
}
