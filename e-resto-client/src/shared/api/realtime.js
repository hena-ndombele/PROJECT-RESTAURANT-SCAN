import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

window.Pusher = Pusher;

let echo;

function reverbConfig() {
  const localHosts = ['localhost', '127.0.0.1', '::1'];
  const isLocal = localHosts.includes(window.location.hostname);
  const scheme = import.meta.env.VITE_REVERB_SCHEME ?? (isLocal ? 'http' : window.location.protocol.replace(':', '') || 'http');
  const host = import.meta.env.VITE_REVERB_HOST ?? window.location.hostname;
  const port = Number(import.meta.env.VITE_REVERB_PORT ?? (scheme === 'https' ? 443 : 8080));
  const key = import.meta.env.VITE_REVERB_APP_KEY ?? 'restaurant-scan-key';

  return { scheme, host, port, key };
}

function parseSocketData(data) {
  if (!data) return null;
  if (typeof data === 'string') {
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }
  return data;
}

export function getEcho() {
  if (echo) return echo;

  const { scheme, host, port, key } = reverbConfig();

  echo = new Echo({
    broadcaster: 'reverb',
    key,
    wsHost: host,
    wsPort: port,
    wssPort: port,
    forceTLS: scheme === 'https',
    enabledTransports: ['ws', 'wss'],
  });

  return echo;
}

export function subscribeToOrderRealtime(orderId, { onOrder, onState } = {}) {
  if (!orderId) return () => undefined;

  const { scheme, host, port, key } = reverbConfig();
  const wsProtocol = scheme === 'https' ? 'wss' : 'ws';
  const channel = `orders.${orderId}`;
  const url = `${wsProtocol}://${host}:${port}/app/${key}?protocol=7&client=e-resto-client&version=1.0&flash=false`;
  let socket;
  let reconnectTimer;
  let stopped = false;

  const send = (payload) => {
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(payload));
    }
  };

  const connect = () => {
    if (stopped) return;
    onState?.('Connexion temps reel...');
    socket = new WebSocket(url);

    socket.onopen = () => {
      onState?.('Temps reel actif');
      send({
        event: 'pusher:subscribe',
        data: { channel },
      });
    };

    socket.onmessage = (event) => {
      const message = parseSocketData(event.data);
      if (!message?.event) return;

      if (message.event === 'pusher:ping') {
        send({ event: 'pusher:pong', data: {} });
        return;
      }

      if (!['order.placed', 'order.status.updated'].includes(message.event)) return;

      const payload = parseSocketData(message.data);
      const order = payload?.order;
      if (!order?.id || order.id !== orderId) return;

      onOrder?.(order);
      onState?.(message.event === 'order.status.updated' ? 'Statut mis a jour en direct' : 'Commande reçue en direct');
    };

    socket.onerror = () => {
      onState?.('Connexion temps reel a verifier');
    };

    socket.onclose = () => {
      if (stopped) return;
      onState?.('Reconnexion temps reel...');
      reconnectTimer = window.setTimeout(connect, 3000);
    };
  };

  connect();

  return () => {
    stopped = true;
    if (reconnectTimer) window.clearTimeout(reconnectTimer);
    socket?.close();
  };
}

export function subscribeToMenuRealtime(restaurantId, { onUpdate, onState } = {}) {
  if (!restaurantId) return () => undefined;

  const { scheme, host, port, key } = reverbConfig();
  const wsProtocol = scheme === 'https' ? 'wss' : 'ws';
  const channel = `menu.${restaurantId}`;
  const url = `${wsProtocol}://${host}:${port}/app/${key}?protocol=7&client=e-resto-client&version=1.0&flash=false`;
  let socket;
  let reconnectTimer;
  let stopped = false;

  const send = (payload) => {
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(payload));
    }
  };

  const connect = () => {
    if (stopped) return;
    onState?.('Connexion menu temps reel...');
    socket = new WebSocket(url);

    socket.onopen = () => {
      onState?.('Menu temps reel actif');
      send({
        event: 'pusher:subscribe',
        data: { channel },
      });
    };

    socket.onmessage = (event) => {
      const message = parseSocketData(event.data);
      if (!message?.event) return;

      if (message.event === 'pusher:ping') {
        send({ event: 'pusher:pong', data: {} });
        return;
      }

      if (message.event !== 'menu.updated') return;

      const payload = parseSocketData(message.data);
      if (payload?.restaurantId && payload.restaurantId !== restaurantId) return;

      onUpdate?.(payload);
      onState?.('Menu mis a jour en direct');
    };

    socket.onerror = () => {
      onState?.('Connexion menu a verifier');
    };

    socket.onclose = () => {
      if (stopped) return;
      onState?.('Reconnexion menu temps reel...');
      reconnectTimer = window.setTimeout(connect, 3000);
    };
  };

  connect();

  return () => {
    stopped = true;
    if (reconnectTimer) window.clearTimeout(reconnectTimer);
    socket?.close();
  };
}

export function subscribeToGroupOrderRealtime(tableId, { onGroupOrder, onState } = {}) {
  if (!tableId) return () => undefined;

  const { scheme, host, port, key } = reverbConfig();
  const wsProtocol = scheme === 'https' ? 'wss' : 'ws';
  const channel = `group-orders.table.${tableId}`;
  const url = `${wsProtocol}://${host}:${port}/app/${key}?protocol=7&client=e-resto-client&version=1.0&flash=false`;
  let socket;
  let reconnectTimer;
  let stopped = false;

  const send = (payload) => {
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(payload));
    }
  };

  const connect = () => {
    if (stopped) return;
    onState?.('Connexion commande groupée...');
    socket = new WebSocket(url);

    socket.onopen = () => {
      onState?.('Commande groupée temps réel active');
      send({
        event: 'pusher:subscribe',
        data: { channel },
      });
    };

    socket.onmessage = (event) => {
      const message = parseSocketData(event.data);
      if (!message?.event) return;

      if (message.event === 'pusher:ping') {
        send({ event: 'pusher:pong', data: {} });
        return;
      }

      if (message.event !== 'group-order.updated') return;

      const payload = parseSocketData(message.data);
      const nextGroupOrder = payload?.groupOrder || payload?.group_order;
      if (!nextGroupOrder?.code || nextGroupOrder.table_id !== tableId) return;

      onGroupOrder?.(payload);
      onState?.('Commande groupée mise à jour');
    };

    socket.onerror = () => {
      onState?.('Connexion commande groupée à vérifier');
    };

    socket.onclose = () => {
      if (stopped) return;
      onState?.('Reconnexion commande groupée...');
      reconnectTimer = window.setTimeout(connect, 3000);
    };
  };

  connect();

  return () => {
    stopped = true;
    if (reconnectTimer) window.clearTimeout(reconnectTimer);
    socket?.close();
  };
}
