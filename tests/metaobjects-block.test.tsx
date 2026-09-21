import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CoreMetaobjectsBlock } from '../shared-blocks/metaobjects';
import type { CoreMetaobjectsBlockProps } from '../shared-blocks/metaobjects';
import type { MetaobjectEntry } from '../types/product';

function makeEntry(overrides: Partial<MetaobjectEntry> = {}): MetaobjectEntry {
  return {
    p_id: 1,
    type: 'designer',
    handle: 'adaeze',
    display_name: 'Adaeze',
    fields: { bio: 'Lagos-based designer' },
    ...overrides,
  };
}

function render(props: Partial<CoreMetaobjectsBlockProps> = {}): string {
  return renderToStaticMarkup(
    React.createElement(CoreMetaobjectsBlock, {
      entries: [makeEntry()],
      definition: { type: 'designer', name: 'Designer', has_pages: false },
      ...props,
    }),
  );
}

describe('CoreMetaobjectsBlock', () => {
  it('renders nothing when there are no entries', () => {
    expect(render({ entries: [] })).toBe('');
  });

  it('renders a grid by default with entry cards', () => {
    const html = render();
    expect(html).toContain('core-block-metaobjects--grid');
    expect(html).toContain('core-block-metaobjects__list--grid');
    expect(html).toContain('core-metafields__entry-card');
    expect(html).toContain('Adaeze');
  });

  it('renders a list layout when requested', () => {
    const html = render({ layout: 'list' });
    expect(html).toContain('core-block-metaobjects--list');
    expect(html).toContain('core-block-metaobjects__list--list');
  });

  it('renders the title when provided', () => {
    expect(render({ title: 'Our designers' })).toContain('Our designers');
  });

  it('does not link entries when the definition has no pages', () => {
    const html = render({ definition: { type: 'designer', name: 'Designer', has_pages: false } });
    expect(html).not.toContain('<a ');
  });

  it('links each entry to /{type}/{handle} when the definition has pages', () => {
    const html = render({ definition: { type: 'designer', name: 'Designer', has_pages: true } });
    expect(html).toContain('<a ');
    expect(html).toContain('href="/designer/adaeze"');
  });

  it('renders multiple entries', () => {
    const html = render({
      entries: [makeEntry(), makeEntry({ p_id: 2, handle: 'chidi', display_name: 'Chidi' })],
    });
    expect(html).toContain('Adaeze');
    expect(html).toContain('Chidi');
  });
});
