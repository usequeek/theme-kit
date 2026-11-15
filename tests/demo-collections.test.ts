import { describe, expect, it } from 'vitest';
import { getCollection, getCollections, type PreviewDemoData } from '../demo';

const demo = {
  categories: [
    { id: 'c1', slug: 'shoes', name: 'Shoes', description: 'Lasts cut in Aba, soles stitched by hand.' },
    { id: 'c2', slug: 'bags', name: 'Bags' },
    { id: 'c3', slug: 'belts', name: 'Belts', description: '   ' },
  ],
  products: [],
} as unknown as PreviewDemoData;

describe('demo collections', () => {
  it("use the demo category's own description", () => {
    expect(getCollections(demo)[0].description).toBe('Lasts cut in Aba, soles stitched by hand.');
    expect(getCollection(demo, 'shoes')?.collection.description).toBe('Lasts cut in Aba, soles stitched by hand.');
  });

  it('carry no description when the demo gives none, rather than invented copy', () => {
    expect(getCollections(demo)[1].description).toBeNull();
    expect(getCollections(demo)[2].description).toBeNull();
    expect(getCollection(demo, 'bags')?.collection.description).toBeNull();
  });
});
