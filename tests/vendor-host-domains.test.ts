import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getLegacyStorefrontDomains,
  getStoreDomains,
  getStorefrontDomain,
  isPreviewSubdomain,
  legacyHostRedirectTarget,
  resolveSubdomainVendorSlug,
  toPrimaryStoreHost,
} from '../utils/vendor-host';

const KEYS = ['STOREFRONT_DOMAIN', 'STOREFRONT_LEGACY_DOMAINS'] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

function moved(): void {
  process.env.STOREFRONT_DOMAIN = 'queek.app';
  process.env.STOREFRONT_LEGACY_DOMAINS = 'queek.com.ng';
}

describe('store domains: nothing set is today', () => {
  it('uses queek.com.ng and has no legacy domain', () => {
    expect(getStorefrontDomain()).toBe('queek.com.ng');
    expect(getLegacyStorefrontDomains()).toEqual([]);
    expect(getStoreDomains()).toEqual(['queek.com.ng']);
  });

  it('resolves stores on queek.com.ng and .localhost, exactly as before', () => {
    expect(resolveSubdomainVendorSlug('acme.queek.com.ng')).toBe('acme');
    expect(resolveSubdomainVendorSlug('acme.localhost')).toBe('acme');
    expect(resolveSubdomainVendorSlug('acme.queek.app')).toBeNull();
    expect(resolveSubdomainVendorSlug('queek.com.ng')).toBeNull();
    expect(resolveSubdomainVendorSlug('a.b.queek.com.ng')).toBeNull();
    expect(resolveSubdomainVendorSlug('www.queek.com.ng')).toBeNull();
  });

  it('knows the preview host on queek.com.ng and .localhost only', () => {
    expect(isPreviewSubdomain('preview.queek.com.ng')).toBe(true);
    expect(isPreviewSubdomain('preview.localhost')).toBe(true);
    expect(isPreviewSubdomain('preview.queek.app')).toBe(false);
  });

  it('never redirects', () => {
    expect(legacyHostRedirectTarget('acme.queek.com.ng')).toBeNull();
    expect(legacyHostRedirectTarget('preview.queek.com.ng')).toBeNull();
    expect(toPrimaryStoreHost('acme.queek.com.ng')).toBe('acme.queek.com.ng');
  });

  it('treats an empty STOREFRONT_DOMAIN as unset', () => {
    process.env.STOREFRONT_DOMAIN = '  ';
    expect(getStorefrontDomain()).toBe('queek.com.ng');
    expect(resolveSubdomainVendorSlug('acme.queek.com.ng')).toBe('acme');
  });
});

describe('store domains: STOREFRONT_DOMAIN alone', () => {
  it('moves the store suffix and drops the old one', () => {
    process.env.STOREFRONT_DOMAIN = 'queek.app';
    expect(resolveSubdomainVendorSlug('acme.queek.app')).toBe('acme');
    expect(resolveSubdomainVendorSlug('acme.queek.com.ng')).toBeNull();
    expect(isPreviewSubdomain('preview.queek.app')).toBe(true);
    expect(isPreviewSubdomain('preview.queek.com.ng')).toBe(false);
    expect(legacyHostRedirectTarget('acme.queek.com.ng')).toBeNull();
  });

  it('keeps .localhost', () => {
    process.env.STOREFRONT_DOMAIN = 'queek.app';
    expect(resolveSubdomainVendorSlug('acme.localhost')).toBe('acme');
    expect(isPreviewSubdomain('preview.localhost')).toBe(true);
  });
});

describe('store domains: the move (queek.app + legacy queek.com.ng)', () => {
  it('resolves a store on either domain', () => {
    moved();
    expect(resolveSubdomainVendorSlug('acme.queek.app')).toBe('acme');
    expect(resolveSubdomainVendorSlug('acme.queek.com.ng')).toBe('acme');
    expect(resolveSubdomainVendorSlug('acme.localhost')).toBe('acme');
  });

  it('keeps the reserved slugs reserved on both', () => {
    moved();
    for (const host of ['www', 'preview', 'themes', 'api', 'auth', 'edge']) {
      expect(resolveSubdomainVendorSlug(`${host}.queek.app`)).toBeNull();
      expect(resolveSubdomainVendorSlug(`${host}.queek.com.ng`)).toBeNull();
    }
  });

  it('does not take the apex or a deeper host for a store', () => {
    moved();
    expect(resolveSubdomainVendorSlug('queek.app')).toBeNull();
    expect(resolveSubdomainVendorSlug('queek.com.ng')).toBeNull();
    expect(resolveSubdomainVendorSlug('a.b.queek.app')).toBeNull();
    expect(resolveSubdomainVendorSlug('acme.notqueek.app')).toBeNull();
  });

  it('knows the preview host on both domains', () => {
    moved();
    expect(isPreviewSubdomain('preview.queek.app')).toBe(true);
    expect(isPreviewSubdomain('preview.queek.com.ng')).toBe(true);
    expect(isPreviewSubdomain('acme.queek.app')).toBe(false);
  });

  it('points a legacy host at the same label on the primary domain', () => {
    moved();
    expect(legacyHostRedirectTarget('acme.queek.com.ng')).toBe('acme.queek.app');
    expect(legacyHostRedirectTarget('preview.queek.com.ng')).toBe('preview.queek.app');
    expect(legacyHostRedirectTarget('themes.queek.com.ng')).toBe('themes.queek.app');
    expect(legacyHostRedirectTarget('www.queek.com.ng')).toBe('www.queek.app');
    expect(legacyHostRedirectTarget('ACME.Queek.com.ng')).toBe('acme.queek.app');
  });

  it('never points the primary domain, other hosts or the apex anywhere (no loops)', () => {
    moved();
    for (const host of ['acme.queek.app', 'preview.queek.app', 'queek.app', 'queek.com.ng', 'acme.localhost', 'localhost', 'shop.usequeek.com', 'a.b.queek.com.ng', 'acme.queek.com.ng.evil.com', 'evilqueek.com.ng', '']) {
      expect(legacyHostRedirectTarget(host), host).toBeNull();
    }
  });

  it('only redirects a label that could be a host name', () => {
    moved();
    expect(legacyHostRedirectTarget('under_score.queek.com.ng')).toBeNull();
    expect(legacyHostRedirectTarget('-bad.queek.com.ng')).toBeNull();
  });

  it('names the primary host in an emitted URL, keeping the port', () => {
    moved();
    expect(toPrimaryStoreHost('acme.queek.com.ng')).toBe('acme.queek.app');
    expect(toPrimaryStoreHost('acme.queek.com.ng:8443')).toBe('acme.queek.app:8443');
    expect(toPrimaryStoreHost('acme.queek.app')).toBe('acme.queek.app');
    expect(toPrimaryStoreHost('shop.example.com')).toBe('shop.example.com');
  });
});

describe('STOREFRONT_LEGACY_DOMAINS parsing', () => {
  it('reads a comma list, trimmed, lower-cased, de-duplicated', () => {
    process.env.STOREFRONT_DOMAIN = 'queek.app';
    process.env.STOREFRONT_LEGACY_DOMAINS = ' Queek.com.ng, .queek.shop ,queek.com.ng,, ';
    expect(getLegacyStorefrontDomains()).toEqual(['queek.com.ng', 'queek.shop']);
    expect(legacyHostRedirectTarget('acme.queek.shop')).toBe('acme.queek.app');
    expect(resolveSubdomainVendorSlug('acme.queek.shop')).toBe('acme');
  });

  it('drops the primary domain and junk, so a legacy entry can never cause a loop', () => {
    process.env.STOREFRONT_DOMAIN = 'queek.app';
    process.env.STOREFRONT_LEGACY_DOMAINS = 'queek.app,localhost,https://x.com,a b.com,queek.com.ng';
    expect(getLegacyStorefrontDomains()).toEqual(['queek.com.ng']);
    expect(legacyHostRedirectTarget('acme.queek.app')).toBeNull();
  });

  it('is empty when set but blank', () => {
    process.env.STOREFRONT_LEGACY_DOMAINS = ' ';
    expect(getLegacyStorefrontDomains()).toEqual([]);
  });

  it('with the default primary, a legacy domain is a second store suffix', () => {
    process.env.STOREFRONT_LEGACY_DOMAINS = 'queek.shop';
    expect(legacyHostRedirectTarget('acme.queek.shop')).toBe('acme.queek.com.ng');
  });
});

describe('resolveStoreBaseUrl', () => {
  afterEach(() => vi.resetModules());

  async function baseUrl(host: string, vendor = 'acme'): Promise<string | null> {
    vi.resetModules();
    vi.doMock('next/headers', () => ({
      headers: async () => ({ get: (name: string) => ({ host, 'x-forwarded-proto': 'https' } as Record<string, string>)[name.toLowerCase()] ?? null }),
      cookies: async () => ({ get: () => undefined }),
    }));
    const { resolveStoreBaseUrl } = await import('../sdk/server-store-client');

    return resolveStoreBaseUrl(vendor);
  }

  it('is the request origin with nothing set (today)', async () => {
    expect(await baseUrl('acme.queek.com.ng')).toBe('https://acme.queek.com.ng');
  });

  it('uses the primary domain for a store reached on the legacy one', async () => {
    moved();
    expect(await baseUrl('acme.queek.com.ng')).toBe('https://acme.queek.app');
    expect(await baseUrl('acme.queek.app')).toBe('https://acme.queek.app');
  });

  it('leaves path-based access alone', async () => {
    moved();
    expect(await baseUrl('localhost:3001')).toBe('https://localhost:3001/acme');
  });
});
