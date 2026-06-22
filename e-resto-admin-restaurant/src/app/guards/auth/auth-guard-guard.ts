import {ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot} from "@angular/router";
import {Injectable} from "@angular/core";
import {AuthService} from "../../services/auth/auth-service";
import {AppPermissionService} from "../../services/auth/permission-service";

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  constructor(private auth: AuthService, private router: Router, private permissions: AppPermissionService) {}

  private readonly fallbackRoutes = [
    { path: '/dashboard', permission: 'dashboard.view' },
    { path: '/orders/list', permission: 'orders.list' },
    { path: '/tables/list-table', permission: 'tables.list' },
    { path: '/dish/list-dish', permission: 'plats.list' },
    { path: '/category/list-category', permission: 'categories.list' },
    { path: '/agents/list-agent', permission: 'agents.list' },
    { path: '/auth/profile', permission: 'profile.view' },
  ];

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean {
    if (!this.auth.getToken()) {
      this.router.navigate(['/restaurant/login']);
      return false;
    }

    const requiredPermission = route.data?.['permission'] as string | undefined;
    if (!requiredPermission || this.permissions.has(requiredPermission)) {
      return true;
    }

    const fallback = this.fallbackRoutes.find((item) =>
      item.path !== state.url && this.permissions.has(item.permission)
    );
    this.router.navigate([fallback?.path ?? '/404-error']);
    return false;
  }
}
