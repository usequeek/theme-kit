'use client';

import { trackStorefrontEvent, type StorefrontEventItem } from './storefront-events';

/**
 * DEPRECATED. Thin wrappers over the storefront event bus (`./storefront-events`),
 * kept only because the storefront deployed today still imports `pushViewItem`
 * and `pushPurchase` from this path. They emit through the bus, so every
 * subscriber sees them; new code calls `trackStorefrontEvent` directly. Remove
 * once the storefront is on the bus.
 */
type LegacyItem = Omit<StorefrontEventItem, 'quantity'> & { quantity?: number };

export function pushViewItem(item: LegacyItem, currency: string): void {
  trackStorefrontEvent('product_viewed', {
    currency,
    value: item.price,
    items: [{ ...item, quantity: item.quantity ?? 1 }],
  });
}

/** Legacy callers only fire this for a placed order, so `paid` is true. */
export function pushPurchase(args: {
  transactionId: string;
  value: number;
  currency: string;
  items: LegacyItem[];
}): void {
  trackStorefrontEvent('checkout_completed', {
    order_no: args.transactionId,
    currency: args.currency,
    value: args.value,
    paid: true,
    items: args.items.map((item) => ({ ...item, quantity: item.quantity ?? 1 })),
  });
}
