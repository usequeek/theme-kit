// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../stores/toast-store', () => ({ toast: vi.fn() }));

import { pushPurchase, pushViewItem } from '../apps/analytics-events';
import {
  onStorefrontEvent,
  registerGoogleAnalyticsSubscriber,
  scrubSearchTerm,
  trackStorefrontEvent,
  type StorefrontEvent,
} from '../apps/storefront-events';
import { useCartStore } from '../stores/cart-store';
import type { Product } from '../types/product';

const MUG = { item_id: 'p1', item_name: 'Mug', price: 1000, quantity: 2 };
const CAP = { item_id: 'p2', item_name: 'Cap', price: 500.5, quantity: 1 };

function dataLayer(): unknown[][] {
  return (window.dataLayer ?? []) as unknown[][];
}

beforeEach(() => {
  window.dataLayer = [];
});

describe('GA4 subscriber', () => {
  it('product_viewed -> view_item', () => {
    trackStorefrontEvent('product_viewed', { currency: 'NGN', value: 1000, items: [{ ...MUG, quantity: 1 }] });

    expect(dataLayer()).toEqual([
      ['event', 'view_item', { currency: 'NGN', value: 1000, items: [{ ...MUG, quantity: 1 }] }],
    ]);
  });

  it('search_submitted -> search', () => {
    trackStorefrontEvent('search_submitted', { search_term: '  red shoes ' });

    expect(dataLayer()).toEqual([['event', 'search', { search_term: 'red shoes' }]]);
  });

  it('product_added_to_cart -> add_to_cart', () => {
    trackStorefrontEvent('product_added_to_cart', { currency: 'NGN', value: 2000, items: [MUG] });

    expect(dataLayer()).toEqual([['event', 'add_to_cart', { currency: 'NGN', value: 2000, items: [MUG] }]]);
  });

  it('checkout_started -> begin_checkout (num_items is not a GA parameter)', () => {
    trackStorefrontEvent('checkout_started', { currency: 'NGN', value: 2500.5, num_items: 3, items: [MUG, CAP] });

    expect(dataLayer()).toEqual([
      ['event', 'begin_checkout', { currency: 'NGN', value: 2500.5, items: [MUG, CAP] }],
    ]);
  });

  it('checkout_completed -> purchase: value is the items sum, tax and shipping are separate', () => {
    trackStorefrontEvent('checkout_completed', {
      order_no: 'QK-1001',
      currency: 'NGN',
      value: 4000.5, // grand total incl. tax and shipping: must NOT be GA's value
      paid: true,
      items: [MUG, CAP],
      tax: 150,
      shipping: 1350,
    });

    expect(dataLayer()).toEqual([
      [
        'event',
        'purchase',
        {
          transaction_id: 'QK-1001',
          value: 2500.5,
          currency: 'NGN',
          tax: 150,
          shipping: 1350,
          items: [MUG, CAP],
        },
      ],
    ]);
  });

  it('purchase omits tax and shipping when unknown and rounds the sum', () => {
    trackStorefrontEvent('checkout_completed', {
      order_no: 'QK-1002',
      currency: 'KES',
      value: 0.6,
      paid: false,
      items: [
        { item_id: 'a', item_name: 'A', price: 0.1, quantity: 3 },
        { item_id: 'b', item_name: 'B', price: 0.3, quantity: 1 },
      ],
    });

    expect(dataLayer()).toEqual([
      [
        'event',
        'purchase',
        {
          transaction_id: 'QK-1002',
          value: 0.6,
          currency: 'KES',
          items: [
            { item_id: 'a', item_name: 'A', price: 0.1, quantity: 3 },
            { item_id: 'b', item_name: 'B', price: 0.3, quantity: 1 },
          ],
        },
      ],
    ]);
  });

  it('registers once however often it is asked', () => {
    registerGoogleAnalyticsSubscriber();
    registerGoogleAnalyticsSubscriber();
    trackStorefrontEvent('search_submitted', { search_term: 'mug' });

    expect(dataLayer()).toHaveLength(1);
  });

  it('never pushes a customer field', () => {
    trackStorefrontEvent('product_viewed', { currency: 'NGN', value: 1, items: [MUG] });
    trackStorefrontEvent('checkout_started', { currency: 'NGN', value: 1, num_items: 1, items: [MUG] });
    trackStorefrontEvent('checkout_completed', {
      order_no: 'QK-1',
      currency: 'NGN',
      value: 1,
      paid: true,
      items: [MUG],
      tax: 1,
      shipping: 1,
    });

    const keys = new Set<string>();
    const walk = (node: unknown): void => {
      if (Array.isArray(node)) {
        node.forEach(walk);
      } else if (node && typeof node === 'object') {
        for (const [key, value] of Object.entries(node)) {
          keys.add(key);
          walk(value);
        }
      }
    };

    walk(dataLayer());

    for (const forbidden of ['email', 'phone', 'name', 'first_name', 'last_name', 'address', 'customer', 'user_data']) {
      expect(keys.has(forbidden)).toBe(false);
    }
  });
});

describe('the bus', () => {
  it('delivers {name, data} to subscribers and stops after unsubscribe', () => {
    const seen: StorefrontEvent[] = [];
    const off = onStorefrontEvent((event) => seen.push(event));

    trackStorefrontEvent('product_viewed', { currency: 'NGN', value: 1, items: [MUG] });
    off();
    trackStorefrontEvent('product_viewed', { currency: 'NGN', value: 2, items: [MUG] });

    expect(seen).toEqual([{ name: 'product_viewed', data: { currency: 'NGN', value: 1, items: [MUG] } }]);
  });

  it('a throwing subscriber breaks neither the caller nor the others', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const after = vi.fn();
    const offBad = onStorefrontEvent(() => {
      throw new Error('boom');
    });
    const offAfter = onStorefrontEvent(after);

    expect(() => trackStorefrontEvent('search_submitted', { search_term: 'mug' })).not.toThrow();
    expect(after).toHaveBeenCalledTimes(1);
    expect(dataLayer()).toHaveLength(1); // GA, registered first, also still ran

    offBad();
    offAfter();
    errors.mockRestore();
  });

  it('a subscriber may unsubscribe itself while an event is delivered', () => {
    const second = vi.fn();
    const off = onStorefrontEvent(() => off());
    const offSecond = onStorefrontEvent(second);

    trackStorefrontEvent('search_submitted', { search_term: 'mug' });

    expect(second).toHaveBeenCalledTimes(1);
    offSecond();
  });

  it('is a no-op without a window (server render)', async () => {
    vi.resetModules();
    vi.stubGlobal('window', undefined);
    const fresh = await import('../apps/storefront-events');
    const seen = vi.fn();
    fresh.onStorefrontEvent(seen);

    expect(() => fresh.trackStorefrontEvent('search_submitted', { search_term: 'mug' })).not.toThrow();
    expect(seen).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe('search_submitted scrub (inside the bus)', () => {
  const delivered = (term: string): string[] => {
    const seen: string[] = [];
    const off = onStorefrontEvent((event) => {
      if (event.name === 'search_submitted') {
        seen.push(event.data.search_term);
      }
    });

    trackStorefrontEvent('search_submitted', { search_term: term });
    off();

    return seen;
  };

  it('trims', () => {
    expect(delivered('  red shoes  ')).toEqual(['red shoes']);
  });

  it.each([
    ['an email', 'ada@example.com'],
    ['an @ anywhere', 'shoes @home'],
    ['a phone number', '08031234567'],
    ['a spaced phone number', '0803 123 4567'],
    ['digits split by words', 'a1b2c3d4e5f6g7'],
    ['7 digits exactly', '1234567'],
    ['empty', ''],
    ['whitespace only', '   '],
  ])('drops %s entirely (no subscriber, no GA push)', (_label, term) => {
    expect(delivered(term)).toEqual([]);
    expect(dataLayer()).toEqual([]);
  });

  it('keeps 6 digits (size 123456, a model number)', () => {
    expect(delivered('model 123456')).toEqual(['model 123456']);
  });

  it('caps at 100 characters', () => {
    const [kept] = delivered('a'.repeat(250));

    expect(kept).toHaveLength(100);
  });

  it('checks the whole text before capping, so cutting cannot hide an email', () => {
    expect(delivered('a'.repeat(99) + ' x@y.com')).toEqual([]);
  });

  it('does not cut a character in half at the cap', () => {
    const [kept] = delivered('😀'.repeat(150));

    expect(Array.from(kept)).toHaveLength(100);
  });

  it('scrubSearchTerm is exported and rejects non-strings', () => {
    expect(scrubSearchTerm('mug')).toBe('mug');
    expect(scrubSearchTerm(undefined)).toBeNull();
    expect(scrubSearchTerm(42)).toBeNull();
  });
});

describe('deprecated wrappers emit through the bus', () => {
  it('pushViewItem -> view_item with a quantity', () => {
    pushViewItem({ item_id: 'p1', item_name: 'Mug', price: 1000 }, 'NGN');

    expect(dataLayer()).toEqual([
      ['event', 'view_item', { currency: 'NGN', value: 1000, items: [{ item_id: 'p1', item_name: 'Mug', price: 1000, quantity: 1 }] }],
    ]);
  });

  it('pushPurchase -> purchase keyed on the order number', () => {
    pushPurchase({ transactionId: 'QK-9', value: 2000, currency: 'NGN', items: [{ item_id: 'p1', item_name: 'Mug', price: 1000, quantity: 2 }] });

    expect(dataLayer()).toEqual([
      ['event', 'purchase', { transaction_id: 'QK-9', value: 2000, currency: 'NGN', items: [{ item_id: 'p1', item_name: 'Mug', price: 1000, quantity: 2 }] }],
    ]);
  });
});

describe('cart store', () => {
  const product = {
    id: 'p1',
    shop_id: 's1',
    title: 'Mug',
    slug: 'mug',
    pricing: { sale_amount: 1000 },
    media: { thumbnail: null, image: null },
    variants: [],
    variants_count: 0,
  } as unknown as Product;

  beforeEach(() => {
    useCartStore.setState({ items: [], currency: 'NGN' });
  });

  it('an add emits exactly one product_added_to_cart (and one GA add_to_cart)', () => {
    const seen: StorefrontEvent[] = [];
    const off = onStorefrontEvent((event) => seen.push(event));

    useCartStore.getState().addItemWithAddons(product, 2, [{ id: 'a1', name: 'Gift wrap', price: 100 } as never]);
    off();

    expect(seen).toEqual([
      {
        name: 'product_added_to_cart',
        data: {
          currency: 'NGN',
          value: 2200,
          items: [{ item_id: 'p1', item_name: 'Mug', price: 1100, quantity: 2 }],
        },
      },
    ]);
    expect(dataLayer()).toEqual([
      ['event', 'add_to_cart', { currency: 'NGN', value: 2200, items: [{ item_id: 'p1', item_name: 'Mug', price: 1100, quantity: 2 }] }],
    ]);
  });
});
