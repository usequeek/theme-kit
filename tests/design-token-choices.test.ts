import { describe, expect, it } from 'vitest';
import {
  DESIGN_TOKEN_CHOICES,
  expandDesignTokensPartial,
  findInvalidDesignTokens,
} from '../utils/brand';

// Literal expectations make additions, removals, and spelling changes visible.
const EXPECTED_CHOICES = {
  'color.scheme': ['light', 'dark'],
  'type.scale_ratio': [1.125, 1.2, 1.25, 1.333],
  'type.heading_case': ['none', 'upper', 'small-caps'],
  'space.density': ['compact', 'cozy', 'comfortable'],
  'shape.radius': ['sharp', 'soft', 'rounded', 'pill'],
  'shape.border_weight': ['hairline', 'medium', 'bold'],
  elevation: ['flat', 'subtle', 'lifted'],
  motion: ['none', 'subtle', 'lively'],
  'image.radius': ['sharp', 'soft', 'rounded'],
  'image.fit': ['cover', 'contain'],
  'image.filter': ['none', 'mono', 'warm'],
} as const;

type TokenPath = keyof typeof EXPECTED_CHOICES;
const paths = Object.keys(EXPECTED_CHOICES) as TokenPath[];

function nestedPartial(path: string, value: unknown): Record<string, unknown> {
  return path.split('.').reduceRight<Record<string, unknown>>(
    (nested, key, index, keys) => ({ [key]: index === keys.length - 1 ? value : nested }),
    {},
  );
}

describe('DESIGN_TOKEN_CHOICES', () => {
  it('contains exactly the 11 enumerated leaves', () => {
    expect(new Set(Object.keys(DESIGN_TOKEN_CHOICES))).toEqual(new Set(paths));
  });

  it.each(paths)('%s contains exactly the expected literal choices', (path) => {
    expect(new Set<string | number>(DESIGN_TOKEN_CHOICES[path])).toEqual(new Set<string | number>(EXPECTED_CHOICES[path]));
    expect(DESIGN_TOKEN_CHOICES[path]).toHaveLength(EXPECTED_CHOICES[path].length);
  });

  it('freezes the exported map and every choice list', () => {
    expect(Object.isFrozen(DESIGN_TOKEN_CHOICES)).toBe(true);
    for (const choices of Object.values(DESIGN_TOKEN_CHOICES)) {
      expect(Object.isFrozen(choices)).toBe(true);
    }
  });
});

describe('findInvalidDesignTokens', () => {
  it('reports thin with exactly the border-weight diagnostic', () => {
    const invalid = findInvalidDesignTokens({ shape: { border_weight: 'thin' } });

    expect(invalid).toHaveLength(1);
    expect(invalid[0]).toEqual({
      path: 'shape.border_weight',
      value: 'thin',
      allowed: expect.any(Array),
    });
    expect(new Set(invalid[0].allowed)).toEqual(new Set(['hairline', 'medium', 'bold']));
    expect(invalid[0].allowed).toHaveLength(3);
  });

  it.each(paths)('reports one bogus value at %s', (path) => {
    const invalid = findInvalidDesignTokens(nestedPartial(path, 'bogus'));

    expect(invalid).toHaveLength(1);
    expect(invalid[0]).toEqual({ path, value: 'bogus', allowed: expect.any(Array) });
    expect(new Set(invalid[0].allowed)).toEqual(new Set<string | number>(EXPECTED_CHOICES[path]));
  });

  it('accepts a complete token set built from the first choice of every leaf', () => {
    const tokens: Record<string, unknown> = {};
    for (const [path, choices] of Object.entries(DESIGN_TOKEN_CHOICES)) {
      const partial = nestedPartial(path, choices[0]);
      for (const [group, value] of Object.entries(partial)) {
        tokens[group] = typeof value === 'object' && value !== null
          ? { ...(tokens[group] as Record<string, unknown> | undefined), ...value }
          : value;
      }
    }

    expect(findInvalidDesignTokens(tokens)).toEqual([]);
  });

  it.each([
    { label: 'empty object', tokens: {} },
    { label: 'null', tokens: null },
    { label: 'undefined', tokens: undefined },
    { label: 'string', tokens: 'x' },
    { label: 'array', tokens: [] },
    { label: 'malformed group', tokens: { shape: 'x' } },
    { label: 'undefined leaf', tokens: { shape: { radius: undefined } } },
  ])('returns [] without throwing for $label', ({ tokens }) => {
    expect(() => findInvalidDesignTokens(tokens)).not.toThrow();
    expect(findInvalidDesignTokens(tokens)).toEqual([]);
  });

  it.each(['1.25', 1.3])('rejects scale ratio %j without coercion', (value) => {
    const invalid = findInvalidDesignTokens({ type: { scale_ratio: value } });

    expect(invalid).toHaveLength(1);
    expect(invalid[0]).toEqual({ path: 'type.scale_ratio', value, allowed: expect.any(Array) });
    expect(new Set(invalid[0].allowed)).toEqual(new Set([1.125, 1.2, 1.25, 1.333]));
  });
});

describe('expanding every design-token choice', () => {
  const cases = paths.flatMap((path) =>
    DESIGN_TOKEN_CHOICES[path].map((value) => ({ path, value })),
  );

  it.each(cases)('$path = $value expands safely', ({ path, value }) => {
    const partial = nestedPartial(path, value) as Parameters<typeof expandDesignTokensPartial>[0];
    let vars: Record<string, string> = {};
    expect(() => { vars = expandDesignTokensPartial(partial); }).not.toThrow();

    // Scheme is metadata; emitColorVars intentionally emits no CSS for it.
    if (path === 'color.scheme') return;

    expect(Object.keys(vars).length).toBeGreaterThan(0);
    for (const emitted of Object.values(vars)) {
      expect(emitted).toBeDefined();
      expect(Number.isNaN(emitted)).toBe(false);
      expect(String(emitted)).not.toContain('undefined');
      expect(String(emitted)).not.toContain('NaN');
    }
  });
});
