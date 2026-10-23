'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useStorefront, useStorefrontLocale } from '../provider';
import { ApiRequestError } from '../sdk/client';
import { useCartStore } from '../stores/cart-store';
import type { Product, ProductVariant } from '../types/product';
import type { AddAppBlockLinesResult, AppBlockLine, AppBlockLineOutcome, AppBlockLineStatus } from '../types/app-block';
import { requiredAddonsSatisfied } from '../utils/addon-selection';
import { productRequiresVariant } from '../utils/match-variant';
import { fetchProductBySlug } from './use-products';

/** Lines one press may add; the platform read caps at the same number. */
export const APP_BLOCK_MAX_LINES = 20;

type LoadProduct = (slug: string) => Promise<Product | null>;

type Loaded = { product: Product | null } | { failed: true };

async function load(loadProduct: LoadProduct, slug: string): Promise<Loaded> {
  try {
    return { product: await loadProduct(slug) };
  } catch (caught) {
    // A product that is gone is "unavailable"; any other failure may pass on a retry.
    return caught instanceof ApiRequestError && caught.code === 'not_found' ? { product: null } : { failed: true };
  }
}

function validShape(line: AppBlockLine | null | undefined): line is AppBlockLine {
  return (
    typeof line === 'object' &&
    line !== null &&
    typeof line.slug === 'string' &&
    line.slug !== '' &&
    typeof line.product_id === 'string' &&
    Number.isInteger(line.quantity) &&
    line.quantity >= 1 &&
    line.quantity <= 20
  );
}

/** The variant a line names on a variant product, or the status that stops it. */
function resolveVariant(product: Product, line: AppBlockLine): ProductVariant | AppBlockLineStatus {
  if (!line.variant_id) {
    return 'variant_required';
  }

  const variant = product.variants?.find((entry) => entry.id === line.variant_id);

  if (!variant || !variant.is_active || variant.inventory?.in_stock === false) {
    return 'unavailable';
  }

  // The cart write refuses a tracked variant when the quantity exceeds its stock.
  // Whether the store enforces stock or lets a shortfall through is not in the
  // payload, so the kit takes the stricter reading.
  return variant.inventory?.tracking === true && line.quantity > (variant.inventory.quantity ?? 0) ? 'unavailable' : variant;
}

/**
 * Whether the server would turn the line away, judged from the product as read.
 * It mirrors the cart write, which adds nothing for a variant product without a
 * valid variant and for a product with a required add-on group. A pack group
 * counts too: the server composes its items, and delivery checkout rejects a
 * line without them, so a bare line is never added. The kit itself cannot see that write (the host app syncs the cart);
 * these are the cases it can know here.
 */
function classify(product: Product | null, line: AppBlockLine, shopId: string): ProductVariant | AppBlockLineStatus | null {
  if (!product || product.id !== line.product_id || product.shop_id !== shopId || product.status === 'inactive') {
    return 'unavailable';
  }

  if (productRequiresVariant(product)) {
    return resolveVariant(product, line);
  }

  if (line.variant_id || product.inventory?.in_stock === false) {
    return 'unavailable';
  }

  return requiredAddonsSatisfied(product.addons ?? [], new Set()) ? null : 'customise';
}

/**
 * Adds the lines of an add-to-cart app block through the cart store's own
 * `addItemWithAddons`, one line at a time and silently, and reports what
 * happened to each. `loadProduct` resolves a line's product by slug; a hook
 * wraps it for storefront use ({@link useAddAppBlockLines}).
 *
 * The first 20 lines are tried; the rest are `over_limit`. A line that cannot
 * be added is reported and the others are still added. The stored price of a
 * line is whatever the store computes for the product (or variant) alone: the
 * function never reads pricing, offers or anything an app sent beyond the
 * product, variant and quantity.
 */
export async function addAppBlockLines(
  lines: AppBlockLine[],
  { shopId, loadProduct }: { shopId: string; loadProduct: LoadProduct },
): Promise<AddAppBlockLinesResult> {
  const given: Array<AppBlockLine | null | undefined> = Array.isArray(lines) ? lines : [];
  const tried = given.slice(0, APP_BLOCK_MAX_LINES);
  const slugs = [...new Set(tried.filter(validShape).map((line) => line.slug))];
  const loaded = new Map<string, Loaded>();

  await Promise.all(slugs.map(async (slug) => loaded.set(slug, await load(loadProduct, slug))));

  const outcomes: AppBlockLineOutcome[] = given.map((line, index) => {
    const base = {
      index,
      product_id: typeof line?.product_id === 'string' ? line.product_id : '',
      variant_id: typeof line?.variant_id === 'string' ? line.variant_id : null,
      title: null as string | null,
      ...(line?.properties && typeof line.properties === 'object' && Object.keys(line.properties).length > 0 ? { properties_dropped: true as const } : {}),
    };

    if (index >= APP_BLOCK_MAX_LINES) {
      return { ...base, status: 'over_limit' };
    }

    if (!validShape(line)) {
      return { ...base, status: 'failed' };
    }

    try {
      return addOne(line, base, loaded.get(line.slug), shopId);
    } catch (caught) {
      // A throw before the store call leaves the cart as it was.
      console.error('[cart] an add-to-cart app block line failed:', caught);

      return { ...base, status: 'failed' };
    }
  });

  const added = outcomes.filter((outcome) => outcome.status === 'added').length;

  return {
    added,
    outcomes,
    complete: outcomes.length > 0 && added === outcomes.length,
    propertiesDropped: outcomes.some((outcome) => outcome.status === 'added' && outcome.properties_dropped === true),
  };
}

function shopUnits(shopId: string): number {
  return useCartStore.getState().items.reduce((sum, entry) => sum + (entry.shop_id === shopId ? entry.quantity : 0), 0);
}

function addOne(line: AppBlockLine, base: Omit<AppBlockLineOutcome, 'status'>, entry: Loaded | undefined, shopId: string): AppBlockLineOutcome {
  if (!entry || 'failed' in entry) {
    return { ...base, status: 'failed' };
  }

  const product = entry.product;
  const verdict = classify(product, line, shopId);
  const title = product?.title ?? null;

  if (typeof verdict === 'string') {
    return { ...base, title, status: verdict };
  }

  const before = shopUnits(shopId);
  let result: ReturnType<ReturnType<typeof useCartStore.getState>['addItemWithAddons']>;

  try {
    result = useCartStore.getState().addItemWithAddons(product as Product, line.quantity, [], verdict, { silent: true });
  } catch (caught) {
    // The store writes the line before it reports the add (the analytics event
    // comes last), so a throw is judged by what the cart holds, never guessed.
    console.error('[cart] the cart store threw while adding an app block line:', caught);

    return { ...base, title, status: shopUnits(shopId) >= before + line.quantity ? 'added' : 'failed' };
  }

  return { ...base, title, status: result === 'added' ? 'added' : result === 'variant_required' ? 'variant_required' : 'customise' };
}

/** What makes two presses the same pack: the same lines, in the same order. */
function pressSignature(lines: AppBlockLine[]): string {
  return JSON.stringify(
    (Array.isArray(lines) ? lines : []).map((line) =>
      typeof line === 'object' && line !== null ? [line.product_id, line.slug, line.variant_id ?? null, line.quantity] : null,
    ),
  );
}

/**
 * Puts the products of an add-to-cart app block into the shopper's cart through
 * the store's own add action: no app code runs, no app writes to the cart, and
 * no price is touched (each line is priced like the same product added from its
 * page). Call `addLines` from the press handler with `lines` from the block's
 * read, then print ONE notice from the result: "added" only when `complete` is
 * true, else name the lines that were not added from `outcomes` (`customise`
 * and `variant_required` mean the shopper must choose on the product page).
 *
 * `shopId` is the store's id (`product.shop_id`); a line whose product belongs
 * to another store is `unavailable`. While a press is pending, `pending` is
 * true and an `addLines` call with the same lines in the same order returns the
 * pending result and adds nothing, so a double click adds the pack once; a
 * different pack runs on its own. Disable the button on `pending` too.
 *
 * Limits: a line's `properties` are not written to the cart (the store has no
 * entry for them; the outcome says `properties_dropped` and the result
 * `propertiesDropped`), and the products are read fresh on every press.
 *
 * @example
 * const { addLines, pending } = useAddAppBlockLines(shopId);
 * const result = await addLines(read.lines);
 */
export function useAddAppBlockLines(shopId: string | null | undefined): {
  addLines: (lines: AppBlockLine[]) => Promise<AddAppBlockLinesResult>;
  pending: boolean;
} {
  const { previewData, vendor } = useStorefront();
  const locale = useStorefrontLocale();
  const [pending, setPending] = useState(false);
  const inFlight = useRef(new Map<string, Promise<AddAppBlockLinesResult>>());
  const mounted = useRef(true);
  const previewProducts = previewData?.products;
  const vendorSlug = vendor.slug;

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
    };
  }, []);

  const addLines = useCallback(
    (lines: AppBlockLine[]): Promise<AddAppBlockLinesResult> => {
      const signature = pressSignature(lines);
      const running = inFlight.current.get(signature);

      if (running) {
        return running;
      }

      const loadProduct: LoadProduct = async (slug) =>
        Array.isArray(previewProducts)
          ? (previewProducts.find((entry) => entry.slug === slug) ?? null)
          : fetchProductBySlug(vendorSlug, slug, locale);

      setPending(true);

      const run = addAppBlockLines(lines, { shopId: shopId ?? '', loadProduct }).finally(() => {
        inFlight.current.delete(signature);

        if (mounted.current) {
          setPending(inFlight.current.size > 0);
        }
      });

      inFlight.current.set(signature, run);

      return run;
    },
    [shopId, previewProducts, vendorSlug, locale],
  );

  return { addLines, pending };
}
