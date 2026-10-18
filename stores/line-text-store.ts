'use client';

import { create } from 'zustand';
import { isBlankText } from '../utils/blank-text';

/** The longest text a line field may carry. Mirrors the platform limit. */
export const LINE_TEXT_MAX_LENGTH = 500;
/** Used when a registered field declares no usable `maxLength`. */
export const LINE_TEXT_DEFAULT_MAX_LENGTH = 100;

/** One text field an app asks the shopper to fill for a product line. */
export interface LineTextField {
  /** The full line property key, e.g. `app.engraving.text`. */
  key: string;
  /** The label the shopper sees, e.g. `Engraving text`. */
  label: string;
  required: boolean;
  maxLength: number;
}

interface LineTextEntry {
  /** Identity of the registration that wrote this entry. */
  owner: object;
  fields: LineTextField[];
  values: Record<string, string>;
}

interface LineTextState {
  /** Keyed by `lineTextKey(shopId, productId)`. Never persisted. */
  entries: Record<string, LineTextEntry>;
  /**
   * Declares the fields a product page renders. Call it only from an effect and
   * only for fields that are on screen; the returned function removes the
   * registration, only while it is still the current one for that product, and is
   * meant as the effect cleanup. Values already typed for a
   * key that is still declared are kept.
   */
  registerLineText: (shopId: string, productId: string, fields: LineTextField[]) => () => void;
  /** Stores what the shopper typed. The text is cleaned when it is read, not here. */
  setLineText: (shopId: string, productId: string, key: string, value: string) => void;
  /** Empties the typed values of a product and keeps its registered fields. */
  clearLineText: (shopId: string, productId: string) => void;
}

/** The text a line carries once cleaned, ready to write on a cart line. */
export interface ReadLineText {
  /** Non-blank cleaned values, keys sorted ascending. */
  properties: Record<string, string>;
  /** `{ key: label }` for exactly the keys in `properties`. */
  labels: Record<string, string>;
  /** Required fields whose cleaned value is blank, in key order. */
  missingRequired: LineTextField[];
}

export function lineTextKey(shopId: string, productId: string): string {
  return `${shopId}:${productId}`;
}

// Control characters, line and paragraph separators, and bidirectional overrides.
const UNSAFE_CHARACTERS = /[\u0000-\u001F\u007F-\u009F\u2028\u2029\u202A-\u202E\u2066-\u2069]/g;

function effectiveMaxLength(maxLength: number): number {
  if (!Number.isInteger(maxLength) || maxLength <= 0) {
    return LINE_TEXT_DEFAULT_MAX_LENGTH;
  }

  return Math.min(maxLength, LINE_TEXT_MAX_LENGTH);
}

function cleanValue(raw: unknown, maxLength: number): string {
  if (typeof raw !== 'string') {
    return '';
  }

  // Cut before deciding blank, so invisible leading characters cannot hide that
  // the text kept nothing visible. Ordinary surrounding whitespace is trimmed first
  // so it does not use up the length budget.
  const cut = Array.from(raw.replace(UNSAFE_CHARACTERS, '').trim())
    .slice(0, effectiveMaxLength(maxLength))
    .join('')
    .trimEnd();

  return isBlankText(cut) ? '' : cut;
}

/**
 * ONE store for what a shopper typed into app-declared line text fields. It is
 * deliberately not persisted: a reload starts empty, and only the cart lines
 * (which already carry the text) are kept.
 */
export const useLineTextStore = create<LineTextState>()((set, get) => ({
  entries: {},
  registerLineText: (shopId, productId, fields) => {
    const entryKey = lineTextKey(shopId, productId);
    const owner = {};
    const declared = fields.filter((field) => typeof field.key === 'string' && field.key.trim() !== '');

    set((state) => {
      const previous = state.entries[entryKey]?.values ?? {};
      const values: Record<string, string> = {};

      for (const field of declared) {
        if (typeof previous[field.key] === 'string') {
          values[field.key] = previous[field.key];
        }
      }

      return { entries: { ...state.entries, [entryKey]: { owner, fields: declared, values } } };
    });

    return () => {
      set((state) => {
        const { [entryKey]: current, ...rest } = state.entries;

        return current === undefined || current.owner !== owner ? state : { entries: rest };
      });
    };
  },
  setLineText: (shopId, productId, key, value) => {
    const entryKey = lineTextKey(shopId, productId);
    const entry = get().entries[entryKey];

    if (!entry || !entry.fields.some((field) => field.key === key)) {
      return;
    }

    set((state) => ({
      entries: { ...state.entries, [entryKey]: { ...entry, values: { ...entry.values, [key]: value } } },
    }));
  },
  clearLineText: (shopId, productId) => {
    const entryKey = lineTextKey(shopId, productId);
    const entry = get().entries[entryKey];

    if (!entry || Object.keys(entry.values).length === 0) {
      return;
    }

    set((state) => ({ entries: { ...state.entries, [entryKey]: { ...entry, values: {} } } }));
  },
}));

/**
 * The cleaned text for a product line: trimmed, control characters stripped and
 * cut to each field's `maxLength` in code points. A product with nothing
 * registered gives empty results, which is the behaviour of a kit with no line
 * text at all.
 */
export function readLineText(shopId: string, productId: string): ReadLineText {
  const entry = useLineTextStore.getState().entries[lineTextKey(shopId, productId)];
  const result: ReadLineText = { properties: {}, labels: {}, missingRequired: [] };

  if (!entry) {
    return result;
  }

  const fields = [...entry.fields].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));

  for (const field of fields) {
    const value = cleanValue(entry.values[field.key], field.maxLength);

    if (value === '') {
      if (field.required) {
        result.missingRequired.push(field);
      }

      continue;
    }

    result.properties[field.key] = value;
    result.labels[field.key] = field.label;
  }

  return result;
}
