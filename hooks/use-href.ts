import { useStorefront } from '../provider';

/**
 * Returns a function that builds storefront-relative hrefs.
 * On subdomain: href("/shop") → "/shop"
 * On path-based: href("/shop") → "/vendor-slug/shop"
 */
export function useHref() {
  const { basePath } = useStorefront();

  return (path: string) => {
    if (!path.startsWith('/')) return path;
    return `${basePath}${path}`;
  };
}
