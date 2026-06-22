import { CommonModule, DatePipe } from "@angular/common";
import { Component, OnInit, computed, inject, signal } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import Swal from "sweetalert2";
import { PermissionDto } from "../../../../models/permissions/PermissionDto";
import { RoleDto } from "../../../../models/roles/RoleDto";
import { PermissionService } from "../../../../services/permissions/permission-service";
import { RoleService } from "../../../../services/roles/role-service";
import { AppPermissionService } from "../../../../services/auth/permission-service";

interface PermissionGroup {
  key: string;
  label: string;
  description: string;
  permissions: PermissionDto[];
}

@Component({
  selector: "app-list-role",
  standalone: true,
  imports: [CommonModule, DatePipe, ReactiveFormsModule],
  templateUrl: "./list-role.html",
  styleUrl: "./list-role.scss",
})
export class ListRole implements OnInit {
  private roleService = inject(RoleService);
  private permissionService = inject(PermissionService);
  private permissionsService = inject(AppPermissionService);

  isLoading = signal(true);
  isSaving = signal(false);
  roles = signal<RoleDto[]>([]);
  permissions = signal<PermissionDto[]>([]);
  searchTerm = signal("");
  currentPage = signal(1);
  pageSize = 10;
  selectedRole = signal<RoleDto | null>(null);
  selectedPermissionNames = signal<string[]>([]);
  activePermissionGroup = signal("dashboard");

  private readonly moduleLabels: Record<string, { label: string; description: string }> = {
    dashboard: { label: "Tableau de bord", description: "Acces aux statistiques et indicateurs." },
    agents: { label: "Employes", description: "Gestion des fiches employes et badges." },
    users: { label: "Users", description: "Creation des acces de connexion." },
    roles: { label: "Roles", description: "Gestion des roles et autorisations." },
    permissions: { label: "Permissions", description: "Consultation des autorisations disponibles." },
    categories: { label: "Categories", description: "Gestion des categories du menu." },
    plats: { label: "Plats", description: "Gestion des plats et prix." },
    tables: { label: "Tables", description: "Gestion des tables et QR codes." },
    reservations: { label: "Reservations", description: "Gestion des reservations clients." },
    orders: { label: "Commandes", description: "Suivi et traitement des commandes." },
    feedback: { label: "Avis clients", description: "Consultation des retours clients." },
    settings: { label: "Parametres", description: "Configuration du restaurant." },
    profile: { label: "Profil", description: "Profil personnel et mot de passe." },
  };

  private readonly actionLabels: Record<string, string> = {
    list: "Voir la liste",
    view: "Afficher les details",
    create: "Creer",
    update: "Modifier",
    delete: "Supprimer",
    "update-status": "Changer le statut",
    "change-password": "Changer le mot de passe",
  };

  roleForm = new FormGroup({
    name: new FormControl("", { nonNullable: true, validators: [Validators.required] }),
  });

  totalRoleCount = computed(() => this.roles().length);

  filteredRoles = computed(() => {
    const term = this.searchTerm().toLowerCase();
    const filtered = this.roles().filter((role) =>
      role.name.toLowerCase().includes(term) ||
      (role.guard_name ?? "").toLowerCase().includes(term) ||
      this.permissionNames(role).toLowerCase().includes(term)
    );
    const startIndex = (this.currentPage() - 1) * this.pageSize;
    return filtered.slice(startIndex, startIndex + this.pageSize);
  });

  totalPages = computed(() => {
    const term = this.searchTerm().toLowerCase();
    const count = this.roles().filter((role) =>
      role.name.toLowerCase().includes(term) ||
      (role.guard_name ?? "").toLowerCase().includes(term) ||
      this.permissionNames(role).toLowerCase().includes(term)
    ).length;
    return Math.ceil(count / this.pageSize);
  });

  pagesArray = computed(() => Array.from({ length: this.totalPages() }, (_, i) => i + 1));

  permissionGroups = computed<PermissionGroup[]>(() => {
    const groups = new Map<string, PermissionDto[]>();

    this.permissions().forEach((permission) => {
      const [moduleKey] = permission.name.split(".");
      if (moduleKey === "account-requests") {
        return;
      }
      const key = moduleKey || "other";
      groups.set(key, [...(groups.get(key) ?? []), permission]);
    });

    return Array.from(groups.entries()).map(([key, permissions]) => {
      const meta = this.moduleLabels[key] ?? {
        label: this.humanize(key),
        description: "Autorisations du module.",
      };

      return {
        key,
        label: meta.label,
        description: meta.description,
        permissions: permissions.sort((a, b) => this.permissionActionLabel(a.name).localeCompare(this.permissionActionLabel(b.name))),
      };
    });
  });

  activeGroup = computed(() => {
    const groups = this.permissionGroups();
    return groups.find((group) => group.key === this.activePermissionGroup()) ?? groups[0] ?? null;
  });

  ngOnInit(): void {
    this.loadRoles();
    this.loadPermissions();
  }

  canAccess(permission: string): boolean {
    return this.permissionsService.has(permission);
  }

  loadRoles(): void {
    this.isLoading.set(true);
    this.roleService.list().subscribe({
      next: (response) => {
        this.roles.set(response.data ?? []);
        this.currentPage.set(1);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false),
    });
  }

  loadPermissions(): void {
    this.permissionService.list().subscribe({
      next: (response) => {
        this.permissions.set(response.data ?? []);
        const firstGroup = this.permissionGroups()[0]?.key;
        if (firstGroup && !this.permissionGroups().some((group) => group.key === this.activePermissionGroup())) {
          this.activePermissionGroup.set(firstGroup);
        }
      },
    });
  }

  openCreate(): void {
    this.selectedRole.set(null);
    this.selectedPermissionNames.set([]);
    this.activePermissionGroup.set(this.permissionGroups()[0]?.key ?? "dashboard");
    this.roleForm.reset({ name: "" });
  }

  openEdit(role: RoleDto): void {
    this.selectedRole.set(role);
    this.roleForm.patchValue({ name: role.name });
    this.selectedPermissionNames.set((role.permissions ?? []).map((permission) => permission.name));
    this.activePermissionGroup.set(this.permissionGroups()[0]?.key ?? "dashboard");
  }

  onPermissionChange(permissionName: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const current = this.selectedPermissionNames();
    this.selectedPermissionNames.set(
      checked ? [...current, permissionName] : current.filter((name) => name !== permissionName)
    );
  }

  isPermissionSelected(permissionName: string): boolean {
    return this.selectedPermissionNames().includes(permissionName);
  }

  selectGroup(groupKey: string): void {
    this.activePermissionGroup.set(groupKey);
  }

  isGroupFullySelected(group: PermissionGroup): boolean {
    return group.permissions.every((permission) => this.isPermissionSelected(permission.name));
  }

  selectedCount(group: PermissionGroup): number {
    return group.permissions.filter((permission) => this.isPermissionSelected(permission.name)).length;
  }

  toggleGroup(group: PermissionGroup, checked: boolean): void {
    const names = group.permissions.map((permission) => permission.name);
    const current = this.selectedPermissionNames();

    this.selectedPermissionNames.set(
      checked
        ? Array.from(new Set([...current, ...names]))
        : current.filter((name) => !names.includes(name))
    );
  }

  permissionActionLabel(permissionName: string): string {
    const action = permissionName.split(".").slice(1).join(".");
    return this.actionLabels[action] ?? this.humanize(action || permissionName);
  }

  permissionDescription(permissionName: string): string {
    const [moduleKey] = permissionName.split(".");
    const moduleName = this.moduleLabels[moduleKey]?.label ?? this.humanize(moduleKey);
    return `${moduleName} - ${this.permissionActionLabel(permissionName)}`;
  }

  saveRole(): void {
    if (this.roleForm.invalid) {
      this.roleForm.markAllAsTouched();
      return;
    }

    const selected = this.selectedRole();
    const payload = {
      name: this.roleForm.controls.name.value,
      permissions: this.selectedPermissionNames(),
    };

    this.isSaving.set(true);
    const request = selected
      ? this.roleService.update(selected.id, payload)
      : this.roleService.create(payload);

    request.subscribe({
      next: () => {
        this.isSaving.set(false);
        Swal.fire("Success", selected ? "Role updated successfully." : "Role created successfully.", "success");
        this.loadRoles();
      },
      error: (err) => {
        this.isSaving.set(false);
        Swal.fire("Error", err.error?.message || "Unable to save role.", "error");
      },
    });
  }

  confirmDelete(role: RoleDto): void {
    Swal.fire({
      title: "Delete the role?",
      text: "This action is irreversible.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Delete",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#dc3545",
    }).then((result) => {
      if (!result.isConfirmed) {
        return;
      }
      this.roleService.delete(role.id).subscribe({
        next: () => {
          this.roles.update((roles) => roles.filter((item) => item.id !== role.id));
          Swal.fire("Deleted", "Role deleted successfully.", "success");
        },
        error: (err) => Swal.fire("Error", err.error?.message || "Unable to delete role.", "error"),
      });
    });
  }

  permissionNames(role: RoleDto): string {
    return (role.permissions ?? []).map((permission) => permission.name).join(", ");
  }

  private humanize(value: string): string {
    return value
      .replace(/[-_.]/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  onSearch(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
    this.currentPage.set(1);
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
    }
  }
}
