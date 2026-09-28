import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { JSX, ReactNode } from 'react';
import { StorefrontContext } from '../provider';
import { ShopPrefetchProvider, useShop } from '../hooks/use-shop';
import { normalizeShopQuery, type ShopPrefetch } from '../utils/shop-query';
import type { Product } from '../types/product';

/**
 * The server renders `/shop` with the first page already fetched. What matters
 * is what that server render contains: with a matching prefetch the grid is in
 * the HTML and nothing is loading; with anything else, useShop behaves exactly
 * as before (empty + loading, then fetches in the browser).
 */

function product(id: string, title: string): Product {
  return { id, title, slug: id } as unknown as Product;
}

const PREFETCH: ShopPrefetch = {
  query: normalizeShopQuery({ categorySlug: 'soups', keyword: 'egusi', sort: 'popular', page: 1, perPage: 24 }),
  products: [product('p1', 'Egusi Soup'), product('p2', 'Ogbono Soup')],
  pagination: { currentPage: 1, perPage: 24, hasMore: true },
};

function Grid(props: Parameters<typeof useShop>[0]): JSX.Element {
  const { products, isLoading, pagination } = useShop(props);
  return (
    <ul data-loading={String(isLoading)} data-has-more={String(pagination.hasMore)} data-page={pagination.currentPage}>
      {products.map((p) => <li key={p.id}>{p.title}</li>)}
    </ul>
  );
}

function render(children: ReactNode, opts: { prefetch?: ShopPrefetch | null; preview?: Product[] } = {}): string {
  const store = {
    vendor: { id: 'v1', slug: 'kili-foods', name: 'Kili Foods' },
    config: {},
    menus: [],
    previewData: opts.preview ? { products: opts.preview } : undefined,
    basePath: '',
    pagesChrome: {},
  };
  return renderToStaticMarkup(
    <StorefrontContext.Provider value={store as never}>
      <ShopPrefetchProvider value={opts.prefetch ?? null}>{children}</ShopPrefetchProvider>
    </StorefrontContext.Provider>,
  );
}

describe('useShop + ShopPrefetchProvider', () => {
  it('renders the prefetched page when the query matches exactly', () => {
    const html = render(<Grid categorySlug="soups" keyword="  egusi " sort="popular" page={1} perPage={24} />, { prefetch: PREFETCH });
    expect(html).toContain('data-loading="false"');
    expect(html).toContain('data-has-more="true"');
    expect(html).toContain('Egusi Soup');
    expect(html).toContain('Ogbono Soup');
  });

  it('ignores the prefetch for any other query (e.g. a product page\'s "popular" rail)', () => {
    for (const other of [
      { sort: 'popular' as const, perPage: 8, page: 1 },
      { categorySlug: 'soups', keyword: 'egusi', sort: 'latest' as const },
      { categorySlug: 'soups', keyword: 'egusi', sort: 'popular' as const, page: 2 },
    ]) {
      const html = render(<Grid {...other} />, { prefetch: PREFETCH });
      expect(html).toContain('data-loading="true"');
      expect(html).not.toContain('Egusi Soup');
    }
  });

  it('behaves exactly as before with no provider value', () => {
    const html = render(<Grid categorySlug="soups" keyword="egusi" sort="popular" />);
    expect(html).toContain('data-loading="true"');
    expect(html).toContain('data-has-more="false"');
    expect(html).toContain('data-page="1"');
  });

  it('preview mode keeps using the demo catalogue, never the prefetch', () => {
    const html = render(<Grid categorySlug="soups" keyword="egusi" sort="popular" />, {
      prefetch: PREFETCH,
      preview: [{ ...product('d1', 'Demo Egusi'), categories: [{ slug: 'soups' }], excerpt: '', pricing: { sale_amount: 1 }, review_summary: { review_count: 0 } } as unknown as Product],
    });
    expect(html).toContain('Demo Egusi');
    expect(html).not.toContain('Ogbono Soup');
  });
});
