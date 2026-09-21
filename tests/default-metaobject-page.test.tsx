import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DefaultMetaobjectPage } from '../components/default-metaobject-page';
import type { MetaobjectEntry } from '../types/product';
import type { MetaobjectPageDefinition } from '../types/theme';

function render(fields: MetaobjectEntry['fields'], fieldDefs: MetaobjectPageDefinition['fields']): string {
  const entry: MetaobjectEntry = {
    p_id: 1,
    type: 'designer',
    handle: 'adaeze',
    display_name: 'Adaeze',
    fields,
  };
  const definition: MetaobjectPageDefinition = { type: 'designer', name: 'Designer', fields: fieldDefs };

  return renderToStaticMarkup(React.createElement(DefaultMetaobjectPage, { entry, definition }));
}

describe('DefaultMetaobjectPage', () => {
  it('renders the entry display name as the title', () => {
    const html = render({}, []);
    expect(html).toContain('core-metaobject-page__title');
    expect(html).toContain('Adaeze');
  });

  it('renders a text field with its definition label', () => {
    const html = render({ bio: 'Lagos-based designer' }, [{ key: 'bio', name: 'Biography', type: 'single_line_text' }]);
    expect(html).toContain('Biography');
    expect(html).toContain('Lagos-based designer');
  });

  it('falls back to a humanised key label when no definition field matches', () => {
    const html = render({ years_active: '10' }, []);
    expect(html).toContain('Years active');
  });

  it('renders a boolean field as Yes/No', () => {
    const html = render({ verified: true }, [{ key: 'verified', name: 'Verified', type: 'boolean' }]);
    expect(html).toContain('>Yes<');
  });

  it('renders a url field as a link', () => {
    const html = render({ portfolio: 'https://example.com/adaeze' }, [{ key: 'portfolio', name: 'Portfolio', type: 'url' }]);
    expect(html).toContain('<a');
    expect(html).toContain('href="https://example.com/adaeze"');
  });

  it('renders a list field as bullets', () => {
    const html = render({ tags: ['couture', 'bridal'] }, [{ key: 'tags', name: 'Tags', type: 'list.single_line_text' }]);
    expect(html).toContain('<ul');
    expect(html).toContain('couture');
    expect(html).toContain('bridal');
  });
});
