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

    api().setLineText('s1', 'p1', 'app.engraving.other', 'Bob');

    expect(readLineText('s1', 'p1').properties).toEqual({ [FIELD.key]: 'Ada', 'app.engraving.other': 'Bob' });

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
    api().registerLineText('s1', 'p1', [FIELD], 'engraving');
    api().setLineText('s1', 'p1', FIELD.key, 'Ada');
    api().registerLineText('s1', 'p1', [{ ...FIELD, key: 'app.engraving.other' }], 'engraving');

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

describe('several registrations for one product', () => {
  const OTHER = { key: 'app.gift.note', label: 'Gift note', required: false, maxLength: 20 };
  const mug = {
    id: 'p1', shop_id: 's1', title: 'Mug', slug: 'mug', variants: [], variants_count: 0,
    pricing: { sale_amount: 1000 }, media: { thumbnail: null, image: null },
  } as unknown as Product;

  it('keeps both owners enforced and puts both on the added line', () => {
    api().registerLineText('s1', 'p1', [{ ...FIELD, required: true }]);
    api().registerLineText('s1', 'p1', [{ ...OTHER, required: true }]);
    api().setLineText('s1', 'p1', FIELD.key, 'Ada');

    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});

    useCartStore.getState().addProduct(mug);

    expect(useCartStore.getState().items).toEqual([]);
    expect(readLineText('s1', 'p1').missingRequired.map((field) => field.key)).toEqual([OTHER.key]);

    api().setLineText('s1', 'p1', OTHER.key, '   ');
    useCartStore.getState().addProduct(mug);
    errors.mockRestore();

    expect(useCartStore.getState().items).toEqual([]);

    api().setLineText('s1', 'p1', OTHER.key, 'Happy birthday');
    useCartStore.getState().addProduct(mug);

    const [line] = useCartStore.getState().items;

    expect(line.properties).toEqual({ [OTHER.key]: 'Happy birthday', [FIELD.key]: 'Ada' });
    expect(line.property_labels).toEqual({ [OTHER.key]: 'Gift note', [FIELD.key]: 'Engraving text' });
    expect(Object.keys(line.properties ?? {})).toEqual([FIELD.key, OTHER.key]);
  });

  it('requires the first owner field when the second owner is the one filled', () => {
    api().registerLineText('s1', 'p1', [{ ...FIELD, required: true }]);
    api().registerLineText('s1', 'p1', [OTHER]);
    api().setLineText('s1', 'p1', OTHER.key, 'Note');

    expect(readLineText('s1', 'p1').missingRequired.map((field) => field.key)).toEqual([FIELD.key]);
  });

  it('first owner unmounting after the second registered keeps the second working and drops the first values', () => {
    const first = api().registerLineText('s1', 'p1', [FIELD]);
    const second = api().registerLineText('s1', 'p1', [{ ...OTHER, required: true }]);

    api().setLineText('s1', 'p1', FIELD.key, 'Ada');
    api().setLineText('s1', 'p1', OTHER.key, 'Note');
    first();

    expect(readLineText('s1', 'p1')).toEqual({
      properties: { [OTHER.key]: 'Note' },
      labels: { [OTHER.key]: 'Gift note' },
      missingRequired: [],
    });
    expect(api().entries[lineTextKey('s1', 'p1')].values).toEqual({ [OTHER.key]: 'Note' });

    api().setLineText('s1', 'p1', FIELD.key, 'ignored');
    api().setLineText('s1', 'p1', OTHER.key, '');

    expect(readLineText('s1', 'p1').missingRequired.map((field) => field.key)).toEqual([OTHER.key]);
    second();
    expect(api().entries).toEqual({});
  });

  it('second owner unmounting leaves the first working and drops the second values', () => {
    const first = api().registerLineText('s1', 'p1', [{ ...FIELD, required: true }]);
    const second = api().registerLineText('s1', 'p1', [OTHER]);

    api().setLineText('s1', 'p1', FIELD.key, 'Ada');
    api().setLineText('s1', 'p1', OTHER.key, 'Note');
    second();

    expect(readLineText('s1', 'p1').properties).toEqual({ [FIELD.key]: 'Ada' });
    expect(api().entries[lineTextKey('s1', 'p1')].values).toEqual({ [FIELD.key]: 'Ada' });

    api().clearLineText('s1', 'p1');

    expect(readLineText('s1', 'p1').missingRequired.map((field) => field.key)).toEqual([FIELD.key]);
    first();
    expect(api().entries).toEqual({});
  });

  it('the same key from two owners: the most recent declaration wins and the older unregister does not remove it', () => {
    const older = api().registerLineText('s1', 'p1', [{ ...FIELD, label: 'Old label', required: false }]);
    const newer = api().registerLineText('s1', 'p1', [{ ...FIELD, label: 'New label', required: true }]);

    api().setLineText('s1', 'p1', FIELD.key, 'Ada');

    expect(readLineText('s1', 'p1').labels).toEqual({ [FIELD.key]: 'New label' });

    older();

    expect(readLineText('s1', 'p1')).toEqual({
      properties: { [FIELD.key]: 'Ada' },
      labels: { [FIELD.key]: 'New label' },
      missingRequired: [],
    });

    api().clearLineText('s1', 'p1');

    expect(readLineText('s1', 'p1').missingRequired.map((field) => field.label)).toEqual(['New label']);
    newer();
    expect(api().entries).toEqual({});
  });

  it('the same owner registering again replaces only its own fields and keeps values for keys still declared', () => {
    api().registerLineText('s1', 'p1', [FIELD, { ...FIELD, key: 'app.engraving.extra' }], 'engraving');
    api().registerLineText('s1', 'p1', [OTHER], 'gift');
    api().setLineText('s1', 'p1', FIELD.key, 'Ada');
    api().setLineText('s1', 'p1', 'app.engraving.extra', 'Dropped');
    api().setLineText('s1', 'p1', OTHER.key, 'Note');
    api().registerLineText('s1', 'p1', [{ ...FIELD, label: 'Renamed' }], 'engraving');

    expect(readLineText('s1', 'p1')).toEqual({
      properties: { [FIELD.key]: 'Ada', [OTHER.key]: 'Note' },
      labels: { [FIELD.key]: 'Renamed', [OTHER.key]: 'Gift note' },
      missingRequired: [],
    });
    expect(api().entries[lineTextKey('s1', 'p1')].registrations).toHaveLength(2);
  });

  it('an add and clear keep every live registration', () => {
    api().registerLineText('s1', 'p1', [FIELD]);
    api().registerLineText('s1', 'p1', [{ ...OTHER, required: true }]);
    api().setLineText('s1', 'p1', OTHER.key, 'Note');
    useCartStore.getState().addProduct(mug);
    api().clearLineText('s1', 'p1');

    expect(api().entries[lineTextKey('s1', 'p1')].registrations).toHaveLength(2);
    expect(api().entries[lineTextKey('s1', 'p1')].values).toEqual({});
  });
});
