'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useStorefront } from '../provider';
import type { Product, ApiResponse, LegacyProductLike } from '../types/product';
import { createBrowserClient } from '../sdk/client';
import { extractProducts, normalizeProduct } from '../utils/product-normalizer';

export type ShopSort = 'latest' | 'popular' | 'price_low' | 'price_high';

export interface ShopPagination {
  currentPage: number;
  lastPage: number;
  perPage: number;
  total: number;
  from: number | null;
  to: number | null;
  hasMore: boolean;
}

const EMPTY_PAGINATION: ShopPagination = {
  currentPage: 1,
  lastPage: 1,
  perPage: 24,
  total: 0,
  from: null,
  to: null,
  hasMore: false,
};

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

  const perPage = options?.perPage ?? 24;
  const categorySlug = options?.categorySlug ?? null;
  const keyword = options?.keyword ?? null;
  const sort = options?.sort ?? 'latest';
  const page = options?.page && options.page > 0 ? options.page : 1;

  const previewProducts = previewData?.products;
  const isPreview = Array.isArray(previewProducts);

  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(!isPreview);
  const [pagination, setPagination] = useState<ShopPagination>({
    ...EMPTY_PAGINATION,
    perPage,
  });
  const cancelRef = useRef<boolean>(false);

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
  useEffect(() => {
    if (isPreview) return undefined;

    cancelRef.current = false;
    setIsLoading(true);

    const client = createBrowserClient(vendor.slug ?? undefined);
    const query: Record<string, string | number> = { per_page: perPage, page };
    if (categorySlug) query.category_slug = categorySlug;
    if (keyword?.trim()) query.keyword = keyword.trim();
    if (sort) query.sort = sort;

    async function run(): Promise<void> {
      try {
        const response = await client.get<ApiResponse<unknown, Record<string, unknown>>>(
          '/products',
          query,
        );
        if (cancelRef.current) return;

        const meta = (response.meta ?? {}) as Record<string, unknown>;
        const nestedMeta = (meta.pagination ?? meta) as Record<string, unknown>;
        setPagination({
          currentPage: (nestedMeta.current_page as number) ?? page,
          lastPage: (nestedMeta.last_page as number) ?? 1,
          perPage: (nestedMeta.per_page as number) ?? perPage,
          total: (nestedMeta.total as number) ?? 0,
          from: (nestedMeta.from as number | null) ?? null,
          to: (nestedMeta.to as number | null) ?? null,
          hasMore: (nestedMeta.has_more as boolean) ?? false,
        });
        setProducts(
          extractProducts(response.data).map((item) =>
            normalizeProduct(item as LegacyProductLike),
          ),
        );
      } finally {
        if (!cancelRef.current) setIsLoading(false);
      }
    }

    void run();

    return () => {
      cancelRef.current = true;
    };
  }, [isPreview, vendor.slug, categorySlug, keyword, sort, perPage, page]);

  if (isPreview && previewResult) {
    return { products: previewResult.products, isLoading: false, pagination: previewResult.pagination };
  }

  return { products, isLoading, pagination };
}
