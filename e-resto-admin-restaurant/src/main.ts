import { bootstrapApplication } from '@angular/platform-browser';
import 'bootstrap';
import { appConfig } from './app/app.config';
import { App } from './app/app';

bootstrapApplication(App, appConfig).catch(() => {});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const isLocalHost = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);

    if (isLocalHost) {
      navigator.serviceWorker.getRegistrations()
        .then((registrations) => registrations.forEach((registration) => registration.unregister()))
        .catch(() => undefined);
      return;
    }

    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
