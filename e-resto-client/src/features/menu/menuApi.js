import { request } from '../../shared/api/httpClient';

export function getPublicMenu(params = {}) {
  const query = new URLSearchParams(params).toString();
  return request(`/public/menu${query ? `?${query}` : ''}`);
}
