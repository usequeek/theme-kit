// @vitest-environment jsdom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StorefrontProvider } from '../provider';
import { useProductSections } from '../hooks/use-product-sections';
import { useRelatedProducts } from '../hooks/use-related-products';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let host: HTMLDivElement;
const seen: { current: unknown } = { current: null };

function mount(node: ReactNode, previewData?: unknown, slug = 'acme'): void {
  act(() => {
    root.render(
      <StorefrontProvider vendor={{ id: 'v1', slug, name: 'Acme' } as never} config={{} as never} menus={[]} previewData={previewData as never}>
        {node}
      </StorefrontProvider>,
    );
  });
}

async function flush(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function Probe({ read }: { read: () => unknown }) {
  seen.current = read();
  return null;
}

const product = (slug: string) => ({ id: `id-${slug}`, slug, title: slug, name: slug });

/** Answers each client read by path; unknown paths are a 500. Returns the paths asked, in order. */
function stubApi(routes: Record<string, unknown>) {
  const asked: string[] = [];
  vi.stubGlobal('fetch', vi.fn(async (input: unknown) => {
    const url = new URL(String(input), 'http://x');
    asked.push(`${url.pathname.replace(/^.*\/client\/store/, '')}${url.search}`);
    const key = Object.keys(routes).find((path) => url.pathname.endsWith(path));
    if (key === undefined) return { ok: false, status: 500, headers: new Headers(), json: async () => ({}) };
    return { ok: true, status: 200, headers: new Headers(), json: async () => routes[key] };
  }));
  return asked;
}

beforeEach(() => {
  host = document.createElement('div');
  root = createRoot(host);
  seen.current = null;
});
afterEach(() => {
  act(() => root.unmount());
  vi.unstubAllGlobals();
});

describe('useProductSections({ enabled })', () => {
  const sections = { data: [product('a'), product('b')] };

  it('reads nothing while disabled, then reads once when it turns on', async () => {
    const asked = stubApi({ '/products': sections });
    const Closed = ({ open }: { open: boolean }) => <Probe read={() => useProductSections({ enabled: open })} />;

    mount(<Closed open={false} />, undefined, 'sections-lazy');
    await flush();
    expect(asked).toEqual([]);
    expect((seen.current as { isLoading: boolean }).isLoading).toBe(true);

    mount(<Closed open />, undefined, 'sections-lazy');
    await flush();
    expect(asked).toHaveLength(1);
    const state = seen.current as { sections: { products: unknown[] }[]; isLoading: boolean };
    expect(state.isLoading).toBe(false);
    expect(state.sections[0]?.products).toHaveLength(2);

    // Closing and reopening reuses the cached read.
    mount(<Closed open={false} />, undefined, 'sections-lazy');
    mount(<Closed open />, undefined, 'sections-lazy');
    await flush();
    expect(asked).toHaveLength(1);
  });

  it('without the option it reads straight away, as before', async () => {
    const asked = stubApi({ '/products': sections });
    mount(<Probe read={() => useProductSections()} />, undefined, 'sections-eager');
    await flush();
    expect(asked).toEqual(['/products']);
  });
});

describe('useRelatedProducts fallback', () => {
  const popular = { data: [product('x'), product('cur'), product('y')] };

  it('with related items it makes ONE read and never asks for the fallback', async () => {
    const asked = stubApi({ '/products/cur/related': { data: [product('r1'), product('r2')] }, '/products': popular });
    mount(<Probe read={() => useRelatedProducts('cur', 4, { fallback: { sort: 'popular', limit: 9 } })} />);
    await flush();

    expect(asked).toHaveLength(1);
    expect(asked[0]).toContain('/products/cur/related');
    const state = seen.current as { products: { slug: string }[]; isLoading: boolean; usedFallback: boolean };
    expect(state.products.map((p) => p.slug)).toEqual(['r1', 'r2']);
    expect(state.isLoading).toBe(false);
    expect(state.usedFallback).toBe(false);
  });

  it('with no related items it reads the fallback, drops the viewed product and stays loading until then', async () => {
    const asked = stubApi({ '/products/cur/related': { data: [] }, '/products': popular });
    mount(<Probe read={() => useRelatedProducts('cur', 4, { fallback: { sort: 'popular', limit: 9 } })} />);
    expect((seen.current as { isLoading: boolean }).isLoading).toBe(true);
    await flush();

    expect(asked).toHaveLength(2);
    expect(asked[1]).toContain('sort=popular');
    expect(asked[1]).toContain('per_page=9');
    const state = seen.current as { products: { slug: string }[]; isLoading: boolean; usedFallback: boolean };
    expect(state.products.map((p) => p.slug)).toEqual(['x', 'y']);
    expect(state.isLoading).toBe(false);
    expect(state.usedFallback).toBe(true);
  });

  it('a failed related read falls back, and keeps the failure on error', async () => {
    stubApi({ '/products': popular });
    mount(<Probe read={() => useRelatedProducts('cur', 4, { fallback: { sort: 'popular', limit: 9 } })} />);
    await flush();

    const state = seen.current as { products: { slug: string }[]; error: Error | null };
    expect(state.products.map((p) => p.slug)).toEqual(['x', 'y']);
    expect(state.error).toBeInstanceOf(Error);
  });

  it('a collection fallback reads that collection', async () => {
    const asked = stubApi({ '/products/cur/related': { data: [] }, '/collections/dresses/products': popular });
    mount(<Probe read={() => useRelatedProducts('cur', 4, { fallback: { collection: 'dresses', sort: 'popular', limit: 4 } })} />);
    await flush();

    expect(asked[1]).toContain('/collections/dresses/products');
  });

  it('without a fallback it behaves as before: empty related stays empty, one read', async () => {
    const asked = stubApi({ '/products/cur/related': { data: [] }, '/products': popular });
    mount(<Probe read={() => useRelatedProducts('cur', 4)} />);
    await flush();

    expect(asked).toHaveLength(1);
    expect((seen.current as { products: unknown[] }).products).toEqual([]);
  });

  it('a failed related read without a fallback sets error and stays empty', async () => {
    stubApi({});
    mount(<Probe read={() => useRelatedProducts('cur', 4)} />);
    await flush();

    const state = seen.current as { products: unknown[]; error: Error | null; isLoading: boolean };
    expect(state.products).toEqual([]);
    expect(state.error).toBeInstanceOf(Error);
    expect(state.isLoading).toBe(false);
  });

  it('makes no request in the editor preview', async () => {
    const asked = stubApi({});
    mount(<Probe read={() => useRelatedProducts('cur', 4, { fallback: { sort: 'popular', limit: 9 } })} />, { products: [product('cur'), product('p2')] });
    await flush();

    expect(asked).toEqual([]);
    expect((seen.current as { products: { slug: string }[] }).products.map((p) => p.slug)).toEqual(['p2']);
  });
});
