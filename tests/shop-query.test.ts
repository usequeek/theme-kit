import { describe, expect, it } from 'vitest';
import {
  SHOP_DEFAULT_PER_PAGE,
  normalizeShopQuery,
  parseShopResponse,
  parseShopSearchParams,
  sameShopQuery,
  shopRequestParams,
} from '../utils/shop-query';

/**
 * The server's /shop prefetch only saves the browser a fetch when both sides
 * build the same query — these are the rules both share.
 */
describe('shop query (shared by useShop and the server prefetch)', () => {
  it('applies the same defaults useShop always has', () => {
    expect(normalizeShopQuery()).toEqual({ categorySlug: null, keyword: null, sort: 'latest', page: 1, perPage: SHOP_DEFAULT_PER_PAGE });
    expect(SHOP_DEFAULT_PER_PAGE).toBe(24);
  });

  it('treats a blank or padded keyword like the request does', () => {
    expect(normalizeShopQuery({ keyword: '   ' }).keyword).toBeNull();
    expect(normalizeShopQuery({ keyword: '  rice ' }).keyword).toBe('rice');
    expect(sameShopQuery(normalizeShopQuery({ keyword: '' }), normalizeShopQuery({ keyword: null }))).toBe(true);
  });

  it('distinguishes every field that changes the page fetched', () => {
    const base = normalizeShopQuery({ categorySlug: 'soups', keyword: 'egusi', sort: 'popular', page: 2, perPage: 24 });
    for (const change of [{ categorySlug: 'rice' }, { keyword: 'okra' }, { sort: 'price_low' as const }, { page: 3 }, { perPage: 8 }]) {
      expect(sameShopQuery(base, normalizeShopQuery({ ...base, ...change }))).toBe(false);
    }
    expect(sameShopQuery(base, normalizeShopQuery({ ...base }))).toBe(true);
  });

  it('reads the /shop URL exactly as useShopParams always has', () => {
    const read = (qs: string) => parseShopSearchParams((key) => new URLSearchParams(qs).get(key));
    expect(read('')).toEqual({ categorySlug: null, keyword: '', sort: 'latest', page: 1 });
    expect(read('category=soups&q=egusi&sort=price_high&page=3')).toEqual({ categorySlug: 'soups', keyword: 'egusi', sort: 'price_high', page: 3 });
    expect(read('sort=cheapest&page=0').sort).toBe('latest');
    expect(read('page=abc').page).toBe(1);
    expect(read('page=2.7').page).toBe(2);
  });

  it('sends the params the storefront products endpoint expects', () => {
    expect(shopRequestParams(normalizeShopQuery())).toEqual({ per_page: 24, page: 1, sort: 'latest' });
    expect(shopRequestParams(normalizeShopQuery({ categorySlug: 'soups', keyword: ' egusi ', sort: 'popular', page: 2 })))
      .toEqual({ per_page: 24, page: 2, category_slug: 'soups', keyword: 'egusi', sort: 'popular' });
  });

  it('parses nested and flat pagination meta', () => {
    const query = normalizeShopQuery({ page: 2 });
    const nested = parseShopResponse({ data: [], meta: { pagination: { current_page: 2, last_page: 5, per_page: 24, total: 110, from: 25, to: 48, has_more: true } } } as never, query);
    expect(nested.pagination).toEqual({ currentPage: 2, lastPage: 5, perPage: 24, total: 110, from: 25, to: 48, hasMore: true });
    const flat = parseShopResponse({ data: [], meta: { current_page: 1, last_page: 1, total: 3 } } as never, normalizeShopQuery());
    expect(flat.pagination).toMatchObject({ currentPage: 1, lastPage: 1, total: 3, hasMore: false, perPage: 24 });
    expect(parseShopResponse({ data: [] } as never, query).pagination.currentPage).toBe(2);
  });
});
