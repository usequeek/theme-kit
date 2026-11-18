import type { JSX } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Image } from '../components/image';
import { MediaIndexProvider, lookupMediaIndex, mediaIndexTierUrl } from '../media-index';
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

const INDEX: MediaIndex = { [RAW]: tiers('https://media.example.com/stores/1/slide'), 'https://media.example.com/svg.svg': null };

const html = (el: JSX.Element) => renderToStaticMarkup(el);
const inIndex = (el: JSX.Element, index: MediaIndex | null = INDEX) => html(<MediaIndexProvider index={index}>{el}</MediaIndexProvider>);

describe('resolveImageSources: section intent', () => {
  const r = resolveImageSources(tiers('https://m/x'), 'section');

  it('prefers view for src, then card2x, then card', () => {
    expect(r.src).toBe('https://m/x-view.webp');
    const v = tiers('https://m/x');
    v.view = null;
    expect(resolveImageSources(v, 'section').src).toBe('https://m/x-card2x.webp');
    v.card2x = null;
    expect(resolveImageSources(v, 'section').src).toBe('https://m/x-card.webp');
  });

  it('builds the card/card2x/view ladder at 100vw and never lists thumb', () => {
    expect(r.srcSet).toBe('https://m/x-card.webp 480w, https://m/x-card2x.webp 800w, https://m/x-view.webp 1600w');
    expect(r.sizes).toBe('100vw');
    expect(r.srcSet).not.toContain('thumb');
  });

  it('adds original as the top candidate, with its real width, when it is wider than view', () => {
    const wide = resolveImageSources(tiers('https://m/x', 1600, 4000), 'section');
    expect(wide.srcSet).toBe(
      'https://m/x-card.webp 480w, https://m/x-card2x.webp 800w, https://m/x-view.webp 1600w, https://m/x.png 4000w',
    );
    expect(wide.src).toBe('https://m/x-view.webp');
  });

  it('does not add original twice when it is as wide as view, or narrower', () => {
    expect(resolveImageSources(tiers('https://m/x', 1600, 1600), 'section').srcSet).not.toContain('x.png');
    expect(resolveImageSources(tiers('https://m/x', 1312, 1312), 'section').srcSet).toBe(
      'https://m/x-card.webp 480w, https://m/x-card2x.webp 800w, https://m/x-view.webp 1312w',
    );
    expect(resolveImageSources(tiers('https://m/x', 1600, 1200), 'section').srcSet).not.toContain('x.png');
  });

  it('does not add original when its width is null', () => {
    expect(resolveImageSources(tiers('https://m/x', 1600, null), 'section').srcSet).not.toContain('x.png');
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
});

describe('lookupMediaIndex / mediaIndexTierUrl', () => {
  it('finds a key, and returns null for no index, a missing key, a null entry or a non-string', () => {
    expect(lookupMediaIndex(INDEX, RAW)?.view?.url).toBe('https://media.example.com/stores/1/slide-view.webp');
    expect(lookupMediaIndex(null, RAW)).toBeNull();
    expect(lookupMediaIndex(INDEX, OTHER)).toBeNull();
    expect(lookupMediaIndex(INDEX, 'https://media.example.com/svg.svg')).toBeNull();
    expect(lookupMediaIndex(INDEX, undefined)).toBeNull();
    expect(lookupMediaIndex(INDEX, 'toString')).toBeNull();
  });

  it('gives the view url for a background, else the raw url', () => {
    expect(mediaIndexTierUrl(INDEX, RAW)).toBe('https://media.example.com/stores/1/slide-view.webp');
    expect(mediaIndexTierUrl(INDEX, RAW, 'card2x')).toBe('https://media.example.com/stores/1/slide-card2x.webp');
    expect(mediaIndexTierUrl(INDEX, OTHER)).toBe(OTHER);
    expect(mediaIndexTierUrl(null, RAW)).toBe(RAW);
    const noView = { [RAW]: { ...tiers('https://m/y'), view: null } };
    expect(mediaIndexTierUrl(noView, RAW)).toBe(RAW);
  });
});

describe('Image with a media index', () => {
  it('uses the index entry and the section intent when the call site passes no variants and no intent', () => {
    const out = inIndex(<Image src={RAW} alt="" />);
    expect(out).toContain('src="https://media.example.com/stores/1/slide-view.webp"');
    expect(out).toContain('slide-card.webp 480w, https://media.example.com/stores/1/slide-card2x.webp 800w, https://media.example.com/stores/1/slide-view.webp 1600w');
    expect(out).toContain('sizes="100vw"');
    // original is not wider than view here, so it is not offered at all
    expect(out).not.toContain('slide.png');
    expect(out).not.toContain('loading=');
  });

  it('leaves an unknown src, a null entry and a non-string src untouched', () => {
    expect(inIndex(<Image src={OTHER} alt="" />)).toBe(html(<Image src={OTHER} alt="" />));
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

  it('lets explicit variants win over the index', () => {
    const own = tiers('https://media.example.com/own');
    const out = inIndex(<Image src={RAW} variants={own} intent="card" alt="" />);
    expect(out).toContain('own-card.webp');
    expect(out).not.toContain('slide-');
    // variants without an intent keep the old 'raw' default (original first), the index never overrides it
    expect(inIndex(<Image src={RAW} variants={own} alt="" />)).toContain('src="https://media.example.com/own.png"');
  });

  it('lets an explicit intent win over the section default, with the indexed variants', () => {
    const out = inIndex(<Image src={RAW} intent="card" alt="" />);
    expect(out).toContain('src="https://media.example.com/stores/1/slide-card.webp"');
    expect(out).toContain('sizes="(max-width: 768px) 50vw');
    expect(out).toContain('loading="lazy"');
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
    expect(out.match(/inner-view\.webp"/g)).toHaveLength(1);
    expect(out).toContain('other-view.webp');
    expect(out).toContain('stores/1/slide-view.webp"');
  });
});
