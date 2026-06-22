import { Injectable, inject } from "@angular/core";
import { AuthService } from "./auth-service";

@Injectable({
  providedIn: "root",
})
export class AppPermissionService {
  private auth = inject(AuthService);

  has(permission: string): boolean {
    const user = this.auth.getUserData();
    const roles = user?.roles ?? [];

    if (roles.some((role: any) => String(role.name).toLowerCase() === "admin")) {
      return true;
    }

    if (user?.restaurant_id && !user?.agent_id) {
      return true;
    }

    if (!roles.length) {
      return false;
    }

    return roles.some((role: any) =>
      (role.permissions ?? []).some((item: any) => (typeof item === "string" ? item : item.name) === permission)
    );
  }

  hasAny(permissions: string[]): boolean {
    return permissions.some((permission) => this.has(permission));
  }
}
