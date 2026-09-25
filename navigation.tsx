'use client';

/**
 * How a theme links and moves between pages. Themes import these, never
 * `next/link` or `next/navigation`: which framework runs the storefront is
 * Queek's decision, and a theme written against this module keeps working
 * when that changes — only this file does.
 *
 *   import { Link, useRouter, usePathname } from '@usequeek/theme-kit/navigation';
 *
 * The surface is deliberately small (what every theme so far has needed).
 * Ask for an addition rather than reaching past it to the framework.
 */
import NextLink from 'next/link';
import { usePathname as useFrameworkPathname, useRouter as useFrameworkRouter } from 'next/navigation';
import { useMemo, type AnchorHTMLAttributes, type ReactNode, type Ref } from 'react';

export interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  /** A path inside the store (`menuItemToHref()`, `useHref()`) or a full URL. */
  href: string;
  /** Load the page in the background before it is clicked. Leave unset and the storefront decides. */
  prefetch?: boolean;
  /** Replace the current history entry instead of adding one. */
  replace?: boolean;
  ref?: Ref<HTMLAnchorElement>;
  children?: ReactNode;
}

/** An `<a>` that moves inside the store without a full page load. */
export function Link({ href, prefetch, replace, ...anchor }: LinkProps) {
  return <NextLink href={href} prefetch={prefetch} replace={replace} {...anchor} />;
}

export interface Router {
  /** Go to `href`, adding a history entry. */
  push(href: string): void;
  /** Go to `href`, replacing the current history entry. */
  replace(href: string): void;
  back(): void;
  /** Re-render the current page with fresh data from the server. */
  refresh(): void;
}

/** Move between pages from code — after a form submits, a filter changes, a search runs. */
export function useRouter(): Router {
  const router = useFrameworkRouter();
  return useMemo(() => ({
    push: (href: string) => router.push(href),
    replace: (href: string) => router.replace(href),
    back: () => router.back(),
    refresh: () => router.refresh(),
  }), [router]);
}

/** The current path, e.g. `/medley/shop` — to mark the active menu item. */
export function usePathname(): string {
  return useFrameworkPathname() ?? '';
}
