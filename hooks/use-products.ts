'use client';

import { useEffect, useState } from 'react';
import { useStorefront, useStorefrontLocale } from '../provider';
import type { Product } from '../types/product';
import type { ApiResponse, LegacyProductLike, ProductListMeta } from '../types/product';
import { createBrowserClient } from '../sdk/client';
import { withLocaleQuery } from '../utils/locale';
import { extractProducts, normalizeProduct } from '../utils/product-normalizer';
import { toError } from '../utils/to-error';

/** Filters for {@link useProducts}. */
export type ProductQuery = {
  collection?: string | null;
  ids?: string[];
  limit?: number;
  sort?: 'latest' | 'popular' | 'price_low' | 'price_high';
  hasVideo?: boolean;
};

function resolvePreviewProducts(products: Product[], options: ProductQuery): Product[] {
  let next = [...products];

  if (options.collection) {
    next = next.filter((product) => product.categories.some((category) => category.slug === options.collection));
  }

  if (options.ids && options.ids.length > 0) {
    next = next.filter((product) => options.ids?.includes(product.id));
  }

  if (options.hasVideo) {
    next = next.filter((product) => Boolean(product.media.video_url));
  }

  if (options.sort === 'popular') {
    next.sort((left, right) => right.review_summary.rating - left.review_summary.rating);
  } else if (options.sort === 'price_low') {
    next.sort((left, right) => left.pricing.sale_amount - right.pricing.sale_amount);
  } else if (options.sort === 'price_high') {
    next.sort((left, right) => right.pricing.sale_amount - left.pricing.sale_amount);
  }

  return typeof options.limit === 'number' ? next.slice(0, options.limit) : next;
}

/**
 * A list of the store's products, fetched in the browser (or filtered from the
 * seeded catalogue in preview).
 *
 * Pass `undefined` instead of an options object when the caller already holds
 * the products: the hook then does nothing and reports `isLoading: false`.
 * On failure the products already shown are kept and `error` is set; the hook
 * never throws.
 *
 * @example
 * const { products, isLoading, error } = useProducts({ collection: 'chairs', limit: 8, sort: 'popular' });
 * if (error) return <p>We could not load products. Try again.</p>;
 */
export function useProducts(options?: ProductQuery & {
  /** Backs the "video showcase" products variant. Deliberately incompatible
   *  with `collection` (that path calls a different, collection-scoped
   *  endpoint this filter isn't wired into) — has_video is ignored whenever
   *  collection is also set. */
  hasVideo?: boolean;
}): { products: Product[]; isLoading: boolean; error: Error | null } {
  const { previewData, vendor } = useStorefront();
  const locale = useStorefrontLocale();
  const [error, setError] = useState<Error | null>(null);
  const hasPreviewProducts = Array.isArray(previewData?.products);
  const [products, setProducts] = useState<Product[]>(() => (
    options && hasPreviewProducts ? resolvePreviewProducts(previewData.products!, options) : []
  ));
  const [isLoading, setIsLoading] = useState(() => !options || !hasPreviewProducts);
  // `undefined` is the caller's signal that it already has product data (e.g.
  // server-seeded via `hydrateProductBlocks`, or a theme block's own
  // `initialProducts`) and this hook has nothing to do — every call site in
  // the codebase passes `undefined` specifically to mean that. Read outside
  // the effect, as a plain boolean, so the effect keeps depending on
  // `options`' individual fields rather than the object itself (a new object
  // literal every render would otherwise re-run the fetch on every render).
  const hasOptions = options !== undefined;

  useEffect(() => {
    if (!hasOptions) {
      // Without this guard the hook fetched anyway and threw the result
      // away, wasting a request on every mount.
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    const previewProducts = previewData?.products;
    const client = createBrowserClient(vendor.slug ?? undefined);

    async function run(): Promise<void> {
      try {
        if (Array.isArray(previewProducts)) {
          if (!cancelled) {
            setProducts(resolvePreviewProducts(previewProducts, options!));
            setIsLoading(false);
          }
          return;
        }

        setIsLoading(true);
        setError(null);

        let resolvedProducts: Product[];

        if (options?.collection) {
          const response = await client.get<ApiResponse<unknown>>(
            `/collections/${encodeURIComponent(options.collection)}/products`,
            withLocaleQuery(undefined, locale),
          );
          resolvedProducts = extractProducts(response.data).map((p) => normalizeProduct(p));
        } else {
          const query: Record<string, string | number | string[]> = {};
          if (options?.sort) query.sort = options.sort;
          if (options?.limit) query.per_page = options.limit;
          if (options?.hasVideo) query.has_video = 1;
          // Ask the API for exactly these products (by id) instead of
          // fetching an arbitrary `per_page`-sized page of the default listing
          // and hoping the requested ids happen to land in it — with a small
          // limit (bundle/shop-the-look/featured's 1-3) they almost never did,
          // silently dropping hand-picked products from the storefront.
          if (options?.ids && options.ids.length > 0) query.ids = options.ids;

          const response = await client.get<ApiResponse<unknown, ProductListMeta>>('/products', withLocaleQuery(query, locale));
          resolvedProducts = extractProducts(response.data).map((p) => normalizeProduct(p));
        }

        let next = resolvedProducts;

        if (options?.collection && options?.ids && options.ids.length > 0) {
          // The collection endpoint has no ids filter of its own — this branch
          // fetches the full collection unbounded, so a client-side filter here
          // is safe (nothing was truncated before it ran).
          next = next.filter((product) => options.ids?.includes(product.id));
        }

        if (typeof options?.limit === 'number') {
          next = next.slice(0, options.limit);
        }

        if (!cancelled) {
          setProducts(next);
        }
      } catch (caught) {
        // Keep the products already on screen; surface the failure instead of
        // leaving an unhandled rejection.
        if (!cancelled) setError(toError(caught));
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [hasOptions, options?.collection, options?.ids, options?.limit, options?.sort, options?.hasVideo, previewData?.products, vendor.slug, locale]);

  return { products, isLoading, error };
}

/**
 * Fetch one product by slug: the same `/products/{slug}` request the product
 * page uses, including the full ordered `media.images` list. The list
 * endpoints behind {@link useProducts} return only a capped image list, so a
 * single-product spotlight block needs this hook instead.
 *
 * Different from `useProductDetail` (hooks/use-product-detail.ts), which
 * completes a product you already hold from a list. Pass `null` or
 * `undefined` to skip the request. `product` is null while loading, when the
 * product does not exist, and when the request failed (`error` tells the last
 * two apart).
 *
 * @example
 * const { product, isLoading, error } = useProductBySlug('oak-chair');
 */
export function useProductBySlug(slug: string | null | undefined): { product: Product | null; isLoading: boolean; error: Error | null } {
  const { previewData, vendor } = useStorefront();
  const locale = useStorefrontLocale();
  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(!!slug);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!slug) {
      setProduct(null);
      setIsLoading(false);
      return;
    }

    // Preview/demo data has no separate detail endpoint to call — the list
    // entry it already has is as good as it gets.
    const previewProducts = previewData?.products;
    if (Array.isArray(previewProducts)) {
      setProduct(previewProducts.find((p) => p.slug === slug) ?? null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    const client = createBrowserClient(vendor.slug ?? undefined);

    async function run(): Promise<void> {
      setIsLoading(true);
      setError(null);
      try {
        const response = await client.get<ApiResponse<LegacyProductLike>>(`/products/${encodeURIComponent(slug as string)}`, withLocaleQuery(undefined, locale));
        const products = extractProducts(response.data);
        const payload = products[0] ?? response.data;
        if (!cancelled) {
          setProduct(payload ? normalizeProduct(payload as LegacyProductLike) : null);
        }
      } catch (caught) {
        if (!cancelled) {
          setProduct(null);
          setError(toError(caught));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [slug, previewData?.products, vendor.slug, locale]);

  return { product, isLoading, error };
}
