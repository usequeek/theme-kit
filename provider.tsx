'use client';

import type { JSX } from 'react';
import { createContext, useContext, useMemo, useRef, type ReactNode } from 'react';
import type { Menu } from './types/menu';
import type { ReviewItem } from './types/block';
import type { Post } from './types/page';
import type { Product } from './types/product';
import type { StorefrontConfig, VendorProfile } from './types/vendor';
import { getBrandCssVariables } from './utils/brand';
import { parseLocaleCode } from './utils/locale';
import { normalizeStoreLocales, type StoreLocale, type StoreLocaleInput } from './utils/locale-switch';
import {
  defaultThemeStrings,
  t as translateThemeStrings,
  type ThemeStringsDictionary,
  type ThemeStringsFn,
  type ThemeStringsVars,
} from './strings/theme-strings';
import { DesignTokenPreviewListener } from './design-token-preview';
import { useOptionalTheme } from './theme-context';

export interface StorefrontPreviewData {
  products?: Product[];
  /** Vendor-scope reviews for preview surfaces. `useReviews` reads these the
   *  same way `useProducts` reads `products` — without them a review-backed
   *  section renders nothing in the preview, style guide and section library,
   *  which is what a vendor browses before choosing it. */
  reviews?: ReviewItem[];
  categories?: Array<{
    id: string;
    slug: string;
    name: string;
    image?: string | null;
    products_count?: number;
  }>;
  posts?: Post[];
}

interface StorefrontContextValue {
  vendor: VendorProfile;
  config: StorefrontConfig;
  menus: Menu[];
  previewData?: StorefrontPreviewData;
  basePath: string;
  /** slug => 'full' | 'bare', for ShellInner to decide the CURRENT page's
   * header/footer without a per-navigation fetch. */
  pagesChrome: Record<string, 'full' | 'bare'>;
  /** Validated request locale (null = primary). Browser hooks read it via
   * `useStorefrontLocale()` and send `?locale=` when it is set. */
  locale: string | null;
  /** Active locale's dictionaries (override, theme, core — the host merges and
   * passes ONLY the active locale). Empty or omitted = English defaults only.
   * Optional so hand-built context values (storefront scripts, tests) keep
   * compiling without it. */
  strings?: ThemeStringsDictionary[];
  /** The store's languages (default first), normalised. Empty or omitted =
   * a single-language store: `useLocales()` reports one language and the
   * `LanguageSwitcher` renders nothing. Optional so hand-built context values
   * keep compiling without it. */
  locales?: StoreLocale[];
}

export const StorefrontContext = createContext<StorefrontContextValue | null>(null);

export function StorefrontProvider({
  vendor,
  config,
  menus,
  previewData,
  basePath,
  pagesChrome,
  locale,
  strings,
  locales,
  children,
}: {
  vendor: VendorProfile;
  config: StorefrontConfig;
  menus: Menu[];
  previewData?: StorefrontPreviewData;
  basePath?: string;
  pagesChrome?: Record<string, 'full' | 'bare'>;
  /**
   * Request locale for translated reads (the storefront host passes its
   * `x-queek-locale` request header through). Optional — absent/invalid
   * means the primary locale, exactly as before. Themes never set this;
   * the host owns it, like `basePath`.
   */
  locale?: string | null;
  /**
   * Active locale's theme-string dictionaries (merchant override, theme
   * locale, kit core locale — the host merges and passes ONLY the active
   * locale, loaded per-locale so no other language ships to the client).
   * Optional — absent means English defaults, and every kit component
   * renders exactly as before. Existing props are untouched.
   */
  strings?: ThemeStringsDictionary | ThemeStringsDictionary[] | null;
  /**
   * The store's languages, resolved by the host (no request from the kit).
   * Pass the host's list as it is — rows follow the locales endpoint shape
   * (`locale`, `name`, `native_name`, `is_primary`, `is_default`,
   * `path_prefix`, …); extra fields are ignored and a missing `is_default`
   * falls back to `is_primary`. Optional — absent or a single language
   * means no language choice: `LanguageSwitcher` renders nothing and
   * `useLocales()` reports one language. Themes never set this; the host
   * owns it, like `basePath`.
   */
  locales?: readonly StoreLocaleInput[] | null;
  children: ReactNode;
}): JSX.Element {
  const resolvedBasePath = basePath ?? `/${vendor.slug ?? ''}`;
  const resolvedLocale = parseLocaleCode(locale);
  const resolvedStrings = useMemo(
    () =>
      !strings
        ? []
        : (Array.isArray(strings) ? strings : [strings]).filter(
            (d): d is ThemeStringsDictionary => !!d,
          ),
    [strings],
  );
  const resolvedLocales = useMemo(() => normalizeStoreLocales(locales), [locales]);
  const value = useMemo(
    () => ({
      vendor,
      config,
      menus,
      previewData,
      basePath: resolvedBasePath,
      pagesChrome: pagesChrome ?? {},
      locale: resolvedLocale,
      strings: resolvedStrings,
      locales: resolvedLocales,
    }),
    [config, menus, previewData, vendor, resolvedBasePath, pagesChrome, resolvedLocale, resolvedStrings, resolvedLocales],
  );
  const brandRootRef = useRef<HTMLDivElement>(null);

  return (
    <StorefrontContext.Provider value={value}>
      <div ref={brandRootRef} data-brand-root style={getBrandCssVariables(config.brand, config)}>
        <DesignTokenPreviewListener targetRef={brandRootRef} />
        {children}
      </div>
    </StorefrontContext.Provider>
  );
}

export function useStorefront(): StorefrontContextValue {
  const context = useContext(StorefrontContext);

  if (!context) {
    throw new Error('useStorefront must be used within StorefrontProvider');
  }

  return context;
}

/**
 * Validated request locale for translated reads (`null` = primary).
 * Browser hooks send `?locale=` when this is set and key their client
 * caches by it, so two locales never share an entry. No provider prop →
 * null, and every hook behaves exactly as before.
 */
export function useStorefrontLocale(): string | null {
  const context = useContext(StorefrontContext);

  if (!context) {
    throw new Error('useStorefrontLocale must be used within StorefrontProvider');
  }

  return context.locale ?? null;
}

/**
 * The client theme-string surface: the bound `t` for the active locale.
 * Chain order: merchant/host override dictionaries (`strings` prop), then
 * the mounted theme's `manifest.strings` (theme English — travels WITH the
 * theme, so preview hosts that pass no `strings` still render English),
 * then the kit core English default — never the raw key. Works in themes
 * mounted by `ThemeMount` and in hosts that provide the theme directly
 * (both expose it through the theme context). No `strings` prop and no
 * manifest → the English defaults, so kit components render exactly as
 * before and third-party themes keep working untranslated.
 */
export function useThemeStrings(): ThemeStringsFn {
  const context = useContext(StorefrontContext);

  if (!context) {
    throw new Error('useThemeStrings must be used within StorefrontProvider');
  }

  const theme = useOptionalTheme();
  const manifestStrings = theme?.manifest?.strings ?? null;
  const { strings, locale } = context;
  return useMemo(
    () =>
      (key: string, vars?: ThemeStringsVars, overrideLocale?: string | null) =>
        translateThemeStrings(
          [...(strings ?? []), ...(manifestStrings ? [manifestStrings] : []), defaultThemeStrings],
          key,
          vars,
          overrideLocale ?? locale ?? undefined,
        ),
    [strings, manifestStrings, locale],
  );
}
