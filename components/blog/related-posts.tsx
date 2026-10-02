'use client';

import { useStorefront, useThemeStrings } from '../../provider';
import type { JSX } from 'react';
import Link from 'next/link';
import type { Post } from '../../types/page';
import { Image } from '../image';

/**
 * Shared "Related posts" grid. Renders nothing when there are no related
 * posts. Themes style via `.core-related*` selectors.
 */
export function RelatedPosts({
  posts,
  className,
  heading,
}: {
  posts?: Post[] | null;
  className?: string;
  heading?: string;
}): JSX.Element | null {
  const { basePath } = useStorefront();
  const t = useThemeStrings();
  const title = heading ?? t('blog.related.title');

  if (!posts || posts.length === 0) {
    return null;
  }

  return (
    <section className={`core-related${className ? ` ${className}` : ''}`}>
      <h2 className="core-related__heading">{title}</h2>
      <div className="core-related__grid">
        {posts.map((post) => (
          <Link key={post.id ?? post.slug} href={`${basePath}/blog/${post.slug}`} className="core-related__card">
            <div className="core-related__media">
              <Image
                src={post.cover_image_url || undefined}
                alt={post.title}
                className="core-related__img"
                placeholder={{ label: post.title, width: 600, height: 400, variant: 'card' }}
              />
            </div>
            <div className="core-related__body">
              {post.blog_categories?.[0]?.name ? (
                <span className="core-related__cat">{post.blog_categories[0].name}</span>
              ) : post.tags?.[0] ? (
                <span className="core-related__cat">{post.tags[0]}</span>
              ) : null}
              <h3 className="core-related__title">{post.title}</h3>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
