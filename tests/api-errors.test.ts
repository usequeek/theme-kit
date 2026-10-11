import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ApiRequestError,
  ApiTimeoutError,
  createBrowserClient,
  request,
  swallowNotFound,
} from '../sdk/client';

function stubFetch(response: Partial<Response> & { headers?: Headers; json?: () => Promise<unknown> }) {
  const fetchMock = vi.fn(async () => ({
    ok: false,
    status: 500,
    headers: new Headers(),
    json: async () => ({}),
    ...response,
  }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('request failures', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('throws ApiRequestError with a stable code, the status and the request id', async () => {
    stubFetch({
      status: 503,
      headers: new Headers({ 'x-request-id': 'req_123', 'retry-after': '7' }),
      json: async () => ({ message: 'Down for maintenance' }),
    });

    const error = await request('/api/v1', '/client/store/info').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiRequestError);
    const failure = error as ApiRequestError;
    expect(failure.status).toBe(503);
    expect(failure.code).toBe('server_error');
    expect(failure.retryable).toBe(true);
    expect(failure.requestId).toBe('req_123');
    expect(failure.retryAfterSeconds).toBe(7);
    expect(failure.detail).toBe('Down for maintenance');
    expect(failure.message).toContain('/api/v1/client/store/info');
    expect(failure.message).toContain('req_123');
  });

  it.each([
    [401, 'unauthenticated', false],
    [403, 'forbidden', false],
    [404, 'not_found', false],
    [422, 'client_error', false],
    [429, 'rate_limited', true],
    [500, 'server_error', true],
  ])('maps HTTP %i to code %s (retryable: %s)', async (status, code, retryable) => {
    stubFetch({ status });

    const failure = (await request('/api/v1', '/client/store/info').catch((e: unknown) => e)) as ApiRequestError;

    expect(failure.code).toBe(code);
    expect(failure.retryable).toBe(retryable);
  });

  it('keeps the query string (search terms) out of the message', async () => {
    stubFetch({ status: 500 });

    const failure = (await request('/api/v1', '/client/store/products', { query: { keyword: 'secret-term' } }).catch(
      (e: unknown) => e,
    )) as ApiRequestError;

    expect(failure.message).not.toContain('secret-term');
    expect(failure.url).toContain('secret-term');
  });

  it('survives an error body that is not JSON', async () => {
    stubFetch({
      status: 502,
      json: async () => {
        throw new SyntaxError('Unexpected token <');
      },
    });

    const failure = (await request('/api/v1', '/client/store/info').catch((e: unknown) => e)) as ApiRequestError;

    expect(failure.detail).toBeNull();
    expect(failure.status).toBe(502);
  });

  it('wraps a timeout in ApiTimeoutError and keeps the original as cause', async () => {
    const abort = new DOMException('The operation timed out.', 'TimeoutError');
    vi.stubGlobal('fetch', vi.fn(async () => { throw abort; }));

    const failure = (await request('/api/v1', '/client/store/info', { timeoutMs: 50 }).catch((e: unknown) => e)) as ApiTimeoutError;

    expect(failure).toBeInstanceOf(ApiTimeoutError);
    expect(failure.code).toBe('timeout');
    expect(failure.timeoutMs).toBe(50);
    expect(failure.cause).toBe(abort);
    expect(() => { failure.message = 'settable'; }).not.toThrow();
  });

  it('refuses a path outside /client/ and says what to use instead', async () => {
    const fetchMock = stubFetch({ ok: true });

    await expect(request('/api/v1', '/products')).rejects.toThrow(/only call \/client\/\* routes[\s\S]*createBrowserClient/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('swallowNotFound', () => {
  it('turns a 404 into null and rethrows everything else', () => {
    expect(swallowNotFound(new ApiRequestError(404, '/api/v1/client/store/products/x'))).toBeNull();
    const blip = new ApiRequestError(503, '/api/v1/client/store/products/x');
    expect(() => swallowNotFound(blip)).toThrow(blip);
  });
});

describe('createBrowserClient', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sends the vendor slug and the store-scoped path', async () => {
    const fetchMock = stubFetch({ ok: true, status: 200, json: async () => ({ data: [] }) });

    await createBrowserClient('demo-store').get('/products', { per_page: 2 });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/v1/client/store/products?per_page=2');
    expect((init.headers as Record<string, string>)['X-Vendor-Slug']).toBe('demo-store');
  });
});
