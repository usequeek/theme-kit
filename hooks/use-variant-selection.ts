'use client';

import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Product, ProductVariant } from '../types/product';
import { findPreferredVariant, matchVariant, productRequiresVariant } from '../utils/match-variant';

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

interface LinkedVariantValue {
  /** The product page's `p_id`: only a picker for THIS product is the page's own picker. */
  productPId: number | undefined;
  variantPId: number | undefined;
}

const PreferredVariantContext = createContext<LinkedVariantValue | null>(null);

/**
 * Tells the product page's own `useVariantSelection` which variant the page was linked to (`?variant=`), without the
 * theme passing it down. A server product page reads the param, wraps the theme's product page in this with the
 * page's product `p_id`, and the first HTML render already shows that variant: no hydration mismatch, and a crawler
 * sees the linked variant's price. A theme that already calls `useVariantSelection(product)` needs no change.
 *
 * Only a picker for the page's own product (`product.p_id === productPId`) reads it or rewrites the address bar: a
 * quick-view modal or an inline buy box for another product, mounted under the same page, never does.
 */
export function PreferredVariantProvider({
  productPId,
  variantPId,
  children,
}: {
  productPId: number | undefined;
  variantPId: number | undefined;
  children: ReactNode;
}): ReactNode {
  const value = useMemo(() => ({ productPId, variantPId }), [productPId, variantPId]);
  return createElement(PreferredVariantContext.Provider, { value }, children);
}

/**
 * What the page link says about THIS product: the linked variant's `p_id` (undefined when the link names none) and
 * whether this picker is the page's own, which is the only one allowed to move `?variant=`. Outside a
 * `PreferredVariantProvider`, or for any other product, it is `{ variantPId: undefined, ownsAddressBar: false }`.
 */
export function useLinkedVariant(product: Product): { variantPId: number | undefined; ownsAddressBar: boolean } {
  const linked = useContext(PreferredVariantContext);
  const ownsAddressBar = linked !== null && product.p_id !== undefined && product.p_id === linked.productPId;
  return { variantPId: ownsAddressBar ? linked.variantPId : undefined, ownsAddressBar };
}

/**
 * The opening selection. Seeded from a variant that actually exists, so the
 * initial state is always resolvable.
 *
 * `preferredVariantPId` (a product link's `?variant=`) wins when `findPreferredVariant` finds it. An unknown or
 * inactive one falls back to the default rule: the first in-stock variant, since opening on a sold-out variant reads
 * as "unavailable" for a product that is not.
 */
export function seedVariantOptions(product: Product, preferredVariantPId?: number): Record<string, string> {
  const variants = product.variants ?? [];
  const preferred = findPreferredVariant(product, preferredVariantPId);
  const seed = preferred ?? variants.find((variant) => variant.inventory?.in_stock) ?? variants[0];
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

/**
 * Keeps the address bar's `?variant=` on the variant the shopper chose, so a copied link opens on it.
 * `replaceState`: no navigation, no scroll, no history entry. Silent where there is no window.
 */
export function syncVariantParam(variantPId: number | undefined): void {
  if (variantPId === undefined || typeof window === 'undefined') return;
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.get('variant') === String(variantPId)) return;
    url.searchParams.set('variant', String(variantPId));
    // `null` state, the pattern Next documents: Next's own entry state (`__NA`) would make it skip its router sync,
    // leaving `useSearchParams` stale and letting a later `router.refresh()` put the old `?variant=` back.
    window.history.replaceState(null, '', url);
  } catch {
    // A link in the address bar is a convenience; never break the page over it.
  }
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

/**
 * The option-selection state machine every theme's product page used to
 * hand-roll, and which gated the add button on stock and add-ons but never on a
 * resolved variant.
 *
 * It does things a hand-rolled version tends to get wrong:
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
 * 3. It opens on the variant a product link names (`?variant=<p_id>`, via `preferredVariantPId` or a
 *    `PreferredVariantProvider` above it) and, once the shopper picks another on the page's own product, moves the
 *    address bar's `?variant=` to the one they chose.
 *
 * Themes keep their own option markup and call `selectOption`: the kit owns the
 * state, the theme owns the design.
 *
 * @example
 * const { selectedOptions, selectOption, variantSatisfied, activePrice } = useVariantSelection(product);
 * <button disabled={!variantSatisfied || !activeInStock}>Add to cart</button>
 */
export function useVariantSelection(product: Product, preferredVariantPId?: number): VariantSelection {
  const link = useLinkedVariant(product);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>(() =>
    seedVariantOptions(product, preferredVariantPId ?? link.variantPId),
  );
  const chosenByShopper = useRef(false);

  const selectOption = useCallback((optionName: string, value: string): void => {
    chosenByShopper.current = true;
    setSelectedOptions((previous) => ({ ...previous, [optionName]: value }));
  }, []);

  const derived = useMemo(() => resolveVariantState(product, selectedOptions), [product, selectedOptions]);

  // Only a choice the shopper made, on the page's own product, rewrites the link: opening a page never adds a
  // param to its URL, and a modal or buy box for another product (or one outside the provider) never touches it.
  const matchedPId = derived.matchedVariant?.p_id;
  useEffect(() => {
    if (chosenByShopper.current && link.ownsAddressBar) syncVariantParam(matchedPId);
  }, [matchedPId, link.ownsAddressBar]);

  return { selectedOptions, selectOption, ...derived };
}
