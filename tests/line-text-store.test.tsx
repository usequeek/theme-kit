// @vitest-environment jsdom
import { useEffect } from 'react';
import type { JSX } from 'react';
import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../stores/toast-store', () => ({ toast: vi.fn() }));
vi.mock('../apps/analytics-events', () => ({ pushAddToCart: vi.fn() }));

import { StorefrontProvider } from '../provider';
import { DefaultCartShell } from '../components/cart/default-cart-shell';
import { useCartStore } from '../stores/cart-store';
import { LINE_TEXT_MAX_LENGTH, lineTextKey, readLineText, useLineTextStore } from '../stores/line-text-store';
import type { Product } from '../types/product';

const FIELD = { key: 'app.engraving.text', label: 'Engraving text', required: false, maxLength: 20 };
const api = () => useLineTextStore.getState();

function RegisteringHost(): JSX.Element {
  useEffect(() => api().registerLineText('s1', 'p1', [FIELD]), []);

  return <div />;
}

beforeEach(() => {
  useLineTextStore.setState({ entries: {} });
  useCartStore.setState({ items: [] });
  localStorage.clear();
});

describe('line text store', () => {
  it('ssr leaves the store empty', async () => {
    // A fresh import starts empty: nothing registers at module scope.
    vi.resetModules();

    const fresh = await import('../stores/line-text-store');

    expect(fresh.useLineTextStore.getState().entries).toEqual({});

    // Rendering on the server runs no effects, so no action touches the store.
    const changes = vi.fn();
    const unsubscribe = useLineTextStore.subscribe(changes);

    renderToString(<RegisteringHost />);
    renderToString(
      <StorefrontProvider vendor={{ id: 'v1', slug: 'demo', name: 'Demo' } as never} config={{} as never} menus={[]}>
        <DefaultCartShell
          items={[]}
          currency="NGN"
          total={0}
          empty
          onIncrease={() => {}}
          onDecrease={() => {}}
          onRemove={() => {}}
        />
      </StorefrontProvider>,
    );
    unsubscribe();

    expect(changes).not.toHaveBeenCalled();
    expect(api().entries).toEqual({});
  });

  it('an unregister of a replaced registration leaves the newer one in place', () => {
    const first = api().registerLineText('s1', 'p1', [FIELD]);

    api().setLineText('s1', 'p1', FIELD.key, 'Ada');

    const second = api().registerLineText('s1', 'p1', [FIELD, { ...FIELD, key: 'app.engraving.other' }]);

    first();

    expect(api().entries[lineTextKey('s1', 'p1')].fields.map((field) => field.key)).toEqual([
      FIELD.key,
      'app.engraving.other',
    ]);
    expect(readLineText('s1', 'p1').properties).toEqual({ [FIELD.key]: 'Ada' });

    second();

    expect(api().entries).toEqual({});
  });

  it('registers fields, keeps typed values across a re-register and drops them on cleanup', () => {
    const cleanup = api().registerLineText('s1', 'p1', [FIELD]);

    api().setLineText('s1', 'p1', FIELD.key, 'Ada');
    const again = api().registerLineText('s1', 'p1', [FIELD]);

    expect(readLineText('s1', 'p1').properties).toEqual({ [FIELD.key]: 'Ada' });

    cleanup();

    expect(readLineText('s1', 'p1').properties).toEqual({ [FIELD.key]: 'Ada' });

    again();

    expect(api().entries).toEqual({});
    expect(readLineText('s1', 'p1')).toEqual({ properties: {}, labels: {}, missingRequired: [] });
  });

  it('drops the typed value of a key that is no longer declared', () => {
    api().registerLineText('s1', 'p1', [FIELD]);
    api().setLineText('s1', 'p1', FIELD.key, 'Ada');
    api().registerLineText('s1', 'p1', [{ ...FIELD, key: 'app.engraving.other' }]);

    expect(api().entries[lineTextKey('s1', 'p1')].values).toEqual({});
  });

  it('ignores text for a key or product that was never registered', () => {
    api().setLineText('s1', 'p1', FIELD.key, 'Ada');
    api().registerLineText('s1', 'p1', [FIELD]);
    api().setLineText('s1', 'p1', 'app.other.key', 'x');

    expect(api().entries[lineTextKey('s1', 'p1')].values).toEqual({});
  });

  it('clear empties the values and keeps the fields', () => {
    api().registerLineText('s1', 'p1', [{ ...FIELD, required: true }]);
    api().setLineText('s1', 'p1', FIELD.key, 'Ada');
    api().clearLineText('s1', 'p1');

    const read = readLineText('s1', 'p1');

    expect(read.properties).toEqual({});
    expect(read.missingRequired.map((field) => field.key)).toEqual([FIELD.key]);
  });

  it('caps maxLength at the platform limit and defaults an unusable one', () => {
    api().registerLineText('s1', 'p1', [
      { ...FIELD, maxLength: 99999 },
      { ...FIELD, key: 'app.engraving.b', maxLength: 0 },
    ]);
    api().setLineText('s1', 'p1', FIELD.key, 'x'.repeat(LINE_TEXT_MAX_LENGTH + 50));
    api().setLineText('s1', 'p1', 'app.engraving.b', 'y'.repeat(300));

    const { properties } = readLineText('s1', 'p1');

    expect(properties[FIELD.key]).toHaveLength(LINE_TEXT_MAX_LENGTH);
    expect(properties['app.engraving.b']).toHaveLength(100);
  });

  it('only the cart is persisted', () => {
    api().registerLineText('s1', 'p1', [FIELD]);
    api().setLineText('s1', 'p1', FIELD.key, 'Ada');
    useCartStore.getState().addProduct({
      id: 'p1', shop_id: 's1', title: 'Mug', slug: 'mug', variants: [], variants_count: 0,
      pricing: { sale_amount: 1000 }, media: { thumbnail: null, image: null },
    } as unknown as Product);

    expect(Object.keys(localStorage)).toEqual(['queek-storefront-cart']);
  });
});
