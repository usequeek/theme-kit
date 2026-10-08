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
 * English display locale — the ONE Intl tag every English shopper sees dates,
 * numbers and money in. `en-NG`, not `en-GB`: both print dates identically
 * ("2 October 2026", "14 Feb 2026"), but only `en-NG` renders NGN with the
 * naira sign the stores already show (`₦12,500` vs `en-GB`'s `NGN 12,500`, on
 * Node 22 with full ICU). `DISPLAY_LOCALE` in `utils/format.ts` aliases this, so
 * the value lives in exactly one place.
 */
export const ENGLISH_DISPLAY_LOCALE = 'en-NG';

/**
 * THE single canonical mapping from a storefront locale code to the Intl
 * locale dates/numbers/relative time are formatted in: the shopper's locale,
 * with English in the British/Nigerian style ("2 October 2026", never US
 * "October 2, 2026").
 *
 * - Missing/invalid/unknown-structure codes and EVERY English variant (`en`,
 *   `en-GB`, `en-NG`, `en-US`, …) become `ENGLISH_DISPLAY_LOCALE`. In
 *   particular bare `en` must never reach Intl directly: `en` formats US
 *   order ("October 2, 2026").
 * - Every other well-formed code passes through unchanged (`fr`, `ar`,
 *   `pt-BR`, `zh-CN`, `yo`, `ha`, `sw`, …).
 *
 * Pure (no `next/*`, no React) like the rest of this module. Never throws.
 * Pair with `resolveSupportedLocale` when the runtime's ICU may lack the
 * locale — this function maps, it does not probe.
 */
export function resolveIntlLocale(locale: string | null | undefined): string {
  const code = parseLocaleCode(locale);
  if (!code) return ENGLISH_DISPLAY_LOCALE;
  if ((code.split('-')[0] ?? '').toLowerCase() === 'en') return ENGLISH_DISPLAY_LOCALE;
  return code;
}

/**
 * Graceful ICU fallback for one formatting call: the candidate when this
 * Node's ICU formats it natively, `ENGLISH_DISPLAY_LOCALE` otherwise (a
 * minimal-ICU build with no French data still renders English, never an
 * exception). Never throws — pass any Intl constructor's
 * `supportedLocalesOf`, e.g. `(l) => Intl.DateTimeFormat.supportedLocalesOf(l)`.
 */
export function resolveSupportedLocale(
  candidate: string,
  supportedLocalesOf: (locales: string[]) => readonly string[],
): string {
  try {
    return supportedLocalesOf([candidate]).length > 0 ? candidate : ENGLISH_DISPLAY_LOCALE;
  } catch {
    return ENGLISH_DISPLAY_LOCALE;
  }
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
