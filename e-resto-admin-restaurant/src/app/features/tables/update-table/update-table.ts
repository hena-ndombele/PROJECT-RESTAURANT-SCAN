import { Component, Input, OnChanges, SimpleChanges, inject } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import Swal from "sweetalert2";
import { TableDto } from "../../../models/table/TableDto";
import { TableService } from "../../../services/table/table-service";

@Component({
  selector: "app-update-table",
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: "./update-table.html",
  styleUrl: "./update-table.scss",
})
export class UpdateTable implements OnChanges {
  @Input() table: TableDto | null = null;
  private tableService = inject(TableService);
  isLoading = false;

  tableForm = new FormGroup({
    name: new FormControl("", [Validators.required]),
    capacity: new FormControl("", [Validators.required, Validators.min(1)]),
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["table"] && this.table) {
      this.tableForm.patchValue({
        name: this.table.name || "",
        capacity: String(this.table.capacity || ""),
      });
    }
  }

  get modalId(): string {
    return `updateTableModal${this.table?.id || ""}`;
  }

  clearNameError(): void {
    const control = this.tableForm.get("name");
    if (!control?.hasError("duplicate")) {
      return;
    }

    const errors = { ...(control.errors || {}) };
    delete errors["duplicate"];
    control.setErrors(Object.keys(errors).length ? errors : null);
  }

  onSubmit(): void {
    if (!this.table?.id) {
      return;
    }

    if (this.tableForm.invalid) {
      this.tableForm.markAllAsTouched();
      return;
    }

    const payload = {
      name: this.formatTableName(this.tableForm.value.name || ""),
      capacity: Number(this.tableForm.value.capacity),
    };

    this.isLoading = true;
    this.tableService.update(this.table.id, payload).subscribe({
      next: () => {
        this.isLoading = false;
        Swal.fire({
          title: "Table modifiée",
          text: "Les informations de la table ont été mises à jour.",
          icon: "success",
          confirmButtonText: "Fermer",
          timer: 2000,
          confirmButtonColor: "#28a745",
        }).then(() => window.location.reload());
      },
      error: (err) => {
        this.isLoading = false;
        const duplicateName = err.error?.errors?.name?.[0];
        if (duplicateName) {
          this.tableForm.get("name")?.setErrors({ duplicate: true });
          this.tableForm.get("name")?.markAsTouched();
        }

        Swal.fire({
          title: "Erreur",
          text: duplicateName || err.error?.message || "Impossible de modifier la table.",
          icon: "error",
          confirmButtonColor: "#d33",
          confirmButtonText: "Réessayer",
        });
      },
    });
  }

  private formatTableName(value: string): string {
    return String(value || "")
      .replace(/(\D+)(\d+)/g, "$1 $2")
      .replace(/\s+/g, " ")
      .toUpperCase()
      .trim();
  }
}
