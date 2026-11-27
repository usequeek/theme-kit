import type { JSX } from 'react';

/**
 * The rows a search sheet shows in its results area while the catalogue is still being read: the first time a
 * sheet opens, its list is not loaded yet (see `useProductSections({ enabled })`). Open the sheet at once and
 * render this where the results go, never an empty list and never a "no matches" line. Uses the shell's
 * `core-skeleton` shimmer when present and a plain tint otherwise; no text, so it needs no string.
 */
export function SearchResultsLoading({ rows = 4 }: { rows?: number }): JSX.Element {
  return (
    <div role="status" aria-busy="true" data-search-loading="" style={{ display: 'grid', gap: 12, width: '100%', gridColumn: '1 / -1' }}>
      {Array.from({ length: rows }, (_, index) => (
        <span key={index} className="core-skeleton" style={{ height: 56, backgroundColor: 'rgba(128, 128, 128, 0.12)' }} />
      ))}
    </div>
  );
}
