/**
 * Storefront locale transport — the kit side of the translations plan.
 *
 * Contract (translations-core.md, decisions closed): the backend accepts
 * `?locale=<code>` on every customer-facing read and answers translated text
 * (unknown/unpublished locale → source text, no error). The storefront proxy
 * sets `x-queek-locale` on the incoming request for published NON-primary
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
