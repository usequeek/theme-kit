import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { formatMoney, normalizeCurrencyCode, PLATFORM_DEFAULT_CURRENCY } from '../utils/format';
import { extractProducts, normalizeProduct } from '../utils/product-normalizer';
import { useCartStore } from '../stores/cart-store';

/**
 * Client readers do not use `meta.currency`. List-level `meta.currency` stamps the PLATFORM default (NGN) even on
 * non-NGN stores, so the item's own `currency` code is the source and the
 * vendor's currency is the store-wide source. Missing codes fall back to the
 * platform default as a LAST resort, in exactly one place.
 */
describe('currency resolution', () => {
  it('exposes NGN as the platform default last resort', () => {
    expect(PLATFORM_DEFAULT_CURRENCY).toBe('NGN');
  });

  it('normalizeCurrencyCode keeps valid item/vendor codes', () => {
    expect(normalizeCurrencyCode('USD')).toBe('USD');
    expect(normalizeCurrencyCode('ngn')).toBe('NGN');
    expect(normalizeCurrencyCode('  eur  ')).toBe('EUR');
  });

  it('normalizeCurrencyCode falls back instead of passing garbage through', () => {
    expect(normalizeCurrencyCode(undefined)).toBe('NGN');
    expect(normalizeCurrencyCode(null)).toBe('NGN');
    expect(normalizeCurrencyCode('')).toBe('NGN');
    expect(normalizeCurrencyCode('US')).toBe('NGN');
    expect(normalizeCurrencyCode('USDD')).toBe('NGN');
    expect(normalizeCurrencyCode(42)).toBe('NGN');
  });

  it('normalizeCurrencyCode honors an explicit vendor fallback', () => {
    expect(normalizeCurrencyCode(undefined, 'USD')).toBe('USD');
    expect(normalizeCurrencyCode('', 'eur')).toBe('EUR');
    expect(normalizeCurrencyCode(undefined, 'bogus')).toBe('NGN');
  });

  it('normalizeProduct keeps the item currency, ignoring list-level meta', () => {
    const envelope = {
      data: [{ id: 'p1', title: 'Tote', price: 5000, currency: 'usd' }],
      meta: { currency: { code: 'NGN', symbol: '₦' } },
    };
    const [raw] = extractProducts(envelope);
    expect(normalizeProduct(raw).currency).toBe('USD');
  });

  it('normalizeProduct falls back to the platform default when the item has none', () => {
    const [raw] = extractProducts({ data: [{ id: 'p2', title: 'Cap', price: 1000 }] });
    expect(normalizeProduct(raw).currency).toBe('NGN');
  });

  it('formatMoney formats through the item code, not a wired symbol', () => {
    expect(formatMoney(12500)).toBe('₦12,500');
    const usd = formatMoney(5000, 'USD');
    expect(usd).toContain('5,000');
    expect(usd).not.toContain('₦');
  });

  it('cart-store currency starts at the platform default and normalizes vendor init', () => {
    expect(useCartStore.getState().currency).toBe('NGN');
    useCartStore.getState().setCurrency('usd');
    expect(useCartStore.getState().currency).toBe('USD');
    useCartStore.getState().setCurrency('');
    expect(useCartStore.getState().currency).toBe('NGN');
  });

  it('no kit source reads list-level meta.currency', () => {
    const ROOT = resolve(__dirname, '..');
    const walk = (dir: string): string[] => readdirSync(dir).flatMap((entry) => {
      const path = join(dir, entry);
      if (entry === 'node_modules' || entry === 'tests' || entry.startsWith('.')) return [];
      if (statSync(path).isDirectory()) return walk(path);
      return /\.(ts|tsx)$/.test(entry) ? [path] : [];
    });
    const offenders = walk(ROOT).flatMap((file) => {
      const source = readFileSync(file, 'utf8');
      // Real reads use `?.` or a `.meta` access (`payload?.meta?.currency`,
      // `data.meta.currency`); prose comments naming the contract don't count.
      return /meta\?\.\s*currency|\.meta\.currency/.test(source) ? [relative(ROOT, file)] : [];
    });
    expect(offenders).toEqual([]);
  });
});
