import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { JSX, ReactNode } from 'react';
import { StorefrontProvider, useThemeStrings } from '../provider';
import { ThemeMount } from '../theme-mount';
import { DefaultCartShell } from '../components/cart/default-cart-shell';
import { defaultThemeStrings, t as translate, type ThemeStringsDictionary } from '../strings/theme-strings';
import type { CartItem } from '../types/cart';
import type { ThemeModule } from '../types/theme';

const FR_STRINGS: ThemeStringsDictionary = {
  cart: {
    title: 'Votre panier',
    empty: { message: 'Votre panier est vide.', browse: 'Voir les produits' },
    summary: { title: 'Résumé de commande' },
  },
};

function render(
  children: ReactNode,
  options?: { locale?: string | null; strings?: ThemeStringsDictionary | ThemeStringsDictionary[] | null },
): string {
  return renderToStaticMarkup(
    <StorefrontProvider
      vendor={{ id: 'v1', slug: 'kili-foods', name: 'Kili Foods' } as never}
      config={{} as never}
      menus={[]}
      {...(options?.locale !== undefined ? { locale: options.locale } : {})}
      {...(options?.strings !== undefined ? { strings: options.strings } : {})}
    >
      {children}
    </StorefrontProvider>,
  );
}

function Title(): JSX.Element {
  const t = useThemeStrings();
  return <h1>{t('cart.title')}</h1>;
}

describe('client surface: StorefrontProvider strings + useThemeStrings (decision 4b)', () => {
  it('renders the active locale through the hook', () => {
    expect(render(<Title />, { locale: 'fr', strings: FR_STRINGS })).toContain('<h1>Votre panier</h1>');
  });

  it('falls back per key to the English default VALUE', () => {
    // `cart.checkout.action` is absent from the FR pack: English value, never the key.
    function Action(): JSX.Element {
      const t = useThemeStrings();
      return <span>{t('cart.checkout.action')}</span>;
    }
    const html = render(<Action />, { locale: 'fr', strings: FR_STRINGS });
    expect(html).toContain('<span>Checkout</span>');
    expect(html).not.toContain('cart.checkout.action');
  });

  it('is a no-op when the prop is absent (backward compat: English as today)', () => {
    expect(render(<Title />)).toContain('<h1>Your cart</h1>');
  });

  it('matches explicit English defaults exactly (prop changes nothing when absent)', () => {
    const implicit = render(<Title />);
    const explicit = render(<Title />, { strings: defaultThemeStrings });
    expect(implicit).toBe(explicit);
  });

  it('throws outside a provider, like every other kit hook', () => {
    expect(() => renderToStaticMarkup(<Title />)).toThrow(
      'useThemeStrings must be used within StorefrontProvider',
    );
  });
});

describe('client surface through ThemeMount', () => {
  function Header(): JSX.Element {
    const t = useThemeStrings();
    return <header>{t('cart.title')}</header>;
  }

  const stubTheme = {
    Layout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    Header,
    Footer: () => <footer />,
    blocks: {},
    getHeader: () => Header,
    getFooter: () => (() => <footer />),
    getBlock: () => (() => null),
    pages: {},
    manifest: { name: 'stub', slug: 'stub', description: '', version: '0' },
  } as unknown as ThemeModule;

  it('reaches themes mounted by ThemeMount', () => {
    const html = render(
      <ThemeMount
        theme={stubTheme}
        headerProps={{ menu: [], announcement: null }}
        footerProps={{}}
      >
        <p>page</p>
      </ThemeMount>,
      { locale: 'fr', strings: FR_STRINGS },
    );
    expect(html).toContain('<header>Votre panier</header>');
  });
});

describe('migrated DefaultCartShell (identical English output)', () => {
  const item: CartItem = {
    id: 'li-1',
    product_id: 'p-1',
    shop_id: 's-1',
    title: 'Egusi Soup',
    image: null,
    unit_price: 5000,
    quantity: 2,
    addons: [],
  };

  const noop = (): void => {};

  it('empty state renders the legacy literals with no strings prop', () => {
    const html = render(
      <DefaultCartShell
        items={[]}
        currency="NGN"
        total={0}
        empty
        onIncrease={noop}
        onDecrease={noop}
        onRemove={noop}
      />,
    );
    expect(html).toContain('Your cart</h1>');
    expect(html).toContain('Your cart is empty.');
    expect(html).toContain('Browse products');
  });

  it('populated state interpolates through t() with identical text', () => {
    const html = render(
      <DefaultCartShell
        items={[item]}
        currency="NGN"
        total={10000}
        empty={false}
        onIncrease={noop}
        onDecrease={noop}
        onRemove={noop}
      />,
    );
    expect(html).toContain('each</span>');
    expect(html).toContain('aria-label="Decrease Egusi Soup"');
    expect(html).toContain('aria-label="Increase Egusi Soup"');
    expect(html).toContain('aria-label="Remove Egusi Soup"');
    expect(html).toContain('Order summary');
    expect(html).toContain('Add order note');
    // The note textarea (with its placeholder) renders only after the toggle
    // opens it, so its key is asserted directly: same dictionary, same output.
    expect(translate([defaultThemeStrings], 'cart.note.toggle')).toBe('Add order note');
    expect(translate([defaultThemeStrings], 'cart.note.placeholder')).toBe('Order instructions (optional)');
    expect(html).toContain('Subtotal:');
    expect(html).toContain('terms and refund policy');
    expect(html).toContain('Continue shopping');
  });

  it('renders French when the provider carries the active locale', () => {
    const html = render(
      <DefaultCartShell
        items={[]}
        currency="NGN"
        total={0}
        empty
        onIncrease={noop}
        onDecrease={noop}
        onRemove={noop}
      />,
      { locale: 'fr', strings: FR_STRINGS },
    );
    expect(html).toContain('Votre panier</h1>');
    expect(html).toContain('Votre panier est vide.');
    expect(html).toContain('Voir les produits');
  });
});
