import { request } from '../../shared/api/httpClient';

export function sendContactMessage(payload) {
  return request('/public/contact', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
