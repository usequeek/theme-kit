// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { StorefrontProvider, useProductCount } from '../provider';
import type { StorefrontConfig } from '../types/vendor';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

function Probe({ counts }: { counts: Array<number | null | undefined> }) {
  const productCount = useProductCount();
  return <output>{JSON.stringify(counts.map((count) => productCount(count)))}</output>;
}

async function read(config: Partial<StorefrontConfig>, counts: Array<number | null | undefined>): Promise<unknown> {
  await act(async () => root.render(
    <StorefrontProvider vendor={{ id: 'v1', slug: 'acme', name: 'Acme' } as never} config={config as never} menus={[]}>
      <Probe counts={counts} />
    </StorefrontProvider>,
  ));
  return JSON.parse(host.querySelector('output')?.textContent ?? 'null');
}

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe('useProductCount', () => {
  it('hides every count when the store has no display setting (the default)', async () => {
    expect(await read({}, [6, 0, null])).toEqual([null, null, null]);
  });

  it('hides every count when the store turned counts off', async () => {
    expect(await read({ display: { show_product_counts: false } }, [6])).toEqual([null]);
  });

  it('returns the count when the store turned counts on, and null for a missing one', async () => {
    expect(await read({ display: { show_product_counts: true } }, [6, 0, null, undefined, Number.NaN])).toEqual([6, 0, null, null, null]);
  });

  it('only a real true turns counts on', async () => {
    expect(await read({ display: { show_product_counts: 'true' as never } }, [6])).toEqual([null]);
  });
});
