import type { ProductQuery } from '../hooks/use-products';
import type { ApiResponse, Product, ProductListMeta } from '../types/product';
import type { createBrowserClient } from '../sdk/client';
import { withLocaleQuery } from './locale';
import { extractProducts, normalizeProduct } from './product-normalizer';

/**
 * The one browser read behind a product list: a collection's products, or the
 * store's products filtered by `sort`, `limit`, `ids` and `hasVideo`. Shared by
 * {@link useProducts} and the fallback of `useRelatedProducts`, so the two can
 * never ask the API differently.
 */
export async function fetchProductList(
  client: ReturnType<typeof createBrowserClient>,
  options: ProductQuery,
  locale?: string | null,
): Promise<Product[]> {
  let resolvedProducts: Product[];

  if (options.collection) {
    const response = await client.get<ApiResponse<unknown>>(
      `/collections/${encodeURIComponent(options.collection)}/products`,
      withLocaleQuery(undefined, locale),
    );
    resolvedProducts = extractProducts(response.data).map((p) => normalizeProduct(p));
  } else {
    const query: Record<string, string | number | string[]> = {};
    if (options.sort) query.sort = options.sort;
    if (options.limit) query.per_page = options.limit;
    if (options.hasVideo) query.has_video = 1;
    // Ask the API for exactly these products (by id) instead of
    // fetching an arbitrary `per_page`-sized page of the default listing
    // and hoping the requested ids happen to land in it — with a small
    // limit (bundle/shop-the-look/featured's 1-3) they almost never did,
    // silently dropping hand-picked products from the storefront.
    if (options.ids && options.ids.length > 0) query.ids = options.ids;

    const response = await client.get<ApiResponse<unknown, ProductListMeta>>('/products', withLocaleQuery(query, locale));
    resolvedProducts = extractProducts(response.data).map((p) => normalizeProduct(p));
  }

  let next = resolvedProducts;

  if (options.collection && options.ids && options.ids.length > 0) {
    // The collection endpoint has no ids filter of its own — this branch
    // fetches the full collection unbounded, so a client-side filter here
    // is safe (nothing was truncated before it ran).
    next = next.filter((product) => options.ids?.includes(product.id));
  }

  if (typeof options.limit === 'number') {
    next = next.slice(0, options.limit);
  }

  return next;
}
