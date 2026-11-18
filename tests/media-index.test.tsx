import type { JSX } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Image } from '../components/image';
import { MediaIndexProvider, lookupMediaIndex, mediaIndexBackgroundUrl } from '../media-index';
import type { ImageVariants, MediaIndex } from '../types/media';
import { resolveImageSources } from '../utils/image-srcset';

const RAW = 'https://media.example.com/stores/1/slide.png';
const OTHER = 'https://media.example.com/stores/1/other.png';

function tiers(base: string, view = 1600, originalW: number | null = 1600): ImageVariants {
  return {
    thumb: { url: `${base}-thumb.webp`, w: null, h: null },
    card: { url: `${base}-card.webp`, w: 480, h: 320 },
    card2x: { url: `${base}-card2x.webp`, w: 800, h: 533 },
    view: { url: `${base}-view.webp`, w: view, h: 1067 },
    original: { url: `${base}.png`, w: originalW, h: 1067 },
  };
}

const WIDE = 'https://media.example.com/stores/1/wide.png';

const INDEX: MediaIndex = {
  [RAW]: tiers('https://media.example.com/stores/1/slide'),
  [WIDE]: tiers('https://media.example.com/stores/1/wide', 1600, 4000),
  'https://media.example.com/svg.svg': null,
};

const html = (el: JSX.Element) => renderToStaticMarkup(el);
const inIndex = (el: JSX.Element, index: MediaIndex | null = INDEX) => html(<MediaIndexProvider index={index}>{el}</MediaIndexProvider>);

describe('resolveImageSources: section intent', () => {
  it('prefers view for src, then card2x, then card (only as a fallback when view is missing)', () => {
    expect(resolveImageSources(tiers('https://m/x'), 'section').src).toBe('https://m/x-view.webp');
    const v = tiers('https://m/x');
    v.view = null;
    expect(resolveImageSources(v, 'section').src).toBe('https://m/x-card2x.webp');
    v.card2x = null;
    expect(resolveImageSources(v, 'section').src).toBe('https://m/x-card.webp');
  });

  it('builds a srcset of view + original only, at 100vw: never card, card2x or thumb', () => {
    const wide = resolveImageSources(tiers('https://m/x', 1600, 4000), 'section');
    expect(wide.srcSet).toBe('https://m/x-view.webp 1600w, https://m/x.png 4000w');
    expect(wide.sizes).toBe('100vw');
    expect(wide.src).toBe('https://m/x-view.webp');
    for (const small of ['card', 'card2x', 'thumb']) {
      expect(wide.srcSet).not.toContain(small);
    }
  });

  it('has no srcset when original is as wide as view or narrower: src is view on every screen', () => {
    for (const originalW of [1600, 1200]) {
      expect(resolveImageSources(tiers('https://m/x', 1600, originalW), 'section')).toEqual({
        src: 'https://m/x-view.webp',
        srcSet: undefined,
        sizes: undefined,
      });
    }
    expect(resolveImageSources(tiers('https://m/x', 1312, 1312), 'section').srcSet).toBeUndefined();
  });

  it('does not add original when its width is null', () => {
    expect(resolveImageSources(tiers('https://m/x', 1600, null), 'section').srcSet).toBeUndefined();
  });

  it('keeps original out of every other intent srcset', () => {
    for (const intent of ['card', 'card2x', 'modal', 'hero', 'avatar', 'raw'] as const) {
      expect(resolveImageSources(tiers('https://m/x', 1600, 4000), intent).srcSet ?? '').not.toContain('x.png 4000w');
    }
  });

  it('never resolves a src to original, even when only original exists', () => {
    const v = tiers('https://m/x');
    v.card = v.card2x = v.view = null;
    expect(resolveImageSources(v, 'section')).toEqual({ src: undefined, srcSet: undefined, sizes: undefined });
  });

  it('leaves the other intents\' ladders as they were', () => {
    expect(resolveImageSources(tiers('https://m/x'), 'card2x').srcSet).toBe(
      'https://m/x-card.webp 480w, https://m/x-card2x.webp 800w, https://m/x-view.webp 1600w',
    );
  });
});

describe('lookupMediaIndex / mediaIndexBackgroundUrl', () => {
  it('finds a key, and returns null for no index, a missing key, a null entry or a non-string', () => {
    expect(lookupMediaIndex(INDEX, RAW)?.view?.url).toBe('https://media.example.com/stores/1/slide-view.webp');
    expect(lookupMediaIndex(null, RAW)).toBeNull();
    expect(lookupMediaIndex(INDEX, OTHER)).toBeNull();
    expect(lookupMediaIndex(INDEX, 'https://media.example.com/svg.svg')).toBeNull();
    expect(lookupMediaIndex(INDEX, undefined)).toBeNull();
    expect(lookupMediaIndex(INDEX, 'toString')).toBeNull();
  });

  it('gives the view url for a background only when it holds as many pixels as the original', () => {
    expect(mediaIndexBackgroundUrl(INDEX, RAW)).toBe('https://media.example.com/stores/1/slide-view.webp');
    // original wider than view: a background cannot step up, so the raw url stays
    expect(mediaIndexBackgroundUrl(INDEX, WIDE)).toBe(WIDE);
    expect(mediaIndexBackgroundUrl({ [RAW]: tiers('https://m/y', 1600, 1200) }, RAW)).toBe('https://m/y-view.webp');
  });

  it('keeps the raw url for no index, an unknown url, a missing view or unknown widths', () => {
    expect(mediaIndexBackgroundUrl(INDEX, OTHER)).toBe(OTHER);
    expect(mediaIndexBackgroundUrl(null, RAW)).toBe(RAW);
    expect(mediaIndexBackgroundUrl({ [RAW]: { ...tiers('https://m/y'), view: null } }, RAW)).toBe(RAW);
    expect(mediaIndexBackgroundUrl({ [RAW]: tiers('https://m/y', 1600, null) }, RAW)).toBe(RAW);
  });
});

describe('Image with a media index', () => {
  it('uses the index entry and the section intent when the call site passes no variants', () => {
    const out = inIndex(<Image src={RAW} alt="" />);
    expect(out).toContain('src="https://media.example.com/stores/1/slide-view.webp"');
    expect(out).not.toContain('slide.png');
    expect(out).not.toContain('loading=');
  });

  it('offers a wider original to a screen that needs more pixels than view', () => {
    const out = inIndex(<Image src={WIDE} alt="" />);
    expect(out).toContain('src="https://media.example.com/stores/1/wide-view.webp"');
    expect(out).toContain('wide-view.webp 1600w, https://media.example.com/stores/1/wide.png 4000w');
    expect(out).toContain('sizes="100vw"');
    expect(out).not.toContain('wide-card');
  });

  it('ignores the call site\'s intent for an image found in the index: it always renders as a section', () => {
    for (const intent of ['hero', 'card', 'card2x', 'avatar', 'modal'] as const) {
      const out = inIndex(<Image src={WIDE} intent={intent} alt="" />);
      expect(out).toBe(inIndex(<Image src={WIDE} alt="" />));
      expect(out).toContain('wide-view.webp 1600w');
      expect(out).not.toContain('loading="lazy"');
    }
  });

  it('leaves an unknown src, a null entry and a non-string src untouched', () => {
    expect(inIndex(<Image src={OTHER} alt="" />)).toBe(html(<Image src={OTHER} alt="" />));
    expect(inIndex(<Image src={OTHER} intent="card" alt="" />)).toBe(html(<Image src={OTHER} intent="card" alt="" />));
    const svg = 'https://media.example.com/svg.svg';
    expect(inIndex(<Image src={svg} alt="" />)).toBe(html(<Image src={svg} alt="" />));
  });

  it('is byte-identical with no provider, an empty index or a null index', () => {
    const plain = html(<Image src={RAW} alt="x" className="br-photo" />);
    expect(plain).toContain(`src="${RAW}"`);
    expect(plain.toLowerCase()).not.toContain('srcset');
    expect(inIndex(<Image src={RAW} alt="x" className="br-photo" />, {})).toBe(plain);
    expect(inIndex(<Image src={RAW} alt="x" className="br-photo" />, null)).toBe(plain);
  });

  it('treats an explicit variants={null} as "no variants" and skips the lookup', () => {
    expect(inIndex(<Image src={RAW} variants={null} alt="" />)).toBe(html(<Image src={RAW} variants={null} alt="" />));
    expect(inIndex(<Image src={RAW} variants={null} alt="" />)).toContain(`src="${RAW}"`);
  });

  it('lets explicit variants win over the index, with their own intent', () => {
    const own = tiers('https://media.example.com/own');
    const out = inIndex(<Image src={RAW} variants={own} intent="card" alt="" />);
    expect(out).toContain('own-card.webp');
    expect(out).toContain('sizes="(max-width: 768px) 50vw');
    expect(out).not.toContain('slide-');
    // variants without an intent keep the old 'raw' default (original first), the index never overrides it
    expect(inIndex(<Image src={RAW} variants={own} alt="" />)).toContain('src="https://media.example.com/own.png"');
  });

  it('merges nested providers, the inner one winning', () => {
    const inner: MediaIndex = { [OTHER]: tiers('https://media.example.com/stores/1/other'), [RAW]: tiers('https://media.example.com/stores/1/inner') };
    const out = html(
      <MediaIndexProvider index={INDEX}>
        <MediaIndexProvider index={inner}>
          <Image src={RAW} alt="" />
          <Image src={OTHER} alt="" />
        </MediaIndexProvider>
        <MediaIndexProvider index={undefined}>
          <Image src={RAW} alt="" />
        </MediaIndexProvider>
      </MediaIndexProvider>,
    );
    expect(out.match(/<img[^>]*src="[^"]*inner-view\.webp"/g)).toHaveLength(1);
    expect(out).toMatch(/<img[^>]*src="[^"]*other-view\.webp"/);
    expect(out).toMatch(/<img[^>]*src="[^"]*stores\/1\/slide-view\.webp"/);
  });
});
