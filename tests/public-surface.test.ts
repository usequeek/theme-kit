import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(__dirname, '..');

/**
 * The barrels re-export by RELATIVE path — the kit carries no `@/` alias, so it
 * resolves when imported from outside this repo. `./types/theme` and
 * `@usequeek/theme-kit/types/theme` name the same module; normalise to the second.
 */
function barrelModules(file: string): Set<string> {
  const source = readFileSync(join(ROOT, file), 'utf8');
  return new Set(
    [...source.matchAll(/from '\.\/([^']+)'/g)].map((m) => m[1]),
  );
}

/**
 * `index.ts` + `client.ts` declare the surface a theme may build against — the
 * set that ships as `@usequeek/theme-kit`.
 *
 * Every module the barrels declare must exist.
 */
describe('core public surface (kit-internal)', () => {
  const declared = new Set([...barrelModules('index.ts'), ...barrelModules('client.ts')]);

  it('declares nothing that no longer exists', () => {
    const missing = [...declared].filter(
      (mod) => !['.ts', '.tsx', '/index.ts', '/index.tsx'].some((ext) => existsSync(join(ROOT, mod + ext))),
    );

    expect(missing).toEqual([]);
  });
});
