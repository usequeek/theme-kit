import type { JSX } from 'react';
import type { MetaobjectPageProps } from '../types/theme';
import { humaniseMetafieldKey, renderValue } from './product-metafields';

/**
 * Core-owned fallback for a metaobject entry's own page — used when the
 * active theme doesn't provide `theme.pages.Metaobject`. Same field-label
 * and per-type value rendering as `ProductMetafields`/`CoreMetaobjectsBlock`
 * (via the shared `renderValue`), so an entry looks the same whether it's
 * embedded in a product's metafields or viewed on its own page. Markup
 * carries `core-metaobject-page*` classes for theme.css styling.
 */
export function DefaultMetaobjectPage({ entry, definition }: MetaobjectPageProps): JSX.Element {
  const fields = entry.fields && typeof entry.fields === 'object' ? entry.fields : {};
  const fieldMeta = new Map(definition.fields.map((field) => [field.key, field]));

  return (
    <article className="core-metaobject-page">
      <header className="core-metaobject-page__header">
        <h1 className="core-metaobject-page__title">{entry.display_name}</h1>
      </header>
      <div className="core-metaobject-page__fields">
        {Object.entries(fields).map(([key, value]) => {
          const meta = fieldMeta.get(key);
          const label = meta?.name?.trim() || humaniseMetafieldKey(key);
          const type = meta?.type ?? '';

          return (
            <div className="core-metaobject-page__field" key={key}>
              <h3 className="core-metaobject-page__label">{label}</h3>
              <div className="core-metaobject-page__value">
                {renderValue(value, key, label, type)}
              </div>
            </div>
          );
        })}
      </div>
    </article>
  );
}
