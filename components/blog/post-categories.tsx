'use client';

import Link from 'next/link';
import type { BlogCategory } from '../../types/page';
import { useStorefront } from '../../provider';

/**
 * Renders a post's categories as links to the blog list filtered by category
 * (`${basePath}/blog?category=slug`, exactly like {@link CategoryFilter}).
 * Themes pass their own pill className via `itemClassName`. Renders nothing
 * when the post has no categories — themes keep their own tag fallback around
 * it. Wrapper carries `.core-post-cats` so themes can optionally style spacing.
 */
export function PostCategories({
  categories,
  itemClassName,
  className,
}: {
  categories?: BlogCategory[] | null;
  itemClassName?: string;
  className?: string;
}): JSX.Element | null {
  const { basePath } = useStorefront();

  if (!categories || categories.length === 0) {
    return null;
  }

  return (
    <span className={`core-post-cats${className ? ` ${className}` : ''}`}>
      {categories.map((category) => (
        <Link
          key={category.slug}
          href={`${basePath}/blog?category=${encodeURIComponent(category.slug)}`}
          className={itemClassName}
        >
          {category.name}
        </Link>
      ))}
    </span>
  );
}
