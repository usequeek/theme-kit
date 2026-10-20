import type { JSX } from 'react';
import type { Collection, Post } from '../types/page';
import type {
  MetafieldScalar,
  MetafieldValue,
  MetaobjectEntry,
  Product,
  ProductVariant,
} from '../types/product';
import { formatDisplayDate } from '../utils/format';

/** Merchant-set labels and types for custom fields, keyed by field key. Passed as `metafieldDefinitions` on the product page. */
export interface ProductMetafieldDefinitionLabels {
  [key: string]: { name: string; type: string };
}

/** What a custom-field section hangs off — the owner types the public API serves values for. */
export type MetafieldOwner = 'product' | 'variant' | 'collection' | 'post';

/** Props for {@link ProductMetafields}. */
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
 * in its own `theme.css` — no theme CSS ships in the kit.
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

/**
 * A definition is found under the value's own key (`custom.fabric`, how the API
 * keys every presented value) or, for a bare-keyed map, under the part after
 * the namespace (`fabric`).
 */
function definitionFor(key: string, definitions?: ProductMetafieldDefinitionLabels): { name: string; type: string } | undefined {
  if (!definitions) return undefined;
  const dot = key.indexOf('.');

  return definitions[key] ?? (dot > 0 ? definitions[key.slice(dot + 1)] : undefined);
}

function labelFor(key: string, definitions?: ProductMetafieldDefinitionLabels): string {
  const name = definitionFor(key, definitions)?.name?.trim();
  return name && name !== '' ? name : humaniseMetafieldKey(key);
}

function typeFor(key: string, definitions?: ProductMetafieldDefinitionLabels): string {
  return definitionFor(key, definitions)?.type ?? '';
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
      // Media values arrive as resolved URLs — plain <img>:
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

const SECTION_LABELS: Record<MetafieldOwner, string> = {
  product: 'Product details',
  variant: 'Variant details',
  collection: 'Collection details',
  post: 'Post details',
};

/** Props for {@link Metafields}. */
export interface MetafieldsProps {
  /** What the values belong to: sets the section's accessible name and, off the product, a `core-metafields--<owner>` class. */
  owner: MetafieldOwner;
  /** The owner's presented `metafields` (`product.metafields`, `collection.metafields`, …). */
  metafields?: Record<string, MetafieldValue>;
  /** The page's `metafieldDefinitions` (`variantMetafieldDefinitions` for variants) — labels and types. */
  definitions?: ProductMetafieldDefinitionLabels;
}

/**
 * The one custom-fields section behind every owner. Renders the owner's
 * presented values (all types, linked metaobject entries as cards) under their
 * definition labels, and nothing when there is no visible value. Same
 * `core-metafields*` markup for every owner, so a theme's existing styling
 * covers collections, posts and variants too; off the product the root also
 * carries `core-metafields--<owner>` for owner-specific rules.
 *
 * @example
 * <Metafields owner="collection" metafields={collection.metafields} definitions={metafieldDefinitions} />
 */
export function Metafields({ owner, metafields, definitions }: MetafieldsProps): JSX.Element | null {
  const values = metafields && typeof metafields === 'object' && !Array.isArray(metafields) ? metafields : {};
  const visible = Object.entries(values).filter(([, value]) => isVisibleValue(value as MetafieldValue));

  if (visible.length === 0) return null;

  return (
    <section
      className={owner === 'product' ? 'core-metafields' : `core-metafields core-metafields--${owner}`}
      aria-label={SECTION_LABELS[owner]}
    >
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

/**
 * Place this on the product page to show the product's custom fields.
 * Renders nothing when there are none to show.
 *
 * @example
 * <ProductMetafields product={product} definitions={metafieldDefinitions} />
 */
export function ProductMetafields({ product, definitions }: ProductMetafieldsProps): JSX.Element | null {
  return <Metafields owner="product" metafields={product.metafields} definitions={definitions} />;
}

/**
 * Place this on the collection page to show the collection's custom fields.
 *
 * @example
 * <CollectionMetafields collection={collection} definitions={metafieldDefinitions} />
 */
export function CollectionMetafields({ collection, definitions }: { collection: Collection; definitions?: ProductMetafieldDefinitionLabels }): JSX.Element | null {
  return <Metafields owner="collection" metafields={collection.metafields} definitions={definitions} />;
}

/**
 * Place this on the blog post page to show the post's custom fields.
 *
 * @example
 * <PostMetafields post={post} definitions={metafieldDefinitions} />
 */
export function PostMetafields({ post, definitions }: { post: Post; definitions?: ProductMetafieldDefinitionLabels }): JSX.Element | null {
  return <Metafields owner="post" metafields={post.metafields} definitions={definitions} />;
}

/**
 * Show one variant's custom fields (the selected variant on the product page).
 * `definitions` is the page's `variantMetafieldDefinitions`.
 *
 * @example
 * <VariantMetafields variant={selectedVariant} definitions={variantMetafieldDefinitions} />
 */
export function VariantMetafields({ variant, definitions }: { variant: Pick<ProductVariant, 'metafields'>; definitions?: ProductMetafieldDefinitionLabels }): JSX.Element | null {
  return <Metafields owner="variant" metafields={variant.metafields} definitions={definitions} />;
}
