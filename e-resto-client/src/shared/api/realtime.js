import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

window.Pusher = Pusher;

let echo;

export function getEcho() {
  if (echo) return echo;

  const scheme = import.meta.env.VITE_REVERB_SCHEME ?? 'http';
  const port = Number(import.meta.env.VITE_REVERB_PORT ?? 8080);

  echo = new Echo({
    broadcaster: 'reverb',
    key: import.meta.env.VITE_REVERB_APP_KEY ?? 'e-resto-key',
    wsHost: import.meta.env.VITE_REVERB_HOST ?? window.location.hostname,
    wsPort: port,
    wssPort: port,
    forceTLS: scheme === 'https',
    enabledTransports: ['ws', 'wss'],
  });

  return echo;
}
