import type { CartItem } from '../types/cart';

/**
 * The id a shopping event carries for an item, and the ONE place that decides it.
 *
 * Ad-platform catalog feeds (TikTok, Meta, Google) list a product's variant under its
 * variant `p_id`, grouped by the product's `p_id` (`item_group_id`); a product without
 * variants is listed under its own `p_id`. A pixel event matches a catalog item only when
 * it sends that same id, so every event sends:
 *
 *   variant p_id  ->  product p_id  ->  the product's UUID
 *
 * The UUID is the last resort for a line that has no `p_id` anywhere (a cart saved before
 * the ids existed, an API answer that predates them). It matches no catalog item, which is
 * no worse than before p_ids. When that fallback is no longer needed, deleting the
 * `fallbackId` branch below is the whole cleanup.
 */
export interface CatalogItemRef {
  item_id: string;
  /**
   * True when `item_id` is a PRODUCT-group id (a product `p_id` standing for a product that
   * has variants, because no variant is known). Meta and TikTok match that against the
   * feed's `item_group_id` only when the event says `content_type: 'product_group'`.
   */
  is_group?: true;
}

export interface CatalogItemSource {
  variantPId?: unknown;
  productPId?: unknown;
  /** The item is a specific variant (chosen or bought), or belongs to a product that has variants. */
  hasVariant?: boolean;
  /** The product's UUID: the last resort. Never an order or cart line id. */
  fallbackId?: string | null;
}

/** A `p_id` as a number: a positive whole number (a number, or digits in a string). Anything else is null. */
export function toPId(value: unknown): number | null {
  const number = typeof value === 'string' && /^\d+$/.test(value.trim()) ? Number(value) : value;

  return typeof number === 'number' && Number.isSafeInteger(number) && number > 0 ? number : null;
}

export function catalogItemId(source: CatalogItemSource): CatalogItemRef {
  const variantPId = toPId(source.variantPId);

  if (variantPId !== null) {
    return { item_id: String(variantPId) };
  }

  const productPId = toPId(source.productPId);

  if (productPId !== null) {
    return source.hasVariant === true ? { item_id: String(productPId), is_group: true } : { item_id: String(productPId) };
  }

  return { item_id: source.fallbackId ?? '' };
}

/** The catalog id of a cart line (`CartItem`). */
export function catalogItemIdForCartLine(
  line: Pick<CartItem, 'product_id' | 'variant_id' | 'product_p_id' | 'variant_p_id'>,
): CatalogItemRef {
  return catalogItemId({
    variantPId: line.variant_p_id,
    productPId: line.product_p_id,
    hasVariant: typeof line.variant_id === 'string' && line.variant_id !== '',
    fallbackId: line.product_id,
  });
}
