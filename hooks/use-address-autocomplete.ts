'use client';

import { useEffect, useState } from 'react';
import { useStorefront } from '../provider';
import { getQueekClient } from '../sdk/queek-client';

/** One address suggestion. Pass `place_id` to `useResolveCoordinates` to get its position. */
export interface AddressSuggestion {
  description: string;
  place_id: string;
}

const DEBOUNCE_MS = 300;

/**
 * Address suggestions for what the shopper has typed, after a 300 ms pause.
 * Nothing is requested for fewer than two characters. A failed request clears
 * the suggestions rather than throwing, so the field stays usable.
 *
 * @example
 * const { suggestions, loading } = useAddressAutocomplete(text);
 */
export function useAddressAutocomplete(query: string): {
  suggestions: AddressSuggestion[];
  loading: boolean;
} {
  const { vendor } = useStorefront();
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query || query.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      setLoading(true);
      const client = getQueekClient(vendor.slug ?? undefined);
      const path = `/client/address/autocomplete?query=${encodeURIComponent(query.trim())}`;

      client
        .get<AddressSuggestion[] | { data: AddressSuggestion[] }>(path)
        .then((res) => {
          if (cancelled) return;
          // Backend returns a bare array (not wrapped in envelope). SDK returns
          // whatever the server sent — handle both shapes defensively.
          const list: unknown = Array.isArray(res)
            ? res
            : Array.isArray((res as { data?: unknown })?.data)
              ? (res as { data: AddressSuggestion[] }).data
              : [];
          setSuggestions(list as AddressSuggestion[]);
        })
        .catch(() => {
          if (!cancelled) setSuggestions([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, vendor.slug]);

  return { suggestions, loading };
}
