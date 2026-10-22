'use client';

import { gtagPush } from './gtag';

/**
 * The one place a storefront announces a shopping event.
 *
 *   trackStorefrontEvent('product_added_to_cart', { currency, value, items });
 *
 * Code that emits an event never calls a provider SDK. Providers subscribe:
 * the Google Analytics subscriber is registered below, once, as soon as this
 * module loads; the host registers any other provider with `onStorefrontEvent`.
 *
 * The bus is synchronous. A subscriber that throws is isolated: the page and
 * the other subscribers carry on. With no `window` (server render) an event is
 * a no-op, so emitting is always safe.
 *
 * No customer field travels on the bus: product ids, names, prices, quantities,
 * value, currency, the order number and `paid` only.
 */

export interface StorefrontEventItem {
  item_id: string;
  item_name: string;
  price: number;
  quantity: number;
}

export interface StorefrontEventMap {
  product_viewed: { currency: string; value: number; items: StorefrontEventItem[] };
  /** Scrubbed by the bus before any subscriber sees it (see `scrubSearchTerm`). */
  search_submitted: { search_term: string };
  product_added_to_cart: { currency: string; value: number; items: StorefrontEventItem[] };
  checkout_started: { currency: string; value: number; num_items: number; items: StorefrontEventItem[] };
  checkout_completed: {
    /** The human order number, never the order UUID. */
    order_no: string;
    currency: string;
    /** The order's grand total (what the customer paid), tax and shipping included. */
    value: number;
    /** False for an order still awaiting online payment. */
    paid: boolean;
    items: StorefrontEventItem[];
    /** Tax and shipping amounts of the order, when known. GA4 takes them as separate parameters. */
    tax?: number;
    shipping?: number;
  };
}

export type StorefrontEventName = keyof StorefrontEventMap;

export type StorefrontEvent = {
  [K in StorefrontEventName]: { name: K; data: StorefrontEventMap[K] };
}[StorefrontEventName];

export type StorefrontEventHandler = (event: StorefrontEvent) => void;

const SEARCH_TERM_MAX_LENGTH = 100;
const SEARCH_TERM_MAX_DIGITS = 6;

/**
 * Cleans a shopper's search text before it can reach any provider. Returns
 * `null` when the event must be dropped entirely: empty, an `@` anywhere (an
 * email address), or 7 or more digits IN TOTAL anywhere in the text (a phone,
 * card or order number; "in total" rather than "consecutive" is the stricter
 * rule, so `0803 123 4567` and `08-03-12-34-567` are both dropped). The checks
 * run on the full trimmed text, then the result is capped at 100 characters.
 */
export function scrubSearchTerm(raw: unknown): string | null {
  if (typeof raw !== 'string') {
    return null;
  }

  const trimmed = raw.trim();

  if (trimmed === '' || trimmed.includes('@')) {
    return null;
  }

  if ((trimmed.match(/\p{Nd}/gu) ?? []).length > SEARCH_TERM_MAX_DIGITS) {
    return null;
  }

  const capped = Array.from(trimmed).slice(0, SEARCH_TERM_MAX_LENGTH).join('').trim();

  return capped === '' ? null : capped;
}

const handlers = new Set<StorefrontEventHandler>();

/** Subscribes to every storefront event. Returns the unsubscribe function. */
export function onStorefrontEvent(handler: StorefrontEventHandler): () => void {
  handlers.add(handler);

  return () => {
    handlers.delete(handler);
  };
}

export function trackStorefrontEvent<K extends StorefrontEventName>(name: K, data: StorefrontEventMap[K]): void {
  if (typeof window === 'undefined') {
    return;
  }

  let event = { name, data } as StorefrontEvent;

  if (event.name === 'search_submitted') {
    const term = scrubSearchTerm(event.data.search_term);

    if (term === null) {
      return;
    }

    event = { name: 'search_submitted', data: { search_term: term } };
  }

  for (const handler of [...handlers]) {
    try {
      handler(event);
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[storefront-events] a subscriber threw on', name, error);
      }
    }
  }
}

function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/**
 * Google Analytics 4. Not gated on consent here: Consent Mode (see
 * analytics.tsx) decides whether gtag.js transmits anything for a denied
 * visitor, so events are pushed unconditionally and Google's library filters.
 *
 * `purchase.value` follows Google's reference: the sum of price * quantity of
 * the items, excluding shipping and tax, which go in their own parameters.
 */
function googleAnalyticsSubscriber(event: StorefrontEvent): void {
  switch (event.name) {
    case 'product_viewed':
      gtagPush('event', 'view_item', { currency: event.data.currency, value: event.data.value, items: event.data.items });
      return;
    case 'search_submitted':
      gtagPush('event', 'search', { search_term: event.data.search_term });
      return;
    case 'product_added_to_cart':
      gtagPush('event', 'add_to_cart', { currency: event.data.currency, value: event.data.value, items: event.data.items });
      return;
    case 'checkout_started':
      gtagPush('event', 'begin_checkout', { currency: event.data.currency, value: event.data.value, items: event.data.items });
      return;
    case 'checkout_completed': {
      const { order_no, currency, items, tax, shipping } = event.data;

      gtagPush('event', 'purchase', {
        transaction_id: order_no,
        value: roundMoney(items.reduce((sum, item) => sum + item.price * item.quantity, 0)),
        currency,
        ...(typeof tax === 'number' && Number.isFinite(tax) ? { tax } : {}),
        ...(typeof shipping === 'number' && Number.isFinite(shipping) ? { shipping } : {}),
        items,
      });
    }
  }
}

let googleAnalyticsRegistered = false;

/** Idempotent; runs once at module load so GA is live whenever the bus is used. */
export function registerGoogleAnalyticsSubscriber(): void {
  if (googleAnalyticsRegistered) {
    return;
  }

  googleAnalyticsRegistered = true;
  handlers.add(googleAnalyticsSubscriber);
}

registerGoogleAnalyticsSubscriber();
