import { request } from '../../shared/api/httpClient';

export function getPublicMenu(params = {}) {
  const query = new URLSearchParams(params).toString();
  return request(`/public/menu${query ? `?${query}` : ''}`);
}

export function createTableSession(tableId) {
  return request('/public/table-sessions', {
    method: 'POST',
    body: JSON.stringify({ table_id: tableId }),
  });
}
