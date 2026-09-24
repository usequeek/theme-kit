import type { ApiResponse, LegacyProductLike, Product } from '../types/product';
import { extractProducts, normalizeProduct } from './product-normalizer';

/**
 * The shop catalogue query, in one place for both sides that run it: `useShop`
 * in the browser and `fetchShopPrefetch` on the server. The server only saves
 * the browser a fetch when the two would ask for exactly the same thing, so
 * the parsing, the request params and the response handling cannot be allowed
 * to drift — they live here, pure, with no React and no server imports.
 */

export type ShopSort = 'latest' | 'popular' | 'price_low' | 'price_high';

export const SHOP_SORTS: readonly ShopSort[] = ['latest', 'popular', 'price_low', 'price_high'];

/** What every theme's shop page asks for, and `useShop`'s default. */
export const SHOP_DEFAULT_PER_PAGE = 24;

export interface ShopPagination {
  currentPage: number;
  lastPage: number;
  perPage: number;
  total: number;
  from: number | null;
  to: number | null;
  hasMore: boolean;
}

/** A shop query with every default applied — two equal queries fetch the same page. */
export interface ShopQuery {
  categorySlug: string | null;
  keyword: string | null;
  sort: ShopSort;
  page: number;
  perPage: number;
}

/** The first page the server already fetched, handed to `useShop` via `ShopPrefetchProvider`. */
export interface ShopPrefetch {
  query: ShopQuery;
  products: Product[];
  pagination: ShopPagination;
}

export function normalizeShopQuery(input?: {
  categorySlug?: string | null;
  keyword?: string | null;
  sort?: ShopSort | null;
  page?: number | null;
  perPage?: number | null;
}): ShopQuery {
  const keyword = input?.keyword?.trim() ?? '';
  const page = input?.page && input.page > 0 ? Math.floor(input.page) : 1;
  return {
    categorySlug: input?.categorySlug || null,
    keyword: keyword === '' ? null : keyword,
    sort: input?.sort && SHOP_SORTS.includes(input.sort) ? input.sort : 'latest',
    page,
    perPage: input?.perPage && input.perPage > 0 ? input.perPage : SHOP_DEFAULT_PER_PAGE,
  };
}

export function sameShopQuery(a: ShopQuery, b: ShopQuery): boolean {
  return a.categorySlug === b.categorySlug && a.keyword === b.keyword && a.sort === b.sort && a.page === b.page && a.perPage === b.perPage;
}

/**
 * The `/shop` URL's filters — `category`, `q`, `sort`, `page` — exactly as
 * `useShopParams` reads them. `get` is `URLSearchParams.get` or equivalent.
 */
export function parseShopSearchParams(get: (key: string) => string | null): {
  categorySlug: string | null;
  keyword: string;
  sort: ShopSort;
  page: number;
} {
  const sortRaw = get('sort');
  const pageRaw = Number(get('page'));
  return {
    categorySlug: get('category'),
    keyword: get('q') ?? '',
    sort: SHOP_SORTS.includes(sortRaw as ShopSort) ? (sortRaw as ShopSort) : 'latest',
    page: Number.isFinite(pageRaw) && pageRaw > 1 ? Math.floor(pageRaw) : 1,
  };
}

/** Query params for `GET /products` (the storefront `/client/store` scope). */
export function shopRequestParams(query: ShopQuery): Record<string, string | number> {
  const params: Record<string, string | number> = { per_page: query.perPage, page: query.page };
  if (query.categorySlug) params.category_slug = query.categorySlug;
  if (query.keyword) params.keyword = query.keyword;
  params.sort = query.sort;
  return params;
}

export function parseShopResponse(
  response: ApiResponse<unknown, Record<string, unknown>>,
  query: ShopQuery,
): { products: Product[]; pagination: ShopPagination } {
  const meta = (response.meta ?? {}) as Record<string, unknown>;
  const nestedMeta = (meta.pagination ?? meta) as Record<string, unknown>;
  return {
    pagination: {
      currentPage: (nestedMeta.current_page as number) ?? query.page,
      lastPage: (nestedMeta.last_page as number) ?? 1,
      perPage: (nestedMeta.per_page as number) ?? query.perPage,
      total: (nestedMeta.total as number) ?? 0,
      from: (nestedMeta.from as number | null) ?? null,
      to: (nestedMeta.to as number | null) ?? null,
      hasMore: (nestedMeta.has_more as boolean) ?? false,
    },
    products: extractProducts(response.data).map((item) => normalizeProduct(item as LegacyProductLike)),
  };
}
