import type { JSX, ReactNode } from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { StorefrontProvider } from '../../provider';
import { DefaultCartShell } from '../../components/cart/default-cart-shell';
import { CartPanelController } from '../../components/cart/cart-panel-controller';
import { useShopCart } from '../../hooks/use-shop-cart';
import { useCartStore } from '../../stores/cart-store';
import { useCartPanelStore } from '../../stores/cart-panel-store';
import type { CartItem } from '../../types/cart';

export const SHOP = 's1';

const line = (overrides: Partial<CartItem>): CartItem => ({
  id: 'p1',
  product_id: 'p1',
  shop_id: SHOP,
  title: 'Mug',
  image: null,
  unit_price: 5000,
  quantity: 1,
  addons: [],
  ...overrides,
});

/** The carts the 0.1.29 output is pinned on. */
export const CART_CASES: Record<string, { items: CartItem[]; currency: string; total: number; empty: boolean }> = {
  single: { items: [line({})], currency: 'NGN', total: 5000, empty: false },
  mixed: {
    items: [
      line({ id: 'p1', quantity: 2, unit_price: 5000 }),
      line({
        id: 'p2::v1-a1',
        product_id: 'p2',
        title: 'Shirt',
        unit_price: 12500.5,
        quantity: 3,
        variant_id: 'v1',
        variant_title: 'Blue',
        addons: [{ addon_id: 'a', item_id: 'a1', name: 'Gift wrap', price: 500 }],
      }),
      line({
        id: 'p3~p-aaaaaaaaaaaa',
        product_id: 'p3',
        title: 'Cup',
        unit_price: 1.25,
        quantity: 4,
        properties: { 'app.engraving.text': 'Ada' },
        property_labels: { 'app.engraving.text': 'Engraving text' },
      }),
    ],
    currency: 'NGN',
    total: 10000 + 37501.5 + 5,
    empty: false,
  },
  fractional: { items: [line({ unit_price: 1.25, quantity: 3 })], currency: 'KWD', total: 3.75, empty: false },
  empty: { items: [], currency: 'NGN', total: 0, empty: true },
};

const noop = (): void => {};

export function shopperTree(children: ReactNode): JSX.Element {
  return (
    <StorefrontProvider vendor={{ id: 's1', slug: 'demo', name: 'Demo', currency: 'NGN' } as never} config={{} as never} menus={[]}>
      {children}
    </StorefrontProvider>
  );
}

/** The cart page shell for a pinned case. `wrap` puts a seam provider (or nothing) around it. */
export function renderShell(
  name: keyof typeof CART_CASES | string,
  cases: typeof CART_CASES = CART_CASES,
  wrap: (children: ReactNode) => ReactNode = (children) => children,
): string {
  const c = cases[name];

  return renderToStaticMarkup(
    shopperTree(
      wrap(
        <DefaultCartShell items={c.items} currency={c.currency} total={c.total} empty={c.empty} onIncrease={noop} onDecrease={noop} onRemove={noop} />,
      ),
    ),
  );
}

/** What `CartPanelController` hands its render function and `useShopCart` returns, functions reduced to their type. */
export function renderHooks(wrap: (children: ReactNode) => ReactNode = (children) => children): { panel: Record<string, unknown>; shopCart: Record<string, unknown> } {
  useCartStore.setState({ items: CART_CASES.mixed.items });
  useCartPanelStore.setState({ isOpen: true });
  let panel: Record<string, unknown> = {};
  let shopCart: Record<string, unknown> = {};
  const describe = (value: Record<string, unknown>): Record<string, unknown> =>
    Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, typeof entry === 'function' ? 'function' : entry]));

  function Probe(): JSX.Element {
    shopCart = describe(useShopCart('s1') as unknown as Record<string, unknown>);

    return <></>;
  }

  // Client render: the store's server snapshot is its empty initial state, so SSR cannot show the lines.
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const root = createRoot(document.createElement('div'));
  act(() => {
    root.render(
    shopperTree(
      wrap(
        <>
          <Probe />
          <CartPanelController>
            {(props) => {
              panel = describe(props as unknown as Record<string, unknown>);

              return <></>;
            }}
          </CartPanelController>
        </>,
      ),
    ),
    );
  });
  act(() => root.unmount());

  return { panel, shopCart };
}
