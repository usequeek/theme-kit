'use client';

import { useEffect, useState } from 'react';
import { useStorefront, useStorefrontLocale } from '../provider';
import type { Product, ApiResponse, LegacyProductLike } from '../types/product';
import { createBrowserClient } from '../sdk/client';
import { getActivePlatform } from '../sdk/platform';
import { localeCacheKeySegment, withLocaleQuery } from '../utils/locale';
import { normalizeProduct } from '../utils/product-normalizer';

export interface ProductSection {
  category_id: string;
  title: string;
  products: Product[];
  view_more?: boolean;
}

/** A collection referenced by a smart "rollup" tab's own collection_id rule
 * (see MenuGroupCollections) — its own product ids, ready to list with no
 * extra request. */
export interface MenuGroupItem {
  id: string;
  name: string;
  product_ids: string[];
}

/** A QR menu tab (Food/Drinks-style) — the vendor's own collection, resolved
 * server-side into its product ids directly. Two shapes: 'products' (a
 * manual collection, or a smart collection whose rule doesn't reference
 * other collections) lists its own products immediately; 'collections' (a
 * smart collection whose rule DOES reference other collections — a browsing
 * umbrella, not a product filter) offers those referenced collections as
 * tiles first. Every id here is already present in this same response's
 * flat product pool, so resolving a tap is a pure client-side lookup — see
 * VendorProductController::resolveQrTabGroups (queek_backend). */
export type MenuGroup =
  | { id: string; name: string; type: 'products'; product_ids: string[] }
  | { id: string; name: string; type: 'collections'; items: MenuGroupItem[] };

interface RawSection {
  title: string;
  category_id?: string;
  data: LegacyProductLike[];
  view_more?: boolean;
}

interface SectionsResult {
  sections: ProductSection[];
  groups: MenuGroup[];
}

const EMPTY_RESULT: SectionsResult = { sections: [], groups: [] };

const sectionsCache = new Map<string, SectionsResult>();
const inflightSections = new Map<string, Promise<SectionsResult>>();

export function useProductSections(): {
  sections: ProductSection[];
  groups: MenuGroup[];
  isLoading: boolean;
} {
  const { previewData, vendor } = useStorefront();
  const locale = useStorefrontLocale();
  // Cache per vendor AND platform — the grouped catalogue can differ between
  // storefront and instore_qr (the /qr page) — AND locale, so two locales
  // never share a client cache entry. The locale segment is appended only
  // when set, leaving no-locale keys exactly what they always were.
  const localeSegment = localeCacheKeySegment(locale);
  const cacheKey = localeSegment
    ? `${vendor.slug ?? ''}::${getActivePlatform()}::${localeSegment}`
    : `${vendor.slug ?? ''}::${getActivePlatform()}`;
  const [result, setResult] = useState<SectionsResult>(() => sectionsCache.get(cacheKey) ?? EMPTY_RESULT);
  const [isLoading, setIsLoading] = useState(!sectionsCache.has(cacheKey));

  useEffect(() => {
    let cancelled = false;
    const previewProducts = previewData?.products;

    if (Array.isArray(previewProducts)) {
      const grouped = new Map<string, ProductSection>();

      previewProducts.forEach((product) => {
        const primaryCategory = product.categories[0];
        const key = primaryCategory?.slug ?? '_all';
        const title = primaryCategory?.name ?? 'All Products';

        if (!grouped.has(key)) {
          grouped.set(key, {
            category_id: primaryCategory?.id ?? key,
            title,
            products: [],
          });
        }

        grouped.get(key)?.products.push(product);
      });

      if (!cancelled) {
        setResult({ sections: Array.from(grouped.values()), groups: [] });
        setIsLoading(false);
      }
      return;
    }

    if (sectionsCache.has(cacheKey)) {
      setResult(sectionsCache.get(cacheKey) ?? EMPTY_RESULT);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    // Deduplicate: reuse in-flight promise if another mount already started fetching.
    let promise = inflightSections.get(cacheKey);
    if (!promise) {
      const client = createBrowserClient(vendor.slug ?? undefined);
      promise = client
        .get<ApiResponse<unknown>>('/products', withLocaleQuery(undefined, locale))
        .then((response) => {
          const data = response.data;
          // instore_qr only — backend attaches this under meta.groups, never
          // inside `data` (see resolveQrTabGroups): sectioned/menu-mode `data`
          // is shared with the mobile app's response shape, so groups had to
          // land somewhere additive instead.
          const rawGroups = (response.meta as { groups?: MenuGroup[] } | undefined)?.groups;
          const groups = Array.isArray(rawGroups) ? rawGroups : [];

          if (!Array.isArray(data)) return { sections: [], groups };

          const first = data[0] as Record<string, unknown> | undefined;
          const isGrouped = first && Array.isArray(first.data) && typeof first.title === 'string';

          if (isGrouped) {
            const sections = (data as RawSection[]).map((group, idx) => ({
              category_id: group.category_id ?? `section-${idx}`,
              title: group.title,
              products: group.data.map((p) => normalizeProduct(p)),
              view_more: group.view_more ?? false,
            }));
            return { sections, groups };
          }

          const products = (data as LegacyProductLike[]).map((p) => normalizeProduct(p));
          return {
            sections: [{
              category_id: '_all',
              title: 'All Products',
              products,
            }],
            groups: [],
          };
        })
        .catch(() => EMPTY_RESULT)
        .finally(() => {
          inflightSections.delete(cacheKey);
        });
      inflightSections.set(cacheKey, promise);
    }

    promise.then((result) => {
      sectionsCache.set(cacheKey, result);
      if (!cancelled) {
        setResult(result);
        setIsLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, [previewData?.products, vendor.slug, cacheKey, locale]);

  return { sections: result.sections, groups: result.groups, isLoading };
}
