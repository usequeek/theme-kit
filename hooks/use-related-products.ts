'use client';

import { useEffect, useState } from 'react';
import { useStorefront } from '../provider';
import type { Product } from '../types/product';
import type { ApiResponse } from '../types/product';
import { createBrowserClient } from '../sdk/client';
import { extractProducts, normalizeProduct } from '../utils/product-normalizer';

export function useRelatedProducts(
  currentSlug: string,
  limit = 4,
): { products: Product[]; isLoading: boolean } {
  const { vendor, previewData } = useStorefront();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function run(): Promise<void> {
      setIsLoading(true);
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
          `/products/${currentSlug}/related`,
          { limit },
        );

        const raw = extractProducts(response.data);
        const normalized = raw
          .map((p) => normalizeProduct(p as Parameters<typeof normalizeProduct>[0]))
          .slice(0, limit);

        if (!cancelled) setProducts(normalized);
      } catch {
        // Non-critical — silently fail
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void run();
    return () => { cancelled = true; };
  }, [currentSlug, limit, vendor.slug, previewData?.products]);

  return { products, isLoading };
}
