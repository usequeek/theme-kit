import { createBrowserClient } from '../sdk/client';
import type { OrderListResponse, OrderDetail } from '../types/order';

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

export async function fetchOrderDetail(
  vendorSlug: string,
  id: string,
): Promise<OrderDetail> {
  const client = createBrowserClient(vendorSlug);
  const res = await client.get<{ data: OrderDetail }>(`/orders/${id}`);
  return res.data;
}
