'use client';

import { useEffect, useState } from 'react';
import { useStorefront, useStorefrontLocale } from '../provider';
import { createBrowserClient } from '../sdk/client';
import { withLocaleQuery } from '../utils/locale';
import { toError } from '../utils/to-error';
import type { ImageVariants } from '../types/media';

export interface Category {
  id: string;
  slug: string;
  name: string;
  image?: string | null;
  /** The API's tier map for `image` (`/collections` sends it); null when the image is not Media-backed. */
  image_variants?: ImageVariants | null;
  products_count?: number;
  children?: Category[];
}

interface CategoriesResponse {
  data: Category[];
  message?: string;
}

/**
 * Flatten a nested category tree into a single list so `ids` filters
 * can resolve collections at any depth.
 */
function flattenCategories(items: Category[]): Category[] {
  const out: Category[] = [];
  const walk = (list: Category[]): void => {
    for (const item of list) {
      out.push(item);
      if (Array.isArray(item.children) && item.children.length > 0) {
        walk(item.children);
      }
    }
  };
  walk(items);
  return out;
}

/**
 * The store's categories (collections), flattened from any depth. Pass `ids`
 * to pick specific ones, kept in the order you gave; pass `limit` to cap the
 * count. On failure the list is empty and `error` is set; the hook never
 * throws.
 *
 * Without `ids` it asks for the store's storefront list (`storefront=1`), so it
 * follows the merchant's collections-page settings: an empty collection is left
 * out, like on `/shop`. With `ids` it asks for `include_empty=0` only, so a
 * hand-picked smart collection is never dropped by those settings.
 *
 * @example
 * const { categories } = useCategories({ limit: 6 });
 */
export function useCategories(options?: {
  ids?: string[];
  limit?: number;
}): {
  categories: Category[];
  isLoading: boolean;
  error: Error | null;
} {
  const { previewData, vendor } = useStorefront();
  const locale = useStorefrontLocale();
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const idsKey = options?.ids?.join(',') ?? '';
  const limit = options?.limit;

  useEffect(() => {
    let cancelled = false;
    const previewCategories = previewData?.categories;
    const client = createBrowserClient(vendor.slug ?? undefined);

    async function run(): Promise<void> {
      setIsLoading(true);
      setError(null);

      try {
        if (Array.isArray(previewCategories)) {
          let items = flattenCategories(previewCategories);

          if (idsKey) {
            const idSet = new Set(idsKey.split(','));
            // Preserve input order for deterministic display.
            const ordered = idsKey.split(',');
            const byId = new Map(items.filter((c) => idSet.has(c.id)).map((c) => [c.id, c]));
            items = ordered.map((id) => byId.get(id)).filter((c): c is Category => !!c);
          }

          if (!cancelled) {
            setCategories(typeof limit === 'number' ? items.slice(0, limit) : items);
            setIsLoading(false);
          }
          return;
        }

        // Pinned ids are filtered client-side and storefront=1 can switch the API to manual-only
        // collections, which would drop a hand-picked smart collection: hide empty ones only.
        const query: Record<string, string> = idsKey ? { include_empty: '0' } : { storefront: '1' };
        const response = await client.get<CategoriesResponse>('/collections', withLocaleQuery(query, locale));
        let items = flattenCategories(Array.isArray(response.data) ? response.data : []);

        // Filter by specific IDs if provided — preserving input order
        if (idsKey) {
          const idSet = new Set(idsKey.split(','));
          const ordered = idsKey.split(',');
          const byId = new Map(items.filter((c) => idSet.has(c.id)).map((c) => [c.id, c]));
          items = ordered.map((id) => byId.get(id)).filter((c): c is Category => !!c);
        }

        if (!cancelled) {
          setCategories(typeof limit === 'number' ? items.slice(0, limit) : items);
          setIsLoading(false);
        }
      } catch (caught) {
        if (!cancelled) {
          setCategories([]);
          setError(toError(caught));
          setIsLoading(false);
        }
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [idsKey, limit, previewData?.categories, vendor.slug, locale]);

  return { categories, isLoading, error };
}
