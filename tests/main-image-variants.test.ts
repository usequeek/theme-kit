import { describe, expect, it } from 'vitest';
import type { ImageVariants } from '../types/media';
import { mainImageVariants } from '../utils/product-media';

const variants = { thumb: null, card: null, card2x: null, view: null, original: { url: 'https://cdn/p.png', w: 1, h: 1 } } as ImageVariants;

describe('mainImageVariants', () => {
  it('gives the tier map when the src is the main image (the API sets the thumbnail to it by default)', () => {
    expect(mainImageVariants('https://cdn/p.png', { image: 'https://cdn/p.png', image_variants: variants })).toBe(variants);
  });

  it('gives none for a merchant\'s own thumbnail file: the main photo\'s copies must not replace it', () => {
    expect(mainImageVariants('https://cdn/p-small.jpg', { image: 'https://cdn/p.png', image_variants: variants })).toBeNull();
  });

  it('gives none for no src, no media, no map or a null map', () => {
    expect(mainImageVariants(undefined, { image: 'https://cdn/p.png', image_variants: variants })).toBeNull();
    expect(mainImageVariants(null, { image: null, image_variants: variants })).toBeNull();
    expect(mainImageVariants('https://cdn/p.png', null)).toBeNull();
    expect(mainImageVariants('https://cdn/p.png', { image: 'https://cdn/p.png' })).toBeNull();
    expect(mainImageVariants('https://cdn/p.png', { image: 'https://cdn/p.png', image_variants: null })).toBeNull();
  });
});
