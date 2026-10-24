import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  asMarketRefusal,
  isMarketPricedPath,
  marketCookieName,
  marketCookieWrite,
  normalizeStoreMarkets,
  parseMarketId,
  readMarketFromCookieString,
  withMarketPath,
  withMarketQuery,
} from '../utils/market';

/**
 * The market transport (markets.currency C8): a shopper's explicit choice is a
 * per-store cookie, the API takes `?market=<id>` on priced calls, and a store with
 * no choice stays byte-identical.
 */

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('parseMarketId', () => {
  it('accepts short positive digit strings and integers', () => {
    expect(parseMarketId('1000')).toBe(1000);
    expect(parseMarketId(7)).toBe(7);
  });

  it('refuses everything else', () => {
    for (const bad of ['', '0', '-1', '1.5', '1e3', ' 1', '12a', 'abc', '1'.repeat(19), null, undefined, [], {}, 1.5, Number.NaN]) {
      expect(parseMarketId(bad), JSON.stringify(bad)).toBeNull();
    }
  });
});

describe('the store cookie', () => {
  it('is named per store, with unsafe slug characters replaced', () => {
    expect(marketCookieName('acme')).toBe('queek_market_acme');
    expect(marketCookieName('a;b c')).toBe('queek_market_a_b_c');
  });

  it('reads the market of this store only', () => {
    const jar = 'a=1; queek_market_acme=1000; queek_market_other=2000';
    expect(readMarketFromCookieString(jar, 'acme')).toBe(1000);
    expect(readMarketFromCookieString(jar, 'other')).toBe(2000);
    expect(readMarketFromCookieString(jar, 'third')).toBeNull();
    expect(readMarketFromCookieString('queek_market_acme=abc', 'acme')).toBeNull();
    expect(readMarketFromCookieString(null, 'acme')).toBeNull();
  });

  it('writes a year-long Lax cookie, and clears it with Max-Age=0', () => {
    expect(marketCookieWrite('acme', 1000)).toBe('queek_market_acme=1000; Path=/; Max-Age=31536000; SameSite=Lax');
    expect(marketCookieWrite('acme', null)).toBe('queek_market_acme=; Path=/; Max-Age=0; SameSite=Lax');
  });
});

describe('withMarketQuery / withMarketPath', () => {
  it('adds market=<id>', () => {
    expect(withMarketQuery({ page: 2 }, 1000)).toEqual({ page: 2, market: '1000' });
    expect(withMarketQuery(undefined, 1000)).toEqual({ market: '1000' });
    expect(withMarketPath('/client/store/cart', 1000)).toBe('/client/store/cart?market=1000');
    expect(withMarketPath('/client/store/products?page=2', 1000)).toBe('/client/store/products?page=2&market=1000');
    expect(withMarketPath('/p?x=1#top', 1000)).toBe('/p?x=1&market=1000#top');
  });

  it('is byte-identical with no market (same reference, same string)', () => {
    const query = { page: 2 };
    expect(withMarketQuery(query, null)).toBe(query);
    expect(withMarketQuery(undefined, undefined)).toBeUndefined();
    expect(withMarketPath('/client/store/cart', null)).toBe('/client/store/cart');
  });

  it('never doubles an existing market param', () => {
    expect(withMarketPath('/products?market=3', 1000)).toBe('/products?market=3');
  });
});

describe('isMarketPricedPath', () => {
  it('is true for every priced store call', () => {
    for (const path of [
      '/products', '/products/oak-chair', '/products/oak-chair/related', '/collections/summer/products', '/collections',
      '/categories/x/products', '/promotions/1/products', '/search/autocomplete', '/shipping-zones', '/fulfillment/quote',
      '/shipping/couriers', '/checkout/fees', '/payment-methods?delivery_mode=pickup', '/cart', '/cart/items/9', '/order/checkout',
      '/wishlist-items', '/client/store/cart?x=1', '/api/v1/client/store/products?page=2',
    ]) {
      expect(isMarketPricedPath(path), path).toBe(true);
    }
  });

  it('is false for content and store-level reads', () => {
    for (const path of ['/info', '/config', '/bootstrap', '/pages/about', '/pages/cart', '/posts', '/locales', '/markets', '/menus', '/theme', '/reviews', '/follow',
      '/products/oak-chair/reviews', '/products/oak-chair/questions', '/orders/5', '/orders/5/pay', '/orders']) {
      expect(isMarketPricedPath(path), path).toBe(false);
    }
  });
});

describe('normalizeStoreMarkets', () => {
  it('keeps well-formed rows and drops the rest', () => {
    expect(
      normalizeStoreMarkets([
        { id: 1000, name: 'Ghana', countries: ['GH'], currency: 'ghs' },
        { id: 'x', name: 'Bad id', currency: 'GHS' },
        { id: 1001, name: '', currency: 'GHS' },
        { id: 1002, name: 'Bad currency', currency: 'GH' },
        null,
      ]),
    ).toEqual([{ id: 1000, name: 'Ghana', countries: ['GH'], currency: 'GHS' }]);
    expect(normalizeStoreMarkets(undefined)).toEqual([]);
    expect(normalizeStoreMarkets({})).toEqual([]);
  });
});

describe('asMarketRefusal', () => {
  const pin = 'eyJpdiI6IjEifQ==';

  it('reads a 409 market_rate_changed with its fresh market block and quote', () => {
    const refusal = asMarketRefusal({
      status: 409,
      code: 'market_rate_changed',
      message: 'The exchange rate for GHS prices has changed.',
      details: { market: { id: 1000, name: 'Ghana', currency: 'GHS', pin }, quote: { currency: 'GHS', total_price: '12.50' } },
    });

    expect(refusal).toEqual({
      code: 'market_rate_changed',
      status: 409,
      message: 'The exchange rate for GHS prices has changed.',
      market: { id: 1000, name: 'Ghana', currency: 'GHS', pin },
      quote: { currency: 'GHS', total_price: '12.50' },
    });
  });

  it('reads a 409 market_unavailable (no market, no quote)', () => {
    const refusal = asMarketRefusal({ status: 409, code: 'market_unavailable', message: 'gone', details: { market: null, quote: null, currency: 'NGN' } });
    expect(refusal?.code).toBe('market_unavailable');
    expect(refusal?.market).toBeNull();
    expect(refusal?.quote).toBeNull();
  });

  it('reads the 422 refusals', () => {
    for (const code of ['market_payment_unavailable', 'market_price_unusable', 'market_method_unavailable', 'market_delivery_unavailable', 'market_cart_required', 'market_rate_expired', 'market_total_unusable']) {
      expect(asMarketRefusal({ status: 422, code, message: 'm', details: null })?.code, code).toBe(code);
    }
  });

  it('ignores every other failure', () => {
    expect(asMarketRefusal(new Error('boom'))).toBeNull();
    expect(asMarketRefusal({ status: 422, code: 'variant_invalid', message: 'm' })).toBeNull();
    expect(asMarketRefusal(null)).toBeNull();
    expect(asMarketRefusal({ code: 'market_rate_changed' })).toBeNull();
  });

  it('drops a market block that is malformed instead of trusting it', () => {
    const refusal = asMarketRefusal({ status: 409, code: 'market_rate_changed', message: 'm', details: { market: { id: 'x', pin: 5 } } });
    expect(refusal?.market).toBeNull();
  });
});
