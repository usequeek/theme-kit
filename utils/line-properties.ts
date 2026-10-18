/**
 * Key endings that carry a bearer link or token. The platform never accepts them
 * as shopper text and the kit never shows them. Mirrors the backend list.
 */
export const BEARER_PROPERTY_SUFFIXES = ['claim', 'reschedule_url', 'cancel_url'] as const;

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

    if (typeof value !== 'string' || value.trim() === '') {
      continue;
    }

    if (typeof label !== 'string' || label.trim() === '') {
      continue;
    }

    if (BEARER_PROPERTY_SUFFIXES.some((suffix) => key.endsWith(suffix))) {
      continue;
    }

    rows.push({ key, label, value });
  }

  return rows;
}
