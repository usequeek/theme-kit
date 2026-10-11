import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { StorefrontProvider } from '../provider';
import { CoreEmbedBlock } from '../shared-blocks/embed';

const render = (url: string | null) =>
  renderToStaticMarkup(
    <StorefrontProvider vendor={{ id: 'v1', slug: 'acme', name: 'Acme' } as never} config={{} as never} menus={[]}>
      <CoreEmbedBlock url={url as never} />
    </StorefrontProvider>,
  );

describe('embed block copy', () => {
  it('shows the translatable, brand-neutral placeholder when there is no URL', () => {
    const html = render(null);
    expect(html).toContain('Paste the link or embed code');
    expect(html).not.toMatch(/instagram|spotify|twitter/i);
  });

  it('titles the iframe from the strings', () => {
    expect(render('https://example.com/e')).toContain('title="Embedded content"');
  });

  it('keeps every illustrative string in the kit free of third-party brand names', () => {
    const files = ['locales/en.default.json', 'shared-blocks/embed.tsx', 'shared-blocks/manifest.ts'];
    for (const file of files) {
      expect(readFileSync(join(__dirname, '..', file), 'utf8'), file).not.toMatch(/instagram|spotify|twitter/i);
    }
  });
});
