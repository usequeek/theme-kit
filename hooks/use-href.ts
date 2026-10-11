import { useStorefront } from '../provider';

/**
 * Returns a function that turns a store path into a link target. A store served
 * on its own domain keeps `/shop` as `/shop`; a store served under a path
 * prefix gets `/<store-slug>/shop`. Anything that does not start with `/`
 * (a full URL, `#anchor`, `mailto:`) is returned unchanged.
 *
 * @example
 * const href = useHref();
 * <Link href={href('/shop')}>Shop</Link>
 */
export function useHref(): (path: string) => string {
  const { basePath } = useStorefront();

  return (path: string) => {
    if (!path.startsWith('/')) return path;
    return `${basePath}${path}`;
  };
}
