import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { JSX, ReactNode } from 'react';
import {
  LOCALE_CODE_HEADER,
  localeCacheKeySegment,
  parseLocaleCode,
  withLocalePath,
  withLocaleQuery,
  withLocaleTag,
  withLocaleTags,
} from '../utils/locale';
import { StorefrontProvider, useStorefrontLocale } from '../provider';
import { ShopPrefetchProvider, useShop } from '../hooks/use-shop';
import { normalizeShopQuery, type ShopPrefetch } from '../utils/shop-query';
import type { Product } from '../types/product';

/**
 * Theme-kit locale transport: the API answers `?locale=<code>`
 * with translated text, the proxy sets `x-queek-locale` for published
 * non-primary locales only, and every kit transport forwards it additively —
 * no locale anywhere means byte-identical behaviour to before.
 */

const requestHeaders = vi.hoisted(() => ({ headers: new Headers(), throwOutsideScope: false }));

vi.mock('next/headers', () => ({
  headers: async () => {
    if (requestHeaders.throwOutsideScope) throw new Error('headers() outside request scope');
    return requestHeaders.headers;
  },
}));

function setRequestHeaders(values: Record<string, string>): void {
  requestHeaders.headers = new Headers(values);
  requestHeaders.throwOutsideScope = false;
}

afterEach(() => {
  vi.unstubAllGlobals();
  setRequestHeaders({});
});

describe('parseLocaleCode (header / prop / override validation)', () => {
  it('accepts well-formed codes', () => {
    for (const code of ['en', 'zh', 'yo', 'pcm', 'zh-CN', 'pt-BR', 'zh-TW', 'sr-Latn']) {
      expect(parseLocaleCode(code), code).toBe(code);
    }
  });

  it('ignores anything else (never an error)', () => {
    for (const bad of [
      '',
      'e',
      'toolongcode123',
      'zh!',
      'en_US',
      'en us',
      'shop',
      'products',
      '-zh',
      'zh-',
      '123',
      null,
      undefined,
      42,
      {},
    ]) {
      expect(parseLocaleCode(bad), JSON.stringify(bad)).toBeNull();
    }
  });

  it('enforces the 12-char cap', () => {
    expect(parseLocaleCode('ab-cdefghij')).toBe('ab-cdefghij');
    expect(parseLocaleCode('ab-cdefghijk')).toBeNull();
  });
});

describe('withLocaleQuery (backend URL building)', () => {
  it('adds locale=<code> to a query', () => {
    expect(withLocaleQuery({ per_page: 24, page: 1 }, 'zh-CN')).toEqual({ per_page: 24, page: 1, locale: 'zh-CN' });
  });

  it('builds a query from nothing when locale is set', () => {
    expect(withLocaleQuery(undefined, 'zh')).toEqual({ locale: 'zh' });
  });

  it('returns the input untouched when no valid locale is present', () => {
    const query = { per_page: 24 };
    expect(withLocaleQuery(query, null)).toBe(query);
    expect(withLocaleQuery(query, undefined)).toBe(query);
    expect(withLocaleQuery(query, '!!')).toBe(query);
    expect(withLocaleQuery(undefined, null)).toBeUndefined();
  });
});

describe('cache tag suffixing (`<tag>:locale:<code>`)', () => {
  it('suffixes every tag, lower-cased', () => {
    expect(withLocaleTag('v:acme:theme', 'zh-CN')).toBe('v:acme:theme:locale:zh-cn');
    expect(withLocaleTags(['v:acme', 'v:acme:theme', 'v:acme:menus'], 'zh')).toEqual([
      'v:acme:locale:zh',
      'v:acme:theme:locale:zh',
      'v:acme:menus:locale:zh',
    ]);
  });

  it('returns tags untouched when no valid locale is present', () => {
    const tags = ['v:acme', 'v:acme:theme'];
    expect(withLocaleTags(tags, null)).toBe(tags);
    expect(withLocaleTags(tags, 'shop')).toBe(tags);
    expect(withLocaleTag('v:acme', null)).toBe('v:acme');
  });
});

describe('withLocalePath (SDK-backed callers with path strings only)', () => {
  it('appends locale, respecting an existing query string', () => {
    expect(withLocalePath('/client/store/products/egusi', 'zh')).toBe('/client/store/products/egusi?locale=zh');
    expect(withLocalePath('/x?limit=4', 'zh-CN')).toBe('/x?limit=4&locale=zh-CN');
  });

  it('returns the path untouched without a valid locale', () => {
    expect(withLocalePath('/client/store/products/egusi', null)).toBe('/client/store/products/egusi');
    expect(withLocalePath('/x?limit=4', 'nope!')).toBe('/x?limit=4');
  });
});

describe('localeCacheKeySegment (client cache keys)', () => {
  it('separates locales and never collides with unset', () => {
    expect(localeCacheKeySegment('zh')).toBe('zh');
    expect(localeCacheKeySegment('zh-CN')).toBe('zh-cn');
    expect(localeCacheKeySegment(null)).toBe('');
    expect(localeCacheKeySegment('!!')).toBe('');
    expect(localeCacheKeySegment('zh')).not.toBe(localeCacheKeySegment(null));
  });
});

describe('server transport (sdk/server-store-client)', () => {
  type CapturedInit = RequestInit & { next?: { revalidate: number; tags: string[] } };

  async function capturedGet(path: string, query?: Record<string, string | number>, locale?: string): Promise<{ url: string; init: CapturedInit }> {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({ ok: true, json: async () => ({ data: {} }) }));
    vi.stubGlobal('fetch', fetchMock);
    const { createServerStoreClient } = await import('../sdk/server-store-client');
    const client = createServerStoreClient('acme', 'http://origin.test');
    await client.get(path, query, locale);
    const [[url, init]] = fetchMock.mock.calls as unknown as Array<[string, CapturedInit]>;
    return { url, init };
  }

  it('appends locale=<code> and suffixes every tag when the header is set', async () => {
    setRequestHeaders({ [LOCALE_CODE_HEADER]: 'zh-CN', host: 'acme.test' });
    const { url, init } = await capturedGet('/info');
    expect(url).toContain('locale=zh-CN');
    expect(init.next?.tags).toEqual(['v:acme:locale:zh-cn', 'v:acme:profile:locale:zh-cn']);
  });

  it('is byte-identical to today with no header', async () => {
    setRequestHeaders({ host: 'acme.test' });
    const { url, init } = await capturedGet('/info');
    expect(url).toBe('http://127.0.0.1:8000/api/v1/client/store/info');
    expect(init.next).toEqual({ revalidate: 300, tags: ['v:acme', 'v:acme:profile'] });
  });

  it('ignores an invalid header value', async () => {
    setRequestHeaders({ [LOCALE_CODE_HEADER]: 'not a locale!!', host: 'acme.test' });
    const { url, init } = await capturedGet('/info');
    expect(url).not.toContain('locale=');
    expect(init.next?.tags).toEqual(['v:acme', 'v:acme:profile']);
  });

  it('never throws outside a request scope (treated as no locale)', async () => {
    requestHeaders.throwOutsideScope = true;
    const { readRequestLocale } = await import('../sdk/server-store-client');
    await expect(readRequestLocale()).resolves.toBeNull();
    requestHeaders.throwOutsideScope = false;
    const { url } = await capturedGet('/info');
    expect(url).not.toContain('locale=');
  });

  it('an explicit override wins over the header', async () => {
    setRequestHeaders({ [LOCALE_CODE_HEADER]: 'zh', host: 'acme.test' });
    const { url, init } = await capturedGet('/info', undefined, 'fr');
    expect(url).toContain('locale=fr');
    expect(init.next?.tags).toEqual(['v:acme:locale:fr', 'v:acme:profile:locale:fr']);
  });

  it('still bypasses the cache for preview renders, locale or not', async () => {
    setRequestHeaders({ 'x-queek-preview': '1', [LOCALE_CODE_HEADER]: 'zh', host: 'acme.test' });
    const { url, init } = await capturedGet('/info');
    expect(url).toContain('locale=zh');
    expect(init.next).toBeUndefined();
    expect(init.cache).toBe('no-store');
  });
});

describe('fetchShopPrefetch (api/shop)', () => {
  async function runPrefetch(vendorSlug = 'demo-store', locale?: string) {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({ ok: true, json: async () => ({ data: [], has_more: false }) }));
    vi.stubGlobal('fetch', fetchMock);
    const { fetchShopPrefetch } = await import('../api/shop');
    const prefetch = await fetchShopPrefetch(vendorSlug, normalizeShopQuery({}), locale);
    const urls = (fetchMock.mock.calls as unknown as Array<[string]>).map(([url]) => String(url));
    const productsCall = urls.find((url) => url.includes('/products')) ?? '';
    return { prefetch, productsCall };
  }

  it('forwards the request locale and echoes it for the seed match', async () => {
    setRequestHeaders({ [LOCALE_CODE_HEADER]: 'zh', host: 'x.test' });
    const { prefetch, productsCall } = await runPrefetch();
    expect(productsCall).toContain('locale=zh');
    expect(prefetch?.locale).toBe('zh');
  });

  it('fetches exactly as before with no locale (echo null)', async () => {
    setRequestHeaders({ host: 'x.test' });
    const { prefetch, productsCall } = await runPrefetch();
    expect(productsCall).not.toContain('locale=');
    expect(prefetch?.locale).toBeNull();
  });
});

function product(id: string, title: string): Product {
  return { id, title, slug: id } as unknown as Product;
}

function render(children: ReactNode, locale?: string | null): string {
  return renderToStaticMarkup(
    <StorefrontProvider
      vendor={{ id: 'v1', slug: 'demo-store', name: 'Demo Store' } as never}
      config={{} as never}
      menus={[]}
      {...(locale !== undefined ? { locale } : {})}
    >
      {children}
    </StorefrontProvider>,
  );
}

function LocaleProbe(): JSX.Element {
  const locale = useStorefrontLocale();
  return <span data-locale={locale ?? 'none'} />;
}

describe('StorefrontProvider locale prop + useStorefrontLocale', () => {
  it('exposes the validated locale', () => {
    expect(render(<LocaleProbe />, 'zh-CN')).toContain('data-locale="zh-CN"');
  });

  it('is null without the prop (unchanged behaviour)', () => {
    expect(render(<LocaleProbe />)).toContain('data-locale="none"');
  });

  it('is null for an invalid prop (ignored, never an error)', () => {
    expect(render(<LocaleProbe />, 'not a locale!!')).toContain('data-locale="none"');
  });
});

const SEED_QUERY = normalizeShopQuery({ categorySlug: 'soups', keyword: 'egusi', sort: 'popular', page: 1, perPage: 24 });

function seedPrefetch(locale?: string | null): ShopPrefetch {
  const prefetch: ShopPrefetch = {
    query: SEED_QUERY,
    products: [product('p1', 'Egusi Soup')],
    pagination: { currentPage: 1, perPage: 24, hasMore: false },
  };
  if (locale !== undefined) prefetch.locale = locale;
  return prefetch;
}

function Grid(props: Parameters<typeof useShop>[0]): JSX.Element {
  const { products, isLoading } = useShop(props);
  return (
    <ul data-loading={String(isLoading)}>
      {products.map((p) => <li key={p.id}>{p.title}</li>)}
    </ul>
  );
}

function renderGrid(prefetch: ShopPrefetch | null, locale?: string | null): string {
  return render(
    <ShopPrefetchProvider value={prefetch}>
      <Grid categorySlug="soups" keyword="egusi" sort="popular" page={1} perPage={24} />
    </ShopPrefetchProvider>,
    locale,
  );
}

describe('useShop locale cache separation (seed match)', () => {
  it('seeds from a prefetch fetched in the same locale', () => {
    const html = renderGrid(seedPrefetch('zh'), 'zh');
    expect(html).toContain('data-loading="false"');
    expect(html).toContain('Egusi Soup');
  });

  it('ignores a prefetch fetched in another locale and refetches', () => {
    const html = renderGrid(seedPrefetch('zh'), null);
    expect(html).toContain('data-loading="true"');
    expect(html).not.toContain('Egusi Soup');
  });

  it('keeps the old no-locale behaviour: absent echo means primary', () => {
    const html = renderGrid(seedPrefetch(), null);
    expect(html).toContain('data-loading="false"');
    expect(html).toContain('Egusi Soup');
  });
});

describe('no-locale regression (byte-identical guarantee)', () => {
  it('server and client helpers pass input through untouched', () => {
    const query = { per_page: 24, page: 1 };
    expect(withLocaleQuery(query, null)).toBe(query);
    const tags = ['v:acme', 'v:acme:products'];
    expect(withLocaleTags(tags, null)).toBe(tags);
    expect(withLocalePath('/client/store/products', null)).toBe('/client/store/products');
    expect(parseLocaleCode(null)).toBeNull();
  });

  it('every hook still renders without a provider locale', () => {
    expect(renderGrid(seedPrefetch(), null)).toContain('data-loading="false"');
  });
});
