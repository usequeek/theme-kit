'use client';

import { useMemo } from 'react';
import type { Product } from '../types/product';
import type { Collection } from '../types/page';

export interface SearchResults {
  products: Product[];
  categories: Array<[slug: string, name: string]>;
  collections: Collection[];
}

export function useSearch(
  query: string,
  products: Product[],
  collections: Collection[],
): SearchResults {
  const filteredProducts = useMemo(() => {
    if (!query.trim()) return products.slice(0, 5);
    const q = query.toLowerCase();
    return products
      .filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.categories.some((c) => c.name.toLowerCase().includes(q)),
      )
      .slice(0, 5);
  }, [query, products]);

  const filteredCategories = useMemo(() => {
    const map = new Map<string, string>();
    products.forEach((p) =>
      p.categories.forEach((c) => {
        if (c.slug && !map.has(c.slug)) map.set(c.slug, c.name);
      }),
    );
    if (!query.trim()) return Array.from(map.entries()).slice(0, 4);
    const q = query.toLowerCase();
    return Array.from(map.entries())
      .filter(([, name]) => name.toLowerCase().includes(q))
      .slice(0, 4);
  }, [query, products]);

  const filteredCollections = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return collections.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 2);
  }, [query, collections]);

  return {
    products: filteredProducts,
    categories: filteredCategories,
    collections: filteredCollections,
  };
}
