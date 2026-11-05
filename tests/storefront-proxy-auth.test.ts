import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { lookupStoreByHost } from '../utils/vendor-host';
import { PROXY_SECRET_HEADER, SHOPPER_IP_HEADER, storefrontProxyHeaders, usableShopperIp } from '../sdk/storefront-proxy-auth';

/**
 * S8-B: the storefront SERVER names itself (secret) and, on uncached calls, the shopper (`cf-connecting-ip`) to the
 * API. Cached reads carry the secret only: Next's data-cache key includes request headers.
 */

const request = vi.hoisted(() => ({ headers: new Headers(), cookie: '', throwOutsideScope: false }));

vi.mock('next/headers', () => ({
  headers: async () => {
    if (request.throwOutsideScope) throw new Error('headers() outside request scope');
    return request.headers;
  },
  cookies: async () => ({ toString: () => request.cookie }),
}));

const SECRET = 'proxy-secret-value';
let saved: string | undefined;

beforeEach(() => {
  saved = process.env.STOREFRONT_PROXY_SECRET;
  process.env.STOREFRONT_PROXY_SECRET = SECRET;
  process.env.QUEEK_API_URL = 'https://api.example.test/api/v1';
});

afterEach(() => {
  if (saved === undefined) delete process.env.STOREFRONT_PROXY_SECRET;
  else process.env.STOREFRONT_PROXY_SECRET = saved;
  request.headers = new Headers();
  request.throwOutsideScope = false;
  vi.unstubAllGlobals();
});

describe('storefrontProxyHeaders', () => {
  it.each([undefined, '', '   '])('secret %j: sends nothing, shopper or not', (value) => {
    if (value === undefined) delete process.env.STOREFRONT_PROXY_SECRET;
    else process.env.STOREFRONT_PROXY_SECRET = value;

    expect(storefrontProxyHeaders()).toEqual({});
    expect(storefrontProxyHeaders({ shopperIp: '203.0.113.9' })).toEqual({});
  });

  it('secret alone, or secret + shopper', () => {
    expect(storefrontProxyHeaders()).toEqual({ [PROXY_SECRET_HEADER]: SECRET });
    expect(storefrontProxyHeaders({ shopperIp: ' 203.0.113.9 ' })).toEqual({ [PROXY_SECRET_HEADER]: SECRET, [SHOPPER_IP_HEADER]: '203.0.113.9' });
    expect(storefrontProxyHeaders({ shopperIp: '2001:db8::7' })[SHOPPER_IP_HEADER]).toBe('2001:db8::7');
  });

  it.each([null, undefined, '', '  ', 'unknown', 'not an ip', '203.0.113.9, 10.0.0.1', '1'.repeat(46), '12345', '<script>'])(
    'a missing or malformed shopper (%j) is never sent',
    (shopperIp) => {
      expect(storefrontProxyHeaders({ shopperIp })).toEqual({ [PROXY_SECRET_HEADER]: SECRET });
    },
  );

  it('usableShopperIp accepts IPv4 and IPv6 shapes only', () => {
    expect(usableShopperIp('198.51.100.4')).toBe('198.51.100.4');
    expect(usableShopperIp('::1')).toBe('::1');
    expect(usableShopperIp('abc')).toBeNull();
  });
});

describe('getStorefrontApiHeaders', () => {
  it('cached: the secret only, even when the request has cf-connecting-ip', async () => {
    request.headers = new Headers({ 'cf-connecting-ip': '203.0.113.9' });
    const { getStorefrontApiHeaders } = await import('../sdk/server-store-client');

    expect(await getStorefrontApiHeaders({ cached: true })).toEqual({ [PROXY_SECRET_HEADER]: SECRET });
  });

  it('uncached: the secret plus cf-connecting-ip', async () => {
    request.headers = new Headers({ 'cf-connecting-ip': '203.0.113.9' });
    const { getStorefrontApiHeaders } = await import('../sdk/server-store-client');

    expect(await getStorefrontApiHeaders({ cached: false })).toEqual({ [PROXY_SECRET_HEADER]: SECRET, [SHOPPER_IP_HEADER]: '203.0.113.9' });
  });

  it('uncached without cf-connecting-ip: no shopper, and NO fallback to x-forwarded-for or x-real-ip', async () => {
    request.headers = new Headers({ 'x-forwarded-for': '198.51.100.1', 'x-real-ip': '198.51.100.2' });
    const { getStorefrontApiHeaders } = await import('../sdk/server-store-client');

    expect(await getStorefrontApiHeaders({ cached: false })).toEqual({ [PROXY_SECRET_HEADER]: SECRET });
  });

  it('uncached outside a request scope: the secret alone', async () => {
    request.throwOutsideScope = true;
    const { getStorefrontApiHeaders } = await import('../sdk/server-store-client');

    expect(await getStorefrontApiHeaders({ cached: false })).toEqual({ [PROXY_SECRET_HEADER]: SECRET });
  });

  it('secret unset: nothing, on both paths', async () => {
    delete process.env.STOREFRONT_PROXY_SECRET;
    request.headers = new Headers({ 'cf-connecting-ip': '203.0.113.9' });
    const { getStorefrontApiHeaders } = await import('../sdk/server-store-client');

    expect(await getStorefrontApiHeaders({ cached: true })).toEqual({});
    expect(await getStorefrontApiHeaders({ cached: false })).toEqual({});
  });
});

describe('createServerStoreClient', () => {
  type Captured = { headers: Record<string, string>; next?: unknown; cache?: string; method?: string };

  async function capture(call: (client: ReturnType<typeof import('../sdk/server-store-client').createServerStoreClient>) => Promise<unknown>): Promise<Captured> {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({ ok: true, json: async () => ({ data: {} }) }));
    vi.stubGlobal('fetch', fetchMock);
    const { createServerStoreClient } = await import('../sdk/server-store-client');
    await call(createServerStoreClient('acme', 'http://origin.test'));
    return fetchMock.mock.calls[0][1] as unknown as Captured;
  }

  beforeEach(() => {
    request.headers = new Headers({ 'cf-connecting-ip': '203.0.113.9' });
  });

  it('a cached GET carries the secret and NO shopper', async () => {
    const init = await capture((client) => client.get('/info'));

    expect(init.next).toBeDefined();
    expect(init.headers[PROXY_SECRET_HEADER]).toBe(SECRET);
    expect(init.headers[SHOPPER_IP_HEADER]).toBeUndefined();
  });

  it('a no-store GET (market-priced, editor preview) carries both', async () => {
    request.cookie = 'queek_market_acme=1000';
    const priced = await capture((client) => client.get('/products'));
    expect(priced.cache).toBe('no-store');
    expect(priced.headers[PROXY_SECRET_HEADER]).toBe(SECRET);
    expect(priced.headers[SHOPPER_IP_HEADER]).toBe('203.0.113.9');

    request.cookie = '';
    request.headers = new Headers({ 'cf-connecting-ip': '203.0.113.9', 'x-queek-preview': '1' });
    const preview = await capture((client) => client.get('/info'));
    expect(preview.cache).toBe('no-store');
    expect(preview.headers[SHOPPER_IP_HEADER]).toBe('203.0.113.9');
  });

  it('a POST carries both', async () => {
    const init = await capture((client) => client.post('/cart', { a: 1 }));

    expect(init.method).toBe('POST');
    expect(init.headers[PROXY_SECRET_HEADER]).toBe(SECRET);
    expect(init.headers[SHOPPER_IP_HEADER]).toBe('203.0.113.9');
  });

  it('no cf-connecting-ip: the secret without a shopper (the server limit, not a guessed address)', async () => {
    request.headers = new Headers({ 'x-forwarded-for': '198.51.100.1' });
    const init = await capture((client) => client.post('/cart', {}));

    expect(init.headers[PROXY_SECRET_HEADER]).toBe(SECRET);
    expect(init.headers[SHOPPER_IP_HEADER]).toBeUndefined();
  });

  it('secret unset: the request is exactly as before (no new headers)', async () => {
    delete process.env.STOREFRONT_PROXY_SECRET;
    const init = await capture((client) => client.post('/cart', {}));

    expect(Object.keys(init.headers).filter((name) => /proxy-secret|shopper/i.test(name))).toEqual([]);
  });
});

describe('resolve-by-host lookup', () => {
  async function lookupHeaders(options?: Parameters<typeof lookupStoreByHost>[1]): Promise<Record<string, string>> {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify({ status: 'success', data: { slug: null } }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await lookupStoreByHost('shop.acme.com', options);
    return (fetchMock.mock.calls[0][1] as { headers: Record<string, string> }).headers;
  }

  it('the proxy form (no-store + shopperIp) carries both', async () => {
    const headers = await lookupHeaders({ cache: 'no-store', shopperIp: '203.0.113.9' });

    expect(headers[PROXY_SECRET_HEADER]).toBe(SECRET);
    expect(headers[SHOPPER_IP_HEADER]).toBe('203.0.113.9');
  });

  it('no-store without a shopper: the secret alone', async () => {
    const headers = await lookupHeaders({ cache: 'no-store' });

    expect(headers[PROXY_SECRET_HEADER]).toBe(SECRET);
    expect(headers[SHOPPER_IP_HEADER]).toBeUndefined();
  });

  it('the cached form carries the secret and never a shopper, even if one is passed', async () => {
    const headers = await lookupHeaders({ shopperIp: '203.0.113.9' });

    expect(headers[PROXY_SECRET_HEADER]).toBe(SECRET);
    expect(headers[SHOPPER_IP_HEADER]).toBeUndefined();
  });

  it('secret unset: just Accept, as before', async () => {
    delete process.env.STOREFRONT_PROXY_SECRET;

    expect(await lookupHeaders({ cache: 'no-store', shopperIp: '203.0.113.9' })).toEqual({ Accept: 'application/json' });
  });
});
