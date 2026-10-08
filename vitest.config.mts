import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  /**
   * Force the AUTOMATIC JSX runtime for everything vitest transforms. esbuild
   * does not infer `jsx: react-jsx` for transformed files, so the kit's `.tsx`
   * would fall back to the classic runtime and look for a global `React` that
   * the kit — correctly, for React 19 — never imports.
   */
  esbuild: {
    jsx: 'automatic',
  },
  test: {
    environment: 'node',
    // The public-text guard's own tests run under `node --test` (see `npm test`).
    exclude: [...configDefaults.exclude, 'scripts/check-public-text.test.mjs'],
  },
});
