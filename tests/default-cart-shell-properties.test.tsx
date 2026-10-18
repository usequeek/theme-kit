import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { JSX } from 'react';
import { StorefrontProvider } from '../provider';
import { DefaultCartShell } from '../components/cart/default-cart-shell';
import type { CartItem } from '../types/cart';

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: unknown }) => (
    <a href={href} {...rest}>{children as never}</a>
  ),
}));

const base: CartItem = {
  id: 'p1',
  product_id: 'p1',
  shop_id: 's1',
  title: 'Mug',
  image: null,
  unit_price: 5000,
  quantity: 1,
  addons: [],
};

const LABELS = { 'app.engraving.text': 'Engraving text' };

function render(items: CartItem[]): string {
  const noop = (): void => {};
  const shell: JSX.Element = (
    <StorefrontProvider vendor={{ id: 'v1', slug: 'demo', name: 'Demo' } as never} config={{} as never} menus={[]}>
      <DefaultCartShell
        items={items}
        currency="NGN"
        total={10000}
        empty={false}
        onIncrease={noop}
        onDecrease={noop}
        onRemove={noop}
      />
    </StorefrontProvider>
  );

  return renderToStaticMarkup(shell);
}

describe('DefaultCartShell line text', () => {
  it('shows the text per line', () => {
    const html = render([
      { ...base, id: 'p1~p-aaaaaaaaaaaa', properties: { 'app.engraving.text': 'Ada' }, property_labels: LABELS },
      { ...base, id: 'p1~p-bbbbbbbbbbbb', properties: { 'app.engraving.text': 'Bola' }, property_labels: LABELS },
    ]);

    expect(html).toContain('<span class="core-cart-page__item-price">Engraving text: Ada</span>');
    expect(html).toContain('<span class="core-cart-page__item-price">Engraving text: Bola</span>');
    expect(html.indexOf('Engraving text: Ada')).toBeLessThan(html.indexOf('Engraving text: Bola'));
  });

  it('property-less item unchanged', () => {
    const html = render([base]);

    expect(html).toContain(
      '<span class="core-cart-page__item-title">Mug</span><span class="core-cart-page__item-price">',
    );
    expect(html.match(/core-cart-page__item-price/g)).toHaveLength(1);
  });

  it('escapes the value', () => {
    const value = '<img src=x onerror=alert(1)>';
    const html = render([{ ...base, properties: { 'app.engraving.text': value }, property_labels: LABELS }]);

    expect(html).not.toContain('<img src=x');
    expect(html).toContain('Engraving text: &lt;img src=x onerror=alert(1)&gt;');
  });

  it('foreign key shows nothing', () => {
    const html = render([
      { ...base, properties: { 'app.other.field': 'secret-value', 'app.booking.claim': 'bearer-secret' }, property_labels: {} },
    ]);

    expect(html).not.toContain('secret-value');
    expect(html).not.toContain('bearer-secret');
    expect(html.match(/core-cart-page__item-price/g)).toHaveLength(1);
  });
});
