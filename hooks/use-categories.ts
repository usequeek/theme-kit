'use client';

import { useEffect, useState } from 'react';
import { useStorefront, useStorefrontLocale } from '../provider';
import { createBrowserClient } from '../sdk/client';
import { withLocaleQuery } from '../utils/locale';

export interface Category {
  id: string;
  slug: string;
  name: string;
  image?: string | null;
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

export function useCategories(options?: {
  ids?: string[];
  limit?: number;
}): {
  categories: Category[];
  isLoading: boolean;
} {
  const { previewData, vendor } = useStorefront();
  const locale = useStorefrontLocale();
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const idsKey = options?.ids?.join(',') ?? '';
  const limit = options?.limit;

  useEffect(() => {
    let cancelled = false;
    const previewCategories = previewData?.categories;
    const client = createBrowserClient(vendor.slug ?? undefined);

    async function run(): Promise<void> {
      setIsLoading(true);

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

        const query: Record<string, string> = { include_empty: '1' };
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
      } catch {
        if (!cancelled) {
          setCategories([]);
          setIsLoading(false);
        }
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [idsKey, limit, previewData?.categories, vendor.slug, locale]);

  return { categories, isLoading };
}
