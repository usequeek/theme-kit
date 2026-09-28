'use client';

import { useEffect, useState } from 'react';
import { useStorefront } from '../provider';
import type { Product } from '../types/product';
import type { ApiResponse, LegacyProductLike, ProductListMeta } from '../types/product';
import { createBrowserClient } from '../sdk/client';
import { extractProducts, normalizeProduct } from '../utils/product-normalizer';

type ProductQuery = {
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

export function useProducts(options?: ProductQuery & {
  /** Backs the "video showcase" products variant. Deliberately incompatible
   *  with `collection` (that path calls a different, collection-scoped
   *  endpoint this filter isn't wired into) — has_video is ignored whenever
   *  collection is also set. */
  hasVideo?: boolean;
}): { products: Product[]; isLoading: boolean } {
  const { previewData, vendor } = useStorefront();
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

        let resolvedProducts: Product[];

        if (options?.collection) {
          const response = await client.get<ApiResponse<unknown>>(
            `/collections/${options.collection}/products`,
          );
          resolvedProducts = extractProducts(response.data).map((p) => normalizeProduct(p));
        } else {
          const query: Record<string, string | number | string[]> = {};
          if (options?.sort) query.sort = options.sort;
          if (options?.limit) query.per_page = options.limit;
          if (options?.hasVideo) query.has_video = 1;
          // Ask the backend for exactly these products (whereIn) instead of
          // fetching an arbitrary `per_page`-sized page of the default listing
          // and hoping the requested ids happen to land in it — with a small
          // limit (bundle/shop-the-look/featured's 1-3) they almost never did,
          // silently dropping hand-picked products from the storefront.
          if (options?.ids && options.ids.length > 0) query.ids = options.ids;

          const response = await client.get<ApiResponse<unknown, ProductListMeta>>('/products', query);
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
  }, [hasOptions, options?.collection, options?.ids, options?.limit, options?.sort, options?.hasVideo, previewData?.products, vendor.slug]);

  return { products, isLoading };
}

/**
 * Full product detail (the same `/products/{slug}` request the PDP itself
 * uses), including the full ordered detail `media.images` list — the
 * list/collection endpoints `useProducts` calls only ever return the capped
 * `media.images` list (`media.listing.images_limit`, config/media.php:15)
 * plus `media.{image,thumbnail}` (see
 * Customer\ProductResource::buildBaseMediaPayload vs buildDetailMediaPayload
 * in queek_backend). Single-product spotlight blocks (e.g. glow's `featured`
 * variant) need this instead of substituting image/thumbnail as a fake
 * 2-image list.
 */
/**
 * Fetch one product by SLUG.
 *
 * Distinct from `useProductDetail` in hooks/use-product-detail.ts, which
 * enriches a product you ALREADY hold from a list payload (that one takes the
 * list product, an enabled flag and a vendor slug). Both were called
 * `useProductDetail` until the public surface was written down and the clash
 * surfaced — same name, unrelated signatures, one import path apart.
 */
export function useProductBySlug(slug: string | null | undefined): { product: Product | null; isLoading: boolean } {
  const { previewData, vendor } = useStorefront();
  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(!!slug);

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
      try {
        const response = await client.get<ApiResponse<LegacyProductLike>>(`/products/${slug}`);
        const products = extractProducts(response.data);
        const payload = products[0] ?? response.data;
        if (!cancelled) {
          setProduct(payload ? normalizeProduct(payload as LegacyProductLike) : null);
        }
      } catch {
        if (!cancelled) {
          setProduct(null);
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
  }, [slug, previewData?.products, vendor.slug]);

  return { product, isLoading };
}
