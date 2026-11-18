import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(__dirname, '..', 'apps', 'apps.css'), 'utf8');
const block = (selector: string): string => css.match(new RegExp(`\\n${selector.replace(/[.>:]/g, '\\$&')} \\{([^}]*)\\}`))?.[1] ?? '';

describe('footer cookie preferences link', () => {
  it('reads as a footer link: inherits the row, no underline at rest', () => {
    const rest = block('.core-consent-link');
    expect(rest).toMatch(/font:\s*inherit;/);
    expect(rest).toMatch(/color:\s*inherit;/);
    expect(rest).toMatch(/letter-spacing:\s*inherit;/);
    expect(rest).toMatch(/text-decoration:\s*none;/);
    expect(rest).not.toMatch(/text-decoration:\s*underline/);
  });

  it('underlines on hover and shows a focus ring', () => {
    expect(block('.core-consent-link:hover')).toMatch(/text-decoration:\s*underline;/);
    expect(block('.core-consent-link:focus-visible')).toMatch(/outline:\s*2px solid currentColor;/);
  });

  it('puts the silent middle dot only after a link inside the credit group', () => {
    expect(block('.core-powered-by-group > .core-consent-link::after')).toMatch(/content:\s*"\\00B7" \/ "";/);
    expect(css.match(/\.core-consent-link::after/g)).toHaveLength(1);
  });
});
