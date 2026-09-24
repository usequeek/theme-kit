import type { JSX } from 'react';
import type {
  MetafieldScalar,
  MetafieldValue,
  MetaobjectEntry,
  Product,
} from '../types/product';
import { formatDisplayDate } from '../utils/format';

export interface ProductMetafieldDefinitionLabels {
  [key: string]: { name: string; type: string };
}

export interface ProductMetafieldsProps {
  product: Product;
  definitions?: ProductMetafieldDefinitionLabels;
}

/**
 * Core-owned product metafields section — the AuthFlow pattern: themes
 * import-and-place it, never re-implement it.
 *
 * Renders the product's presented metafields (all types), with linked
 * metaobject entries as cards. Renders nothing when there are no visible
 * values. Markup carries `core-metafields*` classes so each theme styles it
 * in its own `theme.css` (framework-owned styling contract) — no theme CSS
 * lives in core.
 */

function isEntry(value: unknown): value is MetaobjectEntry {
  return (
    !!value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    typeof (value as MetaobjectEntry).display_name === 'string' &&
    typeof (value as MetaobjectEntry).handle === 'string'
  );
}

/** `care_instructions` → `Care instructions`; unknown handles label from the key. */
export function humaniseMetafieldKey(key: string): string {
  const words = key.replace(/[_-]+/g, ' ').trim();
  if (words === '') return key;

  return words.charAt(0).toUpperCase() + words.slice(1);
}

function labelFor(key: string, definitions?: ProductMetafieldDefinitionLabels): string {
  const name = definitions?.[key]?.name?.trim();
  return name && name !== '' ? name : humaniseMetafieldKey(key);
}

function typeFor(key: string, definitions?: ProductMetafieldDefinitionLabels): string {
  return definitions?.[key]?.type ?? '';
}

function isVisibleScalar(value: MetafieldScalar): boolean {
  if (typeof value === 'string') return value.trim() !== '';
  return true;
}

function isVisibleValue(value: MetafieldValue): boolean {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.some((item) => (isEntry(item) ? true : isVisibleScalar(item as MetafieldScalar)));
  if (isEntry(value)) return true;
  return isVisibleScalar(value as MetafieldScalar);
}

function normaliseBoolean(value: MetafieldValue): boolean | null {
  if (typeof value === 'boolean') return value;
  if (value === 1 || value === '1' || value === 'true') return true;
  if (value === 0 || value === '0' || value === 'false') return false;
  return null;
}

const IMAGE_URL_PATTERN = /^https?:\/\/\S+\.(jpg|jpeg|png|gif|webp|avif)(\?\S*)?$/i;

function renderScalar(value: MetafieldScalar, key: string, label: string, type: string): JSX.Element {
  if (typeof value === 'boolean' || (type === 'boolean' && normaliseBoolean(value) !== null)) {
    const yes = typeof value === 'boolean' ? value : normaliseBoolean(value) === true;
    return <p className="core-metafields__text">{yes ? 'Yes' : 'No'}</p>;
  }

  const text = String(value);

  if (type === 'url') {
    return /^https?:\/\//i.test(text) ? (
      <a className="core-metafields__link" href={text} target="_blank" rel="noopener noreferrer">
        {text}
      </a>
    ) : (
      <p className="core-metafields__text">{text}</p>
    );
  }

  if (type === 'media_id') {
    return /^https?:\/\//i.test(text) ? (
      // Media values arrive as resolved URLs (media contract) — plain <img>:
      // this is core, not a theme, so the themes' <Image> rule doesn't apply.
      <img className="core-metafields__image" src={text} alt={label} loading="lazy" />
    ) : (
      <p className="core-metafields__text">{text}</p>
    );
  }

  if (type === 'date') {
    const time = new Date(text).getTime();
    return (
      <p className="core-metafields__text">
        {Number.isNaN(time) ? text : formatDisplayDate(time, {})}
      </p>
    );
  }

  if (type === 'multi_line_text' || type === 'rich_text') {
    return <pre className="core-metafields__pre">{text}</pre>;
  }

  // Entry sub-fields carry no per-field type — an image-looking URL renders
  // as an image, everything else as text.
  if (type === '' && IMAGE_URL_PATTERN.test(text)) {
    return <img className="core-metafields__image" src={text} alt={label} loading="lazy" />;
  }

  return <p className="core-metafields__text">{text}</p>;
}

function renderEntryField(value: MetafieldScalar | MetafieldScalar[], fieldKey: string): JSX.Element {
  if (Array.isArray(value)) {
    return (
      <ul className="core-metafields__list">
        {value.map((item, index) => (
          // Entry values are flat scalars; the index is stable per render.
          // eslint-disable-next-line react/no-array-index-key
          <li key={index} className="core-metafields__list-item">
            {typeof item === 'boolean' ? (item ? 'Yes' : 'No') : String(item)}
          </li>
        ))}
      </ul>
    );
  }

  return renderScalar(value, fieldKey, humaniseMetafieldKey(fieldKey), '');
}

/**
 * Renders one linked metaobject entry as a card — shared by
 * `ProductMetafields` (a product's linked entries), `CoreMetaobjectsBlock`
 * (a section listing a type's entries) and `DefaultMetaobjectPage` (via
 * `renderValue` below, for entry detail pages). Exported so those two
 * consumers never re-implement entry-card markup.
 */
export function EntryCard({ entry }: { entry: MetaobjectEntry }): JSX.Element {
  const fields = entry.fields && typeof entry.fields === 'object' ? entry.fields : {};

  return (
    <article className="core-metafields__entry-card">
      <h4 className="core-metafields__entry-title">{entry.display_name}</h4>
      {Object.entries(fields).map(([fieldKey, fieldValue]) => (
        <div className="core-metafields__entry-field" key={fieldKey}>
          <span className="core-metafields__entry-field-label">{humaniseMetafieldKey(fieldKey)}</span>
          <div className="core-metafields__entry-field-value">
            {renderEntryField(fieldValue as MetafieldScalar | MetafieldScalar[], fieldKey)}
          </div>
        </div>
      ))}
    </article>
  );
}

/**
 * Per-type value renderer — scalar, scalar list, linked entry, or list of
 * entries — shared by `ProductMetafields` and `DefaultMetaobjectPage` (a
 * metaobject entry's own fields are always flat scalars, never nested
 * entries, so this same function covers both without a second renderer).
 */
export function renderValue(value: MetafieldValue, fieldKey: string, label: string, type: string): JSX.Element {
  if (isEntry(value)) {
    return <EntryCard entry={value} />;
  }

  if (Array.isArray(value)) {
    if (value.length > 0 && value.every((item) => isEntry(item))) {
      return (
        <div className="core-metafields__entry-grid">
          {(value as MetaobjectEntry[]).map((entry) => (
            <EntryCard key={`${entry.type}:${entry.p_id}`} entry={entry} />
          ))}
        </div>
      );
    }

    return (
      <ul className="core-metafields__list">
        {(value as MetafieldScalar[]).map((item, index) => (
          // Presented lists are value snapshots; the index is stable per render.
          // eslint-disable-next-line react/no-array-index-key
          <li key={index} className="core-metafields__list-item">
            {typeof item === 'boolean' ? (item ? 'Yes' : 'No') : String(item)}
          </li>
        ))}
      </ul>
    );
  }

  return renderScalar(value as MetafieldScalar, fieldKey, label, type);
}

export function ProductMetafields({ product, definitions }: ProductMetafieldsProps): JSX.Element | null {
  const metafields = product.metafields && typeof product.metafields === 'object' ? product.metafields : {};
  const visible = Object.entries(metafields).filter(([, value]) => isVisibleValue(value as MetafieldValue));

  if (visible.length === 0) return null;

  return (
    <section className="core-metafields" aria-label="Product details">
      {visible.map(([key, value]) => (
        <div className="core-metafields__field" key={key}>
          <h3 className="core-metafields__label">{labelFor(key, definitions)}</h3>
          <div className="core-metafields__value">
            {renderValue(value as MetafieldValue, key, labelFor(key, definitions), typeFor(key, definitions))}
          </div>
        </div>
      ))}
    </section>
  );
}
