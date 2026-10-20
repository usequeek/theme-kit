import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  CollectionMetafields,
  Metafields,
  PostMetafields,
  ProductMetafields,
  VariantMetafields,
} from '../components/product-metafields';
import type { Collection, Post } from '../types/page';
import type { MetafieldValue, Product } from '../types/product';
import { normalizeProduct } from '../utils/product-normalizer';

function makeProduct(metafields?: Record<string, MetafieldValue>): Product {
  return {
    shop_id: 'shop-1',
    id: 'product-1',
    p_id: 1,
    title: 'Test product',
    slug: 'test-product',
    excerpt: null,
    description: null,
    kind: 'physical',
    status: 'active',
    barcode: null,
    currency: 'NGN',
    pricing: {
      base_amount: 1000,
      sale_amount: 800,
      compare_at_amount: 1000,
      discount_amount: 200,
      discount_percent: 20,
      is_price_from: false,
      tax_inclusive: false,
      price_range: { min_amount: 800, max_amount: 800 },
    },
    shop: { id: 'shop-1', name: 'Shop', slug: 'shop', logo: null, rating: 0, rating_count: 0 },
    media: { thumbnail: null, image: null },
    inventory: { in_stock: true, tracking: false, quantity: 5 },
    variants_count: 0,
    review_summary: { rating: 0, review_count: 0 },
    flags: { featured: false, is_marketplace: false, is_wholesale: false, is_new: false },
    categories: [],
    options: [],
    variants: [],
    addons: [],
    reviews: [],
    metafields,
    created_at: null,
    updated_at: null,
  };
}

function render(metafields?: Record<string, MetafieldValue>, definitions?: Record<string, { name: string; type: string }>): string {
  return renderToStaticMarkup(React.createElement(ProductMetafields, { product: makeProduct(metafields), definitions }));
}

describe('ProductMetafields', () => {
  it('renders nothing when the product has no metafields', () => {
    expect(render(undefined)).toBe('');
    expect(render({})).toBe('');
  });

  it('renders nothing when every value is empty', () => {
    expect(render({ fabric: '', tags: [] })).toBe('');
  });

  it('renders text with the definition label', () => {
    const html = render(
      { fabric: 'Ankara cotton' },
      { fabric: { name: 'Fabric', type: 'single_line_text' } },
    );

    expect(html).toContain('core-metafields');
    expect(html).toContain('Fabric');
    expect(html).toContain('Ankara cotton');
    expect(html).toContain('<p');
  });

  it('falls back to a humanised key label for unknown handles', () => {
    const html = render({ care_instructions: 'Hand wash only' });

    expect(html).toContain('Care instructions');
    expect(html).toContain('Hand wash only');
  });

  it('renders multi_line and rich text preformatted', () => {
    expect(render({ notes: 'line one\nline two' }, { notes: { name: 'Notes', type: 'multi_line_text' } })).toContain('<pre');
    expect(render({ story: '<p>rich</p>' }, { story: { name: 'Story', type: 'rich_text' } })).toContain('<pre');
  });

  it('renders scalar lists as bullets', () => {
    const html = render({ tags: ['cotton', 'handmade'] }, { tags: { name: 'Tags', type: 'list.single_line_text' } });

    expect(html).toContain('<ul');
    expect(html).toContain('<li');
    expect(html).toContain('cotton');
    expect(html).toContain('handmade');
  });

  it('renders booleans as Yes/No', () => {
    expect(render({ gift: true }, { gift: { name: 'Gift wrap', type: 'boolean' } })).toContain('>Yes<');
    expect(render({ gift: false }, { gift: { name: 'Gift wrap', type: 'boolean' } })).toContain('>No<');
  });

  it('renders dates localised instead of raw ISO', () => {
    const html = render({ drop: '2026-09-20' }, { drop: { name: 'Drop date', type: 'date' } });

    expect(html).not.toContain('2026-09-20');
    expect(html).toContain('2026');
  });

  it('renders urls as links', () => {
    const html = render({ lookbook: 'https://example.com/look' }, { lookbook: { name: 'Lookbook', type: 'url' } });

    expect(html).toContain('<a');
    expect(html).toContain('href="https://example.com/look"');
  });

  it('renders media_id as an image', () => {
    const html = render({ swatch: 'https://cdn.example.com/swatch.jpg' }, { swatch: { name: 'Swatch', type: 'media_id' } });

    expect(html).toContain('<img');
    expect(html).toContain('src="https://cdn.example.com/swatch.jpg"');
  });

  it('renders a linked entry as a card with its fields', () => {
    const html = render(
      {
        designer: {
          p_id: 1000,
          type: 'designer',
          handle: 'adaeze',
          display_name: 'Adaeze',
          fields: { name: 'Adaeze', handle: '@adaeze' },
        },
      },
      { designer: { name: 'Designer', type: 'metaobject_reference' } },
    );

    expect(html).toContain('core-metafields__entry-card');
    expect(html).toContain('Adaeze');
    expect(html).toContain('@adaeze');
  });

  it('renders a list of entries as a grid of cards', () => {
    const html = render(
      {
        ingredients: [
          { p_id: 1, type: 'ingredient', handle: 'shea', display_name: 'Shea', fields: { name: 'Shea' } },
          { p_id: 2, type: 'ingredient', handle: 'cocoa', display_name: 'Cocoa', fields: { name: 'Cocoa' } },
        ],
      },
      { ingredients: { name: 'Ingredients', type: 'list.metaobject_reference' } },
    );

    expect(html).toContain('core-metafields__entry-grid');
    expect(html).toContain('Shea');
    expect(html).toContain('Cocoa');
  });
});

describe('definition lookup by handle', () => {
  it('finds the label and type under the value\'s namespace.key handle', () => {
    const html = render(
      { 'custom.drop': '2026-09-20' },
      { 'custom.drop': { name: 'Drop date', type: 'date' } },
    );

    expect(html).toContain('Drop date');
    expect(html).not.toContain('2026-09-20');
  });

  it('still finds a bare-keyed definition for a namespaced value', () => {
    const html = render({ 'custom.fabric': 'Ankara cotton' }, { fabric: { name: 'Fabric', type: 'single_line_text' } });

    expect(html).toContain('Fabric');
  });
});

describe('Metafields for every owner', () => {
  const definitions = { 'custom.fabric': { name: 'Fabric', type: 'single_line_text' } };
  const values = { 'custom.fabric': 'Ankara cotton' };

  it('a product renders exactly the markup ProductMetafields always rendered', () => {
    expect(renderToStaticMarkup(React.createElement(Metafields, { owner: 'product', metafields: values, definitions }))).toBe(
      renderToStaticMarkup(React.createElement(ProductMetafields, { product: makeProduct(values), definitions })),
    );
    expect(render(values, definitions)).toContain('<section class="core-metafields" aria-label="Product details">');
  });

  it.each([
    ['collection', 'Collection details'],
    ['post', 'Post details'],
    ['variant', 'Variant details'],
  ] as const)('%s keeps the shared markup and adds its own modifier class', (owner, label) => {
    const html = renderToStaticMarkup(React.createElement(Metafields, { owner, metafields: values, definitions }));

    expect(html).toContain(`class="core-metafields core-metafields--${owner}"`);
    expect(html).toContain(`aria-label="${label}"`);
    expect(html).toContain('core-metafields__label');
    expect(html).toContain('Fabric');
    expect(html).toContain('Ankara cotton');
  });

  it.each(['collection', 'post', 'variant'] as const)('%s renders nothing without a visible value', (owner) => {
    for (const metafields of [undefined, {}, { 'custom.fabric': '' }, { 'custom.tags': [] }]) {
      expect(renderToStaticMarkup(React.createElement(Metafields, { owner, metafields: metafields as never }))).toBe('');
    }
  });

  it('the thin wrappers read the owner\'s own metafields', () => {
    const collection = { id: 'c', slug: 'c', name: 'C', metafields: values } as unknown as Collection;
    const post = { id: 'p', slug: 'p', metafields: values } as unknown as Post;

    expect(renderToStaticMarkup(React.createElement(CollectionMetafields, { collection, definitions }))).toContain('core-metafields--collection');
    expect(renderToStaticMarkup(React.createElement(PostMetafields, { post, definitions }))).toContain('core-metafields--post');
    expect(renderToStaticMarkup(React.createElement(VariantMetafields, { variant: { metafields: values }, definitions }))).toContain('core-metafields--variant');
    expect(renderToStaticMarkup(React.createElement(VariantMetafields, { variant: {} }))).toBe('');
    expect(renderToStaticMarkup(React.createElement(CollectionMetafields, { collection: { id: 'c' } as Collection }))).toBe('');
  });
});

describe('normalizeProduct variant metafields', () => {
  const variant = (extra: Record<string, unknown>) => ({ id: 'v1', sku: 'SKU', ...extra });

  it('passes a variant\'s presented metafields through', () => {
    const product = normalizeProduct({ id: 'p', variants: [variant({ metafields: { 'custom.shade': 'Rose' } })] } as never);

    expect(product.variants[0].metafields).toEqual({ 'custom.shade': 'Rose' });
  });

  it('keeps an empty object (the wire shape for "none")', () => {
    const product = normalizeProduct({ id: 'p', variants: [variant({ metafields: {} })] } as never);

    expect(product.variants[0].metafields).toEqual({});
  });

  it('leaves the variant shape untouched when the payload has no metafields key or a malformed one', () => {
    for (const metafields of [undefined, null, [], 'x']) {
      const product = normalizeProduct({ id: 'p', variants: [variant({ metafields })] } as never);

      expect(Object.keys(product.variants[0])).not.toContain('metafields');
    }
  });

  it('still passes the product\'s own metafields through, independent of its variants', () => {
    const product = normalizeProduct({
      id: 'p',
      metafields: { 'custom.fabric': 'Ankara' },
      variants: [variant({ metafields: { 'custom.shade': 'Rose' } })],
    } as never);

    expect(product.metafields).toEqual({ 'custom.fabric': 'Ankara' });
    expect(product.variants[0].metafields).toEqual({ 'custom.shade': 'Rose' });
  });
});
