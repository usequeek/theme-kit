import type { GalleryBlockData } from '../types/block';
import { isBlankText } from './blank-text';

type HeroSlide = GalleryBlockData['images'][number];

export interface HeroFallbacks {
  title: string;
  subtitle?: string | null;
  shopHref: string;
}

export interface ResolvedHeroContent {
  title: string;
  subtitle: string | null;
  ctaLabel: string;
  ctaHref: string;
  slideHref: string | null;
}

export function heroImageMode(images: GalleryBlockData['images']): 'zero' | 'single' | 'multi' {
  if (images.length === 0) return 'zero';
  return images.length === 1 ? 'single' : 'multi';
}

/**
 * A merchant's own slide shows exactly what they typed: a blank title, subtitle or
 * button label renders nothing (busy slide images need bare slides). The store
 * name, slogan and "Shop now" fill in only for the zero-image placeholder hero,
 * where `slide` is undefined. Callers render each part only when it is non-empty.
 */
export function resolveHeroContent(
  slide: HeroSlide | undefined,
  fallback: HeroFallbacks,
): ResolvedHeroContent {
  const ctaHref = text(slide?.cta_url) || fallback.shopHref;
  const slideHref = text(slide?.link) || null;

  if (slide === undefined) {
    return {
      title: fallback.title,
      subtitle: text(fallback.subtitle) || null,
      ctaLabel: 'Shop now',
      ctaHref,
      slideHref,
    };
  }

  return {
    title: text(slide.title),
    subtitle: text(slide.subtitle) || null,
    ctaLabel: text(slide.cta_label),
    ctaHref,
    slideHref,
  };
}

function text(value: string | null | undefined): string {
  return isBlankText(value) ? '' : (value as string).trim();
}
