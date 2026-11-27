'use client';

import { useEffect, useState } from 'react';
import { useStorefront, useStorefrontLocale } from '../provider';
import type { Product } from '../types/product';
import type { ApiResponse } from '../types/product';
import { createBrowserClient } from '../sdk/client';
import { withLocaleQuery } from '../utils/locale';
import { extractProducts, normalizeProduct } from '../utils/product-normalizer';
import { toError } from '../utils/to-error';
import { fetchProductList, type ProductQuery } from './use-products';

/**
 * Products related to the one being viewed (up to `limit`, default 4). The
 * list stays empty when the request fails; `error` tells you why, and a theme
 * can simply hide the section.
 *
 * Pass `fallback` (a {@link ProductQuery}, e.g. `{ sort: 'popular', limit: 9 }`)
 * when the section should never be empty: it is read ONLY when the related list
 * comes back empty (or fails), so a product that has related items costs one
 * request, not two. The fallback list leaves out the viewed product and is cut
 * to `limit`. `isLoading` stays true until the list you will show has arrived,
 * and `usedFallback` says which list that is.
 *
 * @example
 * const { products } = useRelatedProducts(product.slug, 4);
 * const { products: rail } = useRelatedProducts(product.slug, 8, { fallback: { sort: 'popular', limit: 9 } });
 */
export function useRelatedProducts(
  currentSlug: string,
  limit = 4,
  options?: { fallback?: ProductQuery },
): { products: Product[]; isLoading: boolean; error: Error | null; usedFallback: boolean } {
  const { vendor, previewData } = useStorefront();
  const locale = useStorefrontLocale();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [usedFallback, setUsedFallback] = useState(false);
  // The fallback query as a plain string: a new object literal every render
  // must not re-run the reads.
  const fallbackKey = options?.fallback ? JSON.stringify(options.fallback) : '';

  useEffect(() => {
    let cancelled = false;

    async function run(): Promise<void> {
      setIsLoading(true);
      setError(null);
      try {
        if (previewData?.products) {
          const others = (previewData.products as Product[])
            .filter((p) => p.slug !== currentSlug)
            .slice(0, limit);
          if (!cancelled) setProducts(others);
          return;
        }

        const client = createBrowserClient(vendor.slug ?? undefined);
        let related: Product[] = [];
        let fromFallback = false;
        try {
          const response = await client.get<ApiResponse<unknown>>(
            `/products/${encodeURIComponent(currentSlug)}/related`,
            withLocaleQuery({ limit }, locale),
          );
          related = extractProducts(response.data)
            .map((p) => normalizeProduct(p as Parameters<typeof normalizeProduct>[0]))
            .slice(0, limit);
        } catch (caught) {
          // Non-critical: with a fallback the section is filled from it; either
          // way the failure stays on `error`.
          if (!fallbackKey) throw caught;
          if (!cancelled) setError(toError(caught));
        }

        if (related.length === 0 && fallbackKey) {
          const popular = await fetchProductList(client, JSON.parse(fallbackKey) as ProductQuery, locale);
          related = popular.filter((p) => p.slug !== currentSlug).slice(0, limit);
          fromFallback = true;
        }

        if (!cancelled) {
          setProducts(related);
          setUsedFallback(fromFallback);
        }
      } catch (caught) {
        // Non-critical: the section can hide itself. The failure is on `error`.
        if (!cancelled) setError(toError(caught));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void run();
    return () => { cancelled = true; };
  }, [currentSlug, limit, fallbackKey, vendor.slug, previewData?.products, locale]);

  return { products, isLoading, error, usedFallback };
}
