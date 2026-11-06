import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { expandDesignTokens } from '../utils/brand';

const css = readFileSync(join(__dirname, '..', 'apps', 'apps.css'), 'utf8');
const modalRule = css.match(/\n\.core-subscribe-modal \{([^}]*)\}/)?.[1] ?? '';

describe('subscribe modal card corners', () => {
  it('caps --radius-lg so a pill shape never turns the card into a circle', () => {
    expect(expandDesignTokens({ shape: { radius: 'pill' } })['--radius-lg']).toBe('9999px');
    expect(modalRule).toMatch(/border-radius:\s*min\(var\(--radius-lg, 12px\), 28px\);/);
  });

  it('caps at exactly the rounded scale, so sharp/soft/rounded still apply unchanged', () => {
    expect(expandDesignTokens({ shape: { radius: 'rounded' } })['--radius-lg']).toBe('28px');
  });
});
