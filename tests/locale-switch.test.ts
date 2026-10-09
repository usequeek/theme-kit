import { describe, expect, it } from 'vitest';
import {
  defaultStoreLocale,
  localeHref,
  normalizeStoreLocales,
  resolveActiveLocale,
  type StoreLocale,
  type StoreLocaleInput,
} from '../utils/locale-switch';

function row(locale: string, extra: Partial<StoreLocaleInput> = {}): StoreLocaleInput {
  return { locale, name: locale, native_name: locale, is_primary: false, ...extra };
}

/** English default, French and Simplified Chinese under prefixes. */
const EN_DEFAULT = normalizeStoreLocales([
  row('en', { name: 'English', native_name: 'English', is_primary: true, is_default: true, path_prefix: '' }),
  row('fr', { name: 'French', native_name: 'Français', is_default: false, path_prefix: 'fr' }),
  row('zh-CN', { name: 'Chinese', native_name: '简体中文', is_default: false, path_prefix: 'zh-cn' }),
]);

/** French default; English (the primary) is not the default, so it lives under /en. */
const FR_DEFAULT = normalizeStoreLocales([
  row('fr', { name: 'French', native_name: 'Français', is_default: true, path_prefix: '' }),
  row('en', { name: 'English', native_name: 'English', is_primary: true, is_default: false, path_prefix: 'en' }),
]);

function pick(locales: StoreLocale[], code: string): StoreLocale {
  const found = locales.find((l) => l.locale === code);
  if (!found) throw new Error(`fixture has no ${code}`);
  return found;
}

function href(
  locales: StoreLocale[],
  from: string,
  to: string,
  url: { pathname: string; search?: string; hash?: string; basePath?: string },
): string {
  return localeHref({ ...url, active: pick(locales, from), target: pick(locales, to) });
}

describe('localeHref', () => {
  it('moves the default language to a prefix and back to the root', () => {
    expect(href(EN_DEFAULT, 'en', 'fr', { pathname: '/shop' })).toBe('/fr/shop');
    expect(href(EN_DEFAULT, 'fr', 'en', { pathname: '/fr/shop', basePath: '/fr' })).toBe('/shop');
  });

  it('keeps the root path at the root of each language', () => {
    expect(href(EN_DEFAULT, 'en', 'fr', { pathname: '/' })).toBe('/fr');
    expect(href(EN_DEFAULT, 'fr', 'en', { pathname: '/fr', basePath: '/fr' })).toBe('/');
  });

  it('puts English under /en when English is not the default', () => {
    expect(href(FR_DEFAULT, 'fr', 'en', { pathname: '/shop' })).toBe('/en/shop');
    expect(href(FR_DEFAULT, 'en', 'fr', { pathname: '/en/shop', basePath: '/en' })).toBe('/shop');
  });

  it('uses the lower-case code as the prefix (zh-CN -> /zh-cn)', () => {
    expect(href(EN_DEFAULT, 'en', 'zh-CN', { pathname: '/products/mug' })).toBe('/zh-cn/products/mug');
    expect(href(EN_DEFAULT, 'zh-CN', 'fr', { pathname: '/zh-cn/products/mug', basePath: '/zh-cn' })).toBe('/fr/products/mug');
  });

  it('switches directly between two prefixed languages', () => {
    expect(href(EN_DEFAULT, 'fr', 'zh-CN', { pathname: '/fr/shop/all', basePath: '/fr' })).toBe('/zh-cn/shop/all');
  });

  it('keeps the query string and the hash', () => {
    expect(href(EN_DEFAULT, 'en', 'fr', { pathname: '/shop', search: '?sort=new&page=2', hash: '#reviews' })).toBe(
      '/fr/shop?sort=new&page=2#reviews',
    );
    expect(href(EN_DEFAULT, 'fr', 'en', { pathname: '/fr', basePath: '/fr', search: '?q=a', hash: '#top' })).toBe('/?q=a#top');
  });

  it('accepts a query string and hash without their leading marks, and ignores empty ones', () => {
    expect(href(EN_DEFAULT, 'en', 'fr', { pathname: '/shop', search: 'a=1', hash: 'x' })).toBe('/fr/shop?a=1#x');
    expect(href(EN_DEFAULT, 'en', 'fr', { pathname: '/shop', search: '?', hash: '#' })).toBe('/fr/shop');
  });

  it('keeps a trailing slash on a nested path', () => {
    expect(href(EN_DEFAULT, 'en', 'fr', { pathname: '/shop/' })).toBe('/fr/shop/');
    expect(href(EN_DEFAULT, 'fr', 'en', { pathname: '/fr/shop/mugs/', basePath: '/fr' })).toBe('/shop/mugs/');
  });

  it('only strips whole segments: a page that starts like a language is a page', () => {
    expect(href(EN_DEFAULT, 'fr', 'en', { pathname: '/fr/french-press', basePath: '/fr' })).toBe('/french-press');
    expect(href(EN_DEFAULT, 'en', 'fr', { pathname: '/french-press' })).toBe('/fr/french-press');
    // Active is the default (no prefix to strip): `/fr` as a path is a page there.
    expect(href(EN_DEFAULT, 'en', 'zh-CN', { pathname: '/fr-news' })).toBe('/zh-cn/fr-news');
  });

  it('strips the active prefix once: a page slug equal to the prefix survives', () => {
    expect(href(EN_DEFAULT, 'fr', 'en', { pathname: '/fr/fr', basePath: '/fr' })).toBe('/fr');
  });

  it('handles a path-based host (basePath carries the store slug)', () => {
    expect(href(EN_DEFAULT, 'en', 'fr', { pathname: '/acme/shop', basePath: '/acme' })).toBe('/acme/fr/shop');
    expect(href(EN_DEFAULT, 'fr', 'en', { pathname: '/acme/fr/shop', basePath: '/acme/fr' })).toBe('/acme/shop');
    expect(href(EN_DEFAULT, 'fr', 'zh-CN', { pathname: '/acme/fr', basePath: '/acme/fr' })).toBe('/acme/zh-cn');
    expect(href(EN_DEFAULT, 'fr', 'en', { pathname: '/acme/fr', basePath: '/acme/fr' })).toBe('/acme');
  });

  it('also copes with a non-localized basePath', () => {
    expect(href(EN_DEFAULT, 'fr', 'en', { pathname: '/acme/fr/shop', basePath: '/acme' })).toBe('/acme/shop');
    expect(href(EN_DEFAULT, 'en', 'fr', { pathname: '/acme', basePath: '/acme' })).toBe('/acme/fr');
  });

  it('matches the active prefix case-insensitively', () => {
    expect(href(EN_DEFAULT, 'zh-CN', 'en', { pathname: '/ZH-CN/shop' })).toBe('/shop');
  });

  it('works on an old backend without is_default (primary is the default)', () => {
    const old = normalizeStoreLocales([
      { locale: 'en', name: 'English', native_name: 'English', is_primary: true, path_prefix: '' },
      { locale: 'fr', name: 'French', native_name: 'Français', is_primary: false, path_prefix: 'fr' },
    ]);
    expect(old.map((l) => [l.locale, l.is_default, l.path_prefix])).toEqual([
      ['en', true, ''],
      ['fr', false, 'fr'],
    ]);
    expect(href(old, 'en', 'fr', { pathname: '/shop' })).toBe('/fr/shop');
    expect(href(old, 'fr', 'en', { pathname: '/fr/shop', basePath: '/fr' })).toBe('/shop');
  });
});

describe('normalizeStoreLocales', () => {
  it('returns [] for nothing usable', () => {
    expect(normalizeStoreLocales(undefined)).toEqual([]);
    expect(normalizeStoreLocales(null)).toEqual([]);
    expect(normalizeStoreLocales([])).toEqual([]);
    expect(normalizeStoreLocales([{} as never, { locale: '' }, null as never])).toEqual([]);
    expect(normalizeStoreLocales('fr' as never)).toEqual([]);
  });

  it('puts the default first and keeps the rest in order', () => {
    const out = normalizeStoreLocales([
      row('fr', { path_prefix: 'fr' }),
      row('en', { is_primary: true, is_default: true }),
      row('de', { path_prefix: 'de' }),
    ]);
    expect(out.map((l) => l.locale)).toEqual(['en', 'fr', 'de']);
  });

  it('keeps exactly one default, forces its prefix empty and fills empty prefixes', () => {
    const out = normalizeStoreLocales([
      row('en', { is_default: true, path_prefix: 'en' }),
      row('FR', { is_default: true, path_prefix: '' }),
      row('pt-BR', { path_prefix: '' }),
    ]);
    expect(out.map((l) => [l.locale, l.is_default, l.path_prefix])).toEqual([
      ['en', true, ''],
      ['FR', false, 'fr'],
      ['pt-BR', false, 'pt-br'],
    ]);
  });

  it('drops repeated codes, tolerates extra fields and defaults missing ones', () => {
    const out = normalizeStoreLocales([
      { locale: 'en', is_primary: true, extra: 'ignored' } as StoreLocaleInput,
      { locale: 'EN', is_primary: false },
      { locale: 'ar', path_prefix: 'ar', dir: 'rtl' },
    ]);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ locale: 'en', name: 'en', native_name: 'en', dir: 'ltr', hreflang: 'en', html_lang: 'en' });
    expect(out[0]).not.toHaveProperty('extra');
    expect(out[1]?.dir).toBe('rtl');
  });

  it('accepts the storefront row shape without mapping', () => {
    const storefrontRows: Array<{
      locale: string; name: string; native_name: string; is_primary: boolean; is_default: boolean;
      path_prefix: string; hreflang: string; html_lang: string; dir: string;
    }> = [
      { locale: 'en', name: 'English', native_name: 'English', is_primary: true, is_default: true, path_prefix: '', hreflang: 'en', html_lang: 'en', dir: 'ltr' },
    ];
    const accepted: readonly StoreLocaleInput[] = storefrontRows;
    const exact: StoreLocale = normalizeStoreLocales(accepted)[0]!;
    // A storefront-typed value is assignable to StoreLocale as well.
    const back: typeof storefrontRows[number] = exact;
    expect(back.locale).toBe('en');
  });
});

describe('active and default resolution', () => {
  it('resolves the request locale case-insensitively, unknown/null to the default', () => {
    expect(resolveActiveLocale(EN_DEFAULT, 'zh-cn').locale).toBe('zh-CN');
    expect(resolveActiveLocale(EN_DEFAULT, 'fr').locale).toBe('fr');
    expect(resolveActiveLocale(EN_DEFAULT, null).locale).toBe('en');
    expect(resolveActiveLocale(EN_DEFAULT, 'xx').locale).toBe('en');
    expect(resolveActiveLocale(FR_DEFAULT, undefined).locale).toBe('fr');
  });

  it('falls back to English for an empty list', () => {
    expect(defaultStoreLocale([]).locale).toBe('en');
    expect(resolveActiveLocale([], 'fr').path_prefix).toBe('');
  });
});
