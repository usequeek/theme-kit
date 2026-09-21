'use client';

import type { JSX } from 'react';
import type { MetaobjectsResolved } from '../types/block';
import { EntryCard } from '../components/product-metafields';

export interface CoreMetaobjectsBlockProps extends MetaobjectsResolved {
  title?: string | null;
  layout?: 'grid' | 'list';
}

/**
 * Framework-owned "custom content" section — a merchant-picked metaobject
 * type rendered as a grid or list of entry cards, reusing the same
 * `EntryCard` a product's linked-entry metafields render. Renders nothing
 * when the type is unknown, hidden, or has no active entries (the server
 * seeds `entries: []` for all three cases — see `hydrateProductBlocks` in
 * the storefront). Each card links to `/{type}/{handle}` only when the
 * definition opted into entry pages (`has_pages`); otherwise it's inert.
 */
export function CoreMetaobjectsBlock({
  title,
  layout = 'grid',
  entries,
  definition,
}: CoreMetaobjectsBlockProps): JSX.Element | null {
  const safeEntries = Array.isArray(entries) ? entries : [];
  if (safeEntries.length === 0) return null;

  return (
    <section className={`core-block core-block-metaobjects core-block-metaobjects--${layout}`}>
      {title ? <h2 className="core-block-metaobjects__title">{title}</h2> : null}
      <div className={`core-block-metaobjects__list core-block-metaobjects__list--${layout}`}>
        {safeEntries.map((entry) =>
          definition?.has_pages ? (
            <a
              key={`${entry.type}:${entry.p_id}`}
              className="core-block-metaobjects__card-link"
              href={`/${entry.type}/${entry.handle}`}
            >
              <EntryCard entry={entry} />
            </a>
          ) : (
            <EntryCard key={`${entry.type}:${entry.p_id}`} entry={entry} />
          ),
        )}
      </div>
    </section>
  );
}
