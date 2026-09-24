'use client';

import { createContext, createElement, useContext, useEffect, useMemo, useRef, useState, type JSX, type ReactNode } from 'react';
import { useStorefront } from '../provider';
import type { Product, ApiResponse } from '../types/product';
import { createBrowserClient } from '../sdk/client';
import {
  SHOP_DEFAULT_PER_PAGE,
  normalizeShopQuery,
  parseShopResponse,
  sameShopQuery,
  shopRequestParams,
  type ShopPagination,
  type ShopPrefetch,
  type ShopSort,
} from '../utils/shop-query';

// Types live in utils/shop-query (shared with the server fetch); re-exported so
// every existing `import type { ShopSort } from '.../hooks/use-shop'` keeps working.
export type { ShopPagination, ShopPrefetch, ShopQuery, ShopSort } from '../utils/shop-query';

const EMPTY_PAGINATION: ShopPagination = {
  currentPage: 1,
  lastPage: 1,
  perPage: SHOP_DEFAULT_PER_PAGE,
  total: 0,
  from: null,
  to: null,
  hasMore: false,
};

const ShopPrefetchContext = createContext<ShopPrefetch | null>(null);

/**
 * Hands `useShop` a page the server already fetched (`fetchShopPrefetch`), so
 * the product grid renders in the server HTML. A `useShop` call uses it only
 * when its query matches exactly — same filters, sort, page and page size —
 * and otherwise fetches as it always has. Themes never touch it; the storefront
 * wraps its `/shop` route.
 */
export function ShopPrefetchProvider({ value, children }: { value: ShopPrefetch | null; children: ReactNode }): JSX.Element {
  return createElement(ShopPrefetchContext.Provider, { value }, children);
}

function sortProducts(list: Product[], sort: ShopSort): Product[] {
  const copy = [...list];
  switch (sort) {
    case 'price_low':
      return copy.sort((a, b) => a.pricing.sale_amount - b.pricing.sale_amount);
    case 'price_high':
      return copy.sort((a, b) => b.pricing.sale_amount - a.pricing.sale_amount);
    case 'popular':
      return copy.sort(
        (a, b) => b.review_summary.review_count - a.review_summary.review_count,
      );
    default:
      return copy;
  }
}

function filterProducts(
  all: Product[],
  categorySlug: string | null,
  keyword: string | null,
): Product[] {
  let list = all;
  if (categorySlug) {
    list = list.filter((product) =>
      product.categories.some((category) => category.slug === categorySlug),
    );
  }
  const term = keyword?.trim().toLowerCase();
  if (term) {
    list = list.filter(
      (product) =>
        product.title.toLowerCase().includes(term) ||
        (product.excerpt ?? '').toLowerCase().includes(term),
    );
  }
  return list;
}

/**
 * Shop catalogue data source. Hits the live products endpoint in production.
 * In preview (when the provider carries `previewData.products`) it filters,
 * sorts and paginates the demo catalogue in-memory so themes render real cards.
 *
 * Page is controlled by the caller — pair with `useShopParams` for URL sync.
 */
export function useShop(options?: {
  categorySlug?: string | null;
  keyword?: string | null;
  sort?: ShopSort;
  page?: number;
  perPage?: number;
}): {
  products: Product[];
  isLoading: boolean;
  pagination: ShopPagination;
} {
  const { vendor, previewData } = useStorefront();
  const prefetch = useContext(ShopPrefetchContext);

  const perPage = options?.perPage ?? SHOP_DEFAULT_PER_PAGE;
  const categorySlug = options?.categorySlug ?? null;
  const keyword = options?.keyword ?? null;
  const sort = options?.sort ?? 'latest';
  const page = options?.page && options.page > 0 ? options.page : 1;
  const query = normalizeShopQuery({ categorySlug, keyword, sort, page, perPage });

  const previewProducts = previewData?.products;
  const isPreview = Array.isArray(previewProducts);

  // The server's page, when it is exactly this query (see ShopPrefetchProvider).
  const seed = !isPreview && prefetch && sameShopQuery(prefetch.query, query) ? prefetch : null;

  const [products, setProducts] = useState<Product[]>(seed?.products ?? []);
  const [isLoading, setIsLoading] = useState(!isPreview && !seed);
  const [pagination, setPagination] = useState<ShopPagination>(seed?.pagination ?? { ...EMPTY_PAGINATION, perPage });
  // The query whose results are already in state. Seeded with the prefetch so
  // the first effect run does not refetch the page the server just rendered.
  const loadedQueryRef = useRef<string | null>(seed ? JSON.stringify(seed.query) : null);

  // Preview: derive everything synchronously from the demo catalogue.
  const previewResult = useMemo(() => {
    if (!isPreview) return null;
    const filtered = sortProducts(
      filterProducts(previewProducts as Product[], categorySlug, keyword),
      sort,
    );
    const total = filtered.length;
    const lastPage = Math.max(1, Math.ceil(total / perPage));
    const safePage = Math.min(Math.max(1, page), lastPage);
    const start = (safePage - 1) * perPage;
    const slice = filtered.slice(start, start + perPage);
    return {
      products: slice,
      pagination: {
        currentPage: safePage,
        lastPage,
        perPage,
        total,
        from: total === 0 ? null : start + 1,
        to: total === 0 ? null : start + slice.length,
        hasMore: safePage < lastPage,
      } satisfies ShopPagination,
    };
  }, [isPreview, previewProducts, categorySlug, keyword, sort, page, perPage]);

  // Production: fetch the live catalogue.
  const queryKey = JSON.stringify(query);
  useEffect(() => {
    if (isPreview) return undefined;
    // Already showing this query — the server's prefetch, or a fetch that
    // finished. (Clear any loading state a cancelled in-between query left.)
    if (loadedQueryRef.current === queryKey) {
      setIsLoading(false);
      return undefined;
    }

    // Per-run flag: a shared ref let a slow earlier fetch (filters A) land after
    // a newer one (filters B) had reset it, overwriting B's products.
    let cancelled = false;
    setIsLoading(true);

    const client = createBrowserClient(vendor.slug ?? undefined);
    const current = JSON.parse(queryKey) as typeof query;

    async function run(): Promise<void> {
      try {
        const response = await client.get<ApiResponse<unknown, Record<string, unknown>>>(
          '/products',
          shopRequestParams(current),
        );
        if (cancelled) return;

        const parsed = parseShopResponse(response, current);
        setPagination(parsed.pagination);
        setProducts(parsed.products);
        loadedQueryRef.current = queryKey;
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [isPreview, vendor.slug, queryKey]);

  if (isPreview && previewResult) {
    return { products: previewResult.products, isLoading: false, pagination: previewResult.pagination };
  }

  return { products, isLoading, pagination };
}
