import { request } from '../../shared/api/httpClient';

export function getFeedbackAvailability(orderId) {
  const query = new URLSearchParams({ order_id: orderId }).toString();
  return request(`/public/feedbacks/availability?${query}`);
}

export function submitFeedback(payload) {
  return request('/public/feedbacks', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
