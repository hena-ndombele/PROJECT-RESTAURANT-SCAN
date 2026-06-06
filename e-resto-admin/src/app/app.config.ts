import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { HttpErrorResponse, HttpInterceptorFn, provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { routes } from './app.routes';

const adminAuthInterceptor: HttpInterceptorFn = (request, next) => {
  const token = localStorage.getItem('admin_token');
  const expiresAt = localStorage.getItem('admin_token_expires_at');

  if (token && expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_token_expires_at');
    localStorage.removeItem('admin_user');
    window.location.href = '/';
    return throwError(() => new Error('Session expired'));
  }

  return next(token ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : request).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 || error.status === 419) {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_token_expires_at');
        localStorage.removeItem('admin_user');
        window.location.href = '/';
      }

      return throwError(() => error);
    }),
  );
};

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideHttpClient(withInterceptors([adminAuthInterceptor])),
    provideRouter(routes)
  ]
};
