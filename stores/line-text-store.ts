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

/** One live registration: what one block or app declared for a product. */
interface LineTextRegistration {
  /** Identity of this registration; its unregister removes exactly this one. */
  id: object;
  /** Optional caller-chosen name: registering again under it replaces its earlier registration. */
  owner: string | null;
  fields: LineTextField[];
}

interface LineTextEntry {
  /** Every live registration for the product, oldest first. */
  registrations: LineTextRegistration[];
  /** What the shopper typed, by field key. */
  values: Record<string, string>;
}

interface LineTextState {
  /** Keyed by `lineTextKey(shopId, productId)`. Never persisted. */
  entries: Record<string, LineTextEntry>;
  /**
   * Declares the fields a product page renders. Call it only from an effect and
   * only for fields that are on screen; the returned function removes this
   * registration only and is meant as the effect cleanup. Several registrations
   * can be live for one product (two apps, or one block in two places): the
   * product's fields are their union, and when two declare the same key the most
   * recent declaration wins. Typed values are kept for every key that is still
   * declared. Pass `owner` to make a later call with the same name replace this
   * registration instead of adding another.
   */
  registerLineText: (shopId: string, productId: string, fields: LineTextField[], owner?: string) => () => void;
  /** Stores what the shopper typed. The text is cleaned when it is read, not here. */
  setLineText: (shopId: string, productId: string, key: string, value: string) => void;
  /** Empties the typed values of a product and keeps every live registration. */
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

/** The product's fields: the union of its live registrations, the latest declaration of a key winning. */
function effectiveFields(registrations: LineTextRegistration[]): LineTextField[] {
  const byKey = new Map<string, LineTextField>();

  for (const registration of registrations) {
    for (const field of registration.fields) {
      byKey.set(field.key, field);
    }
  }

  return [...byKey.values()];
}

/** The entry for these registrations, keeping only the values of keys still declared; null when none are live. */
function entryFor(registrations: LineTextRegistration[], values: Record<string, string>): LineTextEntry | null {
  if (registrations.length === 0) {
    return null;
  }

  const kept: Record<string, string> = {};

  for (const field of effectiveFields(registrations)) {
    if (typeof values[field.key] === 'string') {
      kept[field.key] = values[field.key];
    }
  }

  return { registrations, values: kept };
}

function withEntry(
  entries: Record<string, LineTextEntry>,
  entryKey: string,
  entry: LineTextEntry | null,
): Record<string, LineTextEntry> {
  const { [entryKey]: removed, ...rest } = entries;

  return entry === null ? rest : { ...rest, [entryKey]: entry };
}

/**
 * ONE store for what a shopper typed into app-declared line text fields. It is
 * deliberately not persisted: a reload starts empty, and only the cart lines
 * (which already carry the text) are kept.
 */
export const useLineTextStore = create<LineTextState>()((set, get) => ({
  entries: {},
  registerLineText: (shopId, productId, fields, owner) => {
    const entryKey = lineTextKey(shopId, productId);
    const registration: LineTextRegistration = {
      id: {},
      owner: owner ?? null,
      fields: fields.filter((field) => typeof field.key === 'string' && field.key.trim() !== ''),
    };

    set((state) => {
      const previous = state.entries[entryKey];
      const live = (previous?.registrations ?? []).filter((entry) => owner == null || entry.owner !== owner);

      return { entries: withEntry(state.entries, entryKey, entryFor([...live, registration], previous?.values ?? {})) };
    });

    return () => {
      set((state) => {
        const previous = state.entries[entryKey];

        if (!previous || !previous.registrations.some((entry) => entry.id === registration.id)) {
          return state;
        }

        const live = previous.registrations.filter((entry) => entry.id !== registration.id);

        return { entries: withEntry(state.entries, entryKey, entryFor(live, previous.values)) };
      });
    };
  },
  setLineText: (shopId, productId, key, value) => {
    const entryKey = lineTextKey(shopId, productId);
    const entry = get().entries[entryKey];

    if (!entry || !effectiveFields(entry.registrations).some((field) => field.key === key)) {
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

  const fields = effectiveFields(entry.registrations).sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));

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
