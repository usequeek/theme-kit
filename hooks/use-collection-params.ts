'use client';

import { useCallback, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { CollectionSort } from '../api/collections';

const SORTS: CollectionSort[] = ['newest', 'popular', 'price_low', 'price_high'];

export interface CollectionParams {
  keyword: string;
  sort: CollectionSort;
  page: number;
  /** True while a param change is re-fetching the server-rendered page
   *  (this route has no client-side data fetch of its own — every sort/
   *  search/page change is a real server round-trip). Themes can dim the
   *  grid on this the same way `useShop`'s client fetch does. */
  isPending: boolean;
  setKeyword: (keyword: string) => void;
  setSort: (sort: CollectionSort) => void;
  setPage: (page: number) => void;
}

/**
 * Collection detail search/sort/page state, persisted in the URL query
 * string (mirrors `useShopParams` — same mechanism, collection-scoped: no
 * `category` key since the collection itself is already the scope).
 *
 * Query keys: `q` (keyword), `sort`, `page`. Changing keyword or sort resets
 * to page 1. The matching server route reads these same keys to fetch the
 * real page — this hook only ever manages the URL, never fetches.
 */
export function useCollectionParams(): CollectionParams {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const keyword = searchParams.get('q') ?? '';
  const sortRaw = searchParams.get('sort');
  const sort: CollectionSort = SORTS.includes(sortRaw as CollectionSort) ? (sortRaw as CollectionSort) : 'newest';
  const pageRaw = Number(searchParams.get('page'));
  const page = Number.isFinite(pageRaw) && pageRaw > 1 ? Math.floor(pageRaw) : 1;

  const apply = useCallback(
    (next: { q?: string | null; sort?: CollectionSort; page?: number }) => {
      const params = new URLSearchParams(searchParams.toString());
      const set = (key: string, value: string | null | undefined): void => {
        if (value === null || value === undefined || value === '') params.delete(key);
        else params.set(key, value);
      };
      if ('q' in next) set('q', next.q);
      if ('sort' in next) set('sort', next.sort === 'newest' ? null : next.sort);
      if ('page' in next) set('page', next.page && next.page > 1 ? String(next.page) : null);
      const qs = params.toString();
      startTransition(() => {
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      });
    },
    [router, pathname, searchParams],
  );

  const setKeyword = useCallback((value: string) => apply({ q: value.trim() || null, page: 1 }), [apply]);
  const setSort = useCallback((value: CollectionSort) => apply({ sort: value, page: 1 }), [apply]);
  const setPage = useCallback((value: number) => apply({ page: value }), [apply]);

  return { keyword, sort, page, isPending, setKeyword, setSort, setPage };
}
