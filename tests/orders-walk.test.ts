import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchOrders } from '../api/orders';

/**
 * `GET store/orders` answers the ONE storefront list envelope (pagination
 * Slice 4b, founder 28/9/26): `has_more` + `next_cursor` top-level, no
 * `links`, no paginator `meta`. The kit reads the page it asked for.
 */
describe('fetchOrders walk state', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('asks /client/store/orders by page and returns the top-level walk state', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        status: 'success',
        message: 'Orders retrieved',
        data: [{ id: 'o1', order_no: 'Q-1' }],
        meta: { currency: { code: 'NGN' } },
        has_more: true,
        next_cursor: 'eyJ2IjoxfQ',
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const page = await fetchOrders('kili-foods', 2, 'ongoing');

    const url = String((fetchMock.mock.calls[0] as unknown[])[0]);
    expect(url).toContain('/client/store/orders');
    expect(url).toContain('page=2');
    expect(url).toContain('status=ongoing');
    expect(page.has_more).toBe(true);
    expect(page.next_cursor).toBe('eyJ2IjoxfQ');
    expect(page).not.toHaveProperty('links');
    expect(page.data).toHaveLength(1);
  });

  it('never sends status=all (the unfiltered list)', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ data: [], has_more: false, next_cursor: null }) }));
    vi.stubGlobal('fetch', fetchMock);

    const page = await fetchOrders('kili-foods', 1, 'all');

    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).not.toContain('status=');
    expect(page.has_more).toBe(false);
    expect(page.next_cursor).toBeNull();
  });
});
