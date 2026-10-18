import { isBlankText } from './blank-text';

/**
 * Key endings that carry a bearer link or token, dot-prefixed so a derived key
 * `app.<ns>.<field key>` ends in one only when the field key is exactly `claim`,
 * `reschedule_url` or `cancel_url`. Parity constant: keep it equal to the
 * platform list. Internal: not part of the public barrels.
 */
const BEARER_PROPERTY_SUFFIXES = ['.claim', '.reschedule_url', '.cancel_url'] as const;

export interface LineProperty {
  key: string;
  label: string;
  value: string;
}

interface LinePropertiesSource {
  properties?: Record<string, unknown> | null;
  property_labels?: Record<string, unknown> | null;
}

/**
 * The text a shopper typed on a line, as rows ready to render: only keys that
 * carry a declared label, with a non-blank string value, sorted by key. A key
 * without a label, a bearer key, a blank value and a non-string value never
 * appear, so a line from any source shows nothing it was not declared to show.
 * Render `label` and `value` as text.
 *
 * @example
 * visibleLineProperties(item).map(({ key, label, value }) => <p key={key}>{label}: {value}</p>)
 */
export function visibleLineProperties(source: LinePropertiesSource): LineProperty[] {
  const properties = source.properties;
  const labels = source.property_labels;

  if (!properties || !labels) {
    return [];
  }

  const rows: LineProperty[] = [];

  for (const key of Object.keys(properties).sort()) {
    const value = properties[key];
    const label = labels[key];

    if (typeof value !== 'string' || isBlankText(value)) {
      continue;
    }

    if (typeof label !== 'string' || isBlankText(label)) {
      continue;
    }

    if (BEARER_PROPERTY_SUFFIXES.some((suffix) => key.endsWith(suffix))) {
      continue;
    }

    rows.push({ key, label, value });
  }

  return rows;
}
