// @vitest-environment jsdom
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {} }) }));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: unknown }) => <a href={href} {...rest}>{children as never}</a>,
}));
vi.mock('../stores/toast-store', () => ({ toast: vi.fn() }));
vi.mock('../apps/storefront-events', () => ({ trackStorefrontEvent: vi.fn() }));

import { CartServerPricingProvider } from '../hooks/use-cart-server-pricing';
import { defaultThemeStrings, t as translate } from '../strings/theme-strings';
import { cartLinePricing, resolveCartPricing, type CartLinePricing, type CartServerPricing } from '../utils/cart-pricing';
import { formatMoney, formatWireMoney } from '../utils/format';
import { useCartStore } from '../stores/cart-store';
import { CART_CASES, renderHooks, renderShell } from './fixtures/cart-pricing-cases';
import baseline from './fixtures/cart-pricing-baseline-0.1.29.json';

const ROOT = resolve(__dirname, '..');

const withPricing = (pricing: CartServerPricing | null) => (children: React.ReactNode) => (
  <CartServerPricingProvider value={pricing}>{children}</CartServerPricingProvider>
);

const MIXED = CART_CASES.mixed.items;

/** Server pricing for the `mixed` cart: the first line carries a quantity break, the others are at list. */
const MIXED_PRICING: CartServerPricing = {
  lines: [
    { line_id: 'p1', quantity: 2, unit_price: '4500.00', line_total: '9000.00', list_line_total: '10000.00' },
    { line_id: 'p2::v1-a1', quantity: 3, unit_price: '13000.50', line_total: '39001.50', list_line_total: null },
    { line_id: 'p3~p-aaaaaaaaaaaa', quantity: 4, unit_price: '1.25', line_total: '5.00', list_line_total: null },
  ],
  total: '44006.50',
  list_total: '49006.50',
};

beforeEach(() => {
  useCartStore.setState({ items: [] });
});

describe('without server pricing the output is byte-identical to 0.1.29', () => {
  const mismatched: Record<string, CartServerPricing> = {
    'a different quantity': { ...MIXED_PRICING, lines: MIXED_PRICING.lines.map((l, i) => (i === 0 ? { ...l, quantity: 3 } : l)) },
    'a line the cart does not have': { ...MIXED_PRICING, lines: MIXED_PRICING.lines.map((l, i) => (i === 2 ? { ...l, line_id: 'gone' } : l)) },
    'a missing line': { ...MIXED_PRICING, lines: MIXED_PRICING.lines.slice(0, 2) },
    'an extra line': { ...MIXED_PRICING, lines: [...MIXED_PRICING.lines, { ...MIXED_PRICING.lines[0], line_id: 'extra' }] },
    'a duplicated line': { ...MIXED_PRICING, lines: [MIXED_PRICING.lines[0], MIXED_PRICING.lines[0], MIXED_PRICING.lines[2]] },
    'a malformed line amount': { ...MIXED_PRICING, lines: MIXED_PRICING.lines.map((l, i) => (i === 1 ? { ...l, line_total: '39001,50' } : l)) },
    'a negative total': { ...MIXED_PRICING, total: '-1.00' },
    'a numeric amount': { ...MIXED_PRICING, total: 44006.5 as unknown as string },
  };

  for (const name of Object.keys(CART_CASES)) {
    it(`cart page "${name}": no provider`, () => {
      expect(renderShell(name)).toBe(baseline.shells[name as keyof typeof baseline.shells]);
    });

    it(`cart page "${name}": provider holding null`, () => {
      expect(renderShell(name, CART_CASES, withPricing(null))).toBe(baseline.shells[name as keyof typeof baseline.shells]);
    });
  }

  for (const [label, pricing] of Object.entries(mismatched)) {
    it(`cart page: server pricing with ${label} is ignored whole`, () => {
      expect(renderShell('mixed', CART_CASES, withPricing(pricing))).toBe(baseline.shells.mixed);
    });
  }

  it('useShopCart and CartPanelController: every existing field unchanged, pricing null', () => {
    const { pricing: panelPricing, ...panel } = renderHooks().panel;
    const { pricing: shopPricing, ...shopCart } = renderHooks().shopCart;

    expect(panel).toEqual(baseline.hooks.panel);
    expect(shopCart).toEqual(baseline.hooks.shopCart);
    expect(panelPricing).toBeNull();
    expect(shopPricing).toBeNull();
  });

  it('a mismatched overlay gives pricing null through both hooks', () => {
    const hooks = renderHooks(withPricing(mismatched['a different quantity']));

    expect(hooks.panel.pricing).toBeNull();
    expect(hooks.shopCart.pricing).toBeNull();
  });
});

describe('with server pricing', () => {
  it('hands the covered overlay to useShopCart and CartPanelController, amounts as received', () => {
    const hooks = renderHooks(withPricing(MIXED_PRICING));

    expect(hooks.shopCart.pricing).toEqual(MIXED_PRICING);
    expect(hooks.panel.pricing).toEqual(MIXED_PRICING);
    // The list total the hook reports is still the list total.
    expect(hooks.shopCart.total).toBe(baseline.hooks.shopCart.total);
  });

  it('prints the discounted line total with the list total struck, and the cart total the same way', () => {
    const html = renderShell('mixed', CART_CASES, withPricing(MIXED_PRICING));

    expect(html).toContain('<del aria-hidden="true">₦10,000</del> <ins aria-hidden="true" style="text-decoration:none">₦9,000</ins>');
    expect(html).toContain('<del aria-hidden="true">₦49,006.5</del> <ins aria-hidden="true" style="text-decoration:none">₦44,006.5</ins>');
    expect(html).toContain('aria-label="Was ₦10,000, now ₦9,000"');
    expect(html).toContain('aria-label="Was ₦49,006.5, now ₦44,006.5"');
    // The "each" line states the server's unit price.
    expect(html).toContain('₦4,500 each');
    // A line the server does not discount shows its charged total plain, no strike.
    expect(html).toContain('<span class="core-cart-page__item-total">₦39,001.5</span>');
    expect(html.match(/<del /g)).toHaveLength(2);
    // The list price of the discounted line is no longer printed as its total or unit price.
    expect(html).not.toContain('₦5,000 each');
  });

  it('with nothing discounted it prints the server amounts plain, with no del or ins', () => {
    const plain: CartServerPricing = {
      lines: [{ line_id: 'p1', quantity: 1, unit_price: '5000.00', line_total: '5000.00', list_line_total: null }],
      total: '5000.00',
      list_total: null,
    };
    const html = renderShell('single', CART_CASES, withPricing(plain));

    expect(html).not.toContain('<del');
    expect(html).not.toContain('<ins');
    expect(html).toContain('<span class="core-cart-page__item-total">₦5,000</span>');
    expect(html).toBe(baseline.shells.single);
  });

  it('a struck list amount that is not higher than the charge is dropped', () => {
    const odd: CartServerPricing = {
      lines: [{ line_id: 'p1', quantity: 1, unit_price: '5000.00', line_total: '5000.00', list_line_total: '5000' }],
      total: '5000.00',
      list_total: '4000.00',
    };

    expect(renderShell('single', CART_CASES, withPricing(odd))).toBe(baseline.shells.single);
  });

  it('prints KWD at its own precision', () => {
    const kwd: CartServerPricing = {
      lines: [{ line_id: 'p1', quantity: 3, unit_price: '1.125', line_total: '3.375', list_line_total: '3.750' }],
      total: '3.375',
      list_total: '3.750',
    };
    const html = renderShell('fractional', CART_CASES, withPricing(kwd));

    expect(html).toContain('3.375');
    expect(html).toContain('3.75');
  });

  it('does not touch the empty cart page', () => {
    expect(renderShell('empty', CART_CASES, withPricing(MIXED_PRICING))).toBe(baseline.shells.empty);
  });
});

describe('resolveCartPricing', () => {
  const lines = MIXED.map((l) => ({ id: l.id, quantity: l.quantity }));

  it('returns the overlay when it covers the lines one to one', () => {
    expect(resolveCartPricing(MIXED_PRICING, lines)).toEqual(MIXED_PRICING);
    expect(cartLinePricing(MIXED_PRICING, 'p1')?.line_total).toBe('9000.00');
    expect(cartLinePricing(MIXED_PRICING, 'nope')).toBeNull();
    expect(cartLinePricing(null, 'p1')).toBeNull();
  });

  it('is null for no overlay, no lines, and malformed input, and never throws', () => {
    expect(resolveCartPricing(null, lines)).toBeNull();
    expect(resolveCartPricing(undefined, lines)).toBeNull();
    expect(resolveCartPricing(MIXED_PRICING, [])).toBeNull();
    expect(resolveCartPricing({} as never, lines)).toBeNull();
    expect(resolveCartPricing({ lines: [null], total: '1.00', list_total: null } as never, lines.slice(0, 1))).toBeNull();
    expect(resolveCartPricing({ ...MIXED_PRICING, total: ' 1.00' }, lines)).toBeNull();
    expect(resolveCartPricing({ ...MIXED_PRICING, total: '1e3' }, lines)).toBeNull();
  });

  it('compares a struck amount digit-exact', () => {
    const one = (line_total: string, list_line_total: string | null): CartLinePricing[] => [
      { line_id: 'p1', quantity: 1, unit_price: '1', line_total, list_line_total },
    ];
    const struck = (charged: string, list: string): string | null =>
      resolveCartPricing({ lines: one(charged, list), total: charged, list_total: null }, [{ id: 'p1', quantity: 1 }])?.lines[0].list_line_total ?? null;

    expect(struck('9000.00', '10000.00')).toBe('10000.00');
    expect(struck('9999999999999999.99', '10000000000000000.00')).toBe('10000000000000000.00');
    expect(struck('10000000000000000.00', '9999999999999999.99')).toBeNull();
    expect(struck('100.10', '100.1')).toBeNull();
    expect(struck('100.1', '100.11')).toBe('100.11');
    expect(struck('0.5', '00.50')).toBeNull();
    expect(struck('5', '5.0000001')).toBe('5.0000001');
  });
});

describe('the kit does no price arithmetic of its own on server amounts', () => {
  // Deterministic generator, so a failure is reproducible.
  let seed = 20261022;
  const next = (max: number): number => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;

    return seed % max;
  };
  const amount = (): string => {
    const whole = String(next(900000) + 1);
    const cents = String(next(100)).padStart(2, '0');

    return `${whole}.${cents}`;
  };
  const digits = (text: string): string => text.replace(/\D/g, '');
  const canonical = (decimal: string): string => digits(decimal.replace(/\.?0+$/, ''));

  it('property: every amount that comes out is, character for character, the amount that went in', () => {
    for (let run = 0; run < 200; run += 1) {
      const quantity = next(9) + 1;
      const charged = amount();
      const list = amount();
      const overlay: CartServerPricing = {
        lines: [{ line_id: 'x', quantity, unit_price: amount(), line_total: charged, list_line_total: list }],
        total: charged,
        list_total: list,
      };
      const out = resolveCartPricing(overlay, [{ id: 'x', quantity }]);

      expect(out).not.toBeNull();
      expect(out!.lines[0].unit_price).toBe(overlay.lines[0].unit_price);
      expect(out!.lines[0].line_total).toBe(charged);
      expect(out!.total).toBe(charged);
      // A strike is the input string or nothing: never a value the kit produced.
      expect([list, null]).toContain(out!.lines[0].list_line_total);
      expect([list, null]).toContain(out!.list_total);
    }
  });

  it('property: the printed text carries exactly the digits of the server string', () => {
    for (let run = 0; run < 200; run += 1) {
      const value = amount();

      // Intl grouping and trimmed trailing zeros aside, no digit is added, dropped or changed.
      expect(digits(formatWireMoney(value, 'NGN'))).toBe(canonical(value));
    }

    // And an amount a float cannot hold survives, which `formatMoney(Number(x))` would not.
    expect(digits(formatWireMoney('9007199254740993.01', 'NGN'))).toBe('900719925474099301');
    expect(digits(formatMoney(Number('9007199254740993.01'), 'NGN'))).not.toBe('900719925474099301');
  });

  it('property: the cart page prints the server strings and a list price never leaks into a charged slot', () => {
    for (let run = 0; run < 25; run += 1) {
      const charged = amount();
      const list = String(Number(charged.split('.')[0]) + next(5000) + 1).concat('.00');
      const overlay: CartServerPricing = {
        lines: [{ line_id: 'p1', quantity: 1, unit_price: charged, line_total: charged, list_line_total: list }],
        total: charged,
        list_total: list,
      };
      const html = renderShell('single', CART_CASES, withPricing(overlay));
      const ins = [...html.matchAll(/<ins[^>]*>([^<]*)<\/ins>/g)].map((m) => digits(m[1]));
      const del = [...html.matchAll(/<del[^>]*>([^<]*)<\/del>/g)].map((m) => digits(m[1]));

      expect(ins).toEqual([canonical(charged), canonical(charged)]);
      expect(del).toEqual([canonical(list), canonical(list)]);
    }
  });

  it('source: no float parsing or rounding in the overlay path', () => {
    for (const file of ['utils/cart-pricing.ts', 'hooks/use-cart-server-pricing.tsx']) {
      const source = readFileSync(join(ROOT, file), 'utf8');

      expect(source, file).not.toMatch(/parseFloat|Number\(|toFixed|Math\.(round|floor|ceil)|roundAmount/);
    }
  });
});

describe('strings', () => {
  it('the discounted label exists in every locale file the kit ships and keeps both placeholders', () => {
    const files = readdirSync(join(ROOT, 'locales')).filter((f) => f.endsWith('.json'));

    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const dictionary = JSON.parse(readFileSync(join(ROOT, 'locales', file), 'utf8')) as { cart: { item: Record<string, string> } };
      const value = dictionary.cart.item.discounted;

      expect(value, file).toEqual(expect.stringContaining('{original}'));
      expect(value, file).toEqual(expect.stringContaining('{price}'));
    }
  });

  it('interpolates', () => {
    expect(translate([defaultThemeStrings], 'cart.item.discounted', { original: '₦10,000', price: '₦9,000' })).toBe('Was ₦10,000, now ₦9,000');
  });
});

describe('public surface', () => {
  it('the barrels declare the new modules', () => {
    expect(readFileSync(join(ROOT, 'index.ts'), 'utf8')).toContain("'./utils/cart-pricing'");
    expect(readFileSync(join(ROOT, 'client.ts'), 'utf8')).toContain("'./hooks/use-cart-server-pricing'");
  });
});
