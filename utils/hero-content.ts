import type { GalleryBlockData } from '../types/block';

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

export function resolveHeroContent(
  slide: HeroSlide | undefined,
  fallback: HeroFallbacks,
): ResolvedHeroContent {
  return {
    title: slide?.title?.trim() || fallback.title,
    subtitle: slide?.subtitle?.trim() || fallback.subtitle?.trim() || null,
    ctaLabel: slide?.cta_label?.trim() || 'Shop now',
    ctaHref: slide?.cta_url?.trim() || fallback.shopHref,
    slideHref: slide?.link?.trim() || null,
  };
}
