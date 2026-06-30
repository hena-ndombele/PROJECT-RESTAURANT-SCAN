import { request } from '../../shared/api/httpClient';

export function createGroupOrder(payload) {
  return request('/group-orders', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function getActiveGroupOrderByTable(tableId) {
  return request(`/group-orders/active/table/${tableId}`);
}

export function getGroupOrder(code) {
  return request(`/group-orders/${code}`);
}

export function joinGroupOrder(code, payload) {
  return request(`/group-orders/${code}/participants`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function recoverGroupOrderCreator(code, payload) {
  return request(`/group-orders/${code}/creator-recovery`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function upsertGroupOrderItem(code, payload) {
  return request(`/group-orders/${code}/items`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function deleteGroupOrderItem(code, itemId) {
  return request(`/group-orders/${code}/items/${itemId}`, {
    method: 'DELETE',
  });
}

export function heartbeatGroupOrderParticipant(code, participantId) {
  return request(`/group-orders/${code}/participants/heartbeat`, {
    method: 'POST',
    body: JSON.stringify({ participant_id: participantId }),
  });
}

export function setGroupOrderParticipantReady(code, participantId, isReady) {
  return request(`/group-orders/${code}/participants/ready`, {
    method: 'POST',
    body: JSON.stringify({ participant_id: participantId, is_ready: isReady }),
  });
}

export function checkoutGroupOrder(code, payload) {
  return request(`/group-orders/${code}/checkout`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
