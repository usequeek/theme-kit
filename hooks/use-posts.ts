'use client';

import { useEffect, useState } from 'react';
import { useStorefront, useStorefrontLocale } from '../provider';
import type { ApiResponse } from '../types/product';
import type { Post } from '../types/page';
import { createBrowserClient } from '../sdk/client';
import { withLocaleQuery } from '../utils/locale';
import { toError } from '../utils/to-error';

/**
 * A live list of blog posts, for a block on any page (such as the home page
 * `blog` block). Takes the same shape as {@link useProducts}: `isLoading`,
 * plus `error` when the request fails.
 *
 * The blog listing page itself receives its posts as server-rendered props;
 * use this hook everywhere else a theme needs posts without page-level data.
 *
 * @example
 * const { posts, isLoading } = usePosts({ category: 'news', limit: 3 });
 */
export function usePosts(options?: { category?: string | null; limit?: number }): { posts: Post[]; isLoading: boolean; error: Error | null } {
  const { previewData, vendor } = useStorefront();
  const locale = useStorefrontLocale();
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    const previewPosts = previewData?.posts;

    async function run(): Promise<void> {
      setIsLoading(true);
      setError(null);

      try {
        if (Array.isArray(previewPosts)) {
          let next = [...previewPosts];

          if (options?.category) {
            next = next.filter((post) => post.blog_categories?.some((category) => category.slug === options.category));
          }

          if (typeof options?.limit === 'number') {
            next = next.slice(0, options.limit);
          }

          if (!cancelled) {
            setPosts(next);
          }
          return;
        }

        const client = createBrowserClient(vendor.slug ?? undefined);
        const query: Record<string, string | number> = {};
        if (options?.category) query.category = options.category;
        if (options?.limit) query.per_page = options.limit;

        const response = await client.get<ApiResponse<Post[]>>('/posts', withLocaleQuery(query, locale));

        if (!cancelled) {
          setPosts(response.data ?? []);
        }
      } catch (caught) {
        if (!cancelled) {
          setPosts([]);
          setError(toError(caught));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [options?.category, options?.limit, previewData?.posts, vendor.slug, locale]);

  return { posts, isLoading, error };
}
