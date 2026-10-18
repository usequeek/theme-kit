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
      'app.x.claim': 'token',
      'app.x.reschedule_url': 'https://example.test/r',
      'app.x.cancel_url': 'https://example.test/c',
    };
    const property_labels = Object.fromEntries(Object.keys(properties).map((key) => [key, 'Label']));

    expect(visibleLineProperties({ properties, property_labels })).toEqual([]);
  });

  it.each([
    'app.x.my_claim',
    'app.x.reclaim',
    'app.x.my_cancel_url',
    'app.x.url_claim',
    'app.x.claim_note',
  ])('a declared key that only resembles a bearer key shows when labelled (%s)', (key) => {
    expect(visibleLineProperties({ properties: { [key]: 'Ada' }, property_labels: { [key]: 'Label' } })).toEqual([
      { key, label: 'Label', value: 'Ada' },
    ]);
  });

  it('text of only invisible characters never shows', () => {
    const invisible = [0x200b, 0x200d, 0x2060, 0xfeff, 0x200e, 0xa0].map((code) => String.fromCharCode(code)).join('');

    expect(visibleLineProperties({ properties: { a: invisible }, property_labels: { a: 'A' } })).toEqual([]);
    expect(visibleLineProperties({ properties: { a: 'x' }, property_labels: { a: invisible } })).toEqual([]);
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
