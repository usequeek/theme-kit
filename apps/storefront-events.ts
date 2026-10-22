'use client';

import { roundAmount } from '../utils/format';
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
 * value, currency, the order number and `paid` only. That is enforced at runtime,
 * not just in the types: every event is rebuilt from its known keys before any
 * subscriber sees it, so an extra key on the payload or on an item (line text,
 * an email, a phone) never reaches a subscriber or `dataLayer`.
 *
 * Register subscribers on the client (an effect, or client module load), never
 * in a server render body: on the server `onStorefrontEvent` is a no-op.
 */

export interface StorefrontEventItem {
  item_id: string;
  item_name: string;
  /** The unit price actually charged, after discounts. Providers sum price * quantity as revenue. */
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
    /** Items after discounts, excluding tax and shipping. GA4 `purchase.value` uses it
     *  when finite, otherwise the sum of price * quantity of `items`. */
    subtotal?: number;
    /** Tax and shipping amounts of the order, when known. GA4 takes them as separate parameters. */
    tax?: number;
    shipping?: number;
  };
}

export type StorefrontEventName = keyof StorefrontEventMap;

export type StorefrontEvent = {
  [K in StorefrontEventName]: { name: K; data: StorefrontEventMap[K] };
}[StorefrontEventName];

/** A handler may be async; a rejection is caught and logged like a throw. */
export type StorefrontEventHandler = (event: StorefrontEvent) => void | Promise<unknown>;

const SEARCH_TERM_MAX_LENGTH = 100;
const SEARCH_TERM_MAX_DIGITS = 6;

/**
 * Cleans a shopper's search text before it can reach any provider. Returns
 * `null` when the event must be dropped entirely: empty, an `@` (or `%40`)
 * anywhere (an email address), or 7 or more digits IN TOTAL anywhere in the
 * text (a phone, card or order number; "in total" rather than "consecutive" is
 * the stricter rule, so `0803 123 4567` and `08-03-12-34-567` are both dropped).
 * The text is NFKC-normalised first, so full-width `＠`, small `﹫`, superscript
 * and circled digits count as what they look like. The checks run on the full
 * trimmed text, then the result is capped at 100 characters.
 */
export function scrubSearchTerm(raw: unknown): string | null {
  if (typeof raw !== 'string') {
    return null;
  }

  const trimmed = raw.normalize('NFKC').trim();

  if (trimmed === '' || trimmed.includes('@') || /%40/i.test(trimmed)) {
    return null;
  }

  if ((trimmed.match(/\p{N}/gu) ?? []).length > SEARCH_TERM_MAX_DIGITS) {
    return null;
  }

  const capped = Array.from(trimmed).slice(0, SEARCH_TERM_MAX_LENGTH).join('').trim();

  return capped === '' ? null : capped;
}

const handlers = new Set<StorefrontEventHandler>();

/**
 * Subscribes to every storefront event. Returns the unsubscribe function.
 * Without a `window` (server render) nothing is stored and the unsubscribe is a no-op.
 */
export function onStorefrontEvent(handler: StorefrontEventHandler): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  handlers.add(handler);

  return () => {
    handlers.delete(handler);
  };
}

function normalizeItems(items: unknown): StorefrontEventItem[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.map((item: Partial<StorefrontEventItem> | null) => ({
    item_id: String(item?.item_id ?? ''),
    item_name: String(item?.item_name ?? ''),
    price: Number(item?.price),
    quantity: Number(item?.quantity),
  }));
}

/** Rebuilds an event from its known keys only, so nothing extra reaches a subscriber. */
function normalizeEvent<K extends StorefrontEventName>(name: K, data: StorefrontEventMap[K]): StorefrontEvent | null {
  const raw = (data ?? {}) as Record<string, unknown>;

  switch (name) {
    case 'search_submitted': {
      const term = scrubSearchTerm(raw.search_term);

      return term === null ? null : { name: 'search_submitted', data: { search_term: term } };
    }
    case 'product_viewed':
    case 'product_added_to_cart':
      return {
        name,
        data: {
          currency: String(raw.currency ?? ''),
          value: roundAmount(Number(raw.value)),
          items: normalizeItems(raw.items),
        },
      } as StorefrontEvent;
    case 'checkout_started':
      return {
        name: 'checkout_started',
        data: {
          currency: String(raw.currency ?? ''),
          value: roundAmount(Number(raw.value)),
          num_items: Number(raw.num_items),
          items: normalizeItems(raw.items),
        },
      };
    case 'checkout_completed': {
      const extras = (key: 'subtotal' | 'tax' | 'shipping'): Partial<Record<typeof key, number>> =>
        typeof raw[key] === 'number' ? { [key]: roundAmount(raw[key] as number) } : {};

      return {
        name: 'checkout_completed',
        data: {
          order_no: String(raw.order_no ?? ''),
          currency: String(raw.currency ?? ''),
          value: roundAmount(Number(raw.value)),
          paid: raw.paid === true,
          items: normalizeItems(raw.items),
          ...extras('subtotal'),
          ...extras('tax'),
          ...extras('shipping'),
        },
      };
    }
    default:
      return null;
  }
}

function logSubscriberError(name: string, error: unknown): void {
  if (process.env.NODE_ENV !== 'production') {
    console.error('[storefront-events] a subscriber threw on', name, error);
  }
}

export function trackStorefrontEvent<K extends StorefrontEventName>(name: K, data: StorefrontEventMap[K]): void {
  if (typeof window === 'undefined') {
    return;
  }

  const event = normalizeEvent(name, data);

  if (event === null) {
    return;
  }

  for (const handler of [...handlers]) {
    try {
      const result = handler(event);

      if (result && typeof (result as Promise<unknown>).catch === 'function') {
        (result as Promise<unknown>).catch((error: unknown) => logSubscriberError(name, error));
      }
    } catch (error) {
      logSubscriberError(name, error);
    }
  }
}

const finite = (value: number): boolean => Number.isFinite(value);

/** `{ value }` when it is a real number, nothing otherwise: GA gets no `NaN`. */
const valueParam = (value: number): { value: number } | Record<string, never> => (finite(value) ? { value } : {});

/**
 * Google Analytics 4. Not gated on consent here: Consent Mode (see
 * analytics.tsx) decides whether gtag.js transmits anything for a denied
 * visitor, so events are pushed unconditionally and Google's library filters.
 *
 * `purchase.value` follows Google's reference: the sum of price * quantity of
 * the items (after discounts), excluding shipping and tax, which go in their own
 * parameters. The event's `subtotal` is used when given; the payload `value`
 * (grand total) is never sent to GA as the purchase value.
 */
function googleAnalyticsSubscriber(event: StorefrontEvent): void {
  switch (event.name) {
    case 'product_viewed':
      gtagPush('event', 'view_item', { currency: event.data.currency, ...valueParam(event.data.value), items: event.data.items });
      return;
    case 'search_submitted':
      gtagPush('event', 'search', { search_term: event.data.search_term });
      return;
    case 'product_added_to_cart':
      gtagPush('event', 'add_to_cart', { currency: event.data.currency, ...valueParam(event.data.value), items: event.data.items });
      return;
    case 'checkout_started':
      gtagPush('event', 'begin_checkout', { currency: event.data.currency, ...valueParam(event.data.value), items: event.data.items });
      return;
    case 'checkout_completed': {
      const { order_no, currency, items, subtotal, tax, shipping } = event.data;
      const value =
        typeof subtotal === 'number' && finite(subtotal)
          ? subtotal
          : roundAmount(items.reduce((sum, item) => sum + item.price * item.quantity, 0));

      gtagPush('event', 'purchase', {
        transaction_id: order_no,
        ...valueParam(value),
        currency,
        ...(typeof tax === 'number' && finite(tax) ? { tax } : {}),
        ...(typeof shipping === 'number' && finite(shipping) ? { shipping } : {}),
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
