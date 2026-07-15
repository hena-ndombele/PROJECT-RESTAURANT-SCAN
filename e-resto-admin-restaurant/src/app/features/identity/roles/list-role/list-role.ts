import { CommonModule, DatePipe } from "@angular/common";
import { Component, OnInit, computed, inject, signal } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import Swal from "sweetalert2";
import { PermissionDto } from "../../../../models/permissions/PermissionDto";
import { RoleDto } from "../../../../models/roles/RoleDto";
import { PermissionService } from "../../../../services/permissions/permission-service";
import { RoleService } from "../../../../services/roles/role-service";
import { AppPermissionService } from "../../../../services/auth/permission-service";
import { SaasService } from "../../../../services/saas/saas-service";
import { RestaurantPlanUsage } from "../../../../models/saas/saas.models";

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
  private saasService = inject(SaasService);

  isLoading = signal(true);
  isSaving = signal(false);
  roles = signal<RoleDto[]>([]);
  permissions = signal<PermissionDto[]>([]);
  planUsage = signal<RestaurantPlanUsage | null>(null);
  searchTerm = signal("");
  currentPage = signal(1);
  pageSize = 10;
  selectedRole = signal<RoleDto | null>(null);
  selectedPermissionNames = signal<string[]>([]);
  activePermissionGroup = signal("dashboard");

  private readonly moduleLabels: Record<string, { label: string; description: string }> = {
    dashboard: { label: "Tableau de bord", description: "Accès aux statistiques et indicateurs." },
    agents: { label: "Employés", description: "Gestion des fiches employés et badges." },
    users: { label: "Utilisateurs", description: "Création des accès de connexion." },
    roles: { label: "Rôles", description: "Gestion des rôles et autorisations." },
    permissions: { label: "Permissions", description: "Consultation des autorisations disponibles." },
    categories: { label: "Catégories", description: "Gestion des catégories du menu." },
    plats: { label: "Plats", description: "Gestion des plats et prix." },
    tables: { label: "Tables", description: "Gestion des tables et QR codes." },
    reservations: { label: "Réservations", description: "Gestion des réservations clients." },
    orders: { label: "Commandes", description: "Suivi et traitement des commandes." },
    feedback: { label: "Avis clients", description: "Consultation des retours clients." },
    settings: { label: "Paramètres", description: "Configuration du restaurant." },
    subscription: { label: "Abonnement", description: "Consultation et paiement de l'abonnement." },
    "business-restaurants": { label: "Multi-restaurant", description: "Accès aux restaurants du groupe Business." },
    profile: { label: "Profil", description: "Profil personnel et mot de passe." },
  };

  private readonly actionLabels: Record<string, string> = {
    list: "Voir la liste",
    view: "Afficher les détails",
    create: "Créer",
    update: "Modifier",
    delete: "Supprimer",
    pay: "Payer l'abonnement",
    "update-status": "Changer le statut",
    "change-password": "Changer le mot de passe",
  };

  roleForm = new FormGroup({
    name: new FormControl("", { nonNullable: true, validators: [Validators.required] }),
  });

  totalRoleCount = computed(() => this.roles().length);
  roleLimitReached = computed(() => this.planUsage()?.permissions?.can_create_role === false || this.starterRoleLimitReached());
  roleLimitMessage = computed(() => this.planUsage()?.messages?.roles || "Votre plan ne permet pas de créer plus de rôles.");

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

    this.permissions().filter((permission) => this.permissionAllowedForPlan(permission.name)).forEach((permission) => {
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
    this.loadUsage();
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

  loadUsage(): void {
    this.saasService.restaurantUsage().subscribe({
      next: (usage) => this.planUsage.set(usage),
      error: () => this.planUsage.set(null),
    });
  }

  openCreate(): void {
    if (this.roleLimitReached()) {
      Swal.fire("Plan limité", this.roleLimitMessage(), "warning");
      return;
    }

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
    if (!selected && this.roleLimitReached()) {
      Swal.fire("Plan limité", this.roleLimitMessage(), "warning");
      return;
    }

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
        Swal.fire("Succès", selected ? "Rôle mis à jour avec succès." : "Rôle créé avec succès.", "success")
          .then(() => window.location.reload());
      },
      error: (err) => {
        this.isSaving.set(false);
        Swal.fire("Erreur", err.error?.message || "Impossible d'enregistrer le rôle.", "error");
      },
    });
  }

  confirmDelete(role: RoleDto): void {
    Swal.fire({
      title: "Supprimer le rôle ?",
      text: "Cette action est irréversible.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Supprimer",
      cancelButtonText: "Annuler",
      confirmButtonColor: "#dc3545",
    }).then((result) => {
      if (!result.isConfirmed) {
        return;
      }
      this.roleService.delete(role.id).subscribe({
        next: () => {
          this.roles.update((roles) => roles.filter((item) => item.id !== role.id));
          Swal.fire("Supprimé", "Rôle supprimé avec succès.", "success")
            .then(() => window.location.reload());
        },
        error: (err) => Swal.fire("Erreur", err.error?.message || "Impossible de supprimer le rôle.", "error"),
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

  private starterRoleLimitReached(): boolean {
    const slug = String(this.planUsage()?.plan?.slug || this.planUsage()?.plan?.name || "").toLowerCase();
    return slug.includes("starter") && this.roles().length >= 5;
  }

  private permissionAllowedForPlan(permissionName: string): boolean {
    const moduleKey = permissionName.split(".")[0];
    const permissions = this.planUsage()?.permissions;
    const features = this.planUsage()?.features || {};

    if (moduleKey === "reservations") {
      return permissions?.can_use_reservations !== false && features["reservations"] !== false;
    }

    if (moduleKey === "feedback") {
      return permissions?.can_use_feedback !== false && features["feedback"] !== false;
    }

    if (moduleKey === "roles") {
      return permissions?.can_manage_roles !== false;
    }

    if (moduleKey === "business-restaurants") {
      return permissions?.can_use_multi_restaurant === true || features["multi_restaurant"] === true;
    }

    return true;
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
