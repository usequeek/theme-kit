import { describe, expect, it } from 'vitest';
import { visibleLineProperties } from '../utils/line-properties';

describe('visibleLineProperties', () => {
  it('labelled keys only', () => {
    expect(
      visibleLineProperties({
        properties: { 'app.b.note': 'Gift', 'app.a.text': 'Ada', 'app.c.plain': 'hidden' },
        property_labels: { 'app.b.note': 'Note', 'app.a.text': 'Engraving text' },
      }),
    ).toEqual([
      { key: 'app.a.text', label: 'Engraving text', value: 'Ada' },
      { key: 'app.b.note', label: 'Note', value: 'Gift' },
    ]);
  });

  it('a line with a foreign app key and no label shows nothing', () => {
    expect(visibleLineProperties({ properties: { 'app.other.field': 'value' } })).toEqual([]);
    expect(visibleLineProperties({ properties: { 'app.other.field': 'value' }, property_labels: {} })).toEqual([]);
    expect(visibleLineProperties({ properties: { 'app.other.field': 'value' }, property_labels: null })).toEqual([]);
    expect(visibleLineProperties({ properties: null, property_labels: { a: 'A' } })).toEqual([]);
    expect(visibleLineProperties({})).toEqual([]);
  });

  it('bearer keys never show', () => {
    const properties = {
      'app.booking.claim': 'token',
      'app.booking.reschedule_url': 'https://example.test/r',
      'app.booking.cancel_url': 'https://example.test/c',
      'app.booking.my_claim': 'token',
    };
    const property_labels = Object.fromEntries(Object.keys(properties).map((key) => [key, 'Label']));

    expect(visibleLineProperties({ properties, property_labels })).toEqual([]);
  });

  it('blank and non-string never show', () => {
    const property_labels = { a: 'A', b: 'B', c: 'C', d: 'D', e: '  ', f: 'F' };

    expect(
      visibleLineProperties({
        properties: { a: '', b: '   ', c: 4, d: { nested: 'x' }, e: 'value', f: null },
        property_labels,
      }),
    ).toEqual([]);
  });
});
