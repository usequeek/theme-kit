'use client';

import Link from 'next/link';
import type { Pagination } from '../../types/page';
import { useStorefront } from '../../provider';

/**
 * Shared blog pagination (Prev / page indicator / Next). SSR page-based
 * navigation preserving the active category. Renders nothing when there is
 * only a single page. Themes style via `.core-pagination*` selectors.
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

  if (!pagination) {
    return null;
  }

  const current = pagination.current_page ?? 1;
  const perPage = pagination.per_page ?? 0;
  const total = pagination.total ?? 0;
  const lastPage = perPage > 0 && total > 0 ? Math.ceil(total / perPage) : undefined;
  const hasNext = pagination.has_more ?? (lastPage ? current < lastPage : false);
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
    <nav className={`core-pagination${className ? ` ${className}` : ''}`} aria-label="Blog pagination">
      {hasPrev ? (
        <Link href={buildHref(current - 1)} className="core-pagination__link" rel="prev">
          ← Previous
        </Link>
      ) : (
        <span className="core-pagination__link is-disabled" aria-disabled="true">
          ← Previous
        </span>
      )}
      <span className="core-pagination__status">{lastPage ? `Page ${current} of ${lastPage}` : `Page ${current}`}</span>
      {hasNext ? (
        <Link href={buildHref(current + 1)} className="core-pagination__link" rel="next">
          Next →
        </Link>
      ) : (
        <span className="core-pagination__link is-disabled" aria-disabled="true">
          Next →
        </span>
      )}
    </nav>
  );
}
