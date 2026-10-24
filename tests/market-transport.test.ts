// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBrowserClient } from '../sdk/client';
import { setActivePlatform } from '../sdk/platform';
import { setBrowserMarketId } from '../utils/market';

/**
 * The browser client puts `?market=<id>` on priced store calls only, and never
 * on the in-store QR channel; with no market nothing changes.
 */

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(async () => new Response(JSON.stringify({ data: [] }), { status: 200, headers: { 'content-type': 'application/json' } }));
  vi.stubGlobal('fetch', fetchMock);
  setActivePlatform('storefront');
  setBrowserMarketId(null);
});

afterEach(() => {
  vi.unstubAllGlobals();
  setBrowserMarketId(null);
});

const urlOf = (call: number): string => String(fetchMock.mock.calls[call]?.[0]);

describe('createBrowserClient with a market', () => {
  it('adds market to priced reads', async () => {
    setBrowserMarketId(1000);
    await createBrowserClient('acme').get('/products', { page: 2 });
    expect(urlOf(0)).toBe('/api/v1/client/store/products?page=2&market=1000');
  });

  it('adds market to a POST on a priced path (the order and the quote need it on the URL)', async () => {
    setBrowserMarketId(1000);
    await createBrowserClient('acme').post('/checkout/fees', { total_value: 10 });
    expect(urlOf(0)).toBe('/api/v1/client/store/checkout/fees?market=1000');
  });

  it('leaves content and store-level reads alone', async () => {
    setBrowserMarketId(1000);
    await createBrowserClient('acme').get('/pages/about');
    await createBrowserClient('acme').get('/info');
    expect(urlOf(0)).toBe('/api/v1/client/store/pages/about');
    expect(urlOf(1)).toBe('/api/v1/client/store/info');
  });

  it('sends no market on the in-store QR channel', async () => {
    setBrowserMarketId(1000);
    setActivePlatform('instore_qr');
    await createBrowserClient('acme').get('/products');
    expect(urlOf(0)).toBe('/api/v1/client/store/products');
  });

  it('is byte-identical with no market', async () => {
    await createBrowserClient('acme').get('/products', { page: 2 });
    await createBrowserClient('acme').post('/checkout/fees', { total_value: 10 });
    expect(urlOf(0)).toBe('/api/v1/client/store/products?page=2');
    expect(urlOf(1)).toBe('/api/v1/client/store/checkout/fees');
  });
});
