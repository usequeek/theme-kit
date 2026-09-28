import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StorefrontContext } from '../provider';
import { BlogPagination } from '../components/blog/pagination';
import type { Pagination } from '../types/page';

vi.mock('next/headers', () => ({
  headers: async () => new Headers({ host: 'kili-foods.usequeek.com' }),
}));

/**
 * Storefront lists answer `{data, has_more, next_cursor}` with no totals, page
 * counts or page URLs (founder 28/9/26: prev/next + "Page N", zero COUNT). The
 * kit's readers must walk on `has_more` alone and label the page they asked for.
 */
describe('storefront list walk state (has_more, no totals)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('fetchCollectionProducts reads has_more/next_cursor top-level and labels the page it asked for', async () => {
    const fetchMock = vi.fn(async (url: string) => ({
      ok: true,
      json: async () =>
        url.includes('/collections/new-season/products')
          ? { status: 'success', data: [], has_more: true, next_cursor: 'eyJ2IjoxfQ', meta: { collection: { slug: 'new-season' } } }
          : { status: 'success', data: [{ id: 'c1', slug: 'new-season', name: 'New season' }] },
    }));
    vi.stubGlobal('fetch', fetchMock);
    const { fetchCollectionProducts } = await import('../api/collections');

    const page3 = await fetchCollectionProducts('kili-foods', 'new-season', { page: 3, perPage: 20 });
    expect(page3.pagination).toEqual({ current_page: 3, per_page: 20, has_more: true, next_cursor: 'eyJ2IjoxfQ' });
    const productsCall = fetchMock.mock.calls.map(([url]) => String(url)).find((url) => url.includes('/products'));
    expect(productsCall).toContain('page=3');
    expect(productsCall).toContain('per_page=20');
  });

  it('treats a response with no has_more as the last page (never follows legacy links)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ status: 'success', data: [], links: { next: 'https://api/x?page=2' }, meta: { current_page: 1, last_page: 4 } }),
    })));
    const { fetchCollectionProducts } = await import('../api/collections');

    const page = await fetchCollectionProducts('kili-foods', 'new-season');
    expect(page.pagination).toEqual({ current_page: 1, per_page: undefined, has_more: false, next_cursor: null });
  });

  const renderPager = (pagination: Pagination, category?: string): string =>
    renderToStaticMarkup(
      <StorefrontContext.Provider value={{ vendor: { id: 'v1', slug: 'kili-foods' }, basePath: '/kili-foods' } as never}>
        <BlogPagination pagination={pagination} category={category} />
      </StorefrontContext.Provider>,
    );

  it('BlogPagination: "Page N" with Next enabled by has_more and no "of M"', () => {
    const html = renderPager({ current_page: 2, per_page: 12, has_more: true }, 'news');
    expect(html).toContain('Page 2');
    expect(html).not.toMatch(/Page 2 of/);
    expect(html).toContain('rel="prev" href="/kili-foods/blog?category=news"');
    expect(html).toContain('rel="next" href="/kili-foods/blog?category=news&amp;page=3"');
  });

  it('BlogPagination: last page disables Next; a lone first page renders nothing', () => {
    const last = renderPager({ current_page: 4, has_more: false });
    expect(last).toContain('Page 4');
    expect(last).not.toContain('rel="next"');
    expect(last).toContain('rel="prev"');

    expect(renderPager({ current_page: 1, has_more: false })).toBe('');
  });
});
