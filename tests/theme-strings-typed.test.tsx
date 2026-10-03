import { renderToStaticMarkup } from 'react-dom/server';
import type { JSX } from 'react';
import { describe, expect, it } from 'vitest';
import enDefault from '../locales/en.default.json';
import {
  createThemeT,
  defaultThemeStrings,
  t,
  type ThemeStringKey,
  type ThemeStringsDictionary,
} from '../strings/theme-strings';
import { StorefrontProvider, useThemeStrings } from '../provider';

/** Small theme-shaped dictionary exercising nesting, plurals and flat keys. */
const THEME_EN = {
  cart: {
    title: 'Your cart',
    empty: { message: 'Your cart is empty.' },
  },
  items: {
    count: { one: '{count} item', other: '{count} items' },
  },
  'flat.key': 'Flat value',
  greet: 'Hello {name}!',
} as const;

describe('typed keys: createThemeT (additive, opt-in)', () => {
  it('delegates to the wrapped t (values, vars, plurals identical)', () => {
    const dict = THEME_EN as unknown as ThemeStringsDictionary;
    const tt = createThemeT<typeof THEME_EN>((key, vars, locale) => t([dict], key, vars, locale));

    expect(tt('cart.title')).toBe('Your cart');
    expect(tt('greet', { name: 'Ada' })).toBe('Hello Ada!');
    expect(tt('items.count', { count: 1 })).toBe('1 item');
    expect(tt('items.count', { count: 5 })).toBe('5 items');
    expect(tt('flat.key')).toBe('Flat value');
  });

  it('wraps the client useThemeStrings() hook result', () => {
    function Title(): JSX.Element {
      const tUntyped = useThemeStrings();
      const tt = createThemeT<typeof THEME_EN>(tUntyped);
      return <h1>{tt('cart.title')}</h1>;
    }
    const html = renderToStaticMarkup(
      <StorefrontProvider
        vendor={{ id: 'v1', slug: 's', name: 'S' } as never}
        config={{} as never}
        menus={[]}
        strings={THEME_EN as unknown as ThemeStringsDictionary}
      >
        <Title />
      </StorefrontProvider>,
    );
    expect(html).toContain('<h1>Your cart</h1>');
  });

  it('accepts every real en.default.json key (valid keys pass)', () => {
    const tt = createThemeT<typeof enDefault>((key, vars, locale) =>
      t([defaultThemeStrings], key, vars, locale),
    );
    // A sample across nesting depths — each must compile AND render English.
    expect(tt('cart.title')).toBe('Your cart');
    expect(tt('cart.empty.message')).toBe('Your cart is empty.');
    expect(tt('checkout.contact.label')).toBe('Contact');
    expect(tt('auth.login.title')).toBe('Sign in');
    expect(tt('blog.share.copy')).toBe('Copy link');
  });

  it('existing untyped t(key) callers keep compiling (key: string)', () => {
    const anyKey: string = `cart.title`;
    // A dynamic string — not a literal — still flows through the untyped fn.
    expect(t([defaultThemeStrings], anyKey)).toBe('Your cart');
    // A broad dictionary collapses the typed helper back to `string` (untyped).
    const loose = createThemeT<ThemeStringsDictionary>((key, vars, locale) =>
      t([defaultThemeStrings], key, vars, locale),
    );
    expect(loose(anyKey)).toBe('Your cart');
  });

  it('drifts with the dictionary: the union is exactly the flattened keys', () => {
    // Compile-time proof (positive direction; the negative direction — typos
    // fail — lives in tests/theme-typed-keys.fixture.ts via @ts-expect-error
    // so `npm run typecheck` stays green).
    const keys: Array<ThemeStringKey<typeof THEME_EN>> = [
      'cart.title',
      'cart.empty.message',
      'items.count',
      'flat.key',
      'greet',
    ];
    expect(keys).toHaveLength(5);
    // Renaming/removing a key above breaks this file AND the fixture: a
    // renamed English key is a contract change, not a silent drift.
    expect(keys).toContain('cart.title');
  });
});
