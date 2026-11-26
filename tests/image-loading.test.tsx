import type { JSX } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Image } from '../components/image';
import { ProductMediaFrame } from '../components/product-media-frame';
import type { ImageVariants } from '../types/media';
import type { Product } from '../types/product';
import { buildMediaFrames, type MediaFrame } from '../utils/product-media';

/**
 * Card images are lazy by default. Server-rendered product grids (the /shop
 * prefetch, streamed product blocks) otherwise made React preload the first
 * ~10 card images and fetch all of them at once, racing the page's CSS — /shop
 * first paint 1.8 s → 2.9 s on Slow 4G. Heroes and everything else unchanged.
 */
describe('Image loading defaults', () => {
  const html = (el: JSX.Element) => renderToStaticMarkup(el);

  it('lazy-loads card images by default', () => {
    expect(html(<Image src="/p.jpg" alt="" intent="card" />)).toContain('loading="lazy"');
    expect(html(<Image src="/p.jpg" alt="" intent="card2x" />)).toContain('loading="lazy"');
  });

  it('respects an explicit choice, and fetchPriority="high"', () => {
    expect(html(<Image src="/p.jpg" alt="" intent="card" loading="eager" />)).toContain('loading="eager"');
    expect(html(<Image src="/p.jpg" alt="" intent="card" fetchPriority="high" />)).not.toContain('loading=');
  });

  it('leaves heroes, avatars and untyped images as they were', () => {
    for (const intent of ['hero', 'avatar', 'modal', 'raw'] as const) {
      expect(html(<Image src="/p.jpg" alt="" intent={intent} />)).not.toContain('loading=');
    }
    expect(html(<Image src="/p.jpg" alt="" />)).not.toContain('loading=');
  });
});

/**
 * Whatever a product page shows first is never lazy (the PDP photo was the LCP element on every measured product
 * page, 26/11/26): the first frame of buildMediaFrames, and any frame a theme builds itself (the default theme's
 * selected-variant hero `{ id: 'variant' }`, its modal hero `{ id: 'image' }`). Only buildMediaFrames' later frames,
 * thumbnails and avatar-sized frames are lazy. No fetchPriority="high" (measured slower: it races the page's CSS).
 */
describe('ProductMediaFrame loading', () => {
  const html = (el: JSX.Element) => renderToStaticMarkup(el);
  const tier = (name: string, w: number) => ({ url: `https://media.usequeek.com/p-${name}.webp`, w, h: w });
  const variants = { thumb: { url: 'https://media.usequeek.com/p-thumb.webp', w: null, h: null }, card: tier('card', 480), card2x: tier('card2x', 800), view: tier('view', 1600), original: { url: 'https://media.usequeek.com/p.jpg', w: 2000, h: 2000 } } as unknown as ImageVariants;
  const frame = (id: string, extra: Partial<MediaFrame> = {}): MediaFrame => ({ id, url: 'https://media.usequeek.com/p-view.webp', alt: 'Gown', type: 'image', variants, ...extra });
  const product = {
    title: 'Gown',
    media: {
      image: 'https://media.usequeek.com/a.jpg',
      images: [
        { id: 1, url: 'https://media.usequeek.com/a.jpg', alt: 'A', variants: null },
        { id: 2, url: 'https://media.usequeek.com/b.jpg', alt: 'B', variants: null },
        { id: 3, url: 'https://media.usequeek.com/c.jpg', alt: 'C', variants: null },
      ],
    },
  } as unknown as Product;

  it('the main, variant and image frames (the first thing shown) are eager, with no fetchPriority, with their srcset', () => {
    for (const id of ['main', 'variant', 'image']) {
      const out = html(<ProductMediaFrame frame={frame(id)} variant="main" />);
      expect(out, id).not.toContain('loading=');
      expect(out, id).not.toContain('fetchPriority');
      expect(out, id).toContain('srcSet="https://media.usequeek.com/p-card.webp 480w');
    }
  });

  it('buildMediaFrames marks only the frames after the first lazy', () => {
    const frames = buildMediaFrames(product);
    expect(frames.map((f) => f.lazy ?? false)).toEqual([false, true, true]);
    expect(html(<ProductMediaFrame frame={frames[0]} variant="main" />)).not.toContain('loading=');
    expect(html(<ProductMediaFrame frame={frames[1]} variant="main" />)).toContain('loading="lazy"');
  });

  it('a later gallery frame, a thumbnail and an avatar-sized frame are lazy and never high', () => {
    for (const el of [
      <ProductMediaFrame key="a" frame={frame('42', { lazy: true })} variant="main" />,
      <ProductMediaFrame key="b" frame={frame('main')} variant="thumbnail" />,
      <ProductMediaFrame key="c" frame={frame('variant')} variant="main" intent="avatar" />,
    ]) {
      const out = html(el);
      expect(out).toContain('loading="lazy"');
      expect(out).not.toContain('fetchPriority');
    }
  });
});
