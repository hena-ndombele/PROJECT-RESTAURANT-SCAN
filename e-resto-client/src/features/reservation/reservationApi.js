import { request } from '../../shared/api/httpClient';

export function createReservation(payload) {
  return request('/public/Réservations', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
