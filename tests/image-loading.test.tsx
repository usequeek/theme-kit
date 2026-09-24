import type { JSX } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Image } from '../components/image';

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
