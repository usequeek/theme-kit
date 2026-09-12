import type { MenuItem } from '../types/menu';

/**
 * Stable React key for a menu item. `label` alone isn't unique — two
 * distinct collections (or two anchors on the same page) can share a
 * display label, which then collides as a React key and can silently
 * drop/duplicate the rendered item. `index` is the final tiebreaker since
 * MenuItem carries no id and the list order is stable per render.
 */
export function menuItemKey(item: MenuItem, index: number): string {
  return `${item.type}:${item.ref ?? ''}:${item.meta?.anchor ?? ''}:${index}`;
}

export function menuItemToHref(item: MenuItem, basePath: string = ''): string {
  switch (item.type) {
    case 'page': {
      const href = `${basePath}/${item.ref}`;
      const anchor = item.meta?.anchor;
      // href may already end in "/" (the home page's ref is normalized to
      // "/" — see MenuResource::normalizeHomeRefs) — never emit a doubled
      // slash before the fragment.
      return anchor ? `${href.replace(/\/$/, '')}#${anchor}` : href;
    }
    case 'collection':
      return `${basePath}/collections/${item.ref}`;
    case 'collections':
      return `${basePath}/collections`;
    case 'shop':
      return `${basePath}/shop`;
    case 'blog':
      return `${basePath}/blog`;
    case 'post':
      return `${basePath}/blog/${item.ref}`;
    case 'gallery':
      return `${basePath}/gallery/${item.ref}`;
    case 'url':
      return item.ref ?? '#';
    default:
      return '#';
  }
}
