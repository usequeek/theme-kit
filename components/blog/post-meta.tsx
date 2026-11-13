'use client';

import { useStoreDisplayFormat, useStorefront, useThemeStrings } from '../../provider';
import type { JSX } from 'react';
import type { Post } from '../../types/page';
import { Image } from '../image';
import { formatShopperDate } from '../../utils/format';

/**
 * Shared post byline: author (avatar + name, falling back to the vendor),
 * published date, and reading time. Themes place it in their post header and
 * style via `.core-post-meta*` selectors (colours inherit brand vars).
 */
export function PostMeta({ post, className }: { post: Post; className?: string }): JSX.Element {
  const { vendor } = useStorefront();
  const display = useStoreDisplayFormat();
  const t = useThemeStrings();

  const authorName = post.author?.name ?? vendor.name ?? null;
  const authorAvatar = post.author?.avatar_url ?? vendor.logo ?? null;
  const published = post.published_at
    ? formatShopperDate(post.published_at, display.locale, { year: 'numeric', month: 'long', day: 'numeric' }, display.timeZone)
    : '';
  const readingTime = post.reading_time && post.reading_time > 0 ? t('blog.meta.reading', { count: post.reading_time }) : '';

  return (
    <div className={`core-post-meta${className ? ` ${className}` : ''}`}>
      {authorName ? (
        <span className="core-post-meta__author">
          <Image
            src={authorAvatar || undefined}
            alt={authorName}
            className="core-post-meta__avatar"
            placeholder={{ label: authorName, width: 64, height: 64, variant: 'square' }}
          />
          <span className="core-post-meta__author-name">{authorName}</span>
        </span>
      ) : null}
      {published ? (
        <time className="core-post-meta__date" dateTime={post.published_at ?? undefined}>
          {published}
        </time>
      ) : null}
      {readingTime ? <span className="core-post-meta__reading">{readingTime}</span> : null}
    </div>
  );
}
