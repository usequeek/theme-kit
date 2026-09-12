'use client';

import { useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { ShopSort } from './use-shop';

const SORTS: ShopSort[] = ['latest', 'popular', 'price_low', 'price_high'];

export interface ShopParams {
  categorySlug: string | null;
  keyword: string;
  sort: ShopSort;
  page: number;
  setCategory: (slug: string | null) => void;
  setKeyword: (keyword: string) => void;
  setSort: (sort: ShopSort) => void;
  setPage: (page: number) => void;
}

/**
 * Shop filter/search/sort/page state, persisted in the URL query string so it
 * survives refresh and is shareable. Pair with `useShop` for the catalogue data.
 *
 * Query keys: `category` (slug), `q` (keyword), `sort`, `page`.
 * Changing category, keyword or sort resets to page 1.
 */
export function useShopParams(): ShopParams {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const categorySlug = searchParams.get('category');
  const keyword = searchParams.get('q') ?? '';
  const sortRaw = searchParams.get('sort');
  const sort: ShopSort = SORTS.includes(sortRaw as ShopSort) ? (sortRaw as ShopSort) : 'latest';
  const pageRaw = Number(searchParams.get('page'));
  const page = Number.isFinite(pageRaw) && pageRaw > 1 ? Math.floor(pageRaw) : 1;

  const apply = useCallback(
    (next: { category?: string | null; q?: string | null; sort?: ShopSort; page?: number }) => {
      const params = new URLSearchParams(searchParams.toString());
      const set = (key: string, value: string | null | undefined): void => {
        if (value === null || value === undefined || value === '') params.delete(key);
        else params.set(key, value);
      };
      if ('category' in next) set('category', next.category);
      if ('q' in next) set('q', next.q);
      if ('sort' in next) set('sort', next.sort === 'latest' ? null : next.sort);
      if ('page' in next) set('page', next.page && next.page > 1 ? String(next.page) : null);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  const setCategory = useCallback(
    (slug: string | null) => apply({ category: slug, q: null, page: 1 }),
    [apply],
  );
  const setKeyword = useCallback(
    (value: string) => apply({ q: value.trim() || null, category: null, page: 1 }),
    [apply],
  );
  const setSort = useCallback((value: ShopSort) => apply({ sort: value, page: 1 }), [apply]);
  const setPage = useCallback((value: number) => apply({ page: value }), [apply]);

  return { categorySlug, keyword, sort, page, setCategory, setKeyword, setSort, setPage };
}
