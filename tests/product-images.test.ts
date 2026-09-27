import { describe, expect, it } from 'vitest';
import type { LegacyProductLike, Product } from '../types/product';
import { normalizeProduct } from '../utils/product-normalizer';
import { buildMediaFrames, getHoverImage, getSlideshowImages } from '../utils/product-media';

function raw(overrides: LegacyProductLike = {}): LegacyProductLike {
  return { id: 'p1', title: 'Ankara Gown', slug: 'ankara-gown', ...overrides };
}

function viewVariants(url: string) {
  return {
    thumb: null,
    card: { url: '/card.jpg', w: 480, h: 480 },
    card2x: { url: '/card2x.jpg', w: 800, h: 800 },
    view: { url, w: 1600, h: 1600 },
    original: { url: '/orig.jpg', w: 2400, h: 2400 },
  };
}

describe('normalizeProduct images', () => {
  it('carries backend images verbatim, ordered primary-first', () => {
    const product = normalizeProduct(
      raw({
        media: {
          image: 'https://cdn/x/primary.jpg',
          thumbnail: 'https://cdn/x/thumb.jpg',
          images: [
            { id: 11, url: 'https://cdn/x/primary.jpg', alt: 'Front', variants: null },
            { id: 12, url: 'https://cdn/x/side.jpg', alt: 'Side', variants: viewVariants('https://cdn/x/side-view.jpg') },
          ],
        },
      }),
    );

    expect(product.media.images).toHaveLength(2);
    expect(product.media.images?.[0]).toMatchObject({ id: 11, url: 'https://cdn/x/primary.jpg' });
    expect(product.media.images?.[1]?.variants).toMatchObject({ view: { url: 'https://cdn/x/side-view.jpg' } });
    // The featured shortcut is untouched.
    expect(product.media.image).toBe('https://cdn/x/primary.jpg');
  });

  it('drops blank entries from a provided images list', () => {
    const product = normalizeProduct(
      raw({
        media: {
          image: 'https://cdn/x/primary.jpg',
          images: [
            { id: 11, url: '', alt: 'Blank' },
            { id: 12, url: 'https://cdn/x/side.jpg', alt: 'Side' },
          ],
        },
      }),
    );

    expect(product.media.images?.map((i) => i.url)).toEqual(['https://cdn/x/side.jpg']);
  });

  it('falls back to gallery/image for old payloads: primary first, dupes removed', () => {
    const product = normalizeProduct(
      raw({
        image: 'https://cdn/x/primary.jpg',
        media: {
          image: 'https://cdn/x/primary.jpg',
          gallery: [
            { id: 11, url: 'https://cdn/x/primary.jpg', alt: 'Dupe of primary' },
            { id: 12, url: 'https://cdn/x/side.jpg', alt: 'Side' },
            { id: 13, url: '', alt: 'Blank' },
          ],
        },
      }),
    );

    expect(product.media.images?.map((i) => i.url)).toEqual([
      'https://cdn/x/primary.jpg',
      'https://cdn/x/side.jpg',
    ]);
    expect(product.media.images?.[0].id).toBe('main');
  });

  it('falls back to a raw-URL-only single and to [] when there is no imagery', () => {
    const single = normalizeProduct(raw({ image: 'https://cdn/x/only.jpg' }));
    expect(single.media.images?.map((i) => i.url)).toEqual(['https://cdn/x/only.jpg']);

    const none = normalizeProduct(raw({}));
    expect(none.media.images).toEqual([]);
    expect(none.media.gallery).toEqual([]);
  });

  it('falls back when a provided images list is entirely blank', () => {
    const product = normalizeProduct(
      raw({
        media: {
          image: 'https://cdn/x/primary.jpg',
          gallery: [{ id: 12, url: 'https://cdn/x/side.jpg' }],
          images: [{ id: 11, url: '' }],
        },
      }),
    );

    expect(product.media.images?.map((i) => i.url)).toEqual([
      'https://cdn/x/primary.jpg',
      'https://cdn/x/side.jpg',
    ]);
  });
});

describe('getHoverImage / getSlideshowImages', () => {
  const product = (urls: string[]): Product =>
    normalizeProduct(
      raw({
        media: {
          image: urls[0] ?? null,
          images: urls.map((url, i) => ({ id: i + 1, url })),
        },
      }),
    );

  it('returns images[1] and null unless two images exist', () => {
    expect(getHoverImage(product([]))).toBeNull();
    expect(getHoverImage(product(['https://cdn/x/a.jpg']))).toBeNull();
    expect(getHoverImage(product(['https://cdn/x/a.jpg', 'https://cdn/x/b.jpg']))).toBe(
      'https://cdn/x/b.jpg',
    );
  });

  it('returns the ordered slideshow list', () => {
    const list = getSlideshowImages(product(['https://cdn/x/a.jpg', 'https://cdn/x/b.jpg']));
    expect(list.map((i) => i.url)).toEqual(['https://cdn/x/a.jpg', 'https://cdn/x/b.jpg']);
  });

  it('treats a missing images key as no slideshow', () => {
    const legacy = normalizeProduct(raw({ image: 'https://cdn/x/a.jpg' }));
    delete legacy.media.images;
    expect(getSlideshowImages(legacy)).toEqual([]);
    expect(getHoverImage(legacy)).toBeNull();
  });
});

describe('buildMediaFrames reads images', () => {
  it('renders identical frames for a legacy payload and its images-carrying twin', () => {
    const legacy = normalizeProduct(
      raw({
        media: {
          image: 'https://cdn/x/primary.jpg',
          original: 'https://cdn/x/primary-orig.jpg',
          gallery: [
            { id: 12, url: 'https://cdn/x/side.jpg', alt: 'Side' },
            { id: 13, url: 'https://cdn/x/back.jpg', alt: 'Back' },
          ],
        },
      }),
    );
    delete legacy.media.images;

    const next = normalizeProduct(
      raw({
        media: {
          image: 'https://cdn/x/primary.jpg',
          original: 'https://cdn/x/primary-orig.jpg',
          gallery: [
            { id: 12, url: 'https://cdn/x/side.jpg', alt: 'Side' },
            { id: 13, url: 'https://cdn/x/back.jpg', alt: 'Back' },
          ],
          images: [
            { id: 11, url: 'https://cdn/x/primary.jpg', alt: 'Ankara Gown' },
            { id: 12, url: 'https://cdn/x/side.jpg', alt: 'Side' },
            { id: 13, url: 'https://cdn/x/back.jpg', alt: 'Back' },
          ],
        },
      }),
    );

    const legacyUrls = buildMediaFrames(legacy).map((f) => f.url);
    const nextUrls = buildMediaFrames(next).map((f) => f.url);
    expect(nextUrls).toEqual(legacyUrls);
    expect(nextUrls).toEqual([
      'https://cdn/x/primary-orig.jpg',
      'https://cdn/x/side.jpg',
      'https://cdn/x/back.jpg',
    ]);
  });

  it('prefers the view tier off images entries and appends video last', () => {
    const product = normalizeProduct(
      raw({
        media: {
          image: 'https://cdn/x/primary.jpg',
          images: [
            { id: 11, url: 'https://cdn/x/primary.jpg', variants: viewVariants('https://cdn/x/primary-view.jpg') },
            { id: 12, url: 'https://cdn/x/side.jpg' },
          ],
          video_url: 'https://cdn/x/clip.mp4',
        },
      }),
    );

    const frames = buildMediaFrames(product);
    expect(frames.map((f) => f.type)).toEqual(['image', 'image', 'video']);
    expect(frames[0].url).toBe('https://cdn/x/primary-view.jpg');
    expect(frames[2].url).toBe('https://cdn/x/clip.mp4');
  });
});
