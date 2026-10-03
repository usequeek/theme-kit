'use client';

import { useStorefront, useThemeStrings } from '../../provider';
import type { JSX } from 'react';
import Link from 'next/link';
import type { Pagination } from '../../types/page';

/**
 * Shared blog pagination (Prev / "Page N" / Next). SSR page-based navigation
 * preserving the active category. The API sends no totals, so there is no
 * "of M": `has_more` enables Next, page > 1 enables Previous. Renders nothing
 * on a lone first page. Themes style via `.core-pagination*` selectors.
 */
export function BlogPagination({
  pagination,
  category,
  className,
}: {
  pagination?: Pagination;
  category?: string;
  className?: string;
}): JSX.Element | null {
  const { basePath } = useStorefront();
  const t = useThemeStrings();

  if (!pagination) {
    return null;
  }

  const current = pagination.current_page ?? 1;
  const hasNext = pagination.has_more ?? false;
  const hasPrev = current > 1;

  if (!hasNext && !hasPrev) {
    return null;
  }

  const buildHref = (page: number): string => {
    const params = new URLSearchParams();
    if (category) {
      params.set('category', category);
    }
    if (page > 1) {
      params.set('page', String(page));
    }
    const query = params.toString();
    return `${basePath}/blog${query ? `?${query}` : ''}`;
  };

  return (
    <nav className={`core-pagination${className ? ` ${className}` : ''}`} aria-label={t('blog.pagination.nav')}>
      {hasPrev ? (
        <Link href={buildHref(current - 1)} className="core-pagination__link" rel="prev">
          {t('blog.pagination.prev')}
        </Link>
      ) : (
        <span className="core-pagination__link is-disabled" aria-disabled="true">
          {t('blog.pagination.prev')}
        </span>
      )}
      <span className="core-pagination__status">{t('blog.pagination.page', { current })}</span>
      {hasNext ? (
        <Link href={buildHref(current + 1)} className="core-pagination__link" rel="next">
          {t('blog.pagination.next')}
        </Link>
      ) : (
        <span className="core-pagination__link is-disabled" aria-disabled="true">
          {t('blog.pagination.next')}
        </span>
      )}
    </nav>
  );
}
