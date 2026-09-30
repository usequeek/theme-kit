'use client';

import { useEffect, useState } from 'react';
import { useStorefront, useStorefrontLocale } from '../provider';
import type { ApiResponse } from '../types/product';
import type { Post } from '../types/page';
import { createBrowserClient } from '../sdk/client';
import { withLocaleQuery } from '../utils/locale';

/**
 * Client-side blog-post listing, for blocks embedded on an arbitrary page
 * (e.g. the 'blog' home-page block) — mirrors useProducts' shape/pattern.
 * The blog LISTING page itself (pages/blog.tsx) gets its posts via SSR props
 * instead (fetchPosts in lib/core/api/pages.ts); this hook is for anywhere
 * else a theme needs a live post list without page-level SSR data.
 */
export function usePosts(options?: { category?: string | null; limit?: number }): { posts: Post[]; isLoading: boolean } {
  const { previewData, vendor } = useStorefront();
  const locale = useStorefrontLocale();
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const previewPosts = previewData?.posts;

    async function run(): Promise<void> {
      setIsLoading(true);

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
      } catch {
        if (!cancelled) {
          setPosts([]);
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

  return { posts, isLoading };
}
