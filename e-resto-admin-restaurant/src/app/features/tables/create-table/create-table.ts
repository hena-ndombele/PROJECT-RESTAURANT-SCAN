import { Component, Input, signal } from "@angular/core";
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from "@angular/forms";
import { TableService } from "../../../services/table/table-service";
import Swal from "sweetalert2";

@Component({
    selector: "app-create-table",
    imports: [
        FormsModule,
        ReactiveFormsModule
    ],
    templateUrl: "./create-table.html",
    styleUrl: "./create-table.scss",
    standalone: true
})
export class CreateTable {
    @Input() disabled = false;
    @Input() limitMessage = "";

    isLoading = false;
    name = signal("");

    constructor(private tableService: TableService) {}

    tableForm = new FormGroup({
        name: new FormControl("", [Validators.required]),
        capacity: new FormControl("", [Validators.required, Validators.min(1)]),
    });

    onSubmit(): void {
        if (this.disabled) {
            Swal.fire({
                title: "Forfait atteint",
                text: this.limitMessage || "Votre forfait ne permet pas de créer plus de tables.",
                icon: "warning",
                confirmButtonColor: "#d33",
                confirmButtonText: "Compris"
            });
            return;
        }

        if (this.tableForm.invalid) {
            this.tableForm.markAllAsTouched();
            return;
        }

        const formData = new FormData();
        const formattedName = (this.tableForm.value.name || "")
            .replace(/(\D+)(\d+)/g, "$1 $2")
            .replace(/\s+/g, " ")
            .toUpperCase()
            .trim();

        formData.append("name", formattedName);
        formData.append("capacity", this.tableForm.value.capacity!.toString());

        this.createTable(formData);
    }

    createTable(data: FormData): void {
        this.isLoading = true;
        this.tableService.create(data).subscribe({
            next: () => {
                this.isLoading = false;
                Swal.fire({
                    title: "Succès",
                    text: "La table a été créée avec succès.",
                    icon: "success",
                    confirmButtonText: "Fermer",
                    timer: 2000,
                    confirmButtonColor: "#28a745"
                }).then(() => window.location.reload());
            },
            error: (err) => {
                this.isLoading = false;
                const duplicateName = err.error?.errors?.name?.[0];
                Swal.fire({
                    title: "Erreur",
                    text: duplicateName || err.error?.message || "Erreur lors de la création.",
                    icon: "error",
                    confirmButtonColor: "#d33",
                    confirmButtonText: "Réessayer"
                });
            }
        });
    }
}
