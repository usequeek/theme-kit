// @vitest-environment jsdom
import { act, type ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PreferredVariantProvider,
  seedVariantOptions,
  syncVariantParam,
  useVariantSelection,
  type VariantSelection,
} from '../hooks/use-variant-selection';
import { findPreferredVariant, parsePreferredVariantPId } from '../utils/match-variant';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function variant(pId: number, options: Record<string, string>, extra: { inStock?: boolean; active?: boolean; price?: number } = {}) {
  const price = extra.price ?? 5000;
  return {
    id: `v-${pId}`,
    p_id: pId,
    title: `v${pId}`,
    is_active: extra.active ?? true,
    pricing: { sale_amount: price, compare_at_amount: price, discount_percent: 0 },
    inventory: { in_stock: extra.inStock ?? true },
    media: {},
    option_values: Object.entries(options).map(([option_name, value]) => ({ option_name, value })),
  };
}

const product = {
  id: 'p1',
  p_id: 1000,
  pricing: { sale_amount: 4000, compare_at_amount: 4000, discount_percent: 0 },
  inventory: { in_stock: true },
  variants_count: 3,
  options: [{ name: 'Size', values: [{ value: 'S' }, { value: 'M' }, { value: 'L' }] }],
  variants: [
    variant(2001, { Size: 'S' }, { inStock: false, price: 1000 }),
    variant(2002, { Size: 'M' }, { price: 2000 }),
    variant(2003, { Size: 'L' }, { active: false, price: 3000 }),
  ],
} as never;

describe('seedVariantOptions with a preferred variant', () => {
  it('keeps today\'s rule (first in stock) without a preference', () => {
    expect(seedVariantOptions(product)).toEqual({ Size: 'M' });
  });

  it('opens on the linked variant even when it is sold out', () => {
    expect(seedVariantOptions(product, 2001)).toEqual({ Size: 'S' });
  });

  it('falls back to the default rule for an unknown or inactive variant', () => {
    expect(seedVariantOptions(product, 9999)).toEqual({ Size: 'M' });
    expect(seedVariantOptions(product, 2003)).toEqual({ Size: 'M' });
  });
});

describe('findPreferredVariant', () => {
  it('finds an active variant (sold out included) and nothing else', () => {
    expect(findPreferredVariant(product, 2001)?.id).toBe('v-2001');
    expect(findPreferredVariant(product, 2003)).toBeNull();
    expect(findPreferredVariant(product, 9999)).toBeNull();
    expect(findPreferredVariant(product, undefined)).toBeNull();
  });
});

describe('parsePreferredVariantPId', () => {
  it('reads a positive integer and nothing else', () => {
    expect(parsePreferredVariantPId('2002')).toBe(2002);
    expect(parsePreferredVariantPId(['2002', '9'])).toBe(2002);
    for (const bad of [undefined, null, '', '0', '-5', '12.5', '1e3', 'abc', '2002abc', '99999999999999999999']) {
      expect(parsePreferredVariantPId(bad as never)).toBeUndefined();
    }
  });
});

describe('useVariantSelection from a product link', () => {
  let seen: VariantSelection | null = null;
  function Probe({ pId, of = product }: { pId?: number; of?: never }): ReactNode {
    seen = useVariantSelection(of, pId);
    return <span>{seen.activePrice}</span>;
  }

  it('the first server render shows the linked variant price (provider, no theme change)', () => {
    expect(renderToString(<PreferredVariantProvider productPId={1000} variantPId={2001}><Probe /></PreferredVariantProvider>)).toContain('1000');
    expect(renderToString(<PreferredVariantProvider productPId={1000} variantPId={undefined}><Probe /></PreferredVariantProvider>)).toContain('2000');
  });

  it('an explicit argument beats the provider', () => {
    expect(renderToString(<PreferredVariantProvider productPId={1000} variantPId={2001}><Probe pId={2002} /></PreferredVariantProvider>)).toContain('2000');
  });

  describe('address bar', () => {
    let root: Root;
    let host: HTMLDivElement;
    beforeEach(() => {
      window.history.replaceState(null, '', '/products/shirt?variant=2001&utm=x');
      host = document.createElement('div');
      document.body.appendChild(host);
      root = createRoot(host);
    });
    afterEach(() => {
      act(() => root.unmount());
      host.remove();
    });

    it('opening the page leaves the URL alone; picking an option moves ?variant= and keeps other params', () => {
      act(() => root.render(<PreferredVariantProvider productPId={1000} variantPId={2001}><Probe /></PreferredVariantProvider>));
      expect(window.location.search).toBe('?variant=2001&utm=x');

      act(() => seen!.selectOption('Size', 'M'));
      const params = new URLSearchParams(window.location.search);
      expect(params.get('variant')).toBe('2002');
      expect(params.get('utm')).toBe('x');
      expect(window.location.pathname).toBe('/products/shirt');
    });

    it('writes the address bar with a null history state, so Next keeps its own router state in sync', () => {
      const spy = vi.spyOn(window.history, 'replaceState');
      act(() => root.render(<PreferredVariantProvider productPId={1000} variantPId={2001}><Probe /></PreferredVariantProvider>));
      act(() => seen!.selectOption('Size', 'M'));
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0]).toBeNull();
      spy.mockRestore();
    });

    it('a picker for ANOTHER product under the same page (quick view, inline buy box) neither opens on the link nor touches the URL', () => {
      const other = { ...(product as object), id: 'p2', p_id: 1001 } as never;
      window.history.replaceState(null, '', '/preview/glow/variant?variant=carousel');
      act(() => root.render(<PreferredVariantProvider productPId={1000} variantPId={2001}><Probe of={other} /></PreferredVariantProvider>));
      expect(seen!.activePrice).toBe(2000); // the default opening, not the linked 2001
      act(() => seen!.selectOption('Size', 'M'));
      act(() => seen!.selectOption('Size', 'S'));
      expect(window.location.search).toBe('?variant=carousel');
    });

    it('with no provider a picker never touches the URL, even given an explicit preferred variant', () => {
      act(() => root.render(<Probe pId={2001} />));
      act(() => seen!.selectOption('Size', 'M'));
      expect(new URLSearchParams(window.location.search).get('variant')).toBe('2001');
    });

    it('a selection with no variant (or one without a p_id) leaves the URL as it was', () => {
      act(() => root.render(<PreferredVariantProvider productPId={1000} variantPId={2001}><Probe /></PreferredVariantProvider>));
      act(() => seen!.selectOption('Size', 'XL'));
      expect(new URLSearchParams(window.location.search).get('variant')).toBe('2001');
      syncVariantParam(undefined);
      expect(new URLSearchParams(window.location.search).get('variant')).toBe('2001');
    });
  });
});
