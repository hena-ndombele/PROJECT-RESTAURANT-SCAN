import { request } from '../../shared/api/httpClient';

export function createOrder(payload) {
  return request('/orders', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function getOrder(id) {
  return request(`/orders/${id}`);
}

export function trackOrder(params = {}) {
  const cleanParams = Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '')
  );
  const query = new URLSearchParams(cleanParams).toString();
  return request(`/orders/track${query ? `?${query}` : ''}`);
}

export function cancelOrder(id, cancellationReason) {
  return request(`/orders/${id}/cancel`, {
    method: 'PATCH',
    body: JSON.stringify({ cancellation_reason: cancellationReason }),
  });
}

export function updateOrderItems(id, payload) {
  return request(`/orders/${id}/items`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function requestBill(id) {
  return request(`/orders/${id}/request-bill`, {
    method: 'PATCH',
    body: JSON.stringify({}),
  });
}
