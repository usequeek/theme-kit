'use client';

import { useEffect, useState } from 'react';
import { useStorefront, useStorefrontLocale } from '../provider';
import { createBrowserClient } from '../sdk/client';
import { withLocaleQuery } from '../utils/locale';
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

export function useProductQuestions(options: ProductQaBlockData): {
  questions: ProductQuestionItem[];
  isLoading: boolean;
} {
  const { vendor, previewData } = useStorefront();
  const locale = useStorefrontLocale();
  const [questions, setQuestions] = useState<ProductQuestionItem[]>(options._preview?.questions ?? []);
  const [isLoading, setIsLoading] = useState(!options._preview && !previewData);

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
      try {
        const response = await client.get<ProductQuestionsResponse>(
          `/products/${product_slug}/questions`,
          withLocaleQuery(query, locale),
        );
        if (!cancelled) {
          setQuestions(response.data.questions ?? []);
        }
      } catch {
        if (!cancelled) {
          setQuestions([]);
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

  return { questions, isLoading };
}
