import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { request } from '../sdk/client';

/**
 * The storefront must ONLY ever call the `/v1/client/*` API scope. That scope
 * resolves the vendor AND forces the platform (storefront/instore_qr) — so prices
 * are always the storefront's, never the marketplace commission-inclusive price.
 * Legacy v1 routes (/products, /vendors/*, /categories, ...) skip that
 * resolution → wrong platform → wrong price.
 *
 * This guard prevents that whole class of bug from ever returning.
 */
describe('storefront API scope guard', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('refuses any backend route outside /v1/client', async () => {
    for (const badPath of ['/products/abc', '/vendors/foo/products', '/categories', '/vendors/foo/collections/x/products']) {
      await expect(request('http://api/api/v1', badPath)).rejects.toThrow(/only call \/v1\/client/);
    }
  });

  it('allows /client/* routes through', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [] }) });
    vi.stubGlobal('fetch', fetchMock);

    await expect(request('http://api/api/v1', '/client/store/products')).resolves.toEqual({ data: [] });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('does not reintroduce a raw v1-route client (createServerClient)', () => {
    const root = process.cwd();
    const sdk = readFileSync(join(root, 'sdk/client.ts'), 'utf8');
    expect(sdk).not.toContain('export function createServerClient');

    const apiDir = join(root, 'api');
    for (const file of readdirSync(apiDir).filter((name) => name.endsWith('.ts'))) {
      const src = readFileSync(join(apiDir, file), 'utf8');
      expect(src, `${file} must not use the removed createServerClient (v1 routes)`).not.toContain('createServerClient');
    }
  });
});
