'use client';

import { useEffect, useState } from 'react';
import { getQueekClient } from '../sdk/queek-client';
import { withLocalePath } from '../utils/locale';
import { normalizeProduct } from '../utils/product-normalizer';
import type { Product, LegacyProductLike } from '../types/product';

interface UseProductDetailResult {
  /** `listProduct` until the full fetch resolves, then the fetched detail. Null if `listProduct` is null. */
  product: Product | null;
  /** True only while a fetch the caller should show a loading state for is in flight. */
  loadingDetail: boolean;
}

/**
 * The product LIST/collection endpoint never returns `addons`, `options`, or
 * `variants` — those only exist on the single-product "view" response.
 * Any quick-view/quick-add modal opened from a product card only has the
 * list-shaped object, so it must re-fetch full detail before it can render
 * or select an addon/option — rendering `listProduct.addons` directly always
 * shows nothing, regardless of CSS or wiring.
 *
 * `isOpen` gates the fetch so a modal closed and reopened on a different
 * product re-fetches instead of showing stale detail.
 */
export function useProductDetail(
  listProduct: Product | null,
  isOpen: boolean,
  vendorSlug?: string | null,
  /**
   * Request locale for the detail read (pass `useStorefrontLocale()`).
   * Optional — absent/invalid fetches exactly as before. A separate
   * parameter (rather than provider context) because this hook deliberately
   * takes the vendor slug explicitly and must keep working outside a
   * provider.
   */
  locale?: string | null,
): UseProductDetailResult {
  const [fullProduct, setFullProduct] = useState<Product | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    if (!isOpen || !listProduct) {
      setFullProduct(null);
      setLoadingDetail(false);
      return;
    }

    let cancelled = false;
    const needsDetail = listProduct.variants_count > 0 || listProduct.addons.length > 0;
    if (needsDetail) {
      setLoadingDetail(true);
    }

    const client = getQueekClient(vendorSlug ?? undefined);
    client
      .get<{ data?: LegacyProductLike } | LegacyProductLike>(withLocalePath(`/client/store/products/${listProduct.slug}`, locale))
      .then((res) => {
        if (cancelled) return;
        const raw = (res as { data?: LegacyProductLike })?.data ?? res;
        if (raw && typeof raw === 'object' && 'id' in raw) {
          setFullProduct(normalizeProduct(raw as LegacyProductLike));
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingDetail(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, listProduct, vendorSlug, locale]);

  return { product: fullProduct ?? listProduct, loadingDetail };
}
