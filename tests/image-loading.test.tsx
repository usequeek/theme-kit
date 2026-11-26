import type { JSX } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Image } from '../components/image';
import { ProductMediaFrame } from '../components/product-media-frame';
import type { ImageVariants } from '../types/media';
import type { MediaFrame } from '../utils/product-media';

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
 * A product page's largest image is its primary photo (buildMediaFrames' first frame, id `main`). It loads eagerly
 * at high priority; the rest of the gallery, thumbnails and slides hidden until their turn are lazy, so they never
 * race it (Lighthouse: the PDP photo was the LCP element on every measured product page, 26/11/26).
 */
describe('ProductMediaFrame loading', () => {
  const html = (el: JSX.Element) => renderToStaticMarkup(el);
  const tier = (name: string, w: number) => ({ url: `https://media.usequeek.com/p-${name}.webp`, w, h: w });
  const variants = { thumb: { url: 'https://media.usequeek.com/p-thumb.webp', w: null, h: null }, card: tier('card', 480), card2x: tier('card2x', 800), view: tier('view', 1600), original: { url: 'https://media.usequeek.com/p.jpg', w: 2000, h: 2000 } } as unknown as ImageVariants;
  const frame = (id: string): MediaFrame => ({ id, url: 'https://media.usequeek.com/p-view.webp', alt: 'Gown', type: 'image', variants });

  it('the primary photo as a main frame is eager and high priority, with its srcset', () => {
    const out = html(<ProductMediaFrame frame={frame('main')} variant="main" />);
    expect(out).toContain('fetchPriority="high"');
    expect(out).not.toContain('loading=');
    expect(out).toContain('srcSet="https://media.usequeek.com/p-card.webp 480w');
  });

  it('every other frame, a thumbnail of the primary and an avatar-sized main frame are lazy and never high', () => {
    for (const el of [
      <ProductMediaFrame key="a" frame={frame('42')} variant="main" />,
      <ProductMediaFrame key="b" frame={frame('main')} variant="thumbnail" />,
      <ProductMediaFrame key="c" frame={frame('main')} variant="main" intent="avatar" />,
    ]) {
      const out = html(el);
      expect(out).toContain('loading="lazy"');
      expect(out).not.toContain('fetchPriority');
    }
  });
});
