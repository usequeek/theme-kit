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

/**
 * The variant `p_id` a product link names (`?variant=1234`): a positive integer, else undefined. Takes what a
 * Next `searchParams` value is (`string | string[] | undefined`; the first of several wins), so a server page can
 * pass the raw param straight in and never has to trust it.
 */
export function parsePreferredVariantPId(raw: string | string[] | undefined | null): number | undefined {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== 'string' || !/^[1-9]\d{0,15}$/.test(value.trim())) return undefined;
  const parsed = Number(value.trim());
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

/**
 * The ACTIVE variant of `product` whose `p_id` is `preferredVariantPId`, even when sold out (the page must show the
 * linked variant and its availability); null for no preference, an unknown `p_id` or an inactive variant.
 */
export function findPreferredVariant(product: Product, preferredVariantPId: number | undefined): ProductVariant | null {
  if (preferredVariantPId === undefined) return null;
  return (product.variants ?? []).find((variant) => variant.p_id === preferredVariantPId && variant.is_active !== false) ?? null;
}
