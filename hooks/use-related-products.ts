'use client';

import { useEffect, useState } from 'react';
import { useStorefront, useStorefrontLocale } from '../provider';
import type { Product } from '../types/product';
import type { ApiResponse } from '../types/product';
import { createBrowserClient } from '../sdk/client';
import { withLocaleQuery } from '../utils/locale';
import { extractProducts, normalizeProduct } from '../utils/product-normalizer';
import { toError } from '../utils/to-error';

/**
 * Products related to the one being viewed (up to `limit`, default 4). The
 * list stays empty when the request fails; `error` tells you why, and a theme
 * can simply hide the section.
 *
 * @example
 * const { products } = useRelatedProducts(product.slug, 4);
 */
export function useRelatedProducts(
  currentSlug: string,
  limit = 4,
): { products: Product[]; isLoading: boolean; error: Error | null } {
  const { vendor, previewData } = useStorefront();
  const locale = useStorefrontLocale();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

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
        const response = await client.get<ApiResponse<unknown>>(
          `/products/${encodeURIComponent(currentSlug)}/related`,
          withLocaleQuery({ limit }, locale),
        );

        const raw = extractProducts(response.data);
        const normalized = raw
          .map((p) => normalizeProduct(p as Parameters<typeof normalizeProduct>[0]))
          .slice(0, limit);

        if (!cancelled) setProducts(normalized);
      } catch (caught) {
        // Non-critical: the section can hide itself. The failure is on `error`.
        if (!cancelled) setError(toError(caught));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void run();
    return () => { cancelled = true; };
  }, [currentSlug, limit, vendor.slug, previewData?.products, locale]);

  return { products, isLoading, error };
}
