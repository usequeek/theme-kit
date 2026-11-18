'use client';

import type { JSX } from 'react';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { ImageVariantTierName, ImageVariants, MediaIndex } from './types/media';

const MediaIndexContext = createContext<MediaIndex | null>(null);

/**
 * Hands a page's `media_index` (the API's url → tier-map sidecar on every
 * Page/Post) to every kit `<Image>` and section background below it. An image
 * whose `src` is a key of the index and whose call site passes no `variants`
 * then renders a small responsive copy instead of the original upload, so a
 * theme's section photos need no code change.
 *
 * Nested providers merge, the inner page winning, so a render that combines
 * several pages (page chrome + the page) mounts one provider per page.
 * `index` undefined, null or empty leaves the parent index untouched.
 *
 * @example
 * <MediaIndexProvider index={page.media_index}>
 *   <HomePage blocks={page.content} />
 * </MediaIndexProvider>
 */
export function MediaIndexProvider({
  index,
  children,
}: {
  index?: MediaIndex | null;
  children: ReactNode;
}): JSX.Element {
  const parent = useContext(MediaIndexContext);
  const value = useMemo<MediaIndex | null>(() => {
    if (!index || Object.keys(index).length === 0) return parent;
    return parent ? { ...parent, ...index } : index;
  }, [parent, index]);

  return <MediaIndexContext.Provider value={value}>{children}</MediaIndexContext.Provider>;
}

/** The media index of the page being rendered; null outside a {@link MediaIndexProvider}. */
export function useMediaIndex(): MediaIndex | null {
  return useContext(MediaIndexContext);
}

/**
 * The tier map for a raw url, or null when there is no index, the url is not a
 * key of it, or the API sent null for it (an off-host image, an SVG, a legacy
 * upload) — the caller then keeps rendering the raw url.
 */
export function lookupMediaIndex(index: MediaIndex | null | undefined, url: unknown): ImageVariants | null {
  if (!index || typeof url !== 'string' || !Object.prototype.hasOwnProperty.call(index, url)) {
    return null;
  }
  return index[url] ?? null;
}

/**
 * The url of one tier of a raw url, for a CSS `background-image` (which has no
 * `srcset`). Falls back to the raw url when the index has no usable copy.
 */
export function mediaIndexTierUrl(
  index: MediaIndex | null | undefined,
  url: string,
  tier: ImageVariantTierName = 'view',
): string {
  const tierUrl = lookupMediaIndex(index, url)?.[tier]?.url;
  return typeof tierUrl === 'string' && tierUrl.trim() !== '' ? tierUrl : url;
}
