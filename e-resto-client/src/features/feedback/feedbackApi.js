import { request } from '../../shared/api/httpClient';

export function submitFeedback(payload) {
  return request('/public/feedbacks', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
