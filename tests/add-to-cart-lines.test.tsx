// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act } from 'react';
import type { JSX } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product, ProductVariant } from '../types/product';
import type { AddAppBlockLinesResult, AppBlockLine } from '../types/app-block';

const toastSpy = vi.fn();
const eventSpy = vi.fn();
const fetchSpy = vi.fn();

vi.mock('../stores/toast-store', () => ({ toast: (...args: unknown[]) => toastSpy(...args) }));
vi.mock('../apps/storefront-events', () => ({ trackStorefrontEvent: (...args: unknown[]) => eventSpy(...args) }));
vi.mock('../hooks/use-products', () => ({ fetchProductBySlug: (...args: unknown[]) => fetchSpy(...args) }));

import { StorefrontContext } from '../provider';
import { ApiRequestError } from '../sdk/client';
import { useCartStore } from '../stores/cart-store';
import { useLineTextStore } from '../stores/line-text-store';
import { CartServerPricingProvider } from '../hooks/use-cart-server-pricing';
import { APP_BLOCK_MAX_LINES, addAppBlockLines, useAddAppBlockLines } from '../hooks/use-add-app-block-lines';

const SHOP = 's1';

function variant(id: string, over: Partial<ProductVariant> = {}): ProductVariant {
  return {
    id,
    title: `Variant ${id}`,
    is_active: true,
    pricing: { sale_amount: 2500 },
    inventory: { in_stock: true },
    media: { thumbnail: null, image: null },
    option_values: [],
    ...over,
  } as unknown as ProductVariant;
}

function product(id: string, over: Partial<Product> = {}): Product {
  return {
    id,
    shop_id: SHOP,
    title: `Product ${id}`,
    slug: `slug-${id}`,
    status: 'active',
    pricing: { sale_amount: 1000 },
    media: { thumbnail: null, image: null },
    inventory: { in_stock: true },
    variants: [],
    variants_count: 0,
    addons: [],
    ...over,
  } as unknown as Product;
}

function line(id: string, over: Partial<AppBlockLine> = {}): AppBlockLine {
  return { product: 1, slug: `slug-${id}`, product_id: id, quantity: 1, ...over };
}

function catalogue(...products: Product[]): (slug: string) => Promise<Product | null> {
  return async (slug) => products.find((entry) => entry.slug === slug) ?? null;
}

const run = (lines: AppBlockLine[], loadProduct: (slug: string) => Promise<Product | null>) =>
  addAppBlockLines(lines, { shopId: SHOP, loadProduct });

const items = () => useCartStore.getState().items;

beforeEach(() => {
  toastSpy.mockClear();
  eventSpy.mockClear();
  fetchSpy.mockReset();
  useCartStore.setState({ items: [] });
  useLineTextStore.setState({ entries: {} });
  localStorage.clear();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('addAppBlockLines outcomes', () => {
  it('adds a plain product silently at the store price', async () => {
    const result = await run([line('a', { quantity: 3 })], catalogue(product('a')));

    expect(result).toEqual({
      added: 1,
      complete: true,
      propertiesDropped: false,
      outcomes: [{ index: 0, status: 'added', product_id: 'a', variant_id: null, title: 'Product a' }],
    });
    expect(items()).toHaveLength(1);
    expect(items()[0]).toMatchObject({ product_id: 'a', quantity: 3, unit_price: 1000, variant_id: null });
    expect(toastSpy).not.toHaveBeenCalled();
    expect(eventSpy).toHaveBeenCalledTimes(1);
  });

  it('adds a variant product with its valid variant at the variant price', async () => {
    const v = product('v', { variants_count: 1, variants: [variant('v1')] });
    const result = await run([line('v', { variant: 11, variant_id: 'v1' })], catalogue(v));

    expect(result.outcomes[0]).toMatchObject({ status: 'added', variant_id: 'v1' });
    expect(items()[0]).toMatchObject({ product_id: 'v', variant_id: 'v1', unit_price: 2500 });
  });

  it('customise: any required add-on group adds nothing, a pack group included; an optional group adds', async () => {
    const group = { id: 'g', title: 'Size', min: 1, max: 1, required: true, multiple_selection: false, items: [] };
    const needs = product('c', { addons: [group] });
    const pack = product('k', { addons: [{ ...group, id: 'pk', is_pack_group: true }] });
    const optional = product('o', { addons: [{ ...group, id: 'op', required: false }] });

    const result = await run([line('c'), line('k'), line('o')], catalogue(needs, pack, optional));

    expect(result.outcomes.map((outcome) => outcome.status)).toEqual(['customise', 'customise', 'added']);
    expect(items().map((entry) => entry.product_id)).toEqual(['o']);
    expect(toastSpy).not.toHaveBeenCalled();
  });

  it('customise: a required line text field refuses the add with no toast', async () => {
    useLineTextStore.getState().registerLineText(SHOP, 't', [{ key: 'app.x.text', label: 'Text', required: true, maxLength: 20 }]);

    const result = await run([line('t')], catalogue(product('t')));

    expect(result.outcomes[0].status).toBe('customise');
    expect(items()).toEqual([]);
    expect(toastSpy).not.toHaveBeenCalled();
  });

  it('variant_required: a variant product without a variant adds nothing and announces nothing', async () => {
    const v = product('v', { variants_count: 2, variants: [variant('v1'), variant('v2')] });
    const result = await run([line('v')], catalogue(v));

    expect(result).toMatchObject({ added: 0, complete: false });
    expect(result.outcomes[0].status).toBe('variant_required');
    expect(items()).toEqual([]);
    expect(toastSpy).not.toHaveBeenCalled();
  });

  it.each([
    ['product gone', () => null],
    ['another store', () => product('a', { shop_id: 'other' })],
    ['a different product than the line named', () => product('zzz', { slug: 'slug-a' })],
    ['inactive', () => product('a', { status: 'inactive' })],
    ['out of stock', () => product('a', { inventory: { in_stock: false, tracking: true, quantity: 0 } })],
  ])('unavailable: %s', async (_name, make) => {
    const found = make();
    const result = await run([line('a')], async () => found);

    expect(result.outcomes[0].status).toBe('unavailable');
    expect(items()).toEqual([]);
  });

  it.each([
    ['unknown variant', { variant_id: 'nope' }, [variant('v1')]],
    ['inactive variant', { variant_id: 'v1' }, [variant('v1', { is_active: false })]],
    ['out of stock variant', { variant_id: 'v1' }, [variant('v1', { inventory: { in_stock: false, tracking: true, quantity: 0 } })]],
  ])('unavailable: %s', async (_name, over, variants) => {
    const v = product('v', { variants_count: variants.length, variants });
    const result = await run([line('v', over)], catalogue(v));

    expect(result.outcomes[0].status).toBe('unavailable');
    expect(items()).toEqual([]);
  });

  it('unavailable: a tracked variant with fewer left than the quantity; enough, untracked and untracked-product stock add', async () => {
    const tracked = (quantity: number, tracking = true) =>
      product('v', { variants_count: 1, variants: [variant('v1', { inventory: { in_stock: true, tracking, quantity } })] });

    const short = await run([line('v', { variant_id: 'v1', quantity: 5 })], catalogue(tracked(2)));
    const exact = await run([line('v', { variant_id: 'v1', quantity: 2 })], catalogue(tracked(2)));
    const untracked = await run([line('v', { variant_id: 'v1', quantity: 5 })], catalogue(tracked(0, false)));
    const plainTracked = await run(
      [line('a', { quantity: 5 })],
      catalogue(product('a', { inventory: { in_stock: true, tracking: true, quantity: 2 } })),
    );

    expect(short.outcomes[0].status).toBe('unavailable');
    expect(exact.outcomes[0].status).toBe('added');
    expect(untracked.outcomes[0].status).toBe('added');
    expect(plainTracked.outcomes[0].status).toBe('added');
    expect(items().map((entry) => [entry.product_id, entry.quantity])).toEqual([['v', 7], ['a', 5]]);
  });

  it('unavailable: a variant sent for a product without variants', async () => {
    const result = await run([line('a', { variant_id: 'v1' })], catalogue(product('a')));

    expect(result.outcomes[0].status).toBe('unavailable');
  });

  it('a 404 from the product read is unavailable; any other failure is failed', async () => {
    const gone = await run([line('a')], async () => {
      throw new ApiRequestError(404, '/api/v1/client/store/products/slug-a');
    });
    const broken = await run([line('a')], async () => {
      throw new ApiRequestError(500, '/api/v1/client/store/products/slug-a');
    });
    const offline = await run([line('a')], async () => {
      throw new TypeError('network');
    });

    expect(gone.outcomes[0].status).toBe('unavailable');
    expect(broken.outcomes[0].status).toBe('failed');
    expect(offline.outcomes[0].status).toBe('failed');
    expect(items()).toEqual([]);
  });

  it.each([[0], [21], [1.5], [-1]])('failed: a malformed quantity (%s) adds nothing and loads nothing', async (quantity) => {
    const load = vi.fn(catalogue(product('a')));
    const result = await run([line('a', { quantity })], load);

    expect(result.outcomes[0].status).toBe('failed');
    expect(load).not.toHaveBeenCalled();
    expect(items()).toEqual([]);
  });

  it('a mixed pack reports every line exactly and never reads as complete', async () => {
    const group = { id: 'g', title: 'Size', min: 1, max: 1, required: true, multiple_selection: false, items: [] };
    const v = product('v', { variants_count: 1, variants: [variant('v1')] });
    const loader = async (slug: string): Promise<Product | null> => {
      if (slug === 'slug-boom') {
        throw new TypeError('network');
      }

      return catalogue(product('a'), product('c', { addons: [group] }), v, product('ok', { inventory: { in_stock: false, tracking: true, quantity: 0 } }))(slug);
    };

    const result = await run(
      [line('a'), line('c'), line('v'), line('v', { variant_id: 'v1' }), line('ok'), line('missing'), line('boom'), line('a', { quantity: 2 })],
      loader,
    );

    expect(result.outcomes.map((outcome) => [outcome.index, outcome.status])).toEqual([
      [0, 'added'],
      [1, 'customise'],
      [2, 'variant_required'],
      [3, 'added'],
      [4, 'unavailable'],
      [5, 'unavailable'],
      [6, 'failed'],
      [7, 'added'],
    ]);
    expect(result.added).toBe(3);
    expect(result.complete).toBe(false);
    expect(items().find((entry) => entry.product_id === 'a')?.quantity).toBe(3);
    expect(toastSpy).not.toHaveBeenCalled();
  });

  it('tries 20 lines and refuses the 21st without reading it', async () => {
    const all = Array.from({ length: 21 }, (_, index) => product(`p${index}`));
    const load = vi.fn(catalogue(...all));
    const result = await run(all.map((entry) => line(entry.id)), load);

    expect(APP_BLOCK_MAX_LINES).toBe(20);
    expect(result.added).toBe(20);
    expect(result.complete).toBe(false);
    expect(result.outcomes[19].status).toBe('added');
    expect(result.outcomes[20]).toMatchObject({ index: 20, status: 'over_limit', product_id: 'p20' });
    expect(items()).toHaveLength(20);
    expect(load).not.toHaveBeenCalledWith('slug-p20');
  });

  it('zero lines adds nothing and is not complete', async () => {
    const load = vi.fn();

    expect(await run([], load)).toEqual({ added: 0, outcomes: [], complete: false, propertiesDropped: false });
    expect(load).not.toHaveBeenCalled();
  });

  it('reads a product once per press however many lines name it', async () => {
    const load = vi.fn(catalogue(product('a')));

    await run([line('a'), line('a', { quantity: 2 })], load);

    expect(load).toHaveBeenCalledTimes(1);
  });

  it('never writes line properties to the cart and says so, on the line and on the result', async () => {
    const result = await run([line('a', { properties: { 'app.pack.id': 'x' } })], catalogue(product('a')));

    expect(result.outcomes[0]).toMatchObject({ status: 'added', properties_dropped: true });
    expect(result.propertiesDropped).toBe(true);
    expect(items()[0].properties).toBeUndefined();
  });

  it('propertiesDropped is about added lines only', async () => {
    const group = { id: 'g', title: 'Size', min: 1, max: 1, required: true, multiple_selection: false, items: [] };
    const props = { 'app.pack.id': 'x' };
    const refused = await run([line('c', { properties: props }), line('a')], catalogue(product('c', { addons: [group] }), product('a')));
    const none = await run([line('a')], catalogue(product('a')));

    expect(refused.outcomes[0]).toMatchObject({ status: 'customise', properties_dropped: true });
    expect(refused.propertiesDropped).toBe(false);
    expect(none.propertiesDropped).toBe(false);
  });

  it('a null, non-object or missing entry is failed and never throws; the others still add', async () => {
    const lines = [null, line('a'), 'x', 5, undefined, [], line('b')] as unknown as AppBlockLine[];
    const result = await run(lines, catalogue(product('a'), product('b')));

    expect(result.outcomes.map((outcome) => outcome.status)).toEqual(['failed', 'added', 'failed', 'failed', 'failed', 'failed', 'added']);
    expect(result.added).toBe(2);
    expect(result.complete).toBe(false);
    expect(items().map((entry) => entry.product_id)).toEqual(['a', 'b']);
  });

  it('lines that are not an array adds nothing', async () => {
    expect(await run(null as unknown as AppBlockLine[], catalogue())).toEqual({ added: 0, outcomes: [], complete: false, propertiesDropped: false });
  });

  it('a throw while handling one line never loses the outcomes of the lines already added', async () => {
    const broken = product('x');
    Object.defineProperty(broken, 'addons', { get: () => { throw new TypeError('bad payload'); } });
    const noPrice = product('n', { pricing: undefined as never });

    const result = await run([line('a'), line('x'), line('n'), line('b')], catalogue(product('a'), broken, noPrice, product('b')));

    expect(result.outcomes.map((outcome) => outcome.status)).toEqual(['added', 'failed', 'failed', 'added']);
    expect(result).toMatchObject({ added: 2, complete: false });
    expect(items().map((entry) => entry.product_id)).toEqual(['a', 'b']);
  });

  it('a throw after the store wrote the line (the analytics event) still reports it added', async () => {
    eventSpy.mockImplementationOnce(() => { throw new Error('analytics down'); });

    const result = await run([line('a'), line('b'), line('c')], catalogue(product('a'), product('b'), product('c')));

    expect(result.outcomes.map((outcome) => outcome.status)).toEqual(['added', 'added', 'added']);
    expect(result).toMatchObject({ added: 3, complete: true });
    expect(items()).toHaveLength(3);
  });
});

describe('addItemWithAddons options', () => {
  it('toasts as before without the silent option and still returns the result', () => {
    const result = useCartStore.getState().addItemWithAddons(product('a'), 1, []);

    expect(result).toBe('added');
    expect(toastSpy).toHaveBeenCalledTimes(1);
    expect(toastSpy.mock.calls[0][0]).toMatchObject({ title: 'Added to cart' });
  });

  it('keeps its refusal toast without the silent option', () => {
    const v = product('v', { variants_count: 1, variants: [variant('v1')] });

    expect(useCartStore.getState().addItemWithAddons(v, 1, [])).toBe('variant_required');
    expect(toastSpy).toHaveBeenCalledTimes(1);
  });
});

describe('useAddAppBlockLines', () => {
  const ctx = {
    vendor: { id: 'v1', slug: 'demo-store', name: 'Demo' },
    config: {},
    menus: [],
    basePath: '',
    pagesChrome: {},
  };

  let api: ReturnType<typeof useAddAppBlockLines>;

  function Probe({ shopId }: { shopId: string }): JSX.Element {
    api = useAddAppBlockLines(shopId);

    return <span data-pending={String(api.pending)} />;
  }

  function mount(node: JSX.Element): { container: HTMLElement; unmount: () => void } {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => root.render(<StorefrontContext.Provider value={ctx as never}>{node}</StorefrontContext.Provider>));

    return { container, unmount: () => act(() => root.unmount()) };
  }

  it('renders on the server without touching the browser or the cart', () => {
    const html = renderToStaticMarkup(
      <StorefrontContext.Provider value={ctx as never}>
        <Probe shopId={SHOP} />
      </StorefrontContext.Provider>,
    );

    expect(html).toContain('data-pending="false"');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(items()).toEqual([]);
  });

  it('a double press while pending reads once, adds once and returns the same result', async () => {
    let release: (value: Product | null) => void = () => undefined;
    fetchSpy.mockImplementation(() => new Promise<Product | null>((resolve) => { release = resolve; }));
    const { container } = mount(<Probe shopId={SHOP} />);

    let first!: Promise<AddAppBlockLinesResult>;
    let second!: Promise<AddAppBlockLinesResult>;
    act(() => {
      first = api.addLines([line('a')]);
      second = api.addLines([line('a')]);
    });

    expect(second).toBe(first);
    expect(container.querySelector('span')?.getAttribute('data-pending')).toBe('true');

    await act(async () => {
      release(product('a'));
      await first;
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith('demo-store', 'slug-a', null);
    expect(items()).toHaveLength(1);
    expect(items()[0].quantity).toBe(1);
    expect(container.querySelector('span')?.getAttribute('data-pending')).toBe('false');
  });

  it('a different pack while the first is pending runs on its own; pending lasts until both finish', async () => {
    const releases: Record<string, (value: Product | null) => void> = {};
    fetchSpy.mockImplementation((_vendor: string, slug: string) => new Promise<Product | null>((resolve) => { releases[slug] = resolve; }));
    const { container } = mount(<Probe shopId={SHOP} />);
    const flag = () => container.querySelector('span')?.getAttribute('data-pending');

    let first!: Promise<AddAppBlockLinesResult>;
    let other!: Promise<AddAppBlockLinesResult>;
    let again!: Promise<AddAppBlockLinesResult>;
    act(() => {
      first = api.addLines([line('a')]);
      other = api.addLines([line('b')]);
      again = api.addLines([line('b')]);
    });

    expect(other).not.toBe(first);
    expect(again).toBe(other);
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    await act(async () => {
      releases['slug-a'](product('a'));
      await first;
    });
    expect(flag()).toBe('true');

    await act(async () => {
      releases['slug-b'](product('b'));
      await other;
    });

    expect(flag()).toBe('false');
    expect((await first).outcomes[0].status).toBe('added');
    expect((await other).outcomes[0].status).toBe('added');
    expect(items().map((entry) => [entry.product_id, entry.quantity])).toEqual([['a', 1], ['b', 1]]);
  });

  it('the same products in another quantity or order are another pack', async () => {
    fetchSpy.mockImplementation(async (_vendor: string, slug: string) => product(slug.replace('slug-', '')));
    mount(<Probe shopId={SHOP} />);

    let one!: Promise<AddAppBlockLinesResult>;
    let two!: Promise<AddAppBlockLinesResult>;
    let three!: Promise<AddAppBlockLinesResult>;
    act(() => {
      one = api.addLines([line('a'), line('b')]);
      two = api.addLines([line('a', { quantity: 2 }), line('b')]);
      three = api.addLines([line('b'), line('a')]);
    });
    await act(async () => { await Promise.all([one, two, three]); });

    expect(new Set([one, two, three]).size).toBe(3);
    expect(items().find((entry) => entry.product_id === 'a')?.quantity).toBe(4);
  });

  it('a later press after the first finished adds again', async () => {
    fetchSpy.mockResolvedValue(product('a'));
    mount(<Probe shopId={SHOP} />);

    await act(async () => { await api.addLines([line('a')]); });
    await act(async () => { await api.addLines([line('a')]); });

    expect(items()[0].quantity).toBe(2);
  });

  it('releases the press when the run throws', async () => {
    fetchSpy.mockRejectedValue(new TypeError('network'));
    mount(<Probe shopId={SHOP} />);

    let result!: AddAppBlockLinesResult;
    await act(async () => { result = await api.addLines([line('a')]); });
    fetchSpy.mockResolvedValue(product('a'));
    await act(async () => { await api.addLines([line('a')]); });

    expect(result.outcomes[0].status).toBe('failed');
    expect(items()).toHaveLength(1);
  });

  it('a line for another store is unavailable', async () => {
    fetchSpy.mockResolvedValue(product('a'));
    mount(<Probe shopId="someone-else" />);

    let result!: AddAppBlockLinesResult;
    await act(async () => { result = await api.addLines([line('a')]); });

    expect(result.outcomes[0].status).toBe('unavailable');
    expect(items()).toEqual([]);
  });

  it('is price neutral: a server pricing overlay changes nothing the line stores', async () => {
    fetchSpy.mockResolvedValue(product('a'));
    const overlay = { lines: [{ id: 'a', line_total: '1.00' }], total: '1.00' } as never;
    mount(
      <CartServerPricingProvider value={overlay}>
        <Probe shopId={SHOP} />
      </CartServerPricingProvider>,
    );

    await act(async () => { await api.addLines([line('a', { quantity: 2 })]); });

    expect(items()[0].unit_price).toBe(1000);
    expect(items()[0].quantity).toBe(2);
  });

  it('reads no pricing, offer or overlay module and prices nothing itself', () => {
    const source = readFileSync(join(__dirname, '..', 'hooks', 'use-add-app-block-lines.ts'), 'utf8');
    const imports = [...source.matchAll(/from '([^']+)'/g)].map((match) => match[1]);

    expect(imports.filter((path) => /pric|offer|shop-cart/.test(path))).toEqual([]);
    expect(source).not.toMatch(/unit_price|sale_amount|\.pricing/);
  });
});
