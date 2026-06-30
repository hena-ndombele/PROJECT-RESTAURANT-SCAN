import { CommonModule, DatePipe } from "@angular/common";
import { Component, OnInit, computed, inject, signal } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import Swal from "sweetalert2";
import { RoleDto } from "../../../../models/roles/RoleDto";
import { RestaurantPlanUsage } from "../../../../models/saas/saas.models";
import { UserDto } from "../../../../models/users/UserDto";
import { AgentDto } from "../../../../models/agents/AgentDto";
import { AgentService } from "../../../../services/agents/agent-service";
import { RoleService } from "../../../../services/roles/role-service";
import { SaasService } from "../../../../services/saas/saas-service";
import { UserService } from "../../../../services/users/user-service";
import { AppPermissionService } from "../../../../services/auth/permission-service";

@Component({
  selector: "app-list-user",
  standalone: true,
  imports: [CommonModule, DatePipe, ReactiveFormsModule],
  templateUrl: "./list-user.html",
  styleUrl: "./list-user.scss",
})
export class ListUser implements OnInit {
  private userService = inject(UserService);
  private roleService = inject(RoleService);
  private agentService = inject(AgentService);
  private saasService = inject(SaasService);
  private permissions = inject(AppPermissionService);

  isLoading = signal(true);
  isSaving = signal(false);
  users = signal<UserDto[]>([]);
  roles = signal<RoleDto[]>([]);
  agents = signal<AgentDto[]>([]);
  searchTerm = signal("");
  currentPage = signal(1);
  pageSize = 10;
  selectedUser = signal<UserDto | null>(null);
  selectedRoles = signal<string[]>([]);
  planUsage = signal<RestaurantPlanUsage | null>(null);

  userForm = new FormGroup({
    agent_id: new FormControl("", { nonNullable: true }),
    role_name: new FormControl("", { nonNullable: true }),
    first_name: new FormControl("", { nonNullable: true, validators: [Validators.required] }),
    last_name: new FormControl("", { nonNullable: true, validators: [Validators.required] }),
    email: new FormControl("", { nonNullable: true, validators: [Validators.required, Validators.email] }),
    phone_number: new FormControl("", { nonNullable: true }),
    address: new FormControl("", { nonNullable: true }),
    password: new FormControl("", { nonNullable: true }),
  });

  totalUserCount = computed(() => this.users().length);
  userLimitReached = computed(() => this.planUsage()?.permissions?.can_create_user === false);
  userLimitMessage = computed(() => this.planUsage()?.messages?.users ?? "");
  canManageRoles = computed(() => this.planUsage()?.permissions?.can_manage_roles === true);

  filteredUsers = computed(() => {
    const term = this.searchTerm().toLowerCase();
    const filtered = this.users().filter((user) =>
      `${user.first_name} ${user.last_name} ${user.email} ${user.phone_number ?? ""}`.toLowerCase().includes(term)
    );
    const startIndex = (this.currentPage() - 1) * this.pageSize;
    return filtered.slice(startIndex, startIndex + this.pageSize);
  });

  totalPages = computed(() => {
    const term = this.searchTerm().toLowerCase();
    const count = this.users().filter((user) =>
      `${user.first_name} ${user.last_name} ${user.email} ${user.phone_number ?? ""}`.toLowerCase().includes(term)
    ).length;
    return Math.ceil(count / this.pageSize);
  });

  pagesArray = computed(() => Array.from({ length: this.totalPages() }, (_, i) => i + 1));

  ngOnInit(): void {
    this.loadUsers();
    this.loadUsage();
    this.loadRoles();
    this.loadAgents();
  }

  canAccess(permission: string): boolean {
    return this.permissions.has(permission);
  }

  loadUsage(): void {
    this.saasService.restaurantUsage().subscribe({
      next: (usage) => this.planUsage.set(usage),
      error: () => this.planUsage.set(null),
    });
  }

  loadUsers(): void {
    this.isLoading.set(true);
    this.userService.list().subscribe({
      next: (response) => {
        this.users.set(response.data ?? []);
        this.currentPage.set(1);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false),
    });
  }

  loadRoles(): void {
    this.roleService.list().subscribe({
      next: (response) => this.roles.set(response.data ?? []),
      error: () => this.roles.set([]),
    });
  }

  loadAgents(): void {
    this.agentService.list().subscribe({
      next: (response: any) => this.agents.set(response?.data ?? response ?? []),
      error: () => this.agents.set([]),
    });
  }

  availableAgents(): AgentDto[] {
    const selected = this.selectedUser()?.agent_id;
    return this.agents().filter((agent) => !agent.user_id || agent.id === selected);
  }

  openCreate(): void {
    if (this.userLimitReached()) {
      Swal.fire("Plan limité", this.userLimitMessage() || "Votre plan ne permet pas de créer plus d'utilisateurs.", "warning");
      return;
    }

    this.selectedUser.set(null);
    this.selectedRoles.set([]);
    this.userForm.reset({
      agent_id: "",
      role_name: "",
      first_name: "",
      last_name: "",
      email: "",
      phone_number: "",
      address: "",
      password: "",
    });
    this.userForm.controls.agent_id.setValidators([Validators.required]);
    this.userForm.controls.role_name.setValidators([Validators.required]);
    this.userForm.controls.password.clearValidators();
    this.userForm.controls.first_name.disable();
    this.userForm.controls.last_name.disable();
    this.userForm.controls.email.disable();
    this.userForm.controls.phone_number.disable();
    this.userForm.controls.address.disable();
    this.userForm.controls.password.disable();
    this.userForm.controls.agent_id.enable();
    this.userForm.controls.role_name.enable();
    this.userForm.controls.agent_id.updateValueAndValidity();
    this.userForm.controls.role_name.updateValueAndValidity();
    this.userForm.controls.password.updateValueAndValidity();
  }

  openEdit(user: UserDto): void {
    this.selectedUser.set(user);
    this.selectedRoles.set((user.roles ?? []).map((role) => role.name));
    this.userForm.patchValue({
      agent_id: user.agent_id ?? "",
      role_name: user.roles?.[0]?.name ?? "",
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      phone_number: user.phone_number ?? "",
      address: user.address ?? "",
      password: "",
    });
    this.userForm.controls.agent_id.setValidators([Validators.required]);
    this.userForm.controls.role_name.setValidators([Validators.required]);
    this.userForm.controls.agent_id.disable();
    this.userForm.controls.role_name.enable();
    this.userForm.controls.first_name.disable();
    this.userForm.controls.last_name.disable();
    this.userForm.controls.email.disable();
    this.userForm.controls.phone_number.disable();
    this.userForm.controls.address.disable();
    this.userForm.controls.password.disable();
    this.userForm.controls.password.clearValidators();
    this.userForm.controls.agent_id.updateValueAndValidity();
    this.userForm.controls.role_name.updateValueAndValidity();
    this.userForm.controls.password.updateValueAndValidity();
  }

  onAgentSelected(event: Event): void {
    const agentId = (event.target as HTMLSelectElement).value;
    const agent = this.agents().find((item) => item.id === agentId);
    if (!agent) {
      return;
    }

    this.userForm.patchValue({
      first_name: agent.first_name,
      last_name: agent.last_name,
      email: agent.email,
      phone_number: agent.phone_number ?? "",
      address: agent.address ?? "",
    });
  }

  onRoleChange(roleName: string, event: Event): void {
    if (!this.canManageRoles()) return;
    const checked = (event.target as HTMLInputElement).checked;
    const current = this.selectedRoles();
    this.selectedRoles.set(checked ? [...current, roleName] : current.filter((name) => name !== roleName));
  }

  isRoleSelected(roleName: string): boolean {
    return this.selectedRoles().includes(roleName);
  }

  saveUser(): void {
    if (this.userForm.invalid) {
      this.userForm.markAllAsTouched();
      return;
    }

    const formValue = this.userForm.getRawValue();
    const selected = this.selectedUser();
    if (!selected && !formValue.role_name) {
      Swal.fire("Role requis", "Selectionnez au moins un role pour cet utilisateur.", "warning");
      return;
    }

    const payload = selected
      ? { roles: [formValue.role_name] }
      : { agent_id: formValue.agent_id, roles: [formValue.role_name] };

    this.isSaving.set(true);
    const request = selected ? this.userService.update(selected.id, payload) : this.userService.create(payload);

    request.subscribe({
      next: () => {
        this.isSaving.set(false);
        Swal.fire("Succèss", selected ? "Utilisateur mis à jour avec succès." : "Utilisateur créé avec succès.", "success");
        this.loadUsers();
        this.loadAgents();
        this.loadUsage();
      },
      error: (err) => {
        this.isSaving.set(false);
        Swal.fire("Erreur", err.error?.message || "Impossible d'enregistrer l'utilisateur.", "error");
      },
    });
  }

  confirmDelete(user: UserDto): void {
    Swal.fire({
      title: "Supprimer l'utilisateur ?",
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
      this.userService.delete(user.id).subscribe({
        next: () => {
          this.users.update((users) => users.filter((item) => item.id !== user.id));
          this.loadUsage();
          Swal.fire("Supprimé", "Utilisateur supprimé avec succès.", "success");
        },
        error: (err) => Swal.fire("Erreur", err.error?.message || "Impossible de supprimer l'utilisateur.", "error"),
      });
    });
  }

  roleNames(user: UserDto): string {
    return (user.roles ?? []).map((role) => role.name).join(", ");
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
