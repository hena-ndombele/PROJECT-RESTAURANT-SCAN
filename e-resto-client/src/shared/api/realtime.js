import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

window.Pusher = Pusher;

let echo;

export function getEcho() {
  if (echo) return echo;

  const localHosts = ['localhost', '127.0.0.1', '::1'];
  const isLocal = localHosts.includes(window.location.hostname);
  const scheme = import.meta.env.VITE_REVERB_SCHEME ?? (isLocal ? 'http' : 'https');
  const port = Number(import.meta.env.VITE_REVERB_PORT ?? (isLocal ? 8080 : 443));

  echo = new Echo({
    broadcaster: 'reverb',
    key: import.meta.env.VITE_REVERB_APP_KEY ?? 'e-resto-key',
    wsHost: import.meta.env.VITE_REVERB_HOST ?? (isLocal ? window.location.hostname : 'api.restaurascan.com'),
    wsPort: port,
    wssPort: port,
    forceTLS: scheme === 'https',
    enabledTransports: ['ws', 'wss'],
  });

  return echo;
}
