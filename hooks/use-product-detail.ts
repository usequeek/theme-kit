'use client';

import { useEffect, useState } from 'react';
import { getQueekClient } from '../sdk/queek-client';
import { withLocalePath } from '../utils/locale';
import { normalizeProduct } from '../utils/product-normalizer';
import { toError } from '../utils/to-error';
import type { Product, LegacyProductLike } from '../types/product';

interface UseProductDetailResult {
  /** `listProduct` until the full fetch resolves, then the fetched detail. Null if `listProduct` is null. */
  product: Product | null;
  /** True only while a fetch the caller should show a loading state for is in flight. */
  loadingDetail: boolean;
  /** The last detail request's failure, or null. `product` is still the list product then. */
  error: Error | null;
}

/**
 * Complete a product you already hold from a list. The list and collection
 * endpoints never return `addons`, `options` or `variants`; only the
 * single-product response has them. A quick-view or quick-add modal opened
 * from a product card must therefore fetch the full product before it can
 * show or select an add-on or option.
 *
 * `isOpen` gates the fetch, so a modal closed and reopened on another product
 * fetches again instead of showing stale detail. `product` is `listProduct`
 * until the full product arrives, and stays `listProduct` if the request fails
 * (see `error`).
 *
 * For a product you only know by slug, use `useProductBySlug`.
 *
 * @example
 * const { product, loadingDetail } = useProductDetail(card, isModalOpen, vendor.slug, useStorefrontLocale());
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
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!isOpen || !listProduct) {
      setFullProduct(null);
      setLoadingDetail(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setError(null);
    const needsDetail = listProduct.variants_count > 0 || listProduct.addons.length > 0;
    if (needsDetail) {
      setLoadingDetail(true);
    }

    const client = getQueekClient(vendorSlug ?? undefined);
    client
      .get<{ data?: LegacyProductLike } | LegacyProductLike>(withLocalePath(`/client/store/products/${encodeURIComponent(listProduct.slug)}`, locale))
      .then((res) => {
        if (cancelled) return;
        const raw = (res as { data?: LegacyProductLike })?.data ?? res;
        if (raw && typeof raw === 'object' && 'id' in raw) {
          setFullProduct(normalizeProduct(raw as LegacyProductLike));
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(toError(caught));
      })
      .finally(() => {
        if (!cancelled) setLoadingDetail(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, listProduct, vendorSlug, locale]);

  return { product: fullProduct ?? listProduct, loadingDetail, error };
}
