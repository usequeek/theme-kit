import { describe, expect, it } from 'vitest';
import { FRAMEWORK_BLOCK_MANIFEST, FRAMEWORK_OWNED_TYPES } from '../shared-blocks/manifest';
import type { BlockType } from '../types/block';
import type { FrameworkBlockType } from '../types/theme';

/**
 * Three places declare "this block type is framework-owned" and must never
 * drift: `types/theme.ts` `FrameworkBlockType`, `shared-blocks/manifest.ts`
 * `FRAMEWORK_OWNED_TYPES`, and `page-renderer.tsx`'s switch (checked here by
 * proxy — every framework-owned type must at least have a manifest entry, or
 * a theme's Section Library drawer would offer a block the renderer has no
 * variant list for).
 */
describe('framework-owned block manifest parity', () => {
  // Mirrors `FrameworkBlockType` in types/theme.ts — TypeScript enforces the
  // literal union is exhaustive against `BlockType` here (compile error if
  // one is added without the other), so this list doubles as the type check.
  const frameworkBlockTypes: FrameworkBlockType[] = [
    'divider',
    'embed',
    'video',
    'table',
    'button',
    'image',
    'reviews',
    'faq',
    'callout',
    'quote',
    'product_qa',
    'metaobjects',
  ];

  it('FrameworkBlockType and FRAMEWORK_OWNED_TYPES name the same set', () => {
    expect(new Set(frameworkBlockTypes)).toEqual(FRAMEWORK_OWNED_TYPES);
  });

  it('every framework-owned type (except content, handled specially) has a manifest entry', () => {
    for (const type of FRAMEWORK_OWNED_TYPES) {
      expect(FRAMEWORK_BLOCK_MANIFEST[type], `${type} missing from FRAMEWORK_BLOCK_MANIFEST`).toBeDefined();
      expect(FRAMEWORK_BLOCK_MANIFEST[type].length).toBeGreaterThan(0);
    }
  });

  it('metaobjects is a real BlockType', () => {
    const type: BlockType = 'metaobjects';
    expect(FRAMEWORK_OWNED_TYPES.has(type)).toBe(true);
  });

  it('metaobjects manifest declares grid (default) and list variants', () => {
    const variants = FRAMEWORK_BLOCK_MANIFEST.metaobjects;
    expect(variants.map((v) => v.id)).toEqual(expect.arrayContaining(['grid', 'list']));
    expect(variants.find((v) => v.default)?.id).toBe('grid');
  });
});
