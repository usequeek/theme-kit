import type { Product, ProductVariant } from '../types/product';

/**
 * Same `selectedOptions -> variant` matching every theme's product page
 * duplicates inline (see each theme's pages/product.tsx) — centralized here
 * so it's usable (and testable) outside a themed page, e.g. the quick-add page.
 */
export function matchVariant(
  variants: ProductVariant[],
  selectedOptions: Record<string, string>,
): ProductVariant | null {
  if (variants.length === 0) return null;

  return (
    variants.find((variant) =>
      variant.option_values.every((ov) => selectedOptions[ov.option_name] === ov.value),
    ) ?? null
  );
}

/**
 * True when a product cannot be added to a cart without a chosen variant.
 *
 * `variants_count` is checked alongside `variants` on purpose: a product from a
 * LIST payload carries the count but not the array (the array arrives with the
 * detail fetch), and a quick-add from a card must still be refused rather than
 * sending a variant-required line with no variant.
 */
export function productRequiresVariant(product: Product): boolean {
  return (product.variants?.length ?? 0) > 0 || (product.variants_count ?? 0) > 0;
}
