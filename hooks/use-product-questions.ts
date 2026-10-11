'use client';

import { useEffect, useState } from 'react';
import { useStorefront, useStorefrontLocale } from '../provider';
import { createBrowserClient } from '../sdk/client';
import { withLocaleQuery } from '../utils/locale';
import { toError } from '../utils/to-error';
import type { ProductQaBlockData, ProductQuestionItem } from '../types/block';

interface ProductQuestionsResponse {
  status: string;
  data: {
    product: { id: string; slug: string; title: string };
    questions: ProductQuestionItem[];
  };
  has_more?: boolean;
  next_cursor?: string | null;
}

/**
 * Published questions and answers for one product, for a `product-qa` block.
 * Returns no questions when the block has no `product_slug`. On failure the
 * list is empty and `error` is set; the hook never throws.
 *
 * @example
 * const { questions, isLoading } = useProductQuestions({ product_slug: 'oak-chair', limit: 5 });
 */
export function useProductQuestions(options: ProductQaBlockData): {
  questions: ProductQuestionItem[];
  isLoading: boolean;
  error: Error | null;
} {
  const { vendor, previewData } = useStorefront();
  const locale = useStorefrontLocale();
  const [questions, setQuestions] = useState<ProductQuestionItem[]>(options._preview?.questions ?? []);
  const [isLoading, setIsLoading] = useState(!options._preview && !previewData);
  const [error, setError] = useState<Error | null>(null);

  const { product_slug, limit } = options;

  useEffect(() => {
    // Preview mode: use inline preview data if provided, otherwise empty.
    if (previewData) {
      if (options._preview) {
        setQuestions(options._preview.questions ?? []);
      }
      setIsLoading(false);
      return;
    }

    if (!product_slug) {
      setQuestions([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    const client = createBrowserClient(vendor.slug ?? undefined);

    const query: Record<string, string | number> = {};
    if (limit) query.limit = limit;

    async function run(): Promise<void> {
      setIsLoading(true);
      setError(null);
      try {
        const response = await client.get<ProductQuestionsResponse>(
          `/products/${encodeURIComponent(product_slug)}/questions`,
          withLocaleQuery(query, locale),
        );
        if (!cancelled) {
          setQuestions(response.data.questions ?? []);
        }
      } catch (caught) {
        if (!cancelled) {
          setQuestions([]);
          setError(toError(caught));
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
  }, [vendor.slug, previewData, product_slug, limit, locale]);

  return { questions, isLoading, error };
}
