import { describe, expect, it } from 'vitest';
import { catalogItemId, catalogItemIdForCartLine, toPId } from '../utils/catalog-id';
import { normalizeProduct } from '../utils/product-normalizer';

describe('toPId', () => {
  it.each([
    [4197, 4197],
    ['4197', 4197],
    [' 4197 ', 4197],
  ])('reads %p as %p', (input, expected) => expect(toPId(input)).toBe(expected));

  it.each([0, -1, 1.5, NaN, Infinity, '', 'abc', '12x', '1.5', '-3', null, undefined, {}, [], true])('rejects %p', (input) => {
    expect(toPId(input)).toBeNull();
  });
});

describe('catalogItemId', () => {
  it('uses the variant p_id when there is one', () => {
    expect(catalogItemId({ variantPId: 5102, productPId: 4197, hasVariant: true, fallbackId: 'uuid-p' })).toEqual({ item_id: '5102' });
  });

  it('uses the product p_id for a product without variants', () => {
    expect(catalogItemId({ productPId: 4197, hasVariant: false, fallbackId: 'uuid-p' })).toEqual({ item_id: '4197' });
  });

  it('marks a product p_id as a group id when the item is a variant whose own p_id is unknown', () => {
    expect(catalogItemId({ productPId: 4197, hasVariant: true, fallbackId: 'uuid-p' })).toEqual({ item_id: '4197', is_group: true });
  });

  it('falls back to the product UUID only when no p_id is known', () => {
    expect(catalogItemId({ fallbackId: 'uuid-p', hasVariant: true })).toEqual({ item_id: 'uuid-p' });
    expect(catalogItemId({ variantPId: 'nope', productPId: 0, fallbackId: 'uuid-p' })).toEqual({ item_id: 'uuid-p' });
  });

  it('sends an empty id rather than inventing one when nothing is known', () => {
    expect(catalogItemId({})).toEqual({ item_id: '' });
  });
});

describe('catalogItemIdForCartLine', () => {
  it('reads the variant, then the product, then the product UUID off the line', () => {
    expect(catalogItemIdForCartLine({ product_id: 'u', variant_id: 'v', product_p_id: 1, variant_p_id: 2 })).toEqual({ item_id: '2' });
    expect(catalogItemIdForCartLine({ product_id: 'u', variant_id: null, product_p_id: 1, variant_p_id: null })).toEqual({ item_id: '1' });
    expect(catalogItemIdForCartLine({ product_id: 'u', variant_id: 'v', product_p_id: 1 })).toEqual({ item_id: '1', is_group: true });
    // A line saved before p_ids existed.
    expect(catalogItemIdForCartLine({ product_id: 'u', variant_id: 'v' })).toEqual({ item_id: 'u' });
  });
});

describe('normalizeProduct carries a variant p_id', () => {
  const raw = (variantExtra: Record<string, unknown>) =>
    ({
      id: 'p-uuid',
      p_id: 4197,
      title: 'Tee',
      variants: [{ id: 'v-uuid', title: 'Red', price: 1000, discount_price: 1000, option_values: [], ...variantExtra }],
    }) as never;

  it('keeps it', () => {
    expect(normalizeProduct(raw({ p_id: 5102 })).variants[0].p_id).toBe(5102);
  });

  it('leaves the key out when the payload has none, or a bad one', () => {
    expect('p_id' in normalizeProduct(raw({})).variants[0]).toBe(false);
    expect('p_id' in normalizeProduct(raw({ p_id: 'x' })).variants[0]).toBe(false);
  });
});
