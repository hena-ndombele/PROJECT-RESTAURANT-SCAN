import { CommonModule, DatePipe } from "@angular/common";
import { Component, OnInit, computed, inject, signal } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import Swal from "sweetalert2";
import { PermissionDto } from "../../../../models/permissions/PermissionDto";
import { RoleDto } from "../../../../models/roles/RoleDto";
import { PermissionService } from "../../../../services/permissions/permission-service";
import { RoleService } from "../../../../services/roles/role-service";

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

  isLoading = signal(true);
  isSaving = signal(false);
  roles = signal<RoleDto[]>([]);
  permissions = signal<PermissionDto[]>([]);
  searchTerm = signal("");
  currentPage = signal(1);
  pageSize = 10;
  selectedRole = signal<RoleDto | null>(null);
  selectedPermissionNames = signal<string[]>([]);

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

  ngOnInit(): void {
    this.loadRoles();
    this.loadPermissions();
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
      next: (response) => this.permissions.set(response.data ?? []),
    });
  }

  openCreate(): void {
    this.selectedRole.set(null);
    this.selectedPermissionNames.set([]);
    this.roleForm.reset({ name: "" });
  }

  openEdit(role: RoleDto): void {
    this.selectedRole.set(role);
    this.roleForm.patchValue({ name: role.name });
    this.selectedPermissionNames.set((role.permissions ?? []).map((permission) => permission.name));
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
