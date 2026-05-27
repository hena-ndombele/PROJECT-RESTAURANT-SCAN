import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';

export const restaurantSessionGuard: CanActivateFn = () => {
  const router = inject(Router);
  const hasSession = !!localStorage.getItem('restaurant_session');

  if (hasSession) return true;

  router.navigate(['/restaurant/login']);
  return false;
};
