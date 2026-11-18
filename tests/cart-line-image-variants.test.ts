// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImageVariants } from '../types/media';
import type { Product } from '../types/product';

vi.mock('../stores/toast-store', () => ({ toast: vi.fn() }));
vi.mock('../apps/storefront-events', () => ({ trackStorefrontEvent: vi.fn() }));

import { useCartStore } from '../stores/cart-store';

const tiers = (base: string): ImageVariants => ({
  thumb: { url: `${base}-thumb.webp`, w: null, h: null },
  card: { url: `${base}-card.webp`, w: 480, h: 480 },
  card2x: { url: `${base}-card2x.webp`, w: 800, h: 800 },
  view: { url: `${base}-view.webp`, w: 1600, h: 1600 },
  original: { url: `${base}.png`, w: 3000, h: 3000 },
});

function product(media: Record<string, unknown>, variants: unknown[] = []): Product {
  return {
    id: 'p1', shop_id: 's1', title: 'Mug', slug: 'mug', pricing: { sale_amount: 1000 }, media, variants, variants_count: variants.length,
  } as unknown as Product;
}

const line = () => useCartStore.getState().items[0];

beforeEach(() => {
  useCartStore.setState({ items: [] });
  localStorage.clear();
});

describe('a cart line keeps the tier map of its image', () => {
  it('when the thumbnail is the API\'s fallback to the full image, the line carries the image tier map', () => {
    const v = tiers('https://cdn/p1');
    useCartStore.getState().addProduct(product({ thumbnail: 'https://cdn/p1.png', image: 'https://cdn/p1.png', image_variants: v }));

    expect(line().image).toBe('https://cdn/p1.png');
    expect(line().image_variants).toEqual(v);
  });

  it('a separate thumbnail file is small already: no tier map, the line keeps the shape it had', () => {
    useCartStore.getState().addProduct(product({ thumbnail: 'https://cdn/p1-small.jpg', image: 'https://cdn/p1.png', image_variants: tiers('https://cdn/p1') }));

    expect(line().image).toBe('https://cdn/p1-small.jpg');
    expect('image_variants' in line()).toBe(false);
  });

  it('no thumbnail: the image and its tier map', () => {
    const v = tiers('https://cdn/p1');
    useCartStore.getState().addProduct(product({ thumbnail: null, image: 'https://cdn/p1.png', image_variants: v }));

    expect(line().image_variants).toEqual(v);
  });

  it('a variant\'s own picture wins, with its own tier map, else the product\'s', () => {
    const own = tiers('https://cdn/v1');
    const vProduct = product({ thumbnail: 'https://cdn/p1.png', image: 'https://cdn/p1.png', image_variants: tiers('https://cdn/p1') }, [
      { id: 'v1', title: 'Blue', pricing: { sale_amount: 1000 }, media: { thumbnail: 'https://cdn/v1.png', image: 'https://cdn/v1.png', image_variants: own } },
      { id: 'v2', title: 'Plain', pricing: { sale_amount: 1000 }, media: { thumbnail: null, image: null } },
    ]);
    const [blue, plain] = vProduct.variants as unknown as Parameters<ReturnType<typeof useCartStore.getState>['addProduct']>[2][];

    useCartStore.getState().addProduct(vProduct, 1, blue);
    expect(line().image).toBe('https://cdn/v1.png');
    expect(line().image_variants).toEqual(own);

    useCartStore.setState({ items: [] });
    useCartStore.getState().addProduct(vProduct, 1, plain);
    expect(line().image).toBe('https://cdn/p1.png');
    expect(line().image_variants?.original?.url).toBe('https://cdn/p1.png');
  });

  it('a product with no image has none', () => {
    useCartStore.getState().addProduct(product({ thumbnail: null, image: null }));

    expect(line().image).toBeNull();
    expect('image_variants' in line()).toBe(false);
  });
});
