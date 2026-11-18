'use client';

import type { JSX } from 'react';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { ImageVariants, MediaIndex } from './types/media';

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
 * The url for a CSS `background-image`, which has no `srcset` to step up from:
 * the `view` copy only when it holds as many pixels as the original (`view.w` is
 * at least `original.w`, so the same picture in WebP), else the raw url. A
 * background is drawn full-bleed, so a copy with fewer pixels would be softer than
 * what it renders today.
 */
export function mediaIndexBackgroundUrl(index: MediaIndex | null | undefined, url: string): string {
  const variants = lookupMediaIndex(index, url);
  const view = variants?.view;
  const original = variants?.original;
  if (
    view && typeof view.url === 'string' && view.url.trim() !== '' &&
    typeof view.w === 'number' && typeof original?.w === 'number' && view.w >= original.w
  ) {
    return view.url;
  }
  return url;
}
