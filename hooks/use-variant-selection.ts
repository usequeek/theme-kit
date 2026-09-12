'use client';

import { useCallback, useMemo, useState } from 'react';
import type { Product, ProductVariant } from '../types/product';
import { matchVariant, productRequiresVariant } from '../utils/match-variant';

export interface VariantSelection {
  /** Current option name → value map, seeded from a real variant. */
  selectedOptions: Record<string, string>;
  /** Pick one option value. Pass to a theme's own swatch/button markup. */
  selectOption: (optionName: string, value: string) => void;
  /** The variant the current selection resolves to, or null if none matches. */
  matchedVariant: ProductVariant | null;
  /**
   * THE ADD GATE. False while a variant-required product has no resolved
   * variant. Every add/buy button must include `!variantSatisfied` in its
   * disabled expression — a variant-required line with no variant fails the
   * cart save server-side.
   */
  variantSatisfied: boolean;
  activePrice: number;
  activeCompare: number;
  activeDiscount: number;
  activeInStock: boolean;
  activeHasDiscount: boolean;
}

/**
 * The option-selection state machine every theme's product page used to
 * hand-roll — six near-identical copies, all of which gated their add button
 * on stock and addons but never on a resolved variant.
 *
 * Two things it fixes that the copies got wrong:
 *
 * 1. It seeds from a real variant (first in-stock, else first) rather than
 *    from the first value of each option independently. On a sparse matrix —
 *    Red/S is not stocked but Red/M and Blue/S are — first-value-of-each
 *    produces a combination that matches nothing, so the page opened with an
 *    unresolvable selection.
 * 2. It exposes `variantSatisfied`, so a selection that resolves to nothing
 *    (mid-change, or that sparse seed) disables the add instead of sending a
 *    line the backend rejects.
 *
 * Themes keep their own option markup and call `selectOption` — core owns the
 * state, the theme owns the design.
 */
/**
 * The opening selection. Seeded from a variant that actually exists, so the
 * initial state is always resolvable — preferring one in stock, since opening
 * on a sold-out variant reads as "unavailable" for a product that is not.
 */
export function seedVariantOptions(product: Product): Record<string, string> {
  const variants = product.variants ?? [];
  const seed = variants.find((variant) => variant.inventory?.in_stock) ?? variants[0];
  if (seed) {
    return Object.fromEntries(seed.option_values.map((ov) => [ov.option_name, ov.value]));
  }

  // No variants (or none loaded yet): fall back to the first value of each
  // declared option so a picker still renders something selected.
  const initial: Record<string, string> = {};
  for (const option of product.options ?? []) {
    if (option.values.length > 0) initial[option.name] = option.values[0].value;
  }
  return initial;
}

/** Everything derived from a selection. Pure, so the rules are testable directly. */
export function resolveVariantState(
  product: Product,
  selectedOptions: Record<string, string>,
): Omit<VariantSelection, 'selectedOptions' | 'selectOption'> {
  const matchedVariant = matchVariant(product.variants ?? [], selectedOptions);
  const activePrice = matchedVariant?.pricing.sale_amount ?? product.pricing.sale_amount;
  const activeCompare = matchedVariant?.pricing.compare_at_amount ?? product.pricing.compare_at_amount;

  return {
    matchedVariant,
    variantSatisfied: !productRequiresVariant(product) || matchedVariant !== null,
    activePrice,
    activeCompare,
    activeDiscount: matchedVariant?.pricing.discount_percent ?? product.pricing.discount_percent,
    activeInStock: matchedVariant ? matchedVariant.inventory.in_stock : product.inventory.in_stock,
    activeHasDiscount: activeCompare > activePrice,
  };
}

export function useVariantSelection(product: Product): VariantSelection {
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>(() => seedVariantOptions(product));

  const selectOption = useCallback((optionName: string, value: string): void => {
    setSelectedOptions((previous) => ({ ...previous, [optionName]: value }));
  }, []);

  const derived = useMemo(() => resolveVariantState(product, selectedOptions), [product, selectedOptions]);

  return { selectedOptions, selectOption, ...derived };
}
