import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { makeItemId, useCartStore } from '../stores/cart-store';
import * as lineProperties from '../utils/line-properties';
import * as lineTextStore from '../stores/line-text-store';

const ROOT = resolve(__dirname, '..');

/** The modules `index.ts` declared in 0.1.25, recorded from `git show v0.1.25:index.ts`. */
const INDEX_MODULES_0_1_25 = [
  'types/theme',
  'types/block',
  'types/product',
  'types/cart',
  'types/order',
  'types/page',
  'types/menu',
  'utils/format',
  'utils/markdown',
  'utils/menu-link',
  'utils/product-media',
  'utils/hero-content',
  'utils/addon-selection',
  'utils/contact-location',
  'utils/benefit-icon',
  'utils/video-embed',
  'utils/match-variant',
  'utils/announcement',
  'utils/locale',
  'utils/locale-switch',
  'strings/theme-strings',
  'strings/pseudo-locale',
  'demo',
];

/** The modules `client.ts` declared in 0.1.25, recorded from `git show v0.1.25:client.ts`. */
const CLIENT_MODULES_0_1_25 = [
  'provider',
  'navigation',
  'apps',
  'page-renderer',
  'edit-mode',
  'theme-variant-resolver',
  'shared-blocks',
  'components/blog',
  'components/image',
  'components/product-metafields',
  'components/powered-by-queek',
  'components/language-switcher',
  'components/default-metaobject-page',
  'components/product-media-frame',
  'components/variant-picker',
  'components/auth/auth-flow',
  'components/cart/default-cart-shell',
  'components/cart/cart-panel-controller',
  'components/checkout/default-checkout-shell',
  'components/checkout/checkout-contact',
  'components/checkout/policy-links',
  'apps/follow-card',
  'apps/subscribe-form',
  'api/collections',
  'api/orders',
  'hooks/use-href',
  'hooks/use-locales',
  'hooks/use-auth',
  'hooks/use-cart',
  'hooks/use-shop-cart',
  'hooks/use-products',
  'hooks/use-product-detail',
  'hooks/use-product-sections',
  'hooks/use-related-products',
  'hooks/use-categories',
  'hooks/use-collection-params',
  'hooks/use-shop',
  'hooks/use-shop-params',
  'hooks/use-search',
  'hooks/use-posts',
  'hooks/use-reviews',
  'hooks/use-variant-selection',
  'hooks/use-address-autocomplete',
  'hooks/use-resolve-coordinates',
  'stores/cart-panel-store',
  'stores/product-modal-store',
  'stores/search-modal-store',
  'stores/orders-sheet-store',
  'stores/location-store',
  'stores/address-modal-store',
  'stores/auth-modal-store',
  'stores/cart-store',
  'theme-mount',
  'theme-context',
];

function barrelModules(file: string): Set<string> {
  const source = readFileSync(join(ROOT, file), 'utf8');

  return new Set([...source.matchAll(/from '\.\/([^']+)'/g)].map((match) => match[1]));
}

describe('public API names recorded from 0.1.25', () => {
  it('index.ts still declares every module it declared', () => {
    const declared = barrelModules('index.ts');

    expect(INDEX_MODULES_0_1_25.filter((module) => !declared.has(module))).toEqual([]);
  });

  it('client.ts still declares every module it declared', () => {
    const declared = barrelModules('client.ts');

    expect(CLIENT_MODULES_0_1_25.filter((module) => !declared.has(module))).toEqual([]);
  });

  it('the new public names are exported from the barrels', () => {
    expect(barrelModules('index.ts').has('utils/line-properties')).toBe(true);
    expect(barrelModules('client.ts').has('stores/line-text-store')).toBe(true);
    expect(typeof lineProperties.visibleLineProperties).toBe('function');
    expect(typeof lineTextStore.useLineTextStore).toBe('function');
    expect(typeof lineTextStore.readLineText).toBe('function');
  });

  it('the bearer suffix list and the blank-text helper stay internal', () => {
    expect(Object.keys(lineProperties)).not.toContain('BEARER_PROPERTY_SUFFIXES');
    expect(Object.keys(lineTextStore)).not.toContain('BEARER_PROPERTY_SUFFIXES');
    expect(barrelModules('index.ts').has('utils/blank-text')).toBe(false);
    expect(barrelModules('client.ts').has('utils/blank-text')).toBe(false);
  });

  it('stores/cart-store still exports makeItemId and useCartStore', () => {
    expect(typeof makeItemId).toBe('function');
    expect(typeof useCartStore).toBe('function');
    expect(typeof useCartStore.getState).toBe('function');
  });

  it('makeItemId still works with three arguments', () => {
    expect(makeItemId('p', [])).toBe('p');
    expect(makeItemId('p', [], 'v')).toBe('p::v');
    expect(makeItemId('p', [{ item_id: 'b' }, { item_id: 'a' }] as never, 'v')).toBe('p::v-a,b');
  });

  it('addProduct and addItemWithAddons keep their arity', () => {
    const state = useCartStore.getState();

    expect(state.addProduct.length).toBeLessThanOrEqual(3);
    expect(state.addItemWithAddons.length).toBeLessThanOrEqual(4);
  });
});
