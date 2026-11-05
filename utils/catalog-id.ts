import type { CartItem } from '../types/cart';

/**
 * The id a shopping event carries for an item, and the ONE place that decides it.
 *
 * THE CATALOG ID RULE (the ad-platform catalog feeds use the same one):
 *
 *   - a variant row is `"{product_p_id}_{variant_p_id}"`;
 *   - a product without variants is `"{product_p_id}"`;
 *   - the `product_group` id (the feed's `item_group_id`) is `"{product_p_id}"`.
 *
 * Products and variants number their `p_id`s from separate sequences that overlap (both
 * start at 1000), so a bare variant `p_id` could equal an unrelated product's: the id of
 * a variant is always the pair. A pixel event matches a catalog item only when it sends
 * that same id.
 *
 * Fallbacks, in order:
 *   - a variant `p_id` AND a product `p_id`            -> `"P_V"`;
 *   - only a product `p_id`                            -> `"P"` (flagged `is_group` when the
 *     item belongs to a product with variants, because then `"P"` names the group, not a row);
 *   - a variant `p_id` but NO product `p_id`           -> the UUID. A bare variant `p_id` is never sent;
 *   - no `p_id` at all                                 -> the product's UUID.
 *
 * The UUID is the last resort for a line that has no `p_id` (a cart saved before the ids
 * existed, an API answer that predates them). It matches no catalog item, which is no
 * worse than before p_ids. When that fallback is no longer needed, deleting the
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
  /** Needed for any p_id id: without it the item falls back to `fallbackId`. */
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
  const productPId = toPId(source.productPId);

  if (productPId === null) {
    // No product p_id: never a bare variant p_id (variant and product p_ids overlap), so the UUID.
    return { item_id: source.fallbackId ?? '' };
  }

  const variantPId = toPId(source.variantPId);

  if (variantPId !== null) {
    return { item_id: `${productPId}_${variantPId}` };
  }

  return source.hasVariant === true ? { item_id: String(productPId), is_group: true } : { item_id: String(productPId) };
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
