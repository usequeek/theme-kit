// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '../types/product';

const toastSpy = vi.fn();
const addToCartSpy = vi.fn();

vi.mock('../stores/toast-store', () => ({ toast: (...args: unknown[]) => toastSpy(...args) }));
vi.mock('../apps/storefront-events', () => ({ trackStorefrontEvent: (...args: unknown[]) => addToCartSpy(...args) }));

import { makeItemId, useCartStore } from '../stores/cart-store';
import { useLineTextStore } from '../stores/line-text-store';

const CART_KEY = 'queek-storefront-cart';
const NBSP = String.fromCharCode(0xa0);
const BEL = String.fromCharCode(7);
const ZERO_WIDTH_SPACE = String.fromCharCode(0x200b);
const ZERO_WIDTH_JOINER = String.fromCharCode(0x200d);
const WORD_JOINER = String.fromCharCode(0x2060);
const BYTE_ORDER_MARK = String.fromCharCode(0xfeff);
const SOFT_HYPHEN = String.fromCharCode(0xad);
const TAG_LATIN_A = String.fromCodePoint(0xe0061);
const LEFT_TO_RIGHT_MARK = String.fromCharCode(0x200e);
const LINE_SEPARATOR = String.fromCharCode(0x2028);
const BIDI_OVERRIDE = String.fromCharCode(0x202e);

function product(over: Partial<Product> = {}): Product {
  return {
    id: 'p1',
    shop_id: 's1',
    title: 'Mug',
    slug: 'mug',
    pricing: { sale_amount: 1000 },
    media: { thumbnail: null, image: null },
    variants: [],
    variants_count: 0,
    ...over,
  } as unknown as Product;
}

const registerLineText = (...args: Parameters<ReturnType<typeof useLineTextStore.getState>['registerLineText']>) =>
  useLineTextStore.getState().registerLineText(...args);
const setLineText = (...args: Parameters<ReturnType<typeof useLineTextStore.getState>['setLineText']>) =>
  useLineTextStore.getState().setLineText(...args);
const clearLineText = (...args: Parameters<ReturnType<typeof useLineTextStore.getState>['clearLineText']>) =>
  useLineTextStore.getState().clearLineText(...args);

const ENGRAVING = { key: 'app.engraving.text', label: 'Engraving text', required: false, maxLength: 20 };

beforeEach(() => {
  toastSpy.mockClear();
  addToCartSpy.mockClear();
  useCartStore.setState({ items: [] });
  useLineTextStore.setState({ entries: {} });
  localStorage.clear();
});

describe('makeItemId', () => {
  it('golden ids unchanged', () => {
    // Recorded by running tag v0.1.25.
    expect(makeItemId('p1', [])).toBe('p1');
    expect(makeItemId('p1', [], 'v1')).toBe('p1::v1');
    expect(makeItemId('p1', [{ item_id: 'a' }, { item_id: 'b' }] as never)).toBe('p1-a,b');
    expect(makeItemId('p1', [{ item_id: 'b' }, { item_id: 'a' }] as never, 'v1')).toBe('p1::v1-a,b');
    expect(makeItemId('p1', [], null)).toBe('p1');
    expect(makeItemId('p1', [], undefined, {})).toBe('p1');
    expect(makeItemId('p1', [], undefined, { k: '' })).toBe('p1');
  });

  it('suffixes a non-blank property with 12 hex digits, independent of key order', () => {
    const id = makeItemId('p1', [], null, { b: 'two', a: 'one' });

    expect(id).toMatch(/^p1~p-[0-9a-f]{12}$/);
    expect(makeItemId('p1', [], null, { a: 'one', b: 'two' })).toBe(id);
    expect(makeItemId('p1', [], null, { a: 'one', b: 'three' })).not.toBe(id);
  });

  it('ignores blank and non-string values when hashing', () => {
    expect(makeItemId('p1', [], null, { a: 'x', b: '   ', c: 4 })).toBe(makeItemId('p1', [], null, { a: 'x' }));
  });
});

describe('addItemWithAddons with line text', () => {
  it('rehydrates a 0.1.25 cart', async () => {
    const plain = {
      id: 'p1', product_id: 'p1', shop_id: 's1', title: 'Mug', slug: 'mug', image: null,
      unit_price: 1000, quantity: 1, addons: [], variant_id: null, variant_title: null,
    };
    const claimed = {
      ...plain,
      id: 'p1~c-9f2a',
      quantity: 2,
      properties: { 'app.booking.slot': '2026-10-20T10:00', 'app.booking.claim': 'bearer-token' },
    };
    const persisted = [plain, claimed];

    localStorage.setItem(CART_KEY, JSON.stringify({ state: { items: persisted, currency: 'NGN' }, version: 0 }));
    await useCartStore.persist.rehydrate();

    expect(useCartStore.getState().items).toEqual(persisted);

    useCartStore.getState().addProduct(product());

    const items = useCartStore.getState().items;

    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({ ...plain, quantity: 2 });
    expect(items[1]).toEqual(claimed);
  });

  it('adds the line with properties and labels', () => {
    const cleanup = registerLineText('s1', 'p1', [
      { key: 'app.zeta.note', label: 'Note', required: false, maxLength: 20 },
      ENGRAVING,
    ]);

    setLineText('s1', 'p1', 'app.zeta.note', 'Gift');
    setLineText('s1', 'p1', ENGRAVING.key, 'Ada');
    useCartStore.getState().addProduct(product());

    const [line] = useCartStore.getState().items;

    expect(Object.keys(line.properties ?? {})).toEqual(['app.engraving.text', 'app.zeta.note']);
    expect(line.properties).toEqual({ 'app.engraving.text': 'Ada', 'app.zeta.note': 'Gift' });
    expect(line.property_labels).toEqual({ 'app.engraving.text': 'Engraving text', 'app.zeta.note': 'Note' });
    expect(line.id).toMatch(/^p1~p-[0-9a-f]{12}$/);
    cleanup();
  });

  it('same text merges, different text splits', () => {
    registerLineText('s1', 'p1', [ENGRAVING]);

    setLineText('s1', 'p1', ENGRAVING.key, 'Ada');
    useCartStore.getState().addProduct(product());
    useCartStore.getState().addProduct(product());

    expect(useCartStore.getState().items).toHaveLength(1);
    expect(useCartStore.getState().items[0].quantity).toBe(2);

    setLineText('s1', 'p1', ENGRAVING.key, 'Bola');
    useCartStore.getState().addProduct(product());

    const items = useCartStore.getState().items;

    expect(items).toHaveLength(2);
    expect(items[1].properties).toEqual({ [ENGRAVING.key]: 'Bola' });
    expect(items[1].id).not.toBe(items[0].id);
  });

  it.each([
    ['empty', ''],
    ['spaces', '   '],
    ['no-break spaces', `${NBSP}${NBSP}`],
    ['control characters only', `${BEL}${BEL}`],
    ['zero-width spaces only', `${ZERO_WIDTH_SPACE}${ZERO_WIDTH_SPACE}`],
    ['soft hyphens only', `${SOFT_HYPHEN}${SOFT_HYPHEN}`],
    ['tag characters only', `${TAG_LATIN_A}${TAG_LATIN_A}`],
    ['invisible format characters only', `${ZERO_WIDTH_JOINER}${WORD_JOINER}${BYTE_ORDER_MARK}${LEFT_TO_RIGHT_MARK}`],
    ['never typed', null],
  ])('required refusal writes nothing and announces nothing (%s)', (_name, typed) => {
    registerLineText('s1', 'p1', [{ ...ENGRAVING, required: true }]);

    if (typed !== null) {
      setLineText('s1', 'p1', ENGRAVING.key, typed);
    }

    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});

    useCartStore.getState().addProduct(product());

    expect(useCartStore.getState().items).toEqual([]);
    expect(toastSpy).toHaveBeenCalledTimes(1);
    expect(toastSpy).toHaveBeenCalledWith({ title: 'Add your Engraving text before adding to cart' });
    expect(addToCartSpy).not.toHaveBeenCalled();
    expect(errors).toHaveBeenCalledTimes(1);
    errors.mockRestore();
  });

  it('required refusal, then fill then add', () => {
    registerLineText('s1', 'p1', [{ ...ENGRAVING, required: true }]);

    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});

    useCartStore.getState().addProduct(product());
    errors.mockRestore();
    toastSpy.mockClear();

    setLineText('s1', 'p1', ENGRAVING.key, 'Ada');
    useCartStore.getState().addProduct(product());

    expect(useCartStore.getState().items).toHaveLength(1);
    expect(toastSpy).toHaveBeenCalledTimes(1);
    expect(toastSpy.mock.calls[0][0].title).toBe('Added to cart');
    expect(addToCartSpy).toHaveBeenCalledTimes(1);
  });

  it('never logs the typed value', () => {
    registerLineText('s1', 'p1', [
      { ...ENGRAVING, required: true },
      { key: 'app.engraving.other', label: 'Other', required: false, maxLength: 20 },
    ]);
    setLineText('s1', 'p1', 'app.engraving.other', 'secret-value');

    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});

    useCartStore.getState().addProduct(product());

    expect(JSON.stringify([...errors.mock.calls, ...toastSpy.mock.calls])).not.toContain('secret-value');
    errors.mockRestore();
  });

  it('optional blank adds a line with no properties key and the old id', () => {
    registerLineText('s1', 'p1', [ENGRAVING]);
    setLineText('s1', 'p1', ENGRAVING.key, '   ');
    useCartStore.getState().addProduct(product());

    const [line] = useCartStore.getState().items;

    expect(line.id).toBe('p1');
    expect('properties' in line).toBe(false);
    expect('property_labels' in line).toBe(false);
  });

  it('optional zero-width-only text adds a line with no properties key and the old id', () => {
    registerLineText('s1', 'p1', [ENGRAVING]);
    setLineText('s1', 'p1', ENGRAVING.key, `${ZERO_WIDTH_SPACE}${WORD_JOINER}`);
    useCartStore.getState().addProduct(product());

    const [line] = useCartStore.getState().items;

    expect(line.id).toBe('p1');
    expect('properties' in line).toBe(false);
    expect('property_labels' in line).toBe(false);
  });

  it('invisible leading characters followed by long text store nothing', () => {
    registerLineText('s1', 'p1', [{ ...ENGRAVING, maxLength: 5 }]);
    setLineText('s1', 'p1', ENGRAVING.key, `${ZERO_WIDTH_SPACE.repeat(6)}visible`);
    useCartStore.getState().addProduct(product());

    const [line] = useCartStore.getState().items;

    expect(line.id).toBe('p1');
    expect('properties' in line).toBe(false);
    expect('property_labels' in line).toBe(false);
  });

  it('keeps invisible characters inside non-blank text', () => {
    const family = `\u{1F468}${ZERO_WIDTH_JOINER}\u{1F469}${ZERO_WIDTH_JOINER}\u{1F467}`;

    registerLineText('s1', 'p1', [{ ...ENGRAVING, maxLength: 10 }]);
    setLineText('s1', 'p1', ENGRAVING.key, family);
    useCartStore.getState().addProduct(product());

    expect(useCartStore.getState().items[0].properties).toEqual({ [ENGRAVING.key]: family });
  });

  it('required filled adds', () => {
    registerLineText('s1', 'p1', [{ ...ENGRAVING, required: true }]);
    setLineText('s1', 'p1', ENGRAVING.key, 'Ada');
    useCartStore.getState().addItemWithAddons(product(), 2, []);

    expect(useCartStore.getState().items[0].quantity).toBe(2);
  });

  it('no registration is a no-op', () => {
    useCartStore.getState().addProduct(product());

    const [line] = useCartStore.getState().items;

    expect(line).toEqual({
      id: 'p1', product_id: 'p1', shop_id: 's1', title: 'Mug', slug: 'mug', image: null,
      unit_price: 1000, quantity: 1, addons: [], variant_id: null, variant_title: null,
    });
    expect(toastSpy).toHaveBeenCalledTimes(1);
    expect(addToCartSpy).toHaveBeenCalledTimes(1);
  });

  it('keeps the variant refusal ahead of the line text refusal', () => {
    registerLineText('s1', 'p1', [{ ...ENGRAVING, required: true }]);

    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});

    useCartStore.getState().addProduct(product({ variants_count: 2 }));
    errors.mockRestore();

    expect(toastSpy).toHaveBeenCalledTimes(1);
    expect(toastSpy.mock.calls[0][0].title).toBe('Select options');
  });

  it('keyed by shop and product', () => {
    registerLineText('s1', 'p1', [ENGRAVING]);
    registerLineText('s2', 'p1', [ENGRAVING]);
    setLineText('s1', 'p1', ENGRAVING.key, 'Ada');

    useCartStore.getState().addProduct(product({ id: 'p2', slug: 'other' }));
    useCartStore.getState().addProduct(product({ shop_id: 's2' }));
    useCartStore.getState().addProduct(product());

    const [otherProduct, otherShop, matching] = useCartStore.getState().items;

    expect('properties' in otherProduct).toBe(false);
    expect('properties' in otherShop).toBe(false);
    expect(matching.properties).toEqual({ [ENGRAVING.key]: 'Ada' });
  });

  it('sanitises on read', () => {
    registerLineText('s1', 'p1', [{ ...ENGRAVING, maxLength: 5 }]);
    setLineText('s1', 'p1', ENGRAVING.key, `  ${BEL}ab${LINE_SEPARATOR}c${BIDI_OVERRIDE}defgh  `);
    useCartStore.getState().addProduct(product());

    expect(useCartStore.getState().items[0].properties).toEqual({ [ENGRAVING.key]: 'abcde' });

    clearLineText('s1', 'p1');
    registerLineText('s1', 'p1', [{ ...ENGRAVING, maxLength: 3 }]);
    setLineText('s1', 'p1', ENGRAVING.key, 'a\u{1F600}\u{1F601}\u{1F602}z');
    useCartStore.getState().addProduct(product());

    expect(useCartStore.getState().items[1].properties).toEqual({ [ENGRAVING.key]: 'a\u{1F600}\u{1F601}' });
  });

  it('an add does not clear the typed values', () => {
    registerLineText('s1', 'p1', [ENGRAVING]);
    setLineText('s1', 'p1', ENGRAVING.key, 'Ada');
    useCartStore.getState().addProduct(product());
    useCartStore.getState().addProduct(product());

    expect(useCartStore.getState().items).toHaveLength(1);
    expect(useCartStore.getState().items[0].quantity).toBe(2);
  });

  it('property_labels is client-only', () => {
    // The kit exposes no payload builder: the stored line is all addItemWithAddons produces,
    // and neither store module can reach the network.
    for (const file of ['stores/cart-store.ts', 'stores/line-text-store.ts']) {
      const source = readFileSync(join(__dirname, '..', file), 'utf8');

      expect(source).not.toMatch(/\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|from '\.\.\/(sdk\/(client|queek-client|server-store-client)|api\/)/);
    }

    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    registerLineText('s1', 'p1', [ENGRAVING]);
    setLineText('s1', 'p1', ENGRAVING.key, 'Ada');
    useCartStore.getState().addProduct(product());

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(Object.keys(useCartStore.getState().items[0]).sort()).toEqual([
      'addons', 'id', 'image', 'product_id', 'properties', 'property_labels', 'quantity',
      'shop_id', 'slug', 'title', 'unit_price', 'variant_id', 'variant_title',
    ]);
    vi.unstubAllGlobals();
  });
});
