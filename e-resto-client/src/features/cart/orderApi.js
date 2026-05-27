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
