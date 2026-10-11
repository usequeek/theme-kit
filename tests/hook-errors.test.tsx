// @vitest-environment jsdom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StorefrontProvider } from '../provider';
import { useProducts, useProductBySlug } from '../hooks/use-products';
import { useShop } from '../hooks/use-shop';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function Provider({ children }: { children: ReactNode }) {
  return (
    <StorefrontProvider vendor={{ id: 'v1', slug: 'acme', name: 'Acme' } as never} config={{} as never} menus={[]}>
      {children}
    </StorefrontProvider>
  );
}

let root: Root;
let host: HTMLDivElement;
const seen: { current: unknown } = { current: null };

function mount(node: ReactNode): void {
  act(() => {
    root.render(<Provider>{node}</Provider>);
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

describe('data hooks report failure instead of rejecting', () => {
  beforeEach(() => {
    host = document.createElement('div');
    root = createRoot(host);
    seen.current = null;
  });
  afterEach(() => {
    act(() => root.unmount());
    vi.unstubAllGlobals();
  });

  it('useProducts exposes error and stops loading when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 503, headers: new Headers(), json: async () => ({}) })));
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);

    mount(<Probe read={() => useProducts({ limit: 4 })} />);
    await flush();

    const state = seen.current as { products: unknown[]; isLoading: boolean; error: Error | null };
    expect(state.isLoading).toBe(false);
    expect(state.products).toEqual([]);
    expect(state.error).toBeInstanceOf(Error);
    expect(state.error?.message).toContain('503');
    expect(unhandled).not.toHaveBeenCalled();
    process.off('unhandledRejection', unhandled);
  });

  it('useShop exposes error when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500, headers: new Headers(), json: async () => ({}) })));

    mount(<Probe read={() => useShop({ page: 1 })} />);
    await flush();

    const state = seen.current as { isLoading: boolean; error: Error | null };
    expect(state.isLoading).toBe(false);
    expect(state.error?.message).toContain('500');
  });

  it('useProductBySlug encodes the slug into the request path', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, headers: new Headers(), json: async () => ({ data: null }) }));
    vi.stubGlobal('fetch', fetchMock);

    mount(<Probe read={() => useProductBySlug('a b/../c?x=1')} />);
    await flush();

    const url = String((fetchMock.mock.calls[0] as unknown[])[0]);
    expect(url).toContain('/client/store/products/a%20b%2F..%2Fc%3Fx%3D1');
  });
});
