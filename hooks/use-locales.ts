'use client';

import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { StorefrontContext } from '../provider';
import { usePathname, useRouter } from '../navigation';
import {
  defaultStoreLocale,
  localeHref,
  resolveActiveLocale,
  type StoreLocale,
} from '../utils/locale-switch';

export interface LocalesState {
  /** The store's languages, the default first. One entry on a single-language store. */
  locales: StoreLocale[];
  /** The language the page renders in. */
  active: StoreLocale;
  /** The language served at the store root. */
  defaultLocale: StoreLocale;
  /** More than one language: whether a language choice makes sense at all. */
  hasMultiple: boolean;
  /**
   * The current page in another language, e.g. `/fr/shop?sort=new`. Takes a
   * language row or its code; an unknown code returns the current URL. The
   * query string and hash are included once the page has mounted (the first
   * render matches the server's markup), so use it for `href`s and call
   * `switchTo` to navigate.
   */
  hrefFor: (locale: StoreLocale | string) => string;
  /** Go to the current page in another language, reading the live query string and hash. */
  switchTo: (locale: StoreLocale | string) => void;
}

const EMPTY_SUFFIX = { search: '', hash: '' };

function readSuffix(): { search: string; hash: string } {
  if (typeof window === 'undefined') return EMPTY_SUFFIX;
  return { search: window.location.search, hash: window.location.hash };
}

/**
 * The store's languages and the active one, for a theme that builds its own
 * language control. Reads what the host passed to `StorefrontProvider`
 * (`locales`) — no request. Absent or one language → a single-language state
 * (`hasMultiple` false) with a no-op-safe `hrefFor`; outside a provider it
 * does not throw.
 *
 * Most themes want the `LanguageSwitcher` component instead.
 */
export function useLocales(): LocalesState {
  const context = useContext(StorefrontContext);
  const pathname = usePathname();
  const router = useRouter();
  const basePath = context?.basePath ?? '';
  const requestLocale = context?.locale ?? null;
  const contextLocales = context?.locales;

  const locales = useMemo(() => contextLocales ?? [], [contextLocales]);
  const defaultLocale = useMemo(() => defaultStoreLocale(locales), [locales]);
  const active = useMemo(() => resolveActiveLocale(locales, requestLocale), [locales, requestLocale]);

  // Query and hash only exist in the browser: start empty so the first client
  // render matches the server, then adopt them (and follow later changes).
  const [suffix, setSuffix] = useState(EMPTY_SUFFIX);
  useEffect(() => {
    const next = readSuffix();
    setSuffix((prev) => (prev.search === next.search && prev.hash === next.hash ? prev : next));
  });

  const resolve = useCallback(
    (locale: StoreLocale | string): StoreLocale | null => {
      if (typeof locale !== 'string') return locale;
      const code = locale.toLowerCase();
      return locales.find((row) => row.locale.toLowerCase() === code) ?? null;
    },
    [locales],
  );

  const build = useCallback(
    (target: StoreLocale, search: string, hash: string) =>
      localeHref({ pathname, search, hash, basePath, active, target }),
    [pathname, basePath, active],
  );

  const hrefFor = useCallback(
    (locale: StoreLocale | string): string => {
      const target = resolve(locale);
      return build(target ?? active, suffix.search, suffix.hash);
    },
    [resolve, build, active, suffix],
  );

  const switchTo = useCallback(
    (locale: StoreLocale | string): void => {
      const target = resolve(locale);
      if (!target || target === active) return;
      const live = readSuffix();
      router.push(build(target, live.search, live.hash));
    },
    [resolve, build, active, router],
  );

  return useMemo(
    () => ({ locales, active, defaultLocale, hasMultiple: locales.length > 1, hrefFor, switchTo }),
    [locales, active, defaultLocale, hrefFor, switchTo],
  );
}
