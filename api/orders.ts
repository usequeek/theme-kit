import { createBrowserClient } from '../sdk/client';
import type { OrderListResponse, OrderDetail } from '../types/order';

/**
 * One page of the current customer's orders (`GET /client/store/orders`). Pass
 * a `status` to filter; `'all'` or omitted means no filter.
 *
 * @throws {ApiRequestError} when the API refuses; `code: 'unauthenticated'` means the customer must sign in.
 *
 * @example
 * const { data } = await fetchOrders(vendor.slug, 1, 'completed');
 */
export async function fetchOrders(
  vendorSlug: string,
  page = 1,
  status?: string,
): Promise<OrderListResponse> {
  const client = createBrowserClient(vendorSlug);
  return client.get<OrderListResponse>('/orders', {
    page,
    ...(status && status !== 'all' ? { status } : {}),
  });
}

/**
 * One of the current customer's orders, by id.
 *
 * @throws {ApiRequestError} with `code: 'not_found'` when the order does not exist for this customer.
 */
export async function fetchOrderDetail(
  vendorSlug: string,
  id: string,
): Promise<OrderDetail> {
  const client = createBrowserClient(vendorSlug);
  const res = await client.get<{ data: OrderDetail }>(`/orders/${encodeURIComponent(id)}`);
  return res.data;
}
