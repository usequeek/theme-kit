/**
 * Language-switch URL rules — pure (no `next/*`, no React) so the hook, the
 * component and any node tooling share one implementation.
 *
 * Routing shape of a storefront with several languages:
 *
 * - The store's DEFAULT language is served at the store root (`path_prefix`
 *   is `''`).
 * - Every other language — English included when it is not the default —
 *   lives under its bare lower-case code: `/fr`, `/en`, `/zh-cn`.
 * - Slugs are never translated, so a page keeps the same path under every
 *   prefix.
 * - `StorefrontProvider`'s `basePath` already carries the ACTIVE language
 *   prefix (`/store/fr` on a path-based host, `/fr` on a store domain), so
 *   links built from it stay in the shopper's language. `localeHref` takes
 *   that into account.
 */

/** One language a store serves — the row shape the locales endpoint returns. */
export interface StoreLocale {
  /** Language code, e.g. `en`, `fr`, `zh-CN`. */
  locale: string;
  /** English name, e.g. `French`. */
  name: string;
  /** The language's own name, e.g. `Français`. */
  native_name: string;
  /** The store's content (source) language. */
  is_primary: boolean;
  /** Served at the store root. Exactly one language is the default. */
  is_default: boolean;
  /** URL prefix: `''` on the default language, the bare lower-case code otherwise. */
  path_prefix: string;
  hreflang: string;
  html_lang: string;
  /** `'rtl'` or `'ltr'`. */
  dir: string;
}

/**
 * What `StorefrontProvider` accepts for `locales`: a `StoreLocale` list as
 * the storefront already holds it, or an older payload that lacks
 * `is_default` (then the primary language is the default). Extra fields are
 * tolerated and dropped.
 */
export interface StoreLocaleInput {
  locale: string;
  name?: string;
  native_name?: string;
  is_primary?: boolean;
  is_default?: boolean;
  path_prefix?: string;
  hreflang?: string;
  html_lang?: string;
  dir?: string;
}

const FALLBACK_LOCALE_CODE = 'en';

/**
 * Validates and normalises a locales payload into `StoreLocale` rows.
 *
 * - Rows without a string `locale` are dropped; a repeated code keeps its
 *   first row.
 * - `is_default` missing (older backend) is derived from `is_primary`.
 * - Exactly one row stays default: the first flagged one, else the primary,
 *   else the first row. It sorts first (others keep their order) and its
 *   prefix is forced to `''`; every other prefix is lower-cased, and an
 *   empty one becomes the bare lower-case code.
 * - Nothing usable → `[]`, which the hook and component read as "single
 *   language: no switcher".
 */
export function normalizeStoreLocales(input: readonly StoreLocaleInput[] | null | undefined): StoreLocale[] {
  if (!Array.isArray(input)) return [];

  const seen = new Set<string>();
  const rows: StoreLocale[] = [];
  for (const row of input as readonly StoreLocaleInput[]) {
    if (!row || typeof row.locale !== 'string' || row.locale.length === 0) continue;
    const key = row.locale.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const isPrimary = row.is_primary === true;
    rows.push({
      locale: row.locale,
      name: typeof row.name === 'string' && row.name ? row.name : row.locale,
      native_name: typeof row.native_name === 'string' && row.native_name ? row.native_name : (typeof row.name === 'string' && row.name ? row.name : row.locale),
      is_primary: isPrimary,
      is_default: typeof row.is_default === 'boolean' ? row.is_default : isPrimary,
      path_prefix: typeof row.path_prefix === 'string' ? row.path_prefix.toLowerCase() : '',
      hreflang: typeof row.hreflang === 'string' && row.hreflang ? row.hreflang : row.locale,
      html_lang: typeof row.html_lang === 'string' && row.html_lang ? row.html_lang : row.locale,
      dir: row.dir === 'rtl' ? 'rtl' : 'ltr',
    });
  }
  if (rows.length === 0) return [];

  const defaultRow = rows.find((row) => row.is_default) ?? rows.find((row) => row.is_primary) ?? rows[0];
  const normalized = rows.map((row) => {
    const isDefault = row === defaultRow;
    return {
      ...row,
      is_default: isDefault,
      path_prefix: isDefault ? '' : row.path_prefix || row.locale.toLowerCase(),
    };
  });
  return [...normalized.filter((row) => row.is_default), ...normalized.filter((row) => !row.is_default)];
}

/**
 * The store's default language — the one served at the root. Falls back to
 * the primary, then the first row, then English for an empty list.
 */
export function defaultStoreLocale(locales: readonly StoreLocale[]): StoreLocale {
  return (
    locales.find((locale) => locale.is_default) ??
    locales.find((locale) => locale.is_primary) ??
    locales[0] ?? {
      locale: FALLBACK_LOCALE_CODE,
      name: 'English',
      native_name: 'English',
      is_primary: true,
      is_default: true,
      path_prefix: '',
      hreflang: FALLBACK_LOCALE_CODE,
      html_lang: FALLBACK_LOCALE_CODE,
      dir: 'ltr',
    }
  );
}

/**
 * The language a request renders in. `localeCode` is the request locale the
 * provider holds (`null` on the default language). An unknown code resolves
 * to the default — never an error.
 */
export function resolveActiveLocale(locales: readonly StoreLocale[], localeCode: string | null | undefined): StoreLocale {
  if (localeCode) {
    const code = localeCode.toLowerCase();
    const match = locales.find((locale) => locale.locale.toLowerCase() === code);
    if (match) return match;
  }
  return defaultStoreLocale(locales);
}

/** `/a/b` starts with segment path `/a` (whole segments only). */
function hasSegmentPrefix(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}

function hasSegmentSuffix(path: string, segment: string): boolean {
  return path === `/${segment}` || path.endsWith(`/${segment}`);
}

function withMark(value: string | undefined, mark: '?' | '#'): string {
  if (!value || value === mark) return '';
  return value.startsWith(mark) ? value : `${mark}${value}`;
}

export interface LocaleHrefInput {
  /** The current path as the browser shows it, e.g. `/store/fr/shop`. */
  pathname: string;
  /** Query string, with or without the leading `?`. Kept as is. */
  search?: string;
  /** Hash, with or without the leading `#`. Kept as is. */
  hash?: string;
  /** The provider's `basePath` (already carries the active language prefix). */
  basePath?: string;
  /** The language the page renders in now. */
  active: StoreLocale;
  /** The language to switch to. */
  target: StoreLocale;
}

/**
 * The same page in another language: the path moves under the target's
 * prefix (or to the root for the default language), the query string and
 * hash are kept, and a trailing slash is kept.
 *
 * Only the ACTIVE prefix is removed from the current path, and only as a
 * whole segment — `/french-press` is a page, not the `fr` language.
 */
export function localeHref({ pathname, search, hash, basePath = '', active, target }: LocaleHrefInput): string {
  const activePrefix = active.path_prefix.toLowerCase();
  const current = pathname || '/';
  const lowerBase = basePath.toLowerCase();

  let vendorBase = basePath;
  let bare = current;

  if (activePrefix && hasSegmentSuffix(lowerBase, activePrefix)) {
    // `basePath` is the localized one: removing it removes the language too.
    vendorBase = basePath.slice(0, basePath.length - activePrefix.length - 1);
    if (hasSegmentPrefix(current.toLowerCase(), lowerBase)) bare = current.slice(basePath.length) || '/';
  } else {
    if (basePath && hasSegmentPrefix(current, basePath)) bare = current.slice(basePath.length) || '/';
    if (activePrefix && hasSegmentPrefix(bare.toLowerCase(), `/${activePrefix}`)) {
      bare = bare.slice(activePrefix.length + 1) || '/';
    }
  }
  if (!bare.startsWith('/')) bare = `/${bare}`;

  const targetPrefix = target.is_default ? '' : target.path_prefix.toLowerCase() || target.locale.toLowerCase();
  const rest = bare === '/' ? '' : bare;
  const path = `${vendorBase}${targetPrefix ? `/${targetPrefix}` : ''}${rest}` || '/';

  return `${path}${withMark(search, '?')}${withMark(hash, '#')}`;
}
