'use client';

import { gtagPush } from './gtag';

/**
 * Not gated on consent here — Consent Mode (see analytics.tsx) is what
 * decides whether gtag.js actually transmits anything for a denied visitor.
 * Callers push events unconditionally; Google's library filters them.
 */
interface GaItem {
  item_id: string;
  item_name: string;
  price: number;
  quantity?: number;
}

export function pushViewItem(item: GaItem, currency: string): void {
  gtagPush('event', 'view_item', { currency, value: item.price, items: [item] });
}

export function pushAddToCart(item: GaItem, currency: string): void {
  gtagPush('event', 'add_to_cart', { currency, value: item.price * (item.quantity ?? 1), items: [item] });
}

export function pushPurchase(args: { transactionId: string; value: number; currency: string; items: GaItem[] }): void {
  gtagPush('event', 'purchase', {
    transaction_id: args.transactionId,
    value: args.value,
    currency: args.currency,
    items: args.items,
  });
}
