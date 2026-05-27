import { CommonModule, DatePipe } from "@angular/common";
import { Component, OnInit, computed, inject, signal } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import Swal from "sweetalert2";
import { RoleDto } from "../../../../models/roles/RoleDto";
import { UserDto } from "../../../../models/users/UserDto";
import { RoleService } from "../../../../services/roles/role-service";
import { UserService } from "../../../../services/users/user-service";

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

  isLoading = signal(true);
  isSaving = signal(false);
  users = signal<UserDto[]>([]);
  roles = signal<RoleDto[]>([]);
  searchTerm = signal("");
  currentPage = signal(1);
  pageSize = 10;
  selectedUser = signal<UserDto | null>(null);
  selectedRoles = signal<string[]>([]);

  userForm = new FormGroup({
    first_name: new FormControl("", { nonNullable: true, validators: [Validators.required] }),
    last_name: new FormControl("", { nonNullable: true, validators: [Validators.required] }),
    email: new FormControl("", { nonNullable: true, validators: [Validators.required, Validators.email] }),
    phone_number: new FormControl("", { nonNullable: true }),
    address: new FormControl("", { nonNullable: true }),
    password: new FormControl("", { nonNullable: true }),
  });

  totalUserCount = computed(() => this.users().length);

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
    this.loadRoles();
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
    });
  }

  openCreate(): void {
    this.selectedUser.set(null);
    this.selectedRoles.set([]);
    this.userForm.reset({
      first_name: "",
      last_name: "",
      email: "",
      phone_number: "",
      address: "",
      password: "",
    });
    this.userForm.controls.password.setValidators([Validators.required, Validators.minLength(6)]);
    this.userForm.controls.password.updateValueAndValidity();
  }

  openEdit(user: UserDto): void {
    this.selectedUser.set(user);
    this.selectedRoles.set((user.roles ?? []).map((role) => role.name));
    this.userForm.patchValue({
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      phone_number: user.phone_number ?? "",
      address: user.address ?? "",
      password: "",
    });
    this.userForm.controls.password.clearValidators();
    this.userForm.controls.password.updateValueAndValidity();
  }

  onRoleChange(roleName: string, event: Event): void {
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
    const payload = {
      ...formValue,
      phone_number: formValue.phone_number || null,
      address: formValue.address || null,
      password: formValue.password || null,
      roles: this.selectedRoles(),
    };

    const selected = this.selectedUser();
    this.isSaving.set(true);
    const request = selected ? this.userService.update(selected.id, payload) : this.userService.create(payload);

    request.subscribe({
      next: () => {
        this.isSaving.set(false);
        Swal.fire("Success", selected ? "User updated successfully." : "User created successfully.", "success");
        this.loadUsers();
      },
      error: (err) => {
        this.isSaving.set(false);
        Swal.fire("Error", err.error?.message || "Unable to save user.", "error");
      },
    });
  }

  confirmDelete(user: UserDto): void {
    Swal.fire({
      title: "Delete the user?",
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
      this.userService.delete(user.id).subscribe({
        next: () => {
          this.users.update((users) => users.filter((item) => item.id !== user.id));
          Swal.fire("Deleted", "User deleted successfully.", "success");
        },
        error: (err) => Swal.fire("Error", err.error?.message || "Unable to delete user.", "error"),
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
