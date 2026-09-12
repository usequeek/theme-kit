'use client';

import { useEffect, useState } from 'react';
import { useStorefront } from '../provider';
import { createBrowserClient } from '../sdk/client';
import type { ReviewItem, ReviewsBlockData, ReviewsSummary } from '../types/block';

interface ReviewsResponse {
  status: string;
  message: string;
  data: {
    scope: string;
    vendor_id: string;
    summary: ReviewsSummary;
    reviews: ReviewItem[];
  };
}

const EMPTY_SUMMARY: ReviewsSummary = {
  average_rating: 0,
  total_reviews: 0,
  rating_breakdown: { '5': 0, '4': 0, '3': 0, '2': 0, '1': 0 },
};


/**
 * Preview-mode resolution, mirroring `resolvePreviewProducts` in use-products:
 * apply the block's own filters to seeded reviews so a preview shows what the
 * configured section would really show.
 */
function resolvePreviewReviews(reviews: ReviewItem[], options: ReviewsBlockData): ReviewItem[] {
  let next = [...reviews];

  if (options.product_slug) next = next.filter((review) => review.product?.slug === options.product_slug);
  if (options.ids && options.ids.length > 0) next = next.filter((review) => options.ids?.includes(review.id));
  if (options.min_rating) next = next.filter((review) => review.rating >= options.min_rating!);
  if (options.verified_only) next = next.filter((review) => review.is_verified_purchase);
  if (options.with_media) next = next.filter((review) => (review.media?.length ?? 0) > 0);

  if (options.sort === 'highest') next.sort((left, right) => right.rating - left.rating);
  else if (options.sort === 'newest') next.sort((left, right) => right.created_at.localeCompare(left.created_at));

  return typeof options.limit === 'number' ? next.slice(0, options.limit) : next;
}

function summarize(reviews: ReviewItem[]): ReviewsSummary {
  if (reviews.length === 0) return EMPTY_SUMMARY;

  const breakdown = { ...EMPTY_SUMMARY.rating_breakdown };
  let total = 0;
  for (const review of reviews) {
    total += review.rating;
    const key = String(Math.round(review.rating)) as keyof typeof breakdown;
    if (key in breakdown) breakdown[key] += 1;
  }

  return {
    average_rating: Number((total / reviews.length).toFixed(1)),
    total_reviews: reviews.length,
    rating_breakdown: breakdown,
  };
}

export function useReviews(options: ReviewsBlockData): {
  reviews: ReviewItem[];
  summary: ReviewsSummary;
  isLoading: boolean;
} {
  const { vendor, previewData } = useStorefront();
  const seeded = options._preview?.reviews ?? (previewData?.reviews ? resolvePreviewReviews(previewData.reviews, options) : []);
  const [reviews, setReviews] = useState<ReviewItem[]>(seeded);
  const [summary, setSummary] = useState<ReviewsSummary>(options._preview?.summary ?? summarize(seeded));
  const [isLoading, setIsLoading] = useState(!options._preview && !previewData);

  const {
    scope,
    product_slug,
    ids,
    min_rating,
    verified_only,
    with_media,
    limit,
    sort,
  } = options;

  useEffect(() => {
    // Preview mode: use inline preview data if provided, otherwise empty.
    if (previewData) {
      if (options._preview) {
        setReviews(options._preview.reviews ?? []);
        setSummary(options._preview.summary ?? EMPTY_SUMMARY);
      } else if (previewData.reviews) {
        const resolved = resolvePreviewReviews(previewData.reviews, options);
        setReviews(resolved);
        setSummary(summarize(resolved));
      }
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    const client = createBrowserClient(vendor.slug ?? undefined);

    const query: Record<string, string | number> = {};
    if (scope) query.scope = scope;
    if (product_slug) query.product_slug = product_slug;
    if (min_rating) query.min_rating = min_rating;
    if (verified_only === false) query.verified_only = 0;
    if (with_media) query.with_media = 1;
    if (limit) query.limit = limit;
    if (sort) query.sort = sort;

    async function run(): Promise<void> {
      setIsLoading(true);
      try {
        let path = '/reviews';
        if (ids && ids.length > 0) {
          const params = new URLSearchParams();
          for (const [key, value] of Object.entries(query)) {
            params.set(key, String(value));
          }
          ids.forEach((id) => params.append('ids[]', id));
          path = `/reviews?${params.toString()}`;
          const response = await client.get<ReviewsResponse>(path);
          if (!cancelled) {
            setReviews(response.data.reviews ?? []);
            setSummary(response.data.summary ?? EMPTY_SUMMARY);
          }
          return;
        }

        const response = await client.get<ReviewsResponse>('/reviews', query);
        if (!cancelled) {
          setReviews(response.data.reviews ?? []);
          setSummary(response.data.summary ?? EMPTY_SUMMARY);
        }
      } catch {
        if (!cancelled) {
          setReviews([]);
          setSummary(EMPTY_SUMMARY);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    vendor.slug,
    previewData,
    scope,
    product_slug,
    JSON.stringify(ids ?? []),
    min_rating,
    verified_only,
    with_media,
    limit,
    sort,
  ]);

  return { reviews, summary, isLoading };
}
