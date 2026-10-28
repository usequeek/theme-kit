import { describe, expect, it } from 'vitest';

import { resolveHeroContent } from '../utils/hero-content';

const fallback = { title: 'Deen fit store', subtitle: 'Fit for every day', shopHref: '/shop' };
const invisible = [0x200b, 0x200d, 0x2060, 0xfeff, 0x200e, 0xa0].map((code) => String.fromCharCode(code)).join('');

describe('resolveHeroContent', () => {
  it('the zero-image placeholder hero falls back to store name, slogan and Shop now', () => {
    expect(resolveHeroContent(undefined, fallback)).toEqual({
      title: 'Deen fit store',
      subtitle: 'Fit for every day',
      ctaLabel: 'Shop now',
      ctaHref: '/shop',
      slideHref: null,
    });
  });

  it('the placeholder hero has no subtitle when the store has no slogan', () => {
    expect(resolveHeroContent(undefined, { ...fallback, subtitle: `  ${invisible} ` }).subtitle).toBeNull();
  });

  it("a merchant's slide with empty fields renders no text and no button", () => {
    expect(resolveHeroContent({ url: 'https://cdn/a.jpg' }, fallback)).toEqual({
      title: '',
      subtitle: null,
      ctaLabel: '',
      ctaHref: '/shop',
      slideHref: null,
    });
  });

  it.each([
    ['empty strings', ''],
    ['whitespace', '   '],
    ['invisible characters only', invisible],
  ])('a slide whose fields are %s stays bare', (_, value) => {
    expect(
      resolveHeroContent({ url: 'https://cdn/a.jpg', title: value, subtitle: value, cta_label: value }, fallback),
    ).toMatchObject({ title: '', subtitle: null, ctaLabel: '' });
  });

  it('a null field never falls back to the store', () => {
    expect(
      resolveHeroContent({ url: 'https://cdn/a.jpg', title: null, subtitle: null, cta_label: null }, fallback),
    ).toMatchObject({ title: '', subtitle: null, ctaLabel: '' });
  });

  it("a slide shows exactly what the merchant typed, trimmed", () => {
    expect(
      resolveHeroContent(
        {
          url: 'https://cdn/a.jpg',
          title: ' Summer drop ',
          subtitle: 'New in',
          cta_label: 'See it',
          cta_url: '/collections/summer',
          link: '/p/1',
        },
        fallback,
      ),
    ).toEqual({ title: 'Summer drop', subtitle: 'New in', ctaLabel: 'See it', ctaHref: '/collections/summer', slideHref: '/p/1' });
  });

  it('a title alone does not bring in the slogan or a button', () => {
    expect(resolveHeroContent({ url: 'https://cdn/a.jpg', title: 'Only a heading' }, fallback)).toMatchObject({
      title: 'Only a heading',
      subtitle: null,
      ctaLabel: '',
    });
  });
});
