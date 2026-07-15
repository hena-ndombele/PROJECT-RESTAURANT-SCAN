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

  hasRole(roleName: string): boolean {
    const user = this.auth.getUserData();
    const roles = user?.roles ?? [];
    const expected = this.normalizeRoleName(roleName);

    return roles.some((role: any) => this.normalizeRoleName(role?.name) === expected);
  }

  hasAnyRole(roleNames: string[]): boolean {
    return roleNames.some((roleName) => this.hasRole(roleName));
  }

  private normalizeRoleName(value: any): string {
    return String(value || "").toLowerCase().trim().replace(/[\s_]+/g, "-");
  }
}
