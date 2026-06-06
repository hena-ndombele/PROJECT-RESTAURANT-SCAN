import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';

export const restaurantSessionGuard: CanActivateFn = () => {
  const router = inject(Router);
  const expiresAt = localStorage.getItem('auth_token_expires_at');
  if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('restaurant_token');
    localStorage.removeItem('auth_token_expires_at');
    localStorage.removeItem('restaurant_session');
    localStorage.removeItem('restaurant_login_at');
    localStorage.removeItem('user_data');
    router.navigate(['/restaurant/login']);
    return false;
  }

  const hasSession = !!localStorage.getItem('restaurant_session');

  if (hasSession) return true;

  router.navigate(['/restaurant/login']);
  return false;
};
