'use client';

import { useStorefront, useThemeStrings } from '../../provider';
import type { JSX } from 'react';
import Link from 'next/link';
import type { BlogCategory } from '../../types/page';

/**
 * Shared blog category browse bar. Links to `${basePath}/blog?category=slug`.
 * Renders nothing when the vendor has no blog categories.
 *
 * - `variant="pills"` (default): compact pill filter row.
 * - `variant="tabs"`: a full tab bar (used at the top of the blog list) with an
 *   "All" tab, one tab per category, an active-tab underline, and a subtle
 *   per-tab post count. Scrolls horizontally on overflow instead of wrapping.
 *
 * Themes style via `.core-cat-filter*` / `.core-cat-tabs*` (brand-var driven).
 */
export function CategoryFilter({
  categories,
  active,
  variant = 'pills',
  className,
}: {
  categories?: BlogCategory[] | null;
  active?: string;
  variant?: 'pills' | 'tabs';
  className?: string;
}): JSX.Element | null {
  const { basePath } = useStorefront();
  const t = useThemeStrings();

  if (!categories || categories.length === 0) {
    return null;
  }

  if (variant === 'tabs') {
    return (
      <nav
        className={`core-cat-tabs${className ? ` ${className}` : ''}`}
        aria-label={t('blog.filter.nav')}
      >
        <Link
          href={`${basePath}/blog`}
          className={`core-cat-tabs__item${!active ? ' is-active' : ''}`}
          aria-current={!active ? 'page' : undefined}
        >
          <span className="core-cat-tabs__label">{t('blog.filter.all')}</span>
        </Link>
        {categories.map((category) => {
          const isActive = active === category.slug;
          return (
            <Link
              key={category.slug}
              href={`${basePath}/blog?category=${encodeURIComponent(category.slug)}`}
              className={`core-cat-tabs__item${isActive ? ' is-active' : ''}`}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className="core-cat-tabs__label">{category.name}</span>
              {typeof category.posts_count === 'number' ? (
                <span className="core-cat-tabs__count">{category.posts_count}</span>
              ) : null}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav className={`core-cat-filter${className ? ` ${className}` : ''}`} aria-label={t('blog.filter.nav')}>
      <Link
        href={`${basePath}/blog`}
        className={`core-cat-filter__item${!active ? ' is-active' : ''}`}
        aria-current={!active ? 'page' : undefined}
      >
        {t('blog.filter.all')}
      </Link>
      {categories.map((category) => {
        const isActive = active === category.slug;
        return (
          <Link
            key={category.slug}
            href={`${basePath}/blog?category=${encodeURIComponent(category.slug)}`}
            className={`core-cat-filter__item${isActive ? ' is-active' : ''}`}
            aria-current={isActive ? 'page' : undefined}
          >
            {category.name}
          </Link>
        );
      })}
    </nav>
  );
}
