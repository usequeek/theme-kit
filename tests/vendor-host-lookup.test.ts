import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  lookupStoreByHost,
  resolveCustomDomainVendorSlugRemote,
  resolveVendorHost,
  resolveVendorSlug,
  type HostLookup,
} from '../utils/vendor-host';

const KEYS = ['STOREFRONT_DOMAIN', 'STOREFRONT_LEGACY_DOMAINS', 'QUEEK_API_URL', 'NEXT_PUBLIC_QUEEK_API_URL', 'CUSTOM_DOMAIN_VENDOR_MAP'] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
  process.env.QUEEK_API_URL = 'https://api.example.test/api/v1';
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  for (const key of KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function stubFetch(impl: () => Promise<Response> | Response) {
  const fetchMock = vi.fn(async (_url: unknown, _init?: unknown) => impl());
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('lookupStoreByHost: the three answers', () => {
  it('200 with a slug is a store', async () => {
    const fetchMock = stubFetch(() => json({ status: 'success', data: { slug: 'acme' } }));

    expect(await lookupStoreByHost('shop.acme.com')).toEqual({ kind: 'store', slug: 'acme' });
    expect(String(fetchMock.mock.calls[0][0])).toBe('https://api.example.test/api/v1/client/resolve-by-host?host=shop.acme.com');
  });

  it('200 with slug: null is DEFINITELY not a store', async () => {
    stubFetch(() => json({ status: 'success', data: { slug: null } }));

    expect(await lookupStoreByHost('webmail.queek.app')).toEqual({ kind: 'not-store' });
  });

  it('404 is DEFINITELY not a store', async () => {
    stubFetch(() => json({ message: 'Not found' }, 404));

    expect(await lookupStoreByHost('owncloud.queek.app')).toEqual({ kind: 'not-store' });
  });

  it.each([429, 500, 502, 503, 504, 401, 403, 400])('status %i is unknown, never not-store', async (status) => {
    stubFetch(() => json({ message: 'nope' }, status));

    expect(await lookupStoreByHost('shop.acme.com')).toEqual({ kind: 'unknown' });
  });

  it('a network error is unknown', async () => {
    stubFetch(() => {
      throw new TypeError('fetch failed');
    });

    expect(await lookupStoreByHost('shop.acme.com')).toEqual({ kind: 'unknown' });
  });

  it('a timeout (aborted fetch) is unknown', async () => {
    stubFetch(() => {
      throw new DOMException('The operation was aborted', 'AbortError');
    });

    expect(await lookupStoreByHost('shop.acme.com')).toEqual({ kind: 'unknown' });
  });

  it.each([
    ['an HTML 200 from something in front of the API', () => new Response('<html>captive</html>', { status: 200 })],
    ['200 JSON without the slug field', () => json({ status: 'success', data: {} })],
    ['200 JSON without data', () => json({ status: 'success' })],
    ['200 JSON null', () => json(null)],
    ['200 with a non-string slug', () => json({ data: { slug: 12 } })],
    ['200 with an empty-string slug', () => json({ data: { slug: '' } })],
  ])('%s is unknown, never a 404', async (_label, respond) => {
    stubFetch(respond);

    expect(await lookupStoreByHost('shop.acme.com')).toEqual({ kind: 'unknown' });
  });

  it('is unknown, with no request, when there is no host or no API URL', async () => {
    const fetchMock = stubFetch(() => json({ data: { slug: 'acme' } }));

    expect(await lookupStoreByHost('')).toEqual({ kind: 'unknown' });
    delete process.env.QUEEK_API_URL;
    expect(await lookupStoreByHost('shop.acme.com')).toEqual({ kind: 'unknown' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('existing exports keep their behaviour', () => {
  it('resolveCustomDomainVendorSlugRemote: slug for a store, null for not-store AND for unknown', async () => {
    stubFetch(() => json({ data: { slug: 'acme' } }));
    expect(await resolveCustomDomainVendorSlugRemote('shop.acme.com')).toBe('acme');

    stubFetch(() => json({ data: { slug: null } }));
    expect(await resolveCustomDomainVendorSlugRemote('shop.acme.com')).toBeNull();

    stubFetch(() => json({}, 429));
    expect(await resolveCustomDomainVendorSlugRemote('shop.acme.com')).toBeNull();
  });

  it('resolveVendorSlug still trusts a subdomain without any request (other callers are unchanged)', async () => {
    const fetchMock = stubFetch(() => json({ data: { slug: null } }));

    expect(await resolveVendorSlug({ host: 'acme.queek.com.ng', searchVendor: null })).toBe('acme');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('resolveVendorHost', () => {
  const never = vi.fn<(hostname: string) => Promise<HostLookup>>();
  beforeEach(() => {
    never.mockReset();
    process.env.STOREFRONT_DOMAIN = 'queek.app';
    process.env.STOREFRONT_LEGACY_DOMAINS = 'queek.com.ng';
  });
  const answering = (answer: HostLookup) => vi.fn(async (_hostname: string): Promise<HostLookup> => answer);

  it('checks a subdomain exists through the host lookup (the whole hostname is asked)', async () => {
    const lookup = answering({ kind: 'store', slug: 'acme' });

    expect(await resolveVendorHost({ host: 'acme.queek.com.ng:3001', searchVendor: null, lookup })).toEqual({ slug: 'acme', outcome: 'store' });
    expect(lookup).toHaveBeenCalledExactlyOnceWith('acme.queek.com.ng');
  });

  it('uses the slug the API returns, not the label (a tag resolves to its store)', async () => {
    const lookup = answering({ kind: 'store', slug: 'acme-stores' });

    expect(await resolveVendorHost({ host: 'acme.queek.app', searchVendor: null, lookup })).toEqual({ slug: 'acme-stores', outcome: 'store' });
  });

  it('a subdomain on the primary AND on a legacy domain is checked the same way', async () => {
    const lookup = answering({ kind: 'not-store' });

    expect(await resolveVendorHost({ host: 'ghost.queek.app', searchVendor: null, lookup })).toEqual({ slug: null, outcome: 'not-store' });
    expect(await resolveVendorHost({ host: 'ghost.queek.com.ng', searchVendor: null, lookup })).toEqual({ slug: null, outcome: 'not-store' });
    expect(lookup.mock.calls.map(([host]) => host)).toEqual(['ghost.queek.app', 'ghost.queek.com.ng']);
  });

  it('an unknown subdomain (outage) keeps the label: fail open, as before the check', async () => {
    const lookup = answering({ kind: 'unknown' });

    expect(await resolveVendorHost({ host: 'acme.queek.app', searchVendor: null, lookup })).toEqual({ slug: 'acme', outcome: 'unknown' });
  });

  it('a reserved or dotted subdomain is looked up as a whole host and reports what the API says', async () => {
    const lookup = answering({ kind: 'not-store' });

    expect(await resolveVendorHost({ host: 'webmail.queek.app', searchVendor: null, lookup })).toEqual({ slug: null, outcome: 'not-store' });
    expect(await resolveVendorHost({ host: 'a.b.queek.app', searchVendor: null, lookup })).toEqual({ slug: null, outcome: 'not-store' });
    expect(lookup.mock.calls.map(([host]) => host)).toEqual(['webmail.queek.app', 'a.b.queek.app']);
  });

  it('a custom domain resolves through the lookup', async () => {
    const lookup = answering({ kind: 'store', slug: 'acme' });

    expect(await resolveVendorHost({ host: 'shop.acme.com', searchVendor: null, lookup })).toEqual({ slug: 'acme', outcome: 'store' });
  });

  it('the static custom-domain map needs no lookup', async () => {
    process.env.CUSTOM_DOMAIN_VENDOR_MAP = JSON.stringify({ 'shop.acme.com': 'acme' });

    expect(await resolveVendorHost({ host: 'shop.acme.com', searchVendor: null, lookup: never })).toEqual({ slug: 'acme', outcome: 'store' });
    expect(never).not.toHaveBeenCalled();
  });

  it('a host the API does not know is not-store; an outage is unknown', async () => {
    expect(await resolveVendorHost({ host: 'airflow.example.org', searchVendor: null, lookup: answering({ kind: 'not-store' }) })).toEqual({ slug: null, outcome: 'not-store' });
    expect(await resolveVendorHost({ host: 'airflow.example.org', searchVendor: null, lookup: answering({ kind: 'unknown' }) })).toEqual({ slug: null, outcome: 'unknown' });
  });

  it('?vendor= still supplies the slug when the host gives none, and the outcome is still reported', async () => {
    expect(await resolveVendorHost({ host: 'localhost:3000', searchVendor: 'fresh-store', lookup: answering({ kind: 'not-store' }) })).toEqual({ slug: 'fresh-store', outcome: 'not-store' });
  });

  it('no host: unknown, no lookup', async () => {
    expect(await resolveVendorHost({ host: null, searchVendor: null, lookup: never })).toEqual({ slug: null, outcome: 'unknown' });
    expect(never).not.toHaveBeenCalled();
  });

  it('keeps a bracketed IPv6 host whole when stripping the port', async () => {
    const lookup = answering({ kind: 'unknown' });
    await resolveVendorHost({ host: '[::1]:3001', searchVendor: null, lookup });

    expect(lookup).toHaveBeenCalledWith('[::1]');
  });

  it('defaults to the real API lookup: 429 on a subdomain host fails open with the label', async () => {
    const fetchMock = stubFetch(() => json({}, 429));

    expect(await resolveVendorHost({ host: 'acme.queek.com.ng', searchVendor: null })).toEqual({ slug: 'acme', outcome: 'unknown' });
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
