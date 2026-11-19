// @vitest-environment jsdom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StorefrontProvider } from '../provider';
import { useCategories, type Category } from '../hooks/use-categories';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const tree = [
  { id: 'a', slug: 'a', name: 'A', children: [{ id: 'c', slug: 'c', name: 'C' }] },
  { id: 'b', slug: 'b', name: 'B' },
] as Category[];

let root: Root;
let host: HTMLDivElement;
const seen: { current: { categories: Category[] } | null } = { current: null };

function Probe({ ids, limit }: { ids?: string[]; limit?: number }) {
  seen.current = useCategories({ ids, limit });
  return null;
}

function mount(node: ReactNode, previewData?: unknown): void {
  act(() => {
    root.render(
      <StorefrontProvider
        vendor={{ id: 'v1', slug: 'acme', name: 'Acme' } as never}
        config={{} as never}
        menus={[]}
        previewData={previewData as never}
      >
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

function stubFetch() {
  const fetchMock = vi.fn(async () => ({
    ok: true,
    status: 200,
    headers: new Headers(),
    json: async () => ({ data: tree }),
  }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('useCategories', () => {
  beforeEach(() => {
    host = document.createElement('div');
    root = createRoot(host);
    seen.current = null;
  });
  afterEach(() => {
    act(() => root.unmount());
    vi.unstubAllGlobals();
  });

  it('asks for the store-facing list (storefront=1), never include_empty', async () => {
    const fetchMock = stubFetch();
    mount(<Probe />);
    await flush();

    const url = new URL(String((fetchMock.mock.calls[0] as unknown[])[0]), 'http://x');
    expect(url.pathname).toContain('/collections');
    expect(url.searchParams.get('storefront')).toBe('1');
    expect(url.searchParams.has('include_empty')).toBe(false);
  });

  it('pinned ids ask include_empty=0 without storefront', async () => {
    const fetchMock = stubFetch();
    mount(<Probe ids={['a']} />);
    await flush();

    const url = new URL(String((fetchMock.mock.calls[0] as unknown[])[0]), 'http://x');
    expect(url.searchParams.get('include_empty')).toBe('0');
    expect(url.searchParams.has('storefront')).toBe(false);
  });

  it('makes no request in the editor preview', async () => {
    const fetchMock = stubFetch();
    mount(<Probe />, { categories: tree });
    await flush();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(seen.current?.categories.map((c) => c.id)).toEqual(['a', 'c', 'b']);
  });

  it('keeps ids pinning order, filtering and limit', async () => {
    stubFetch();
    mount(<Probe ids={['b', 'zz', 'c', 'a']} />);
    await flush();
    expect(seen.current?.categories.map((c) => c.id)).toEqual(['b', 'c', 'a']);

    mount(<Probe ids={['b', 'c', 'a']} limit={2} />);
    await flush();
    expect(seen.current?.categories.map((c) => c.id)).toEqual(['b', 'c']);
  });
});
