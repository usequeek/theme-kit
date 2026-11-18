import type { JSX } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BlockPositionProvider } from '../block-position';
import { Image } from '../components/image';
import { PageRenderer } from '../page-renderer';
import { StorefrontContext } from '../provider';
import { ThemeProvider } from '../theme-context';
import type { Block } from '../types/block';
import type { ImageVariants } from '../types/media';
import type { ThemeModule } from '../types/theme';
import { logoSrc } from '../utils/image-srcset';

/**
 * A theme slider marks its first slide eager + fetchPriority="high" because it may be the hero. Reused lower on
 * the page (a Beaurify shelf, a closing banner) that made the browser fetch those photos with the hero. Images in
 * a block past the page's first two are lazy and never high priority; the opening blocks keep the call site's choice.
 */
describe('images below the opening blocks', () => {
  const html = (el: JSX.Element) => renderToStaticMarkup(el);
  const hero = <Image src="/hero.jpg" alt="" loading="eager" fetchPriority="high" />;

  it('keeps the call site choice in the first two blocks and outside any block', () => {
    for (const index of [0, 1]) {
      const out = html(<BlockPositionProvider index={index}>{hero}</BlockPositionProvider>);
      expect(out).toContain('loading="eager"');
      expect(out).toContain('fetchPriority="high"');
    }
    expect(html(hero)).toContain('fetchPriority="high"');
    expect(html(<BlockPositionProvider index={0}><Image src="/s.jpg" alt="" /></BlockPositionProvider>)).not.toContain('loading=');
  });

  it('lazy-loads and drops high priority from the third block on, even when the call site asked for eager', () => {
    for (const index of [2, 7]) {
      const eager = html(<BlockPositionProvider index={index}>{hero}</BlockPositionProvider>);
      expect(eager).toContain('loading="lazy"');
      expect(eager).not.toContain('fetchPriority');
      expect(html(<BlockPositionProvider index={index}><Image src="/s.jpg" alt="" /></BlockPositionProvider>)).toContain('loading="lazy"');
    }
  });

  const store = { vendor: { id: 'v1', slug: 'demo-store' }, config: {}, menus: [], basePath: '', pagesChrome: {} };
  const Slide = ({ name }: { name: string }) => <Image src={`/${name}.jpg`} alt={name} loading="eager" fetchPriority="high" />;
  const renderPage = (blocks: Block[], wrap: (el: JSX.Element) => JSX.Element = (el) => el) =>
    (html(
      <StorefrontContext.Provider value={store as never}>
        <ThemeProvider theme={{ getBlock: () => Slide } as unknown as ThemeModule}>
          {wrap(<PageRenderer blocks={blocks} />)}
        </ThemeProvider>
      </StorefrontContext.Provider>,
    ).match(/<img[^>]*>/g) ?? []);

  it('lazy-loads a card image the call site marked eager below the top', () => {
    const out = html(<BlockPositionProvider index={3}><Image src="/c.jpg" alt="" intent="card" loading="eager" /></BlockPositionProvider>);
    expect(out).toContain('loading="lazy"');
  });

  it('counts only blocks that render: a hero after an empty block keeps its priority', () => {
    const blocks = [
      { type: 'metaobjects', data: {} },
      { type: 'not-a-block-type', data: {} },
      { type: 'gallery', data: { name: 'hero' } },
      { type: 'gallery', data: { name: 'second' } },
      { type: 'gallery', data: { name: 'third' } },
    ] as unknown as Block[];
    const imgs = renderPage(blocks);
    expect(imgs).toHaveLength(3);
    expect(imgs[0]).toContain('fetchPriority="high"');
    expect(imgs[1]).toContain('loading="eager"');
    expect(imgs[2]).toContain('loading="lazy"');
  });

  it('a renderer nested in a block starts at that block\'s position', () => {
    const blocks = [{ type: 'gallery', data: { name: 'inner' } }] as unknown as Block[];
    expect(renderPage(blocks, (el) => <BlockPositionProvider index={4}>{el}</BlockPositionProvider>)[0]).toContain('loading="lazy"');
    expect(renderPage(blocks, (el) => <BlockPositionProvider index={0}>{el}</BlockPositionProvider>)[0]).toContain('fetchPriority="high"');
  });

  it('PageRenderer tells each block its position', () => {
    const imgs = renderPage(['a', 'b', 'c'].map((name) => ({ type: 'gallery', data: { name } })) as unknown as Block[]);
    expect(imgs).toHaveLength(3);
    expect(imgs[0]).toContain('fetchPriority="high"');
    expect(imgs[1]).toContain('loading="eager"');
    expect(imgs[2]).toContain('loading="lazy"');
    expect(imgs[2]).not.toContain('fetchPriority');
  });
});

describe('logoSrc', () => {
  const url = 'https://media.usequeek.com/stores/1/logo.jpg';
  const tier = (name: string, w: number) => ({ url: `https://media.usequeek.com/stores/1/logo-${name}.webp`, w, h: w });
  const variants = {
    thumb: tier('thumb', 150),
    card: tier('card', 480),
    card2x: tier('card2x', 800),
    view: tier('view', 1600),
    original: { url, w: 2048, h: 2048 },
  } as unknown as ImageVariants;

  it('renders the view copy of the logo (q98, up to 1600 px)', () => {
    expect(logoSrc(url, variants)).toBe(tier('view', 1600).url);
  });

  it('never steps down to a smaller tier: without view it keeps the upload', () => {
    expect(logoSrc(url, { ...variants, view: null } as ImageVariants)).toBe(url);
    expect(logoSrc(url, { ...variants, view: { url: '', w: 1600, h: 1600 } } as ImageVariants)).toBe(url);
  });

  it('keeps a WebP upload no wider than view: the copy is the same picture, often heavier', () => {
    const webp = 'https://media.usequeek.com/stores/1/upload.webp';
    const small = { view: { url: 'https://media.usequeek.com/stores/1/upload-view.webp', w: 1506, h: 532 }, original: { url: webp, w: 1506, h: 532 } } as unknown as ImageVariants;
    expect(logoSrc(webp, small)).toBe(webp);
    const big = { ...small, original: { url: webp, w: 3000, h: 1060 } } as unknown as ImageVariants;
    expect(logoSrc(webp, big)).toBe('https://media.usequeek.com/stores/1/upload-view.webp');
    const png = 'https://media.usequeek.com/stores/1/logo.png';
    const samePng = { view: { url: 'https://media.usequeek.com/stores/1/logo-view.webp', w: 1506, h: 532 }, original: { url: png, w: 1506, h: 532 } } as unknown as ImageVariants;
    expect(logoSrc(png, samePng)).toBe('https://media.usequeek.com/stores/1/logo-view.webp');
  });

  it('keeps the raw url without copies, or with copies of another file', () => {
    expect(logoSrc(url, null)).toBe(url);
    expect(logoSrc(url, undefined)).toBe(url);
    expect(logoSrc('https://cdn.example.com/other.svg', variants)).toBe('https://cdn.example.com/other.svg');
    expect(logoSrc(null, variants)).toBeNull();
    expect(logoSrc('', variants)).toBeNull();
  });
});
