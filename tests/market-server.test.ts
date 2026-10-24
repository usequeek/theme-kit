import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * The server read path: a shopper's market cookie puts `?market=<id>` on priced
 * reads and takes those reads OUT of the shared data cache (its key is the URL,
 * a rate moves without a revalidation tag). No cookie: today's request, byte for
 * byte, cache policy included.
 */

const request = vi.hoisted(() => ({ headers: new Headers(), cookie: '', throwOutsideScope: false }));

vi.mock('next/headers', () => ({
  headers: async () => {
    if (request.throwOutsideScope) throw new Error('headers() outside request scope');
    return request.headers;
  },
  cookies: async () => {
    if (request.throwOutsideScope) throw new Error('cookies() outside request scope');
    return { toString: () => request.cookie };
  },
}));

afterEach(() => {
  vi.unstubAllGlobals();
  request.headers = new Headers();
  request.cookie = '';
  request.throwOutsideScope = false;
});

type Captured = { next?: { revalidate: number; tags: string[] }; cache?: string };

async function capturedGet(path: string, options?: { verifyMarket?: (id: number) => Promise<boolean> }): Promise<{ url: string; init: Captured }> {
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({ ok: true, json: async () => ({ data: {} }) }));
  vi.stubGlobal('fetch', fetchMock);
  const { createServerStoreClient } = await import('../sdk/server-store-client');
  await createServerStoreClient('acme', 'http://origin.test', options).get(path);
  const [[url, init]] = fetchMock.mock.calls as unknown as Array<[string, Captured]>;
  return { url, init };
}

describe('server store reads with a market cookie', () => {
  it('prices a product read in the market and bypasses the shared cache', async () => {
    request.cookie = 'other=1; queek_market_acme=1000';
    const { url, init } = await capturedGet('/products');
    expect(url).toBe('http://127.0.0.1:8000/api/v1/client/store/products?market=1000');
    expect(init.next).toBeUndefined();
    expect(init.cache).toBe('no-store');
  });

  it('does the same for a product detail and a collection listing', async () => {
    request.cookie = 'queek_market_acme=1000';
    for (const path of ['/products/oak-chair', '/collections/summer/products']) {
      const { url, init } = await capturedGet(path);
      expect(url, path).toContain('market=1000');
      expect(init.cache, path).toBe('no-store');
    }
  });

  it('leaves content reads in the cache with no market param', async () => {
    request.cookie = 'queek_market_acme=1000';
    const { url, init } = await capturedGet('/pages/about');
    expect(url).toBe('http://127.0.0.1:8000/api/v1/client/store/pages/about');
    expect(init.next).toEqual({ revalidate: 300, tags: ['v:acme', 'v:acme:pages'] });
  });

  it('ignores another store\'s cookie and a malformed value', async () => {
    for (const cookie of ['queek_market_other=1000', 'queek_market_acme=abc', 'queek_market_acme=']) {
      request.cookie = cookie;
      const { url, init } = await capturedGet('/products');
      expect(url, cookie).toBe('http://127.0.0.1:8000/api/v1/client/store/products');
      expect(init.next, cookie).toEqual({ revalidate: 60, tags: ['v:acme', 'v:acme:products'] });
    }
  });

  it('is byte-identical with no cookie', async () => {
    const { url, init } = await capturedGet('/products');
    expect(url).toBe('http://127.0.0.1:8000/api/v1/client/store/products');
    expect(init.next).toEqual({ revalidate: 60, tags: ['v:acme', 'v:acme:products'] });
  });

  it('prices in the market only when the host confirms the cookie names a market the store offers', async () => {
    request.cookie = 'queek_market_acme=1000';
    const confirmed = await capturedGet('/products', { verifyMarket: async (id) => id === 1000 });
    expect(confirmed.url).toContain('market=1000');
    expect(confirmed.init.cache).toBe('no-store');

    // Unconfirmed (unpublished, or the host could not read the list): the store currency, today's cached request.
    for (const verifyMarket of [async () => false, async () => { throw new Error('list read failed'); }]) {
      const refused = await capturedGet('/products', { verifyMarket });
      expect(refused.url).toBe('http://127.0.0.1:8000/api/v1/client/store/products');
      expect(refused.init.next).toEqual({ revalidate: 60, tags: ['v:acme', 'v:acme:products'] });
    }
  });

  it('asks the host nothing when there is no cookie', async () => {
    const verifyMarket = vi.fn(async () => true);
    const { url } = await capturedGet('/products', { verifyMarket });
    expect(url).toBe('http://127.0.0.1:8000/api/v1/client/store/products');
    expect(verifyMarket).not.toHaveBeenCalled();
  });

  it('never throws outside a request scope', async () => {
    request.throwOutsideScope = true;
    const { readRequestMarket } = await import('../sdk/server-store-client');
    await expect(readRequestMarket('acme')).resolves.toBeNull();
  });
});
